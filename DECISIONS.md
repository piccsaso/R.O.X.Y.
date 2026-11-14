# Decisions (append only)

## Astra — 2026-11-14 — contract 1.0.0 freeze
Formalise roadmap pins unchanged. Use explicit JSON objects and JSON grid arrays
rather than binary rasters: larger files but simple inspection, cross-platform
loading and unambiguous null misses. Permit extra metadata for additive evolution;
future contract changes need a version bump and an appended decision.

## Astra — 2026-11-14 — grid and walking
Choose 0.25 m cells rather than 0.5 m: the 60×40 m scene has 38,400 cells and
preserves narrow corridor/edge detail at modest memory cost. 0.125 m quadruples
cells without improving source geometry. Obstacles are conservative cell occupancy
in the same grid, avoiding a second collision source. Finite-radius swept walking
checks every crossed cell and edge. The 2.5D representation cannot support stacked
walkable floors; collision inputs explicitly exclude them.

## Astra — 2026-11-14 — stack and mapping
Use Vite/Three.js with a rendering-free TypeScript core rather than a physics
engine: deterministic scripted walking shares exactly the planner's input and
keeps dependencies small. Use an explicit local equirectangular map transform
rather than an implicit global projection; NONE never invents a registration.
