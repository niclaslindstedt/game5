---
title: A probe of a menu page waits for one of the card's own controls — __SH_READY__ is the run's flag and a ?menu= page may never raise it
date: 2026-10-05
scope: pwa/src/game/menu-start.tsx, previews/
concepts: [probes, screenshots, start-card]
---

`?menu=start` puts the start card up within a fraction of a second, but `window.__SH_READY__` stayed unset for minutes under the software rasterizer, and a Playwright probe waiting on it hung until its timeout with nothing logged. Wait for a control on the card instead (`[data-menu=reroll]`), then for `.seed-preview-map` without `.seed-preview-waiting` for the chart. A bare visit opens on the attract card, so a probe that means to tap a front-door tile goes to `?menu=root`, or it waits on `[data-menu=free]` forever. Under SwiftShader the snow behind the card takes seconds a frame, and while the front door's own map is still being built the card's main-thread work (a worker's reply, a timer) waits behind it: let the door settle (~45 s) before tapping, and compare only against the same probe on a `main` build.
