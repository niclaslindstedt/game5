---
title: An animation that "isn't smooth" is found by reading it layer by layer at the renderer's frame rate, then proven by taking one stage or one input out
date: 2026-10-05
scope: scripts/lean-lab.mjs
concepts: [motion, smoothness, ablation, interpolation]
---

The slalom lean read smooth in the engine (the incline: one swing a turn, under 3 % of
its rate's power above 5 Hz) and in the view's spring (the eased roll), and rough in
every drawn part (the trunk 18–24 %, the head 15–30 %, three turning points a turn).
No drawing stage taken out (`--without`) moved it; easing ONE pose input — the raw
engine `roll` the pose is handed beside the spring's eased one — took the trunk's
shiver from 0.90° to 0.58° and its 90 ms lag away. Drawn at 144 Hz rather than 60
the head's roughness went from 15 % to 72 %: a per-step value mixed into a frame
drawn between steps is a staircase. Neither shows in a still, nor in a lab that poses
the engine's steps directly — feed the run clock frame times, interpolate as the
renderer does, and rank the pose's inputs by their own roughness before guessing.
