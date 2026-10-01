---
title: Before tuning, make the lab reproduce the complaint — a move that skis it and a band that faults it — or the table stays green over the bug
date: 2026-10-01
scope: scripts/lib/skier-moves.mjs, scripts/skier-metrics.mjs
concepts: [metrics, bands, moves, reproduction]
---

"The knees bend up when turning" read 7 % at fault on the old table, because
no move braked a TUCKED turn at speed and no band asked whether a knee rose
past its hip. Adding the `skid` move (65 km/h, tuck held through the brake)
and the `kneeup` band turned it into 97 % at fault in one run; linked turns
(`turns`) likewise exposed a 0.54 m snap at every change of edge that no
single-turn move could see. Recompute the base's numbers under the new bands
(`git worktree add`, copy the metrics script and both libs in) so the before
is honest.

A band can also measure the right thing in the wrong frame: the back view
was taken along the TRAVEL, so a hockey stop — legs leaning across skis
thrown 50° across — read as no angulation at all. `frontal()` now reads
across the skis' mean turn; identical when they point down the way.
