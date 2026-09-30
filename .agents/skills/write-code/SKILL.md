---
name: write-code
description: "Use before writing or changing ANY code in this repo — engine, app, scripts, tests. Owns every rule about the code itself: what a comment is for and the COMMENT PRUNING pass that strips history references and promotes the lessons worth keeping, leaving the tree cleaner than you found it (every warning, every needlessly bad algorithm), the sub-second edit loop, the 1000-line file cap, the test conventions, and the generic pools and import aliases. Load it alongside the skill that owns the SUBJECT — this one is about the code, that one is about the thing."
---

# Writing code

Load this **whenever a task will change a source file**, alongside the skill
that owns the subject (`engine-system`, `ski-physics`, `snow-look`,
`mapgen-improvement`, `bot-improvement`, …). That one knows what you are
building; this one knows how code is written here.

**Read this skill's lessons first** —
`npx ogf-skill-lessons write-code --list`, then the ones your task
touches (`--scope=…`, `--concepts=…`). Reflecting them back before the commit
is the `skill-reflection` skill's job; load it at both ends of the session.

**Where a given piece of code GOES is not this skill's question** — that is the
"Where new code goes" table and the "Hard rules" in `AGENTS.md`. Read those
first when the location is in doubt; come back here for how the code inside the
file reads.

---

## Comment pruning

The comments in this repo carry real design reasoning and are worth having.
What they should not carry is **the history of how the code got here**: "it
used to be", "the old behaviour", "this replaced", "previously". Every one of
those is already in the repo's history, told better and with the diff attached.

### Where it comes from — so stop doing it

An agent changes a number and writes a comment narrating the change. That reads
perfectly at the moment of writing and is landfill a month later, because the
reader has no idea which "used to" is from which change or whether any of it is
still true.

> **The commit message and the PR description are where a change is narrated.
> A comment is where the code that is there is explained.**

Write the comment for somebody who has never seen the previous version, because
that is who reads it.

### Prune what you touch

Pruning is **opportunistic, not a sweep**: when you open a file to change it,
prune the comments in it. Do not go hunting the whole tree unless the task is
explicitly a pruning pass — and if a prune balloons past the change that
prompted it, split it into its own commit so the real diff stays readable.

### The decision table

| The comment says… | Do |
| --- | --- |
| How the code works, why a number is that number, what a caller must not do | **KEEP** — this is the comment doing its job |
| What the code USED to be, and nothing else | **DELETE** |
| A live rule, _justified by_ what it used to be | **REWRITE** — keep the rule, restate the reason in the present, cut the story |
| A rule bigger than this file (a seam, a budget, a trap in another module) | **VALIDATE**, move it to a lesson fragment or the doc that owns it, then delete |
| Commented-out code | **DELETE** |
| A restatement of the line below it (`// increment i`) | **DELETE** |
| A `TODO`/`FIXME` whose condition has already been met | **DELETE** — do the thing or drop the note |

**The third row is the one that matters, and the one a careless pass gets
wrong.** History is usually _welded to_ a real rule rather than standing alone,
so deleting the paragraph deletes the reasoning with it. Keep the claim; drop
the narrative.

### Moving a lesson out of the code — VALIDATE FIRST

Some history comments are load-bearing: they are the only written record of a
trap that bites somewhere else in the tree. Those get promoted rather than
deleted — but **a comment is not evidence.** It was written against a version of
the code that is gone, and the thing it warns about may already have been
fixed, renamed, or made impossible. **A false lesson is worse than no lesson**,
because the next session obeys it.

Three gates before anything leaves a comment and becomes a fragment:

1. **Is it still TRUE?** Prove it against today's code — read the function it
   names, run the test that would fail, `grep` for the pattern it forbids.
   **When a comment names a symbol, grep for it first** — a symbol whose only
   remaining hits are other comments is a GHOST, and ghosts travel in packs:
   sweep every hit in one pass, or the next session finds the survivors and
   assumes the thing is real.
2. **Is it bigger than this file?** A rule that only explains the function it
   sits above stays a comment. Promote only what a session working in a
   _different_ file would need and would not find.
3. **Does something already say it?** Check `AGENTS.md`, the doc named in its
   sync table, and the owning skill's `SKILL.md` and lessons
   (`npx ogf-skill-lessons --scope=<path>`). A rule in two places
   drifts, and then neither is trustworthy.

Then write it where it belongs — the doc if `AGENTS.md`'s sync table names one,
otherwise a lesson fragment on the skill that owns the subject. Only then
delete the comment.

### Finding them

```sh
grep -rnE '(//|\*) ?.*\b(used to|previously|formerly|originally|no longer|we once|old behaviou?r|this replaces|renamed from|before the refactor)\b' --include='*.ts' --include='*.tsx' --include='*.mjs' <path>
```

Read every hit — the phrase is a _candidate_, not a verdict. "No longer" is
often a live statement about how the code behaves today, and that one stays.

---

## What a comment is for

- **The WHY, not the WHAT.** The code says what it does. A comment earns its
  place by saying what the code cannot: the reason for a number, the invariant
  a caller must not break, the thing that looks wrong and is deliberate.
- **Units and ranges on every tuning number** (metres, m/s, m/s², seconds,
  radians, kg, kg/m³, 0–1). The engine works in SI; a bare number in
  `defs/tuning.ts` or `defs/skis.ts` without a unit is a bug waiting for its
  next reader.
- **A physical model names its source.** Every force in `skier.ts`,
  `suspension.ts`, `snow.ts`, `poles.ts` and `flight.ts` comes from a
  model with a name (the raycast vehicle the legs are built as, Coulomb
  friction, Bekker's pressure–sinkage, the planing-hull analogy the float
  is built on, the sidecut's carve radius, the sequential-impulse solver)
  — the comment above it says which,
  and which term was simplified or clamped and why. A number that is an
  arcade dial rather than a measurement says so, because the two are argued
  about differently: one against the world, the other against the feel.
- **Match the file's density and voice.** This repo's engine and defs modules
  are deliberately prose-heavy, and that is the house style — pruning is about
  HISTORY, never about stripping a file back to bare declarations. A file whose
  neighbours all carry a block header gets one too.
- **Name the failure a rule prevents.** "A penalty spring stiff enough to hold
  the body off a slope stores the whole impact and hands it back — the skier
  who hit the foot of a headwall was fired forty metres up it" beats "use
  impulses for the body".

---

## Leave the tree cleaner than you found it

- **Fix every error and warning you encounter, even ones you didn't cause.** A
  `make lint` / `make test` / typecheck run that surfaces a pre-existing error
  or warning is part of the job: fix it in the same session rather than working
  around it or reporting it as "not mine". The baseline is zero errors and zero
  warnings — anything above zero hides the next real regression.
- **Fix inefficient algorithms on sight.** A needlessly bad complexity or a
  wasteful hot-path pattern (a linear scan over every tree or every track
  segment each step where the level's hash works — `treesNear`,
  `nearestTrackPoint` — per-step allocation inside `step()` — it runs 120×/s —
  per-frame allocation in the renderer, the clipmap's update or the trail
  map's stamping) gets fixed
  even when it is unrelated to the task. Keep the fix behaviour-preserving,
  verify it with the relevant tests (and `make sim` when it touches the
  engine), and mention it in the PR description.
- **Prune the comments in what you touch** (above).
- Never widen the scope past this. Refactoring a module you merely read is not
  leaving the tree cleaner; it is a second PR.

---

## The edit loop

Whole-repo checks cost the same whether one file changed or four hundred did.
**They are the GATE on the commit, not a step on the way to it.**

**Do not lint or format after every edit.** A whole-repo `eslint`/`tsc` pass
between one Edit and the next is minutes of a session spent re-checking code
nobody touched, and it teaches nothing an edit later would not have found.
Batch instead: make the whole coherent change — every file the feature needs —
and check once at the end of it.

Inside that batch, when a specific answer is genuinely needed (a type you are
unsure of, a test whose subject you just rewrote), check only what you touched:

| Just edited | Run |
| --- | --- |
| a `.ts`/`.tsx`/`.mjs` file | `npx eslint <paths>` |
| anything type-bearing | `npx tsc --noEmit -p tsconfig.json` (or `pwa/tsconfig.json`) |
| a test's subject | `npx vitest run tests/<that-one>_test.ts` |
| skis / snow / generator numbers | `npm run sim -- --seeds 1,2,3` — a slice, not the whole sweep |
| the generator | `make analyze SEED=1` and `make level SEED=1` — seconds, no build |
| the edge, the skid, the tuck, the sink, the flight | `make ride SCENARIO=<one>` — seconds, no build |

**Never run `prettier` or `make fmt` mid-loop.** Formatting is not information:
it cannot tell you whether the code is right, and `make fmt` once before the
commit fixes everything it would have found. Same for `npx eslint` over a whole
directory — name the files you changed, or leave it to the gate.

The full gate, split by cost, belongs to the `commit` skill — load it when the
work is done. One of its rules is worth carrying into the edit loop: verify
with `make test` / `make lint`, **never** a bare ad-hoc invocation habit (the
Make targets are the definition of green CI enforces).

---

## File size

- Non-test source files stay under **1000 physical lines** (§20.5 of
  `OSS_GAME_SPEC.md`); `tests/file_size_test.ts` holds the cap. Past it, split
  by concern — sibling modules, extracted helpers — rather than relaxing it.
  A file that big is nearly always doing more than one thing (the skier's
  forces are already six files: `skier.ts` the body, `suspension.ts` the
  legs and their stations, `snow.ts` the ground, `poles.ts` the push,
  `flight.ts` the air, `chassis.ts` the body's points).
- Splitting a file is also the moment to prune it: an oversized module usually
  has history in it.

---

## Tests

- **Tests live in the root `tests/` directory, never inline in source.** One
  file per topic, named `<topic>_test.ts` — the `_test` suffix is mandated by
  OSS_GAME_SPEC §20.2. Runner: vitest via `make test`;
  the include pattern (`tests/**/*_test.ts`) is in `vitest.config.ts`.
- **No DOM, no browser, plain Node** — that is the actual line, not "engine
  only". A `pwa/` module whose whole import graph is DOM-free is fair game and
  several are tested that way (`input_model_test.ts` over `input-model.ts`,
  `world_render_test.ts` over `camera-rigs.ts`, `skier-pose.ts`, `sky.ts` and
  `trail-stamp.ts`, `menu_system_test.ts` over `shell.ts`): a camera rig is
  arithmetic, and a rule joining two layers has nowhere
  else to be checked. What unit tests cannot judge is how anything LOOKS —
  that is verified by looking (`make screenshots`, the `playtest` skill).
  **The WHOLE import graph is the test, and vitest will not tell you.** The
  root `tsconfig.json` has no `dom` lib, so a test that reaches a module
  which transitively imports `pwa/src/game/input.ts` (or anything else
  touching `document`, `window`, `navigator`) RUNS green under vitest and
  fails `make lint` later, with errors pointing at the DOM module rather
  than at your test. **An `import type` counts** — the import is erased at
  runtime but the module it names is still type-CHECKED, so one type pulled
  from a DOM-touching module poisons an otherwise DOM-free one. The root
  config sets no `jsx` either, so a `.tsx` cannot be reached AT ALL — `import
  type { HudProps } from "./hud.tsx"` fails with `TS6142: '--jsx' is not
  set`. State the shape locally instead — best as a `Pick<>` of a type the
  DOM-free side already owns — which narrows the parameter to what the module
  actually needs and restates nothing. Check the import chain before writing
  the test, and when a pure model sits in a module that is not DOM-free,
  split it the way the input already is (`input-model.ts` decides,
  `input.ts` listens); do not widen the root config.
- Import the engine through the **`@engine`** alias (→ `engine/index.ts`),
  never a relative path into `engine/`.
- Physics tests stage a **synthetic map** from `tests/support/synthetic.ts` —
  `syntheticLevel()` (the SLOPE: a packed piste down a face with a kicker,
  rollers and a lone tree) or `flatLevel()` (a drag strip on a grade of its
  own, all packed or all powder) — handed to `createGame({ level })`, stood
  at a moment with `placeRun`, and skied by inputs scripted step by step —
  see the `test-scenario` skill.
- Simulation tests use `simulateRun` — deterministic, so digests can be
  compared exactly.
- **A file that asserts a dozen rules over the same spread of seeds takes its
  levels from `tests/support/levels.ts`** rather than generating them per
  `it`: the generator is deterministic per seed, so the second build can only
  return the first one's answer, and building one is the most expensive thing
  the engine does. What comes back is SHARED and read-only.
- Assert the rule you claim. "No edge grip with the skis off the snow" is a
  claim and owes an assertion.
- No extra test dependencies; everything runs on plain Node.

---

## The generic pools, and the aliases

- **Keep generic game code separate.** Anything not specific to THIS game
  (math, PRNG, value noise, the heightfield engine-side; general UI utilities
  app-side) goes in the shared framework (`@niclaslindstedt/oss-game-framework`:
  `core/` for the engine, the rest for the app — fixed there, never copied
  back) or `pwa/src/lib/` — never tangled into a game-specific module. The powder's
  sink law is THIS game's (`engine/game/snow.ts`); the noise under the hills
  is not (the framework's `core/noise`).
- **The engine's only public surface is `engine/index.ts`.** Export new
  types/constants the app or the tests need from there; the app and tests
  import `@engine`, nothing deeper.
- **The app renders with Preact and still spells it `react`.** `react`,
  `react-dom` and `react-dom/client` are aliased to `preact/compat`
  (`pwa/tsconfig.json` `paths` + the Vite preset), so components written
  against the React hook API keep working without `@types/react`. Do not
  install React.
- **No TypeScript that a stripper cannot strip.** Everything under
  `scripts/` runs on `node --experimental-strip-types`, which erases types
  and refuses anything that EMITS code: parameter properties
  (`constructor(private readonly x = 1) {}`), enums, and namespaces. Those
  typecheck, build and run in the browser, so neither `make lint` nor
  `make test` catches them — the first sign is a lab script dying with
  `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` on an import three files from the
  change. Declare the field and assign it in the constructor body; use a
  union of string literals instead of an enum. A script that needs an app
  module (`skier-pose.ts`, `strings.ts`) goes through `aliasEngine` from
  the framework's `tooling/alias` before the `import()` — never a Vite build
  to read a table.
- **Every dependency comes from the public npm registry.** The repo commits
  no `.npmrc` and `npm install` needs no token.

---

## Checklist

- [ ] Loaded the skill that owns the SUBJECT, and read both skills' lessons
- [ ] The code sits where `AGENTS.md`'s tables say it sits; the hard rules hold
      (engine imports nothing from `pwa/`, renderer never mutates `GameState`,
      randomness only via the state's seeded RNG, the map is a pure
      function of its seed)
- [ ] Comments in every file touched are pruned: no history, no dead code, no
      restatement — and every rule kept, in the present tense
- [ ] Every physical term names its model; every tuning number carries a unit
- [ ] Anything promoted out of a comment was VALIDATED against today's code
      before it became a fragment, and the comment is now gone
- [ ] Every warning the session saw is fixed, not stepped around
- [ ] Files still under 1000 lines; tests in `tests/`, `_test.ts`, via `@engine`
- [ ] No `prettier`/`make fmt` mid-loop; the whole-repo gate ran ONCE, at the end
- [ ] `skill-reflection` CLOSE pass run for every skill loaded
