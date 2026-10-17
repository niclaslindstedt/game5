---
token: PDD-06
version: 1
title: Every word the player reads lives in a strings table
source: OSS_GAME_SPEC §39.1, §39.2; pwa/src/game/strings.ts
---

## Rule

No user-visible string is a literal in a component. It is a key in `strings.ts` or one of its `strings-*.ts` tables, and a composed line is a template function, never concatenated at the call site.

## Why

A line can be fixed in one place, and a second language is a second table rather than a rewrite.

## Prevents

Wording that drifts between the HUD and a card, and translations that cannot be done.

## Exceptions

Developer diagnostics.

## History

- v1 (2026-10-17): adopted from §39.1.
