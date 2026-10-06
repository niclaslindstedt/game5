---
title: A spec change can expose the bot missing a narrow drift gate and resetting onto the same line forever — a bot weakness, not the spec's
date: 2026-10-03
scope: engine/sim/bot.ts
concepts: [bot, reset, powder, sim]
---

`make sim` on a heavier rider (`--rider solid`) failed seed 8 with 13 resets at gate 21: in a drift the heavier skier is slower (14 km/h), the bot passes about a metre outside a 6.6 m-wide gate, asks for a reset, and, being deterministic from the same reset pose, skis the identical line every time until the clock runs out. Read the reset events and the skier's track before blaming the physics; the honest fix is the bot's (a different line after a reset at the same gate), and the honest report is a sim row marked NO with the reason.
