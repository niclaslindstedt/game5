# Speed skiing — draft spec

**Draft. Research first, then build.** Delete this file when speed skiing
is finished (see `README.md`).

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*.
2. The new parts are a straight track, a result that is a SPEED (the trap),
   and the engine at its extreme — read `engine/game/limits.ts`
   (`terminalSpeed`), the tuck's drag, `docs/riding.md`'s measured table,
   and check the 120 Hz step and the collision hold at those speeds with a
   `make ride` scenario before anything else.
3. Research the to-do below into `docs/disciplines.md` before writing the next free R-rule — R33 after the downhill's R32; the ids run contiguous (`tests/docs_rules_test.ts`).

## Watch out (from the slalom)

Read `README.md`'s *Lessons from the slalom* first; for speed skiing in
particular:

- **Nothing in the engine has been proven at these speeds.** The slalom ran
  ~40 km/h; speed skiing is several times that. Before any feature, write
  `make ride` scenarios for the straight at 150, 200 and 250 km/h and check
  the step, the snow's contacts, the drag and a fall.
- **The result is a speed, so drag is everything:** the tuck's drag area,
  the suit and the helmet (`docs/disciplines.md`'s tuck section is the
  start; the speed-skiing tuck needs its own research), and the ski's
  friction at speed.
- **The technique row is nearly all tuck:** almost no edge, tiny
  corrections; keep the default row the identity so nothing else moves.
- **Chatter and stability:** `ski-chatter.ts` and the edge's catch were
  tuned at slalom and free-ride speeds — check them on the straight.

## What it is

Straight down the fall line as fast as a skier can go: no gates, no turns.
A steep, wide, groomed track; the racer accelerates through a starting zone,
is TIMED through a short measured zone (a speed trap — the speed is the
result, not a time), and stops on a long run-out. Racers wear aerodynamic
suits and helmets and hold a fixed tucked position; the fastest speed wins,
with heats over several runs (research the format).

## What the game already has to reuse

- The tuck and its drag, the terminal speed on a pitch (`limits.ts`'s
  `terminalSpeed`, `TUNING.skier`), the downhill pair (`EAGLE`) — speed
  skiing is the tuck taken to its end.
- The interval start and the board (a board of SPEEDS rather than times).
- The generator's mountain: a speed track needs one long, steep, straight,
  wide pitch with a long flat run-out — the stretch search can find it.
- Chatter at speed (`ski-chatter.ts`), the wind's sound rising with speed.

## What it needs to be complete

- [ ] **Course rule (the next free R-rule)**: the track — its length, the gradient of the
      start zone, the timing zone and the run-out, its width, how straight
      it must be, and how the generator finds or grades it (a straight cut
      down the fall line, groomed hard).
- [ ] **Timing**: the speed trap (a measured zone of a fixed length: speed =
      length / time through it), the board in km/h, the record book of
      speeds.
- [ ] **Mode and rules**: `GameMode` row; interval start; no gates; the
      format (runs, heats, eliminations — research).
- [ ] **The jury's weather**: `jury: JURY.speedSki` in its `RunRules` — the
      row is already in `defs/modes.ts` (10 km/h, its own rule's strictest
      reading, in no more than flurries — and its rule reads the wind at the
      TOP OF THE TIMING ZONE, not the start, with a looser 20 km/h for a
      steady wind straight down the track: move `startGustOf`'s point and
      decide whether to take the looser case); `createGame` eases the map to
      it (`jury.ts`'s `juryDay`). The research is `docs/disciplines.md` § *The
      jury's weather*.
- [ ] **Physics at the extreme**: air drag of a speed-skiing tuck and suit
      (measured drag areas), ski-snow friction at very high speed, stability
      (the ski's chatter, the edge), what a fall at that speed does — check
      the engine holds at those speeds (the 120 Hz step, the collision).
- [ ] **The skis and the kit**: speed skis (much longer — research), the
      aerodynamic suit and helmet (the gear catalog in `outfit.ts`), maybe a
      class of its own.
- [ ] **Technique row**: the tuck held rigid, almost no edge, tiny
      corrections, the stand-up and braking in the run-out.
- [ ] **Bot**: holds the line and the tuck; brakes in the run-out.
- [ ] **HUD**: the speed readout front and centre, the speed trap result,
      the board of speeds; the run-out.
- [ ] **Cameras**: a side-on tracking shot and a long lens up the track —
      research.
- [ ] **Audience**: along the run-out and the finish (research).
- [ ] **Sound**: the wind and the suit at 150+ km/h, the skis' chatter.
- [ ] **Its nine pinned maps** (`docs/specs/RACE_MAPS.md`):
      `RACE_MAPS.speedSki`, nine seeds whose fall line takes a GOOD track
      (its length, its steepest pitch, its run-out), swept, looked at and
      laddered; held by `tests/race_maps_test.ts`.
- [ ] **Front door**, **labs** (the technique lab's speed
      column; a `ride` scenario on the straight), **tests**, **docs** (`docs/disciplines.md` first); delete
      this spec.

## Research to-do

Write every finding into this discipline's section of
`docs/disciplines.md` (numbers with sources, estimates marked, no names),
then tick it here.

- [ ] The format restated generically: classes/categories, runs, heats and
      eliminations, how a result is the speed through the trap.
- [ ] The track: length, gradients of the zones, the trap length, run-out
      length, width.
- [ ] Equipment rules: ski length and width, suits, helmets, fairings
      (generically, no brands).
- [ ] Physics: drag area of the speed tuck with the suit, friction at speed,
      typical speeds by class.
- [ ] Safety: run-out design, what happens in a fall.
- [ ] Broadcast camera positions; where spectators stand.

## Open questions for the user

- Should speed skiing use the existing downhill pair, or a speed ski of its
  own in the catalog?
- One measured run, or the heats-and-eliminations format?
