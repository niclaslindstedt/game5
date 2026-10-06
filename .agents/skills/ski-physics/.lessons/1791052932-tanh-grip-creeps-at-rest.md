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
pull ALONG the skis' line within what the base and plough hold, the way over
the snow is taken out. Across the skis the pull is not the edge's grip to
hold: a ski at rest presses a LEDGE into the snow, so it is the skis' line
that decides and never the pitch (the first cut used the edge's friction
across and was corrected: a skier stands across a 31° face). The hold's
threshold must sit well above the tanh's own slip scale (0.3–0.4 m/s) — at
0.3 m/s a hockey stop on a steep pitch settled into a 0.4 m/s side-slip just
above it and never stood; and the skid's scrape must fade at a crawl
(`grip.skidBite`) or the pivoted edge never sets. The countdown holds him outright (poles over the wand). Look for creep
with a probe that stands a run for ten seconds and prints the distance — the
ride lab's `rest` scenarios are on the flat and cannot see it. A lift ride
that reads `incline` off the snow under the chair has the same symptom on
screen (the figure turned about its feet slides across the seat): a rider
not on the snow is inclined to nothing.
