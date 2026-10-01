---
title: An engine reading that starts or stops at full rate snaps the head — follow it on a critically damped spring, never an exponential
date: 2026-10-01
scope: pwa/src/game/skier-spring.ts
concepts: [continuity, twitch, spring, snap]
---

`hipRight` (a first-order lag), `edge` (rate-limited) and the pair's `roll`
all change velocity in a single step when the key changes or the lock is
reached; posed straight off them, the head at the top of the lever snapped
4–13 cm a frame at every turn reversal. The cure is a second-order follower
in the view (`follow` in `skier-spring.ts`, ~30 rad/s, some 70 ms of lag),
used for the body above the boots while the boots stay on the engine's raw
edge — the knees' band absorbs the difference. An EXPONENTIAL ease
(`to + (from − to)·e^(−k·dt)`) has the same fault: it starts at full speed,
so the air and a jump's load moved to the critically damped follower too
(their rates raised ~1.8× to keep the timing). Drive the shoulders' twist
and the head's look off the followed hip shift, never `steer`, which flips
−1 → +1 in a step.
