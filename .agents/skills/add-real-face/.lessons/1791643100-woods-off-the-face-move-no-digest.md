---
title: Real woods ride the always-loaded index and only face maps read them — make sim before and after is the proof
date: 2026-10-10
scope: engine/mapgen/real-face.ts, engine/mapgen/massif.ts, engine/mapgen/resort-woods.ts, engine/mapgen/real-hints-index.ts
concepts: [woods, tree line, digest, size budget]
---

Nine bytes a face (the line as a share of the face's own relief, then eight
height bands of cover) fit in the index the bundle already carries, so no
hint or height file moves and a face's woods are known before it loads.
The tree line on a face is the real line lifted and stretched as the face
itself is (`(line − floor) × stretch` over the altitude), and the cover only
SCALES the region's keep and close (`faceWoods`, never below a fifth) —
every draw off the stream stays where it was, so the eight sim digests
came out identical. A test needs `faceWoods` and the band count through
`@engine`: `tests/imports_test.ts` refuses a test that reaches into
`engine/mapgen/*` directly, so export what the test needs from the barrel.
