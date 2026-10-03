---
title: A player-only run switch (damage, poles) is threaded through a dozen places — follow the damage switch's trail
date: 2026-10-03
scope: engine/game/step.ts, pwa/src/App.tsx, pwa/src/game/replay.ts, pwa/src/game/ghost-run.ts
concepts: run-options, settings, replay, ghost
---

A switch only the PLAYER's run carries (the damage switch, the poles) lands
on `createGame`'s options and from there on the state — a per-skier one on
`SkierState` beside `resilience` (`freshSkier` gives every rival the default,
so the field never sees it). The app then has to hand it over EVERYWHERE a
player's run is stood up, or one door quietly skis the default: App.tsx's
`playerGame`, the free ride (`freeGameOptions`), the link-booted race and its
fallback (`raceOrFallback`), the campaign and level card (`PinnedSkier`), the
trick maps (`TrickSkier`), the pause card's START AGAIN (`pinned.again`,
`freeAgain` — both replay the options they were built with), the REPLAY's
recipe (`recipeOf`, read off the state) and the GHOST (a tape skied on the
other setting rides off its line — either seal the switch onto `GhostRun` or
keep no tape, as damage does). App.tsx sits at the 1000-line cap: build the
skier once (`skierOf`) and spread it, rather than adding a field per site.
