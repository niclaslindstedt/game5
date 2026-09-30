---
title: --surface pause photographs the pause card WITHOUT its replay press — measure it over a real race
date: 2026-09-26
scope: pwa/src/game/menu-pause.tsx, pwa/src/styles.css, scripts/screenshot.mjs
concepts: [pause, height-budget, screenshots, replay]
---

`?paused=1` stands the card up before anything is recorded, so `canReplay` is
false and the WATCH REPLAY press is not drawn. That lab picture showed the
card fitting 844×390, while on a real phone, mid-race, it overflowed by a row.
To measure the card as a skier sees it, ski `?start=race` for a few seconds in
Playwright, press Escape, then read `.menu-card-pause`'s `scrollHeight`
against its `clientHeight`. Do it at 844×390 and at 667×375, the shortest
landscape phone.
