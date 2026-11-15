# Updated map — complete chat handoff

Prepared 15 November 2026. Repository: `piccsaso/nasa-hackathon`, project directory: `skinner-ridge/`, delivery branch: `updated-map` (Git does not permit spaces in branch names).

## User intent and agreed choices

The teammate's original first-person Skinner Ridge reconstruction looked convincing around measured rocks but soft, stretched, or poorly meshed on the lower path and unobserved ground. The user requested improved close-up realism, expansion, and a visually cohesive Mars exploration experience.

Decisions made in this chat:

- “Double the size” means twice the ground area, not twice both dimensions. This was requested twice in succession.
- Preserve measured rocks and the original pale-slab approach. Improve missing coverage using nearby NASA-photo-derived sand, gravel, and layered-rock appearance. The user explicitly approved subtle photo-matched treatment rather than pronounced added rock relief.
- First-person exploration is the primary use. No hardware target was specified.
- Walk on all slopes, including steep rocks, with feet on the terrain; no flight. Remove the close internal boundary and allow walking onto rendered surrounding ground.
- Faster walking and sprinting.
- Automatic day/night cycle: one representative Mars sol in eight real minutes, with pause and time controls.
- Use a documented Skinner Ridge observation date and authoritative NASA sky sources. Natural night darkness with an optional exploration light.
- Latest request: use the supplied screenshot's open-ground, ridge-facing view as the starting view; commit all work and this handoff to a new branch called “updated map.”

## Implementation history

The original published terrain covered 28 × 24.5 m (686 m²), with about 613 m² connected to spawn and approximately 63% stereo support. It used a single 1,120,000-triangle GLB and an 801 × 701 height grid.

The first local iteration, commit `73e3846` on `improve-skinner-ridge`, expanded the footprint to 39.62 × 34.65 m (1,372.833 m²). It improved inferred lower-ground texture and relief with subtle photo-derived donor patches while preserving measured anchors. Detailed original prompts, source products, and decisions remain in [PROJECT_HISTORY.md](PROJECT_HISTORY.md).

The second iteration, commit `0c210b4` on `expand-mars-sky-cycle`, expanded to the current 2,747.92 m², made the context traversable, increased movement speed, and added the dated Sun/star sky and day/night controls. `updated-map` descends from that commit and adds the screenshot-matched start plus this consolidated handoff.

This branch is based on the earlier main history ending at `8662c85`, not the subsequently merged teammate HUD branch. Remote main was observed at `0ce60eeb52e8d58daaa2c8792706fc2b237e636d` during this handoff. That merge adds HUD/planner/scanner work. It has not been integrated into this exploration branch. A future merge must reconcile viewer, ground rules, dimensions, routes, materials, and documentation; do not overwrite the teammate's additions blindly.

## Current terrain and collision

| Property | Value |
|---|---|
| Detailed footprint | 56 × 49.07 m = 2,747.92 m² |
| Height grid | 1,601 × 1,403; 3.5 cm spacing |
| Unique vertices | 2,246,203 |
| Triangles | 4,486,400 |
| Stereo-supported faces | 1,995,850; approximately 44.49% |
| Tile exports | `terrain-0.glb` through `terrain-3.glb` |
| Combined GLB bytes | 167,380,788; each tile below 100 MB |
| Atlas per tile | 5,600 × 4,907 pixels; approximately 5 mm per texel |
| Infill donor patches | 528, approximately 1.4 m patches |
| Site-frame crop origin | north/east/down `[65.24, 16.51, -14]` |
| Scene axes | local west / up / north; metres |
| Eye height | 1.65 m above the sampled surface |
| Context bounds | X [-110, 166], Z [-110, 159.07] |

The four GLBs, `ground.bin`, `terrain.json`, `terrain-coverage.png`, and `route.json` form a matched set. GLB positions are already world coordinates: do not independently translate the tiles. Normals are computed from the full heightfield so tile borders agree. Texture and relief synthesis retain measured/inferred provenance; predicted terrain is not a new NASA measurement.

`apron.mjs` generates the surrounding rendered terrain and samples collision from the same triangles. Walking crosses the detailed crop boundary without an invisible wall. The far outer edge remains finite and blocks movement. This is a heightfield: climbing is intentionally unrestricted, but it does not model caves, overhangs, or realistic mountaineering.

## New opening view

The opening pose visually matches the supplied screenshot's northern open-ground view toward the ridge. It is a visual match, not a recovery of camera telemetry from the screenshot.

- Local X = 30 m, Z = -2 m, standing on the rendered context just beyond the detailed crop.
- Heading yaw = π radians, looking toward +Z; pitch = +0.025 radians.
- Camera Y is always sampled ground + 1.65 m, rather than a fixed world altitude.
- `route.start` is the public opening/reset pose. Default page load, Reset button, and R all use it.
- `route.spawn` remains the original slab-route regression anchor. `?view=spawn` still opens that old view for comparisons; it is no longer the default.
- `route-check.mjs` regenerates the start from site-frame anchors, preserving it during a terrain rebuild.
- Reference output: [opening-view.png](screenshots/opening-view.png). Focused checks: [start-verification.json](screenshots/start-verification.json).

## Controls and sky

WASD walks at 2.6 m/s; hold Shift for 5 m/s. Mouse looks, R resets, F toggles the exploration light, and Esc releases pointer lock and reveals sky controls. The page begins with an Enter terrain button. Pause/resume and the time slider work outside pointer lock. `?sky=day`, `?sky=sunset`, and `?sky=night` select paused sky presets. Ordinary startup runs the automatic cycle.

The cycle uses elapsed wall time, not accumulated bounded movement timesteps: one sol is exactly 480 real seconds even during slow software rendering. Movement uses bounded substeps. This is a representative-sol replay; wrapping returns to the reference observation rather than continuously simulating future dates.

Reference time: **2022-06-23T22:55:32.782Z**, sol 477, Navcam product `NLF_0477_0709296508M723RAS_N0261004NCAM00708_0A00LLJ02`. NASA waypoint site 26 / drive 1004 gives planetocentric latitude 18.45889532°, east longitude 77.40616768°, radius 3,391,983.897 m.

`build-sky.py` uses NASA/JPL SPICE DE440s, PCK00011, and NAIF0012 to generate 721 orientation/Sun samples across 88,775.244 seconds. `sky.mjs` interpolates these samples in the local west/up/north frame. The Sun has a distance-derived angular radius. NASA SVS Deep Star Maps 2020 supplies catalog-based J2000 star directions, transformed into the local Mars sky. EXR rows are preserved with `flipY=false`; conversion to a cubemap avoids polar streaks. Sirius and Vega source-map coordinates were spot-checked.

Sources and detailed limits are in [SKY.md](SKY.md). Primary links:

- [NASA SVS Deep Star Maps 2020](https://svs.gsfc.nasa.gov/4851/)
- [NASA rover waypoints](https://mars.nasa.gov/mmgis-maps/M20/Layers/json/M20_waypoints.json)
- [JPL NAIF generic kernels](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/)
- [NASA explanation of Mars sunrise and sunset](https://science.nasa.gov/solar-system/planets/mars/what-does-a-sunrise-sunset-look-like-on-mars/)
- [Curiosity Gale sunset reference](https://science.nasa.gov/resource/sunset-at-mars-gale-crater-curiosity/)

Source download hashes and generated star texture hashes are in `sky-data.json`; rover product identities are in `sources.json` and `terrain.json`. Credits include NASA/JPL-Caltech and NASA/GSFC SVS, Ernie Wright, and the catalog teams identified by NASA.

## Scientific and visual limitations

The atmosphere is an artistic approximation guided by Mars imagery: warm dusty daylight, a blue halo near the setting Sun, distance haze, and dark nights. It is not calibrated radiative transfer, measured dust opacity, or exact exposure. Star positions are catalog-based, while brightness and Milky Way visibility use a display exposure. Individual stellar proper motions/parallaxes are not propagated. Planets and moons are not rendered. The Sun calculation uses the Mars barycenter approximation described in SKY.md.

Terrain photos retain baked sunlight/shadows. Runtime day/night illumination and the exploration light modulate those textures; they do not reconstruct physically exact dynamic cast shadows. Missing geometry is inferred, including the outer context. Soft areas and source seams can remain. Do not claim the entire map is measured or the rendering physically perfect.

## File map

| Task | Files |
|---|---|
| Source products, provenance | `SITE_SELECTION.md`, `sources.json`, `terrain.json`, `terrain-coverage.png` |
| Download/build terrain | `download.mjs`, `reconstruct.mjs`, `infill.mjs` |
| Photo atlas and inferred detail | `atlas.mjs`, `texture-infill.mjs`, `terrain-synthesis.mjs`, `polish-atlas.mjs` |
| Tiled exports and normals | `export-terrain.mjs`, `terrain-normals.mjs` |
| Core/context surface and walking | `ground.mjs`, `apron.mjs`, `landscape.mjs`, `viewer.mjs` |
| Opening pose and regression routes | `route-check.mjs`, `route.json` |
| Sky source processing | `build-sky.py`, `requirements-sky.txt`, `build-star-texture.mjs` |
| Runtime sky and illumination | `sky.mjs`, `lighting.mjs`, `sky-data.json`, `stars.png` |
| UI/server/dependencies | `index.html`, `serve.mjs`, `package.json`, `package-lock.json` |
| Checks | `verify-assets.mjs`, `capture.mjs`, `capture-sky.mjs`, `capture-start.mjs` |

## Running and rebuilding

From `skinner-ridge/` in the checkout:

```powershell
npm.cmd ci
npm.cmd start
```

Open `http://127.0.0.1:8080/`. Use a desktop browser with WebGL. Node.js 25.6.1 and Chrome on Windows were used for this iteration; the older baseline used Node.js 24. Assets are substantial, so software-rendered checks are not a smoothness benchmark for the user's GPU.

For terrain rebuilds:

```powershell
npm.cmd run download
$env:NODE_OPTIONS='--max-old-space-size=8192'
npm.cmd run build
npm.cmd run verify
npm.cmd run capture
node capture-sky.mjs
node capture-start.mjs
```

To rebuild sky assets, install `requirements-sky.txt` into a Python environment and run `build-sky.py`, then `node build-star-texture.mjs`. See those scripts and SKY.md for cache paths and source URLs. Raw EXR/kernels and rover archives live in ignored `source/`; downloaded sources are not required merely to run the bundled demo.

The restricted test environment needed `CHROME_NO_SANDBOX=1` and loopback network access. This is a test-environment workaround, not a requirement to disable sandboxing in ordinary Chrome. `QA_FAST=1` reduces capture resolution. `SKY_CHECKS_ONLY=1` skips sky stills and checks movement/cycle timing. The `?qa` runtime hooks exist only when requested by the test URL.

## Verification evidence

- Every one of 2,243,200 detailed core cells is traversable; 27,612 context samples checked without holes.
- Exported positions agree with collision; normals are finite and unit length; all 721 sky matrices/directions pass validation.
- Browser walking checks passed slab approach, about 40.39 m expansion traversal, inferred terrain, lower path, pointer lock, reset, crossing into context, and the far outer boundary. No browser errors were reported.
- Measured movement checks returned 2.6 m/s walking and 5 m/s sprinting; the final wall-clock cycle check returned 480 seconds.
- The new focused start check validates default pose, both reset methods, ground contact, and a continuous approach into the core.
- Reports: `verification.json`, `screenshots/verification.json`, `screenshots/sky-verification.json`, `screenshots/start-verification.json`. Earlier walking/sky reports describe their respective prior run; the focused start report covers the latest pose change.

## Git and publication

All chat changes are included in the ancestry of local branch `updated-map`. Main is not modified by this work. Inspect `git status --short`, `git remote -v`, and `git log -3 --oneline` before publishing or merging.

At preparation time, local push authentication failed: Windows Credential Manager returned Access is denied. The connected GitHub API can read the repository, but that does not grant the local Git process credential access. Do not mistake a local commit or this document for proof that the branch has been uploaded. Once run from an authenticated terminal, publish with:

```powershell
git push -u origin updated-map
```

That single push includes the expansion, assets, sky, new start, and this Markdown handoff. No force push is needed. Review integration with the newer teammate HUD branch separately before merging into main.
