---
title: A worked move whose weights fall to zero between strokes snaps to the stance's tool — give the rest its own target
date: 2026-10-08
scope: pwa/src/game/civilian-moves.ts, pwa/src/game/civilian-shapes.ts
concepts: [civilians, morph-targets, props, animation]
---

The shovel's cycle weighted its scoop and its toss and let both fall to zero
for the pause, meaning "stood leaning on it". But a morph's zero weight is
the BASE mesh — the stance — and the stance's tool is built `hold` (upright
in the right hand), so every pause the blade jumped from the snow in front to
upright at his side. A prop's placement is part of each target, so a rest
that must keep the tool where the work left it is a target of its own
(`shovel2`, `tool: "work"`, the blade on the snow in front), and the cycle's
weights must sum to one over work targets the whole way round. Check any
cycled chore for the same gap: strobe it on `make civilians ARGS=--sheet=moves`
and look at the frames between strokes.
