---
title: The downhill's line-follower cuts a line swung round turning poles — read it closer
date: 2026-10-05
scope: engine/sim/downhill-steer.ts, engine/mapgen/super-g.ts
concepts: [super-G, line-follower, feed-forward, gates, sweep]
---

Fed the line's bend 0.3 s ahead (`DOWNHILL_STEER.lead`), the bot turned for
the next swing before this one's apex and crossed a super-G's gates 1.3 m
inside the line on the median, 3 m at the worst — a missed gate on a third
of the seeds. Measure the signed crossing of EVERY gate against the line
(outward positive) over sixteen seeds, not only the misses: the tail stays
put when gains move, and that names the structural gates (the first out of
the house at a crawl, a gate on a flight's landing). Half the lead and the
yaw lead (`SUPER_G_STEER`) took the median to 0.5 m; a firmer check made it
worse, as on the downhill.
