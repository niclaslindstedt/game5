---
title: A re-cut ladder that keeps its ids owes a new board key, a stamp on the cloud's board, and seeds the old record book never named
date: 2026-10-03
scope: pwa/src/game/campaign-levels.ts, pwa/src/game/campaign.ts, pwa/src/game/cloud-save.ts, pwa/src/game/records.ts
concepts: [recut, progress-key, cloud-save, record-book, curation]
---

Moving every map onto a new generator kept the shelves' ids (`rime-1` …),
so three stores would have put old results on new maps. The board is keyed
by id: bump `PROGRESS_KEY`. The cloud save carried the board with no ladder
on it, so a board synced in from another device merged straight back in by
id: it now carries `ladder` and a board is read only when that matches. The
record book names a row by mode, seed and course only (`recordId`: no
region, no version), so re-pinning the SAME seed and course numbers on a
new generator inherits an old time for a different map. Pick seeds the old
ladder never used (the old Cold Crest's seed 16 offered the hardest blacks
and was passed over for exactly this).

The curation itself: sweep `make resort COUNT=40 REGION=…` and filter on
the COURSE colour columns (`cG cB cR cK`), not the run columns; then ride
every course of a candidate with the bot. A course the bot does not finish
cannot be a rung (seed 77's first black), which is how the last shelf
ended at four blacks, not five. When two rungs sit level, a `sky` laid over
one is the cheap fix, but price it first: flat light only moved a black by
0.012 where falling snow moved it 0.029 (the weather axis is not linear in
`skyWeight`). Rate a course under every sky in one pass rather than
re-running the whole audit per guess.
