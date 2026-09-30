---
title: App.tsx sits at the 1000-line cap — a new card or press goes into a factory or the card router, not App.tsx
date: 2026-09-25
scope: pwa/src/App.tsx, pwa/src/game/pinned-run.ts, pwa/src/game/menu-pinned.tsx
concepts: [app, file-size, cards, presses]
---

Adding the trick map card put `App.tsx` 40 lines over `tests/file_size_test.ts`'s
cap. What fitted: the press went into `pinned-run.ts`'s factory (it already
holds the loader, the skier and the run on the snow), the card into
`menu-pinned.tsx`'s router beside the campaign and level cards, the pick into
`campaign-app.ts` beside `choose`, and plain helpers into the DOM-free module
(a `.tsx` cannot be imported by the root suite — `tsc` has no `--jsx`).
