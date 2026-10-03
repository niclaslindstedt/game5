---
title: The engine tips the skis on a turn's first step and the boots carry the knees with them — the upper body leads only if the view gives it a lead off the key
date: 2026-10-03
scope: pwa/src/game/skier-spring.ts, pwa/src/game/skier-pose.ts, pwa/src/game/skis-body.ts
concepts: [turn, initiation, lead, knees, upper-body, spring]
---

Every body reading the pose leans on (`hipRight`, the followed edge and
roll) lags the engine's edge, and the knee is fixed in its edged boot's
plane — so into every turn the knees went in on the first frame while the
hips, shoulders and head swung OUT 2–4 cm for a tenth of a second (the
hips were measured from the boots by the body's eased tilt, which lags the
boots). It read as a knee shove. The cure: measure the hips from the boots
as they stand (`edge`), and give the upper body a LEAD — the key followed
fast with an acceleration cap minus the key followed slowly (`leadOf`),
which peaks at a turn's start, is spent once the legs catch up, and needs
no reading of the legs to know when. A lead "spent as the legs' lean grows"
was spent too late and kept the outward swing. Measure it with the
lateral move of head, shoulders and knees off the feet IN THE WORLD
(rotate by `q`): the pair's frame hides the roll. Cap above ~200 /s² and
the `turns` move's snaps come back.
