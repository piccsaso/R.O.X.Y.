# Skinner Ridge handoff

## Start here

The demo is implemented, tested, and published. The last terrain publication is [65fcb33](https://github.com/piccsaso/nasa-hackathon/commit/65fcb3394a21cc7441afc92de245242d567bd43c). Use [the current main branch](https://github.com/piccsaso/nasa-hackathon/tree/main/skinner-ridge) for the latest documents and subsequent work.

1. Read this file, then [PROJECT_HISTORY.md](PROJECT_HISTORY.md) for the exact original brief, follow-up prompts, source links, file map, decisions, and test history. Read [README.md](README.md) for the runnable project and [SITE_SELECTION.md](SITE_SELECTION.md) if working with new rover observations.
2. Check `git status --short`, `git remote -v`, and `git log -1 --oneline` from your checkout before editing. The published project lives under `skinner-ridge/`. An earlier Windows workspace contains an original project copy at the workspace root and a separate Git checkout under `.publish-checkout/`. Use the Git checkout's `skinner-ridge/` for changes that will be pushed. A fresh clone works as well. Keep the repo-root docs intact.
3. Reproduce the prior demo before changing it. Use Node.js 24 and desktop Chrome on Windows if available.

```powershell
git clone https://github.com/piccsaso/nasa-hackathon.git
cd nasa-hackathon/skinner-ridge
npm.cmd ci
npm.cmd start
```

4. Open [http://127.0.0.1:8080/](http://127.0.0.1:8080/), click **Enter terrain**, and use WASD and mouse look. Aim just right of the pale slab, pass it uphill, then turn around. R resets, and Esc releases the mouse.
5. Run `npm.cmd run capture` from the same folder for the repeatable Chrome baseline. It starts its own loopback server and writes screenshots. The automated test uses CDP and SwiftShader. Pass the executable path as an argument if Chrome is installed elsewhere.

## Baseline to preserve

- The export covers 28 × 24.5 m and the test estimates 613 m² connected to spawn. About 63% of the footprint has stereo support. Source identity, frames, and hashes are in [terrain.json](terrain.json).
- The GLB, collision buffer, metadata, and route are a matched set. The GLB has 1,120,000 triangles, 801 × 701 grid vertices, metre units and Y up. The camera is 1.65 m above the sampled surface. The route config is [route.json](route.json).
- The last Chrome pass verified a 17.71 m walk past the slab and into the expansion, plus a separate 7.10 m walk crossing inferred cells. Boundary collision, pointer lock, and reset passed.
- Compare [slab look-back](screenshots/walked-return.png), [expanded view](screenshots/walked-expanded.png), [inferred-ground test](screenshots/walked-infill.png), and [coverage map](terrain-coverage.png) before judging a change.
- The user prioritizes close-up visual fidelity. Keep the original slab approach and measured rock detail. Inferred patches, mixed-camera seams, and steep slopes are the places most likely to look soft. The dusty terrain outside the collision boundary is viewer context.

## Where to edit for the next request

| If asked to change… | Start here |
| --- | --- |
| Blurred or stretched photo texture | Inspect `atlas.mjs`, `texture-infill.mjs`, and `polish-atlas.mjs`. Compare the same before-and-after camera pose. Prefer a sharper archived projection or photo-derived detail over an expensive runtime detail shader. |
| Holes, sharp joins, or overly smooth terrain | Inspect source coverage first, then `reconstruct.mjs` and `infill.mjs`. Keep measured supports, provenance, and collision aligned. |
| More playable area | Start with exact products and pose metadata in `sources.json` and `terrain.json`. Check neighboring rover wedges for real overlap. Change crop dimensions/origin in `reconstruct.mjs`, then review origin-dependent slab, expansion and inference checks in `route-check.mjs`. Rebuild and measure connected walkability again. |
| Movement, visuals beyond the crop, or rendering speed | Start with `ground.mjs`, `viewer.mjs`, or `landscape.mjs`. Tiles in the viewer share GLB vertex data and are culled individually. |
| Browser test failure | Start with `capture.mjs` and `route.json`. Distinguish a real clearance problem from software rendering speed or headless pointer-lock setup. Verify the scene at eye height and check the reported distance and camera position. |
| Data or science provenance | Follow `SITE_SELECTION.md`, `sources.json`, `terrain.json`, and `terrain-coverage.png`. Keep measured anchors, inferred fill and decorative scenery identifiable. |

For geometry or texture changes, run:

```powershell
npm.cmd run download
npm.cmd run build
npm.cmd run capture
```

Archive downloads may require ordinary network access. The source cache can be large, and the bake can take a few minutes. A viewer-only change can usually reuse the existing assets and run the capture check directly. Keep local caches, installed dependencies, Chrome profiles, and internal planning files out of the published diff.

## Open work

No additional terrain change is pending from this chat. Begin with the next user request after reproducing the current baseline. If they ask for further realism, ask for or use the supplied screenshot to locate the offending view, compare it with the coverage map, and make the smallest source-backed change that improves that view. Some steep faces lack direct coverage. Preserve that limitation in the project notes rather than describing those faces as directly observed.
