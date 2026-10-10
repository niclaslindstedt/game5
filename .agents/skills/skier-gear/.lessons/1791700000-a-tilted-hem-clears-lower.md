---
title: A hem dropped at the back must clear the seat a little lower down, and a band above a rolled hem needs room
date: 2026-10-10
scope: pwa/src/game/dress-garments.ts
concepts: [hem, seat, layers, pants, jacket, colour]
---

The jacket's hem is dropped at the back by leaning the trunk's line forward
under it, which tilts its rings — so the back of a ring at one level lies
over the pants' seat at a lower one, where the seat is wider (a woman's
most). Clearing the seat only at the ring's own level let the seat's dark
flanks poke through the back; the jacket now also clears the seat 0.1
levels lower. Likewise, easing the back's squared corners in (`BACK_EASE`)
must be done to the seat under it by the same amount, or the corners poke.
A hem band in its own colour has to be wider than the roll turned under at
the hem: the rolled part faces down and a chase camera never sees it, so a
band no taller than the roll vanishes.
