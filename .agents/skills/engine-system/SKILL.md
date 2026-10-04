---
name: engine-system
description: "Use when adding or changing a gameplay system (a snow rule, something a skier can do, a gate rule, the run's phases, the reset rule, the field, a new event, a mode…). Walks the engine-first workflow: tune defs, extend state/events, implement in the fixed-timestep step pipeline, test headlessly, measure with the sim, then wire rendering, audio and HUD in the app layer."
---

# Adding a Gameplay System

Gameplay lives in the **engine** (`engine/`, framework-free TypeScript); the
**app** (`pwa/`) only draws state and reacts to events. Keep that direction:
the engine never knows a renderer exists. This is what makes every rule
unit-testable in plain Node, and every run reproducible from a seed.

**Before starting, read this skill's lessons** —
`npx ogf-skill-lessons engine-system --list`, then the ones this
task touches (`--scope=…`, `--concepts=…`). Load **`skill-reflection`** at
both ends of the session, and **`write-code`** beside this one on every
system change.

## Where the pieces go

| Piece | File |
| --- | --- |
| Global feel tuning (the snow, the grip, the edge and the skid, the skier's body, the poles, the air, the body contacts, the trees, the course, the reset) | `engine/game/defs/tuning.ts` — units in the comments; never inline in the model |
| A pair's numbers | `engine/game/defs/skis.ts` — the model never branches per pair; the `ski-tuning` skill |
| State shapes & events | `engine/game/state.ts` — `GameState`, `SkierState` (alias `CraftState`), `SkierInput`, `SnowContact`, `Progress`, `Rival`, the `GameEvent` union |
| The rigid body and its forces | `skier.ts` (the body), `suspension.ts` (the stations and the legs), `snow.ts` (sink, drag, grip), `poles.ts` (the push at a crawl), `flight.ts` (the air), `chassis.ts` (the unsprung body points) — the `ski-physics` skill |
| Trees and the map's edge | `engine/game/collision.ts` — the `collision` skill |
| The course: the gates, the finish, the reset | `engine/game/course.ts` — the `collision` skill |
| Run orchestration | `engine/game/step.ts` — `createGame`, `rulesFor` and the fixed 120 Hz `step`: the clock, the lights, the player's run, the field, skier against skier. ONE skier's own step is `run.ts`'s `stepRun`, run for the player and for every rival |
| What a run is PLAYING BY | `engine/game/defs/modes.ts` (`RunRules`, `MODE_RULES`, `fieldRules`, `slalomRules`, `openRules`) → `GameState.rules`. Nothing branches on anything but the rules; `createGame` with no race asked for skis the open rules, so the sim and the tests never notice a mode landing |
| The field | `engine/game/rivals.ts` — a rival is a whole `GameState` sharing the level, the rules and the RNG by reference, skied by `sim/bot.ts`; `racePlace`, `fieldOrder`, `raceProgress` are the standings |
| Standing the skier at a moment | `engine/game/place.ts` — `placeRun(state, moment)`; the `test-scenario` skill |
| Where the sun stands over a run (still, at the map's hour) | `engine/game/clock.ts` — `sunAtRun`, `moonAtRun` |
| The fall at a moment and the new snow it lays | `engine/game/snowfall.ts` — `snowAt`, `freshRate`; `GameState.fresh` |
| What a skier CAN do | `engine/game/limits.ts` — read by the physics AND `sim/bot.ts`; never restate a ceiling |
| The map | `engine/mapgen/` — the `mapgen-improvement` skill |
| Bot behaviour | `engine/sim/bot.ts` — the `bot-improvement` skill |
| Generic helpers | the framework's `core/` (and `racing/`) — fixed THERE, pulled in by moving the tag |
| Public surface | `engine/index.ts` — export what the app or the tests need |
| Tests | `tests/<topic>_test.ts` (vitest, `@engine`, synthetic maps — the `test-scenario` skill) |
| Anything drawn | `pwa/src/game/` (`renderer.ts` and the modules it names) |
| What an event SAYS, SOUNDS and FEELS like | `run-news.ts`, `audio/route.ts` + `audio/bank.ts`, `rumble.ts` |
| HUD / touch / keys | `hud*.tsx`, `snapshot.ts`, `input-model.ts`, `settings-input.ts` — the `hud-and-menus` skill |

## Workflow

1. **Defs first.** Add the system's numbers to `defs/tuning.ts` (global) or
   `defs/skis.ts` (the pair), with units and the model each is drawn from.
   If you can't express the knob there, the design isn't ready.
2. **Types.** Extend `state.ts`. Anything the app must react to becomes a
   `GameEvent` variant — events are the ONLY channel from simulation to
   presentation. `state.events` holds this step's and is cleared at the top of
   the next, so the app reads it after every `step`.
3. **Simulate.** Implement the rule in the module that owns it, inside the
   fixed 120 Hz step. Mutate state in place; respect the phases
   (`countdown` → `racing` → `finished`). Keep per-step allocation near
   zero — `step()` runs 120×/s for four skiers, and the sim far faster.
   Semi-implicit: forces → velocity → position, once.
4. **Test headlessly** in `tests/`: a synthetic map, `createGame({ level })`,
   `placeRun`, scripted inputs, assertions on state and events. Every rule you
   claim gets an assertion. `npx vitest run tests/<file>` to iterate.
5. **Export** what the app needs from `engine/index.ts`.
6. **Measure.** `make sim` before and after (the `simulate-run` skill). A
   system that changes what a run looks like usually earns a column in
   `RunReport` or an event it counts. If the system has a lab (`make ride`,
   `make analyze`), that too.
7. **Present.** Wire it into the renderer / HUD / audio / news / rumble —
   the app reads `GameState`, never steps physics, never mutates state.
8. **Playtest** (`make world`, `make screenshots`) — numbers that look right
   in a test can still read wrong at speed.

## A worked example: a sheet of ice on the piste

Say the piste gains ICE PATCHES — stretches injected and frozen hard, where
an edge scratches a line and little more.

1. `engine/mapgen/types.ts`: `Level` grows `icePatches?: { s0: number; s1: number }[]`
   (optional, so a synthetic level need not invent one). Tell whoever owns
   the generator before changing an exported shape.
2. `rules.ts`: a new R-rule for where a patch may lie, as data — and its
   prose mirrored VERBATIM in `docs/level-generator.md` (`docs_rules_test`
   fails until it is). `track.ts` places them; `analysis/` checks them.
3. `snow.ts` / `tuning.ts`: the grip an edge keeps on a patch, as a knob
   (`grip.ice` already prices bare ice — read it, do not restate it).
4. `tests/skier_test.ts`: a synthetic map with a patch; the edge's hold
   falls on it and nowhere else.
5. `sim/bot.ts`: the speed it plans a bend at reads `cornerGrip`, which
   reads the grip — so nothing, if the ceiling is stated once.
6. `make sim` before/after; `make level SEED=` shows the patches.
7. `pwa/src/game/terrain.ts` / `snow-glsl.ts` draw them (the `snow-look`
   skill); `snowpack.ts` names the kind of snow.
8. `docs/riding.md`, `docs/level-generator.md`, a changeset fragment.

## Invariants to preserve

- `step()` stays deterministic for (seed, input sequence) — no wall clock, no
  `Math.random`, no DOM; randomness only from `state.rng`. The only draws a
  race makes are the rivals' paces and skis at the start line; a new draw
  anywhere in `step` changes every digest — say so in the PR.
- **The map is a pure function of its seed**, baked once. A system that wants
  the world to REMEMBER something keeps that memory in `GameState`, never in
  the `Level` — and the trail a skier leaves is the renderer's, stamped from
  the engine's `contacts`, not state the engine keeps.
- The engine imports nothing from `pwa/`, three.js or Preact; the app imports
  `@engine` and nothing deeper. `tests/imports_test.ts` holds it.
- The timestep is fixed (`TUNING.physicsHz`, 120). The framework's
  `loop/run-clock` accumulates real time into fixed steps, clamped — never
  make a rule depend on frame rate.
- Docs move with the code per `AGENTS.md`'s sync table.
- A user-visible change ships a `.changes/unreleased/` fragment.

## Skill self-improvement

Load the **`skill-reflection`** skill at both ends — it owns recording what a
pass learned, fixing anything here the pass proved WRONG, and promoting the
always-true. When a new system forces a pattern not covered here, record where
it landed and why.
