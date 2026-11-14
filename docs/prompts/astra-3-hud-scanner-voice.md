# Astra 3: helmet HUD, obstacle scanner, live remap, voice

Time box: 3 hours, from 04:00 to the 07:00 Sunday EST feature cut. The part times below add up to more than that, so treat them as upper limits and expect to cut parts 4 and 5. Start only when typed routing from Astra 2 works and its tests pass. Build in the order below; each part must work before the next begins. Parts are cut from the end: the mirror first, then voice. The step times are upper limits.

## Goal

Turn the walker and planner into the team's core idea: a helmet HUD that guides the astronaut along the route, detects nearby obstacles with a scanner, updates the map as it learns the ground, re-routes when the plan is blocked, and can be driven by voice.

There is no headset or real sensor. The HUD is a simulated visor over the first-person view, and the scanner is a simulated sensor that reads the scene's measured collision surface. Both are labelled as such in the interface and README.

## Part 1: HUD (1.5 h)

Fill the regions laid out in Astra 1:
- heading tape with the bearing to the next waypoint;
- route guidance: distance to next waypoint and to destination, estimated time remaining, and a ground-following breadcrumb line that stays readable without hiding the terrain texture;
- status: slope under the feet, and the provenance of the ground the player stands on (rover-measured, rover stereo, orbital, interpolated), so the astronaut knows how well the ground is known;
- alerts: one line at a time, with a reason;
- safe-return gauge: from editable assumptions (suited walking speed, consumables duration, reserve margin), show whether the astronaut can finish the route and walk back to the start, and the latest turn-back point. Raise an alert when the margin is crossed. Label it ASSUMPTION; never present it as a validated mission number;
- every number carries its data class, shown as a small badge. Assumptions and simulated values are marked.

Keep it sparse. The HUD must be legible in a 30-second video at 1080p.

## Part 2: obstacle scanner (1.5 h)

- Cast a fan of rays from the player against the collision surface, a few times per second, out to a configurable range (start at 15 m). Budget the ray count so the frame rate does not drop; report the measured cost.
- Classify hits using the same rules as the walkability model in `config/navigation.json`: obstacle, drop-off, slope over the limit, unknown ground.
- Show them in the hazard radar region as a top-down sweep centred on the player, and optionally as a brief point sweep on the terrain.
- Proximity alert when a hazard lies within a configurable distance in the direction of travel, naming what it is ("Drop-off 3 m ahead").
- Label the display "Simulated scanner on measured terrain".
- Speak each new alert aloud with the browser's speech synthesis (works offline), with a mute control. Rate-limit it so alerts do not overlap.

## Part 3: live remap and re-route (1.5 h)

The idea: the route is first planned on what was known before the walk, and corrected as the scanner reveals the real ground.

- When a scene has a prior grid (built from `prior_collision.glb`), keep a working grid that starts as the prior. Cells the scanner has seen are overwritten with the true ground grid and marked as scanned. Without a prior grid, the feature is disabled and the HUD says the full survey is already loaded.
- Plan the initial route on the working grid. Each time newly scanned cells change walkability, re-validate the remaining route. If a segment now fails, raise an alert that names the cause ("Rock not in orbital map blocks the route. Re-routing."), re-plan from the player's position, and update the map, breadcrumbs and summary.
- Use hysteresis so the route does not flicker. Also re-plan when the player strays beyond a configurable distance from the route.
- The map shows scanned ground distinctly from prior-only ground.
- Add automated tests on `test_scene`: the initial route crosses where the boulder is (absent from the prior); after a scripted walker approaches, the route is replaced by one that passes the validator on the true grid, and the alert names an obstacle.

## Part 4: voice (1.5 h, cut second)

- One command router. Typed commands, clicks and speech all go through the same parser and the same scene-core lookup. Add a command box if one does not exist. Commands: "take me to [landmark]", "show slopes", "hide slopes", "show radiation scenario", "use the lower-exposure route", "clear route", "scan" (toggle scanner display).
- Tolerate filler words and near-miss landmark names by fuzzy matching against names and aliases. Ambiguous input gives the same pick list as typing.
- Push-to-talk button and key. Show the recognised text in the HUD before acting.
- Use the browser Web Speech API. Check whether the tested browser can recognise on the device. If only cloud recognition works, make it opt-in and say so in the interface. If the microphone is denied or the API is missing, disable the button with a short reason; typing always works.
- Report: browser and version tested, on-device or cloud, and a tally of successful recognitions for each command.

## Part 5: mission-control mirror (1 h, cut before voice if short)

A second page (`?view=control`) for the support team: the top-down map with the astronaut's live position, the active route, the alert log and the safe-return gauge. Sync it from the walker tab with a BroadcastChannel so it works offline with no server. Read-only.

## Done when

- All new tests pass, with output in the report.
- On `test_scene` in a browser, by typing only: request a landmark, start walking, see the scanner pick up the boulder, see the re-route alert with its cause, follow the new route, arrive, see the science card. Record this flow as a screen capture; it is raw footage for the demo video.
- The same flow starts and runs on Sol's real scene if it is on `main`. If the real scene has no prior grid or no hazard the prior missed, say so plainly.
- No console errors, a help overlay listing keys and commands, and credits one click away.

## Constraints

- The scanner, the planner and the walker read the same ground grid. No second source of geometry.
- Nothing in parts 1 to 3 depends on voice.
- Do not describe the scanner as LIDAR hardware or the HUD as working augmented reality anywhere in the interface or documentation.
