---
title: Re-pinning keeps the record book's rows — pick seeds and courses it never named
date: 2026-10-03
scope: pwa/src/game/race-maps.ts, pwa/src/game/trick-maps.ts, pwa/src/game/records.ts
concepts: [recut, record-book, curation]
---

The record book names a row by mode, seed and course only (`recordId`: no
region, no version), so re-pinning the SAME seed and course numbers on a
new generator inherits an old time for a different map. When moving a set
of pinned maps onto a new generator, pick seeds the old set never used.

The curation itself: sweep `make resort COUNT=40 REGION=…` and filter on
the COURSE colour columns (`cG cB cR cK`), not the run columns; then ride
every course of a candidate with the bot. A course the bot does not finish
cannot be pinned. When two maps sit level, a `sky` laid over one is the
cheap fix, but price it first: flat light only moved a black by 0.012 where
falling snow moved it 0.029 (the weather axis is not linear in
`skyWeight`). Rate a course under every sky in one pass rather than
re-running the whole audit per guess.
