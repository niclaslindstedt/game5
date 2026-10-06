---
title: A field skied beside the player draws every heat's numbers off a stream of the heat's own
date: 2026-10-05
scope: engine/game/cross-heat.ts
concepts: [ski-cross, determinism, rivals, streams]
---

The old line start deals its rivals' paces and pairs off `state.rng`; a ski-cross heat deals its rivals off the start list's skills and the doors' release, reactions and strides off a stream seeded by the race's seed and the heat's round and number. So a restart, a replay and a test stand up the very same heat, the bracket's dealt heats are the same every time, and `make sim`, `--mode slalom` and `--mode downhill` kept every digest. Reuse `rivals.ts`'s `rivalRun` for the run itself — its draws are the caller's.
