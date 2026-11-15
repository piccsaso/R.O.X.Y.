# Skinner Ridge handoff

## Current revision

The November 14, 2026 expansion doubles the previous 686 m² footprint to **1,372.833 m²**, with about **1,275 m² connected walkable area**. Work is based on `8662c85`, prepared on `improve-skinner-ridge`. Check Git and the remote before assuming publication.

Read [README.md](README.md) for current commands, dimensions, and limitations, then [PROJECT_HISTORY.md](PROJECT_HISTORY.md) for prior work and original prompts. Historical numbers describe their respective revisions. Keep repository-root planning documents intact.

## User intent

Improve visual detail and mesh quality, especially the lower area without measurements. Double **ground area**, not both dimensions. Favor subtle sand, gravel, and layered rocks matching NASA photographs. First-person exploration is the main use. Plausible inference is authorized in missing areas. The user reviewed the lower-path before/after previews and chose to keep the subtle photo-matched treatment.

## Reproduce

Run `git status --short`, `git remote -v`, and `git log -1 --oneline` before editing. Inside `skinner-ridge`, run `npm.cmd ci` then `npm.cmd start`. Open [the slab](http://127.0.0.1:8080/) or [the lower apron](http://127.0.0.1:8080/?view=lower-path). WASD moves, mouse looks, R resets to the slab, Esc releases the mouse.

## Keep aligned

- `terrain.glb`, `ground.bin`, `terrain.json`, `terrain-coverage.png`, and `route.json` are one build.
- Grid: 1,133 × 991 at 0.035 m; crop: 39.62 × 34.65 m. Site origin: `[72.45, 8.32, -14]` north/east/down. Export axes: west/up/north.
- 2,241,360 triangles; 54.15% stereo-supported; 26 of 30 inputs contribute. Do not describe synthesis as measured.
- `terrain-synthesis.mjs` quilts photo patches and detrended height residuals together, fading relief to zero at measured triangle vertices. The bake modifies inferred heights, so it must run before vertex and collision buffers are exported.
- Camera weights are continuous vertex fields in `atlas.mjs`. Per-triangle winners caused grid seams and were replaced.
- `polish-atlas.mjs` bakes contact shading. The material stays unlit because imagery already contains lighting.
- NASA's annotated Mastcam-Z mosaic informed appearance only. Archived Navcam textures and meshes provide the actual donors.

## Verify

Run `npm.cmd run download`, `npm.cmd run build`, `npm.cmd run verify`, then `npm.cmd run capture`. See `verification.json` for export consistency and `screenshots/verification.json` for actual browser distances and checks. Final Chrome checks passed the slab route, expansion, boundary collision, reset, inferred-ground route, and lower-extension walk without browser errors.

Inspect `screenshots/lower.png`, `screenshots/lower-path-start.png`, `screenshots/walked-lower.png`, `screenshots/walked-return.png`, and `screenshots/survey.png`. Tested with Node.js 25.6.1 and Chrome/SwiftShader on Windows. The restricted environment needed `CHROME_NO_SANDBOX=1`, an explicit opt-in. Captures are not GPU performance benchmarks.

## Limitations

Some steep or occluded close-ups remain soft; heightfields cannot model overhangs; inferred patches may repeat; distant scenery is decorative. No particular GPU frame-rate target was verified. Preserve these limitations and the inference mask in future work.
