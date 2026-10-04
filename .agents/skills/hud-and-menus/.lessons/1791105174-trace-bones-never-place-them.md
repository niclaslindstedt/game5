---
title: The body's bones are traced and mapped by landmarks, never placed by eye — a hand-placed skeleton reads as wrong at once
date: 2026-10-04
scope: pwa/src/tools/anatomy-map.ts, pwa/src/game/body-bones.ts, pwa/src/game/body-figure.ts
concepts: [body-figure, anatomy, tracing, landmarks]
---

A first cut drew every bone as a capsule or polygon placed by eye, and it was rejected at a glance: the skull read as a smiley face, the chin sat 6 units above the man's real chin, and nothing matched a skeleton. What works is `make anatomy`. It traces each bone of `references/anatomy/skeleton-front.svg` (rendered one labelled group at a time, its pixels followed round) and lays it in by joint landmarks read off a GRIDDED render of both pictures. Its table then reports each bone's area outside the flesh. Seat a limb's joints on the skin's own midline — the outline's crossings at that height — not on a guess: wrists 1–1.4 units off pushed the radius through the skin. Judge the result on the `overlay` sheet, where the plate's own drawing of each bone is warped by that bone's map. A bone and its drawing that disagree is a bug in the map, not in the drawing.
