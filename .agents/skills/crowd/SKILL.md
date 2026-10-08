---
name: crowd
description: "Use when working on THE CROWD — the free ride's amateur skiers out on the ski area: who is out there and in what groups (families, friends, ski schools, the lot down from the hut), the knobs that make each one himself (skill, aggression, off-piste, turn style and width, wobble, the stopper, the jumper), how they ski the resort's runs and ride the lifts, how crowded each colour is, how the player meets them (the bump, the knock-down, the `skier` wipeout), and how they are DRAWN — eight procedural bodies at three cuts, posed by morph targets solved from the player's own pose, dressed per instance — and THE SPECTATORS who watch every run but a free ride: where a race's audience stands (the finish arena's grandstands, back terraces and slope, the jumps, the inside of the hard turns, the steep pitches, the lower corridor, the start), what each fan wears and carries, how he moves when a racer comes (the shader's), the finish arena's furniture (the fences, the finish circle's boards and exit gate, the leader's platform, the video wall). Owns `engine/game/crowd.ts`, `engine/game/defs/crowd.ts`, `pwa/src/game/crowd-rig.ts`, `crowd-shapes.ts`, `crowd-dress.ts`, `crowd-view.ts`, `spectator-plan.ts`, `spectator-shapes.ts`, `spectators.ts`, `finish-arena.ts`, `make crowd` and `make audience`."
---

# The crowd: the free ride's amateurs

A resort on a good day is hundreds of people, and the free ride's ski area
(R25–R30) is a resort. The crowd is them: rough, cheap, deterministic, and
there to make the mountain feel alive — not rivals, not a field, never
skied by the skier's physics.

**Read this skill's lessons first** — `npx ogf-skill-lessons crowd --list`.
Load **`skill-reflection`** at both ends and **`write-code`** beside this one.

## Where it lives

| Piece | File |
| --- | --- |
| Who is out there: the bodies, the kinds and their knob bands, the turn styles, the group kinds, the crowd's numbers (how many, how crowded each colour, the lift, the speeds, falls, stops, off-piste, kickers, the knock) | `engine/game/defs/crowd.ts` (`CROWD`, `CROWD_KINDS`, `CROWD_GROUPS`, `TURN_STYLES`, `CROWD_SIZE`) |
| The network they ski (`crowdNet`), dealing them (`createCrowd`), their step and their decisions (`stepCrowd`), the player against them (`clipCrowd`) | `engine/game/crowd.ts` |
| The lifts they take: the queue at a lift's foot on its corral's lane (`queueSpot`), the carrier that takes the front of it at the load line (`carrierPassing`), the ride on that carrier (`carrierAt` — the lifts always run), off the top onto the group's run; dealt riding or queueing at the start | `engine/game/crowd-lift.ts` over `engine/game/lift-line.ts`; `CROWD.ride` |
| What a run asks for | `RunRules.crowd` (`freeRules` deals `CROWD.count`; every measured run 0), `createGame`'s `crowd` |
| The state | `Amateur`, `CrowdGroup`, `CrowdState`, `GameState.crowd` in `state.ts`; the `bump` event's `amateur`, the `skier` crash cause |
| The skeleton in every pose — the PLAYER'S `skierPose`, sized to each body — and the weights an amateur is drawn at (`dialsOf`) | `pwa/src/game/crowd-rig.ts` (three-free) |
| An amateur DOWN: thrown onto the ragdoll, lying, getting up (`throwAmateur`, `stepDown`); drawn off it (`fallenPose`, `standFrame`) | `engine/game/crowd-down.ts`; `pwa/src/game/crowd-fall.ts` (three-free), `crowd-shapes.ts`' `poseCrowdFigure` |
| The figures: eight bodies × three cuts, the poses as relative morph targets, the palette graft | `pwa/src/game/crowd-shapes.ts` |
| The kit each is dealt | `pwa/src/game/crowd-dress.ts` (three-free) |
| The instanced draw | `pwa/src/game/crowd-view.ts`, hung on `renderer.ts` |

## The rules

- **ROUGH ON PURPOSE.** An amateur is `(run, s, d)` — how far down his run
  and how far right of its line — with a speed gravity along the run's pitch
  feeds and the snow, the air and the scrub take. He steers for a LATERAL
  (his style's wave across the piste, as a function of his arc, so a ski
  school's children in the instructor's wave ski in his track) and decides
  only every `CROWD.think` s. Keep it so: a few hundred of them must cost
  the step less than one rival. Measure the step with and without a crowd
  (`tests/crowd_test.ts` rides one; a probe timing `step` is ten lines).
- **HIS OWN STREAM.** Everything the crowd draws comes off
  `CrowdState.rng` (`CROWD_SALT`), never `state.rng` — a crowd moves no
  digest, and `tests/crowd_test.ts` holds the run's stream untouched.
- **ONE POSE IN THE GAME.** Every figure target is the player's
  `skierPose` at that moment, sized to the body (`crowd-rig.ts`); a change
  to the player's stance, tuck or angulation moves the crowd with it, and
  `tests/crowd_figure_test.ts` holds the joints to the player's. Never
  hand-pose a target.
- **DOWN IS THE PLAYER'S RAGDOLL, NEVER A TARGET.** An amateur who falls
  (knocked, a landing, losing it on his own — `fallDown`) is thrown by
  `crash.ts`' `throwOf`, the player's own throw, onto a `Thrown` body
  stepped by `stepRagdoll` (`crowd-down.ts`): it goes over, is dragged flat
  and lies still, then he lies `CROWD.fall.lie` s more and stands up where
  his FEET lay, skis across the fall line on the side he was going, and
  turns them down. The view hangs his figure on the ragdoll's joints
  (`crowd-fall.ts`: `ragdollPose` → `fromPlayer`, sized about the hips, the
  skis laid on the snow about each shin) and rebuilds that one mesh each
  frame (`poseCrowdFigure`) in a small pool — falls are rare, so it costs
  nothing; the get-up blends the joints lying → crouched → stood, every
  bone held to its length. The body draws from no stream: a fall moves
  nothing the crowd's stream deals. `make crowd ARGS=--sheet=falls` strobes
  three falls frame by frame; `--sheet=slope --views=fall-0.3,fall-1,…`
  films one in the game's renderer.
- **HIS ANIMATIONS ON THE PLAYER'S TIMING.** A stance blended alone is a
  statue gliding. What the player's body does on its own clock is a target
  pair too — the turn's pole plant at its touch and its trail (either pole),
  the wait leant and looking one way and the other — and `dialsOf` runs an
  amateur through them by the player's own rule: `PLANT` / `plantLength`
  from `skier-spring.ts` against the turn clock the engine keeps
  (`Amateur.turnSide`, `turnT`, `turnHeld`, begun past `CROWD.turnOn`).
  Never a second timing.
- **NOBODY SKIS INSIDE ANOTHER.** Riders off one carrier are let go side
  by side (`CROWD.ride.apart`) and join their run that far apart; the
  start deals riders only onto carriers on their way up (one past the top
  would let a whole lift's load go on one spot); on a run each gives the
  one ahead — or level, dealt first — a berth (`CROWD.room`), his own
  group too, and a school's kid drops back into his place in the snake
  instead. A pace held off another is never below a crawl, or one stood
  still stands the run behind him still. `tests/crowd_test.ts` holds it.
- **NOBODY GLIDES STILL.** Where the hill will not carry an amateur to the
  speed he means (up to `TUNING.poles.speed`, the player's own push), the
  engine has him WORK (`Amateur.push`) and counts his strides at the
  player's rate (`strideRate`, `Amateur.pole`); `dialsOf` hands both to the
  player's own `gaitOf` and walks the result through its keys — six of the
  skate over two strides, three of the double pole over one, each the
  player's pose at that point of his stride (`STRIDE_AT`) — so the mix of
  skate and pole at a speed is the player's, and a poleless child skates.
- **A MORPH IS LINEAR.** A weight below zero extrapolates the target
  backwards (a body run "anti-lean" stretches upward), so a turn each way
  is a target of its own (`lean`, `leanLeft`) and every weight is ≥ 0.
  Every target must be the same mesh in the same order — `buildCrowdFigure`
  throws if one is not — so a part's presence never depends on the pose.
- **A LIMB IS BUILT ROUND THE BODY'S RIGHT**, not its own direction, or its
  rings flip as it swings past level and the blend twists it.
- **THE BUDGET**: NEAR ≤ 300 triangles, MID under it, FAR ≤ 110 (no boots, no
  gloves, no poles). `tests/crowd_figure_test.ts` holds it.
- **THE INSTANCE MORPH TEXTURE MUST BE FLAGGED** (`morphTexture.needsUpdate`)
  after every write, or every vertex reads a base influence of 0 and the
  figure collapses to a point — invisible, with no error.

- **THE LIFTS ARE REAL.** An amateur at the foot of the mountain queues at
  a lift and rides a CARRIER of it — `carrierAt(plan, k, t)`, the same pure
  function of the clock every chair is drawn by, so a rider is never
  stepped and never drifts off his chair. A carrier takes no more than its
  seats (`CROWD.ride.seats`, counting who is already on it); a real ride
  takes minutes, so a third of the crowd is on the lifts at any moment and
  `CROWD.count` is sized for the snow to keep its share. The seated rider is
  the player's own seated pose (`seatedPose`, the `seat` target), set on
  the chair's seat by each body's own `seatHeight`.

## The loop

1. `make crowd` (every sheet) before the change; keep the PNGs.
   `ARGS=--sheet=figures,lods,moments` for the figures,
   `ARGS="--sheet=slope --seed=7 --t=90"` for the crowd on a mountain
   (`--views=queue,chairs` the longest queue at its lift's foot and a rider
   on his chair),
   `--sheet=dress` for the kit. Browser-driven: `CHROMIUM_PATH=…` and
   `npm i --no-save playwright-core`.
2. Change it. Behaviour: the knobs and bands in `defs/crowd.ts` first.
3. `npx vitest run tests/crowd_test.ts tests/crowd_figure_test.ts`.
4. `make crowd` after; LOOK — a pose at every cut, the busy green, a ski
   school's snake, a kicker.
5. A behaviour change that touches the player (`clipCrowd`, the knock)
   owes `tests/crowd_test.ts`'s meeting cases.

## The spectators: a race's audience

Every run with something to watch (`hasSpectators`: a course counted or a
terrain park scored — the race, the tricks run; never the
free ride, whose people are the amateurs above) is watched by a CROWD
standing where a real race's crowd stands. Presentation only, end to end.

| Piece | File |
| --- | --- |
| WHO stands WHERE and what each one wears, carries and how lively he is: the banks, the grandstands, the fences, the finish arena's layout — dealt off the map's seed (`FAN_SALT`) | `pwa/src/game/spectator-plan.ts` (three-free; `planSpectators`, `FANS`, `FAN_STYLES`, `FAN_HATS`, `FAN_PALETTE`; `NETS` / `netStretch`, the safety nets `gates.ts` draws) |
| A SLALOM'S crowd: both sides of the course behind its nets, thin at the top and thick over the last gates, the combinations and the steepest pitch crowded, a few beside and behind the start house — laid through `planSpectators`' own dealer (`FanDealer`) | `pwa/src/game/spectator-slalom.ts` (three-free; `planSlalomBanks`, `SLALOM_FANS`) |
| The figure at three cuts, every hat and prop on it and folded away per fan, and the SHADER that moves him | `pwa/src/game/spectator-shapes.ts` (`buildFanFigure`, `fanMaterial`, `POSE_GLSL`) |
| The instanced draw a bank and cut, the racers and the arena's mood fed to the shader each frame | `pwa/src/game/spectators.ts` (`createSpectators`, `createPeopleView` — the one view the renderer holds for every person who is not racing) |
| The grandstands, the nets, the finish circle's boards and exit gate, the leader's platform, the video wall and its live clock | `pwa/src/game/finish-arena.ts` |

- **WHERE A REAL CROWD STANDS** (the circuit's own finish-installation
  guide and the fans' guides; the plan's header has the numbers): most of
  them in the FINISH ARENA — grandstands either side of the line, terraces
  behind the finish circle making a U, the finish slope lined rows deep and
  thinning up the hill; on the mountain behind the spectator fence where
  something happens — the JUMPS (the two biggest on both sides), the HARD
  TURNS on their INSIDE (the outside is where a racer who lets go ends up,
  and where the nets are), the STEEP PITCHES; a corridor of short stretches
  down the bottom of the hill where people walk up from the village; thin
  knots elsewhere, thicker toward the bottom; a knot at the start. Never on
  a piste, a trunk, a lift's station or a wind tunnel.
- **A SLALOM IS WATCHED OTHERWISE** (`spectator-slalom.ts`): the course is
  netted its whole length, so the crowd lines BOTH sides behind the
  spectator fence (two metres or more behind the nets, `NETS`) from 30 m
  below the start house down — a row a fifth full at the top growing to
  four rows near the bottom, two rows more at a combination and one at the
  steepest pitch — then the finish slope eight deep over the last gates and
  the arena as a downhill's. The start is a restricted area: a dozen beside
  and behind the house, never in front of the door. Nobody in the run-out.
  A downhill's plan must not move for it: the slalom is a branch taken
  after the arena, and every other seed's plan stays bit for bit (hash the
  plans of a few seeds before and after any change to the shared dealer).
- **NOTHING OF IT IS THE ENGINE'S.** The plan reads the `Level` and writes
  nothing, draws off its own generator, and the shader reads the racers'
  positions; `tests/spectators_test.ts` holds the digest unmoved.
- **THE ANIMATION IS THE SHADER'S** — a pure function of `state.t` and the
  racers (`uFanSkier`: where each is and how much he excites, `skierPull`),
  so a replay is the same crowd and a bank of hundreds costs one draw and
  no CPU. A fan's REACH (by bank kind, `REACH`) is how far off a racer
  lights him up: short enough that excitement RIPPLES down a bank with the
  racer, never the whole slope at once. At rest a fan fidgets on his own
  clock (his habit for his hands, stamping, glancing, a flag held slanted).
  GLSL ES has no ternary on a struct and `out` is a keyword — the shader
  fails to link silently on the sheet if either slips in.
- **THE BUDGET, measured** (`make profile`, the `late` moment at the
  finish): NEAR ~500 triangles within 22 m, MID ~220 to 80 m, FAR ~75 to
  450 m (`FAN_CUTS`), a bank handed over whole. A hidden part still costs
  its vertices, so a cut carries only the parts that read at its range.

**The loop** — `make audience` before and after (every sheet): `moves` is
each style through its animation frame by frame, `looks` the dealt
variety, `cuts` the three cuts and the game's pixels, and
`ARGS="--sheet=race --views=pass"` one bank of the finish slope frame by
frame as the racer goes by (with `course` and `combo` — up a slalom's
course from its middle, a combination's crowd — `idle`, `finish`, `stand`, `screen`,
`arena`, `jump`, `turn`, `overview`, `chase` for the rest; `--seed=7` has
jumps, `--hour=19.5` is under the lights). Then
`npx vitest run tests/spectators_test.ts`, and `make profile` for a cost.

## Skill self-improvement

Load **`skill-reflection`** before committing. Worth a fragment: a crowd
behaviour that read wrong only on the slope sheet, a pose that blended
badly, a cost that crept up, a fan move that only read frame by frame.
