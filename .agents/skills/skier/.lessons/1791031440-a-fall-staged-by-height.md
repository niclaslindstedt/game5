---
title: Stage a fall on a clock that runs only while he is HIGH over the snow, time the landing off the flight's own ballistics, and never mix a fist across him
date: 2026-10-03
scope: pwa/src/game/skier-flight.ts, pwa/src/game/skier-spring.ts, pwa/src/game/skis-body.ts
concepts: [air, fall, windmill, landing, continuity, snap]
---

"Behave differently by how far he falls" wanted a driver the engine does
not publish. Air time alone windmills a long, low flight along a pitch;
the drop below the apex counts a skier gliding down a steep face as
falling. What reads right is a FALL CLOCK that runs at full rate only
with the skis 2.2 m+ over the snow (`flightRead` marches the engine's own
ballistics, at the run's flight gravity — 1.5 g, so a 14 m drop is 1.4 s,
not 1.7 — over the map; each model is handed the map by `setGround`, the
labs a plane off the frame's recorded ground).

Three traps on the way to no snaps. (1) A fist MIXED between the stance
hand and a point on a circle behind his head passes through him: put the
arms on a sphere round the shoulders and keep them home (forward) whenever
the fall's weight is short of whole. (2) Winding home on a spring toward
a goal up to 5 rad away whips the arm round at 2 Hz — a flail; finish the
circle at its own pace and brake into home (`ARMS.brake`), starting ~0.6 s
before the snow. (3) Anything multiplied by the eased `air` steps its
acceleration at touchdown (the critically damped ease starts at full
pull): the chest's pitch, the head's bow and the hands' weight need
springs of their own, or the hands snap 4–6 cm in the landing frame.
`make skier MOVE=kicker,ledge,cliff` shows the sequence; every drop of
9–13 m in the lab still buckles his legs at the snow (`crash.ts`), so the
cliff's window ends there.
