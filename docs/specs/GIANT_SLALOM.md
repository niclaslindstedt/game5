# Giant slalom — draft spec

**Draft. Research first, then build.** Delete this file when the giant
slalom is finished (see `README.md`).

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*.
2. The closest thing built is the SLALOM: two runs, interval start, strict
   gates — the giant slalom is mostly new NUMBERS on the same machinery,
   plus panel gates. Start by reading `engine/mapgen/slalom.ts` and deciding
   what to factor out into a shared setter.
3. Research the to-do below into `docs/disciplines.md` before writing R32.

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

- [ ] **Course rule (R32)** in `engine/mapgen/discipline-rules.ts`, mirrored
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
- [ ] **Campaign**: which maps carry a giant slalom (steep enough, wide
      enough), rungs, blurbs.
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
then tick it here.

- [ ] The competition rules for a giant slalom, restated generically:
      vertical drop bands by level, direction changes as a % of the vertical,
      gate width, panel size, the distance between gates, the start interval
      and window, two runs and the second run's order, what a DSQ is (miss,
      straddle, panel rules).
- [ ] Ski rules: length minimums and sidecut radius minimums by category.
- [ ] Technique (biomechanics studies): turn duration (~1.4–1.5 s noted),
      turn radius, peak edge angle and where it peaks, skid angle, ground
      reaction forces, knee/hip flexion, inclination/angulation, load split,
      transition style, pole use.
- [ ] Speeds: average and peak, run times, how much of a run is in a tuck.
- [ ] How a racer clears a giant slalom gate (body inside the line, the
      shoulder or shin past the turning pole; panels).
- [ ] How the start works (pushes, skating steps).
- [ ] Where spectators stand; broadcast camera positions.

## Open questions for the user

- Is a giant slalom a separate tile, or are all disciplines one RACE tile
  with a discipline picker?
- Should the campaign mix disciplines on a shelf, or have a shelf per
  discipline?
