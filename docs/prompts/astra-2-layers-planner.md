# Astra 2: data layers, map, and the hazard-aware route planner

Time box: 7 hours. Start only when Astra 1's "done" list is met.

## Goal

The player types "take me to" a landmark, the app plans a walkable route around real hazards, explains the detour in one line, draws it on a top-down map and as breadcrumbs on the ground, and shows a labelled summary. This is the core of the challenge answer. It is master step 2, sections C1.2, C1.5 and all of C2. Read them in full; they are the specification. The notes below set priorities and add what is specific to this project.

## Build order

1. **Terrain-derived layers from the ground grid** (2 h): slope over a walking-scale baseline of about 1 m, obstacles and drop-offs with the clearance buffer, and coverage by provenance. Draw them as translucent fills draped on the ground in 3D and on the map. They must line up exactly in both views because they share the grid.

2. **Top-down map and layer panel** (1.5 h): a canvas map in local metres with the basemap overlay, playable bounds, live player position and heading, landmarks, and selected layers. A layer panel with a toggle, legend, data-class badge, units, resolution and source for each layer. Layers supplied by the scene (`overlays/`, `routes/`) appear automatically from their `scene.json` entries, so Sol's real data shows up without code. Defaults: landmarks and navigation cues on, everything else off.

3. **Planner** (2.5 h): A* on the 8-connected ground grid with no diagonal corner cutting, blocked cells and costs exactly as in section C2.3, smoothing only where every new segment passes the validator, and a final polyline draped on the ground. That one polyline drives the map line, the breadcrumbs and the summary numbers. The planner takes the grid as an argument, because Astra 3 will run it on a grid that changes as the player scans.

4. **Destination search, summary and explanations** (1 h): typed search through scene-core with pick list, status messages and viewing-point routing as in section C2.2. Summary with distance, estimated time (labelled assumption), elevation gain and loss, maximum slope, and provenance mix. A one-line detour reason generated from the actual dominant blocker, never a generic sentence. Clear failure states with a reason.

5. **Radiation scenario and "Lower exposure" option** (only after 1 to 4 pass their tests): a dose-rate field computed from a baseline scaled by the visible-sky fraction at each cell, exclusion zones as hard blocks, and a second route option as in sections C1.4 and C2.5. Read the baseline and scenario wording from the scene's `overlays/radiation_scenario.json` when present, with labelled test values in `test_scene`. Every related number says "Simulated scenario".

## Acceptance tests (automated, on test_scene)

Implement all of section C2.7, including: detour around the boulder; the hole, ledge and blocked corridor each cause a detour or a no-route result with a reason; the exposure option picks the longer corridor and explains the trade; every segment passes the validator; a scripted walker using the real controller follows the whole route without falling, clipping or leaving bounds; ambiguous alias gives a pick list; an outside-patch landmark gives a status message; identical options give a single result; diagonal corner cutting is rejected.

## Done when

- `npm test` passes all of the above. Put the test output in your report, not a description of it.
- In a browser on `test_scene`: type a destination, see the route bend around the boulder with its reason, follow the breadcrumbs, arrive at the viewing point and see the landmark's science card.
- If Sol's `scenes/jezero_orbital/` is on `main`, run the grid builder on it and confirm it loads, routes and shows its layers with no code change. Report anything in the real scene that did not fit the contract.

## Constraints

- All thresholds, weights and speeds live in `config/navigation.json` with a rationale each, and the active values are visible in a "route settings" disclosure.
- Walking time uses a slope-dependent speed model scaled to a configurable suited walking speed. It is an assumption, not a validated spacewalk model, and the interface says so.
- Precompute rasters. Turning on a layer must not visibly drop the frame rate.
- If the time box runs out, the radiation scenario is the part to cut.
