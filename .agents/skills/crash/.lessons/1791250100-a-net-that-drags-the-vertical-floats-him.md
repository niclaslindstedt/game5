---
title: A catching surface that drags the vertical floats a thrown body level — the throw has already dropped his fall down the slope
date: 2026-10-05
scope: engine/game/nets.ts, engine/game/lone-skis.ts
concepts: [nets, ragdoll, yard-sale, friction, wipeout]
---

The first A-net catch damped every velocity in the mesh's plane, vertical
included, and a racer driven in at a shallow angle hung 3–4 m up the net
while the slope fell away under him. `throwRider` keeps only the upward
part of his velocity (`Math.max(0, v0.y)`), so a body thrown on a slope
leaves level and falls onto it; drag his descent and he never arrives.
Drag along the net and UP it, never down. Also: giving each ski END its own
hook chance hooked both ends three times in five and froze the ski flat in
mid-air — one chance a ski, at the end that reaches the mesh first. Probe
the catch numerically first (height over the snow, depth past the line,
`still`, each ski's `hooked` every 0.2 s over a few drives), then LOOK with
the world lab's `net-<s>` views.
