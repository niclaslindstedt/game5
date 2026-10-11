---
title: A second way of riding is a second figure a body, and a deal that shifts the crowd's stream breaks tests that sampled one moment
date: 2026-10-11
scope: engine/game/crowd-deal.ts, pwa/src/game/crowd-board.ts, pwa/src/game/crowd-view.ts, tests/crowd_test.ts
concepts: [snowboard, morph-targets, determinism, tests]
---

The snowboarders could not share the skiers' morph targets: a relative morph
needs every target to be the same mesh, and the board has no poles and one
plank where the skis had two. So they are a figure of their own a body and
cut (`buildCrowdFigure(body, lod, true)`), with their own target list, held in
a view slot keyed `body:gear:lod`. A slot is built only for a body somebody
rides that way, which keeps the extra draw calls to what is on the snow. Two
more things:

- The board share is drawn off the crowd's own stream, so every later draw
  moves. A test that sampled the crowd at one moment (a chair rider held to
  `ropeAt`) began to catch a rider inside a terminal, where the engine places
  him by `carrierGripAt`. Hold such a test to the function the engine uses.
- An inclination that reads right on the player's rider looks far too
  laid-over on a far, small amateur. The crowd's toeside carve is 0.58 rad,
  not the player's 0.8. Check it on the `boarders` sheet's side column.
