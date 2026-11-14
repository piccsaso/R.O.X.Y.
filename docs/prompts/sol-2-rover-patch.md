# Sol 2: the rover-derived walkable patch

> **Superseded.** A teammate delivered this as `skinner-ridge/`. Do not send this prompt. It is kept for reference.

Time box: 5 hours, with a checkpoint at 3 hours, and a hard stop at 06:00 Sunday EST whichever comes first. This is a stretch goal: start only after Sol 1 and Sol 3 are merged. The step times below are the upper limits; scale them down to fit, and prefer a small patch that is finished over a large one that is not.

## Goal

Deliver `scenes/jezero_rover/`: a continuous, textured, metrically scaled patch of real ground from Perseverance data at the site chosen in Sol 1, tens of metres across, with a recognisable landmark that looks solid when the player walks past it and turns around. This is master step 1, Phase 2. Read it in full; the points below are what matters most and where this project differs.

## Order of preference for geometry

1. **NASA-provided geometry.** Archived Navcam terrain meshes from PDS, or tiles produced by NASA-AMMOS Landform (the drive 1004 sample data shows the format). Use it as ground truth and fuse patches yourself.
2. **Your own stereo** from matched, calibrated left and right products with archived camera models. Confirm pairing from the labels, never from a shared sol.
3. Orbital DTM only as surrounding context, tagged as orbital.

Start with option 1. Move to option 2 only if option 1 has no coverage of the landmark, and say so.

## Steps

1. **Pilot (2 h).** Download one or two rover positions that see the landmark. Verify the files open, the frames and transforms match the labels, and the geometry from both positions lines up in one site frame. Mars 2020 surface frames are Z-down; write down the conversion to the roadmap's axis convention. Do not download more until the pilot aligns.
2. **Fuse and clean (2 h).** Combine patches. Remove floating fragments and long bridging triangles using an explicit edge-length threshold that you report. Fill only small gaps and list each one. Where there is a large gap, shrink or reroute the playable area.
3. **Texture (1.5 h).** Project the sharpest rover imagery with occlusion handling. Keep textures at most 4096 px per side, as an atlas if needed. Measure texel density at 2, 5 and 10 m from eye height.
4. **Register to the orbital scene (1 h).** Align the patch to the HiRISE orthoimage used in Sol 1 so the two scenes share coordinates. Report the estimated error in metres and how you measured it.
5. **Export (1 h).** In `scenes/jezero_rover/`:
   - `terrain.glb` and `collision.glb`, with collision ground nodes named by provenance (`ground_ROVER_MEASURED`, `ground_ROVER_STEREO`, `ground_ORBITAL`, `ground_INTERPOLATED`) and the landmark as `obstacle_<name>` if it should block walking;
   - `prior_collision.glb`: the Sol 1 orbital surface cropped to the same footprint. The app uses it as "what was known before the walk";
   - `scene.json` with spawn facing the landmark, `playable_bounds` drawn around verified ground only, and `map_transform`;
   - every product used added to `data/manifest.csv`.
6. **Inspect (30 min).** Load the export, print bounds, counts and texture sizes, and render standing-height views from both ends of the intended walk. Save them to `docs/img/`.

## Checkpoint at 3 hours

If there is no continuous aligned mesh around the landmark by then, freeze the best verified sub-area, shrink the route to fit it, and spend the remaining time on quality. If there is nothing usable at all, stop, report what blocked you, and tell the lead to ship the orbital scene. Do not continue past the time box.

## Done when

- A render from spawn and a render looking back both show the landmark as a solid object with no holes or stretched faces in view (VERIFIED with the saved images).
- Patch size, triangle count, texel density, edge threshold and registration error are reported, each with the command that produced it.
- The scene rebuilds from scripts.

## Do not

- Fill large gaps with invented geometry or present orbital terrain as rover detail.
- Claim "reconstructed" or "aligned" for anything you have not loaded and looked at.
