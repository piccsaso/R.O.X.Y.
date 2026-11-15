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
