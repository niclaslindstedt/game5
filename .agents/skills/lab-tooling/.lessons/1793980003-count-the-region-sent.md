---
title: An upload meter must count a texSubImage's region, not the array it reads from — a row-by-row update read as 20 MB a frame
date: 2026-10-18
scope: scripts/gore-cost.mjs, pwa/src/tools/gore-cost-harness.ts
concepts: [labs, measurement, uploads, webgl]
---

Patching `texSubImage2D` and adding the source view's `byteLength` billed
each one-row update of a 200 × 200 half-float map as the whole map, so two
hits read as 20 MB uploaded a frame when it was under 1 MB. Count width ×
height (× depth) × the texel's bytes off the call's format and type, and
for a `bufferSubData` the `length` argument when one is given. A per-frame
tally by call and size (`make gore-cost`'s last line) shows which buffer it
is: 204 800 bytes is 3200 instance matrices, 38 400 is 3200 colours.
