---
title: Time a pinned map's build cold before pinning it — one seed took 27 s
date: 2026-10-05
scope: pwa/src/game/race-maps.ts
concepts: [race maps, curation, loading, generator attempts]
---

A super-G candidate rated well, finished clean and took 27 s to generate in
a fresh process (seven rejected attempts): a loading card no player waits
through, and half a test file's minute. A sweep that primes the resort
cache hides it (the second build is 1 ms). Build every shortlisted seed cold,
on its version, course and grade, before writing its row. Race maps are
campaign-shaped rows (`CampaignLevel` with a discipline's mode), so the
level card, the record book, the routes and `make rate RACE=…` read them
unchanged.
