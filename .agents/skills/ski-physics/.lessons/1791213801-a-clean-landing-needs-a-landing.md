---
title: A trick test that wants a CLEAN landing has to stage a landing slope — the old flat staging only landed soft while still rotating
date: 2026-10-05
scope: tests/tricks_test.ts
concepts: [landing, tricks, staging, impact, harsh]
---

`tricks_test.ts`'s LAUNCH (1.2 m up, climbing 8.5 m/s at 65 km/h over the
flat) comes down at about 8.7 m/s into the snow with nothing turned — a
harsh landing. The old rate strokes passed "flip, air, CLEAN landing"
there only because the flip was still coming round at the touchdown, tips
10° down, and the rotation took speed off the stations' approach. Once a
throw stopped square on its angle, the same flip met the flat level and
landed harsh like a plain jump. Stage the landing a kicker would give —
the run falling 24° from where the flight comes down (`flatLevel` with
`grade`, `slopeFrom`) — rather than tuning the trick until it lands soft
by accident on the flat.
