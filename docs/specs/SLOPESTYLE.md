# Slopestyle — draft spec

**Draft. Researched, not built.** Delete this file when slopestyle is
finished (see `README.md`). The shared pieces are `TRICK_MODES.md`'s; the
jumps are `BIG_AIR.md`'s; the rails and boxes (JIBS) are first built here.

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*, and read
   `TRICK_MODES.md` and `BIG_AIR.md` first.
2. The research is `docs/freestyle.md` § *Slopestyle* and § *What every
   judged park format shares*: the course (150 m+ of vertical, six judged
   sections of which three jumps, 30 m wide, two lines a section), the
   speeds, the format (the best run counting) and SECTION JUDGING (trick
   judges 60 %, composition judges 40 %, nothing after a fall).
3. The closest thing built is the TERRAIN PARK (R20) — kickers down the
   piste in a ladder of sizes. A slopestyle course is a park with rails,
   two lines a section, and judges.

## Watch out

- **Jibs are new physics.** Nothing in the engine slides on anything but
  snow; a rail is a line, not a surface. Build the jib module
  (`TRICK_MODES.md`) on the synthetic slope first (`tests/support/
  synthetic.ts`, `placeRun`), before any course is set.
- **Speed across sections.** 10–30 km/h through a rail section, 55–80 km/h
  into a jump: the course must hand a skier the right speed at each
  feature with no skating between. The ski cross's lesson holds: search
  the profile offline for the speed the bot actually carries.
- **Two lines a section.** A section is several features side by side; the
  bot picks one, the judge reads the choice (composition). The setter
  must leave room for both lines and their landings.
- **Gates are wrong here.** A slopestyle has no gates; a reset stands the
  skier at the last SECTION, not a checkpoint (`resetPose` reads gates
  taken).

## What it is

A run down a course of features in a row — rail and box sections, then big
jumps — each section offering two or more lines, one trick a feature. The
judges score the whole run: what was thrown on each section, and how the
run flowed as a whole. Qualification best of two runs, a final of two or
three, the single best run counting.

## What the game already has to reuse

- The terrain park (R20) and its built kickers; the big air jump's shape.
- The strokes, grabs, switch, the landing graded.
- The race field's interval start and the board dealt about par.
- The finish arena and the audience.

## What it needs to be complete

- [ ] **The course (the next free R-rule)**: set over a built map's piste
      (or the ski area's widest course): 150 m of vertical at least, a
      mean slope of 10°+, ~30 m wide, SIX SECTIONS — three rail sections
      (each two or three features side by side: a box, a down rail, a
      kinked rail, a wall ride) leading into three jump sections (each two
      kickers side by side, sized up the ladder, the last the biggest) —
      a finish of 25–30 m. Prepared and groomed (`course-prep.ts`), held
      by the analyzer, mirrored in the docs.
- [ ] **Jibs** (`TRICK_MODES.md`): rails, boxes, a wall ride — mounted,
      ridden, left; the reader names the trick (the stance, the degrees
      on and off, swaps, pretzels, blind).
- [ ] **Mode and rules**: a `GameMode` row; one rider; the strokes'
      ceilings raised (1440–1800 on the last jump at the top level).
- [ ] **Section judging**: trick panels scoring two or three consecutive
      sections each 0–100, a composition panel scoring the run's flow,
      line and variety 0–100, weighted 60/40; every section after a fall
      zero for the trick judges, a set score a section completed for the
      composition judges.
- [ ] **The format**: qualification (two runs, the best), final (two or
      three runs, the best), reverse order; ties.
- [ ] **The field**: rivals dealt section scores about par, shown between
      the player's runs.
- [ ] **The bot**: picks a line through each section, rides a rail, holds
      the speed the next jump needs, throws tricks it can land.
- [ ] **HUD**: the section count, the trick named, the scores after the
      run (the trick panels' and the composition's), the board.
- [ ] **Cameras**: a follow-cam down the course (the broadcast's), the
      jumps side-on.
- [ ] **Audience**: the jumps' landings and the finish.
- [ ] **Sound**: a rail's ring and scrape, a box's slide.
- [ ] **Its maps**, **labs** (a course lab: the sections, the speed down
      the profile; `make sim ARGS="--mode slopestyle"`), **tests**,
      **docs**; delete this spec.
- [ ] **The pair and the build preset** (`TRICK_MODES.md` § *Research, the
      pair and the build*): the park twin-tip that both jibs and jumps — the
      Raven (big air's) or the Hare (the rail jam's), or a pair between
      (*research what slopestyle athletes ride*), and the default build off
      slopestyle's athletes (big air's freeskiers, ~72 kg for men, the
      medium build, are the same riders — confirm) — rows in `RACE_SKIS` and
      `RACE_RIDERS`, so picking the format opens the ski card on its pair
      and the dress card on its build.

## Research to-do

Research EXTENSIVELY before building (`TRICK_MODES.md` § *Research, the
pair and the build*): several sources for every number that shapes the
build, written into `docs/freestyle.md`.

- [ ] **The rules and the conditions**, in full: the field of play and a
      championship venue's real size, the format, the judging and a fall,
      the snow it is prepared to, the speeds, the wind and light a jury
      holds for.
- [ ] **The skis**: the park twin-tip that both jibs and jumps — the Raven
      (big air's) or the Hare (the rail jam's), or a pair between (*research
      what slopestyle athletes ride*).
- [ ] **The default player weight**: slopestyle's athletes (big air's
      freeskiers, ~72 kg for men, the medium build, are the same riders —
      confirm) — which of the four builds (`RIDERS`), argued from what the
      format pays weight for.

- [x] The course minimums, the sections and lines, the speeds.
- [x] The format and section judging.
- [ ] A top-level course's real sizes (the course length — now an estimate
      of 500–800 m — each jump's lip and table, the rails' lengths and
      heights on a championship course).
- [ ] How the composition judges score flow and line in practice.

## Open questions for the user

- Section judging (the top level's) or one overall impression?
- Two lines a section from the start, or one line first?
