---
title: A discipline's own stadium is returned by planSpectators in place of the finish arena, and its fans are checked against trees in bulk
date: 2026-10-11
scope: pwa/src/game/spectator-plan.ts, pwa/src/game/spectator-jump.ts, tests/ski_jump_arena_test.ts
concepts: [spectators, arena, stands, tests]
---

A ski jump's crowd is laid by `spectator-jump.ts` through the plan's own
`FanDealer` (`dealerOf`, `put` with its own steepness, `seat` for a stand's
step) on the stadium `ski-jump-arena-plan.ts` builds, and `planSpectators`
RETURNS that stadium's stands, fences and arena before the finish arena is
laid — so no other mode's plan, stream or count moves. A course whose crowd
stands somewhere else entirely (a stadium, not a finish slope) follows the
same shape rather than adding banks to the arena. In its test, never
`expect` inside a fans × trees loop: 4,000 fans against a map's forest is
tens of millions of `expect` calls and ran for over ten minutes; take the
trees in the fans' bounding box and assert the least distance once.
