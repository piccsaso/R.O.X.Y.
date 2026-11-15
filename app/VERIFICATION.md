# Astra 1 verification — 14 November 2026 (EST)

## Delivered

`CONTRACT.md` and both JSON Schemas merged to main in PR #2 at **18:56:30 EST**,
before the 20:00 deadline. Main merge commit:
`8c8f27c4b88a2a4d6fa366ddc0a1b8d47a4d43cd`.

Implementation includes scene-core, generic grid builder, generated test scene
and smoother prior, pure walker, fixed six-region HUD and navigation assumptions.
No Astra 2 planner or overlay UI is included.

## VERIFIED: install, tests and build

Environment: Linux, Node v24.22.1, npm 11.9.0. `npm install` succeeded using a
workspace npm cache (the runner's home cache directory is read-only). Launch with
`npm run dev` succeeded at port 5173. Production preview ran at port 4173.

Actual final Vitest output after regenerating the fixture:

```text
 ✓ tests/core.test.ts (24 tests) 1338ms
 Test Files  1 passed (1)
      Tests  24 passed (24)
   Duration  2.34s
```

`npm run build` passed TypeScript checking and Vite compilation (148 modules;
719.02 kB JS before gzip, 192.22 kB gzip). Vite reports a bundle-size advisory;
there is no build error. Dependencies are bundled locally, with no runtime CDN.

The suite loads and validates the complete package, rejects a deliberately broken
copy (`units: "feet"`), rejects inconsistent grids/metadata, checks map round trips
and fuzzy ambiguity, verifies both walkable corridors and all blocking rules,
and rebuilds the truth/prior grids unchanged in another temporary directory.
The standalone validator also checks referenced assets and collision node names.

## VERIFIED: rendered browser walk

`npm run test:browser` drives actual pointer lock, mouse events and W keys in
headless Chromium. It sets isolated starting positions through an explicit
`?test=1` hook available only when `is_test_data` is true. Movement still uses the
same input handler and pure controller as normal play. This is automated browser
walking, not a claim of a human manual walk. Final run uses the production build.

| Check | Observed result |
|---|---|
| Boulder, approached east from (−8,0) | Stopped with `obstacle` before the collider |
| Hole, approached east from (−16,9) | Stopped with `hole` before UNKNOWN cells |
| Ledge ascent from (18,5) | Stopped before the 1.5 m step |
| Ledge descent from (18,9) | Stopped before the drop |
| Steep band from (6,−12) | Stopped with `slope` before the band |
| Boundary from (28,0) | Stopped with `boundary`, retaining body clearance |
| Hold W after each stop | Remained blocked; motion bounded by one sweep sample |
| R, mouse motion, Escape | Reset, changed heading, released pointer lock |
| Network disabled after loading | Walking continued without errors |
| HUD / watermark | Six reserved regions and visible TEST DATA |

Ledges normally trigger the slope guard first. A separate unit test raises the
slope limit to 90° and verifies that both ascent and descent stop on `max_step_m`.

Evidence: `verification/browser-results.json` and screenshots in `verification/`.
The entry and all six blocker screenshots were visually inspected, alongside
the browser state assertions.

## UNKNOWN / handoff

- Native Windows launch has not been executed in this Linux environment. A teammate
  should run `cd app`, `npm install`, `npm test`, `npm run dev` on Windows.
- Real Sol scene integration waits on the real scene package. Use the frozen
  contract and `npm run grid -- ../scenes/<id>` then `npm run validate -- ../scenes/<id>`.
- Software licence/source handoff for Sol: `app/THIRD_PARTY.md`.
- Full offline reload is not implemented; offline operation is verified after
  the current scene has loaded, as requested.
