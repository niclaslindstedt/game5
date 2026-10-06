---
title: A researched technique row can carve its own turns only at a crawl — print carveSpeedOf first
date: 2026-10-05
scope: engine/game/defs/technique.ts
concepts: [super-G, technique, edge lock, fade, carve]
---

The super-G row as researched (fade 1.5, 60°) let the downhill ski carve a
40 m turn only under 46 km/h — the course's every turn skied wide at 100.
`carveSpeedOf(spec, 1/R, T)` for the course's radii at the row's speed shows
it in one line, before the bot is touched; fade 5 and 63° hold 40 m to 150
km/h and 35 m to 85. The downhill found the same (its fade raised to 2.5);
expect a speed row's lock to need raising.
