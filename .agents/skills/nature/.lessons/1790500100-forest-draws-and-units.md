---
title: A tree mesh's unit x is a crown radius and its unit y a height (≈4× longer), and every variant a map grows is its own draw call
date: 2026-09-24
scope: pwa/src/game/tree-shapes.ts, pwa/src/game/forest.ts, pwa/src/game/settings-video.ts
concepts: [trees, variants, draw-calls, instancing]
---

Tree geometry is built at unit height and unit crown radius, then scaled to
(crown·0.95, height, crown·0.95). A spray that should climb at 45° rises a
tenth of a UNIT of y per crown radius, not one — the first birch built with
"rise 0.2–0.4" came out as a broom of vertical blades. Lean is applied the
same way (`Shape` multiplies by ~4). Judge any new shape on `make trees`
(seen from the skier's head) before `make world`.

Each (kind, variant) in the full band is an InstancedMesh and a draw call.
Ten variants of five kinds took the race moment from 54 to 121 draws; twenty
kinds would have been hundreds. So FOREST's rung is a BUDGET of full-band
meshes (`FOREST_LOOK[row].shapes`) shared among a map's kinds by how many of
each it grows (1–10 variants a kind, `VARIANT_ORDER` most telling first), and
the far band and the casters draw ONE shape a kind (`leadVariant`). Size each
mesh to the trees that use it (not `trees.length`). `BatchedMesh` would make it
one draw, but three.js falls back to a draw per INSTANCE where
`WEBGL_multi_draw` is missing — thousands — so it is not a safe swap.

`tree-shapes.ts` must stay loadable by `--experimental-strip-types` (no
parameter properties): a lab or a probe that imports it dies otherwise.
