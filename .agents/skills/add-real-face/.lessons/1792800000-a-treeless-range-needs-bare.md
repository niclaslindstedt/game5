---
title: A high, dry range grows no trees, but its region's tree line in metres stands a wood on it — mark the crop bare
date: 2026-10-12
scope: scripts/lib/real-face-crops.mjs, scripts/real-hints.mjs, tests/real_faces_test.ts
concepts: [woods, tree-line, crop, regions]
---

A face whose map draws no forest takes its region's tree line in metres.
That is right for a high alpine face, whose floor stands over its region's
line. It is wrong for a high, dry range whose floor (2,200–2,800 m) stands
under the continental line (3,000–3,500 m) but which grows no tree at all:
the first build stood 60,000 trees on its lower slopes. A crop row's
`bare: true` tells the hints' bake that no forest on the map is no forest
on the mountain; it writes the tree line at the face's lowest sample and
every band at nought, so the face stands none and only the index moves.
Check `trees` in the resort lab's first line for every new face whose
`wooded` column reads 0.00.

Three ski areas a few kilometres apart can take two faces at most: keep
the crops' middles 4 km apart and file them as two AREAS. As parts of one
area their markers 5–6 km apart failed `world_map_test`'s 40 px on the
area step, as the lesson on parts standing apart says.
