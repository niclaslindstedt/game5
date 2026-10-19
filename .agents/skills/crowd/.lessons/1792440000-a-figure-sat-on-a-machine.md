---
title: A crowd figure sat on a machine is a ride key in the machine's metres, divided by the body's scale — and the ankle joint sits 0.26 m up in the boot
date: 2026-10-19
scope: pwa/src/game/rescue-sleds-ride.ts, pwa/src/game/civilian-moves.ts
concepts: [pose, keys, seated, morph-targets, scale]
---

`keyPosed` scales a key by the body's height over the reference man's 1.8 m,
so a seat written in the machine's metres sinks a short body into it and
floats a tall one off it. Write the ride key for the machine (the seat's top
over the running boards, the grips) and divide every length by the body's
scale before `keyPosed` (`rescue-sleds-ride.ts`' `unscaled`); the hips then
land on the seat for every body. Hang the seated figure the seat's rise
under the seat's top the plan gives, and blend the ride as a morph target
after the walk's (the walk's weights times 1 − on, the ride's on). When
checking feet on a floor, compare the ankle joint with a STOOD figure's:
it is about 0.26 m up inside the boot, not `ANKLE`.
