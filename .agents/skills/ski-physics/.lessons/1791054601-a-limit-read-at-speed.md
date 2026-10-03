---
title: A ceiling that falls with speed is read at the speed it is planned FOR — the bot's bend speed needs one fixed-point step
date: 2026-10-03
scope: engine/game/limits.ts, engine/sim/bot.ts
concepts: [chatter, corner-grip, bot, speed]
---

The chatter made `cornerGrip` a function of speed. The physics reads it at
the speed it is going; the bot's `speedAllowed` asks the opposite question —
how fast may a bend of curvature k be taken, v = √(a(v)/k) — and reading `a`
at the speed NOW is wrong both ways (too generous approaching from slow, too
mean from fast). One step from the standstill grip (v₀ = √(a(0)/k), then
v₁ = √(a(v₀)/k)) lands just under the fixed point, slightly conservative,
and moved the sim's run times by under a second. Before any limit takes a
speed, list its readers and ask which speed each means.
