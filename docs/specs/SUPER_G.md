# Super-G — draft spec

**Draft. Research first, then build.** Delete this file when the super-G
is finished (see `README.md`).

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

- [ ] **Course rule (R33)**: vertical drop band, gate count as a share of
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
- [ ] **Technique row**: long arcs, lower edge angles, a tuck between turns,
      the pre-jump and absorption, stability at speed.
- [ ] **The skis**: is a super-G pair its own class (length, sidecut)? If
      so, a seventh pair in the catalog with its topsheet, model, card row.
- [ ] **Bot**: skis the line at speed, tucks, takes the jumps; finishes every
      seed.
- [ ] **Par and board**: one run; spread and DNF rates for a speed event.
- [ ] **Safety netting**: speed events are lined with high safety nets
      (A-nets) — drawn along the course, and a collision with them.
- [ ] **HUD**: the board (one run), splits, the speed trap (research
      whether super-G uses one), the out plate.
- [ ] **Cameras**: broadcast angles for speed (the jump shot, the long lens
      down the course) — research.
- [ ] **Audience**: along the course and at the jumps (research).
- [ ] **Sound**: the wind at speed, the landing, the panels.
- [ ] **Campaign**, **front door**, **labs**, **tests**, **docs** as for the
      giant slalom; delete this spec.

## Research to-do

- [ ] Competition rules restated generically: vertical drop bands, gates as
      a % of the vertical, minimum number of direction changes, distance
      between turning poles, gate width and panels, the inspection, one run,
      start interval and window, DSQ.
- [ ] Ski rules: length and sidecut minimums; is there a super-G class.
- [ ] Technique (studies): turn radius and duration, edge angles, speeds
      (average and peak), how much of a run is tucked, the tuck's drag area,
      the jump technique (pre-jump, absorption, air time, distance), g-loads.
- [ ] Course safety: nets (A/B), run-outs, jump design limits.
- [ ] Broadcast camera positions; where spectators stand.

## Open questions for the user

- Does the player get an INSPECTION (a slow side-slip down the course
  before the run, or a fly-over) since a super-G is skied unseen?
- One run only — or a practice option outside the measured run?
