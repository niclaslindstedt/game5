---
title: A card frozen at a lab's time pauses EVERY animation on it at that time, counted from when its element arrived
date: 2026-10-08
scope: pwa/src/game/splash-screen.tsx, pwa/src/game/splash.ts
concepts: [splash, title-scene, url-params, screenshots]
---

`?titleT=<s>` holds the attract card and the title scene at one instant so two captures are one picture. The card does it in a layout effect run every render: for each `document.getAnimations()` whose target is inside `.splash`, `pause()` and set `currentTime` to the frozen time minus the beat its element arrived at (the logo at `TITLE_BEATS.logo`, the invitation at `.prompt`), and the reveal's phase is set straight from `revealAt(frozenMs)` with no timers armed. Without the offset, an element that mounts at its beat starts its own animation at 0 and the frozen frame shows it half-drawn.
