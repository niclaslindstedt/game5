---
title: A technique's pose row is laid ON the shared pose — the free row the identity to the bit, every change gated to the carve it describes
date: 2026-10-04
scope: pwa/src/game/technique-pose.ts, pwa/src/game/skier-pose.ts
concepts: [technique, pose, transition, legs, knees, poles]
---

`technique-pose.ts`'s rows are read by `skierPose` as multipliers and
offsets whose free values are 0 or 1, so `FREE_POSE` (and no row at all)
draws the same floats — `tests/technique_pose_test.ts` holds it with
`toEqual`, which keeps the crowd (posed by `skierPose`) and every lab
unchanged. Three traps cost a pass each:

- An EDGE CHANGE read off `body.tilt` (the skis' tilt in the rolled body
  frame) fires mid-carve, where an inclined body stands on a near-flat
  tilt: read it off the edge in the WORLD (`turnEdge`) and only while he
  has been turning lately (`SkierSpring.swing`), or a schuss retracts too.
- Hips lowered or lifted BEFORE `kneeRoom` come back as `raise`, and
  `raise` pitches the trunk forward: a retraction is applied after it (let
  down, then `kneeRoom` again, no pitch), and an outside leg held long is
  capped by its span AND by the cuff (`cuffOver`), or the shin falls
  behind the boot.
- A row's carriage (hands, poles under the arms, stance, the knee's fold,
  the pelvis's hike) is a RIDER's: gate it off while he works the poles or
  the stride (`working`, `armW`), skids, or crawls — every one of those
  showed up as `push`, `boot` or `through` faults in other moves.

Measure a row with `make skier-metrics ARGS=--technique=<id>`; its honest
before is the same run with `ridingOf` forced to `FREE_POSE` (the engine
still skis the technique). To find which field faults a move, set one
field of the row back to the free row's in a probe and re-run the move.
