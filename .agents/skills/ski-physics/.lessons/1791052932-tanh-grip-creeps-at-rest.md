---
title: A tanh grip is nothing at no slip — a skier at rest creeps unless something holds him statically
date: 2026-10-03
scope: engine/game/skier.ts, engine/game/run.ts, engine/game/lift-ride.ts
concepts: [rest, static friction, creep, start gate, chairlift, incline]
---

Every grip in `skier.ts` is a `tanh` of the slip, so the force at zero slip
is zero and a skier held on his brake on any pitch settles at the slip his
grip needs to hold him: 0.15 m/s in the start gate, ~1.5 m in a ten-second
countdown — and 25 m on a black's steep start, where a plough holds nothing.
The fix is a STATIC hold (`grip.stillSpeed`): near a standstill, with the
stations' Coulomb capacity down the fall line (edge across, base and plough
along, an ellipse) at least the slope's pull, the way over the snow is taken
out. The countdown holds him outright (poles over the wand). Look for creep
with a probe that stands a run for ten seconds and prints the distance — the
ride lab's `rest` scenarios are on the flat and cannot see it. A lift ride
that reads `incline` off the snow under the chair has the same symptom on
screen (the figure turned about its feet slides across the seat): a rider
not on the snow is inclined to nothing.
