---
title: A heavy weapon gated on its own crew's sight almost never fires at a quarry in the woods — cue it off the hunt's `seen`
date: 2026-10-20
scope: engine/game/army-vehicle.ts
concepts: [army, gunfire, sight, wanted, lab]
---

The tank first halted to fire only when `looks()` (its own crew's `seesQuarry`) saw him. In `make army-ground ARGS="--table=vehicles --waves"`, a man stood still in the woods drew 0 shells from two tanks over 180 s, even with them 150–250 m from him, because the trunks always broke the line. A real crew is laid on a target by radio. So the fight now reads `sees || (w.seen && d < T.cued)`: whoever of the hunt sees him (`WantedState.seen`) cues every tank within `cued` m. Read the shells column of the lab for both quarries before calling a shooter done: a shooter that only fires at a skier in the open is a shooter the player never meets.
