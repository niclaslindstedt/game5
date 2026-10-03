---
title: The free ride's crowd is posed by skierPose — a change to the player's pose moves every amateur
date: 2026-10-03
scope: pwa/src/game/skier-pose.ts, pwa/src/game/crowd-rig.ts
concepts: [pose, crowd, morph-targets]
---

Every morph target the crowd's figures are drawn between (`crowd-rig.ts`'s
`INPUTS`: the stance, the tuck, a carve each way, the wedge as the gait's
splay, the hockey stop as the skid's pivot, a double pole's plant, the air)
is `skierPose` solved for that moment and sized to the body. So a change to
the stance, the tuck, the angulation or the strokes in `skier-pose.ts` reaches
three hundred amateurs as well as the player: run
`make crowd ARGS=--sheet=figures,moments` before and after, and
`tests/crowd_figure_test.ts` (it holds the crowd's joints to the player's).
A new input the pose grows that a target should carry is added to `INPUTS`
there, not hand-posed.
