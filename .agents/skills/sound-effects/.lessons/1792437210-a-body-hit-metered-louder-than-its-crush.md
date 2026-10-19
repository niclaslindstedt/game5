---
title: A layered body hit meters louder than its voices suggest, so meter it against the crush beside it
date: 2026-10-19
scope: pwa/src/game/audio/person-bank.ts, pwa/src/game/audio/route.ts
concepts: [meter, mix, impact, layering]
---

`struck_body` is six voices: a thud, a slap, the nylon, two exhale bands
and a growl. Each voice sat under the bank's 0.08 cap, but together they
metered at -20 dBFS. That was louder than `struck_crush` (-22) and well
over a trunk or a hard landing (about -26). The lesson is that the voices
stacked within 50 ms add up. Meter the new sound beside the one that must
outrank it, and trim the voices of the softer one until the order is right. Trimmed, it
meters near a hard landing (-23.7) and under the crush (-20.2). The meter's
noise voices move a dB or two from run to run, so read the ORDER, not the
last decimal.
A body hit's recipe that read right: a sine thud 85→38 Hz with a light
drive, brown noise through a lowpass closing 900→180 Hz, and the breath as
pink noise through two falling bands (700 and 1200 Hz) over a low
sawtooth. For a crush, use three highpassed white snaps 6–37 ms in, a
bandpassed crunch, a brown settle and no breath. The route drops the
`bump` that comes in the same step (`soundsForStep`).
