---
title: A behaviour-preserving engine speed-up is proved with a whole-Level bit hash and the sim digests, never levelDigest alone
date: 2026-09-24
scope: engine/
concepts: [performance, determinism, digest]
---

`levelDigest` rounds to centimetres and samples the ground only under checkpoints and lips, so a change that moves the last bit of the heightfield, the packed field or a tree passes it and still re-rolls a pinned map somewhere downstream. To prove a hot-path rewrite changes nothing, hash EVERY float of `generateLevel(seed, { region })` (walk the object; hash typed arrays by their bytes and numbers by their float64 bits), plus a spread of `groundAt` / `normalAt` / `nearestTrackPoint` reads, over the four regions and a tricks map. Run it on the working tree and again under `git stash push engine`, then diff. Do the same with `npm run sim -- --seeds 1,2,3 --rivals 3`: the table and its digests must match to the character. The two tricks that pass this are (1) reusing what a pure function already computed (a noise field's lattice corners, `sampleNoise`) and (2) skipping work only where a cheap bound PROVES it cannot change the answer (the square before `hypot`, braking room before a bend). Reordering float operations, or a `sqrt(a*a+b*b)` for a `hypot`, does not pass: the last bit differs about a third of the time.
