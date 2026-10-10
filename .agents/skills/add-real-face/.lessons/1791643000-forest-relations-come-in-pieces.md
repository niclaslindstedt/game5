---
title: The map call clips a forest multipolygon to the box — fetch the relation whole, and key the cache by the crop
date: 2026-10-10
scope: scripts/real-hints.mjs, scripts/lib/real-face-forest.mjs
concepts: [hints, woods, osm, cache]
---

A bbox call to the editing API returns a forest relation but only the
member ways that touch the box, so its rings come back open and a scanline
fill of them paints stripes or nothing. `--fetch` now fetches every such
relation whole (`relation/<id>/full`, cached as `relation-<id>.osm`) and
the fill is even-odd over every ring edge, outer and inner alike, so a
clearing inside a wood stays open. The tiles were cached by face id alone,
so a re-cropped face silently read the old window's map; the file name now
carries a hash of the crop. Read the run's `wooded`, `line m` and `bands`
columns: a face hardly wooded where the real mountain is (one far-north
face, two high alpine ones whose floor is over the tree line) falls back to
the region's row under 1 %, which is right for the first and wrong-looking
for the others — say so in the PR rather than invent a line.
