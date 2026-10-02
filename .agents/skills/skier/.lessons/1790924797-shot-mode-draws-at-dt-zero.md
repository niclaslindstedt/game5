---
title: A screenshot (?shot=1) draws at dt 0, so the view's spring never steps — anything eased there needs a fallback to the engine's reading
date: 2026-10-02
scope: pwa/src/game/skis-body.ts, pwa/src/game/skier-spring.ts
concepts: [screenshots, spring, labs]
---

`App.tsx` freezes a `?shot=1` frame and hands the renderer `dt = 0`;
`stepSkierSpring` returns at once, so `SkierSpring.hip` stays NaN and every
eased value stays at its initial value. `poseInputOf` already falls back to
the engine's own `hipRight` and edge while `legs.hip` is NaN; a new eased
value must do the same (the start gate's `ready` falls back to the lights,
`drawnSkiAngle` to `skiAngle`), or `make screenshots` photographs a pose the
game never shows — the gate stance was missing from every grid shot until
it did. `make skier` and `make skier-metrics` step the spring and never see
this.
