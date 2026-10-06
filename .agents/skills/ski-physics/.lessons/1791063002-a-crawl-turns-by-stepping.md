---
title: At a crawl a skier steps round a turn — and any ease keyed off a signed step springs back at every change of side
date: 2026-10-03
scope: engine/game/poles.ts, engine/game/skier.ts, scripts/skate-turns-lab.mjs
concepts: [drive, skate, step-turn, edge, scrub, cadence]
---

"We gain no speed and barely turn" at low speed was the sidecut doing all
the turning (a 15 m arc at a walk: 33° in 2 s from 11 km/h) while the
drive was CUT for any bend. The cure is the step turn (`stepWork`,
`stepYaw`, `SkierState.step`): a heading step a stride, the V led into
the turn, the way turned by the leg like the skate's glide (and kept out
of the edge's scrub, which charges only what is CARVED), the drive kept
through the bend, the double pole given up for the skate while turning.

Two traps. Easing the edge by `|step|` stood the skis back up on the full
55° lock for a moment at every change of side (the step passes 0), and
the legs swung through it — key it off how much he CAN step
(`stepWork`), which does not flip. And quickening the strides for a
step turn at 25 km/h put the poled skate past two strides a second,
where the pinned poles snap (the poles lesson): quicken only at a walk.
`make skate-turns` tables the turn per speed before and after; the
skier lab's `path` sheet now frames a curve (it framed only the chord).
