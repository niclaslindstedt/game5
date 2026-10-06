---
title: A frame strip cannot show where a move TAKES him — draw the path from above; move the feet under him, never the hips off the line; let an arm follow through
date: 2026-10-03
scope: pwa/src/tools/skier-path.ts, pwa/src/game/skier-gait.ts, pwa/src/game/skier-stroke.ts, engine/game/poles.ts
concepts: [skate, path, glide, labs, snap, follow-through, cadence]
---

"He moves forward while his skis point diagonally" was invisible on every
sheet the lab had: the frame strips are aimed at his centre, so a body
going straight and a body zig-zagging look the same. `--sheet=path` strobes
the move from straight above over the line his centre draws, and prints
`glide` (his way off the gliding ski's line, in degrees). It read 17° with
0.00 m of sway before the fix and 0.2° with ~0.8 m after.

Once the engine skis the zig-zag, the pose must not sway the hips on top
of it. The CoG IS the line, so the skate's weight shift moves the FEET
under him (`Gait.out`), the glide foot under his centre.

Two snap sources a slower cadence exposed in `holdPush`: (1) a pinned push
ends with the fist still going back at the snow's speed, and easing it to
rest at the release stopped it in two frames. A FOLLOW-THROUGH (the
recovery as a cubic off the release's rate, capped short of the arm's own
finish) cured the long runs (away 13 → 5 % of frames at fault). (2) A
stroke clock that is a share of a stride read off the speed (`poleDuty`)
moves under the arm while a push speeds him up off a standstill. Latching
it at the plant was worse: the arm then runs out of reach. The real cure is
an arm's push driven by the snow passed since the plant, not the stride's
clock. Still open: `start` 2 → 6 %.
