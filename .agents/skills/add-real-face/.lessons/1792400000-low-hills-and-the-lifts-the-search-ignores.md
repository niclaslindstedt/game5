---
title: The crop search ignores the lifts, and a low hill cannot pass the drop bar — check both before baking the hints
date: 2026-10-11
scope: scripts/real-faces.mjs, scripts/lib/real-face-crops.mjs, tests/real_faces_test.ts
concepts: [crop, search, drop, lifts, ids]
---

`--search` once ranked crops by drop and fall share alone, so its best
row could leave half the real lifts off the map (an area whose lifts
radiate off a dome) or put them all in the top quarter with the drop coming
from the valley below. It now fetches the lifts' ends round the middle off
the map API and weighs each row by the share of ends on the map and of
bottoms low on it (`lifts on`, `low`). Read those two columns before
taking a row: every end on the map, the bottoms low, then the best drop.

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
