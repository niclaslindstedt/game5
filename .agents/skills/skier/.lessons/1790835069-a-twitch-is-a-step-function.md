---
title: A twitch in a cyclic move is a step function in the pose — measure each joint's per-step travel, then build the cycle from rods turned and weights carried, never targets switched
date: 2026-10-01
scope: pwa/src/game/skier-pose.ts, tests/skier_pose_test.ts
concepts: [gait, poles, continuity, twitch, solve-limb]
---

"Twitchy, not a smooth transition from left to right" was three
discontinuities, none visible on a contact sheet's nine frames: the skate's
hip sway was a SIGN flipped at each stride boundary (0.2 m in one 120 Hz
step), and the poles' tips were PLACED (in the snow on the push, off the
hand on the recovery), so a basket teleported ~0.7 m at every plant and
release. Skiing the engine from a standstill and recording each joint's
largest per-step travel found all three in a second; the sheets did not.

The cures that hold: a side-to-side weight that is carried across over the
push and held through the glide (so the next stride starts where this one
ended); a pole that is a rigid rod whose DIRECTION is turned — toward the
basket on the push, blended back to the next plant on the recovery, with a
trailing term that is zero at both ends — and blends between gaits mixed
as directions, never as tip points (mixing two points at a pole's length
shortens the pole). And near full arm's reach `solveLimb`'s elbow runs away
(the bend is a square root): ease the fist short of the arm's length rather
than let the elbow pop straight.

"Cartoonish" was the wings: hands finishing beside the hips with the elbow's
pole vector pointing OUT. Drive the finish far enough back that the arm is
long, and turn the elbow's pole down and back while the arms work.
`tests/skier_pose_test.ts` now samples a whole cycle at five speeds and
fails any joint moving more than 3 cm between neighbouring samples.
