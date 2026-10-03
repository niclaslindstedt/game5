---
title: At a summit the chase boom must NOT lean with the face — a level lens is what makes a drop read as straight down
date: 2026-10-03
scope: pwa/src/game/camera-rigs.ts, pwa/src/game/camera-summit.ts
concepts: [camera, drop, summit, stomach]
---

The boom leans its arm up the slope behind by a share of the fall line's
pitch so a steep face keeps the skier composed — which reads that face as
gentler. Pushing off a station's pad over its lip that is the wrong answer:
the player asked for the drop to feel straight down. `summitShare` (whole on
a top's pad, fading 6–45 m below it) takes 90% of the lean out, hangs the
height on the in-flight spring and opens the fov 6°. Judge it on
`screenshots --surface free --t <s>` stepped a second at a time through the
drop; the `?t=` pre-roll is the bot, so anything the engine leads (a lift's
lead) must leave the bot's hands off (`botInput` returns neutral on a lift).
