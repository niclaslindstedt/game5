---
title: Laying a face 1:1 bends the rules at the top and the bottom, and a refused attempt must let go of its grids
date: 2026-10-11
scope: engine/mapgen/massif.ts, engine/mapgen/resort-rules.ts, engine/mapgen/resort-build.ts, engine/mapgen/real-water.ts
concepts: [real-face, one-to-one, rules, memory, water]
---

Stretching a face to R25's vertical and calming its relief to 30 m RMS
had been hiding what a real mountain is. Laid 1:1, the refusals moved to
the ends of the face rather than its middle: a summit that is a plateau
(read the ridge as the highest row of the mean profile, then walk down to
its BROW, or every start off the top fails the contour search), a valley
floor that keeps falling or holds a hollow under its own level (level the
profile below the base row and fill the hollows, or the gondola's bottom
stands off level), and the way off the gondola's top (a pad that leans
higher than the let-go point makes the queue climb — cut the leg from the
let-go point on a face). Each bend went into `RR.massif.real.least` with
the generator reading `plan.face` and the analyzer `level.face`; every new
parameter defaults to the dealt value so no digest moves. Sweep all forty
faces from a SNAPSHOT of the tree (a copy of `engine/` and the scripts):
a sweep that reads files while they are edited reports nonsense.

Two traps found on the way. A refused attempt held in a loop's block
variable stays alive in V8's frame while the next attempt builds, so a
face whose first attempt is refused by the ANALYSIS (not by a string from
`attemptResort`) held two attempts' grids at once — 50 MB more live heap.
Hold it outside the loop and null it on a refusal; measure the live heap
with `gc()` at every progress tick, not `process.memoryUsage()` at the end.
And where two water bodies overlap, the first claims the shared cells: a
body left off by `relayWater` must hand its cells to the body under them,
or they keep the dropped body's level inside the kept one.
