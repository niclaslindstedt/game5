---
title: Pursuers that arrive late must hold the wanted level's search clock, and a gun that moves must lead on the target's way relative to its own
date: 2026-10-19
scope: engine/game/army.ts, engine/game/wanted.ts, engine/game/gunfire.ts
concepts: [wanted, pursuers, gunfire, determinism, testing]
---

A hunt system whose machines take time to come in (the army's helicopters, `ARMY.respond` plus the flight from the map's edge) loses every hunt before it arrives if the wanted level's search clock runs meanwhile: hold `unseen` at 0 until the first machine has reached the search (`ArmyHeli.on`). Once a system writes `WantedState.pursuers`, the wanted level's own tests no longer test the wanted level alone, so give `createGame` an off switch (`army: false`) and use it in them. A round inherits its shooter's velocity, so `gunfire.ts`'s lead is on the target's velocity minus the gun's; without that a door gun in a circling machine hits nothing. A point-flown machine circling a target settles on a velocity controller (tangent speed plus a radial closing share), never on chasing a led point ahead on the circle, which swings the radius by half again.
