---
title: Run one screenshots process at a time — three in parallel time every capture out
date: 2026-10-11
scope: scripts/screenshot.mjs, pwa/src/game/menu-where.tsx
concepts: [screenshots, lab, software-rasterizer]
---

Each card is photographed over a live race drawn by a software rasterizer,
so a single `make screenshots` already takes most of a minute a shot. Three
started side by side (one per viewport) starved each other and failed with
`page.screenshot: Timeout`, while the same surfaces passed one process at a
time with `--viewport desktop,phone,landscape --timeout 120`. A failure that
names `page.screenshot` rather than the wait selector is the machine, not
the card.
