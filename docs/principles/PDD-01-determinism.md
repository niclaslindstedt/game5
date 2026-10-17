---
token: PDD-01
version: 1
title: A run is a pure function of its seed and its inputs
source: OSS_GAME_SPEC §25; tests/determinism_test.ts, tests/imports_test.ts
---

## Rule

The engine draws randomness only from `state.rng` and reads no clock but `state.t`. Anything that is presentation, or a system only some runs have (the wildlife, the crowd's looks, a dealt field, the grimbear), draws off a stream of its OWN, seeded by a salt off the map's seed, so no digest moves.

## Why

Replays, ghosts, the record book, the pinned maps and every lab's before-and-after rest on a run replaying to the bit.

## Prevents

A draw added to the shared stream silently changes every digest, every pinned run and every recorded ghost at once.

## Exceptions

None inside `engine/`. A change that MEANS to move the digests says so in its PR and re-cuts them deliberately.

## History

- v1 (2026-10-17): adopted from §25 and the "no digest moves" practice already cited across the tree.
