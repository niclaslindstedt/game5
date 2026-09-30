---
title: A generator change that moves maps rides a JumpTraits-style trait, and every new draw is kept off the main stream
date: 2026-09-24
scope: engine/mapgen/versions.ts, engine/mapgen/terrain.ts, engine/analysis/
concepts: [versions, determinism, campaign, rng-order]
---

The campaign pins v1, so a rules change is a new row plus a legacy trait on
v1 read at each place the behaviour differs — INCLUDING the analysis, or a v1
map is held to the new bands and silently re-rolls. Two traps met: an object
literal's property order IS the draw order (hoisting `seed()` calls above the
`inBand` draws in `planTerrain` moved every v1 map), and a new feature that
needs noise can hash its seed off an existing one rather than draw (the
rollers), while a placed feature takes a salted stream of its own (the
cliffs, like the drifts). `tests/generator_version_test.ts` is the proof.
Also: seed-pinned things OUTSIDE the campaign (the benchmark's seed 39, a
wildlife test's map) move with the rules and need re-sweeping.
