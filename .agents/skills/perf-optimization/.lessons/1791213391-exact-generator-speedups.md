---
title: The generator is sped up bit for bit by stopping a scan at a proved bound, asking pure predicates cheapest first, and testing a box before a hypot
date: 2026-10-05
scope: engine/mapgen/
concepts: [performance, determinism, mapgen, spatial-index]
---

Every pinned map's digest stands on the generator, so its speed-ups must change no float (the whole-Level hash in `write-code`'s lesson, over every version and region). Four moves passed that proof and took a free ride's map from ~4.6 s to ~3.0 s in Node:

- **Stop a ring scan at the real border.** `NetIndex.nearest` stopped once the best hit was nearer than `ring * CELL`; the square scanned so far reaches `ring * CELL` PLUS the point's distance to its own cell's nearest side, and nothing unscanned lies inside it (a segment is filed in every cell its box touches). Stopping there, less a 1e-6 m slack, and as soon as that border passes `within`, never turns away a segment the arithmetic would take.
- **Ask the caller's `skip` after the distance test.** A segment no nearer than the one held is never taken whatever `skip` says, and every `skip` there is pure, so it is asked of a handful of segments, not thousands.
- **Hoist what one axis decides.** `bakeMassif` reads the descent, the four profile tables, the folds' fade and the side ridges' opening once a row (`massifRow`) — the same expressions, so the same bits.
- **Box before hypot; cheap before dear.** `hypot(dx, dz) < r` is false whenever `|dx| >= r` or `|dz| >= r` (the framework's hypot is never under its larger leg), so the box test is exact. A pure boolean built of `&&`/`||` checks may be reordered cheapest first (`clearBottom`'s level before its run search, `clearDrag`'s rise and pitch before its piste walk).

What does NOT pass: `stampRun` keeps each cell's distance in a `Float32Array` and compares a float64 against it, so a cell's answer depends on the ORDER its segments arrive in. Pruning far segments there is exact only outside a few-micrometre window, so it was left alone.
