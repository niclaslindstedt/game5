---
title: Taking a tile off a card orphans its STRINGS keys — hud_test fails until they are deleted where they are defined
date: 2026-10-08
scope: pwa/src/game/menu-main.tsx, pwa/src/game/strings.ts, tests/hud_test.ts
concepts: strings, front-door, tests
---

`tests/hud_test.ts` holds that every `STRINGS` key is read somewhere in the app's source. Dropping the CAMPAIGN tile from the door left `menuCampaignLine`, `menuCampaignNext` and `menuCampaignDone` (in `strings-campaign.ts`) unread, and shrinking STATISTICS to a small button left `menuStatsTop` unread: the suite went red on the first of them only, so grep every `STRINGS.<key>` the removed markup used (`grep -rl "STRINGS\.<key>\b" pwa/src`) and delete each one nothing reads any more, in the sheet that defines it, in the same change.
