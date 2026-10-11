---
title: A skier carried by a machine at speed must give his wind to the machine's bed
date: 2026-10-11
scope: pwa/src/game/audio/ride-bed.ts, chute-bed.ts
concepts: [wind, apparent-wind, machines, mix]
---

The ride bed hears the APPARENT wind off the skier's own velocity, so a
skier held in a plane's door at 60 m/s roars at near `WIND_TOP` even from a
cockpit lens behind a windscreen — and in freefall the same roar would stack
under a skydive bed's own. The fix is a share, never a branch per machine:
`chute-bed.ts`'s `rideShares(state)` scales the ride bed's wind and skis
(0 aboard the plane, whose bed has the door's slipstream; the wind 0 in the
exit, freefall and deployment, whose roar is the skydive bed's). A new
machine that carries him fast adds its case there, and its own bed then
meters at the level the ride wind had (the plane's door at the helicopter's
hover, the belly freefall at a flat-out tuck).
