---
title: Anything the runs must keep off has to be known before they are walked — a pass after them can only move it, and a long line often cannot move far enough
date: 2026-10-03
scope: engine/mapgen/station-clear.ts, engine/mapgen/resort-build.ts
concepts: [stations, drags, footprints, retries, order]
---

The lifts were planned before the runs were walked and nothing read them
against the runs afterwards, so 47 of 121 bottom stations and 24 drags stood
on or crossed a piste. A clearance pass after the runs fixed the bottoms (a
slide across the line), but the nursery drag kept failing: its greens start
at its own top and snake ±50 m about the fall line all the way down, so no
600 m line beside them exists. The cure that worked was earlier — the run
STARTS keep their corridor (half their width, not the centre line) off every
station already standing — plus re-laying a drag with its foot free to move
up its own line. Measure the retries (`setDebugEnabled` + an output sink
filtering "refused") on 24 seeds before and after any new rule: each one is a
whole attempt rebuilt, and this one cost ~1.9× build time.
