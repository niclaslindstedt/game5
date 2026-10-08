---
title: A view with a still fallback must FAIL its lab when the fallback is what drew — and the lab must print warnings, not only errors
date: 2026-10-08
scope: scripts/title-preview.mjs, pwa/src/game/title-stage.tsx
concepts: [title-scene, fallback, swiftshader, browser-lab]
---

The title stage shows the bare colour plate as a poster on any failure, a shader that will not compile included, and warns rather than throws. A lab waiting on `.title-canvas[data-drawn], .title-poster` photographed the poster for a whole tuning round, and its pictures looked plausible enough that a broken shader (a local named like another in scope — GLSL `redefinition`) was "tuned". `make title` now throws when `.title-poster` is in the DOM and collects console warnings. Also: under SwiftShader the front door over the live race draws about one frame in 1.5 s, and CSS arrival animations advance only on frames, so the door's tiles photograph at opacity 0 for many seconds — `screenshot.mjs`'s `menu-race` settles 12 s. Check `document.getAnimations()`' `currentTime` before blaming the CSS.
