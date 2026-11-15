# Skinner Ridge handoff: expanded terrain and Mars sky

## Current work

Work is on `expand-mars-sky-cycle`, based on local commit `73e3846`. Check Git and remote state before assuming publication. Read [README.md](README.md), [SKY.md](SKY.md), and [PROJECT_HISTORY.md](PROJECT_HISTORY.md). Keep repo-root planning documents intact.

The latest user request was to double the rendered map area again, allow walking anywhere including steep rocks, speed up walking, and improve the atmosphere, Sun, and NASA-based night sky. Clarifications: automatic eight-minute day/night cycle; grounded climbing, not flight; a documented Skinner Ridge observation date; naturally dark ground with an optional exploration light. Preserve the previously selected subtle photo-matched terrain style.

## Current assets

- Core: 56 × 49.07 m / 2,747.92 m², 1,601 × 1,403 vertices, 4,486,400 triangles. Grid spacing remains 3.5 cm.
- Four GLBs: `terrain-0.glb` through `terrain-3.glb`. They already use world coordinates. Do not translate them separately or substitute the superseded single GLB.
- `ground.bin`, `terrain.json`, `terrain-coverage.png`, and `route.json` match those tiles. Geometry and textures retain measured/inferred provenance.
- `apron.mjs` provides both rendered context geometry and exact triangle collision outside the core. Its finite bounds are X [-110,166], Z [-110,159.07]. It is inferred scenery, not observed topography.
- `ground.foot` deliberately permits all core slopes. The viewer removes the former step-rise restriction. Walking is 2.6 m/s; Shift sprint is 5 m/s. Never reintroduce blocked rock regions accidentally.
- `terrain-normals.mjs` generates shared normals from the complete heightfield, keeping tile borders consistent.

## Sky

`build-sky.py` produces `sky-data.json` using NASA/JPL SPICE, the site 26/1004 waypoint, and the sol-477 Navcam timestamp 2022-06-23T22:55:32.782Z. It uses DE440s, PCK00011, and NAIF0012. `build-star-texture.mjs` converts NASA SVS Deep Star Maps 2020 from EXR to the bundled PNG. Both downloads and hashes are traceable; Python dependencies are build-only.

`sky.mjs` transforms the NASA celestial map into the local west/up/north frame and interpolates solar directions. It converts the map to a cubemap to avoid polar filtering artifacts. `lighting.mjs` supplies terrain day/night illumination and the F-key exploration light. The eight-minute cycle uses elapsed wall time; movement uses bounded substeps to handle slow rendering. Esc reveals pause/time controls.

See SKY.md for the scientific limitations: this is an observation-anchored single-sol replay with approximate atmospheric scattering and display exposure. Terrain photo shadows remain baked. It is not a calibrated radiative-transfer simulation, and no planets/moons are rendered.

## Run and check

Inside `skinner-ridge`: `npm.cmd ci`, `npm.cmd start`. Open the local viewer at port 8080. Build with `npm.cmd run build`; check exports using `npm.cmd run verify`. Run `npm.cmd run capture` for walking and `node capture-sky.mjs` for sky, lamp, cycle timing, and speeds.

The test environment uses Chrome/SwiftShader, Node.js 25.6.1, and Windows. Its restricted sandbox needs the explicit environment setting `CHROME_NO_SANDBOX=1`. Loopback network access must also be granted to browser automation. `QA_FAST=1` reduces the capture viewport, not the assets. Exact outcomes are recorded in `verification.json` and `screenshots/*verification.json`.

Before release, inspect day, sunset, night, exploration-light, lower-path, and slab screenshots. Retain the source masks and limitations. Do not describe the surrounding estimated terrain as measured, the visual atmosphere as physically exact, or software-rendered checks as a hardware performance benchmark.
