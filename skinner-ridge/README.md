# Skinner Ridge walk

Explore a **28 × 24.5 m** patch of Perseverance’s Skinner Ridge workspace at Hawksbill Gap, Jezero crater. This doubles the previous terrain footprint to 686 m². The original walk past the pale layered slab is still the starting route.

## Run the demo on Windows

From this directory with Node.js 24 installed (the version used for verification):

```powershell
npm.cmd ci
npm.cmd start
```

Open [the local demo](http://127.0.0.1:8080/) in desktop Chrome or Edge. Click **Enter terrain**, then walk with **WASD** and look with the mouse. Press **R** to reset or **Esc** to release the mouse. From the starting view, aim just right of the pale slab and walk uphill with the slab on your left. The surrounding ground continues past the original route.

[Start at the slab](screenshots/spawn.png) · [Look back at the slab](screenshots/walked-return.png) · [Explore beyond the old boundary](screenshots/walked-expanded.png) · [Crossing inferred ground](screenshots/walked-infill.png) · [Overhead view](screenshots/survey.png)

## What was measured and what was filled

NASA/JPL-Caltech Navcam mesh and image products from sols 470, 471, 474, 477, 499, and 501 provide the ground measurements and color. This expansion evaluated six additional views. Twenty-three of the thirty tested inputs contributed. The manifest records every input and its actual contribution. **63%** of the export’s horizontal footprint had sufficient stereo samples to anchor the mesh. Gaps and the remaining margins use estimated heights and texture sampled from sharp rover-covered surfaces. The viewer extends the horizon with decorative terrain beyond the playable mesh. The infill and horizon are approximate.

[Coverage map](terrain-coverage.png) shows measured support in light tan and inferred support in dark brown, with intermediate tan where only one triangle in a cell had support. The top of the map is the low-Z edge. This map reflects the original stereo anchors. The steepest stitch transitions receive additional slope smoothing, including some triangles anchored by stereo.

- `terrain.glb` is the complete textured terrain, including inferred surfaces.
- `ground.bin` has little-endian Float32 heights followed by one Uint8 triangle mask per cell. Both triangles are present in every cell. Collision samples those same planes and checks step height across a 16 cm clearance radius.
- `terrain.json` holds product IDs and URLs, PDS motion counters and XYZ references, input checksums, and coverage counts.
- `route.json` holds the slab and expanded route in metres, plus the estimated walkable area connected to spawn on a 14 cm test grid.
- `sources.json` is the input list. [Original site comparison](SITE_SELECTION.md)

## Rebuild and verify

```powershell
npm.cmd ci
npm.cmd run download
npm.cmd run build
npm.cmd run capture
```

The download step retrieves the original OBJ, PNG and XML files and checks existing bytes against the manifest. The build reads archived stereo meshes in SITE_FRAME 26, rejects long triangles and small disconnected fragments, and weights compatible measurements by density. It solves for missing heights at several scales using measured heights as anchors, adds small ripples farther from the anchors, and softens sharp stitch steps. The texture bake rejects degenerate and discontinuous projections, favors well-resolved camera views, feathers photo boundaries and grid-aligned projection jumps in image space, and substitutes overlapping Navcam texture swatches where projection quality is low. The viewer uses anisotropic texture filtering at grazing angles.

The mesh uses a 3.5 cm grid with 1,120,000 indexed triangles. World X is west, Y is up and Z is north. One world unit is one metre. The crop origin in the site frame is (77.49 m north, 2.51 m east, −14 m down). Soft detail can still be visible on steep or occluded surfaces. The terrain is a heightfield, so overhangs and unobserved vertical rock faces remain approximate.

The capture command uses Chrome at its default Windows path. Pass a different executable after `npm.cmd run capture --`. It checks pointer lock, the slab and expansion walks, boundary collision, reset, and ground contact over inferred surfaces, then writes screenshots. The route generator estimates 613 m² of walkable ground connected to spawn and finds a 14.47 m continuation beyond the 3.55 m slab route. Chrome verified a 17.71 m walk past the slab and into the expansion, then a separate 7.10 m route across inferred terrain. Boundary collision and reset passed.

Rover imagery and stereo products are credited to NASA/JPL-Caltech. [JPL image use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/).

[Project history](PROJECT_HISTORY.md)
