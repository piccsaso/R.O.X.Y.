# Roadmap: Marswalk HUD

NASA Space Apps 2026, "Interplanetary Survival Guide: Martian Map". Submission closes Sunday 15 November, 12:00 noon EST. Demo limit: a 30-second video or 7 slides.

**One line:** a voice-driven helmet HUD, rehearsed in first person on real Perseverance terrain, that plans a safe route to a science target, scans for obstacles as the astronaut walks, and re-routes when the ground turns out to differ from the prior map.

## What changed on Saturday evening

The first plan split the app across two other models behind a shared scene contract. It produced schemas and a synthetic test scene, not features on the real terrain, and was reverted from `main`. The plan now is simpler:

- **Everything is built directly on `skinner-ridge/`**, the working first-person walk on a 28 × 24.5 m patch of Perseverance's Skinner Ridge workspace. No separate app, no contract, no test scene. Plain JavaScript modules, same as the existing demo.
- **The HUD, planner and scanner are built by the lead (Claude) in this repository** and verified in a browser, instead of being delegated.
- **One optional data prompt** remains for another model: `docs/prompts/data-pack.md`. The app works without it; the pack adds orbital context and verified science facts.
- The Astra and Sol prompts are deleted.

## What exists now (in `skinner-ridge/`)

| Feature | File |
|---|---|
| First-person walk on Navcam-derived terrain | `viewer.mjs`, `ground.mjs` (teammate) |
| Route planner on the walking surface: A*, no corner cutting, validated shortcuts, slope-based time, detour reason from the real blocker | `nav.mjs`, tested on the real ground data with `npm test` |
| Prior map versus surveyed ground, scanner with terrain occlusion, automatic re-route | `nav.mjs`, `hud.mjs` |
| Helmet HUD: heading tape, slope, ground provenance, route and ETA, safe-return gauge, alerts, radar, minimap | `hud.mjs` |
| Data highlight buttons that tint the terrain: hazards, slope, ground truth, surveyed | `hud.mjs` |
| Planning view: oblique camera, labels with leader lines, click to set a destination, dive back to first person | `hud.mjs` |
| Typed commands, push-to-talk voice, spoken alerts, all through one parser | `hud.mjs`, `nav.mjs` |

Verification status is in `skinner-ridge/README.md`.

## What is still missing, in priority order

1. **Data from a second NASA mission.** Everything shown today comes from Perseverance. The challenge asks for several missions. The data pack prompt covers this (HiRISE orbital image and elevation, THEMIS or geology), and the app then needs a loader for it. This session cannot reach NASA or USGS servers, so someone else has to fetch the files.
2. **Verified science facts for the stop.** The science card says only what the repository has verified. Sample and abrasion names for Skinner Ridge need a source check (data pack).
3. **Voice test** on a real machine: which commands are recognised, and whether Chrome recognises on the device or online.
4. **Demo video** (30 seconds): planning view with a highlight on, say "take me to the upper bench", dive to first person, scanner finds the rock step and re-routes, arrive, science card.
5. **README and project page text**, written against the judging criteria.

## Schedule (local time)

| When | What must be true |
|---|---|
| Sat 22:00 | HUD, planner and scanner merged to `main` and run on a teammate's Windows machine. |
| Sun 02:00 | Data pack delivered, or the decision is made to submit without orbital layers. |
| Sun 06:00 | Orbital context and science facts loaded in the app, if delivered. Voice tested. |
| Sun 08:00 | Code freeze. Only README, video and project page from here. |
| Sun 11:00 | Submit. The last hour is slack. |

## Honesty rules the app follows

- The scanner is a simulated sensor reading the measured surface. The HUD is a simulated visor. Both are labelled.
- The "prior map" is the rover surface averaged to 1 m, standing in for orbital-resolution knowledge. It is labelled simulated. If the data pack delivers the real HiRISE elevation, it replaces this.
- Inferred terrain (37% of the patch) is shown as inferred in the HUD and in the Ground truth highlight.
- Landmark names other than "Skinner Ridge" are team labels, and the interface says so.
- Walking speed, the EVA budget and the reserve are assumptions, labelled and editable.

## Reference

`docs/img/reference/` holds NASA's Curiosity Mount Sharp route map (plain and highlighted), the visual target for the planning view. `docs/prompts/master-step1.txt` and `master-step2.txt` are the original specifications, kept for their evidence rules.
