---
title: A contact sheet photographed by element is still clipped at the page's viewport — size the viewport to the sheet
date: 2026-09-23
scope: scripts/skis-preview.mjs, scripts/helmet-preview.mjs
concepts: [screenshot, playwright, contact-sheet]
---

`locator('#sheet').screenshot()` on a 1600×1200 page cut a six-row sheet at
1200 px and filled the rest dark, and a `--cell=700` sheet was cut at the
3200 px the skis lab opens at. The cure that holds for any size: after the
page draws, `page.setViewportSize` to `#sheet`'s `boundingBox()`, then
photograph (`scripts/helmet-preview.mjs`) — a canvas made with
`preserveDrawingBuffer` keeps its pixels through the resize.
