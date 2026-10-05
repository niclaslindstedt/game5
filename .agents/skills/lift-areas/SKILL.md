---
name: lift-areas
description: "Use when working on WHERE A LIFT ENDS — a lift's top and what a skier meets coming off it: the pad the top station stands on (its deck, its lean, its rim), a chair's unload ramp and the way off past the station house, the runs that leave a top (where each starts, that it starts UNDER the top), the RAMPS off the pad's rim down onto them, the run SIGNS at the ramps' heads, the PISTE MAP BOARD (painted with the start card's panorama), the stations' furniture, and the rule that NOTHING TAKES THE CONTROLS off a rider at a top — he follows the sign and the ground brings him to his run, downhill, never climbing. Owns the measurement (`make lift-tops`: a rider who follows the sign, one row a run), the order of the fixes (start under the top, room for the ramp kept, the ramp landing on the run's own snow, the unload ramp falling ahead), and the lessons of the pass that removed the lead. Not the ride up the rope (`engine-system`'s `lift-ride.ts`), not the lens on the chair (`game-feel`), not the rest of the generator (`mapgen-improvement`)."
---

# Lift areas: the top of a lift and the way down from it

A lift exists to put a skier ABOVE the runs it serves. Everything at its top
is judged by one question: **a rider stood off the lift, who does nothing
but aim at his run's sign, does he slide there — downhill, never climbing,
never poling across a flat, never stuck?** Nothing may answer it for him: no
lead, no skate across, no input but his own after the stand-up.

**Read this skill's lessons first** — `npx ogf-skill-lessons lift-areas --list`.
Load **`skill-reflection`** at both ends, **`write-code`** beside this one,
and **`mapgen-improvement`** for anything that moves what a seed builds.

## Where it lives

| Piece | File |
| --- | --- |
| The pad a top stands on (deck, lean, rim, the eased edge) and a chair's unload ramp — falling ahead of the rider from the unload point | `engine/mapgen/station-pad.ts` (`pressPads`, `padSurface`, `unloadRise`), `RESORT_RULES.lift.top` / `.unload` |
| The cut under the chairs' way in, which must start behind the rider's tails | `station-pad.ts`'s `cutApproach`, `RESORT_RULES.lift.top.approach` |
| Where a run off a top starts: slid down the fall line UNDER the top by a glide's fall from the rim (`headOnContour`), only where a ramp has room (`rampRoom`) — lanes too | `engine/mapgen/run-start.ts`, `resort-build.ts` (the walk, the `rooms` kept) |
| The ramps off a pad's rim down onto the runs (falling at least `fall`, a green's and a blue's even and gentle, landing on the run's own snow at its height); a drag's top's, where they fit | `engine/mapgen/summit-ramps.ts` (`planRamps`, `layRamps`, `rampRoom`, `nearRoom`), `station-pad.ts`'s `dragTop`, `Lift.ramps` |
| What holds it: every piste off a chair's or a gondola's top has a ramp, every ramp falls, no run off one starts against it | `engine/analysis/resort.ts` (R26, R27) |
| Stood off the lift and let go — no lead | `engine/game/lift-ride.ts` (`stepCarried`, `runsOffTop`, `arriveByLift`) |
| The signs at the ramps' heads | `pwa/src/game/run-sign-plan.ts`'s `summitSigns`, drawn by `run-signs.ts` |
| The map board: where it stands, its frame, its face and the picture handed over from the start card | `station-plan.ts`, `station-parts.ts`, `map-board.ts`, `map-board-picture.ts` (the worker names the map, `seed-preview.tsx` keeps it) |
| The research | `docs/summit-stations.md` |

## The loop

1. **Measure before anything**: `make lift-tops SEED=<n>` and
   `make lift-tops COUNT=12` — every run off every top ridden by a rider who
   follows its sign. A row is at fault on a climb over 0.6 m, a run not
   reached, a wipeout or a reset. Keep the table.
2. **Look**: `make lift-ride SEED=<n> ARGS="--run=<id>"` — the stand-up, the
   lane, the board and the slide off, through the game's own lens. A lab
   that rides with NEUTRAL input shows where gravity alone takes a rider.
3. **Find the defect in numbers, not in the picture**: the run's head under
   the top and how far away (`make lift-tops`' `under` and `away`), the
   ground along the way (sample `groundAt` along the rider's line), the
   rider's trace (speed, the packed share, his place in the line's frame —
   `u` up the line, `v` across it) where he stalls.
4. **Fix where the cause is** (the generator, the press, the plan), never by
   steering the rider.
5. **Hold it in the analyzer** where it can be: a rule the generator refuses
   a map on is a rule that survives. Then count what it costs: `make analyze
   COUNT=24` against the baseline (the "needed a retry" line and the build
   time), and the refusal reasons over a dozen seeds.
6. **The suite**: `npx vitest run tests/lift_ride_test.ts
   tests/stations_test.ts tests/camera_lift_test.ts tests/resort_test.ts
   tests/docs_rules_test.ts` — `lift_ride_test`'s `followSign` is the same
   rider as the lab.
7. A change that moves what a seed builds owes a generator version
   (`versions.ts`, `mapgen-improvement`, `campaign`).

## What the first pass learned

- **A lead hides every defect of a top.** While a lead steered the rider and
  skated him across, runs started level with or above the pad, ramps were
  laid to a fifth of them, and the unload stood him on the lip of the cut —
  and nobody saw it. Measure with a rider who only aims.
- **A run "on the top's contour" is a flat traverse.** A start a few metres
  under the deck but a hundred metres off is 4 % — a crawl, and any roll in
  the snow is a climb. Lay it under the top by a GLIDE's fall over the way
  from the rim (`lift.top.ramp.fall`, 10 %).
- **A run is not level across.** Its edge up the slope stands metres over
  its line where it is cut into the face; a ramp ended at the run's
  shoulder, or at its line's height, met a wall. Land the ramp on the run's
  own snow at that snow's height, and press it over the run's own shoulder.
- **Place the start where its ramp has room, and KEEP the room.** Laying the
  ramps after every run is walked found most of them crossed by a run or a
  lane walked later. Check the line at the start (`rampRoom`: the edge's
  height for the least fall, the line's height for the steepest — the
  run's grading cuts its edge down to its line), then make every later run
  and lane keep off it (`nearRoom`, the walk's `avoid`, the lane's
  `keepOff`). The retries fell below the baseline once the room was kept.
- **A rider let go at a crawl rolls back.** The unload must fall AHEAD of
  him, and the cut under the chairs must start behind his tails: a mound
  centred on the unload point with the cut a metre behind it stood him on a
  ridge, and he slid backwards down under the chairs.
- **Signs on the pad, not across the lane.** A sign at the ramp's head, a few
  metres in from the rim on the pad's circle (offset round the rim, not
  straight sideways, or it lands past the rim), stands under the deck and
  the unload: the rider sees it in front of him, below, and follows it.
- **A green's ramp is a green, and no ramp has a lip.** A ramp is held to
  the run's colour (no more than 20 % to a green or a blue, 48 % to a red or
  a black) and falls EVENLY: a ramp that ran out gentle and rolled over a lip
  into its drop threw the rider who followed the sign off it on every red.
- **Aim for the run's snow, not an angle onto it.** Asking a ramp to meet
  its run within some angle of the run's own heading refused most tops; the
  rider who follows the sign only needs to arrive on the run's snow, and the
  lab checks exactly that.
- **An older version's code reads the rule book too.** Maps pinned on an
  older generator (the campaign, the trick maps, the race maps) are rebuilt
  by that version's trait over the SAME `RESORT_RULES`, so a number moved
  for the new version (here a ramp's reach) moves them unless the legacy
  module restates the old number. Run the pinned suites
  (`generator_version_test`, `race_maps_test`, `race_maps_downhill_test`)
  after every rule number you touch, not only at the end.
- **The drags are re-laid after their runs are walked**, so a drag's top
  ends up wherever access put it — often far above its nursery runs. Ramps
  off a drag's top are laid after the drags settle, where they fit; a cut
  round its let-go made walls against the runs beside it. Still open: the
  nursery drag's top is not yet guaranteed a way down.
- **The board's picture is the start card's.** The worker that paints the
  card's panorama names the map it built (`boardKey`) and the card keeps the
  answer (`map-board-picture.ts`, three-free so the worker and the card stay
  light); the game paints its own only for a map the card never showed.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth recording: a
top that measured right and rode wrong (or the other way round), a rule the
analyzer should hold and does not, a lab that hid a defect.
