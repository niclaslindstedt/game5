---
title: An effect burst at an event's spot hangs in the air the body left — anchor it to the body's own points and pour it over time
date: 2026-10-20
scope: pwa/src/game/crowd-gore.ts, pwa/src/game/crowd-wound.ts
concepts: gore, blood, ragdoll, presentation, impact-cam
---

The `struck` event's spot is a point in the world (between the two middles); a single burst of drops there is left behind by a body flung at 12 m/s, and under the impact cam's slow motion it reads as blood out of thin air. Read the source off the struck body instead: put the spot in the trunk's own frame off his ragdoll at the blow (`woundOf`: the share up from hips to shoulders, the way round to the hitter) and find it again every frame on the trunk as it lies (`woundAt`), emitting the drops over a short span of the run's clock with the body's own velocity as their carry. Pieces torn out at once still leave from the wound, not the event's spot. `tests/crowd_wound_test.ts` holds it on a body turned over and moved.
