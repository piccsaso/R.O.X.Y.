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

## Helmet HUD, route planner and scanner

The walk now carries a simulated helmet display. It reads the same ground the walker collides with (`ground.bin`), so what it warns about is what actually stops you.

| Do this | Key or command |
|---|---|
| Plan a route to a landmark | Press **T** and type `take me to the upper bench`, or hold **V** and say it |
| Tint the terrain by dataset | **1** hazards, **2** slope, **3** ground truth (measured or inferred), **4** surveyed ground |
| Open the planning view | **M**. Drag to orbit, scroll to zoom, click the terrain or a label to set a destination. **M** or **Enter terrain** dives back |
| Clear the route, mute spoken alerts | **C**, **N** |

Other commands: `show hazards`, `hide slopes`, `show ground truth`, `return to start`, `clear route`, `map`. Landmarks: Layered slab, Outcrop band, Upper bench, Look-back point, South-east corner, East edge. These are team labels, not NASA feature names.

**What it does.** The route is planned on a prior map, then corrected as you walk. The scanner sweeps the ground within 7 m, with terrain blocking its view, and marks what it has surveyed. When it finds a rock step the prior map missed on your route, the HUD says what it found and how far ahead, re-plans, and redraws the route. Try `take me to the upper bench` from the start: the first route crosses the outcrop band and is replaced when the scanner reaches it. On arrival a card describes the stop.

**What is real and what is simulated.**

| Item | Class | Source |
|---|---|---|
| Terrain shape and colour, measured or inferred flag | Observation | NASA/JPL-Caltech Navcam mesh products, sols 470 to 501 |
| Hazards, slope, route distance and climb | Derived from the terrain | `ground.bin`, 3.5 cm samples, 14 cm routing grid |
| Scanner and the surveyed area | Simulated sensor reading the measured surface | `nav.mjs` |
| Prior map | Simulated: the rover surface averaged to 1 m, the post spacing of the HiRISE elevation product. It is not the HiRISE product itself | `nav.mjs` |
| Walking time, EVA budget, reserve, safe-return margin | Assumptions, editable on screen | `config` in `nav.mjs` |

A step counts as a hazard when the walker cannot cross it: more than 17 cm between the centre and the edge of a 16 cm footprint, or more than 25 cm across it. Walking time uses a slope-dependent speed scaled to 1.1 m/s on the flat. It is not a validated spacewalk model.

Voice uses the browser's speech recognition and only listens while **V** is held. In Chrome the audio goes to an online service. If the microphone or the service is unavailable, the button says so and typing still works. Spoken alerts use the browser's built-in voice and work offline.

`npm.cmd test` runs the planner checks on the real ground data: routes to every landmark are walked with the viewer's own movement rule, the detour names a real blocker, and the prior route is blocked and replaced after scanning. Add `?hud=0` to the address to open the original demo without the HUD.

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

[Full project history and prompts](PROJECT_HISTORY.md) · [Start here in a new chat](HANDOFF.md)
