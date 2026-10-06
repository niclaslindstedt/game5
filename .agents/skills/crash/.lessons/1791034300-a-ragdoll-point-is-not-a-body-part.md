---
title: Read injuries off the ragdoll per point and every limb breaks — limbs whip at twice the body's speed, so give them their joints' fold, bill only the trunk, and cap a step's draws
date: 2026-10-03
scope: engine/game/body.ts, engine/game/defs/anatomy.ts
concepts: [body, injury, ragdoll, g-force, thresholds]
---

The first body model scored every ragdoll point's arrival into the snow or
a trunk as a blow on its part with a tissue give of 1.5–3 cm, and a 45 km/h
trunk broke nineteen things at 948 g — the elbow whipped into the trunk at
17 m/s. Three fixes, each a class: (1) a limb's give carries its joints'
fold (an arm buckles at the elbow under a hand put down; 5–8 cm, not 2);
(2) the g meter bills the head and the trunk only — a limb is a small mass
flung faster than the man; (3) of a step's draws only the worst `perBlow`
are taken, because one blow meets the snow with every point at once and
independent draws per point union into a lottery. Also: a trunk "square in
front of the skis" meets the TIPS — it levers the shins (`bend`), it is not
a blunt blow on them; and a crooked landing that ended on the hip is the
hip's blow, not a cruciate's drawer for both knees. Stage the ride lab's
`tree`, `nose-in`, `drop-side` and `kicker` and the bot over the corpus
before trusting any threshold: the bot's only injuries should come from a
harsh landing or seed 10's battering spot.
