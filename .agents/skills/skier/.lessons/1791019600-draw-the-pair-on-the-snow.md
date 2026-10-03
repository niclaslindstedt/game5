---
title: The engine stands the skis on the snow, the drawing rolled them off it — lay the pair in the snow's frame and turn the body about its feet
date: 2026-10-03
scope: pwa/src/game/ski-stand.ts, pwa/src/game/ski-gear.ts, pwa/src/game/skier-limbs.ts, pwa/src/game/skis-body.ts
concepts: [skis, snow, incline, pivot, stance, hockey-stop, knees, pelvis]
---

"The outer ski hangs in the air when turning" was a frame mismatch: the
engine casts each leg down the SNOW's normal from half a stance across the
snow (so both skis are always loaded), while the view drew the pair at
(±stance/2, −legs) in the BODY frame rolled with him — the outside ski 25–45
cm up at every hard turn, the inside one 8–20. Expose the body's roll
against the snow (`SkierState.incline`, not the Euler `roll`, which is off
the vertical and differs on a traverse), turn the drawn body about its feet
(origin + legs × (up − snow normal)), and lift each ski by ±stance/2·sin
incline. The same mismatch hid in the stop: skis yawed about the BODY's up
under an inclined body bury one end and lift the other (28 cm), and each ski
pivoted on its own binding closes the stance into a line — pivot the stance
in the snow's plane and roll it in (`bootFrame`'s `incline`), and pass the
hips the fore-aft tip that leaves (`tip`). Measuring the boot centre alone
missed the stop; measure each ski's LOWEST station.

The leg-length difference that keeps both skis down went entirely into the
inside knee (148° in a tucked skid) beside a straight outside leg. A
real pelvis tilts with the angulation: `pelvisAxis` raises the hip over the
higher ski so both knees share it, and `kneeRoom` lifts the hips (the trunk
folding at the hip by as much) rather than fold a knee past 113°/124°.
Retune `ANGULATE_SHARE` after either — both change the measured angulation.

Then never count the inclination twice: the pivot already carries the hips
inside by legs × sin incline (~0.5 m at 31°), so the pose's hang off the
engine's `hipRight` takes only what is left (`carried` in `skierPose`).
Hung on top, the legs leaned 60° beside an upright trunk — a man falling off
his skis. Judge it from BEHIND at the game's chase (`make turns
ARGS=--views=chase,behind`, cropped at full size): the contact sheets
shrink a hip dump into something that looks almost right.
