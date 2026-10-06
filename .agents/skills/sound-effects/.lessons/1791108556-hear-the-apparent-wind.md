---
title: The wind bed hears the APPARENT wind, and a meter preset past WIND_FULL is how a gale is judged
date: 2026-10-04
scope: pwa/src/game/audio/wind-voice.ts, ride-bed.ts
concepts: [wind, apparent-wind, crosswind, pan, meter]
---

The bed's `wind` is `airflowAt` (the weather's air less the skier's
velocity), never `SkierState.speed`: a headwind adds, a tailwind cancels, a
storm is heard standing still. Its scale runs PAST `WIND_FULL` to `WIND_TOP`
(the cube of the speed beyond a schuss, plus the BUFFET layer), so any retune
under 40 m/s leaves the old presets' levels untouched — check that on the
meter first. The audition's gale and crosswind presets ("a gale in the face,
tucked", "a crosswind at speed", "standing in a storm") are the ones that
move when the top of the curve does; keep the gale at a hard landing's level,
not past it. A crosswind's pan goes through `SCREEN_TO_ENGINE` and the
listener's `side` column (none from the orbit lens, which circles him).
