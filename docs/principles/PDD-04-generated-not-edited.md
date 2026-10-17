---
token: PDD-04
version: 1
title: Generated output is regenerated, never hand-edited
source: OSS_GAME_SPEC §24.3; AGENTS.md "The role map, and what is generated"
---

## Rule

A generated artifact (the models, the title plates, the real faces and hints, the body model, the sky table, the map routes, the world outline, the CHANGELOG) is changed by changing its source and re-running its generator.

## Why

The next regeneration wipes a hand edit, and the stamp tests compare an artifact against its sources.

## Prevents

A fix that vanishes on the next `make models`, and a drift guard that fails for reasons nobody can trace.

## Exceptions

None. If the generator cannot express the change, the generator changes.

## History

- v1 (2026-10-17): adopted from §24.3.
