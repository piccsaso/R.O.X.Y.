# Astra 1 viewer

Requires Node.js 22.12+ and npm. Windows PowerShell or Command Prompt:

```text
cd app
npm install
npm test
npm run dev
```

Open `http://localhost:5173/?scene=test_scene`. Click **Enter visor**, then use
WASD and mouse look. R resets; Esc releases the mouse. Navigation settings and
credits are available at bottom left. `?scene=<scene_id>` loads any package in
`scenes/` without changing application code. Startup errors are displayed on the
entry card. Pointer lock requires localhost or HTTPS.

```text
npm run generate:test-scene
npm run grid -- ../scenes/test_scene
npm run validate -- ../scenes/test_scene
npm run build
```

The generated fixture and grids are committed, so regeneration is optional.
`npm run build` emits a static `dist/` including scene packages. Serve that folder
with an HTTP server. All code and current scene assets load locally; walking
continues offline once loaded. No CDN or remote fonts. Reloading while offline is
not guaranteed: this is an in-memory offline requirement, not a service-worker app.

Browser verification: with a local dev server running, set `CHROMIUM_PATH` to a
Chromium/Chrome executable and run `npm run test:browser`. On this Linux runner
it defaults to `/usr/bin/chromium`; Windows must supply the executable path.
`APP_URL` optionally selects a different server origin. The browser runner writes
screenshots and JSON evidence into `verification/`.

## Module boundaries

- `src/scene-core/`: schema validation, package loading, sampling, provenance,
  local↔map transforms, normalised fuzzy catalog search. No rendering imports.
- `src/walker/controller.ts`: pure movement functions. `moveWalker` takes a
  world-space displacement; `tickWalker` converts directional input and time.
  Future planner segment tests should call this same controller.
- `src/build/`: Node-only generator, GLB grid builder, package validator; thin
  CLI entry points live in `tools/`.
- `src/main.ts`: Three.js rendering, input events, and the six fixed HUD slots.

HUD IDs are `hud-heading-tape`, `hud-route-guidance`, `hud-hazard-radar`,
`hud-status-gauges`, `hud-alerts`, and `hud-recognised-voice-text`. Each has a
matching `data-region`. Their containers are reserved and contain only labels.
Astra 3 can populate them without changing layout. Movement feedback is outside
the reserved slots. `TEST DATA` is controlled by the manifest flag.

## Limitations

The grid supports a single ground height per horizontal cell, not stacked floors
or traversable overhangs. Conservative obstacle rasterisation and body clearance
may reject a marginal narrow gap; it never makes visual geometry authoritative.
At abrupt cliffs the slope guard can stop the player before the step guard does.
The synthetic scene is a navigation fixture, not Mars reconstruction. Overlay and
route files are provided for Astra 2; their UI and planning are outside Astra 1.
Native Windows execution still needs a teammate's check; the commands and scripts
use Node APIs without shell-specific build steps or WSL requirements.
