---
title: A sed over a knob's name rewrote two other TUNING blocks' knobs of the same name — sweep a value with the lab's own override, never with sed on the file
date: 2026-10-03
scope: engine/game/defs/tuning.ts
concepts: [tuning, sed, experiments]
---

Sweeping `crash.scrub` with `sed -i "s/    scrub: [0-9.]*,/…/"` also rewrote
`scrub` in two unrelated TUNING blocks (the skis' physics). A collision
test then failed for no reason the ragdoll could explain, and an hour went
on it. TUNING's key names repeat across blocks. Sweep a value with a
probe-side override (`--set=crash.x=v` mutating `TUNING` at run time), and
check `git diff` on `tuning.ts` for stray hunks before trusting any
measurement.
