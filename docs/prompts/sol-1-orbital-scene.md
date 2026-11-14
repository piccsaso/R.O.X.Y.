# Sol 1: challenge notes and the orbital terrain around Skinner Ridge

Time box: 4 hours (merged by 23:00 Saturday EST).

**The site is already chosen and the rover patch already exists.** A teammate pushed `skinner-ridge/`: a 28 × 24.5 m walkable patch of Perseverance's Skinner Ridge workspace at Hawksbill Gap, Jezero, in SITE_FRAME 26. Read its `README.md`, `SITE_SELECTION.md` and `terrain.json` first. Do not edit that directory. Skip step 3 below (site choice); copy the teammate's comparison into your notes by reference instead. Your orbital terrain is the wider world the patch sits in: the app shows it from above as the planning map and lets the player walk out onto it.

## Goal

Deliver `scenes/jezero_orbital/`: a walkable, textured scene of a patch of Jezero crater built from orbital data, in the scene format the app loads. The app engineer (Astra) is building the viewer against a synthetic test scene at the same time; your scene must drop in without code changes.

## Steps

1. **Challenge notes (30 min).** Write `docs/CHALLENGE.md` from the official challenge page (the team pasted its text; fetch the page to confirm and to read the Resources tab). Record objectives, considerations and the resource list. Try to find the submission deadline and the demo format limits, and mark each as VERIFIED or UNKNOWN.

2. **Environment inventory (15 min).** Record Python version, GDAL/rasterio availability, Blender or Open3D if present, GPU, and free disk.

3. **Site choice (45 min).** Follow master step 1, Phase 1, but in compressed form. You are choosing a site that satisfies both this prompt and Sol 2, so the test is:
   - HiRISE DTM and orthoimage coverage (USGS Jezero landing-site products);
   - a named Perseverance science target (abrasion patch, sample site or named rock) inside the patch, so there is a real science stop;
   - archived rover geometry nearby (PDS Navcam mesh archive, or the NASA-AMMOS 3DTilesSampleData drive 1004) so that Sol 2 has something to work with. Check the archive for the sols you are considering before ranking. Recent sols may have raw images only.
   Compare at least three candidates in a table in `docs/SITE_SELECTION.md`, choose one, and name the runner-up.

4. **Orbital terrain (2 h).** With repeatable scripts in `scripts/`:
   - Download the HiRISE DTM and orthoimage covering the site. Record each product in `data/manifest.csv` with the fields listed in master step 1, section 2.2.
   - Crop an area centred on the Skinner Ridge patch. Deliver two levels: a walkable crop about 400 m across at full resolution, and a wider context crop of 2 to 3 km at reduced resolution for the oblique planning view (it should take in the delta front and the rover's approach).
   - Use the local frame of the rover patch (roadmap section 4): +X west, +Y up, +Z north, origin at the patch's crop corner. Work out where that origin is in map coordinates from the SITE 26 location (rover waypoint data and the PDS labels), then check it: the patch's slab and outcrop edges should line up with the same features in the 25 cm orthoimage. Report the residual offset in metres and the height difference between the patch and the DTM at five points. This registration is the most important number you produce.
   - Also deliver the elevation as a heightfield in the same layout as `skinner-ridge/ground.bin`, so the app can use it for walking and routing. State the DTM post spacing and the orthoimage pixel size you actually found.
   - Build `terrain.glb` (textured with the orthoimage, texture at most 4096 px per side) and `collision.glb` (the same surface, ground node named `ground_ORBITAL`). Use the axis and unit conventions in roadmap section 4. Write down the exact conversion from map coordinates to local metres.
   - Write `scene.json` with every field in master step 2, section C0.1 that you can fill: origin, `map_transform` with status and estimated error, `playable_bounds`, `spawn` on verified ground, `credits`. Set `is_test_data` to false.
   - Add a wider context image for the map view (CTX or HiRISE mosaic crop) as an overlay in `overlays/`, with bounds in local metres.

5. **Inspect the export (30 min).** Load both GLB files with a script. Print bounds, vertex and face counts, and texture sizes. Render one view from 1.7 m above the spawn point and save it to `docs/img/`. Check that relief in the mesh matches the DTM values at three points.

## Done when

- `scenes/jezero_orbital/` loads in a generic glTF viewer with correct scale and orientation (VERIFIED with printed bounds and a render).
- `python scripts/<entry>.py` (or a documented command sequence) rebuilds the scene from nothing on Windows.
- `docs/CHALLENGE.md`, `docs/SITE_SELECTION.md`, `docs/SOURCES.md` and `data/manifest.csv` exist and agree with each other.

## Constraints

- Orbital data stands in for context terrain only. Never describe it as rover-scale detail. A HiRISE DTM is about 1 m per post; say so in `scene.json`.
- If a USGS or PDS URL has moved or a product is missing, say so and use the best verified alternative. Do not spend more than 30 minutes on any single broken download.
- Fallback at the time box: ship a smaller patch or a lower-resolution texture rather than an incomplete package.
