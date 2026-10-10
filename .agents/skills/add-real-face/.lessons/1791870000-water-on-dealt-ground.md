---
title: A real lake's level is not the map's — lay it at the median of the map's own ground, and drop what would need a crater
date: 2026-10-10
scope: engine/mapgen/real-water.ts, scripts/lib/real-face-water.mjs
concepts: [hints, water, ground, massif]
---

The map's ground under a face is the dealt massif's profile with the real
relief laid over it, tamed (`massif.ts`'s `faceLift`), so the flat bench a
real tarn sits on is often not there. The first pass set each body at the
map's ground where its real shore is lowest (its outlet) and flattened to
that: a big valley lake stopped a face building at all, another took twice
the attempts, tarns were cut 100 m into the slope, and the hub and the
bottom stations stood on the ice. What held: the surface is the MEDIAN of
the map's ground under the body (dug above as far as it is banked below),
a body needing more than 15 m either way is left off, the feather grows
with that spread (10–20 m), and a body reaching onto the valley floor's
rows (where the hub, the bottom stations and the tunnels go) is cut along
them and marked `clipped`. Measure a change here with the attempts per face
and with what WOULD stand in the water with the guard off — a station on a
lake shows up there long before it shows in a picture. A station's pad cut
and a run graded across a body still move the ground under it; the suite
leaves those corridors out of the flatness check.
