---
title: A ragdoll's joint limit that moves ONE point leaks momentum — the body spins flat on the snow; share every correction by mass, and give friction the point's own weight
date: 2026-09-24
scope: engine/game/ragdoll.ts
concepts: [ragdoll, verlet, friction, momentum, wipeout]
---

The first ragdoll slid face-down with its spine level and still turned
~0.3 revs/s about the vertical, which reads as the body "spinning around
and around". Two causes, both invisible in the per-step numbers: the knee
hinge and the thigh limits moved only the knee (a push with no push-back
is momentum out of nowhere, every step a leg lay against the snow), and
the friction was read off how far each point was pushed up in the solver,
which the joints inflate unevenly, so friction twisted the body. The fix
was `shift` (the correction shared with the hip or the hip and foot by
mass) and Coulomb on each point's OWN weight and arrival. Also: a hinge
measured against the chest, not against the chest square to the
hip–foot line, turned a leg raised along the chest inside out and fired
the body off at 40 m/s. Trace the spine's turn per step (`Thrown.tumble`)
while lying — it must go still.
