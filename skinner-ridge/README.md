# Skinner Ridge walk

Explore a **39.62 × 34.65 m** patch of Perseverance's Skinner Ridge workspace at Hawksbill Gap, Jezero crater. Its **1,372.833 m²** footprint is twice the previous 686 m². The original pale-slab approach is preserved, with photo-based ground completion across the lower apron and new margins.

## Run

From this directory in PowerShell:

```powershell
npm.cmd ci
npm.cmd start
```

Open [the slab approach](http://127.0.0.1:8080/) or [the lower path](http://127.0.0.1:8080/?view=lower-path) in desktop Chrome or Edge. Click **Enter terrain**, walk with **WASD**, and look with the mouse. **R** resets to the slab; **Esc** releases the mouse. Eye height is 1.65 m. Export units are metres, Y up.

[Slab look-back](screenshots/walked-return.png) · [Lower comparison pose](screenshots/lower.png) · [Lower extension](screenshots/walked-lower.png) · [Expansion](screenshots/walked-expanded.png) · [Survey](screenshots/survey.png)

## What changed

- Expanded each dimension by approximately √2, preserving 3.5 cm vertex spacing and 5 mm atlas texel spacing.
- Replaced small averaged texture swatches with **joint photo/relief quilting**. 410 intact 1.4 m patches from supported Navcam surfaces supply colors and detrended stereo relief together. Minimum-error seams preserve gravel and surface features.
- Faded inferred relief to zero at measured triangle vertices. Rendered ground and collision use the same completed heightfield.
- Made camera preferences continuous across shared triangle vertices to reduce grid seams while favoring sharper projections.
- Added restrained baked contact shading, capped at 12% darkening, and a dedicated lower-path walking test.

The user selected subtle sand, gravel, and layered rocks matching NASA photographs, then confirmed that treatment after viewing the lower-path before/after previews.

## Evidence and inference

Twenty-six of thirty archived Navcam observations contribute, from sols 470, 471, 474, 477, 499, and 501. **54.15%** of the horizontal triangle area has stereo support. Remaining areas use surrounding heights and example patches: plausible completions, **not measurements recovered from unseen terrain**. The Mastcam-Z [Skinner Ridge mosaic](https://science.nasa.gov/resource/perseverance-workspace-at-skinner-ridge/) was inspected as a visual reference, not used as calibrated geometry or directly projected onto the model.

The [coverage map](terrain-coverage.png) marks full stereo support in light tan, partial support in intermediate tan, and inference in dark brown. Its top is the low-Z edge. Slope refinement can also affect supported surfaces. Scenery beyond the collision boundary is decorative.

Close-up detail remains softer on some steep and occluded faces. A heightfield cannot represent overhangs, and donor patches may repeat. This is an improved image-based walkable reconstruction, not a claim of uniform photographic fidelity or a fully observed scan.

## Export and checks

| Item | Current export |
| --- | --- |
| Footprint | 39.62 × 34.65 m / 1,372.833 m² |
| Connected walkable area | About 1,275 m² on a 14 cm sampling grid; previously 613 m² |
| Grid | 1,133 × 991 vertices at 3.5 cm spacing |
| Triangles | 2,241,360 |
| Texture | 7,924 × 6,930 embedded JPEG |
| Site-frame origin | North 72.45 m, east 8.32 m, down −14 m |
| Axes | X west, Y up, Z north |

`terrain.glb`, `ground.bin`, `terrain.json`, `route.json`, and `terrain-coverage.png` are a matched set. Collision consists of little-endian Float32 heights followed by a Uint8 triangle mask, with both triangles present in every cell. `sources.json` and `terrain.json` preserve URLs, hashes, coordinate metadata, and actual source contributions. Metadata also records donor cells and the inference method.

`verification.json` records valid GLB lengths/buffer views, finite heights, exact render/collision height agreement, continuous collision, doubled area, and valid route endpoints. `screenshots/verification.json` records Chrome tests: 3.48 m past the slab, 21.52 m farther into the expansion, 8.29 m across inferred ground, and 6.40 m through the lower extension. Pointer lock, boundary collision, reset, and ground contact passed with no browser errors.

Tested with Node.js 25.6.1 and Chrome on Windows. Dependencies remain pinned to Three.js 0.180.0, pngjs 7.0.0, and jpeg-js 0.4.4. Captures use SwiftShader and verify correctness, not a hardware GPU frame-rate target. No target GPU was specified.

## Rebuild

```powershell
npm.cmd ci
npm.cmd run download
npm.cmd run build
npm.cmd run verify
npm.cmd run capture
```

Downloads run four at a time, with checksums and bounded retries. Network access is required; the large source cache is ignored by Git. Builds use several gigabytes of memory. If needed, set `$env:NODE_OPTIONS='--max-old-space-size=6144'` before building.

Supply a non-default Chrome executable after `npm.cmd run capture --`. The restricted test environment needed the explicit opt-in `$env:CHROME_NO_SANDBOX='1'`; ordinary interactive browsing does not need it. `CAPTURE_STILLS_ONLY=1` captures fixed views without movement tests.

Start implementation work in `reconstruct.mjs`, `infill.mjs`, `atlas.mjs`, `texture-infill.mjs`, and `terrain-synthesis.mjs`. `polish-atlas.mjs` bakes seam refinement and contact shading. `route-check.mjs`, `verify-assets.mjs`, and `capture.mjs` verify the result. The viewer culls terrain tiles outside the camera view.

Rover imagery and stereo geometry: NASA/JPL-Caltech. Mastcam-Z reference: NASA/JPL-Caltech/ASU/MSSS. [JPL image use policy](https://www.jpl.nasa.gov/jpl-image-use-policy/).

[Project history](PROJECT_HISTORY.md) · [Handoff](HANDOFF.md) · [Original site selection](SITE_SELECTION.md)
