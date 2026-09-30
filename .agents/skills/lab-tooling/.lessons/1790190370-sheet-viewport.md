---
title: A contact sheet photographed by element is still clipped at the page's viewport — size the viewport to the sheet
date: 2026-09-23
scope: scripts/skis-preview.mjs
concepts: [screenshot, playwright, contact-sheet]
---

`locator('#sheet').screenshot()` on a 1600×1200 page cut a six-row sheet at
1200 px and filled the rest dark. The skis lab opens its page at 3200×3200;
any sheet lab whose rows grow with a catalog should do the same, or size the
viewport from the sheet the page reports.
