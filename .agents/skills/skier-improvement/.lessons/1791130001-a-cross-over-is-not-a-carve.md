---
title: A body still inclined into the last turn while the hips and edges have changed is crossing over — narrow `carving` by the inclination's side, never loosen `angulate`
date: 2026-10-04
scope: scripts/skier-metrics.mjs, engine/game/incline.ts
concepts: [metrics, bands, angulation, incline, transition]
---

Once the engine's inclination follows the turn's balance (the snow's own
force) instead of jumping with the edge, every edge change has a tenth or
two where `hipRight` has flipped and the body is still laid into the old
turn — and the `angulate` band (12–40° at the hips while `carving`) faulted
all of them (turns 4 % → 18 %). The pose is deliberate: `carving` now also
asks that the body be inclined toward the hips' side. Check `--faults` for
`roll` against `hipRight` signs before touching a band; the residual
`through` faults in the same frames (an inside knee crossing as the body
unwinds) are the pose's to fix, not the band's.
