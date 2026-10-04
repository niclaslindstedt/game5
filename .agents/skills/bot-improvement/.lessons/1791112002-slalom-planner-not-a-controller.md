---
title: The slalom wants the forward-search planner, not a feedback controller — and its line must cross a closed gate clearly
date: 2026-10-04
scope: engine/sim/bot.ts, engine/mapgen/slalom.ts
concepts: [bot, slalom, controller, closed-gate, straddle]
---

Two preview/feedback controllers on the slalom's racing line (feed-forward
of the line's bend plus heading and offset terms) both lost the line within
a few gates: one fed the yaw rate (shaken step to step by the yaw hand) back
into the edge and chattered at the step rate; the other lagged and cut
inside the first turning pole. The search planner (`slalomSteer`: two-stage
edge choices skied forward on a model of the skis as the technique works
them, the gate's side penalised) tracks within ~0.2 m. Its failures were
at VERTICALS: the racing line crossed each closed gate only ±0.25 m either
side, and a skier 0.3 m late crossed past the foot pole — a straddle or no
crossing at all. A closed gate judged in the planner at its foot pole, and
the line swung ±0.5 m (`LINE.across`), took 16 of 16 seeds through.
