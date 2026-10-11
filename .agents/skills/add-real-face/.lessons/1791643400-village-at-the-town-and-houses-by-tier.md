---
title: Moving a face's village drags its bench, the hub and the buildings' fits with it — and one cap on real houses lets a town squeeze out the mountain
date: 2026-10-10
scope: engine/mapgen/massif.ts, engine/mapgen/hub.ts, engine/game/real-houses.ts, engine/game/cabins.ts, engine/game/cabin-site.ts
concepts: [village, town, houses, refusals, crust]
---

Leaning a face's `villageX` toward the real town was a one-line change and
cost a whole attempt a face until the refusals were counted: R29 "no skier
reaches C1" was the bench still computed off the DEALT village while the
placed one moved (`benchX` must follow `placed.villageX`), and R30 "W1
leaves the hub" was a valley station standing past the side ridges' inner
edge, which `planHub` now clamps to on a face. The pull toward the town
also yields a fifth an attempt (`real.town.yield`), so a face it cannot
build on falls back to the valley's lowest point instead of refusing to
the end. On the houses: a single cap ordered by size let a big town's
houses fill it and left 2 % of the mountain's huts and hotels stood; three
tiers (mountain first) fixed the order, and the rest were refused by the
FELL'S WIND CRUST folded into `packedAt` (read it out with `groomedAt`)
and by terrace limits a real house on its real slope always breaks (a
walk-out storey, `Fit.steep`). Measure the tiers apart: the all-faces
share hides the mountain under the towns.
