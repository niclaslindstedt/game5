---
title: The same run skied in Node and in a harness page drifts apart — measure in one place, and say how far the other ran off
date: 2026-10-04
scope: scripts/technique-preview.mjs, pwa/src/tools/technique-harness.ts
concepts: [determinism, harness, labs]
---

The engine is deterministic per runtime, not across runtimes: seed 38's slalom skied by the bot ends at 56.108 s in Node every time and at 56.150 s in the Chromium a harness page runs in — same level digest, the skier's x first differing in its ninth decimal some 2500 steps in (a transcendental's last digit), and the bot's run a few steps apart by the finish. A lab that takes its TABLE off the engine in Node and its PICTURES off the page must not claim the two are one run: the technique lab measures in Node only, has the page report its run's end, and prints the offset (a warning past a second). A probe that compares the two prints the skier's position every 50 steps from both sides and diffs the lists.
