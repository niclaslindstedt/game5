---
title: The bot must be at a kicker's speed a ramp short of the lip — skidding on the lip throws a slow skier over the tips
date: 2026-09-23
scope: engine/sim/bot.ts
concepts: [kickers, braking, nose-in]
---

`speedAllowed` planned each kicker's speed AT the lip, so the bot was still
skidding up the ramp; with the skis loaded by the skid and then dropping off
the crest, a slow skier pitched steeply tips-down before he left the snow and
the tricks run wiped out every flight (`tricks_test`'s bot run went to 0
points after a geometry change moved the CoG toward the tips).
`KICKER_RUNUP` (10 m) plans the speed a ramp short of the lip. A geometry
change to the boot's `mount` or the stations' `along` owes that test and
`make ride SCENARIO=kicker-slow`.
