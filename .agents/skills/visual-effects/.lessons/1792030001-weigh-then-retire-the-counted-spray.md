---
title: Retiring the counted spray models left one pool and two benches
date: 2026-10-15
scope: pwa/src/game/spray-sim.ts, scripts/snow-mass-lab.mjs
concepts: [spray, labs, retire]
---

`spray-eval` scored the weighed model below the counted ones (82 against
89) because it charged the CPU pool's milliseconds (the game flies it on
the GPU) and held the launch to the counted models' band, which the push
model leaves by design. Its age and depth table was the one thing nothing
else held, so it moved to `make snow-mass ARGS=--ages` (byte for byte the
same table) before the lab was deleted. When retiring a lab, port the
table nobody else prints first, and diff its output before and after.
