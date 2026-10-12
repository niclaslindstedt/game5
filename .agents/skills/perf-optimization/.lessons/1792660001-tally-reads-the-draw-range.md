---
title: The benchmark's scene breakdown once billed the ground twice over
date: 2026-10-12
concepts: [benchmark, instruments]
---

The ground's rings hold every wedge twice round and draw a range of them (`terrain.ts`'s `ringWedges`), and `scene-tally.ts` counted each geometry's whole index, so a phone's report said the ground was 233k of 252k triangles when it drew about half that. It now reads `drawRange`. A breakdown row that is a round multiple of a structure's own size is worth checking against `renderer.info` before it is believed. The breakdown still counts what the frustum drops (three culls after the walk), so its column sums past the frame's own triangle count.
