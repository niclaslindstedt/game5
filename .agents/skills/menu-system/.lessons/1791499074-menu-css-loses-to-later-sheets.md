---
title: menu.css loads BEFORE styles.css, so a door rule at one class loses to any later sheet's sideways card block — prefix it with .menu-door
date: 2026-10-08
scope: pwa/src/menu.css, pwa/src/menu-pages.css, pwa/src/styles.css, pwa/src/campaign.css, pwa/src/main.tsx
concepts: css-cascade, front-door, viewport, height-budget
---

`menu.css` is imported ahead of `styles.css` on purpose: a page's own block there (`.menu-card-skis`, `.menu-card-start`…) restates the base `.menu-card` at one class and must win. The price is that every LATER sheet beats a one-class rule in `menu.css` too: `styles.css`'s `@media (orientation: landscape) and (max-height: 34rem)` block resets `.menu-card`'s padding and gap, and `campaign.css` carried a sideways `.menu-card-root { width: min(46rem, 100%) }` from the old tiled door — the redesigned door's column spanned the whole phone on its side and photographed fine everywhere else. Every front-door rule in `menu.css` is written `.menu-door .menu-card-root …` (and the slabs under it the same), which outranks both without touching their files. Check the door at `landscape` and `iphone` after any change to either sheet.
