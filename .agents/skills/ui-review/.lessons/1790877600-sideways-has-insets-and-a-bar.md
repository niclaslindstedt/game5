---
title: 844×390 with no insets hid every card's overrun — judge cards at `iphone` and `iphone-browser`
date: 2026-10-01
scope: scripts/screenshot.mjs, pwa/src/styles.css, pwa/src/menu.css, pwa/src/game/menu-main.tsx
concepts: [viewport, safe-area, height-budget, screenshots, cards]
---

The `landscape` viewport has no safe-area insets and the full 390 px of
height. A real notched phone on its side loses 59 px to the notch on both
long edges. In a browser it also loses about 50 px to the bar along the top.
At that size the front door's chips, the ski card's SKI and the free ride's
chart all sat below the fold, while the 844×390 pictures looked clean.
Chromium can emulate the insets (`Emulation.setSafeAreaInsetsOverride` over
CDP), and the harness now does: `--viewport iphone,iphone-browser`. Each
card capture prints what scrolls, so read that line, not just the picture.
