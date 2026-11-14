# Sol 3: landmarks, rover traverse, and multi-mission layers

Time box: 4 hours. This can run before Sol 2 if reconstruction is blocked on a download, because it only needs the site and the coordinate transform from Sol 1.

## Goal

Give the scenes their meaning: what is here, what is worth visiting, and what other missions say about this ground. Everything is delivered as data files inside `scenes/jezero_orbital/` and `scenes/jezero_rover/`. The app reads them through the scene contract; you write no app code. This is the data half of master step 2, sections C1.1, C1.3 and C1.4.

## Deliverables, in priority order

1. **Landmark catalogue** (`landmarks.json` in both scenes, format in master step 2, section C0.1). At least one landmark with a VERIFIED position, a reachable viewing point, and a science entry: what Perseverance measured there, which instruments, the sol, and links to the real images or products. Add several more named targets if their positions can be verified. Entries whose positions you cannot verify go in with `position_status: UNKNOWN` and no coordinates. Never place a landmark at a guessed position. Give each entry a few aliases, including likely mishearings, because the app matches voice commands against them.

2. **Perseverance traverse** (`routes/perseverance_traverse.geojson`). The public location map has served traverse and waypoint GeoJSON under `mars.nasa.gov/mmgis-maps/M20/Layers/json/`. Verify the URLs still work and what fields they carry. Convert to local metres. Check registration by eye against rover tracks or stops in the orthoimage, and report the offset in metres.

3. **Second-mission layer** (`overlays/`). At least one dataset that is not from Perseverance and helps plan a walk. The HiRISE terrain already counts as one mission (Mars Reconnaissance Orbiter). Add a second kind of data: THEMIS infrared or thermal inertia from Mars Odyssey is the first choice because it gives the entry optical, topographic and thermal data. The USGS SIM 3464 geologic map database bundles THEMIS mosaics and CTX DTMs. Deliver it as a PNG with bounds in local metres, its true resolution, units and value range. If it is coarser than the patch, mark it `render_mode: map`.

4. **Radiation scenario inputs** (`overlays/radiation_scenario.json`). There is no measured dose map at Jezero. Provide a baseline surface dose rate from Curiosity RAD in Gale crater with its citation, labelled as a reference proxy from another site, and a multiplier for a solar particle event scenario with its source. The app computes the spatial field from terrain (sky visibility); you supply only the sourced numbers and the wording of the assumptions.

5. **Geologic units** from USGS SIM 3464 (map only, with a note that it was mapped at 1:75,000). Only if time remains.

## For every source

Record in `docs/SOURCES.md`: URL (tested), licence, credit line, coordinate system, native resolution, coverage of the site, and how you verified it. Add each product to `data/manifest.csv`.

## Done when

- Both scenes contain a `landmarks.json` with at least one VERIFIED, reachable landmark and its science entry with working links.
- The traverse and at least one non-Perseverance layer are registered, with offsets reported.
- Each overlay has a complete metadata entry in `scene.json` (data class, units, resolution, source, credit, licence).

## Do not

- Show a coarse product as if it had rover-scale precision.
- Present any radiation number without its source, its units, and the word "scenario".
