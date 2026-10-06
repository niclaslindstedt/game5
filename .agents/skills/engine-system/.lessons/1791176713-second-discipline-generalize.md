---
title: The second discipline is where the first one's names get generalized — RaceHud, raceCourseOf, sim --mode
date: 2026-10-05
scope: engine/game/, pwa/src/game/snapshot.ts, engine/sim/simulate.ts
concepts: [discipline, downhill, slalom, generalize, sim]
---

The downhill reused the slalom's machinery by renaming it once rather than
copying it: the HUD's `SlalomHud` became `RaceHud` (`snap.race`, with a
`discipline`), the plate's press a union (`secondRunOf` → a slalom's
`second` or a downhill's `race`), "which race is set on this map" one
function (`race-course.ts`'s `raceCourseOf`) that the nets, the start
house and the audience ask, the par one entry (`raceParOf`), and the field
a row per discipline (`field.ts`). `make sim ARGS="--mode slalom|downhill"`
skis a discipline's course with `out` and `trap` columns — the sweep the
slalom had to write as a scratch test. Save the default `make sim` table
before the first edit: unchanged digests at the end are the proof the
other modes were left alone. Every new event kind owes a sample in
`tests/audio_test.ts`, and every result path the out case.
