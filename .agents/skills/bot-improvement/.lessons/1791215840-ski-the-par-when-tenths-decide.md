---
title: When a race is decided by tenths, par is the engine's own clean run, skied — not a profile walked
date: 2026-10-05
scope: engine/game/par.ts, engine/game/field.ts, engine/sim/speed-ski-steer.ts
concepts: [par, field, speed-ski, wind, compression]
---

Speed skiing's par walked a point mass down the track's profile (gravity, base friction, tuck drag, even the profile's curvature load) and still landed −3.5 … +2.6 % off the bot map to map — the wind's direction under the jury's cap, the new snow a flurry lays and the compressions' losses in the legs are each a per cent at 55 m/s, and a field's whole spread is a few per cent. `speedSkiPar` now SKIES it: `createGame` on the very level (`rivals: 0`, `countdown: 0`, a final's heat so the final's track stands) and a straight full tuck to the zone's bottom line — a few thousand steps once per map and pair — and the bot lands within 0.2 % on every race map. A par run built inside `createField` is safe: it deals no field (`rivals: 0`) and draws only on its own state's stream. With the bot ≈ par, `SPEED_SKI_FIELD.best` (+0.003) is what decides whether a perfect run wins.
