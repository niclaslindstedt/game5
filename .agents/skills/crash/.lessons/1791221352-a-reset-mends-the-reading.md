---
title: Read a crash's body at its worst step, never at the end of the run — the reset that stands him up mends it
date: 2026-10-05
scope: tests/body_test.ts, scripts/damage-preview.mjs
concepts: [body, injuries, reset, fractures]
---

A test that skied a trunk for six seconds and read `fracturesOf` at the end
found no fracture at all: the automatic reset had stood the skier up and
`mendBody` had cleared every injury. Anything that asks what a crash did —
a test, a lab — reads the body EVERY STEP and keeps the worst (the damage
lab keeps the highest severity, then the most injuries, then the same body
with a fracture struck harder since). A fracture's `energy` grows after it
is taken, so "the most injuries" alone misses a break that got worse.
