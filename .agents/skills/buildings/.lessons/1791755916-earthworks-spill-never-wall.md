---
title: Drawn earthworks spill to the snow round them; walled down to it they stand as cliffs where the ground falls
date: 2026-10-11
scope: pwa/src/game/ski-jump-arena.ts
concepts: [earthworks, terrain, aerial-view]
---

The ski jump's counter-slope is drawn, not ground (ground would move the
mode's digest), and its first cut walled its ends and back straight down to
`groundAt − 0.5`. Past the out-run the snow falls some 10 m, so from the air
the bank's corners stood as grey cliffs throwing long shadows. A drawn bank,
berm or terrace reads as snow only when its height function SPILLS off its
edges (`own − spill × distance past the edge`, about 0.8 a metre) and is
clamped to just under the ground (`max(own, ground − 0.3)`), quads wholly
buried skipped. Always look at the aerial view of a drawn earthwork: the
broadcast and close views hide its back.
