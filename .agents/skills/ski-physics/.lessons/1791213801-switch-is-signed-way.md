---
title: Riding switch needed no new physics — the body reads the way as signed; only the controls, the yaw hold's reference and the drive assumed forward
date: 2026-10-05
scope: engine/game/switch.ts, engine/game/skier.ts
concepts: [switch, backward, steer, slip, drive, tailRise]
---

Going tails first, the stations' grip, the sidecut's toe-in, the carve's
`way · κ` and the inclination all already worked: the carve simply turns
the way the other way about. What assumed forward was the controls and the
hands: the steer had to be MIRRORED (an edge to his right bends his way
left) so the line bends the way the player pressed; the yaw hold's slip
reference had to be the tails (`heldSlip`) or the skis weathervaned; the
automatic drive had to stop (a stride would push him back up the hill);
and the landing's judges (`landingOff`, `noseDown`) had to read the
LEADING end. Decide `switched` on the snow with a margin either side of a
standstill and freeze it in the air, or a 360 flips everything twice. Keep
all of it behind `RunRules.stunts`, so no race's digest moves.

Two things the suite caught. A tail dig at any backward speed threw a
skier who had merely stalled on a rise and drifted back at a walk
(`lift_ride_test`'s "nothing leads him"): dig only when he is RIDING
backward (`switch.digSpeed`). And a per-pair number added to `skis.ts`
moves the modelled skis' stamp (`tests/models_test.ts` hashes the file's
text) — a number the models do not draw belongs in a table beside the
catalog (`defs/tails.ts`), not a `make models` the container cannot run.
