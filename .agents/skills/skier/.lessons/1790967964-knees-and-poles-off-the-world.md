---
title: Read a turn's side off the edge in the world, and pin a pole to the skis — never to the shoulders; an arm's speed caps the cadence
date: 2026-10-02
scope: pwa/src/game/skier-pose.ts, pwa/src/game/skier-stroke.ts, pwa/src/game/skier-gait.ts, engine/game/poles.ts
concepts: [knees, angulation, poles, cadence, snap, roll]
---

"The knees bend the wrong way for a bit, then the right way" was the knee
band's side read off the skis' tilt IN THE PAIR'S FRAME (`edge − roll`).
The engine's roll of the pair runs past the edge for ~0.5 s into every
turn (1.24 rad of roll on 0.84 of edge at 70 km/h), which flips that tilt
against the turn: the band flipped and the hips swung past the shins, the
knees bowed ~10 cm OUT. Read the side off the edge in the world, and allow
the hips inside the shins (`KNEE_OUT`) only while the tilt agrees with the
turn. The lab pays for it: a couple of degrees of angulation at turn
initiation (`turns`' `angulate` band).

"The poles don't bind to the ground" was a fixed ~1 Hz stroke: a basket
slid 2.4–3.8 m/s through the snow. Pinning it (`holdPush`) has three traps:
(1) the PLANT is a point on the snow by the skis — measured against the
current shoulder it drifts ~0.45 m as the trunk crunches over the poles;
take it from the pose at phase 0. (2) The last ~10 cm of the arm's sweep
barely moves the basket, so a push solved into it throws the fist — keep
the engine's sweep short of the pose's (1.35 vs 1.55 m). (3) Hand
acceleration scales with cadence²: past ~2 strides a second every stroke
end snaps (the lab's 100 m/s²), so cap the cadence and let the skier GIVE
UP poling (`poleKeepUp`, `Gait.keep`) where a stroke at that cadence can't
keep up — the arms fading out of it (followed in the spring), never
swinging a pole over the snow it can't plant in. Measure slip with the
basket's world speed over the middle of the push, not "tip near the snow"
(that counts the reach for the next plant).
