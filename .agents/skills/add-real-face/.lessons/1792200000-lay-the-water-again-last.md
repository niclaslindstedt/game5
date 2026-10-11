---
title: Lay the water again once the grading is done — and leave a body off rather than move a pad or steepen a run
date: 2026-10-11
scope: engine/mapgen/real-water.ts, engine/mapgen/resort-build.ts, engine/game/village-streets.ts, tests/real_faces_test.ts
concepts: [water, ground, pads, runs, village]
---

The water is laid on the ground just baked, but the runs pressed into it,
the station pads, the ramps off them and the way to the next queue move
that ground again afterwards — up to 20 m under a body on seed 1 (15 of
the 40 faces), so the renderer's flat water floated or the snow showed
through it. Measure it per face as the worst |ground − y| over the grid
cells inside every ring, not by eye. What held: flatten again as the last
ground step (after the tunnels, before the woods) only the bodies whose
ground moved, and re-read every run's line, kicker, drop and ramp end.
Re-flattening blindly cost attempts: a pad beside a lake tilted (fell-8
went from 1 attempt to 9) and a lane through a feather fell at 0.46 where
it may fall 0.14. So a body whose re-lay would move a pad, a ramp or the
way, steepen a run past its kind's ceiling, or make it climb (the
analyzer refuses 0.01; compare against what that window climbed before,
not the run's steepest — its kickers climb) is restored and left off.
Over the forty that left 13 of 224 bodies off and the attempts unchanged.
A village held off the water may have nowhere to go (five fells): try it
dry first and fall back to the ice rather than lose the village.
