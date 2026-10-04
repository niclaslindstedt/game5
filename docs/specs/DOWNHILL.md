# Downhill — draft spec

**Draft. Research first, then build.** Delete this file when the downhill
is finished (see `README.md`).

## What it is

The fastest discipline: the longest course and the most vertical, few
gates (they set the line, they do not make the turns), long tucked
stretches, big jumps, fast turns and compressions, the highest speeds of the
sport. One race run, preceded by TRAINING RUNS on the same course in the
days before. Skied on the longest, straightest pair.

## What the game already has to reuse

- The course setter's machinery (R31) — a downhill takes the whole piste top
  to bottom, keeps its jumps, and wants its own rule.
- The tuck and its drag (`skier.ts`, `TUNING.skier`), the air and the
  landings (`flight.ts`), the wipeout at speed (`crash.ts`) and the body's
  blows (`body.ts`) — a downhill is where all of them matter most.
- The interval start, the board, the start house and television start, the
  board HUD (one run).
- The downhill pair (`EAGLE`). `docs/riding.md`'s measured table already
  holds its top speed in a tuck as an expectation (`tests/skier_test.ts`).
- The old race's course (the piste top to bottom, gates every hundred metres
  or so) is close to a downhill's shape already — read what the generator
  builds before inventing a new course.

## What it needs to be complete

- [ ] **Course rule (R34)**: vertical drop band (the repo already quotes
      850–1030 m and 3–4.5 km for a downhill course — confirm by research),
      gate rules (the line-setting gates, panels), the terrain features a
      downhill uses (jumps, compressions, traverses, fall-line turns, a
      glide section), the safety requirements (nets, run-outs, jump limits).
- [ ] **The setter**: the whole piste; gates where the line needs them;
      jumps kept and held to safe landings at race speed; the racing line.
- [ ] **Training runs**: the run(s) before the race — not measured on the
      board, or measured as their own board (research how training times
      work); a ghost of the best training run?
- [ ] **Mode and rules**: `GameMode` row, interval start, strict gates (a
      downhill gate missed is a DSQ too — research), one race run, the pair.
- [ ] **Technique row**: the tuck held as long as possible, small edge
      angles, long radius, stability at speed, the pre-jump and absorption,
      standing up only where a turn needs it.
- [ ] **Physics at speed**: air drag in a tuck versus standing (measured
      drag areas), the speed a body lands safely, how a ski chatters at
      100+ km/h; terminal speed on a pitch checked against the research.
- [ ] **Bot**: tucks, takes the jumps, holds the line; finishes every seed.
- [ ] **Par and board**: one run; the spread of a speed event (smaller gaps
      in seconds per minute?), DNF rates.
- [ ] **Safety netting**: the A-nets along the course and a collision with
      them; crashes into them in `crash.ts`.
- [ ] **HUD**: the board, splits at several timing points, the SPEED TRAP (a
      speed measured at one point on the course, shown against the field's),
      the out plate.
- [ ] **Cameras**: broadcast angles for a downhill (research): the jump
      from the side, the long lens, the helicopter-like shot.
- [ ] **Audience**: along the course and packed at the jumps and the finish.
- [ ] **Sound**: the wind at 100+ km/h, the ski chatter, the landings.
- [ ] **Campaign**, **front door**, **labs** (the technique lab's downhill
      column, `ride` scenarios at speed), **tests**, **docs**; delete this
      spec.

## Research to-do

- [ ] Competition rules restated generically: vertical drop bands, course
      length, gates and panels, training runs (how many, required?), one race
      run, start interval and window, DSQ for a missed gate.
- [ ] Ski rules: length and sidecut minimums for the downhill class.
- [ ] Technique and physics (studies): average and peak speeds, run times,
      the share of a run in a tuck, the tuck's drag area (high, mid, low),
      turn radius and edge angles at speed, jump distances and air times,
      landing forces, the forces in compressions.
- [ ] Course safety: A/B nets, run-out sizes, jump design limits.
- [ ] How a speed trap works and where it stands.
- [ ] Broadcast camera positions; where spectators stand.

## Open questions for the user

- Training runs: playable before the race (and optional), or skipped?
- Should a downhill course be the whole piste the generator builds (the old
  race's course), or a stretch of it?
