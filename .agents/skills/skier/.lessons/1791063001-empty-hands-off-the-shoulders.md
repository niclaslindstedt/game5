---
title: Empty hands read as jelly when they swing the wrong way off the hips — swing them opposite the legs, from the shoulders, and measure which arm is forward
date: 2026-10-03
scope: pwa/src/game/skier-bare.ts, pwa/src/game/ski-stand.ts, scripts/poleless-lab.mjs
concepts: [poles, bare, arms, skate, contra, pendulum, stand]
---

"The poleless arms sway up and down like jiggly candy" was three faults
the frame strips hid: the arm on the PUSHING leg's side was driven back
(the free skate's coaching has it forward, forearm over the gliding ski —
`make poleless`'s `contra` read 0 %), the fists were offsets off the
grip rest with a rise of `|sin|` on both ends (a kink at mid-swing, the
fist bobbing twice a stride on its own), and the riding rest held them
57 cm off centre, wings. Anchor each fist to its SHOULDER on a smooth
curve through back, middle and front (`skaterArm`), eased over the push
and held through the glide (`skaterSwing`), and keep the elbow bent at
mid-swing so the pendulum barely dips. Judge the arm's own jolt off the
hips, not in the world: the body's heave at 60 Hz swamps it (the head
reads 15–35 m/s² in a plain tuck).

Turning, the skate's sideways push (`Gait.out`) was added along the BODY's
lateral axis, so a skater inclined into a turn pushed his outside ski
into the snow (`onsnow` faults by the dozen at 25 km/h). It is across the
snow like the stance: `standOf` rolls it in with the stance and hands
the drawers the difference.
