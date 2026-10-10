---
title: A fell face had no village because its wind crust is folded into the packed field — and the real town rarely lies under the hub
date: 2026-10-10
scope: engine/game/village-streets.ts, engine/game/real-streets.ts, scripts/lib/real-face-streets.mjs
concepts: [village, fell, crust, hints, streets]
---

The village keeps its streets off the groomed snow by reading `packedAt`, and
on a fell the R21 wind crust is folded into that field, so most of the valley
floor reads as groomed and no village fits — 16 of the 40 faces had none. The
fix reads the crust back out (`sampleField(level.crust, …)`) on a face only,
so no dealt map and no digest moves; a dealt fell still has none, which is the
older behaviour and a separate change.

The generator's hub sits on the bottom strip of every face, while a real town
is often a kilometre or two off it, so a village main street that FOLLOWS a
real road almost never applies. What carries the real look is laying the real
streets near the village (and near the town's middle) as streets of their own
kind, checked against the ground's gradient and the clearances. Measure the
town against the hub first (`hub z`, `town x,z r` columns) before tuning how
closely the main street follows a road.

The streets were appended AFTER the houses in a face's hint bytes, read only
while bytes remain, so a hint file baked before them still decodes — and each
face re-baked moves only its hints file and the index, never its heights.

A street mapped as a RING (a loop road, a roundabout) has both ends on one
point, and thinning it between those ends keeps nothing but the two of them —
a zero-length street in the hints. The bake halves a ring at its farthest
point before thinning; a test that sums every decoded street's length is what
caught it.
