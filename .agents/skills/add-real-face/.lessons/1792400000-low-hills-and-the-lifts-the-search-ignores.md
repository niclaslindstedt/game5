---
title: The crop search ignores the lifts, and a low hill cannot pass the drop bar — check both before baking the hints
date: 2026-10-11
scope: scripts/real-faces.mjs, scripts/lib/real-face-crops.mjs, tests/real_faces_test.ts
concepts: [crop, search, drop, lifts, ids]
---

`--search` ranks crops by drop and fall share alone, so its best row can
leave half the real lifts off the map (an area whose lifts radiate off a
dome) or put them all in the top quarter with the drop coming from the
valley below. Before the hints, pull the lifts' ends round the middle off
the map API and turn them onto the crop with `mapAt`: every end on the map,
the bottoms low on it. Among the rows with every lift on the map, take the
best drop. A score that weighs the lifts belongs in `--search` itself.

The suite holds a face to 250 m between its ridge row and its floor row
across the playable width. A ski area of under about 300 m of vertical in a
4 km window rarely clears it. In one batch, seven low hills failed it at
every crop that keeps their lifts. A face that clears the bar can still
fail to build: one never walked more than three pistes down in 32
attempts. Run the build measure on four seeds before committing to a face.

Dropping a face from the middle of a batch renumbers the ones after it.
The hints' index imports every listed id, so the bake fails to start until
a file exists for each one. Copy any hint file to the missing ids, bake
`--write`, then delete the stale one.
