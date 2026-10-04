---
title: Lay the class's published three-view over orthographic stills of the model — proportions read off a photograph by eye came out a metre wrong
date: 2026-10-04
scope: scripts/blender/heli.py
concepts: [references, proportions, silhouette, orthographic, judging]
---

The helicopter's first pass was proportioned off photographs and read as a
toy: an egg-shaped cabin, the nose rounded over the wrong length, the tail
rotor 0.7 m too far aft and the fin 0.9 m too low. A manufacturer's
three-view (side, top, front, with dimension lines) rasterised with
`pdftoppm -r 300` gives a scale off any stated dimension; three ORTHO
cameras in the builder at a round 100 px/m (`oside`, `otop`, `ofront`, the
nose at a fixed pixel) let ImageMagick scale and crop the drawing onto the
render (`-resize X%xY%!`, `-crop`, the lines `-negate -threshold` into an
alpha over a colour the paint is not) — every profile, window and door
line then reads as a gap you can measure, not a guess. Photographs stay the
judge of colour, finish and detail; the drawing is the judge of shape. Both
stay in the scratchpad, never named.
