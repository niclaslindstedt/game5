---
title: Muscle tone on a ragdoll exposes every energy leak a limp one hid — measure the tumble on a real steep face, then find which pass adds kinetic energy
date: 2026-10-03
scope: engine/game/ragdoll.ts
concepts: [ragdoll, muscles, energy, friction, verlet]
---

Giving the ragdoll muscles (a damped pose drive) made the poses human but
the falls cartwheeled: 3–4 turns down seed 38's powder face against 1 on
main, and a body lying still was kicked back up off the snow. A limp body
had been absorbing three faults in its flopping limbs. (1) A tucked or
world-aimed brace spins the trunk up by conservation of angular momentum.
Brace in the trunk's frame, arms out. (2) A joint limit moved without
velocity, then held at length by the links, injects speed. Find it by
summing the kinetic-energy change per pass (drive, gravity, joints, links,
floor, snow) per step and printing the worst; it was a hand pushed out of
the chest. `calm` takes back whatever a joint pass adds. (3) Per-point snow
drag lets one buried point be a pivot. `patch` lumps most of it onto the
whole body. The synthetic slope barely showed (3): probe the world lab's
trunk on a generated steep face (a node copy of `intoTrunk`) and compare
the same probe on a `main` worktree.
