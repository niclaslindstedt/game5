# Super-G — draft spec

**Draft. Research first, then build.** Delete this file when the super-G
is finished (see `README.md`).

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*.
2. The DOWNHILL is built (R32) and is the closest thing: a speed event of
   one run on panel gates, its jumps kept and its crests shaved, A-nets
   both sides, a racing line, a forward par and a line-following bot. Read
   `engine/mapgen/downhill.ts`, `course-prep.ts`, `engine/game/nets.ts`,
   `par.ts`'s `downhillPar` and `engine/sim/downhill-steer.ts` before
   anything else; a super-G is mostly the downhill's machinery on a
   shorter, turnier course with more gates and no training run.
3. What is new is the turns: a super-G's gates MAKE turns (a downhill's only
   mark the line), so the gate spacing and the line's bend come from its
   research, and the bot's line-follower must hold tighter, faster bends
   than the downhill's — measure it with `make sim ARGS="--mode superG"`
   (add the mode to the flag) before tuning.
4. Research the to-do below into `docs/disciplines.md` before writing the next free R-rule — R33 after the downhill's R32; the ids run contiguous (`tests/docs_rules_test.ts`).

## Watch out (from the downhill)

Read `README.md`'s *Lessons from the downhill* — it was written for this
discipline. In short:

- **Reuse, don't rebuild:** `prepareCourse` over a `CoursePrep` row of its
  own (the crest radius tuned to super-G speed), `Checkpoint.panels` under
  the strict gates, `stepNets`, `raceParOf` (add a branch), the field per
  discipline (`field.ts`), `RaceHud` and the plate's union, `raceCourseOf`.
  The research to-do's nets and broadcast items are answered in
  `docs/disciplines.md` § Downhill.
- **A super-G has no training run** — only an inspection (the open
  question below). The downhill's `Field.training` and the plate's RACE
  press are the shape if the answer is a practice run.
- **The front door has no room for a third race tile** on a phone; decide
  with the user where the super-G goes before building the tile.
- **`App.tsx` is at its line cap**: move the race-run plumbing out first.
- **Check the technique row at its own speed** (`edgeLockAt` at ~25 m/s)
  before blaming the bot — the downhill's researched row could not hold its
  line until its `fade` was raised.

## Watch out (from the slalom)

Read `README.md`'s *Lessons from the slalom* first; for a super-G in
particular:

- **Jumps are part of the course here,** where the slalom levelled them.
  The slalom found that a racer over a closed gate was judged by a foot's
  stale contact (fixed in `strict.ts`) and that a field of lips under a
  course put the bot in the air a third of the way — decide which kickers a
  super-G keeps, and smooth the rest.
- **Speed is drag.** Air drag is ~35 % of the energy a super-G loses; the
  tuck's drag areas are in `docs/disciplines.md` (standing ~0.65 m², tuck
  ~0.23, low tuck ~0.17–0.18). The tuck policy (~16 % of the course) belongs
  in the technique row — the slalom bot tucked where it shouldn't, so the
  speed bot can as easily not tuck where it should.
- **Sweep the downhill pair with `make sim ARGS="--skis all"`.** Its misses
  were the first sign the bot couldn't plan a long-ski bend.
- **A crash at speed matters more:** check the wipeout and the body's blows
  (`make ride`'s crash scenarios) at super-G speed before trusting a course.
- **The lab's piste course isn't a super-G.** Until the super-G has a course
  of its own, the technique lab's numbers for it come from the open piste or
  the TURNS sheet's scripted rhythm — label them as such.

## What it is

The speed discipline with gates turned: one run (no second), a course with
fewer, wider-set gates than a giant slalom, long fast turns, jumps and rolls
the terrain gives, at speeds between a giant slalom's and a downhill's. A
racer gets no training run on the course, only an inspection — he skis it
blind at race pace, which is why the course reads from the gates.

## What the game already has to reuse

- The course setter's stretch search and levelling (R31) — a super-G takes
  far more of the mountain, KEEPS its kickers (rolls and jumps are part of the
  course) and needs wider pistes.
- Strict gates (panel gates, as for the giant slalom), the interval start,
  the board dealt about par, the start house and television start, the
  board HUD (one run: no second run, no combined time).
- The tuck and the air physics (`skier.ts`, `flight.ts`, `TUNING.air`), the
  jump and landing load (`landingLoad`).
- The downhill and giant slalom pairs (`EAGLE`, `CHOUGH`); a super-G pair
  may be needed (research whether the class is its own).

## What it needs to be complete

- [ ] **Course rule (the next free R-rule)**: vertical drop band, gate count as a share of
      the vertical, minimum gates, distance between turning poles, gate
      width, panels, the use of terrain (jumps, rolls, traverses), the course
      line's safety margins (run-outs, nets — research).
- [ ] **The setter**: the stretch (long; likely most of the piste), the
      gates over the terrain, jumps kept and judged safe (landing speed
      and slope), the racing line, one run.
- [ ] **Jumps as part of a race**: where a super-G jump is allowed, how far
      racers fly, the landing — the analyzer must hold a jump's landing to
      what a body can take at race speed (`flight.ts`'s landing load).
- [ ] **Mode and rules**: `GameMode` row, one run, interval start, strict
      gates, start window, the pair.
- [ ] **The jury's weather**: `jury: JURY.superG` in its `RunRules` — the row
      is already in `defs/modes.ts` (50 km/h of gust at the start, no heavier
      than a steady fall); `createGame` eases the map to it (`jury.ts`'s
      `juryDay`). The research is `docs/disciplines.md` § *The jury's
      weather*.
- [ ] **Technique row**: long arcs, lower edge angles, a tuck between turns,
      the pre-jump and absorption, stability at speed.
- [ ] **The skis**: is a super-G pair its own class (length, sidecut)? If
      so, a seventh pair in the catalog with its topsheet, model, card row.
- [ ] **Bot**: skis the line at speed, tucks, takes the jumps; finishes every
      seed.
- [ ] **Par and board**: one run; spread and DNF rates for a speed event.
- [ ] **Safety netting**: built for the downhill (`nets.ts`, drawn by
      `gates.ts` off `spectator-plan.ts`'s `netStretch`) — check it reads a
      super-G course through `raceCourseOf`.
- [ ] **HUD**: the board (one run), splits, the speed trap (research
      whether super-G uses one), the out plate.
- [ ] **Cameras**: broadcast angles for speed (the jump shot, the long lens
      down the course) — research.
- [ ] **Audience**: along the course and at the jumps (research).
- [ ] **Sound**: the wind at speed, the landing, the panels.
- [ ] **Campaign**, **front door**, **labs**, **tests**, **docs** as for the
      giant slalom; delete this spec.

## Research to-do

Write every finding into this discipline's section of
`docs/disciplines.md` (numbers with sources, estimates marked, no names),
then tick it here. Researched so far: the course's vertical, gate
spacing and direction changes, the ski rules, the technique (turns, edge,
skid, transition, body, load, tuck, jumps, forces), the speeds and the
start (estimated) — `docs/disciplines.md` § *Giant slalom, super-G and
downhill*. The rest below is still open.

- [ ] Competition rules restated generically: vertical drop bands, gates as
      a % of the vertical, minimum number of direction changes, distance
      between turning poles, gate width and panels, the inspection, one run,
      start interval and window, DSQ.
- [x] Ski rules: length and sidecut minimums; is there a super-G class.
- [x] Technique (studies): turn radius and duration, edge angles, speeds
      (average and peak), how much of a run is tucked, the tuck's drag area,
      the jump technique (pre-jump, absorption, air time, distance), g-loads.
- [ ] Course safety: nets (A/B), run-outs, jump design limits.
- [ ] Broadcast camera positions; where spectators stand.

## Open questions for the user

- Does the player get an INSPECTION (a slow side-slip down the course
  before the run, or a fly-over) since a super-G is skied unseen?
- One run only — or a practice option outside the measured run?
