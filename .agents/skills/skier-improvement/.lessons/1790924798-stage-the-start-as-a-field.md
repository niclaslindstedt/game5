---
title: The race's start is a FIELD under the lights — stage the lights in the lab and probe every rival's per-frame snap through GO
date: 2026-10-02
scope: scripts/lib/skier-moves.mjs, scripts/skier-metrics.mjs, engine/game/place.ts
concepts: [moves, reproduction, start, rivals, snap]
---

`placeRun` drops the lights unless the moment asks for them (`lights`), so a
"start" move without it never stands in the gate; the `gate` move does. The
lab skis one skier, and the start's worst faults were in no move: the skid
pivot jumping at GO, a rival's first push begun mid-stroke (the start's
stride draw), and rivals leaving the gate stance a reaction before they
push (`inStartGate`). Fix the mid-stroke start in the VIEW (the arms eased
in over the drive's rise), never in the engine's draw: the field's runs
change, and in the benchmark's pinned race a rival then shouldered the
player off his only flight (`tests/benchmark_test.ts`). A throwaway probe that steps `createGame({ seed })`
with `botInput` for the player and runs `poseTravel` over every run's pose
from 2.5 s to 6 s found all three in seconds. Real numbers to hold the
start to: measured double poling has the trunk 40–45° over at the plant
and ~55° at the bottom, the elbow ~120° flexed at the plant and ~140° open
at release, the pole ~75° to the snow; V2 skating carries the hips ~44 cm
side to side over a flat gliding ski while the other pushes out and back
off its inside edge.
