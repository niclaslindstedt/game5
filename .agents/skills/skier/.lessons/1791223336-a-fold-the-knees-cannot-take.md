---
title: A fold the knees cannot take must not become a bow at the waist — and a lag is no line for a ramp
date: 2026-10-05
scope: pwa/src/game/skier-pose.ts, pwa/src/game/skier-spring.ts, scripts/sag-lab.mjs
concepts: [spring, tuck, fold, trunk, compression, line, labs]
---

The legs' spring sinks the hips by `bump`; `kneeRoom` lifts them back by however much the knees cannot fold, and the trunk was bowed by `asin(raise / spine)` for ALL of that raise, plus `fold * 1.4`. In a tuck the knees are already at `KNEE_MOST.tucked`, so every compression, roller and landing went entirely into the waist: +55–65° on a 72° tuck, the head 18–23 cm below the hips (a downhill racer's, 150° off the skis' normal). The cure is to pose the trunk only on the fold the knees TAKE (`taken`: the fold less the raise it caused, read by `kneeRoom` with and without it), and fade the forward `pitchHeld` by the crouch. Second trap: the line the body is damped against was a first-order lag of the climb, and a steady ramp in the climb (a stop down a pitch, a run gathering speed) leaves a lag that the damper turns into a fold of ~0.3 m per m/s², pinning the legs at their stop for as long as the ramp lasts. A second-order tracker with a trend (`slopeRate`) rides a ramp exactly; past `1 / LEGS.line` rad/s it follows the rollers and `skier_legs_test`'s "body rides on" bound fails. `make sag` measures both by posing every frame again with the spring taken out: the trunk's ADDED pitch is the reading, never its total.
