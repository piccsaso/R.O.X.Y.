# Skinner Ridge project history

## Goal

Build a first-person Mars walk from Perseverance observations for the NASA hackathon. The demo starts near a layered slab in the Skinner Ridge workspace, lets the player walk past it and turn back, and keeps the player grounded using the same surface as the rendered terrain.

## 1. Site selection

- Compared Skinner Ridge at Hawksbill Gap, the Jezero western-wall overlook, the Sol 1709 rim drive, and Wildcat Ridge. Checked PDS mesh products, their labels and coordinate frames, and overlap on the ground.
- Located the Sol 1709 products through PDS Atlas Release 15 after a legacy archive route failed. NASA’s published drive reconstruction used 53 Navcam stereo pairs. The nine verified public Navcam mesh acquisitions at the examined station shared one rover body pose.
- Selected Skinner Ridge because nearby rover stops provided stronger measured overlap across a short walking lane. Used the Drive 1004 sample as a format and processing reference, then built a separate mesh from individual archive products.

[Site comparison, archive links, and overlap evidence](SITE_SELECTION.md)

## 2. First walkable build

- Fused eight stereo-derived Navcam observations from two rover stops into a 7.0 × 6.3 m patch. Used the PDS Site 26 coordinate frame, filtered disconnected fragments and stretched triangles, and exported an embedded-texture GLB with matching collision data.
- Built a local Three.js viewer with mouse look, WASD, a 1.65 m eye height, and reset.
- Verified a 3.29 m walk and look-back in Chrome. The test stopped at the crop edge and a direct approach stopped short of the slab. Cutouts remained off the walking lane.

## 3. Filled gaps and expanded the terrain

- Expanded the footprint to 19.6 × 17.5 m using additional Navcam coverage. Filled missing heights using the surrounding measured surface and blended missing texture from rover photo swatches.
- Made the render mesh and collision grid continuous across the footprint. Softened sharp height transitions where stereo wedges disagreed.
- Verified a 12.83 m walk through the expansion and a separate 9.22 m walk crossing inferred sections. Boundary collision and reset passed.

## 4. Doubled the footprint and refined the visuals

- Expanded to 28 × 24.5 m (686 m²). Of 30 evaluated Navcam inputs, 23 contributed. About 63% of the final footprint had stereo support. The route checker estimates 613 m² of walkable ground connected to spawn.
- Rejected stretched photo projections, prioritized sharper views, and blended grid-aligned seams. Sampled detail from rover photos in areas with weak coverage. Added a dusty horizon as visual context beyond the walkable boundary.
- Split the browser render into tiles so it can skip terrain outside the camera view. Kept the GLB as a standalone textured asset.
- Verified a 17.71 m walk past the slab and into the expansion and a separate 7.10 m walk across inferred terrain. Pointer lock, boundary collision, and reset passed in Chrome.
- The heightfield approximates steep occluded faces, and inferred surfaces can still look softer than measured rock. The slab is a recognizable local feature whose individual NASA name remains unverified.

[Close-up](screenshots/walked-return.png) · [Expanded terrain](screenshots/walked-expanded.png) · [Inferred-ground crossing](screenshots/walked-infill.png) · [Coverage map](terrain-coverage.png)

## 5. Independent audit and publication

- An independent reviewer checked the publication checkout for privacy, factual support, attribution, and practical correctness. The review checked the terrain metrics against the export and examined public screenshots and assets.
- Clarified the footprint and walkable-area figures, documented inferred terrain and the tested Node.js version, added NASA/JPL-Caltech image-use guidance, and restricted the local server to demo routes. Excluded private briefs, local caches, and installed dependencies.
- Verified a clean dependency install and pushed the demo under `skinner-ridge/` on `main`, preserving the existing repository documentation. Verified the published commit on the remote. [Demo commit `65fcb33`](https://github.com/piccsaso/nasa-hackathon/commit/65fcb3394a21cc7441afc92de245242d567bd43c)

## Run or reproduce

[Launch and rebuild instructions](README.md) · [Download manifest](sources.json) · [Export metadata and source contributions](terrain.json)

Rover imagery and stereo geometry are credited to NASA/JPL-Caltech.
