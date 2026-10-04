---
title: The legs stand the feet under the CoG, so the inclination is an attitude — balance it off the snow's own force, carry that share moment-free, and let the edge follow the body
date: 2026-10-04
scope: engine/game/skier.ts, engine/game/incline.ts, engine/game/defs/tuning.ts, engine/game/limits.ts
concepts: [incline, balance, roll, edge, angulation, carve, sidecut, slalom]
---

The stations are cast down the snow's normal from under the CoG, so no
roll moves a foot: the snow's lateral grip always acts a leg's length
below him, and a roll hold held toward atan(v²κ/g) sat that moment / its
stiffness short (35° for a 70° slalom carve — the drawn racer upright).
What works (`incline.ts`): read THE BALANCE off the snow's own reaction
(Σ grip across over Σ load — tan θ = a_lat/g; a traverse leans into the
hill, a hockey stop back), and carry up to load·tan(incline) of each
station's grip at CoG height (the moment the real feet-out-to-the-side
cancel). Exclude the grip against the stations' ROLL SWEEP (w_roll × r)
from both: it is roll damping, and carrying it through the CoG made the
body oscillate ±60° at a crawl — but do NOT take the sweep out of the
station velocity (that throws a deep-snow traverse). A 70° edge biting at
3 g under an upright body is a moment no hold clamp beats: couple the
edge to the body (`edgeWithin`: |incline| + angulateMost), commit the body
toward the asked balance, and gate the cross-over by the old turn's load
(`crossLoad`) or a downhiller leans into the next turn against 2 g and is
thrown. Cap the carve at the sidecut's geometry (`carveMost`, R·cos edge):
`carve.tighten` past it was the 2 m "slalom carve". The bot (which asks
for edges instantly) DSQ'd the slalom after the coupling — measure
`technique_test`'s bot slalom and tell the bot's owner.
