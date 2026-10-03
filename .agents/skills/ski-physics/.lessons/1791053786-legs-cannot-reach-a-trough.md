---
title: The legs sit ~6 cm off full stretch at rest, so the CoG follows (and is launched by) any dip deeper than that
date: 2026-10-03
scope: engine/game/skier.ts, engine/game/suspension.ts, engine/game/defs/skis.ts
concepts: [legs, bumps, sink, air, landing]
---

A passive leg's room to EXTEND is its rest sag, weight over rate: ~5.6 cm on the Chamois. Over rollers 15–30 cm high at 30–40 km/h the skis leave the snow at every crest and the CoG bounces as much as the ground (`flatLevel({ bumps })` is the strip to stage it on). A softer rate buys reach only by sagging deeper, and gives back little. What works is ACTIVE ABSORPTION — a skyhook term in each leg's force against the body's vertical speed less a slow (~0.25 s) low-pass of it, clamped to a share of the spring: rate 3500 N/m with ~2500 N·s/m of it killed the air off 20–30 cm rollers and halved the CoG's bounce. It was prototyped and NOT shipped. It moves every run digest, and it softens the generator's roller crests and kickers, which are meant to throw him. A change like it owes the sim, the ride lab, the kicker scenarios and the trick runs before and after.
