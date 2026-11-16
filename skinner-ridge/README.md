# Skinner Ridge: extended Mars walk

Explore **56 × 49.07 m (2,747.92 m²)** of detailed terrain, twice the previous 1,372.833 m² crop. Every point of the core terrain is traversable, including steep rocks. The surrounding rendered context is also collidable: you can cross the detailed crop edge without meeting an invisible wall. Only the outer edge of the rendered context stops movement.

## Run

```powershell
npm.cmd ci
npm.cmd start
```

Open [the terrain](http://127.0.0.1:8080/) or [the lower path](http://127.0.0.1:8080/?view=lower-path). Click **Enter terrain**.

- **WASD:** walk at 2.6 m/s, increased from 1.1 m/s.
- **Shift:** sprint at 5 m/s.
- **Mouse:** look; **R:** reset to the slab; **Esc:** release the mouse.
- **F:** toggle the exploration light. Night ground is deliberately dark without it.
- With the mouse released, use the sky panel to pause/resume or scrub time.

An automatic **eight-minute** cycle replays one observation-anchored Mars sol. The Sun and NASA star field follow dated Mars orientation data. Startup uses sol 477, June 23, 2022, at the archived Navcam observation time. [Sky sources and assumptions](SKY.md)

## Terrain and visual changes

The expanded crop retains 3.5 cm geometry spacing and 5 mm baked texture spacing. It is delivered as **four aligned GLB tiles**, each with a 5,600 × 4,907 texture, avoiding browser texture-size and individual GitHub file-size limits. All four tiles are required. Shared boundary normals eliminate lighting discontinuities between tiles.

Photo and relief completion uses 528 intact 1.4 m Navcam donor patches, with texture seams chosen to preserve features. Inference remains the subtle, photo-matched sand/gravel/rock treatment previously selected by the user. The new lighting adds warm dust haze, a finite solar disk, blue scattering near sunset, fading catalog stars, and an optional local exploration beam.

The sky orientation is data-derived, but atmospheric color, dust density, photographic exposure, and relighting are visual approximations. The original terrain imagery contains baked lighting and shadows; these cannot become fully physically correct moving shadows. Some steep close-ups remain soft, and heightfields cannot reproduce overhangs. No claim of scientifically exact radiometry or uniformly photorealistic terrain is made.

## Assets

| Property | Current value |
| --- | --- |
| Detailed crop | 56 × 49.07 m / 2,747.92 m² |
| Core grid | 1,601 × 1,403 vertices |
| Core triangles | 4,486,400 |
| Stereo-supported horizontal area | About 44.49% |
| Site-frame origin | North 65.24 m, east 16.51 m, down −14 m |
| Export axes and units | X west, Y up, Z north; metres |
| Rendered context bounds | X −110 to 166 m; Z −110 to 159.07 m |

`terrain-0.glb` through `terrain-3.glb`, `ground.bin`, `terrain.json`, `terrain-coverage.png`, and `route.json` form one matched set. The old single `terrain.glb` is superseded. Each tile already has world-coordinate positions. Load all tiles without additional translation.

The coverage image identifies full measured support in light tan, partial support in intermediate tan, and inferred ground in dark brown. Top is low Z. `sources.json` and `terrain.json` preserve archived product URLs, checksums, coordinate frames, and contributions. Outside the core, `apron.mjs` generates estimated context and samples collision from its exact rendered triangles; this extended scenery is not a NASA reconstruction.

`sky-data.json` contains 721 SPICE-derived samples. `stars.png` is a display-exposure conversion of NASA SVS's celestial-coordinate star map. Runtime cubemap reprojection avoids pole-related texture filtering artifacts. See [SKY.md](SKY.md) for astronomy limitations and credits.

## Rebuild and verify

```powershell
npm.cmd run download
npm.cmd run build
npm.cmd run verify
npm.cmd run capture
node capture-sky.mjs
```

The source cache is ignored. The build needs several gigabytes of memory; if necessary set `$env:NODE_OPTIONS='--max-old-space-size=8192'`. `verification.json` checks every core cell, render/collision consistency, tile sizes, normals, surrounding context samples, and sky matrices. Browser results are in `screenshots/verification.json` and `screenshots/sky-verification.json`.

The current tests use Node.js 25.6.1 and Chrome/SwiftShader on Windows. Restricted environments can explicitly opt into `$env:CHROME_NO_SANDBOX='1'`. `QA_FAST=1` uses a smaller capture viewport for software-rendered movement checks. These are correctness checks, not a GPU frame-rate guarantee.

Sky regeneration requires Python with `spiceypy` and `numpy`: run `python build-sky.py`, then `node build-star-texture.mjs`. These fetch the documented NASA data into the ignored source cache. The normal viewer needs no Python and runs from the bundled assets after `npm ci`.

[History](PROJECT_HISTORY.md) · [Handoff](HANDOFF.md) · [NASA source selection](SITE_SELECTION.md)

Terrain imagery and meshes: NASA/JPL-Caltech. Star-map visualization: NASA/Goddard Space Flight Center Scientific Visualization Studio, Ernie Wright; Hipparcos-2, Tycho-2 and Gaia DR2 catalogs. [JPL image use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/).
## Latest delivery

See [UPDATED_MAP_HANDOFF.md](UPDATED_MAP_HANDOFF.md) for the complete chat handoff. The default view and both reset controls now open on the northern ground facing the ridge, matched to the user's screenshot. `route.start` defines this pose; `?view=spawn` retains the old slab test viewpoint. Run `node capture-start.mjs` to check the new start and resets.

## Helmet HUD

The walk opens with a simulated helmet display and a route to the demo goal, the **Ridge summit**, from **Home Base** (the start position). Click the view to walk; press **Esc** to free the mouse for the two buttons.

- **Compass** (top), **minimap** (top right, follows you, north up), **suit gauge** (bottom left: oxygen, suit power, heart rate, suit temperature, position in the Site 26 frame).
- **Destination pin**: a bubble over the goal showing seconds and metres left along the active route.
- **Routes button**: Straight line (orange), Safe route (green), Voice route (violet). The safe route avoids footing that steps more than 17 cm within a 16 cm footprint; from Home Base to the summit it is 56 m with none of that footing, where the straight line is 45 m and crosses 8 m of it. The pin uses the safe route unless a voice route is active.
- **Roxy voice control**: say **"Roxy"**; a microphone icon appears, then say a command: "map", "close", "safe route", "straight line", "slope", "ground truth", "clear route", "mute", "reset position", "take me to the slab". Saying a name toggles it. "Roxy map" in one breath also works. Roxy turns on with your first click and can be switched off under Options. Press **V** to open the microphone without the wake word, or **T** to type.
- **Voice route**: "Roxy, take me to the slab" plans a route to that landmark. The route is saved under the Routes button so it can be switched on later. Clicking the terrain in the map view does the same for any point.
- **Options button**: Slope, Ground truth (rover-measured, inferred, or context terrain), Map (planning view), Clear route, Mute.
- **Return warning**: appears only when the oxygen or power left, after a 20% reserve, is close to what the safe walk back to Home Base needs. It pulses in the centre, then docks at the left with a red route home. Say or type "low oxygen" to trigger it for a demo. **R** resets the suit and position.

### Recording the promo video

Open `http://127.0.0.1:8080/?sky=day&promo` and start your screen recorder. The view opens as bare Martian landscape with no display. Click once to take control; four seconds later the display comes online in stages (compass, title, minimap, suit gauge, route lines, destination pin). Use `&promo=8` for a different delay in seconds. Press **B** to bring it online or take it offline by hand, for another take. The Esc buttons and the sky panel are hidden in this mode; Roxy, T and the other keys still work.

### Film mode: the 30-second pitch, hands-free

Open `http://127.0.0.1:8080/?film` (add `&team=Name&project=Name` to change the names; the defaults are Renispace and Roxy). Start your screen recorder, then click anywhere. The app plays the picture by itself on a fixed 30-second schedule, at night. It is silent and has no captions: record your own narration over it, starting each line at the time shown.

| Start | Line to say | Picture |
|---|---|---|
| 0:01 | "Night on Mars. Your base is out of sight." | Fade in on the stars over the dark ridge |
| 0:04 | "One bad step… and you don't get home." | Camera settles toward the ground |
| 0:08 | "We're Renispace. This is Roxy, a helmet display you simply talk to." | Suit light on, display comes online, title |
| 0:13 | "It knows the ground, because NASA's Perseverance rover measured it." | Ground-truth highlight, data credit |
| 0:18 | "It finds the safest way up, not just the shortest," | Walks the safe route |
| 0:22 | "and it tells you when it's time to turn back." | Return warning |
| 0:26 | "Roxy is not just a tool; it is safety, reliability and efficiency!" | End card with that line, then cut to black at 0:29.7 |

The end card credits the NASA data and states that the code was AI-assisted and the suit telemetry is simulated. Trim the recording where the picture cuts to black.

### How the safe route is chosen

The safe route minimises walking time multiplied by a hazard factor, per 20 cm grid cell:

`cost = time × (1 + 6 × (w₁·slope + w₂·topography + w₃·weather + w₄·thermal) / (sum of the weights that have data))`

Each layer is a risk from 0 to 1. Weights and limits are in `hazards` in `nav.mjs` (all weights 1 by default).

| Layer | Source | Impassable at |
|---|---|---|
| Slope | Terrain, over a 0.8 m baseline | 35° |
| Topography | Terrain: height change within a 16 cm footprint (ledges, boulders) | 0.45 m |
| Weather | External overlay | risk 0.9 |
| Thermal | External overlay | risk 0.9 |

Impassable cells are never entered. If they cut the goal off completely, the planner returns the least-bad crossing and flags it as forced. A layer with no data at a cell is left out there and the other weights are renormalised, so a missing, partial or misaligned overlay cannot break routing.

**Weather and thermal have no data in this repository yet**, so today the route is shaped by slope and topography only, and the breakdown says "no data" for the other two. To plug a layer in, either put a grid file at `overlays/weather.json` or `overlays/thermal.json`:

```json
{"x0": 0, "z0": 0, "cell": 1, "cols": 56, "rows": 49, "min": 0, "max": 1, "values": [0.1, 0.2, null]}
```

(local metres, +X west, +Z north, row-major from `z0`; `null` means unknown; values are scaled from `min`..`max` to 0..1), or call it from code or the browser console:

```js
marswalk.setHazardOverlay('thermal', {sample: (x, z) => riskBetween0and1});
marswalk.hazards.weights.thermal = 2; marswalk.replan();
```

The call returns how many grid cells received data. **Why this route:** say "Roxy, explain route" (or type it with T). The same breakdown, per layer (mean and peak risk, metres at high risk, cost in seconds), is logged to the browser console every time the route is planned, and is on `route.breakdown`.

What is real and what is not: terrain shape, colour and the measured or inferred flag come from NASA/JPL-Caltech Navcam products. Slope and routes are computed from that terrain. Oxygen, power, heart rate and temperature are simulated, and the walking time is an assumption (2.6 m/s on the flat, slower on slopes). Landmark names are team labels. Roxy uses the browser's speech recognition; in Chrome the audio goes to an online service for as long as Roxy is switched on.

`npm.cmd test` checks the planner on the real ground data. Add `?hud=0` to the address for the walk without the HUD.
