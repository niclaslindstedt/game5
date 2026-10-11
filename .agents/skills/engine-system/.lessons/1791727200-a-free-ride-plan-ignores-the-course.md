---
title: Anything dealt off a free ride's map must ignore the course it was stood up on — key by run ids and kicker lips, never K1…
date: 2026-10-11
scope: engine/game/challenges/, engine/index.ts
concepts: [free-ride, determinism, kickers, file-size, exports]
---

A free ride's `Level` is the ski area stood up on ONE course (the grade the ride asked for picks it), so `level.track`, `checkpoints`, `sun`, `weather` and the kickers' ids move with that pick: the course's kickers are renumbered `K1…` down it while every other run's are `${run}K${n}`. A plan meant to be the map's alone (`dealChallenges`) reads `resort.runs` sorted by id, kickers by their lip rounded to the metre, lifts by id, and is checked by building the same seed on another course (`generateLevel(seed, { course, face | region })` — the face or region must be passed, or it builds another mountain). And `engine/index.ts` sits at the 1000-line cap: a new system exports through one `export * from` its own barrel.
