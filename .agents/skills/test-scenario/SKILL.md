---
name: test-scenario
description: "Use when a bug repro, a physics assertion, or a visual judgement needs the game in an EXACT situation — the skier at rest in powder, a kicker taken at a known speed, a full-edge carve at 100 km/h, a hockey stop, a trunk met square, a traverse, a landing off a known height, a gate skipped. Covers the synthetic maps in `tests/support/synthetic.ts` (`syntheticLevel()`, the slope; `flatLevel()`, the drag strip on a grade) handed to `createGame({ level })`, standing the skier at a moment with `placeRun`, scripting inputs step by step, the ride lab's scenarios (`scripts/lib/ride-scenarios.mjs`), and photographing a run at a moment with `make screenshots`."
---

# Test Scenarios

Skiing your way into a situation is slow and unrepeatable. This repo stages
situations **declaratively** instead: hand the engine a synthetic map shaped
for the scenario, stand the skier at the moment with `placeRun`, and script
the inputs step by step. The same technique backs every physics test
(`tests/skier_test.ts`, `flight_test.ts`, `collision_test.ts`,
`course_test.ts`, `rivals_test.ts`, `crash_test.ts`) — reuse it whenever you
are reproducing a bug, asserting a rule or measuring a number.

## The synthetic maps

`createGame` takes a `level`, and it does not have to come from the
generator. A hand-built `Level` bypasses `mapgen` entirely, so the scenario
contains exactly what you put in it. `tests/support/synthetic.ts` owns two:

- **`syntheticLevel(options)`** — THE SLOPE: a packed piste straight down a
  face of a known grade, with a KICKER across it (a lip, then dropping away),
  rollers, a few trees beside it and ONE lone tree in the powder off it at
  `LONE_TREE`, the start line at the top and the finish on a flat run-out at
  the bottom. `noTrees`, `noKicker` take pieces out. `SLOPE` is its
  geometry.
- **`flatLevel({ packed, size, grade, slopeFrom })`** — THE DRAG STRIP: a
  huge square all packed (`packed: 1`) or all powder (`0`), FLAT or on a
  `grade` of your own (a skier on the flat goes nowhere but by his poles —
  most measurements want a grade), optionally a slope from `slopeFrom`, with
  a piste laid down it only so the `Level` is whole.

Build a new one with `createHeightfield` / `fillField` and the `Level` shape
in `engine/mapgen/types.ts` (the optional fields — `packed`, `kickers`,
`mountain`, `attempt` — need not be invented). Nothing validates a hand-built
map against the R-rules — that is the point: a scenario may stage what the
generator would never build. Add a builder to `synthetic.ts` rather than
inside a test when a second file wants it; generated maps for a sweep come
from `tests/support/levels.ts` (`LEVEL_SEEDS`, `levelFor`, `analysisFor` —
shared, read-only).

```ts
import { createGame, NEUTRAL_INPUT, placeRun, step, TUNING, type GameEvent, type GameState, type SkierInput } from "@engine";
import { flatLevel } from "./support/synthetic.ts";

function stage(speed = 0): GameState {
  // No rivals, no lights, no log: the run is the skier and the snow.
  const state = createGame({ level: flatLevel({ packed: 0, grade: 0.3 }), rivals: 0, countdown: 0, quiet: true });
  placeRun(state, { x: 1500, z: 150, heading: 0, speed });
  return state;
}
```

## Standing the skier at a moment

`placeRun(state, moment)` (`engine/game/place.ts`) puts the skier AT a
`RunMoment` — `x, z, heading`, a `speed` along it, optionally a `height` over
the snow with `vy` of climb, a `pitch`, a `roll`, a `pitchRate`, the run
clock (`time`) and the gate owed (`nextCheckpoint`) — on his legs on the
snow (or in the air), with the skis flat and the body standing (a tuck is
asked for by the input after). It ends the lights: a placed run is racing.

- a skier at 80 km/h 40 m above the slope's kicker, for a launch;
- a skier 3 m up, tips down, falling, for a landing over the tips;
- a skier between gates 4 and 5 owing 5, for a reset or a miss.

`placeRun` writes state and nothing else: the next `step` is what lands,
hits or resets, so assert on the events that step emits exactly as for a
skied one. A skier placed at rest on FLAT snow should be still after a
second of `NEUTRAL_INPUT` — if he is not, `placeRun` and the legs disagree
about the stance, and that is the bug. On a grade he is expected to slide.

## Scripting inputs

Drive the state with a fixed-step helper; seconds → steps via
`TUNING.physicsHz`:

```ts
function ski(state: GameState, input: Partial<SkierInput>, seconds: number): GameEvent[] {
  const events: GameEvent[] = [];
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) {
    step(state, { ...NEUTRAL_INPUT, ...input });
    events.push(...state.events);
  }
  return events;
}
```

Collect the events as you go — `state.events` holds THIS step's and is
cleared at the top of the next. They are the assertion surface for anything
transitional (`air`, `land`, `hit`, `bump`, `checkpoint`, `missed`,
`finish`, `reset`, `wipeout`, `stuck`). `reset` in the input is an EDGE:
true for one step.

## Rules of thumb

- **Stage, don't ski.** If a repro starts with "ski down to the second
  kicker", replace the descent with the slope and a `placeRun` at speed
  above its kicker.
- **Silence what you're not testing.** `rivals: 0` takes the field out,
  `countdown: 0` the lights, `quiet: true` the log; `flatLevel()` has no trees
  and no kicker; `steer: 0` isolates pitch from roll; `tuck: 0` keeps the
  drag area and the crouch out of a measurement about the edge.
- **Build the precondition, then assert you built it.** A powder test skis
  until the skis have floated up and then `expect(state.skier.contacts[…].sink)`
  is under a few centimetres before measuring anything — so a tuning change
  that keeps him bogged fails at the precondition instead of silently passing
  a test whose scenario never happened.
- **Reference thresholds from `TUNING` and `SKIS`, not copied literals.**
  `SKIS.topSpeed` is an EXPECTATION the physics reproduces within a stated
  tolerance on the reference pitch in a tuck; that tolerance is the one
  literal a test carries. A speed on a grade is `terminalSpeed(spec, grade)`.
- **Attitude off the quaternion, not Euler.** `pitch` folds at ±90°; count
  rotation as `∫ −wx dt` and "right way up" as `rotate(q, up).y`.
- **One scenario per behaviour, named after it.** The repro for a bug becomes
  the regression test, in the topic's `tests/<topic>_test.ts`.
- **Whole-run scenarios** (does the bot finish this map?) go through
  `simulateRun` with a real seed — see `simulate-run`.

## The bench and the browser

- **The ride lab stages the same way.** `scripts/lib/ride-scenarios.mjs` is a
  list of `RunMoment`s and scripted inputs on the synthetic maps; `make ride
  SCENARIO=<id>` draws what a test would measure. A moment worth a test is
  usually worth a scenario there — add it in the same change.
- **The built app is staged by URL, not by `placeRun`.** `make screenshots`
  opens `?start=race&seed=&t=&shot=1`: a generated run with `t` seconds
  skied by the bot, held still. `make world` skis one seed and seeks named
  views (`jump`, `landing`, `furrow`…). There is no `?scene=` that stands the
  app at an arbitrary `RunMoment` yet; the sibling `game3`'s `scenarios.ts`
  (one DOM-free list read by a test, the ride lab and the screenshot harness)
  is the model when one is needed. `playtest` has the loop.

## Skill self-improvement

When a staging need doesn't fit the current engine surface (a `RunMoment`
field that does not exist, a map the builders can't express), grow
`place.ts` / `tests/support/synthetic.ts` plus their tests, then document the
option here. Recurring stagings and gotchas are lesson fragments — load
**`skill-reflection`** at both ends (`npx ogf-skill-lessons
test-scenario --list`).
