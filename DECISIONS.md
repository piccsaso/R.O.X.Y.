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

## Astra — 2026-11-14 — acceptance and handoff
VERIFIED: 0.25 m grid builds 38,400 cells, with 256 synthetic hole cells and
924 conservatively occupied obstacle cells; the prior has neither. The pure
controller uses a 0.4 m combined radius/margin and movement samples at no more
than one quarter-cell. Compared with centre-only collision, this avoids thin-wall
and corner tunnelling. A blocked frame can settle by less than one sample as
frame duration changes; browser checks enforce that bound and continued blocking.
Slope uses the configured 1 m baseline. Near ledges it can stop earlier than the
step rule; isolated tests disable the slope guard to verify step/drop blocking.
Eye height is scene spawn metadata, as pinned by the contract. Viewer-only cliff
side faces make discontinuities visible without creating a second walkability
source. No contract fields or interface pins changed after the 1.0.0 freeze.

## Astra — 2026-11-14 — validation scope
Use Vitest plus Chromium keyboard/pointer-lock acceptance tests, rather than
claiming unobserved manual or Windows execution. The managed environment is Linux;
native Windows launch remains UNKNOWN. The app and CLI use Node APIs and portable
npm scripts; the optional browser runner needs CHROMIUM_PATH on Windows.
