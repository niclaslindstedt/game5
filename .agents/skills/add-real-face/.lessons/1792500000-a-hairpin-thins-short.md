---
title: A mountain road's hairpin thinned to its bends can come out shorter than the bake's shortest street
date: 2026-10-11
scope: scripts/lib/real-face-streets.mjs, tests/real_faces_test.ts
concepts: [hints, streets, thinning, alpine]
---

The town bake dropped a street under 40 m measured along the road, then
thinned it to its bends. A hairpin on a steep alpine town road is long
along the road but its bends lie close together, so the thinned line the
hints carry came out at 32 m, under the suite's 35 m floor. The bake now
measures the thinned line too and drops it when that is short. A face
baked before this change is unmoved, because the check only ever drops a
street that would already fail. When a new range brings a new kind of
road, run the hints test before the long build sweep: it catches this in
seconds.
