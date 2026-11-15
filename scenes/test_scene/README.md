# Synthetic proving ground — TEST DATA

Regenerate from `app/` using `npm run generate:test-scene`. The generator owns
all scene data files; this document explains their intended tests. Local metres,
60×40 m patch, 0.25 m grid. All geometry and imagery are synthetic CC0 test data.
ROVER_MEASURED and ORBITAL node tags exercise provenance handling only.

| Feature | Local location | Acceptance purpose |
|---|---|---|
| Gentle plane | y = .025x + .01z | Ground following, normals, metric scale |
| Spawn / East Beacon | (−22,0) / (22,0) in x,z | Direct line obstructed by boulder and divider |
| Faceted boulder | (−4,0), radius ~2 m | No obstacle penetration; route detour; prior-map surprise |
| Steep band | x 8..12, z −16..−9 | ~41° band exceeds 25° assumption |
| Hole | x −13..−9, z 7..11 | Ray misses become UNKNOWN; no walking into hole |
| Raised ledge | x 15..30, z 7..15 | 1.5 m discontinuity blocks ascent and descent |
| Corridor divider | x −.5...5, z −6..6 | Two routes to East Beacon |
| Short north corridor | between z −9.75 and −6 | Shorter route passes high exposure field |
| Long south corridor | between z 6 and 13.75 | Longer bypass with lower exposure |
| Exposure PNG | x −7..8, z −10..−6 | Synthetic high-risk zone for Astra 2 tradeoff |
| Exclusion polygon | x 20..25, z −7..−3 | Astra 2 scenario hard block |
| Amber Rock | boulder, viewing point (−8,0) | Route to standing point rather than rock |
| Amber Ridge | (22,12) | Shared “amber” alias requires disambiguation |
| Distant Crater | (90,0) | OUTSIDE_PATCH remains informational |
| Prior collision | full gentle plane | No boulder, walls, band, hole or ledge: remap can reveal hazards |

The long southern bypass takes additional distance around the hole when
approached from spawn. Exposure and exclusion files are fixtures for Astra 2;
Astra 1 deliberately does not implement overlay UI or scenario routing.

Browser fixtures start near each hazard to isolate it: boulder (−8,0) east,
hole (−16,9) east, ledge (18,5) south / (18,9) north, steep band (6,−12) east,
boundary (28,0) east. Main spawn faces east. Press R to reset.
