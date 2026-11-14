# Astra 2: planning map with NASA data highlights, and the route planner

Time box: 5 hours (merged by 04:00 Sunday EST). The step times are upper limits. Start only when Astra 1's "done" list is met.

## Goal

Two things that share one screen:

1. A **planning view** that looks and behaves like NASA's Curiosity route map of Mount Sharp: an oblique, three-dimensional view of real terrain with the rover's route drawn on it, where pressing a button washes the landscape in translucent colour to highlight what a NASA dataset says about the ground, with labels.
2. A **route planner**: type "take me to" a landmark, get a walkable route around real hazards with a one-line reason, see it in the planning view and as breadcrumbs on the ground, then drop to first person and walk it.

The specification for the planner is master step 2, sections C1.2, C1.5 and all of C2. Read them in full. This prompt sets the look, the priorities and what is specific to this project.

## The reference look

Two reference images are in `docs/img/reference/` (`mount-sharp-route-plain.jpg` and `mount-sharp-route-highlighted.jpg`): the plain view and the highlighted view of NASA/JPL-Caltech's "Curiosity's Proposed Path up Mount Sharp". They show Gale crater. Our site is Jezero, so match the style and behaviour, not the content. What to reproduce:

- **Plain state:** a low oblique camera looking across the terrain toward a hazy horizon; true-colour orbital imagery draped on real elevation; strong relief shading; a thin, crisp white line for the rover's traverse following the ground.
- **Highlighted state:** each region is filled with a saturated translucent colour with soft, feathered edges. The relief and shadows of the terrain stay clearly visible through the colour, as if the rock itself were tinted. Ground outside the highlighted regions is dimmed and slightly desaturated so the colours stand out. White italic labels sit on or beside each region, with thin leader lines where the feature is small. The white route line stays on top.
- **Transition:** the colour fades in and out over roughly half a second when the button is pressed. Nothing pops.

## Part 1: planning view (1.5 h)

- Render Sol's orbital terrain (`scenes/jezero_orbital/`) from an oblique orbiting camera with drag to rotate, scroll to zoom, and a reset. Use the same atmosphere and colour pipeline as the walking view so the two feel like one world. If vertical exaggeration is used, show its factor on screen.
- Draw the Perseverance traverse as the thin white line (from `routes/`). Draw the planned walking route in a clearly different style (colour and dash) so the two cannot be confused. Mark the Skinner Ridge patch footprint and the player's position.
- Landmarks as small markers with labels.
- Selecting a landmark or pressing "Walk" flies the camera down from the oblique view to eye level at the spawn or the route start. Pressing M returns to the planning view. This dive is the opening shot of the demo video, so make it smooth.
- A small top-down minimap in the walking view uses the same layers and route.

## Part 2: data highlight buttons (1.5 h)

A row of buttons, one per dataset. Pressing one fades its highlight in over the terrain in the planning view, the minimap, and on the ground in the walking view; pressing it again fades it out. One highlight is active at a time by default, with an option to combine.

| Button | What it highlights | Data class | Source |
|---|---|---|---|
| Geology | Mapped geologic units | ORBITAL-CONTEXT | USGS SIM 3464, from Sol |
| Minerals | Mineral detections, if Sol delivers them | ORBITAL-CONTEXT | CRISM (Mars Reconnaissance Orbiter), from Sol |
| Thermal | Surface thermal behaviour | ORBITAL-CONTEXT | THEMIS (Mars Odyssey), from Sol |
| Slope hazard | Ground steeper than the walking limit, and drop-offs | TERRAIN-DERIVED | Computed from the ground data |
| Ground truth | Where the surface is rover-measured, inferred, or orbital only | OBSERVATION | Scene provenance |
| Radiation | Scenario exposure field | SIMULATION | Part 4 |

Rules:
- Buttons are built from the scene's `overlays[]` entries in `scene.json`, so a dataset appears when Sol delivers it and its button is absent when the data is not there. Never show a button backed by placeholder data on the real scene.
- Categorical layers arrive as a class raster plus a legend table (class, name, colour) and optional label anchor points. Continuous layers arrive as a value raster with units and range. Region names and labels come only from the data and from verified landmarks. Do not invent feature names.
- Implement the highlight inside the terrain material (overlay texture sampled in the shader, per-layer opacity animated), not as separate floating meshes, so it follows the relief exactly and the shading shows through. Feather class boundaries in proportion to the dataset's true resolution: a coarse product must look coarse-edged, not falsely sharp.
- A legend appears with the active highlight: colour keys, units, data-class badge, native resolution, and a "source" disclosure with credit and link. A geologic map made at 1:75,000 says so.
- Simulated layers say "Simulated scenario" in the legend. Test data says "TEST DATA".
- Precompute textures. Toggling a highlight must not drop the frame rate.

## Part 3: route planner (1.5 h)

- Routing grid from Astra 1's grid builder, covering the rover patch and the surrounding orbital terrain, with provenance per cell. Slope, obstacles and coverage all come from this grid.
- A* on the 8-connected grid, no diagonal corner cutting, blocked cells and costs as in section C2.3, smoothing only where every new segment passes the validator. One final polyline, draped on the ground, drives the planning-view line, the minimap, the breadcrumbs and the summary. The planner takes the grid as an argument, because Astra 3 runs it on a grid that changes as the player scans.
- Typed destination search through scene-core, with pick list, status messages and viewing-point routing (section C2.2).
- Summary: distance, estimated time (labelled assumption), elevation gain and loss, maximum slope, and how much of the route is on rover-measured, inferred and orbital ground. A one-line detour reason generated from the actual dominant blocker. Clear failure states.
- On arrival, a science card for the landmark, with the real Perseverance photo beside the view when the landmark has a `photo` entry (credit and source link shown).

## Part 4: radiation scenario (30 min, cut first)

A dose-rate field from a baseline scaled by visible-sky fraction, exclusion zones as hard blocks, and a "Lower exposure" route option (sections C1.4 and C2.5). Baseline and wording come from the scene's `overlays/radiation_scenario.json`. Every related number says "Simulated scenario".

## Acceptance tests (automated, on test_scene)

All of section C2.7: detour around the boulder; hole, ledge and blocked corridor each cause a detour or a no-route result with a reason; every segment passes the validator; a scripted walker using the real controller follows the whole route without falling, clipping or leaving bounds; ambiguous alias gives a pick list; an outside-patch landmark gives a status message; diagonal corner cutting is rejected. If Part 4 is built: the exposure option picks the longer corridor and explains the trade, and identical options give a single result.

## Done when

- `npm test` passes; the output is in your report.
- On the real scene in a browser: the planning view opens on an oblique shot with the white traverse line; each available button fades its highlight in and out with a correct legend; typing a destination draws a route with its reason; "Walk" dives to first person; the breadcrumbs lead to the landmark and the science card opens.
- Screenshots in `docs/img/`: the plain planning view and one highlighted view framed like the two references, placed side by side with them in your report, plus the walking view with a highlight on.
- Anything in Sol's data that did not fit the contract is listed.

## Constraints

- All thresholds, weights and speeds live in `config/navigation.json` with a rationale each, visible in a "route settings" disclosure.
- Walking time is a slope-dependent assumption scaled to a configurable suited walking speed, not a validated spacewalk model, and the interface says so.
- If Sol's orbital scene or overlays are late, build Parts 1 and 2 against `test_scene` with labelled test layers, and wire the real data in when it lands. Do not wait.
- If the time box runs out, cut Part 4, then the walking-view draping of highlights. The planning view, the highlight buttons and the shortest-route planner are not cut.
