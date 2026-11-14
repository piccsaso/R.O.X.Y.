# Astra 1: Skinner Ridge app, scene contract, expanded map, photoreal rendering

Time box: 4 hours (merged by 23:00 Saturday EST). Everything else in the project builds on this, so finish it before anything in Astra 2.

## Starting point: a working demo already exists

A teammate has pushed `skinner-ridge/` to `main`. Read `skinner-ridge/README.md`, `PROJECT_HISTORY.md`, `viewer.mjs`, `ground.mjs`, `landscape.mjs`, `terrain.json` and `route.json` before writing any code, and run it (`npm ci`, `npm start`). What it gives you:

- `terrain.glb`: a 28 × 24.5 m textured patch of Perseverance's Skinner Ridge workspace at Hawksbill Gap, Jezero crater, fused from NASA/JPL-Caltech Navcam mesh products (sols 470 to 501, SITE_FRAME 26). 1,120,000 triangles on a 3.5 cm grid, 37 MB. About 63% of the footprint has stereo support; the rest is inferred height and texture.
- `ground.bin`: the same surface as a heightfield (Float32 heights, then a Uint8 triangle mask per cell). `ground.mjs` samples it, and its `foot()` check is the collision rule: a 16 cm clearance radius and step limits.
- `viewer.mjs`: pointer-lock walk at 1.65 m eye height, tiled culling, anisotropic filtering, reset.
- `landscape.mjs`: fog, a sky dome, and a **decorative, procedurally invented** horizon beyond the patch.
- `route.json`: spawn, look-back and expansion viewpoints. `terrain-coverage.png`: measured versus inferred support.
- Axes: +X west, +Y up, +Z north, metres, origin at the crop corner, which is (77.49 m north, 2.51 m east, −14 m down) in SITE_FRAME 26.

Do not rebuild this. Do not edit or delete anything in `skinner-ridge/`; it stays runnable as it is. Build the new app in `app/` by porting the viewer code, and load the assets from where they are (do not commit a second copy of the 37 MB model).

## Goal

One app in which the player walks the real Skinner Ridge patch, sees real orbital terrain stretching to the horizon around it, and can walk out onto that terrain, all rendered to look as close to a photograph of Mars as the data allows, and all loading through one scene format that the planner and HUD will share.

## Part 1: contract and port (1.5 h)

1. **Scene contract.** `schema/scene.schema.json`, `schema/landmarks.schema.json` and a `CONTRACT.md` a teammate can read in five minutes. Follow master step 2, section C0.1, with these project decisions:
   - The Skinner Ridge axis convention above is the project convention for every scene. Write the exact transform from SITE_FRAME 26 (north, east, down) to local metres after reading `reconstruct.mjs`. This replaces the axis pin in roadmap section 4.
   - The ground may be a heightfield in the `ground.bin` layout or a `collision.glb`. Either way it is the single source of truth for walking.
   - Provenance per cell: ROVER_MEASURED (stereo-supported), INTERPOLATED (inferred fill), ORBITAL, UNKNOWN. For Skinner Ridge, take measured versus inferred from `terrain-coverage.png`; verify its size and orientation against the grid before trusting it (the README says the top of the image is the low-Z edge).
   - A scene may nest a detailed patch inside a wider context terrain. Add optional `photo` to the landmark science entry (path, image ID, sol, camera, credit, source URL).
2. **`scenes/skinner_ridge/scene.json`** describing the existing assets by relative path, with spawn and viewpoints from `route.json`, `is_test_data: false`, and credits from `terrain.json`.
3. **App** (`app/`, Vite, TypeScript, Three.js). Port the walker. Scene chosen by URL parameter. Keep the controller a pure module with thresholds in `config/navigation.json` (each with a rationale and the ASSUMPTION label); Astra 2's tests drive a scripted walker through it. A loading bar with real progress, because the model is large.
4. **scene-core** (`app/src/scene-core/`, no rendering dependencies, Vitest tests): scene loading and validation, ground height, normal and slope sampling, provenance lookup, local to map conversion, and landmark search (aliases, fuzzy match, ranked results, ambiguity flag).
5. **Planner grid builder** (`tools/build-ground-grid`): resamples the ground to a coarser routing grid. Each routing cell must keep the worst slope and largest step found inside it, so that downsampling never hides a hazard. Choose the cell size (0.25 to 0.5 m) and justify it in `DECISIONS.md`.

## Part 2: expand the map with real terrain (1 h)

The data engineer (Sol) is delivering `scenes/jezero_orbital/`: HiRISE elevation and orthoimage for the area around Skinner Ridge, in the same local frame.

- When that scene is present, **replace the invented horizon with it.** Seat the rover patch inside the orbital terrain, hide the orbital surface under the patch, and blend a narrow skirt so there is no visible seam or step. Report the height mismatch you found at the join.
- Let the player walk off the patch onto the orbital terrain. `playable_bounds` becomes the orbital extent (a few hundred metres). The HUD will show that the ground underfoot changed from rover-measured to orbital.
- For the far distance beyond the orbital crop, a low-detail backdrop is acceptable only if it is real data (a coarser orbital product from Sol) or a plain haze. No invented hills.
- Until Sol's scene lands, keep the existing decorative horizon behind a flag and label it in the credits line as decorative. Build and test the nesting code against a stand-in heightfield so it is ready.

## Part 3: make it look like a photograph (1 h)

The patch texture is real rover photography with sunlight already baked in. The job is to present it without damaging it.

- **Colour pipeline:** sRGB output, a filmic tone curve tuned so the rover photos keep their original colour, no relighting of photo-textured ground. Verify against a source Navcam frame side by side.
- **Atmosphere:** a Mars sky gradient with a soft sun glow in the direction consistent with the shadows in the photos, and distance haze that tints toward the horizon colour (aerial perspective), so the patch, the orbital terrain and the sky read as one scene.
- **Orbital ground at eye level:** a 25 cm orthoimage is blurry underfoot. Blend in fine surface detail sampled from rover photo swatches, fading out with distance, plus slope-based shading from the elevation data. This is a display enhancement over real orbital colour; it adds no geometry.
- **Inferred areas of the patch:** soften the visible transition between measured and inferred texture; do not sharpen invented detail.
- **Camera feel:** smooth acceleration and stopping, gentle walking bob that can be turned off, field of view near a helmet view, near plane close enough to look down at the ground without clipping.
- **Finishing:** antialiasing, mipmaps with maximum anisotropy, a light vignette and very light grain. No bloom or colour effects that alter the terrain's colour.
- **Opening shot:** start on a slow establishing view of the slab from the spawn point with the interface faded back, then hand over control.
- **Honesty switch:** one key toggles every enhancement off and shows the raw assets. The credits line always states "includes inferred and orbital terrain".
- **Performance:** hold 60 frames per second at 1080p on a mid-range laptop. Keep tiled culling. Measure and report frame time, load time and memory.

## Part 4: test scene and HUD frame (30 min)

- `scenes/test_scene/` generated by a script, `is_test_data: true`, with a visible "TEST DATA" watermark: everything in master step 2, section C0.3 (boulder, steep band, hole, ledge, two corridors, exposure field, exclusion zone, landmarks with an ambiguous alias pair and one outside the patch), plus a prior surface that lacks the boulder. Plain colours are fine; this scene exists for automated planner tests, not for looks.
- A helmet-visor frame over the view with named, empty regions for heading, route guidance, hazard radar, status, alerts and recognised voice text. Thin and unobtrusive; it must not cover the terrain.

## Done when

- `npm install`, `npm run dev` and `npm test` work in `app/` on Windows (test output in the report), and `skinner-ridge/` still runs unchanged.
- In a browser you walked from spawn past the slab, looked back, then walked off the patch onto the surrounding terrain with no seam, hole or fall. Save screenshots from spawn, look-back, the patch edge and an elevated view to `docs/img/`, each with enhancements on and off.
- The schema validates both scenes and rejects a deliberately broken copy.
- `CONTRACT.md` is on `main` within the first 90 minutes so Sol can match it.

## Constraints

- Nothing invented is presented as measured. Enhancements change appearance only, and the walking surface is always the ground data.
- The app works offline once loaded. No dependencies fetched at run time.
- After this prompt the contract is frozen; later changes are additive, with a version bump and a note in `DECISIONS.md`.
- If time runs short, the order to protect is: Part 1, then Part 2, then Part 3. Part 4's test scene can slip into the start of Astra 2.
