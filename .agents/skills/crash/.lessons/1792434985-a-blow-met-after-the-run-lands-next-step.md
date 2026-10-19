---
title: A blow found after the player's run (the crowd, the field) must be dosed on the NEXT step's stepBody, or gore never sees it
date: 2026-10-19
scope: engine/game/body.ts, engine/game/person-hit.ts
concepts: [body, gore, step-order, crowd]
---

`clipCrowd` runs in `step.ts` after `stepRun`, and so after that step's
`stepBody` and `stepGore`. `feelBumps` doses a shoulder there and judges it,
which files injuries — but `body.ts` clears every dose at the top of the
next `stepBody`, so `gore.ts` (which tears and opens off THIS step's doses,
`doseOn`) never reads a blow dosed that late. A whole-body collision with a
person is therefore FILED (`CrowdState.struck`, `dosed: false`) and struck
on him a step later inside `stepBody` (`personBlows`, beside the beast's),
where the ladders and the wounds both judge it. A test that reads the body
straight after `clipCrowd` must step once first.
