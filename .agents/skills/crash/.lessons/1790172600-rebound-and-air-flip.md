---
title: A wipeout rule read off every `land` or off `overFor` fires on an ordinary overshot kicker — judge the flight's own landing, and a fall only on the snow
date: 2026-09-23
scope: engine/game/crash.ts
concepts: [wipeout, landing, rollover, thresholds]
---

The slope's kicker taken fast lands tail-first, steeply tips-up; the slap
throws the skier back up for a fraction of a second and he comes down
tips-down hard — a second `land` event that met the over-the-tips
threshold. Gated on `airTime >= noseAir` that passed, and then the same
skier somersaulted through upside-down IN THE AIR, which `overFor`
(world-up, air or not) counted as a fall. Neither was a crash: he comes
down on his skis. The fixes were `noseAir` and `rolledFor` (over, ON the
snow). The bot never met either case, so `make sim` was blind to it — only
the ride lab's `kicker` row showed it, which is why the kicker is in
`crash_test`.
