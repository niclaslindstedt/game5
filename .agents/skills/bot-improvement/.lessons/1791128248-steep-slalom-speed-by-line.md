---
title: On a steep slalom the brake cannot hold speed and costs the turn — check speed with the line, and cap the edge only in the high-side zone
date: 2026-10-04
scope: engine/sim/bot.ts, engine/game/race-line.ts
concepts: [bot, slalom, braking, steep, edge-cap]
---

Measured on `flatLevel({ grade })` with the slalom technique at 12 m/s: a skid with the skis straight (steer under 0.5, so `skiAngle` barely pivots) drags 0.35 g, less than the pull of any pitch past ~0.37 of grade, so on a 0.65 pitch it still accelerates; a full pivot sheds speed but turns the path 8° in 0.5 s against 43° unbraked. So a bot that controls a steep slalom by braking either gains speed or misses the next gate. What works: plan a slower speed through a ROUNDER line (`raceLineAt` — the swing scaled by the pitch, so the bend and the bend speed follow), a check of at least `slalomSkid` when over, held while the slide is fast, and the slide cap only past `skier.slipSpeed` with no skid asked for. A cap at half `slipSpeed` fired on every steep turn (a carved ski slides 3–6 m/s across its line there) and held the edge under the platform, so the planned turn was never skied — the cause of the open-gate misses on crest-5/6.
