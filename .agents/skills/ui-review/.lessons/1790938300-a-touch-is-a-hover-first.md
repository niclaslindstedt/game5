---
title: On a phone the hover and the press are ONE touch — anything a hover resizes can eat the press
date: 2026-10-02
scope: pwa/src/game/menu-knobs.tsx, pwa/src/styles.css
concepts: [touch, layout-shift, caption, cards, screenshots]
---

A row's `onPointerEnter` fires on the finger going DOWN and its click on the
finger lifting. The caption grew to fit the free ride's WEATHER sentence in
between, the scrolling body shrank, the arrow slid out from under the finger
and the click never landed — the player saw only the sentence where the row
had been. A mouse can't show it and neither can a still: drive the built page
with real touches (`Input.dispatchTouchEvent` over CDP in a `hasTouch`
context), with the row near the foot of the body, and read the value back.
Whatever a hover changes on a card must not change its layout.
