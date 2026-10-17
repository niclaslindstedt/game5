---
token: PDD-05
version: 1
title: A pinned map moves by a version row, never a new digest
source: engine/mapgen/versions.ts; tests/race_maps_test.ts, tests/trick_maps_test.ts
---

## Rule

A generator change that moves what a seed builds adds a row to `versions.ts` that keeps the old behaviour as a trait. A pinned map's digest is rewritten only when the map is deliberately moved.

## Why

A pinned map was curated, rated and raced; every best time on it is a result on that exact piste.

## Prevents

The silent re-roll: seed 38 stops being the map that was rated, everywhere at once, and the record book keeps times for a course that no longer exists.

## Exceptions

A map deliberately re-picked, with `make rate` and `make difficulty` in its PR.

## History

- v1 (2026-10-17): adopted from the generator-version contract.
