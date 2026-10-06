---
title: A harness whose shader fails to link still writes its PNG — grep the driver's log with -a for "ERROR", or the failure reads as binary noise
date: 2026-10-04
scope: scripts/audience-preview.mjs, scripts/crowd-preview.mjs
concepts: harness, shaders, labs
---

When a material's `onBeforeCompile` graft does not compile (a GLSL keyword such as `out` used as a name, a ternary over a struct in ESSL), three logs the whole program source to the console and the sheet still comes back as a PNG of empty cells. The source dump carries bytes that make plain `grep` print "binary file matches" and swallow every line — pipe the driver through `grep -a "ERROR\|rror\|previews"` so the `ERROR: 0:NN:` line shows, then fix that line of the graft.
