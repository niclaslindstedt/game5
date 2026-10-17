---
token: PDD-02
version: 1
title: The engine knows nothing above it
source: OSS_GAME_SPEC §23.7; tests/imports_test.ts
---

## Rule

`engine/` imports only itself and the framework's `core/*` and `racing/*`. The renderer reads `GameState` and never writes it. Only `pwa/src/shell-host.ts` knows a platform shell exists.

## Why

The simulation must run headless (the suite, the bot, every pure-Node lab) and survive a renderer or shell being replaced.

## Prevents

A rule that works only with a browser open, a test that needs a GPU, and state changed by whoever drew it last.

## Exceptions

None. A feature a shell needs is a feature the website needs first.

## History

- v1 (2026-10-17): adopted from §23.7.
