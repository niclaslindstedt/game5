---
title: Place names live in three files only — the region scan finds a range's name in a doc as quickly as a brand
date: 2026-10-10
scope: tests/region_test.ts, docs/real-faces.md, scripts/lib/real-face-crops.mjs, pwa/src/game/strings-ranges.ts
concepts: [naming, places, docs, ordering]
---

`tests/region_test.ts` scans every file but the crop rows, the generated
face index and `strings-ranges.ts` for the places the rows name, and a doc
that counts faces under a country's or a range's own name fails it like a brand
would. Count by range in words ("the three Nordic countries", "the range
across borders in the middle of Europe") and keep the skip list exactly
those three files. The card's order is a walk off the index's latitude and
longitude (most northerly first, then the nearest left), taken over every
face whatever the grade so a filter never reorders what stays; printing it
once through a throwaway vitest file was the quickest check, since
`face-picks.ts` imports `@engine` and plain Node cannot resolve it.
