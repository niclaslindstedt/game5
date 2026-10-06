---
title: Riding real lifts takes minutes — size the crowd for a third of it on the lifts, and deal riders at the start
date: 2026-10-03
scope: engine/game/crowd-lift.ts, engine/game/defs/crowd.ts
concepts: [lifts, queue, carriers, population]
---

With the old 12–45 s stand-in ride the snow kept nearly the whole crowd; on
real carriers (a 1.9 km chair at 5 m/s is over six minutes) two thirds of a
lapping crowd ends up queueing or riding and the pistes emptied within five
minutes. Count the modes every 30 s over a five-minute free ride before and
after any lift change. Two fixes held the snow at main's level: `CROWD.count`
up to 400 and a share of groups dealt already RIDING mid-line (the chairs
full from the first frame), with shorter lifts favoured. Also: two groups
dealt onto lifts can pick the same carrier — always seat into its free places
(`taken`), never assume a carrier is empty.
