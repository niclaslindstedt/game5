# Speed skiing — draft spec

**Draft. Research first, then build.** Delete this file when speed skiing
is finished (see `README.md`).

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

- [ ] **Course rule (R36)**: the track — its length, the gradient of the
      start zone, the timing zone and the run-out, its width, how straight
      it must be, and how the generator finds or grades it (a straight cut
      down the fall line, groomed hard).
- [ ] **Timing**: the speed trap (a measured zone of a fixed length: speed =
      length / time through it), the board in km/h, the record book of
      speeds.
- [ ] **Mode and rules**: `GameMode` row; interval start; no gates; the
      format (runs, heats, eliminations — research).
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
- [ ] **Campaign**, **front door**, **labs** (the technique lab's speed
      column; a `ride` scenario on the straight), **tests**, **docs**; delete
      this spec.

## Research to-do

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
