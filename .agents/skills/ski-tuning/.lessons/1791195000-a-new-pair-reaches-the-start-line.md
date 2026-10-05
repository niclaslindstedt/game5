---
title: A pair added to the catalog reaches every start line it is dealt from — the field's rivals deal off RACE.skis, and a pair's class answer may need its discipline retuned to show
date: 2026-10-05
scope: engine/game/defs/skis.ts, engine/game/defs/modes.ts, engine/game/rivals.ts, pwa/src/game/ski-stats.ts
concepts: [catalog, rivals, benchmark, digest, ski-card, technique]
---

Adding the Falcon (the super-G pair) to `SKI_CATALOG` moved nothing the player skis but changed the start line's deal: rivals were `state.rng.pick(SKI_CATALOG)`, so a seventh entry dealt every seed a different field, `tests/benchmark_test.ts`'s pinned race lost its kicker (CI shard 2) and `tests/rivals_test.ts`'s seed 7 moved. The line now picks off `RACE.skis`, a stated list of the six it was first dealt from — the same draw picks the same pair, so the benchmark's history and every lab digest still compare. A pair added later is not added there.

Two more traps. The ski card's test wants every specialist BEST at one bar: a pair that sits between two neighbours on every axis (the super-G ski between the giant slalom and downhill skis) needs the axis that IS its class — here `speedCarveOf`, the bend held clean at 108 km/h, where its sidecut and grip meet as the giant slalom ski's do at 72 — never a nudged number. And the class's answer may not show in its own race: `SUPER_G_TECHNIQUE`'s slow edge fade (raised so the downhill ski could carve a super-G) lets the downhill ski carve the course's ≥ 50 m bends at any speed, so the Falcon ran the super-G ~2 % slower on its larger tuck; making it the right ski there is a discipline retune (a tighter bend, the fade nearer its research), not a ski one.
