# Roadmap: Marswalk HUD

NASA Space Apps 2026, "Interplanetary Survival Guide: Martian Map".

**One line:** a voice-driven helmet HUD, rehearsed in first person on real reconstructed Mars terrain, that plans a safe route to a science target, scans for obstacles as the astronaut walks, and re-routes when the ground disagrees with the orbital map.

This roadmap merges three inputs: the team's HUD idea, `docs/prompts/master-step1.txt` (terrain reconstruction) and `docs/prompts/master-step2.txt` (layers, planner, voice). Where they conflict, the master prompts' evidence and honesty rules win.

## 0. Update, Saturday 18:45: the rover patch already exists

A teammate pushed `skinner-ridge/`: a working first-person walk on a 28 × 24.5 m patch of Perseverance's Skinner Ridge workspace (Hawksbill Gap, Jezero), built from NASA Navcam mesh products. This changes the plan:

- **The site is fixed:** Skinner Ridge, SITE_FRAME 26. Sol no longer chooses a site.
- **Sol 2 (rover reconstruction) is done** by the teammate. Sol's remaining work is the orbital terrain around the patch and the data layers.
- **Astra 1 builds on the existing viewer** instead of writing a walker from scratch, and spends the saved time on the expanded map and photoreal rendering.
- **Astra 2 adds a planning view** styled after NASA's Curiosity Mount Sharp route map (references in `docs/img/reference/`), with a button per dataset that highlights the terrain.
- **Axis convention changes** to the one the patch already uses: +X west, +Y up, +Z north. This replaces the first pin in section 4.
- `skinner-ridge/` belongs to the teammate who built it. Sol and Astra read it and do not edit it.

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
| 1 | `sol-1-orbital-scene.md` (4 h): challenge notes, orbital terrain around Skinner Ridge registered to the patch | `astra-1-contract-walker.md` (4 h): port the Skinner Ridge viewer, scene contract, expanded map, photoreal rendering |
| 2 | `sol-3-science-layers.md` (3 h): landmarks, arrival photos, rover traverse, geology, thermal and mineral highlight layers, radiation scenario inputs | `astra-2-layers-planner.md` (5 h): oblique planning view, data highlight buttons, route planner, acceptance tests |
| 3 | Done by a teammate (`skinner-ridge/`). `sol-2-rover-patch.md` is kept for reference only. | `astra-3-hud-scanner-voice.md` (3 h): HUD, safe-return gauge, obstacle scanner, live re-route, voice, mission-control mirror |
| 4 | Lead: integration of the real scene, spatial agreement checks, walk test, README, video and project page | |

Sol runs prompt 3 before prompt 2 on purpose. With about 14 working hours, the landmarks and multi-mission layers are worth more to the judges than photoreal ground, and they work on the orbital scene. The rover patch is attempted last and dropped without regret if it is not ready by 06:00.

Paste `00-shared-rules.md` in front of every prompt. Both models also need the two master prompt files (they are in `docs/prompts/`).

## 3. Schedule

Submission closes **Sunday 15 November 2026, 12:00 noon local time (EST)**. This schedule was written at 18:00 Saturday, leaving 18 hours: 14 for building and 4 protected for submission. The demo is limited to a 30-second video or 7 slides (confirmed by the team).

| Local time | What must be true |
|---|---|
| Sat 20:30 | Astra: `CONTRACT.md` on `main` and the Skinner Ridge patch walkable in `app/`. Sol: orbital data downloaded and cropped. |
| Sat 23:00 | Sol 1 and Astra 1 merged: the rover patch sits inside real orbital terrain with no seam. |
| Sun 02:00 | Sol 3 merged: landmarks and highlight layers present. |
| Sun 04:00 | Astra 2 merged: planning view, highlight buttons and typed routing work on the real scene. |
| Sun 06:00 | Integration point. Spatial agreement between patch, orbital terrain, layers and traverse is checked and reported. |
| Sun 07:00 | Feature cut. Anything not merged and working is dropped. |
| Sun 08:00 | Code freeze. Only README, video, slides and project page from here. |
| Sun 11:00 | Submit. The last hour is slack for upload problems. |

Cut order if time runs short: mission-control mirror, voice, radiation scenario, geologic units, rover patch (fall back to orbital scene). The route planner, obstacle scanner and HUD are never cut.

## 4. Interface pins (v0)

These are fixed now so that Sol can produce scenes before Astra finishes the schema. Astra formalises them in `schema/` and `CONTRACT.md` and may add fields but not change these.

- Units are metres. Axes: +X west, +Y up, +Z north, right-handed, as used by `skinner-ridge/`. The scene origin is the patch's crop corner: (77.49 m north, 2.51 m east, −14 m down) in SITE_FRAME 26. Every scene uses this frame.
- The ground may be a heightfield in the `skinner-ridge/ground.bin` layout or a `collision.glb`.
- A scene is a directory `scenes/<scene_id>/` with `scene.json`, `terrain.glb`, `collision.glb`, `landmarks.json`, `overlays/`, `routes/`, as listed in master step 2, section C0.1.
- `collision.glb` node names carry meaning: ground nodes are named `ground_<PROVENANCE>` (`ROVER_MEASURED`, `ROVER_STEREO`, `ORBITAL`, `INTERPOLATED`); solid obstacles are named `obstacle_<name>`.
- Optional `prior_collision.glb`: the ground as known before the walk (orbital resolution). It feeds the remap feature in section 5. For the rover scene it is the orbital terrain cropped to the same footprint.
- Raster overlays are PNG files with an entry in `scene.json` giving bounds in local metres, units, value range and data class. A categorical overlay is a class raster plus a legend table (class, name, colour) and optional label anchor points. Vector overlays and routes are GeoJSON with coordinates in local metres `[x, z]`.
- `ground_grid` is built by Astra's tool from `collision.glb`. Sol does not produce it.

## 5. Changes to the original idea

### Assumed in the prompts (needed to make the idea buildable; say no and the prompts get rewritten)

1. **"AR" becomes a simulated visor HUD.** There is no headset, so the HUD is drawn over a first-person view of reconstructed real terrain in the browser. It is presented as a rehearsal of what the astronaut would see, not as working AR hardware.
2. **"LIDAR" becomes a simulated suit scanner.** It casts rays against the scene's measured collision surface around the player and draws the hits as a radar display and a point sweep. It is labelled as a simulated sensor reading real measured geometry.
3. **"Constant remapping" becomes prior versus ground truth.** The route is first planned on the orbital-resolution map. As the scanner reveals ground, the local map is updated from the rover-scale surface. When a rock or drop that the orbital map missed blocks the route, the HUD says so and re-routes. This turns the remap into a visible event and uses two missions' data for a real reason.
4. **Voice is built last** and goes through the same command parser as typing, so the demo never depends on a microphone.
5. **The orbital scene ships first** as insurance. The rover-photoreal patch is an upgrade with a hard cut-off.

### Approved by the team on 14 November (now in the prompts)

| # | Proposal | Why | Cost |
|---|---|---|---|
| A | Safe-return indicator: a HUD gauge showing whether there is enough time and consumables to finish the route and walk back, from editable assumptions | Directly answers the challenge's safety priority and your "insurance" goal | About 1 h, Astra |
| B | Spoken HUD callouts (browser speech synthesis, works offline): "Obstacle ahead, re-routing left" | Hands-free in both directions; strong in a 30-second video | About 30 min, Astra |
| C | Mission-control mirror: a second browser tab showing the same map, position and alerts | Demonstrates the "less stress on the support scientists" claim instead of only stating it | About 1.5 h, Astra |
| D | Arrival photo: on reaching a landmark, show the real Perseverance image of it beside the 3D view | The challenge page suggests point-of-view images; cheap proof of ground truth | About 45 min, Sol data and Astra card |
| E | Thermal layer (THEMIS, Mars Odyssey) as the third data kind, map only | Gets to the "at least three kinds of data" the challenge suggests: optical, topographic, thermal | About 1 h, Sol |

All five are approved. Because the build window is 14 hours, C is built last and is the first thing cut; E is dropped if the THEMIS product takes more than 45 minutes to register.
