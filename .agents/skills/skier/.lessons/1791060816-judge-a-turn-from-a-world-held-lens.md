---
title: Judge a turn from a lens held to the world, and judge a stepping stance only on the skis on the snow
date: 2026-10-03
scope: pwa/src/tools/skier-harness.ts, scripts/skier-metrics.mjs, pwa/src/game/skier-gait.ts
concepts: [turn, step, lab, metrics, views]
---

The skier lab's views all turn with his heading, so a skier stepping
round on the spot looks, frame after frame, like a man standing still and
shuffling — the turn itself is invisible. `--views=top,fixed` hold the
lens to the world (straight down with his first heading up the cell, and
behind where he first faced); `make skate-turns` shoots with them. And
`skier-metrics`' `stand` band (knees 20–55°) flagged most of a step turn
until it judged only the knees of skis on the snow: a ski lifted to step
bends its knee past a standing one's, which is the step, not a fault.
