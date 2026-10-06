---
title: A knob added beside the reference must hand the reference row back untouched — prove it by diffing the labs against a worktree of main
date: 2026-10-03
scope: engine/game/defs/riders.ts, engine/game/defs/skis.ts
concepts: [digest, determinism, rider, reference-pair]
---

A variant of a pair (the rider's build, `withRider`) is a NEW object off the row; the reference variant must return the row ITSELF, and every new multiplier must be exactly 1 there (`x * 1`, a share of `m / (m + m)` = 0.5, `(a / b) / (a / b)`), never a re-derivation that is merely close — a last-bit difference moves every digest. The cheap proof: `git worktree add /tmp/base HEAD`, symlink `node_modules` into it, run `node scripts/ride-lab.mjs --no-png` and `node scripts/simulate-run.mjs --rivals 3` in both trees, and `diff` the outputs minus the header line — byte-identical means no digest, pinned map or ghost moved. Rivals sharing a shoulder by weight: use `skierMass`, not `totalMass`, or two medium riders on different pairs (different `gearMass`) stop splitting it evenly and the race digests move.
