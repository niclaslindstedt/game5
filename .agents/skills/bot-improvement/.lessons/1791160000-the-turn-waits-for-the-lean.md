---
title: Under the lean-coupled edge the way turns ~0.3 s after the edge — plan on a slip model, the check jointly, and leave room for the crossing in the speed
date: 2026-10-04
scope: engine/sim/slalom-plan.ts, engine/sim/turn-model.ts, engine/sim/bot.ts, engine/game/race-line.ts, engine/game/par.ts
concepts: [bot, slalom, incline, slip, check, planner, speed, chaos]
---

After `incline.ts` coupled the edge to the lean (edge ≤ |incline| + 34°, the
cross-over gated by the old turn's load), a model where the path bends with
the edge at once was off by metres: the skis point 5–11° inside the way in
a turn, so after an edge change the way keeps turning the old way until the
skis' heading (turning at v·κ of the edge it can have) has swung through it.
What predicts the engine (0.15–0.2 m over 0.6 s; `turn-model.ts`): the yaw
at the carve's rate less `slipHold/yawHold`·slip, the snow's grip
`0.7 × cornerGrip · tanh(v·sin(slip + pivot)/sideRef)`, the lean a 0.25 s
lag toward `inclineTarget`'s rule. The CHECK is the biggest single error: a
brake with the steer over pivots the skis that way (`skidAngleAt`) and
turns him hard — model it, and weigh the check asked for against none in
the plan. Speed is the lever that finishes courses: at the old pace every
run failed; `lineSpeed` (the turn left after `cross` s of crossing, the par
reads it too) and a steer-change cost (a racer commits) took 30/30. The
planner is fragile to its horizon: `slalomReach` 7 m worked, 9 m failed all
thirty — the far end of a long plan is model error the cost obeys. A
tighter `slalom.bend` (8–9 m) moved the bot's turns by only ~0.5 m and 2° of
edge and cost 2–3 runs in thirty: the bot is crossing-limited, not
line-limited.
