---
title: Judge "from behind" off the course's arc where they met — and brace the racer behind
date: 2026-10-05
scope: engine/game/cross-heat.ts
concepts: [contact, ski-cross, red-card, rivals]
---

The red card for a knock-down from behind first read "behind" off `raceProgress` (gates credited), and a racer who had crossed a gate a step earlier — or one stood there by a test — read as ahead. Read it off `nearestTrackPoint`'s arc for both where they met. And a rear-end gives both racers the same blow, so both went down and no card came: the racer behind sees it coming and takes `CROSS_HEAT.braced` times as much before he goes down himself.
