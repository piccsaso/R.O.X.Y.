# Ground grid builder

From `app/`, run `npm run grid -- ../scenes/<scene_id>` on Windows or Linux.
Reads the manifest layout and standard static triangle collision GLBs. Applies
node world transforms, casts vertical downward rays at cell centres, and retains
the highest ground hit. Triangle bounding boxes accelerate ray candidates;
obstacle projections conservatively mark every intersected cell. Ground misses
are UNKNOWN. Writes optional prior grid with identical dimensions and origin.
No scene-specific names, dimensions or geometry are embedded in the tool.
Implementation: `app/src/build/grid.ts` (Node-only; never bundled into viewer).
