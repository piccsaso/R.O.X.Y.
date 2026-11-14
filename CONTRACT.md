# Marswalk scene contract 1.0.0 — frozen

This formalises roadmap §4 and master step 2 C0. Changes must be additive,
bump `schema_version` and be recorded in `DECISIONS.md`. The JSON Schemas in
`schema/` are authoritative for field structure; the invariants below are also
checked by scene-core. Extra fields are allowed for additive metadata.

## Package

`scenes/<scene_id>/` contains `scene.json`, `terrain.glb`, `collision.glb`,
`landmarks.json`, `ground_grid.json`, `overlays/`, and `routes/` (empty directories
are fine). Optional `prior_collision.glb` describes the map known before the walk;
when present, `prior_ground_grid.json` uses exactly the truth grid's layout.
Sol supplies geometry and metadata; Astra's `tools/build-ground-grid` creates the
grids. A manifest declares `terrain`, `collision`, `landmarks`, `ground_grid`,
optional `prior_collision` / `prior_ground_grid`, overlay and route paths.
Paths are relative to the scene directory; no external runtime dependencies.
Visual geometry affects appearance only. Walking, slope, coverage and routing
read the generated grid. No code change is needed to load a different scene:
`?scene=<scene_id>`. See `scenes/test_scene/scene.json` for a complete example.

## Coordinates and metadata

Units: `"metres"`. Axes: `"+X east, +Y up, -Z north"` (right-handed glTF).
Positions are `[x,y,z]`; polygons, grid origins and GeoJSON use `[x,z]` local
metres, **not longitude/latitude**. Polygon rings omit a duplicate final vertex.
`playable_bounds` is a simple polygon. `spawn.position` is a ground position;
`spawn.heading` and viewing-point `facing` are degrees clockwise from north
(0 = −Z, 90 = +X). `spawn.eye_height` is metres above sampled ground.
`spawn.json`, when supplied for legacy tools, duplicates `scene.json.spawn`.

`origin.description` documents the local origin and `origin.site_frame` names
the rover SITE frame, or is null for a documented geographic/synthetic origin.
Optional `site_to_local` is a column-major 4×4 transform. For a north/east/down
SITE frame the axis conversion is `(east, -down, -north)`; verify the source
frame before applying it. Do not assume every source is already in that frame.

`map_transform.status` is VERIFIED, ESTIMATED, or NONE. NONE means conversion
returns null. Otherwise supply `reference_body: "Mars"`, a documented `datum`,
planetocentric `latitude`, east-positive `longitude`, and `radius_m`. ESTIMATED
also requires `error_m`. Version 1 uses local equirectangular tangent conversion:
lat = lat0 − z/R, lon = lon0 + x/(R cos(lat0)), radians internally. Height is
local y, not a claim of datum elevation. The inverse is provided. This is for
small patches away from the poles; registration accuracy remains explicit.

## Collision and ground grid

Ground mesh nodes must be named `ground_<PROVENANCE>` with provenance exactly
`ROVER_MEASURED`, `ROVER_STEREO`, `ORBITAL`, or `INTERPOLATED`.
Solid mesh nodes must be `obstacle_<name>` (nonempty name). These names apply to
mesh nodes, including children of transformed groups. Unclassified mesh nodes
are errors. The same rules apply to optional `prior_collision.glb`. Standard
uncompressed glTF 2.0 triangle meshes are supported, with node transforms baked
by the builder; collisions must not use skins, morphs or compression extensions.
No bridges/overhangs with walkable stacked floors: a 2.5D grid cannot encode them.

`ground_grid` contains `path`, `cell_size` (initial/final 0.25 m), `origin: [x,z]`,
`dimensions: [width,depth]`, `encoding: "json-row-major-v1"`. Cell (i,j) is sampled
at `origin + [(i+.5)*cell_size,(j+.5)*cell_size]`, index `j*width+i`; rows run +Z.
The JSON grid file repeats that layout plus `schema_version: "1.0.0"` and equal
length arrays `height`, `provenance`, `valid`, `obstacle`. Heights are metres;
valid and obstacle values are 0/1. Ground ray misses have height null, valid 0,
provenance UNKNOWN. Hits have finite height, valid 1 and a named provenance.
Obstacles are independent conservative cell occupancy (triangle projections
intersecting a cell), even when ground exists underneath. Highest ground ray hit
wins. The builder samples downward through **collision**, never visual terrain.
UNKNOWN is never walkable. Grid extents must contain playable_bounds; prior and
truth layouts must match. Prior geometry may omit hazards intentionally.

## Landmarks and overlays

`landmarks.json` is `{schema_version: "1.0.0", landmarks: [...]}`. IDs are stable
and unique. Positions may be null only for unverified entries. `position_status`
is VERIFIED / ESTIMATED / UNKNOWN. `scene_status` is IN_SCENE_REACHABLE,
IN_SCENE_BLOCKED_TARGET, OUTSIDE_PATCH or POSITION_UNVERIFIED. Blocked targets
use reachable `viewing_points` with their own IDs, positions and facing; never
route onto a rock. Catalog search includes outside and unverified entries but
never silently promotes them to destinations. Aliases and display names are
normalised (case, accents, punctuation and whitespace), then ranked with fuzzy
matches. Close candidates set `ambiguous`; callers must offer a choice.

`science` carries description, instruments, product links, sol, site_drive and
`data_class`. Optional `science.photo` carries a scene-relative `path`,
`image_id`, `sol`, `camera`, `credit`, `source_url` (Sol supplies the real image).
`sources` and manifest `credits` carry product_id, url, credit and license.

Overlays declare id, name, path, format, data_class, units, resolution (metres),
coverage polygon, source, credit, license, provenance_notes, default_visible,
and render_mode (`3d`, `map`, `both`). PNG additionally requires
`bounds: [minX,minZ,maxX,maxZ]` and `value_range: [min,max]`; row 0 is minZ,
red channel 0..255 maps linearly to the range, alpha 0 means no data. GeoJSON
and routes use local `[x,z]`; routes declare id, path, data_class and attribution.
Data classes: OBSERVATION, TERRAIN-DERIVED, ORBITAL-CONTEXT, SIMULATION,
ASSUMPTION, TEST-DATA, UNKNOWN. `is_test_data: true` always shows TEST DATA.
Synthetic geometry's provenance tag identifies a test class, not mission data.

## Integration and verification

From `app/`: `npm install`, `npm run generate:test-scene`,
`npm run grid -- ../scenes/<scene_id>`, `npm run validate -- ../scenes/<scene_id>`,
`npm test`, `npm run dev`. Node 22+; no WSL required. Grid metadata must be
present before building; paths default to the named files above. The validation
command checks schemas, grid contents, geometry names and package asset presence.
`npm run build` copies scene assets into the offline static distribution.
Navigation thresholds live only in `config/navigation.json`, each labelled
ASSUMPTION with a rationale. The pure walker is shared with future planner tests.
