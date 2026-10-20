---
title: Setting c.heading (or a sled's heading) on a staged run that is then STEPPED does nothing — the physics reads the heading off q; stand him with standSkier / standSled / placeRun
date: 2026-10-20
scope: tests/support/, engine/game/course.ts, engine/game/sled.ts
concepts: [staging, heading, sled, test]
---

`tests/support/body-hits.ts` sets `c.heading = 0` and calls `clipCrowd` / `meetFoot` directly, which read the field as set. A stage that then runs `step()` gets the heading re-derived from `c.q` (and `s.q` on the snowmobile) on the first step: the skier went down the seed's +z at 24 m/s with his skis pointing 70° off it, so a footprint read along the heading met a body lying on his line at a third of the closing speed. Stand him with `standSkier` / `placeRun` (or `standSled` and set `vx`, `vz`, `treadSpeed`), along the spawn's own heading, and lay what he must meet down THAT line (`tests/support/lying.ts`). A piste machine stepped by `step()` drives its own plan; to drive one at a target, move it by hand and call the meeting alone (`stepOnce` there).
