---
name: mapgen-improvement
description: "Use when improving the WORLD GENERATOR (engine/mapgen/) — the rules engine that builds every mountain fresh from its seed: the summit ridge, the valley floor and the concave face between them, the spurs and gullies down the fall line, the bowls, the rollers and the headwalls, the kickers on the rolls and on the piste, the PISTE — one open descent graded down the face from a start gate near the summit to a finish straight on the valley floor — and the packed snow on it, the drifts across it and the windrows along it, the start line four abreast behind the start gate, the gates down it to the finish, the forest, its glades and the tree line, the day. Owns the module split (rules.ts data / generate.ts search / terrain, track, kickers, spawn, forest, sun / compile.ts geometry / query.ts the piste asked), the R-rules and their verbatim mirror, the PISTE-AND-TERRAIN craft (sculpting the face, the descent that never climbs, the kickers, the start), and above all the LOOP: write, generate, ANALYZE (`make analyze`), fix, reflect on whether the analyzer measured the right thing, LOOK with `make level`, iterate, then take another seed."
---

# Improving the World Generator

A change here lands on **every mountain on every seed at once** — every seed a
player shares, every map in every test sweep. That leverage cuts both ways: a
regression you cannot see on the seed you happened to draw is still shipping
on the other several thousand.

Which is why the centre of this skill is not the rules. It is the LOOP.

**Before starting, read this skill's lessons** —
`npx ogf-skill-lessons mapgen-improvement --list`, then the ones
this task touches (`--scope=…`, `--concepts=…`). Load **`skill-reflection`**
at both ends of the session, and **`write-code`** beside this one.

---

## THE LOOP

```
   1. write code
   2. generate a map            make analyze SEED=7    (builds it and scores it)
   3. run the analytics         …read the FINDINGS, not the verdict
   4. improve the generator     fix the worst finding
   5. reflect on the ANALYSIS   was that a defect, or a check measuring wrong?
   6. LOOK                      make level SEED=7      (the plan, every gate numbered)
   7. iterate on this seed      until it comes up clean
   8. take a different seed     and do it all again
   9. when several seeds hold   make analyze COUNT=24, make sim, then commit
```

The two halves of every pass, and neither is optional:

```sh
make analyze SEED=7          # MEASURE: every finding, named by its R-rule
make level SEED=7            # LOOK: the face, the forest, the piste, the kickers, the start, the gates
```

`make level` (`scripts/level-map.mjs`, drawn by `scripts/lib/level-draw.mjs`)
draws the mountain from above — the face shaded by height with the summit
ridge at the top and the valley floor at the bottom, the forest and the tree
line, the piste and its packed shoulders, every gate NUMBERED, every kicker
labelled (`K1…` on the piste in skiing order, `X1…` off it), the start gate
and the start line — and prints a table of the gates beside it with the
grade between each pair (`ARGS=--json` for the listing as data). A claim
about "the third gate on seed 38" is a claim about a row there. Engine only:
no build, no browser, a couple of seconds.

`make analyze` (`scripts/analyze-level.mjs` over `engine/analysis/`) re-checks
the FINISHED map against the rule book and names each finding by its rule
(`R5 error: piste is 2210 m (band 2400–3800 m)`), with the stats worth reading
even when nothing is wrong (length, the vertical, the tightest radius, the
steepest and the mean grade, the longest traverse, the kickers, the trees on
the corridor, the sun). It exits non-zero on an error; `COUNT=24` sweeps
seeds 1–24.

**Step 5 is the one that is easy to skip and the one that makes the rest
worth doing.** An analyzer is only as honest as its checks. Every time a
finding comes up, ask which of three things it is:

| The finding is… | Do |
| --- | --- |
| A real defect | Fix the GENERATOR. The normal case. |
| A check measuring the wrong thing | Fix the CHECK in `engine/analysis/`, and say why in the comment. |
| A real property of the game, scored as a fault | Move the number in `rules.ts` — **only with a MEASUREMENT behind it** (the sim clearing it, the ride lab landing it), written into the comment. |

Instruments agreeing on a LOCATION is evidence; a finding that appears on
every seed at the same VALUE is the measurement bug (a check reading a clamp).

**Never widen a rule to make the exit code green.** The generator REJECTS on
the analyzer's verdict, so a widened band ships the map it was meant to
refuse.

### If it can be measured, the ask comes with a CHECK

When somebody asks for something here and no existing check can tell whether
it is right, writing that check is part of the job, in the same pass. A map
is built fresh from its seed every time, so a quality nobody measures
survives exactly until the next tuning pass moves a number under it.

1. **Name the property in one sentence** — "every kicker on the piste has a
   run-in that is not a bend".
2. **Extend an existing check if one nearly covers it.**
3. **Decide the SHAPE before the threshold** — a floor, a ceiling, or a BAND
   (gate spacing, the piste's length, the vertical, the number of kickers:
   too few is as wrong as too many, and only a band says so).
4. **State the threshold in `rules.ts`** (the generator builds to it and the
   analysis holds the map to the same number), or, for a pure measurement
   tolerance, as a named constant in `analysis/index.ts` with its reason.
5. **Then build the thing.**

A property that cannot be measured — "does this read as a mountain somebody
groomed a piste down" — is what `make level` and `make world` are for. Say so
out loud rather than inventing a proxy nobody believes.

---

## The modules, and their jobs

| File | Job |
| --- | --- |
| `types.ts` | **The map as everyone else sees it.** `Level`, `TrackPoint`, `Checkpoint`, `Spawn`, `TreeDef`, `Kicker`, `GenerateOptions`, `TrackHit`. Read by the skier, the course, the bot, the renderer and every lab — extend it; never rename a field without moving every reader. The optional fields (`packed`, `kickers`, `mountain`, `attempt`) are what a hand-built synthetic level need not invent; `GeneratedLevel` has them all. The `track` is OPEN (`closed: false`): its first point is the start line's row, `checkpoints[0]` the START GATE a few metres down it, the last the FINISH at `s = length`, and `laps` is 1. |
| `rules.ts` | **The rule book.** R1–R22 in prose in the header, every number in `LEVEL_RULES`, each with its unit. Tuning the generator means editing this file — and the prose is mirrored VERBATIM in `docs/level-generator.md` (`tests/docs_rules_test.ts`). |
| `terrain.ts` | **The mountain (R2, R3):** the summit ridge along the top edge, the valley floor along the bottom, the concave PROFILE between them (`vertical · P(u)`, steep under the summit, easing into the run-out), the side ridges either side of the middle third, and over the profile the rolls, the SPURS and GULLIES running down the fall line (ridged noise stretched along z), the bowls above the tree line and the HEADWALLS across the face — a pure function of a PLAN drawn once, baked ONCE onto the grid (`planTerrain`, `bakeCountry`). |
| `track.ts` | **The piste (R5–R8, R10):** a WALK from a seeded start near the summit ridge down the fall line, its heading wandering about the fall line on a slow noise plus a few deliberate SWEEPS (the traverses), every step going downhill, ending on a flat FINISH STRAIGHT where it reaches the valley floor; resampled every 2 m; refused on a crossing, a tight bend, a stretch that climbs or a run past the world's edge; graded into the face; the corridor pressed into the ground and the packed field stamped (`drawPiste`, `gradePiste`, `stampCorridor`). |
| `cliffs.ts` | **The cliff bands (R22):** a level shelf out of the face, a sheer band facing down the fall line, a landing apron falling away below it — stood on a slope clear of the piste, the kickers, the ridges and the ice, off a stream of its own. `onCliff` is what the forest keeps off. |
| `kickers.ts` | **The kickers (R4, R9):** the ramp-and-landing profile, added to the graded line on the piste, stamped into the ground in plan off it — a wind lip on a roll's crest. |
| `trick-field.ts` | **The terrain park (R20):** kickers in three sizes down the piste, the bigger ones with a deck and a landing slope dug under the line — laid only for a tricks run. |
| `spawn.ts` | **Where the run starts (R11–R13):** the start searched for at the top of the piste, the piste indexed so the start line's row is `s = 0`, the start gate a few metres down it, the start line four abreast behind the gate, the gates down the piste to the finish. |
| `forest.ts` | **The forest (R14):** one candidate per cell, jittered, kept by the forest noise, refused by rule — never within `forest.gap` of another trunk, so a skier fits between any two; never above the TREE LINE, an altitude the region sets as a share of the vertical, stunted through the krummholz band under it — and sized by where it stands. |
| `drift.ts` | **The drifts (R17):** stretches of the finished piste dealt off their own stream and stamped into the packed field — wind-blown snow on a traverse. |
| `surface.ts` | **The region's surface (R21):** the wind crust and, where a row lays one, a frozen tarn, folded into the packed field clear of the piste. |
| `sun.ts` | **The day (R15):** latitude, day of the year, a solar hour with the sun over its floor — the arithmetic is the framework's `core/solar`. |
| `compile.ts` | **The geometry:** the baked grids bound into the `Level` and its three queries (`groundAt`, `normalAt`, `packedAt`) as bilinear samples. Nothing downstream regenerates any of it. |
| `query.ts` | **The piste, asked:** `nearestTrackPoint` (off a lazily built spatial hash), `trackPointAt`, `arcAhead`, `arcBetween` — for the generator, the analysis, the physics, the bot and the renderer alike. None of them wraps: the piste is open, `trackPointAt` clamps to `[0, length]` and `arcAhead(a, b)` is `b − a`, negative uphill. |
| `generate.ts` | **The search:** `generateLevel(seed, opts?)`. Each ATTEMPT draws everything from `subSeed(seed, attempt)`, in dependency order, compiles, and asks `analyzeLevel` whether it is clean; a refused attempt re-rolls the next sub-seed, bounded. |
| `index.ts` | The block `engine/index.ts` re-exports. |

And the scoreboard, NOT in `mapgen/` on purpose: `engine/analysis/index.ts`
(`analyzeLevel` → `{ findings, stats, ok }`, each finding naming its rule) and
`crossings.ts` (R5's self-intersection test off a spatial hash). It reads only
what the `Level` publishes — never the plan — because the plan is not what the
skier skis.

**The generator's budget and the analyzer's are OPPOSITE.** The generator
runs in the game, on a phone, behind the loading card every time a run is
stood up, and its grids are then read thousands of times a second — it has to
stay fast (`run-loader.ts` budgets a frame around it). The analyzer runs inside
the generator's reject loop, so it may be dearer than what it measures, but a
seed must stay well under a second.

---

## Piste and terrain — the craft of the mountain

The generator's job is not just legality, it is PLAUSIBILITY: a map has to
read as a mountain somebody groomed a piste down. Each of these is also a
CHECK.

### The real bands, and where the rules sit in them

The numbers in `rules.ts` are inside what real mountains and real courses
measure, and a retune stays inside the same bands (the research behind them
is cited in the rule book's comments, never a name):

- **A piste is graded by its STEEPEST stretch, not its average.** A blue run
  is ≤ 25 % (about 14°), a red ≤ 40 % (22°), a black anything over that; the
  steepest groomed pitches run to about 78 % (38°). The campaign's shelves
  are those three colours (`campaign`), and `engine/rating/`'s steepness axis
  reads the same bands.
- **A downhill course is 3–4.5 km long over 850–1030 m of vertical**, 15–27 %
  on average with pitches of 35–41° and jumps of 40–80 m. R5's length band
  (3000–4500 m) and R2's vertical (850–1030 m) are those bands — a two- to
  three-minute run — and R8's `maxGrade` (−0.70, a 35° pitch) is a black's,
  held outside the kickers.
- **Most piste skiing is 2–25°; off-piste bowls live in the 30–45° band.**
  R3 puts the bowls above the tree line on the steeper face and keeps the
  piste mostly under 25° — the headwalls are the exception, short and
  deliberate.
- **Gates every 90–150 m** (R11) is a giant slalom's spacing at a downhill's
  speed: far enough apart to carry speed, close enough that a line matters.

### Sculpting the face

- **The summit ridge is the top of the world; the valley floor is the bottom.**
  The profile `h(z) = vertical · P(u)` is concave — steep under the ridge,
  easing to the run-out — and the side ridges rise either side of the middle
  third so the playable face is a wide bowl-valley open at the bottom. The
  piste never reaches up a side ridge (R2), and nothing grows above the tree
  line (R14) — bare high snow and rock are the horizon every shot has.
- **Ridged, not lumpy.** The spurs and gullies run DOWN the fall line (ridged
  noise stretched along z) so the face reads as a mountain and a traverse
  crosses something; the rolls (`hills.scale`) set the rhythm of a descent;
  the headwalls are where the piste steepens for a hundred metres and the
  gates come at you; the bowls are where the powder pools. A new term in the
  face goes in `terrain.ts`'s plan and is a pure function of the plan point —
  the search asks "how high is the untouched ground here?" of the same
  arithmetic the bake writes.
- **Grade into the face, never on top of it.** R8 levels the piste across its
  width (a cross-fall of up to `piste.camber` on a traverse), blends it back
  over a bank no steeper than `track.bank.slope`, and smooths the line down
  the descent until every window falls between `minGrade` and `maxGrade`
  and no point is cut or filled more than `maxCut`. A piste whose grading
  needs a bigger cut is a piste in the wrong place — refuse it, do not deepen
  the cut.

### Sculpting kickers

- **A kicker is a profile, steepest at the lip.** The ramp rises as t² and
  the landing falls as (1 − u)², so the lip is a kink no legs can follow —
  that is what throws a skier. A ramp that flattens at its top (a smoothstep)
  hands the skier no upward speed at the one moment it matters: a jump that
  does not jump. `analysis` checks the break in grade across each piste
  kicker's lip (`KICK`).
- **On the piste (R9) the profile is added to the graded LINE by arc
  length**, before the corridor is pressed in, so the kicker is as wide as
  the piste, its banks are the corridor's, and it follows the line through a
  gentle bend. It stands only on a stretch that barely turns (`on.straight`),
  where the run-in is not a compression, and where the line past the lip
  keeps falling — a brow before a steeper pitch, the natural roller. Two
  stand `on.spacing` apart.
- **Off the piste (R4) the same profile is stamped into the ground in plan**,
  on a roll's crest as a wind lip, blending into the snow either side, at
  least `off.clearance` from the piste's edge — something a skier leaves the
  piste to find.
- **A kicker is judged by the flight it gives**, not by its height: `make
  ride SCENARIO=kicker` on the slope's, and `make sim`'s air column over a
  sweep. A kicker that throws the bot into the trees or onto a flat landing
  every run is a kicker in the wrong place.

### The open descent

- **Down, always.** The piste is a walk from the start heading down the fall
  line, its heading allowed to wander ±`piste.swing` about it on a slow noise
  with a few deliberate SWEEPS (the long traverses that make a descent a
  line rather than a drop) — and every step must go DOWNHILL: the raw ground
  under it falls at least `piste.minFall` over every `gradeWindow`, and the
  finished graded line never climbs (`analysis`'s "never climbs" check). A
  walk that has to climb to get round a spur is refused, not helped.
- **It ends on the valley floor.** Where the walk reaches `piste.finishZ` it
  lays a FINISH STRAIGHT of `piste.finish` metres, the one flat on the
  mountain; the finish line is its last gate.
- **Never crossing.** A walk can fold back over itself on a sweep, so every
  draw is checked (R5, `crossings.ts`), and any two parts far apart along the
  piste must stand `separation.plan` apart on the map so no two stretches
  share a bank.
- **Bends a skier can carve** (R6: radius ≥ `minRadius` over `turnWindow`).
  The bot's braking, the pair's sidecut and the bend's radius are a coupled
  set; a tighter rule is a slower run and more resets in `make sim`.
- **The packed field is R10's alone** — 1 on the piste, fading over the
  shoulders, 0 everywhere else (plus the region's crust, clear of it). The
  physics reads it for sink and grip, the renderer for the groomed look; a
  second definition of "on the piste" is a bug.

### The start

- **The run opens ON the groomer** (R12, R13): the start is a seeded x on the
  top third of the world, the piste's first point IS the start line's row
  (`s = 0` there), and the START GATE stands `grid.back + 2` metres down it —
  every arc length a reader meets is measured from the line the field
  stands on. The start line is four abreast straddling the centreline,
  facing down the piste, the player's slot first (leftmost). A start in the
  powder is the free ride's (`freeSpawn`).
- **Searched for, not solved for.** A start is refused on anything unfair or
  unskiable: a kicker's lip within `spawn.kickerGap`, a bend or a pitch
  steeper than `spawn.maxSlope` in the first `spawn.run` metres. A field
  bigger than the line stands its extras further back (`rivals.ts`).

When something looks wrong on the plan, ask which rule of the mountain it
breaks before reaching for a number.

---

## Extending the vocabulary

A new map ingredient follows the settled pattern, in order:

1. Its type in `types.ts` (optional on `Level` if a synthetic map need not
   carry it), and its numbers in `rules.ts` — data first.
2. Placement in the module that owns its subject, in the dependency order
   `generate.ts` states (mountain → piste → piste kickers → corridor → off
   kickers → start → gates → forest → sun).
3. Geometry in `compile.ts` — the `Level` is the ONLY channel.
4. An R-rule in prose in `rules.ts`'s header AND verbatim in
   `docs/level-generator.md`.
5. An invariant test across seeds in `tests/mapgen_test.ts`, over the shared
   corpus in `tests/support/levels.ts`.
6. **A CHECK in `engine/analysis/`** naming the rule — the generator rejects
   on it, which is what makes the feature part of the loop.
7. Physics (`collision` for anything the skier can touch), the bot (it has to
   be able to TAKE the thing — `bot-improvement`), and rendering
   (`terrain.ts`, `forest.ts`, `gates.ts` — `nature`, `snow-look`).
8. A mark on `make level`'s plan and a row in its table.

Skip 4, 5 or 6 and the rule exists only as behaviour — the next tuning pass
undoes it without knowing it was ever a rule.

---

## Invariants — load-bearing, and easy to undo by accident

- **`generateLevel(seed)` is a pure function of the seed.** Every draw comes
  from the attempt's PRNG, in a fixed order. Shareable seeds, the sim digests
  and the test corpus all hang off it. Insert a draw in the middle and every
  later draw moves: every seed re-rolls.
- **Reject, never repair.** A refused attempt re-rolls `subSeed(seed,
  attempt)`, bounded (`attempts`, default 16), and the whole attempt is
  thrown away. The sub-seed derivation is part of the contract.
- **The analyzer is the generator's gate.** A check that fires on every seed
  is a generator that never succeeds — the bound turns it into a loud thrown
  error, and `tests/mapgen_test.ts` is where it shows first.
- **Baked once, sampled bilinearly.** `ground` and `packed` share one 2 m
  grid; the three queries are two lerps. Nothing downstream evaluates the
  noise again; anything that has to land ON a cell searches the field.
- **Published heights are the ground's.** Piste points and kickers carry the
  height the ground actually has there, so a reader of a piste point and a
  reader of `groundAt` under it read the same number.
- **One question, one answer: `query.ts`.** "Where on the piste is this
  point nearest?" is `nearestTrackPoint` for the start, the forest, the
  analysis, the physics, the bot and the renderer; a second implementation
  drifts — and so does a reader that wraps an arc the way a loop's would.
- **Vocabulary numbers are a coupled system.** Gate spacing, the bot's
  lookahead, a pair's terminal speed on the grade, the bend radius and the
  kicker profile agree with each other. That is what the sim sweep is for.
- **Maps must stay finishable.** `tests/simulation_test.ts` is the contract:
  the bot finishes what the generator builds.

---

## Shipping

- **`make analyze COUNT=24` before and after**, and the finding tally in the
  PR. **Compare TALLIES, never seeds** — any rules change re-rolls the search,
  so seed 7 after is a different map from seed 7 before.
- **Both `make sim` tables** (before/after) — finishes, pace, resets and hits
  over a sweep, read off the closing line, never a row.
- **`make level` at more than one seed** and the pictures in front of the
  user. **`make world SEED=<n>`** for how the mountain reads through the
  renderer.
- `docs/level-generator.md` updated if any rule moved (the verbatim list —
  `npx vitest run tests/docs_rules_test.ts` — and the Level table).
- `npx vitest run tests/mapgen_test.ts tests/analysis_test.ts
  tests/docs_rules_test.ts tests/simulation_test.ts tests/determinism_test.ts`.
- A change that moves what a seed builds owes a row in `versions.ts` and
  leaves every pinned campaign map's digest alone (`campaign`).
- A `.changes/unreleased/` fragment: generator changes are player-visible by
  definition.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording: a
tell on the plan, a lever that reliably fixes a look problem, a coupling
between a rule number and the skier — and, specifically for the analyzer,
any check that turned out to be measuring the wrong thing.
