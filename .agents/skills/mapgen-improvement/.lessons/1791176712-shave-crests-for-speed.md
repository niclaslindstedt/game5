---
title: A speed course must shave its crests — a lip a slalom rolls over throws a downhiller onto the flat
date: 2026-10-05
scope: engine/mapgen/course-prep.ts, engine/mapgen/downhill.ts
concepts: [downhill, course, crest, landing, setter]
---

At 35–45 m/s every convex break in the piste is a kicker: the headwalls the
slalom's setter left alone launched the bot 20 m onto flat ground and the
landings went harsh. `prepareCourse` now shaves a course's convexity to a
radius (`CoursePrep.crest`, 80 m on the downhill: the second difference of
the stations' heights held above −h²/R, the cut carried into the ground in
16 m boxes) so every jump lands on its downslope. Any discipline that keeps
its jumps starts from the same shave, its radius tuned to its speed. The
setter's preparation lives in one place for every discipline
(`course-prep.ts`, a `CoursePrep` row each); factor before writing a
second setter, with the slalom's digests held the whole way.
