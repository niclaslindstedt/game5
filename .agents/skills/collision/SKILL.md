---
name: collision
description: "Use when working on the skier TOUCHING SOMETHING THAT IS NOT SNOW, and on the course COUNTING something — a trunk met, another skier shouldered, the soft push back from the map's edge, a gate's line crossed or skied past, the finish line, the reset back onto the piste — and on what the events (`hit`, `bump`, `checkpoint`, `missed`, `lap`, `finish`, `reset`, `land`, `air`) mean. Owns `engine/game/collision.ts` (the trunks and the edge), `course.ts` (the gates, the finish, the reset), the skier-against-skier shoulder in `rivals.ts`, `TUNING.trees` / `.bounds` / `.course` / `.reset`, and the stage-a-contact → LOOK loop. The snow itself is `ski-physics`'s; what a crash does to the skier and his skis (the wipeout, the bog, damage) is `crash`'s."
---

# Collision: the skier meeting what is not snow

The snow is `ski-physics`'s — the legs, the sink, the body points on a
slope. This skill owns the moments the skier meets something that STANDS UP
out of the snow — a trunk, another skier, the map's edge — and the moments
the course COUNTS something — a gate crossed, one skied past, the finish,
the reset. They are one skill because they share the path: the same segment
from last step's CoG to this step's that crosses a gate's line is the one
the trunks and the edge push back.

Load **`write-code`** beside this one (always), **`ski-physics`** when the
answer involves what the skier does AFTER a contact, **`mapgen-improvement`**
when the work touches where trees and gates STAND, and **`test-scenario`**
for staging exact contacts.

## The map — who owns what

| Piece | File |
| --- | --- |
| Trunks: a vertical cylinder per tree, the skier as three plan circles down the skis' length (`trees.bodyRadius`), push-out along the line of centres, restitution, the scrub along the trunk, the lever that turns him; hashed per level (`treesNear`); the `hit` event | `engine/game/collision.ts` (`collideTrees`) |
| The map's edge: a soft push over the last `bounds.soft`, a hard stop `bounds.margin` inside | `engine/game/collision.ts` (`keepInBounds`) |
| POSTS: every lift tower's column and bullwheel post, every floodlight mast — met as a trunk is, one list with the trunks (`solidsOf`, trunks first) that the skier, the ragdoll, the loose skis, the snowmobile and both bots read; a `hit` with `post` | `engine/game/posts.ts`, `piste-masts.ts` (where the masts stand), `upright-grid.ts` (the hash), `LiftLook.column` |
| EDGE STAKES: the marker poles down both run edges — bent over and whipping back, snapped past `stakes.snap`, a little speed and a twist, a throw past `crash.stakeSpeed`; a run's own (`GameState.stakes`); the `stake` event | `engine/game/edge-stakes.ts` (`stakePlan`, `stepStakes`), `TUNING.stakes` (`defs/stakes.ts`) |
| The body on the snow: the hips, the shoulders, the helmet, the knees, the skis' tips and tails — impulses when the legs run out | `engine/game/chassis.ts` (the `ski-physics` skill) |
| Gates: a line across the piste crossed in its facing direction within its width plus `course.grace` (the START GATE with `startGrace` more); ONE LIVE AT A TIME; the finish | `engine/game/course.ts` (`crossedCheckpoint`, `crossedLine`, `stepCourse`) |
| The arrow to the owed gate | `bearingToNext` in `course.ts` — the HUD and the bot both read it |
| The reset: stood on the piste `course.resetAhead` past the last gate taken (or short of the start gate), facing down it, at rest; the skier's or the engine's (on his back, or bogged) | `course.ts` (`resetPose`, `standSkier`, `resetSkier`), `run.ts` for the automatic one, `TUNING.reset` |
| SKIER AGAINST SKIER: two plan circles down each one's skis, pushed apart with the closing speed traded at `RACE.bump.restitution` — a shoulder, not a solver; the `bump` event | `rivals.ts`, `RACE.bump` in `defs/modes.ts` |
| Every number | `TUNING.trees`, `.bounds`, `.course`, `.reset` in `defs/tuning.ts`; `RACE` in `defs/modes.ts` |
| Where a tree, a gate, the start line stands | `engine/mapgen/` (`forest.ts`, `spawn.ts` under `rules.ts`) — the `mapgen-improvement` skill |
| Drawing the trees and the gates | `pwa/src/game/forest.ts`, `gates.ts` |
| What the events mean to the app | `pwa/src/game/run-news.ts` (the news line), `audio/route.ts` (the sound), `rumble.ts` (the pulse), `spray.ts` (the landing puff) |
| The wipeout, the bog, damage | `crash.ts`, `trench.ts`, `damage.ts` — the `crash` skill: a contact STARTS a crash here (the `hit` closing speed), and what it does to the skier and his skis is decided there |
| Tests | `tests/collision_test.ts` (trunks, the edge), `tests/course_test.ts` (order, the finish, misses, the reset), `tests/rivals_test.ts` (the start line, the shoulder, the standings) |

## The events, and what each MEANS

| Event | Fires when | Carries |
| --- | --- | --- |
| `hit` | A body circle met a trunk or a post at `trees.hitSpeed` closing or more, at most once per `trees.cooldown` | the closing speed, where, `post` on a post |
| `bump` | The player met a rival | which rival, the speed |
| `stake` | An edge stake swept over, met standing, at `stakes.knock` closing or more | the speed, whether it snapped, where |
| `air` | The skier has been off the snow `air.counts` s | the climb he left with, the speed |
| `land` | Back on the snow after `air` | air time, impact INTO the slope, `harsh`, the share `lost` |
| `checkpoint` | The owed gate's line crossed, facing, within its width + grace | index, lap (always 0), split |
| `missed` | The owed gate's line crossed beside it, past `missReach` | index |
| `lap` | The finish line crossed — the run done | 1, the run's time |
| `finish` | The same crossing | the run's time, the place |
| `reset` | Stood back on the piste | the gate, whether the engine did it |
| `wipeout` | The skier thrown (`crash.ts`): a `hit` past `crash.treeSpeed` on the tips or `treeShoulder` beside him, a landing over the tips, the body down, a fall at speed, the legs folded, a caught edge | the cause, the speed, where |
| `stuck` | Bogged in powder past `trench.stuckAt` (`trench.ts`) | — |
| `damage` | An edge dulled or the legs hurt (`damage.ts`, damage on only) | the part, how bad it now is |
| `count` / `go` | The lights | seconds left / the clock starts |

**Each fires ONCE per occurrence.** A `hit` every step the skier leans on a
trunk is a sound played a hundred times a second and a sim table counting one
tree as a forest. The contact persists; the EVENT is the transition into it
(which is what `cooldown` and `air.counts` are for).

## The invariants — each one is load-bearing

- **The engine owns every number and every decision.** The renderer plays a
  puff where `land` says and a crack where `hit` says, nothing more. New
  contact behaviour starts in `collision.ts` / `tuning.ts`, never in the
  renderer.
- **A tree is its trunk.** The crown is drawn and is nothing to the physics;
  a skier brushing the lowest boughs is a picture, a skier meeting the trunk
  is the whole hit. A trunk drawn thicker or offset from `TreeDef.x/z/radius`
  is a tree the skier sees and passes through — **when a contact is reported
  missing, check the drawn trunk against the engine's before tuning the
  contact.**
- **The lever turns the skier.** The push acts at the circle's centre, not the
  CoG, so a clipped tip spins him and a trunk met dead centre stops him. A
  push at the CoG is a skier who bounces off trees like a ball.
- **Gates are counted on the PATH, not the position.** The segment from last
  step's CoG to this step's crosses the line; at 33 m/s a step is 0.28 m,
  fine — but sampling positions alone can still skip a line clipped at an
  angle across its end.
- **ONE LIVE GATE, and a miss costs no DQ.** A skier who skips one is not
  disqualified: the next is simply not credited until the skipped one is
  taken, `missed` fires once, and the HUD's arrow points back at it. Nothing
  sends him back by force — the reset is his own way back.
- **THE START GATE IS OWED FIRST, AND THE FINISH LINE ENDS IT.** The field
  stands on the start line a few metres above gate 0 (`grid.back`), and
  crossing it opens the run (with `course.startGrace` on that crossing,
  because the field arrives abreast). A run of n gates is n crossings, the
  last of them the finish, and the standings count them (`raceProgress`).
  `laps` is always one: nothing wraps.
- **The reset is ONE decision: the pose and the progress.** `resetPose` stands
  the skier past the last gate TAKEN, facing down the piste, at rest; the
  progress stays where it was, so the gate owed is still the next one down.
  Stood BEHIND the owed gate and it would be taken twice. Before the start
  gate he is stood on the start line.
- **The automatic reset is a latch with a hold.** On his side or back
  (`reset.overUp`) for `reset.overFor`, or poling (the tuck held) going
  nowhere (`stuckSpeed`) for `stuckFor` — the hold is what stops a skier who
  is merely slow in powder being teleported.
- **The edge pushes, then stops.** A soft spring over the last `bounds.soft`
  metres turns a runaway back; the hard stop is the last resort. A hard wall
  alone is a skier who stops dead on an invisible line.
- **Rivals shoulder, they do not solve.** Two circles per skier of
  `RACE.bump.radius` (0.6 m — the skier's half-width with his arms and
  poles out, so two bodies are held 1.2 m apart and never overlap), pushed
  apart with the closing speed traded. It exists so skiers cannot pass
  through each other side by side; a skier thrown by a rival is a bug. The
  field keeps out of the player's body by holding its LANES (`Rival.lane`,
  the bot's), not by the shoulder alone.
  `rules.contact` off (the solo measurements) asks no pairs at all.
- **Synthetic maps must state their trees.** `flatLevel()` has none; a
  collision test uses `syntheticLevel()`'s `LONE_TREE` or builds its own,
  or the test tests nothing.
- **A contact change is verified by a SWEEP, not one staged run.** Bearing
  (30° steps) × speed × offset from the trunk's centre, printing speed out,
  yaw turned and any vertical launch per cell, once on the baseline and once
  after. It names the bad approach and proves the other cells did not move.
- **ANY UPWARD COMPONENT IN A CONTACT NORMAL IS A LAUNCHER until proved
  otherwise.** A trunk's push is in plan; the ground's is the body's
  (`chassis.ts`). A skier thrown tens of metres up after meeting something
  is a normal that tipped up, never the flight model.

## Workflow

1. **Stage it.** `syntheticLevel()` with its lone tree (or a hand-built
   `Level`), `placeRun` at the moment, then step — the patterns live in
   `tests/collision_test.ts` and `course_test.ts`.
2. **Tune defs first.** A bounce too hard, a reset too eager, a grace too
   mean is a `TUNING` number with its unit, not a model edit.
3. **Assert the rule you claim**: a trunk met square (stopped, `hit` once),
   clipped (turned, speed kept), the edge (pushed back), a gate crossed
   uphill (no credit), one skipped (`missed` once, then credited when
   taken), the finish, a reset past the last gate.
4. **Bench it.** `make ride SCENARIO=tree` — in, out, turned.
5. **Measure.** `make sim` before and after — watch hits, resets, missed
   and finishes; the bot must keep finishing with hits and resets near zero.
6. **LOOK.** `make world SEED=<n> ARGS=--views=forest,track` for the trunks
   and the gates as drawn; `make build`, `make screenshots` for the app.
7. Docs: `docs/riding.md` ("Trees and the edge", "The reset"); the course
   and the race in `docs/architecture.md`; the sim columns in
   `docs/simulation.md`.

## Tuning intuition

- `restitution` low and `scrub` moderate make a glancing trunk a scrape
  rather than a bounce; a square hit stops you either way.
- `bodyRadius` is the skier's half-width plus a little — the generator's
  `forest.corridor` keeps trunks off the piste by more than that, so a
  `hit` on the racing line is a generator bug reported through this module.
- `course.grace` answers "did I clip that panel?" in the skier's favour; a
  couple of metres either side nobody can see at gate range.
- The stuck and over timers are the cost of a mistake: shorter and a slow
  powder crossing is teleported; longer and a fallen skier is a long wait.

## Skill self-improvement

Record lessons under `.agents/skills/collision/.lessons/` via the
**`skill-reflection`** skill: a contact that fired twice and why, a gate the
bot could cross without passing, a trunk drawn where the engine's is not —
the class of failure, not the one-off.
