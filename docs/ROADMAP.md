# Roadmap: Marswalk HUD

NASA Space Apps 2026, "Interplanetary Survival Guide: Martian Map".

**One line:** a voice-driven helmet HUD, rehearsed in first person on real reconstructed Mars terrain, that plans a safe route to a science target, scans for obstacles as the astronaut walks, and re-routes when the ground disagrees with the orbital map.

This roadmap merges three inputs: the team's HUD idea, `docs/prompts/master-step1.txt` (terrain reconstruction) and `docs/prompts/master-step2.txt` (layers, planner, voice). Where they conflict, the master prompts' evidence and honesty rules win.

## 1. Who does what

| Owner | Role | Owns these paths (nobody else edits them) |
|---|---|---|
| **6.1 Sol** | Data and terrain (Python) | `scripts/`, `data/` (manifest only is committed), `scenes/jezero_orbital/`, `scenes/jezero_rover/`, `docs/CHALLENGE.md`, `docs/SITE_SELECTION.md`, `docs/SOURCES.md` |
| **GPT Astra** | App, contract, planner, HUD (TypeScript) | `app/`, `schema/`, `scenes/test_scene/`, `config/`, `tools/`, `CONTRACT.md` |
| **Lead (Claude)** | Integration, review, validation, submission | `README.md`, `docs/ROADMAP.md`, `docs/VALIDATION.md`, `docs/prompts/` |
| Shared | Decision log | `DECISIONS.md`: append only, prefix each entry with the owner's name |

The split is by skill type, not by model strength. If one model proves better at the other's work, swap the prompts; the path ownership still prevents merge conflicts.

Each model works on its own branch (`sol/<task>`, `astra/<task>`) and merges to `main` at the end of each prompt. Neither waits on the other: Astra builds everything against `test_scene`, Sol delivers real scenes in the same format.

## 2. Work packages

Send the prompts in order within each column. The two columns run in parallel.

| Order | 6.1 Sol | GPT Astra |
|---|---|---|
| 1 | `sol-1-orbital-scene.md`: challenge notes, site choice, Tier 0 orbital scene (the guaranteed submission) | `astra-1-contract-walker.md`: scene contract, scene-core, test scene, first-person walk, HUD shell |
| 2 | `sol-2-rover-patch.md`: rover-derived textured patch (the risky part, strictly time-boxed) | `astra-2-layers-planner.md`: layers, hazard-aware route planner, map, acceptance tests |
| 3 | `sol-3-science-layers.md`: landmarks, rover traverse, second-mission layer, radiation scenario inputs | `astra-3-hud-scanner-voice.md`: obstacle scanner, live remap and re-route, voice |
| 4 | Lead: integration of the real scene, spatial agreement checks, walk test, README, video and project page | |

Paste `00-shared-rules.md` in front of every prompt. Both models also need the two master prompt files (they are in `docs/prompts/`).

## 3. Schedule

The exact submission close time for your local event is **not confirmed**. Until it is, the plan is expressed in hours before the deadline (T).

| Point | What must be true |
|---|---|
| Start + 2 h | Astra: contract frozen and `test_scene` walkable. Sol: site chosen, orbital data downloading. |
| Start + 6 h | Sol-1 merged: orbital scene loads in Astra's app. This alone is a valid submission. |
| T − 10 h | Real rover scene integrated, or the decision is made to ship the orbital scene. No more waiting on reconstruction after this. |
| T − 6 h | Feature cut. Anything not merged and working is dropped. |
| T − 4 h | Code freeze. Only README, video, slides and project page from here. |

Cut order if time runs short: voice, radiation scenario, geologic units, rover patch (fall back to orbital scene). The route planner, obstacle scanner and HUD are never cut.

## 4. Interface pins (v0)

These are fixed now so that Sol can produce scenes before Astra finishes the schema. Astra formalises them in `schema/` and `CONTRACT.md` and may add fields but not change these.

- Units are metres. Axes: +X east, +Y up, −Z north, right-handed (glTF). Scene origin is a documented point in the rover SITE frame or a documented lat/lon.
- A scene is a directory `scenes/<scene_id>/` with `scene.json`, `terrain.glb`, `collision.glb`, `landmarks.json`, `overlays/`, `routes/`, as listed in master step 2, section C0.1.
- `collision.glb` node names carry meaning: ground nodes are named `ground_<PROVENANCE>` (`ROVER_MEASURED`, `ROVER_STEREO`, `ORBITAL`, `INTERPOLATED`); solid obstacles are named `obstacle_<name>`.
- Optional `prior_collision.glb`: the ground as known before the walk (orbital resolution). It feeds the remap feature in section 5. For the rover scene it is the orbital terrain cropped to the same footprint.
- Raster overlays are PNG files with an entry in `scene.json` giving bounds in local metres, units, value range and data class. Vector overlays and routes are GeoJSON with coordinates in local metres `[x, z]`.
- `ground_grid` is built by Astra's tool from `collision.glb`. Sol does not produce it.

## 5. Changes to the original idea

### Assumed in the prompts (needed to make the idea buildable; say no and the prompts get rewritten)

1. **"AR" becomes a simulated visor HUD.** There is no headset, so the HUD is drawn over a first-person view of reconstructed real terrain in the browser. It is presented as a rehearsal of what the astronaut would see, not as working AR hardware.
2. **"LIDAR" becomes a simulated suit scanner.** It casts rays against the scene's measured collision surface around the player and draws the hits as a radar display and a point sweep. It is labelled as a simulated sensor reading real measured geometry.
3. **"Constant remapping" becomes prior versus ground truth.** The route is first planned on the orbital-resolution map. As the scanner reveals ground, the local map is updated from the rover-scale surface. When a rock or drop that the orbital map missed blocks the route, the HUD says so and re-routes. This turns the remap into a visible event and uses two missions' data for a real reason.
4. **Voice is built last** and goes through the same command parser as typing, so the demo never depends on a microphone.
5. **The orbital scene ships first** as insurance. The rover-photoreal patch is an upgrade with a hard cut-off.

### Proposed, not in the prompts (waiting for approval)

| # | Proposal | Why | Cost |
|---|---|---|---|
| A | Safe-return indicator: a HUD gauge showing whether there is enough time and consumables to finish the route and walk back, from editable assumptions | Directly answers the challenge's safety priority and your "insurance" goal | About 1 h, Astra |
| B | Spoken HUD callouts (browser speech synthesis, works offline): "Obstacle ahead, re-routing left" | Hands-free in both directions; strong in a 30-second video | About 30 min, Astra |
| C | Mission-control mirror: a second browser tab showing the same map, position and alerts | Demonstrates the "less stress on the support scientists" claim instead of only stating it | About 1.5 h, Astra |
| D | Arrival photo: on reaching a landmark, show the real Perseverance image of it beside the 3D view | The challenge page suggests point-of-view images; cheap proof of ground truth | About 45 min, Sol data and Astra card |
| E | Thermal layer (THEMIS, Mars Odyssey) as the third data kind, map only | Gets to the "at least three kinds of data" the challenge suggests: optical, topographic, thermal | About 1 h, Sol (folded into Sol-3 if approved) |

Recommendation: approve A, B and D. C only if Astra finishes prompt 3 before T − 8 h. E only if the THEMIS product is quick to register.

## 6. Open questions for the team

1. What is the exact submission close time for your local event? Every deadline above depends on it.
2. Does your event enforce the 30-second video or 7-slide limit stated in master step 1? The challenge text you pasted does not mention it.
3. Which proposals in section 5 do you approve?
