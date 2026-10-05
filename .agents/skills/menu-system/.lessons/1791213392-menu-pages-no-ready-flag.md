---
title: A probe of a menu page waits for one of the card's own controls — __SH_READY__ is the run's flag and a ?menu= page may never raise it
date: 2026-10-05
scope: pwa/src/game/menu-start.tsx, previews/
concepts: [probes, screenshots, start-card]
---

`?menu=start` puts the start card up within a fraction of a second, but `window.__SH_READY__` stayed unset for minutes under the software rasterizer, and a Playwright probe waiting on it hung until its timeout with nothing logged. Wait for a control on the card instead (`[data-menu=reroll]`), then for `.seed-preview-map` without `.seed-preview-waiting` for the chart. Under SwiftShader the snow behind the card takes seconds a frame, and the card's main-thread work (a worker's reply, a timer) waits behind those frames, so a time measured there is only worth comparing against the same probe on a `main` build.
