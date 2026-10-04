---
title: A carve past ~1.6 g needs the platform AND a moment-free share of it — and a technique row keeps every other mode bit-identical
date: 2026-10-04
scope: engine/game/skier.ts, engine/game/snow.ts, engine/game/limits.ts, engine/game/defs/technique.ts
concepts: [carve, platform, roll, technique, slalom, digest]
---

The Coulomb edge (`edgePacked` × `sideGrip` × `carve.grip`) caps a carve at
~1.6 g, so no slalom turn (2.5–3 g round a pole) was possible whatever the
edge. Raising the grip alone threw the skier out of every hard turn: the
lateral force acts at the stations, a CoG height below him, and the roll
hold (`rollMax` × `hangOff`, ~1260 N·m) cannot carry 2.5 g of that moment.
What worked: the PLATFORM (`platformOf`, tan θ past 54°) and its share of
each station's force pushed at the station lifted to the CoG's height along
the normal — it turns him (the yaw lever along the ski is kept) and rolls
him nothing. A larger inclination target (`Technique.incline` 0.95 rad)
then overshot at every edge change (the target swings ±54° and the clamped
hold cannot brake the roll): 0.8 is the most that held. Scope it through a
`Technique` row whose identity row multiplies by exactly 1 / adds exactly 0
(`x * 1`, `max(edgeMax, 0)`, `platformOf(…, 0) = 0` guarded with a branch),
then prove `make ride`, `make ride --card`, `make sim` and
`make sim --skis all` byte-identical against the baseline before trusting it.
