---
title: An engine reading that starts, stops or jumps in a step snaps the figure — follow it on a critically damped spring in the view, and draw the skis off the same one
date: 2026-10-01
scope: pwa/src/game/skier-spring.ts, pwa/src/game/skis-body.ts
concepts: [continuity, twitch, spring, snap]
---

`hipRight` (a first-order lag), `edge` (rate-limited) and the pair's `roll`
change velocity in a single step when the key changes or the lock is
reached; posed straight off them the head snapped 4–13 cm a frame at every
turn reversal. Worse, `skiAngle` is `skid × steer` with no lag at all: at GO
the gate's held brake meets the bot's first steer and the skis swung 56° in
one step (a knee jumped 25 cm). The cure is `follow` in `skier-spring.ts`
(~30 rad/s, some 70 ms of lag) — and for the pivot the DRAWN SKIS must ride
it too (`drawnSkiAngle`, handed to `gear.pose` / the rig), or the boots
leave the bindings. Faster followers (45, 60 rad/s) bring the snap back. An
EXPONENTIAL ease has the same fault (it starts at full speed). Never pose
off the raw `steer` — but the key IS what the upper body must lead a turn
on: follow it with an ACCELERATION CAP (`follow`'s `most`), as the lead
does (see the upper-body-first lesson). The boots stay on the raw edge on
purpose; the knees' band absorbs it.
