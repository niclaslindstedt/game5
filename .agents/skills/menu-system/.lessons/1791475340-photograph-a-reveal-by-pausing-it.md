---
title: A card's arrival animation is photographed mid-way by pausing document.getAnimations() at a time, never by sleeping to it
date: 2026-10-08
scope: pwa/src/title.css, pwa/src/game/title-logo.tsx, pwa/src/game/splash-screen.tsx
concepts: screenshots, animation, splash, logo
---

Under the software rasterizer a frame takes long enough that a sleep lands anywhere in a 600 ms beat, and `page.screenshot` itself can take seconds. To catch the title logo's reveal (`title.css`) at a known moment, wait for `.splash-title:not(.held)`, then `document.getAnimations().forEach(a => { a.pause(); a.currentTime = T })` — `currentTime` counts from the start INCLUDING each animation's delay — and `a.play()` afterwards. Read the frame against the easing, not the clock: the sweep's window is eased, so half its duration is most of its travel. For the settled frame, play everything and wait out the reveal in real time; the blinking prompt needs a `waitForFunction` on its opacity or it photographs on its off beat.
