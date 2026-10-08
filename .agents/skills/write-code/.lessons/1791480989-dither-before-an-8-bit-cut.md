---
title: Dither a rendered gradient by one step before cutting it to 8 bits, or a soft sky bands into stripes tens of pixels wide
date: 2026-10-08
scope: scripts/blender/title_plates.py
concepts: images, quantisation, banding
---

A path-traced sky or haze gradient spanning a few percent of brightness across hundreds of pixels lands on a dozen 8-bit levels, and the steps read as stripes in the published WebP. Add a triangular noise of one step (`(u1 - u2) / 255`) before the cut (`_webp(..., dither=True)` for the colour plate); never dither a DATA channel (depth, masks) that a shader reads as numbers.
