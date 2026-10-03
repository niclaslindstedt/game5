---
title: A crowd blended only between stances reads as statues — drive the player's animations on his timing
date: 2026-10-03
scope: pwa/src/game/crowd-rig.ts, engine/game/crowd.ts
concepts: [crowd, morph-targets, animation, pole-plant]
---

The first cut posed every amateur between eight stances (the tuck, a carve,
the wedge…) and nothing else, and in the game they read as not animating at
all: the dials move slowly (a lean eased over seconds, a crouch held), so a
skier between turns is one frozen shape sliding. What made the player alive
was what his body does on its own clock — the pole plant on every turn, the
wait when stood still — and those were never targets. Each is now a target
pair solved off `skierPose` (`plantAt` at the touch and the trail; `idle` at
its two extremes) and timed by the player's own rule against a turn clock the
engine keeps per amateur. Measure what share of the crowd a target is ever
shown on (a probe over `dialsOf` across a minute of a free ride) — a target
nobody reaches is a target that does not exist.
