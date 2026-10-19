---
title: On a Mac with a GPU, price a change by interleaved whole-build runs and one-block knockout builds — never by in-shader experiment toggles
date: 2026-10-19
scope: scripts/benchmark.mjs, pwa/src/game/
concepts: [performance, measurement, benchmark, gpu, metal]
---

A plain `make bench ARGS="--gpu --dist <dir>"` run is about half a minute at 1920×1080, and alternating two built copies (A B A B, each copied under `previews/`) agrees with itself to ±0.05 ms of fence. That's tighter than most single changes are worth. For a cost map inside the ground's shader, build one copy per block removed (a scripted textual patch on a clean tree, built, the tree restored) and run each against the base the same way; `?ab=1` reaches only four snow parts. Two traps. First, extra experiment uniforms and branches in the ground shader made Metal's shader compiler crash (`XPC_ERROR_CONNECTION_INTERRUPTED`, context lost), and the run then "measures" a blank page at 1 ms a frame — check the report's MACHINE line names the GPU. Second, `make build`'s typecheck slows tenfold when the Mac idles (minutes a build overnight); experiment copies are `npx vite build` in `pwa/`, with `make build` kept for the gate.
