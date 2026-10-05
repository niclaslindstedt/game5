# Giant slalom — draft spec

**Draft. Research first, then build.** Delete this file when the giant
slalom is finished (see `README.md`).

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*.
2. The closest thing built is the SLALOM: two runs, interval start, strict
   gates — the giant slalom is mostly new NUMBERS on the same machinery,
   plus panel gates. The downhill (built) already factored the setter's
   preparation out (`engine/mapgen/course-prep.ts`, a `CoursePrep` row a
   discipline) and added panel gates under the strict rules
   (`Checkpoint.panels`), a race HUD every discipline reads (`RaceHud`) and
   `make sim ARGS="--mode …"` — read `README.md`'s *Lessons from the
   downhill* and start from those.
3. Research the to-do below into `docs/disciplines.md` before writing the next free R-rule — R33 after the downhill's R32; the ids run contiguous (`tests/docs_rules_test.ts`).

## Watch out (from the slalom)

Read `README.md`'s *Lessons from the slalom* first; for a giant slalom in
particular:

- **The ski's geometry sets the turn.** The giant slalom pair is now built to
  the rules (193 cm, 65 mm, 30 m sidecut); at 68° it carves R ≈ 30 · cos 68° ≈
  11 m, and the research's typical turn is ~20 m (least ~13 m). The
  technique lab's TURNS sheet showed 10 m — the technique row (its most edge,
  its transition: cross-under on the flat, cross-over on the steep — the
  row's `cross`, data today) has to bring it into the band, not the ski.
- **Run the technique lab before and after every change** (`make technique
  ARGS="--techniques=giantSlalom"`), and give the giant slalom its own
  course in the lab (`--course`): on the open piste the bot follows the
  centreline and the giant slalom's numbers there mean nothing.
- **The bot runs wide on bends with long skis** (the downhill pair missed
  gates in `make sim ARGS="--skis all"` until the bot read the carve as
  sidecut · cos(edge)); make sure `turn-model.ts` reads the giant slalom row.
- **Panels change the gate.** A panel gate is knocked differently from a
  bare flex pole (`gate-poles.ts`), and the cross-block is the hands and
  arms, not the slalom's punch (`technique-pose.ts`'s GS row exists).
- **Generalize, don't copy:** the slalom's setter, par and board were
  written for one discipline; factor what the giant slalom shares out of
  `slalom.ts`, `par.ts` and `field.ts` first, with the slalom's tests green
  the whole way.

## What it is

The technical speed discipline between the slalom and the speed events:
fewer gates set further apart than a slalom, each a pair of poles with
panels, turned on long skis with a big sidecut — round carved arcs at a
higher speed, two runs on two courses set on the same hill, the second run
in reverse order of the first's best, the combined time ranked.

## What the game already has to reuse

- `setSlalom` (`engine/mapgen/slalom.ts`): the stretch search, kicker
  levelling, tree clearing, the racing line, two runs on two salts. A giant
  slalom is the same shape of setter with its own numbers — factor the
  shared part out rather than copying it.
- Strict gates (`engine/game/strict.ts`): feet through the gate line, the
  miss, the DSQ/DNF. A giant slalom gate is two poles with PANELS (a
  turning pole and an outside pole each carrying a panel) — the judging line
  is the same idea.
- The interval start, the board dealt about par (`field.ts`, `par.ts`), the
  start house and the television start (`start-house*.ts`,
  `camera-start.ts`), the second run (`slalom-heat.ts`), the board HUD.
- The per-discipline riding technique (the physics work on
  `feat/slalom-physics`): a giant slalom row.
- The giant slalom pair already in the catalog (`CHOUGH`, `defs/skis.ts`).

## What it needs to be complete

- [ ] **Course rule (the next free R-rule)** in `engine/mapgen/discipline-rules.ts`, mirrored
      in `docs/level-generator.md`: vertical drop band, direction changes as
      a share of the vertical, gate distance band, gate width, panels, how
      the course uses the terrain (rolls, traverses, fall-line changes), the
      finish and the run-out.
- [ ] **Gates with panels**: drawn (a panel between two poles at each end of
      the gate, red and blue alternating) and their flex-pole physics (a
      panel gate is knocked and springs back differently from a bare pole).
- [ ] **The setter**: the stretch (a giant slalom wants more vertical and
      more width than a slalom), the gate rhythm (rhythm changes, open and
      turny sections, no hairpins/verticals), the racing line round the
      gates, both runs.
- [ ] **Mode and rules**: `GameMode` row, `RunRules` (interval start,
      strict gates, start window), the pair it is skied on.
- [ ] **The jury's weather**: `jury: JURY.giantSlalom` in its `RunRules` — the
      row is already in `defs/modes.ts` (60 km/h of gust at the start, raced
      in any fall); `createGame` eases the map to it (`jury.ts`'s `juryDay`).
      The research is `docs/disciplines.md` § *The jury's weather*.
- [ ] **Technique row**: the edge roll rate, the edge angle used, long-radius
      bias, carve-over-skid, the transition, the stance — off research.
- [ ] **Bot**: skis the giant slalom line at race pace; finishes every seed
      in `make sim`.
- [ ] **Par and board**: `par.ts` generalized (or a giant slalom par),
      calibrated to the bot; the field's spread and DNF/DSQ rates.
- [ ] **HUD**: the board, splits at timing points, run 1 / run 2, the out
      plate — reused from the slalom, checked against this discipline.
- [ ] **Cameras**: the television start; any broadcast angles particular to
      this discipline (research).
- [ ] **Audience**: placement along a giant slalom (research — likely like
      the slalom's, along longer stretches).
- [ ] **Sound**: the panels knocked, the edge at speed.
- [ ] **Its nine pinned maps** (`docs/specs/RACE_MAPS.md`):
      `RACE_MAPS.giantSlalom`, nine seeds whose course makes a GOOD giant
      slalom (its vertical band, steep enough, wide enough for its gates;
      the bot home on both runs), swept, looked at, rated and laddered;
      held by `tests/race_maps_test.ts`. The campaign's rungs are optional
      and later.
- [ ] **Front door**: the discipline turned on in `DISCIPLINES` and on the
      SLALOM tile's coming line / its own tile.
- [ ] **Labs**: the technique lab's giant slalom column; `make level` /
      `analyze` showing the course; `sim` before/after.
- [ ] **Tests**: course rules, gate judging with panels, the board, the bot
      finishing.
- [ ] **Docs**: `docs/disciplines.md` (the research), getting-started,
      configuration (`?start=` value), architecture, AGENTS.md rows; delete
      this spec.

## Research to-do

Write every finding into this discipline's section of
`docs/disciplines.md` (numbers with sources, estimates marked, no names),
then tick it here. Researched so far: the course's vertical, gate
spacing and direction changes, the ski rules, the technique (turns, edge,
skid, transition, body, load, tuck, jumps, forces), the speeds and the
start (estimated) — `docs/disciplines.md` § *Giant slalom, super-G and
downhill*. The rest below is still open.

- [ ] The competition rules for a giant slalom, restated generically:
      vertical drop bands by level, direction changes as a % of the vertical,
      gate width, panel size, the distance between gates, the start interval
      and window, two runs and the second run's order, what a DSQ is (miss,
      straddle, panel rules).
- [x] Ski rules: length minimums and sidecut radius minimums by category.
- [x] Technique (biomechanics studies): turn duration (~1.4–1.5 s noted),
      turn radius, peak edge angle and where it peaks, skid angle, ground
      reaction forces, knee/hip flexion, inclination/angulation, load split,
      transition style, pole use.
- [x] Speeds: average and peak, run times, how much of a run is in a tuck.
- [ ] How a racer clears a giant slalom gate (body inside the line, the
      shoulder or shin past the turning pole; panels).
- [x] How the start works (pushes, skating steps).
- [ ] Where spectators stand; broadcast camera positions.

## Open questions for the user

- Is a giant slalom a separate tile, or are all disciplines one RACE tile
  with a discipline picker?
- Should the campaign mix disciplines on a shelf, or have a shelf per
  discipline?
