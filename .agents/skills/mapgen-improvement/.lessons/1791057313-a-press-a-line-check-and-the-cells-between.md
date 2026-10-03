---
title: A shape pressed into the ground must be checked on the cells it pressed — a keep-off the line test passes can still leave an unpressed cell under it
date: 2026-10-03
scope: engine/mapgen/summit-ramps.ts, engine/mapgen/station-pad.ts, engine/analysis/resort.ts
concepts: [ramps, stations, bilinear, analysis, retries]
---

The summit ramps (R26, v5) were planned along a line sampled every 1.5 m and
pressed cell by cell, skipping a station's footprint, a run's head and
shoulder and the cut under a lift's way in. Every time the line test and the
pressing used the SAME keep-off, a cell beside the line was skipped and
`groundAt`'s bilinear read pulled the line's surface up or down 0.5–7 m — the
analyzer's "climbs at 4 m" refused one attempt in two and doubled the build
time. The cure each time: the line keeps off a couple of cells (`ground.cell
* 2`) further than the pressing does, a ramp's head keeps off a deep cut's
eased edge entirely, and a ramp ENDS where the run's shoulder starts (its
height read there), not on the run's centreline. Two ramps off one pad must
not overlap either: the second pressed overwrites the first. Measure the
retries with `make analyze COUNT=24` against the baseline before calling a
generator change done — the "N needed a retry" line is the tell.
