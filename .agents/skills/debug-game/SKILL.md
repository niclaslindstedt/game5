---
name: debug-game
description: "Use when investigating a gameplay bug, physics glitch, visual problem, or crash. Covers reproducing deterministically with a seed plus a scripted input sequence, classifying by layer (engine vs renderer vs input vs generator vs shell), the instruments (`make ride`, `make level`, `make analyze`, `make sim`'s digest, `make world`, the URL a bug report carries), reading the engine's output module, and locking the fix with a failing test first."
---

# Debugging the Game

The engine is deterministic by construction: `createGame({ seed })` + a fixed
sequence of `step(state, input)` calls always produces the same run — same
mountain, same field, same physics, same events. Almost every gameplay bug
can therefore be reduced to a **seed + input script**, reproduced headlessly,
and locked in with a test. Prefer that route over clicking around in a
browser.

**The URL is the repro's first ingredient.** `?seed=` names the map, and
`?start=race&seed=&t=` stands the app on a run with `t` seconds already
skied by the bot (`url-params.ts`); a bug report's address bar and the
seconds on its HUD clock are most of a repro. The developer page's REPRO
line (`debug-tools`) writes the whole of one — seed, mode, skis, time,
camera, sky and the skier's pose — as a URL the app reads back.

**Before starting, read this skill's lessons** —
`npx ogf-skill-lessons debug-game --list`. Load
**`skill-reflection`** at both ends of the session.

## Instruments

| Instrument | How |
| --- | --- |
| Deterministic repro | `createGame({ seed })` + fixed `step()` loops in a scratch vitest file — or a synthetic map and a `placeRun` via `test-scenario` |
| Bot repro | `simulateRun(seed, options)` (`engine/sim/simulate.ts`) — a whole botted run, headless, with the counts and the digest in the `RunReport` |
| Determinism check | The `digest` in `RunReport` — two runs of the same seed must hash identically; a digest drift IS the bug report for nondeterminism (`tests/determinism_test.ts`) |
| The skier over time | `make ride SCENARIO=` — the skier in profile over the snow he crossed, with the numbers per cell; the first thing to run on any "the skier does X" report |
| The snow at a point | `level.groundAt`, `level.packedAt`, `sinkTarget(packed, speed, scale)` called directly — four numbers, no skier needed |
| Map geometry | `make level SEED=` — the plan with every gate, kicker and the start labelled; `make analyze SEED=` — every rule the map breaks |
| Engine log | the framework's `core/output` — the semantic output module (`status/info/warn/error/debug`) with a pluggable sink; in the browser `pwa/src/output-bridge.ts` keeps it in a buffer and lifts it to the console in dev, and the developer page shows its last lines. Engine code prints through it, never bare `console.*` |
| The real renderer | `make world SEED=` (one run, named views, no dist needed), `make screenshots` (the built app), or `npm run dev` headed |

## Process

1. **Classify by layer first:**
   - **engine bug** → state values are wrong (position NaN, speed exploding,
     `airborne` stuck, a gate never credited, `phase` never reaching
     `finished`, a skier thrown into the sky). Reproduce headlessly; the
     renderer is not involved. A skier fired upward after meeting something
     is nearly always a contact normal with an upward component or a spring
     that stored an impact (`collision`, `ski-physics`) — check the body's
     impulses and the stations' `MAX_LOAD` fuse before anything subtler; a
     skier popped off the snow when a tuck is released is the crouch moving
     the stations without moving the body (the crouch is KINEMATIC: when
     `drop` changes between steps the body shifts with it so the legs keep
     their compression). A NaN is nearly always a division by a speed or a
     load of zero.
   - **feedback-loop bug** → the skier has two states and nothing between
     (carving or fully sideways, bogged or floating) a notch of input apart.
     Some threshold is reading what the skier is DOING rather than what was
     ASKED (`ski-physics`'s rule); print the loop's gain.
   - **render bug** → state right, pixels wrong (the skier floating above his
     tracks, a track swept across the map, a seam in the clipmap, a tree
     drawn where the trunk is not, the camera popping). The renderer reads
     `GameState` and never writes it — if the ride table is right and the
     screen is wrong, the bug is in `pwa/src/game/`. Paint the raw channel
     (the trail map's depth into the colour) before tuning.
   - **input bug** → `SkierInput` wrong before the engine sees it (a tuck
     that reads 1 on touch, a lean that never reaches −1, a `reset` that
     fires every step). `input-model.ts` is DOM-free — reproduce in
     `tests/input_model_test.ts`. A key that does nothing before
     `__SH_READY__` is the loading card eating it, not a bug.
   - **generator bug** → the map itself is illegal or ugly (a piste crossing
     itself or climbing, a kicker on a bend, a tree on the piste, a start on
     a pitch). That is `mapgen-improvement`'s loop — `make level` and `make
     analyze` first.
   - **shell bug** → only in the desktop or the store app. `platform-shells`;
     the page's whole view of a shell is `shell-host.ts`.
2. **Engine bugs: write the failing test BEFORE the fix.** Arrange the exact
   scenario in `tests/` — a synthetic map, a `placeRun`, scripted inputs until
   the bad state appears — assert the correct behaviour, watch it fail, then
   fix. The test stays forever. Name it after the behaviour.
3. **Find the STEP, not the second.** Walk the run one step at a time and
   print any step where the speed, a body rate or a contact's compression
   jumps; the wrong step is almost always one force firing where it should
   not, followed by a long correct stretch an average hides.
4. **Bugs only the bot hits:** reproduce with `simulateRun` at the reported
   seed, read the counts (resets, hits, wipeouts, missed, finish), then `make
   level` for the geometry they happened on. A bot failure on legal geometry
   is a bot bug (`bot-improvement`); illegal geometry is the generator's.
5. **Render bugs:** reproduce with `make world SEED=` or `make screenshots
   SEED= ARGS="--t <s>"`, and compare against the ride table or the state at
   that step to separate "state is wrong" from "drawn wrong".
6. **Nondeterminism** (digest drift, a shared seed differing between
   devices): almost always a draw outside `state.rng`, a wall-clock read in
   the engine, iteration over something with an unstable order, or a new draw
   inserted into the generator's fixed order. Grep `engine/` for
   `Math.random` and `Date.now` first — `tests/imports_test.ts` bans both.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. What is worth a
fragment here is the diagnosed root-cause _class_ (a layer-classifying tell, a
repro technique), never the one-off bug.

```sh
npx ogf-skill-lessons debug-game --list
```
