---
title: A strike read off the shoulder's circles round the skis fires a metre and a half out — at speed meet the two bodies, over the whole step
date: 2026-10-20
scope: engine/game/crowd.ts, engine/game/person-hit.ts, engine/game/defs/person-hit.ts, pwa/src/game/impact-people.ts, tests/support/body-hits.ts
concepts: person-hit, collision, contact, impact-cam, tests
---

`clipCrowd`'s shoulder meets an amateur on `RACE.bump`'s two circles round the player's skis (0.6 m, ±0.5 m fore and aft) against `CROWD_SIZE`'s radius (0.55 m for a man): a reach of some 1.65 m ahead of the player's middle. Used for the strike too, it fired with a metre of air between the drawn figures, and the impact cam's slow motion showed blood hanging between two men stood apart. Past `PERSON_HIT.strike` the meeting is now the two BODIES (`footRadius` + `PERSON_HIT.foot.reach`, ~0.48 m between middles), tested by `bodiesMet` over the step's segment so 30 m/s does not ski through. The read ahead (`meetGhosts`) must use the same test, or the cam cuts early.

Staged meetings (`stageMeeting`, `crowd_test`'s `meet`, `foot_hitters_test`) set the person a fixed distance ahead: past the strike he must stand within the bodies (0.4 m), or the test reads no strike. A staged amateur's `x, z` is put back by his run's frame on the next `step`, so to ride an approach move only the player and call `clipCrowd` directly.
