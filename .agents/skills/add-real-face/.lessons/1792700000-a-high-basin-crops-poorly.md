---
title: A ski area in a high basin crops poorly, and the face index outgrew the line cap at a hundred faces
date: 2026-10-12
scope: scripts/real-faces.mjs, scripts/lib/real-face-files.mjs, engine/mapgen/real-faces-index.ts
concepts: [crop, search, drop, file-size]
---

An area whose lifts radiate up out of a village standing in a high basin, with a long gondola from the valley below, has no one face that falls down a 4 km window. The search's best rows fell 0.70 of the face against 0.84–0.99 for the others of the batch, and moving the middle onto the steepest single face or dropping the lift weighting (move the lifts file out of `previews/.osm/` and search without `--fetch`) did no better. Keep the best row that holds most of the lifts, and say in the PR that the face is the batch's weakest rather than crop it off the ski area.

The face index is ten lines a face, so it passed `tests/file_size_test.ts`'s 1000 lines at the hundredth face. The writer (`writeFaceIndex`) now puts the large-file marker in the generated header; a fix to a generated file is a fix to its writer and a re-run of `make real-faces ARGS=--index`. The hints' index is about a third the size and will reach the cap near three hundred faces.

The batch's measure used a run's points within 40 m of a real piste for `near`, and for `colour` a run counted as laid on the real piste that holds a quarter or more of its points. With the half the earlier batches' wording suggests, almost no run on a face counts, because the real pistes there are many short pieces.
