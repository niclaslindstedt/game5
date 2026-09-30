---
title: Anything laid for one mode only is chosen early and STAMPED last, or it re-grows the whole forest
date: 2026-09-25
scope: engine/mapgen/generate.ts, engine/mapgen/trick-field.ts, engine/mapgen/forest.ts
concepts: [trick-field, forest, determinism, tricks]
---

`growForest` refuses candidates on every kicker it is handed, and the clumps,
the lanes and the gap test are all order-dependent, so handing it one extra
kicker moved ~40 % of a seed's trees kilometres from the track. The trick
field (R20) is therefore PLANNED where it must be known (before the drifts
are dealt, so they keep off it) and STAMPED after the day and the weather,
with only the trees whose ground it moved cleared (`clearField`) — and a
tricks map stays on its race map's attempt only while the field never fails
the analysis, so its count's floor is low and a size that will not fit falls
back to a smaller one. `tests/tricks_test.ts` ("changes the track and nothing
else") holds it.
