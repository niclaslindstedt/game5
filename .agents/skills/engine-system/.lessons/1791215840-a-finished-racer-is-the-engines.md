---
title: After the finish the engine skis the racer — a discipline whose finish is at speed owes its own coast; and a clock read to the step is too coarse for a speed
date: 2026-10-05
scope: engine/game/run.ts, engine/game/strict.ts, engine/game/course.ts
concepts: [finish, coast, run-out, timing, speed-ski]
---

`run.ts` hands a finished racer `COAST` (a 0.6 skid) in place of the input. Every other course finishes slow; a speed track's last line is crossed at 200 km/h, and that skid with the stood-up drag ran the racer 100 m off the end of the track into the trees. `runOut` gives a speed track its own coast: untuck over 120 m, ride the wind, skid only past the braking line and under 144 km/h — and a racer out of the race stands up and stops where he is. Size the setter's run-out on the skid the physics actually gives (the ride lab's `speed-skid`), not on the research's mean.

A step is 1/120 s, half a km/h through a 100 m zone at 200: read a timing line's crossing to the fraction of the step (`crossingShare`), and only on the course that needs it, so no other mode's clock or digest moves.
