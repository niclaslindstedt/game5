---
name: ski-physics
description: "Use when working on HOW THE SKIER ANSWERS THE SNOW — the six stations (tip, mid and tail of each ski) and THE LEGS they hang on, the sink into powder and how the skis float up onto the top of it with speed, the base's friction, the plough and the powder drag, THE EDGE (the sidecut bent into the snow, the carve's curvature, the grip an edge holds and a flat ski does not), THE SKID (the brake: the skis pivoted across the way, the scrub), the drive that is gravity and the POLES at a crawl, the TUCK and the drag it takes off, the skier's hips and the inclination into a turn, the carve on the base in powder, the body meeting the snow when the legs run out, the fall, flight and landings. Owns `engine/game/skier.ts`, `suspension.ts`, `snow.ts`, `poles.ts`, `flight.ts`, `chassis.ts`, `limits.ts`, the `TUNING.snow` / `.grip` / `.steer` / `.skier` / `.poles` / `.air` / `.hull` / `.reset` blocks, and `make ride` — the lab that must run before and after any change here. Not the pair's own numbers (`ski-tuning`) and not trees, gates or the edge of the map (`collision`)."
---

# The skier's physics

This skill owns **one question**: given the snow under his skis, what does the
skier do next?

Seven modules answer it, and the split matters:

- **`engine/game/suspension.ts`** — WHERE THE SKIS MEET THE SNOW, and THE LEGS:
  each ski is three stations (its tip, its middle under the boot, its tail),
  each a spring-damper cast along the body's own down axis (the raycast
  vehicle), and the three stations of one ski share that ski's leg
  (`LegSpec`) — a ski is a beam under a boot, so its tip and tail ride on the
  same knee as its middle. The rest load each station carries comes off the
  geometry (each ski half the weight, the stations a quarter, a half and a
  quarter), never off an authored number. Beside them the unsprung body
  points (`hullOf`: the hips, the shoulders, the helmet, the knees, the skis'
  tips and tails).
- **`engine/game/snow.ts`** — THE SNOW UNDER A STATION: how far it lets the
  ski sink (`sinkTarget`, `powderFloor`), what it costs to push through
  (`snowDrag`: the base's friction, the plough, powder drag) and how hard it
  can be gripped (`gripAt`: the edge's hold on packed snow, the base's hold in
  powder). Knobs in `TUNING.snow` and `TUNING.grip`.
- **`engine/game/poles.ts`** — THE ONE PUSH THAT IS NOT GRAVITY: the skate
  at a crawl and the double pole once rolling, AUTOMATIC below `poles.fade`
  and POWER-LIMITED (`min(polePush, power / v)`), in strides the pose reads
  (`SkierState.drive`, `stride`). Knobs in `TUNING.poles`. And THE TURN
  AT A CRAWL is STEPPED, not carved (`stepWork`, `stepYaw`,
  `SkierState.step`, `TUNING.poles.turn`): the skate turned to one side —
  a step of heading a stride, the V led into the turn, the edge eased off,
  the double pole given up for the skate — pushed all the way round, so he
  comes out faster than he went in. `make skate-turns` is its lab: the
  heading turned at 1, 2 and 3 s from each crawl speed, the time and
  radius to 90°, the speed against the same run straight, before
  (`--json`) and after (`--compare`), and the turning moves drawn from
  above over the line he takes.
- **`engine/game/skier.ts`** — THE BODY: every force summed in the world
  frame, torques about the CoG turned into the body frame, one semi-implicit
  step at 120 Hz (velocity then position, body rates then the quaternion).
  THE CARVE (the edge's curvature and the yaw it asks for), THE SKID (the
  brake pivoting the skis across the way), the hips, the inclination into a
  turn, the tuck's crouch, the arcade's hand on the yaw. Knobs in
  `TUNING.steer` and `TUNING.skier`.
- **`engine/game/flight.ts`** — THE AIR: the lean as the pitch lever, the edge
  as a little yaw, the body levelling the roll, and `landingLoss` — what a
  landing the legs could not take costs. Knobs in `TUNING.air`.
- **`engine/game/chassis.ts`** — the unsprung points meeting the snow when the
  legs have run out, as IMPULSES (sequential impulse, one pass), never as
  penalty springs. Knobs in `TUNING.hull`.
- **`engine/game/limits.ts`** — what a skier CAN do (`topSpeedOf`,
  `terminalSpeed`, `edgeLockAt` / `lockAt`, `carveCurvature`, `tipLimit`,
  `cornerGrip`, `brakeDecel`, `harshSpeedOf`, `flightGravity`), stated once,
  read by the physics AND `sim/bot.ts`.

`docs/riding.md` is the long-form account of every one of these, with every
number and what the ride lab measured at this tuning. Read it before the
first edit; update it with the last.

**Read this skill's lessons first** —
`npx ogf-skill-lessons ski-physics --list`.

| Load beside this one | For |
| --- | --- |
| `ski-tuning` | the pair's own numbers (`defs/skis.ts`) and the expectations a test holds them to |
| `collision` | the trees, the gates, the reset and the map's edge |
| `mapgen-improvement` | the snow the stations read: `groundAt`, `packedAt`, the kickers' profile, the piste's grade |
| `game-feel` | whether the answer READS as a skier on snow |
| `test-scenario` | staging a rest, a launch, a traverse on a synthetic map |

## The forces, and where each is written down

Each force is stated ONCE, with its model in the comment above it. Change a
term and the comment's claim has to stay true.

| Force | Model | Where |
| --- | --- | --- |
| The legs | Raycast vehicle: each station a spring-damper along the body's down axis against the snow's SUPPORT (the surface less the sink), bottoming control over the stroke's last 30 %, and a HYSTERETIC stop past its travel (`STOP_RELEASE` — a knee at the end of its bend swallows a slam rather than springing off it); the damper's rate is the compression's own change, read off the same surface as the spring; the snow answers along its OWN NORMAL; the TUCK folds the legs, so a crouched skier sits lower and has less leg left for a landing | `suspension.ts`, `skier.ts` |
| The sink | The planing-hull analogy: support rises with speed as exp(−(v/planeSpeed)²), blended by `packed`, eased over `sinkLag`; the tip and the tail sink less than the mid station (`endSink` — the ski is a beam) | `snow.ts` — `sinkTarget` |
| Resistance | The base's friction as a share of the load (`crrPacked` on the groomer, `crrPowder` in fresh snow); THE PLOUGH (the bow wave of a sunk tip, ∝ width · sink · v², the tip station only — the mid and the tail run in the furrow it cuts); powder drag ∝ load · v | `snow.ts` — `snowDrag` |
| Grip | Coulomb on the station's load, each coefficient a `tanh` of its slip over `sideRef` (an edge lets go progressively, then all at once); on packed snow THE EDGE'S hold scaled by how much edge the ski stands on (`flatShare` of it lying flat, the rest with the edge angle) and by the pair's `footprint.ts` edge factor (a stiff long ski holds more, a rockered one less); in powder THE BASE'S hold, width-scaled; blended by `packed`; ice through `onIce` (`grip.ice`) | `snow.ts` — `gripAt`; summed in `skier.ts` |
| The carve | A ski on `edge` rad bends its sidecut into the snow and runs the arc it makes: curvature `tan(edge) / sidecut` (`carveCurvature`), tightened by a lean forward (`steer.tipLoad`); the yaw the skis ask for is the way times that; the edge is reached at `steer.edgeRate` (scaled by the pair's length and flex) and its full angle fades with speed (`edgeLockAt`) | `skier.ts`, `limits.ts`, `TUNING.steer` |
| The skid | THE BRAKE: the skis pivoted across the way by up to `skidAngle` at a crawl, narrowing toward `skidFast` by `skidFadeSpeed` (a hockey stop is a narrower angle held harder), reached at `skidRate`; the pivot puts the sideways grip against the way, and `skidDrag` charges the snow shoved aside; `skiAngle` is the pivot plus the edge's toe-in | `skier.ts` — `skidAngleAt`, `TUNING.steer` |
| The scrub | An edge holding a carve is cutting a groove: a drag of `steer.scrub` of the bend's own acceleration (the rate ASKED × the way), on the packed share only | `skier.ts`, `TUNING.steer.scrub` |
| The yaw hand | ARCADE: the yaw rate held toward the one the edge's geometry asks for, the nose held to the way — models nothing, stated as such; stated on the reference pair, scaled by each pair's yaw inertia | `skier.ts`, `TUNING.steer.yawHold` |
| The arcade's hands | ARCADE multipliers on measured quantities, 1 the bare physics: `sideGrip` on every sideways grip, `hangOff` on the tipping point and the roll held; in the air the pitch eased toward the flight path | `TUNING.arcade`, `TUNING.air.pitch*`, `skier.ts`, `flight.ts` |
| The drive | GRAVITY, and at a crawl THE SKATE AND THE DOUBLE POLE: the lesser of `polePush` and `poles.power` over the SPEED (never the way — a sideways slide pushes nothing), whole under `poles.speed`, gone by `poles.fade`, in half-sine strides of `duty` on a `floor`; automatic once rolling past 0.4 m/s or asked with the tuck, stopped by the skid, a jump loading, the air and a throw; the crouch is the tuck less the drive | `poles.ts` — `poleForce`, `driveForce`, `strideShape` |
| The jump | Loaded while held on the snow to `jump.full` s (the crouch deepening), sprung on the release at `popMin`…`popMax` m/s off the snow's own normal | `skier.ts`, `TUNING.jump` |
| The hard cut | The back key after the edge: the edge's lock raised by `carve.edge` (never past `edgeMax`), the curvature by `carve.tighten`, the grip (and the yaw hand's and the incline's reach) by `carve.grip`, the scrub spared `carve.scrubSpared` | `skier.ts`, `TUNING.carve` |
| The landing's load | EFH = v⊥²/2g over the legs' `landing.stroke` (less a tuck's share) plus `give` of the loose snow: 1 + EFH/stroke g; what it forgives (`landingTolerance`) against how far off true the skis came down (`landingOff`) — read by `crash.ts` | `flight.ts`, `TUNING.landing` |
| The tuck | The body folds toward the crouch the tuck asks for at `skier.crouchRate`; the drag area eases from `cdAUpright` to `cdATuck` (`dragAreaOf`) and the CoG drops by `crouchDrop` | `skier.ts`, `defs/skis.ts` |
| The skier | His hips moved inside the turn (`hipRight`, the angulation, once the bend pulls `hangG`) and fore and aft (`hipAft`), lagging; the INCLINATION the whole settles at into a carve (`rollPacked`, `rollPowder`, held by `rollStiff` up to `rollMax`); in powder THE CARVE ON THE BASE — a ski rolled over in powder turns toward the low side, `carve` per radian of roll, with way on | `skier.ts`, `TUNING.skier` |
| Air control | Lean → pitch (tips up is back), the edge → a little yaw, the body levelling the roll up to `rollGiveUp`; no lever rolls a skier in the air and the tuck does nothing there | `flight.ts` |
| Landing cost | Past the pair's `harshSpeedOf` INTO the slope, a share of the way per m/s over, capped | `flight.ts` — `landingLoss` |
| Body contacts | Velocity-level impulse through the effective mass (angular term in), a little restitution, a capped push-out, Coulomb friction; against the powder's FLOOR; the tuck lowers every body point | `chassis.ts` |
| Gravity, air drag | g on the CoG, and in genuine flight the run's heavier ARCADE pull (`RunRules.airGravity`: `air.gravity` on a race, 1 on a tricks run; `limits.ts`'s `flightGravity`, which the bot reads too); ½ ρ C_dA v² with ρ at −8 °C two thousand metres up | `skier.ts`, `TUNING.airDensity`, `TUNING.air.gravity` |
| The landing looked for | ARCADE: the pitch hand eases the skis onto the slope the ballistic arc will land on over the last `landLook` s (`landingAhead`) | `flight.ts` |
| The high-side | A CAUGHT EDGE: the sideways slip at a station (`SkierState.sideSlip`) past `crash.catchSlip` while the edge stands over `crash.catchEdge` throws him (`skier.slipSpeed` / `.slipEdge` are where the bot stands its edge down) — read by `crash.ts`, measured here | `skier.ts`, `TUNING.skier` |

## The instrument: `make ride`

A skier taking a kicker is a dozen numbers changing together over two
seconds, and watching it in the game shows a sheet of snow. So do not: stage
it on the bench and read it.

```sh
make ride SCENARIO=rest               # ONE scenario
make ride SCENARIO=kicker
npm run ride                          # every scenario, one table
npm run ride -- powder --seconds 30
```

It stages the scenario on a SYNTHETIC map (`tests/support/synthetic.ts`) with
`placeRun`, skis a scripted input through the real engine at 120 Hz, prints
the numbers and writes `previews/ride-<scenario>.png`. **The table is what a
claim gets made out of; the picture is what tells you which number to go and
look at.** The scenarios are `scripts/lib/ride-scenarios.mjs`:

| Scenario | What it isolates |
| --- | --- |
| `rest` / `rest-powder` | The stance: the CoG height, the knees' bend, the sink, level, no drift — on the groomer and in powder |
| `poles` | Poling from rest across the flat with the tuck held: the speed at 5 and 10 s, the metres |
| `schuss` / `schuss-tall` | A tuck, and standing tall, down the 20° groomed pitch from a push-off: 0–50 and 0–100 km/h, the top speed, the sink at it |
| `powder` | The same tuck down the 20° pitch in powder: the schuss's numbers and the speed it PLANES at |
| `brake` | A snowplough from 80 km/h on flat packed snow: the stop's time, metres and mean g |
| `plough` | A snowplough held down the 20° groomed pitch from 60 km/h: the speed at 4 and 12 s, the pitch |
| `hockey-stop` | A hockey stop (full brake, full edge) from 60 km/h on the flat: the stop, how far across the skis came, the roll, whether he was thrown |
| `carve` / `carve-fast` | A 0.6 edge at 60 km/h and a 0.4 edge at 100, GOVERNED, down the 20° groomed pitch: radius, speed, lateral g, the edge and the roll |
| `turn-in` | The skis thrown onto full edge at 80 km/h: time to nine tenths of the yaw, degrees round in a second, settled g, the radius, the roll |
| `turn-lean` / `turn-back` / `turn-brake` | Settled in a 70 km/h bend at 0.5 edge, then the weight forward, the weight back, or the skid put on: the tips' load, the yaw and the radius before→after, the worst slip |
| `brake-turn` | The skid thrown into a turn from 100 km/h on the flat: the worst slip, whether he spun, where he stopped |
| `catch` | An edge caught: the skis flung across at 70 km/h, then stood on their edge — the worst side slip, the wipeout and its cause |
| `carve-powder` | A 0.6 edge at 50 km/h down the 20° pitch in powder — the carve on the base: radius, g, the roll into it |
| `kicker` / `kicker-slow` | The slope's kicker at 75 and at 45 km/h: launch speed, air time, carry, height, the landing's impact and cost |
| `drop` | Dropped from 3 m at 70 km/h onto flat packed snow: the impact and what it cost |
| `climb` / `wall` | A 30° powder slope run at uphill from 70 km/h, and a 45° face from 90: how far up, the stall, the slide back (and on the wall whether he was thrown) |
| `sidehill` | Across a 40° groomed slope at 40 km/h: the worst roll, whether he went over, the slide down it |
| `tree` / `tree-glance` | A trunk met at 50 km/h, and one clipped at a crawl in a snowplough: the speed in and out, the yaw, the wipeout |
| `nose-in` / `rollover` | A landing 40° over the tips at 60 km/h, and thrown onto his side at 70: the impact, the wipeout, how far the body slid, the reset |
| `skate` | Hands off from a shuffle across the flat: the drive's speed at 1, 3, 6 and 12 s |
| `jump-tap` / `jump-full` | The jump tapped and loaded 2 s at 50 km/h on the flat: the pop, the air, the peak, the impact |
| `carve-hard` / `carve-full` | A full edge at 80 km/h down the pitch, cut hard and not: radius, g, the edge |
| `drop-true` / `drop-rolled` / `drop-big` / `drop-big-powder` / `drop-big-tilted` | Drops of 1.5 m and 8 m at 70 km/h, true, rolled or tips-down, onto the groomer or into a metre of powder: the impact, the EFH, the load in g, how far off true, whether he was thrown |
| `stuck` / `stuck-held` | Poling from rest in a metre of fresh snow: bogged, then rocked out and skied off — or the push held until the engine resets him |
| `rest-deep` / `schuss-deep` / `schuss-deep-back` | A metre of fresh snow (the dial's deepest): how far down he sits at rest, whether he planes tucked, and leaning back to lift the tips |
| `bog-deep` | Planing through a metre at 70 km/h, stood up out of the tuck for four seconds, then tucked again: the slowest he got, the deepest sink, when he was back on top |
| `sidehill-deep` / `sidehill-deep-held` | A 10° traverse in a metre at 20 km/h, hands off and with the weight hung on the uphill ski: the worst roll, whether he went over, how far he skied |
| `backflip` / `frontflip` / `spin` / `pose` | A staged launch over flat snow in a tricks run — the lean back, the lean forward, the edge thrown over, a grab let go before the landing: what was won, the landing, the combo |
| `kicker-flip` | The slope's kicker at 75 km/h with a backflip off it: the same numbers off a real lip |

**Run it BEFORE the first edit and AFTER the last**, on every scenario the
change plausibly reaches, and put both tables in the PR. `docs/riding.md`'s
"Measured" table is the baseline at this tuning; a change that moves a row
rewrites that row. No build, no browser, seconds.

### The bench — where a NUMBER about the skier comes from

- **On the flat strip or its pitch, not on a generated map.** `flatLevel()`
  is a drag strip, all packed or all powder, with a grade when asked;
  `syntheticLevel()` is the slope with a kicker, rollers and a lone tree. A
  figure taken on a generated map is a figure about whatever roller, bank or
  trunk the run happened to meet.
- **A plain-Node bench CAN use the synthetic map.** `aliasEngine('<repo>')`
  from the framework's `tooling/alias` before the dynamic `import()` resolves
  `@engine`, and vitest is a devDependency so the support file's imports
  resolve. Import `syntheticLevel` / `flatLevel` directly.
- **NEVER MEASURE AN ATTITUDE OFF `pitch` OR `heading`.** Both are Euler
  readings `toEuler` folds at ±90° of pitch, so a skier going over backwards
  reads as a reversal and a heading swings a clean 180°. Use `∫ −wx dt` over
  the airborne stretch for how far he pitched (body-frame, does not wrap),
  and `rotate(q, {x:0,y:1,z:0}).y` — his own up in world — for whether he is
  still the right way up (the reset reads exactly that: `reset.overUp`).
- **`speed` HAS NO DIRECTION.** It is `|v|`, vertical included. "How fast
  forwards" is `way`, the speed along the skis' own line, signed.
- **Settle before measuring.** `placeRun`'s `speed` is a placement, not a
  settled skier; give him a couple of seconds down the pitch in the tuck the
  case asks for, and quote a terminal speed once the drag has caught up.
- **Quote a rate at a FIXED TIME and a time to half.** An average to a full
  stop is mostly the tail. For a turn, quote the lateral g and the radius at
  a MATCHED entry speed, re-staged as its own run — radius goes as v², so a
  change that raised the terminal speed gets credited with a turn it never
  lost.

## The rules

- **THE SKIER STANDS AT THE HEIGHT HIS SPEC SAYS.** The rest loads come off
  the geometry and each attachment is placed so its leg sits at its rest sag
  with the CoG at `cogHeight`; `tests/skier_test.ts` holds it. A skier who
  stands wrong at rest is wrong everywhere else too, so `rest` and
  `rest-powder` are the first strips after any station or leg change.
- **THE SINK IS THE SUPPORT, AND THE TRAIL NEVER DRAWS SHALLOWER.** Every
  station's `SnowContact.sink` is the depth of the support under the
  untouched surface. The renderer's `drawnDepth` (`trail-stamp.ts`) draws
  the sink or the powder's own furrow, whichever is DEEPER — a planing ski is
  carried a couple of centimetres in, but the eye expects a hand-deep furrow
  — so the drawn trail may be deeper than the physics, never shallower. A
  sink computed anywhere but `snow.ts` is a ski riding inside its own furrow.
- **DEEP SNOW IS THE ORDINARY SNOW'S MODEL PLUS THE BOTTOMLESS SHARE.**
  Everything deep snow adds (`snow.ts`'s header: the give under load, the
  snow staying pressed, the later planing, the body's plough, the roll the
  skier holds — `skier.deepHold`, `deepTip`) is multiplied by
  `bottomlessOf(state.snowDepth)` — zero at the ordinary dial, and off the
  DIAL, never the dial with a fall's new snow in it — so every race stays
  bit-identical. A term that leaks past that share shows as a moved
  `make sim` digest on the snowing seeds first.
- **POWDER IS A HUMP.** The plough grows with v² while the sink it multiplies
  falls away with speed, so a bogged skier wants MOMENTUM, and a skier who
  planes at walking pace or never planes at all has lost the one thing that
  makes powder powder. `powder`'s planing speed is the number to read.
- **THE DAMPER READS THE COMPRESSION'S OWN CHANGE.** Against the same surface
  as the spring, so a crease is a crease in both. A damper reading the CoG's
  vertical speed brakes a whole skier for one tip crossing a lip.
- **THE BODY IS IMPULSES, NEVER A STIFF SPRING.** A penalty spring stiff
  enough to hold ninety kilos off a slope met at eighty kilometres an hour
  stores the impact and hands it back — the skier who hit the foot of a face
  was fired forty metres up it. The two FUSES (`MAX_LOAD`, `MAX_SPIN`) are
  guards, not models; a change that leans on one is a force that is wrong.
- **THE DRIVE IS GRAVITY, AND A MAN'S PUSH OTHERWISE.** Nothing but the
  slope can push a skier past a skater's pace: the skate and the double
  pole are power-limited and gone by `poles.fade`, one-way, never a brake,
  and read off the SPEED — a push read off the way was a motor for a skier
  sliding sideways (the bot on seed 4 hit 150 km/h in a spin before it was
  fixed). A term that accelerates a skier on the flat at speed is a motor,
  and this game has none.
- **THE TOP SPEED IS WHERE THE DRAG MEETS THE SLOPE, NOT A CEILING.** The
  terminal speed on a pitch is the air's drag on `cdATuck` balancing the
  slope's pull less the base's friction (`terminalSpeed`); `SKIS.topSpeed` is
  an EXPECTATION on `TOP_SPEED_PITCH` the test holds the physics to
  (`ski-tuning`), never an input.
- **THE SNOW PUSHES ALONG ITS OWN NORMAL.** A raycast strut's force pushed up
  the body's own axis gives the skier a sideways force no grip paid for
  whenever the body inclines off the slope — every carve pushed wide at 0.9 g
  whatever the edge held. The normal force is the spring over the cosine
  between strut and normal, along the normal; sideways is the grip's.
- **THE EDGE HOLDS, THE FLAT SKI SLIDES, AND PAST THE EDGE IT CATCHES.** The
  sideways grip on packed snow is `flatShare` of the edge's hold with the ski
  flat and the rest with the edge angle; a ski stood well over while the
  snow slides across it faster than `slipSpeed` is a caught edge and a
  wipeout (`crash.ts`). A carve that holds the same on a flat ski is a ski
  with no edges.
- **THE SKID IS THE BRAKE, AND THE SKID COSTS.** The brake pivots the skis
  across the way and lets the edge's sideways grip and `skidDrag` scrub the
  speed; a brake that slowed a skier without pivoting his skis is a disc on a
  wheel. The bot uses it for the bends it cannot carve and to hold a kicker's
  speed.
- **A HAND IS AN ACCELERATION, SO SCALE IT BY THE INERTIA.** Every arcade
  hand is stated on the all-mountain pair and multiplied by the pair's own
  inertia about its axis (yaw, pitch) or its weight times its CoG height (the
  roll held): a torque that holds the reference pair lets the downhill ski
  spin or fall.
- **THE YAW HAND IS ARCADE, AND SAYS SO.** `steer.yawHold` exists because the
  bare physics spun a skier who skidded hard into a turn through a slide no
  human survives. It must stay a hand on the RATE the edges ask for, never a
  source of turn: a hand that turns the skier on its own is a skier who
  steers without edges.
- **MEASURE THE SLIDE OFF WHAT WAS ASKED, NOT OFF WHAT THE SKIER IS DOING.**
  Any assist or threshold read off the resulting yaw rate or slip angle
  closes a loop — more slide, more authority, more slide — and a loop with
  gain over 1 has no middle: the skier becomes two-state, gripped or fully
  sideways a notch of edge apart. Read the demand off the edge and the way.
- **GATE A LATCH ON BOTH EDGES.** Anything that switches — the `air` event
  (`air.counts`), the automatic reset (`overFor`, `stuckFor`), a harsh
  landing — needs hysteresis or a hold time, or it chatters several times a
  second on a skier skipping over a roller.
- **THE CARVE IS THE EDGE'S ON THE GROOMER AND THE BODY'S IN POWDER.** On
  packed snow the sidecut turns the skier; in powder the edges are buried,
  the ski turns on its base and the roll is the whole of the turn. A base
  carve that works on the groomer is a skier who turns twice.
- **THE AIR IS THE BODY'S, AND NOTHING ROLLS A SKIER IN THE AIR.** Once no
  station and no body point touches, `flight.ts` has the controls; the roll
  is levelled by the body and given up past `rollGiveUp` — a skier thrown
  onto his side comes down on his side. A landing is a hand-back to the
  legs; `land` fires off that transition, and nothing in `flight.ts` decides
  a landing happened.
- **THE FALL IS THE FAR END OF THE SAME MODEL, NOT ITS OWN SYSTEM.** A skier
  goes down when the roll load passes what he and his legs can hold
  (`rollMax`) or the traverse is steep enough; after that the body points
  carry him and `reset.overFor` stands him back up. Stage it on the bench
  (`sidehill`), never judge it from a run in the game. A skier who goes over
  AT SPEED is thrown off his skis (`crash.ts`, the `crash` skill), and a
  skier BOGGED in powder (`trench.ts`) is a deeper sink and a weaker pole
  push read here — `trenchGrip` and the trench on the stations' sink target,
  both exactly neutral out of a hole, as the damage shares are on a sound
  pair.
- **ANGULAR VELOCITY IS BODY-FRAME, THE QUATERNION IS BODY→WORLD, AND IT IS
  RENORMALISED EVERY STEP.** `heading`, `pitch`, `roll` are derived from `q`
  each step for the HUD, the camera and the bot — never integrated on their
  own. Tips-up is a NEGATIVE `wx`; right-side-down a negative `wz`
  (`state.ts`'s header).
- **A CONTROL GAIN IS AN ACCELERATION, NOT A TORQUE.** The whole's inertia
  (`inertiaOf`: a tall body over a pair of rods) is very different about the
  pitch, the yaw and the roll axes, so a gain in N·m means very different
  corrections about each. Print `inertiaOf` before sizing anything; moving θ
  rad in t seconds needs about 2θ/t² of angular acceleration.
- **SIGNS BITE AND READ AS SOMETHING ELSE.** A body torque about axis `a`
  swings a fixed WORLD direction the other way round it: anything steering
  toward an attitude works on `unrotate(q, worldUp)` and the axis carrying
  that onto the target is the NEGATIVE of the torque axis. The tell of a
  flipped sign is a controller that is large, smooth and confidently wrong;
  a mistuned gain oscillates.
- **EVERY NUMBER HAS UNITS AND SAYS WHAT KIND IT IS.** A measurement (the
  air's density, a base's friction off the literature) is argued against the
  world; an arcade dial (the yaw hand, the air levers' authority) against
  `make ride`.

## Workflow

1. **Take the baseline first.** `make ride` on every scenario the change
   reaches (`rest` and `schuss` always), before the first edit.
2. **Find WHICH STEP goes wrong, and which FORCE.** Walk the run one step at
   a time and print any step where the speed, a body rate or a station's
   compression jumps; a skier who is wrong is almost always one force firing
   where it should not (the plough on a tail running in the tip's furrow, a
   stop on a station that is not touching, a pole push at speed) and a long
   correct stretch after it that an average hides. When a ROTATION is wrong,
   print each torque's contribution per step.
3. **Make the comment true before changing the number.**
4. **Re-run the lab, the tests, then `make sim`** —
   `npx vitest run tests/skier_test.ts tests/flight_test.ts tests/handling_test.ts tests/collision_test.ts tests/simulation_test.ts tests/determinism_test.ts`,
   then the table (pace, air, hits, resets are where a physics change shows).
5. **LOOK.** `make world SEED=<n>` (no dist needed) for the skier on real
   snow from the renderer's own cameras; `make build` then
   `make screenshots` for the app.
6. Docs: `docs/riding.md` — the model, the numbers, the measured table.

## What the change obliges elsewhere

- `docs/riding.md` for any force, model or constant, and its measured table.
- `make ride` before/after on the reached scenarios, and `make sim`
  before/after, in the PR.
- A change to the drive or the turn at a crawl: `make skate-turns`
  before/after too — a skier who barely comes round at 10 km/h is the
  first thing a player feels.
- `SKIS.topSpeed` re-derived if the physics legitimately moved it
  (`ski-tuning`).
- A `.changes/unreleased/` fragment — the skier is what the player is.

## Skill self-improvement

Record lessons under `.agents/skills/ski-physics/.lessons/` via the
**`skill-reflection`** skill. What belongs here: a force that fired where it
should not have and the tell in the ride table that found it, a feedback loop
that made the skier two-state, a spring or a fuse that read as the model —
the class of failure, not the one-off.
