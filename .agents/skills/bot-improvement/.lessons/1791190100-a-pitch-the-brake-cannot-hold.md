---
title: A pitch the brake cannot hold is room owed, and its pull is taken off the turn
date: 2026-10-05
scope: engine/sim/bot.ts (speedAllowed)
concepts: [speed, pitch, bends, brake, regressions-from-maps]
---

The generator's v6 tops moved where runs start, and seed 1's course came out
with a 52 % pitch running into an S-bend: the bot arrived 3 m/s too fast,
braking full, and slid 12 m wide of a gate. Two things were wrong in
`speedAllowed`, both only visible on a steep pitch. The skidding room was
clamped at zero, so a pitch steeper than the brake can hold "allowed" the
bend's own speed at its top — impossible, since the pitch adds speed all the
way down; the room is now OWED (negative), down to a crawl (`CRAWL`). And the
corner speed ignored that the fall line drags a skier out of a turn across
it; half the slope's pull is now taken off the grip he turns on
(`PITCH_PULL`). Missed gates over seeds 1–8 went 7 → 3. A map change that
makes the bot miss is a bot defect a steeper course exposed — find the
physics the planner ignored before touching the tuning knobs (`skidOver`
made no difference).
