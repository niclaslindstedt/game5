---
title: A drive that changes the skier's direction must turn his way itself — asked of the sideways grip, the slip it takes is a brake
date: 2026-10-03
scope: engine/game/skier.ts, engine/game/poles.ts
concepts: [skate, glide, grip, slip, energy, zig-zag]
---

"Skating should take him where the ski points" was first built by turning
only the grip's frame (the stations' `toe`) to the gliding ski's line and
letting the snow's sideways grip swing his velocity round to it. It did
swing round, and the `skate` ride lost nearly half its pace (24 → 13 km/h
on the flat): Coulomb grip on a slip is dissipation, and a line that swings
±20° every second keeps the skis slipping all the time. A real skater's
push leg pays for the turn. So turn the velocity with the line itself
(`c.glide`'s change each step rotates `vx, vz`, speed kept), and turn the
grip frame and the yaw hand's slip reference by the same angle, so nothing
is left to scrub. Then the ride table was unchanged to the decimal. The
tell is a drive table that sags as soon as a direction change is added
with no new drag term: look for slip.
