# The snowmobile

A free ride's way up the mountain on the snow itself. A deep-snow mountain sled is parked at the bottom of the mountain, beside the village. A skier who stops beside it and presses **Enter** (a double tap on either thumb on touch) is taken on: his skis and poles go into the rack on its tunnel and he stands on its running boards in his boots. Then the player rides it — the thumb throttle, the brake, the bars and his weight — anywhere on the mountain, up the faces no lift reaches. **Enter** again steps him off: his skis are on his feet again and the machine stays where he left it, idling a while and then shut off, to be taken again. Rolled over, looped, landed on its side or its nose, dropped off a height, ridden into a rock wall or run into a trunk, it throws its rider — bumps, jumps and drops onto snow it rides out; stood back up, he is back on it, the machine back on its belt.

It is reached two ways:

- **The start card's RUN row**, whose second-last stop is SNOWMOBILE (`free-ride.ts`'s `SLED_RUN`). The ride begins stood on its boards at the bottom, the engine running. `?start=free&sled=1` is the same ride from a link.
- **Getting on where it stands.** On every free ride it waits at the bottom (`sled-pad.ts`'s `sledSpotOf`). Within 60 m of it the HUD calls the skier to it and a halo over it pulses; within 45 m it lights up (`snapshot.ts`'s `sledOf`, `sled-view.ts`). Within `SLED.board.reach` (5 m) of it, slower than `SLED.board.fastest` (12 m/s, a cruise — no need to stop) (`sledWithin`), the call becomes a press reading **ENTER OR CLICK TO RIDE** (**TAP TO RIDE** on touch), and the MACHINE press (`SkierInput.machine`: Enter, the skier's `machine` key in `settings-input.ts`, the call tapped or clicked — `hud-machine-press.tsx` — the machine itself tapped or clicked on screen — `machine-pick.ts` — or a double tap on touch) takes him on. Skiing into it never does. A machine left anywhere on the mountain is taken the same way, and one lying on its side is stood back on its belt as he takes it.

## Where it lives

| Piece | File |
| --- | --- |
| Every number, the probes and the geometry the model is built to | `engine/game/defs/sled.ts` (`SLED`, `SLED_PROBES`) |
| The rigid body: the springs, the grip, the carve, the air, the hull | `engine/game/sled-body.ts` (`rideSled`) |
| The engine, the CVT and the belt | `engine/game/sled-drive.ts` |
| Boarding, the rider on the boards, the hop, the trees, the crash, the remount | `engine/game/sled.ts` (`stepSled`, `startSled`, `standSled`, `sledControls`) |
| Where it is parked | `engine/game/sled-pad.ts` (`sledSpotOf`) |
| The bot's hands on it | `engine/game/sled-pilot.ts` (`sledPilot`) |
| The state and its events | `SledState`, `SledEvent` in `engine/game/sled-state.ts`; `RunRules.sled`, `GameState.sled`, `SkierInput.sledOff` |
| The class's traced side profile | `pwa/src/game/sled-look.ts` |
| The machine as drawn (the model posed off the engine, the rack, the lamp, the halo) | `pwa/src/game/sled-view.ts` |
| The tracks, the roost, the rider stood on the boards | `pwa/src/game/sled-scene.ts`, held with the helicopter by `machines.ts` |
| The camera while he rides it: the ladder framed off the machine on rows of its own | `pwa/src/game/camera-sled.ts` (`SLED_RIGS`, `sledRigPose`) |
| The cockpit on the HELMET rung: the bars and every control on them, the display, the rider's hands (where each stands and how it moves, what the display reads; as drawn) | `pwa/src/game/sled-cockpit-plan.ts` (three-free), `pwa/src/game/sled-cockpit.ts`; `tests/sled_cockpit_test.ts` |
| The rider's stance over the bars | `pwa/src/game/skier-sled.ts` (`boardPose`), read through `skier-seat.ts` |
| The HUD's tachometer and its call | `pwa/src/game/hud-sled.tsx`, `pwa/src/sled.css` |
| The sound | `pwa/src/game/audio/sled-*.ts` (see `docs/audio.md`) |
| The Blender model | `scripts/blender/sled.py`, `scripts/blender/kinds/sled.mjs`, published to `pwa/models/sled.glb` by `make models KIND=sled` |
| The lab | `make sled` — `scripts/sled-preview.mjs` over `pwa/src/tools/sled-harness.ts` and `sled-scenes.ts` |

## The machine

The class is the long-track MOUNTAIN sled, the one built to climb, measured across the current machines of the class:

- an 850 cc liquid-cooled two-stroke twin, 165 hp (123 kW) at about 8,000 rpm, the drive clutch engaging near 4,000, idling round 1,500;
- about 200 kg dry (the class is 195–212 kg) and 30 kg of fuel;
- a 165-inch belt (4.19 m) 16 in (0.41 m) wide of 3-inch (76 mm) paddles, the tallest made, unstudded;
- a narrow 36-inch (0.91 m) ski stance, so the machine can be rolled onto its side and steered with the body (a trail sled stands at 42–43 in and is steered by the bars);
- 9 in (0.23 m) of travel in front and 15 in (0.38 m) behind, a tall riser for a standing rider, a short seat, an open tunnel and open running boards;
- some 3.3 m long and 1.1 m wide, about 140 km/h flat out on the groomer.

The rider is the skier, his skis and poles racked; the machine and he are one rigid body.

The frame is the engine's: x right (the side the screen draws on the rider's left — the renderer's frame mirrors the map, as `heli-rotor.ts` says), y up, z forward, the origin at the centre of gravity of the sled and its rider. `SLED.trace` carries the traced profile's frame (z forward from the tunnel's end, y up from the snow under the belt) onto it.

## The physics

The sibling sled game's model, restated for the one machine over this game's snow (`snow.ts`). Every force is summed in the world frame, the torques taken about the centre of gravity, and the whole integrated semi-implicitly at 120 Hz.

- **The suspension.** Eight probes: one under each ski and three stations down each edge of the belt (`SLED_PROBES`). Each is a spring-damper along the body's down axis against the snow's SUPPORT — the surface less the sink the speed allows, the skier's `sinkTarget` at the belt's and the sled ski's own scale (a belt at 4–5 kPa sinks further at rest than a pair of skis and planes later) — with a progressive bump stop. Each strut hangs so its rest load sits it a third into its travel.
- **The belt's grip** is one budget spent along the combined slip (the friction ellipse): the belt slipping along its length and the snow sliding across it. Its shear saturates with the slip (Janosi and Hanamoto, in velocity form), and in powder the paddles also shear the snow's cohesion over the belt's area (c·A). So a belt spinning under full throttle has little left to hold the tail with, and the tail walks out. Only the belt's front cuts fresh snow (the plough); the middle and the rear run in its trench.
- **The drive** (`sled-drive.ts`): a two-stroke's power curve, a CVT that holds the engine at the rpm the thumb asks for while the belt walks up the sheaves, and the belt as a mass of its own the engine pushes, the snow pushes back on and the brake clamps.
- **The rider.** His weight goes across with the bars and fore and aft with the lean — on the groomer as far as the bend asks, in powder wherever the bars send it. The chassis settles into a small lean on the groomer and a large one in powder. In powder a sled rolled onto its belt's edge CARVES toward its low side, and the soft snow gives under the loaded side (RIDE IT LIKE A BIKE), so a powder turn and a sidehill are the rider's balance.
- **The air.** The lean pitches it, the belt's gyro lifts the nose on the throttle and drops it on the brake, and the rider levels the roll with his body.
- **The hull.** Ten unsprung points (the nose, the belly, the tunnel's corners, the riser) meet the snow as impulses when the springs run out. That is how it lies on its side and how it rolls over.
- **The arcade's hand** (models nothing, says so): on the snow the yaw rate is held toward the one the skis ask for, no faster than the grip can turn the way (on the groomer the skis' carbides, about 0.8 g; in powder `steer.reachPowder`, about 0.65 g, a sled rolled onto its edge and carved), and the nose toward the way it is going.

What it does, held by `tests/sled_test.ts`:

- about 140 km/h flat out on the groomer;
- sits 20–30 cm down into powder at rest and climbs out onto it as it gathers speed;
- climbs a 24° powder face from a standing start;
- charged at a 35° face at 50 km/h, it bogs and stalls — a high-mark;
- rolls onto its inside edge through a powder turn.

Pinned from a crawl in powder, the belt spins far faster than the machine goes. That slip is what throws the roost and what the churn and the belt's whine say.

## Rollover

A mountain sled is built narrow — a 0.91 m (36-inch) ski stance under a CoG some 0.66 m up with a standing rider — so it can be rolled onto its belt's edge and steered with the body. Its static stability factor (half the stance over the CoG's height) is about 0.69: on level, firm snow it tips onto its outside ski at some 0.7 g of sideways pull, or leant about 35° off the way its weight hangs. In loose snow the low ski sinks and the machine stands on little more than its 0.41 m belt, which it passes over at about 17°. Mountain riders hold it there by hanging off the high side and countering the bars, and the throttle keeps the belt on top; the sidehill fall — stalled across a steep deep face with nobody on the uphill side — is the one every rider learns on.

The game's machine does the same (`SLED.roll`, `sled-body.ts`):

- **The rider takes it to its lean** no faster than about a radian a second, and the damping checks what is past the lean's own rate, so a flick of the bars rolls it from one edge to the other without throwing it off a crest mid-roll.
- **The soft side gives** in deep snow, and the rider **balances** against it with the bars and his weight (`roll.balance`) — the more with the way on to counter-steer with. It goes over only where the snow asks more of him than that.
- **The tip.** How far it leans is read against the way its weight and the turn's pull hang together (a sled leant into a turn as a bicycle is, is upright to it). Past the angle its CoG passes over the low edge of what it stands on — the skis' stance on firm snow, narrowing to the belt as the low ski sinks into loose — and a little more for the rider hung off the high side, the righting the rider and the springs lend fades out (`roll.tipBand`) and the weight takes it over.
- **The sideways hold stops growing** past two and a half times a probe's rest load (`grip.sideLoad`): under a landing's load the groomer's crust shears and the machine slides, rather than being tripped over its low side.

So on the flat it never goes over — any turn, held, flicked or linked, on the groomer and in powder from a thin cover to bottomless — and it holds a traverse into the hill; stalled across a 35° face of bottomless powder it goes over. `make sled-tip` rides the bench (every turn on the flat at 10–120 km/h, five snows, and seven ways across a 20°, 30° and 35° face) as a table, and `tests/sled_tips_test.ts` holds it.

## The controls

There is no key table of its own: the skier's keys ride it (`sled.ts`'s `sledControls`).

| | Keys | Touch |
| --- | --- | --- |
| Throttle | the tuck (W) | the lever pushed down |
| Brake | the back key (S) | the lever pushed up |
| Bars | the edge (A / D, ← / →) | the edge thumb across |
| Weight forward / back | the leans (↑ Q Z / ↓ E Shift) | the edge thumb up and down |
| Get on / ski off | Enter (the machine key) | a double tap on either thumb |
| Stand it back on its belt, stopped | the reset (R) | the reset press |

The jump does nothing on the boards, so a jump key pressed out of habit never throws a skier off his machine, and the press that takes him on is never read as the one that takes him off. Stepped off, he stands beside it on its left (the rack's side) on his skis, with its way if it was moving.

## The machine left, and the crash

Left with nobody on it, the machine is still a body: it settles where it stands on its parking brake, so one left in powder sits down into it, and one left on a slope stays there. Its engine idles for `SLED.idleFor` (25 s) and then shuts off. The minimap shows it as an orange square.

The rider is thrown (the `sled` crash cause, its tumble in `defs/crash.ts`) when the machine:

- meets a trunk harder than `SLED.crash.tree` (7 m/s);
- stands past `crash.over` (about 72°) of roll or pitch off the snow for `crash.overFor` (0.25 s): rolled or looped;
- comes down into the snow, along the snow's normal, harder than `crash.landing` (15 m/s) on the groomer, up to `crash.landingPowder` (19 m/s) in deep powder — a drop of some 7.6 m and 12 m at the flight's gravity — so a kicker onto the flat, a ledge into powder or the edge of a face ridden over are ridden out, and a cliff is not;
- comes down more than `crash.tilt` (40°) off its belt, on its side or its nose, any harder than `crash.tiltFrom` (4 m/s);
- has the way it was going stopped `crash.wall` (8 m/s) in one step — a rock wall or a cliff band ridden into at speed. Ridden into at a crawl, it just stops.

How he goes off depends on what put him off. Stopped under him by a trunk, a wall or a landing, he goes on over the bars (`crash.over.sled`). Rolled over, he falls off its low side as it goes: turning with it, barely head over heels and not thrown up (`crash.rolled`). A machine lying in deep powder has him partly under the snow, so his body is lifted onto it first (`liftOutOfSnow`) rather than shoved out of it and flung. Either way his skis stay strapped on the rack and he lies in his boots, and the rack stays drawn on the machine until he is stood back on it. The lab's `crash` sheet (`make sled ARGS=--sheet=crash`) shows both: a trunk at 55 km/h, and a stall across a steep face of deep powder that goes over.

Nothing else on snow throws him. In the air the rider levels the roll with his body, but only so hard (`air.rollMost`): a lip tipped a little is levelled, one tipped hard comes down on its side. And the machine SETS ITS NOSE for the landing (`air.setStiff`, the run's `assist.air`): pitched toward the snow it will come down on, a little nose high, so a jump does not land on its tail or its nose — let go to the rider the moment he leans or brakes, so a nose he drops or throws back is his own. `make sled-land` rides every one of these as a table, and `tests/sled_landing_test.ts` holds it.

An amateur on a free ride shouldered hard enough to throw a skier (`crowd.ts`'s `clipCrowd`) throws him off the boards too, with the `skier` cause.

The machine goes on without him and lies where it comes to rest. When he is stood up (the reset), he is back on it, standing it on its belt again.

## The look

The model is made in Blender off `SLED` and the class's traced profile (`make models KIND=sled`). It is cut into rigid nodes the game poses every frame off the engine (`SLED_NODES`):

- the bars, turned about the post with the skis;
- each ski, lifted on its compression and turned about its spindle;
- the rear suspension, swung up about the drive as the belt's springs take load;
- the paddles, run round the loop at the belt's speed by one morph;
- the ski rack, carrying the rider's pair in his topsheet's colours while he rides.

The rider stands on the boards (`skier-sled.ts`'s `boardPose`): a boot on each board, his figure stood over their middle, and his weight hung where the engine has it — his hips part of the way across and back, the knees solved again so the inside one bends and the outside one is let long, and his trunk leant into the turn for the rest — the trunk leant over the bars, more on the throttle and less leaning back, his hands on the grips turned with the bars. Every joint is a smooth function of the hang, so a turn ridden from side to side never jumps him up or down (`tests/skier_sled_test.ts`). His skis are drawn as his boots alone (the pair is on the rack) and his poles are stowed.

**The tracks.** The belt cuts a wide trench as deep as it sinks, or as its paddles chew, and each ski cuts its own groove beside it. Both are stamped into the trail map the skiers' furrows are (`sled-scene.ts`), so a climb up a powder face stays written on it.

**The roost.** A mountain sled's paddles throw the powder they cannot bite back off the belt's end, high and long behind it when the belt spins. The heavy clumps go into the spray and the fine snow into the snow cloud, where it hangs and drifts. The skis throw powder off their tips, a nose buried in deep snow pushes a bow wave, and a landing bursts.

**The camera.** The camera ladder is built round a skier: the TIPS lens a hand's height off the snow ahead of his boots, the HELMET lens at his eyes, the booms a few metres behind his back. Stood on the boards of a machine three metres long, those rows put the tips lens inside its hood. So while he rides it the ladder is framed off the machine itself — its centre as drawn, its attitude, its way and its own flight — on rows of its own (`camera-sled.ts`'s `SLED_RIGS`), and the lens is flown across from one ladder to the other as he steps on and off (a ride begun on the boards cuts straight to it):

- TIPS: the bumper — a lens bolted low ahead of the nose, the snow rushing at it and the lamp's pool on it;
- HELMET: THE COCKPIT — the rider's own eye as he stands on the boards in a crouch over the bars, tipped down so his gloved hands, the bars and every control on them and the display fill the lower part of the frame under the snow ahead (below);
- CHASE: behind and over his head, the whole machine and its roost in the frame;
- FAR and HIGH: the same further out, and high over it.

The booms keep everything the skier's have (the springs, the lean with the face, the stretch with speed, the trunks pushed off); only their sizes are the machine's. `tests/camera_sled_test.ts` holds every lens clear of the machine.

**The cockpit.** The model's bars are built for a lens metres away; a metre off them they read as a grey bar. So on the HELMET rung the bars are drawn close in code instead (`sled-cockpit.ts`, built the first time the rung is taken, and the model's bars and its small hood gauge put away meanwhile), laid out as the class's operator's guides lay them out:

- the RIGHT bar: the thumb throttle — a paddle ahead of the grip's inboard end, sprung out to idle and pushed back toward the grip as the throttle opens, the right thumb on it — on its housing, the red emergency stop button on top;
- the LEFT bar: the brake lever ahead of the grip, pulled toward it by the brake, the index and middle fingers on it, off a master cylinder with its fluid's sight glass and the parking lock's tab; inboard of it the switch cluster — the hand and thumb warmers up and down, the display's MODE, the electric reverse, the headlamp's beam;
- the MIDDLE: a tapered aluminium bar on a tall riser and its clamp, the mountain strap's loop and a padded crossbar, the post down into the hood, the brake hose and the throttle cable run down to it, the hand guards round both grips — all of it turned about the post with the skis, the model's own linkage, the rider's elbows and shoulders following the bars part of the way;
- the DISPLAY on its bracket ahead of the clamp, turning with the bars as a mountain gauge does, read off the machine a dozen times a second (`gaugeOf`): the speed, the engine as a bar with its red line and in figures, the coolant warming to its running heat, the fuel the engine burns, the altitude over the sea, the clock, and the tell-tales (forward, the high beam after dark, low fuel, the engine hot, the warmers); the coolant and the tank are the display's own memory, which the engine keeps neither of;
- a low smoked deflector on the hood ahead, and the safety tether clipped in beside the bars, its coiled cord running back to the rider;
- his own gloved hands closed round the grips and his forearms back to his elbows, in his gloves' and his jacket's colours.

`make sled ARGS=--sheet=cockpit` is its lab: the view at idle, flat out, in both turns and braking, in powder and at night, and close looks at both hands, the levers and the display.

## The sound

Eight layers (`docs/audio.md`), the sibling sled game's engine voice for its 850 two-stroke:

- the block's hum and the firing note at two firings a revolution (a 50 Hz chug at idle, near 280 Hz on the limiter);
- the expansion chamber's rasp coming in as it comes on the pipe;
- the bass and the intake;
- the CVT belt's whine at the track's own speed — so under full throttle the note barely moves while the whine climbs;
- the churn of the paddles in powder.

It is heard from the skier: under him on the boards, and going away down the snow when he skis off. Its one-shots are stepping on and the engine starting, stepping off, heaving it back up, and the crash.

## Measuring it

- `make sled-land` and `npx vitest run tests/sled_landing_test.ts`: rollers, whoops, hard turns, a sidehill, kickers, drops, a cliff, a bank and a wall, each ridden out or thrown as a rider expects.
- `make sled-tip` and `npx vitest run tests/sled_tips_test.ts`: every turn on the flat at 10–120 km/h in five snows, and traverses across 20°, 30° and 35° faces — thrown or not against what a rider of the class expects.
- `make sled-turn` and `npx vitest run tests/sled_turn_test.ts`: full lock on the flat, groomer and powder, at a crawl and at 25, 40 and 60 km/h, both ways round — the circle it settles on held to a band. A mountain sled at a crawl on the hardpack turns on some 7.5–11 m (measured on two of the class's machines, the long belt fighting the skis); the game's is a little tighter, so it is easy to place: about 5.5 m at 21 km/h, 11 m at 33 and 32 m at 56 on the groomer (a turn at full lock slows it), 8, 20 and 46 m at 25, 40 and 60 in powder.
- `npx vitest run tests/sled_test.ts tests/sled_audio_test.ts`: the drive, the top speed, the sink and the float, the climb and the high-mark, the carve's roll, the parking, getting on and off on the machine press, the crash and the remount, determinism, and the voice.
- `make sled`: the lab — parked, boarded, on the groomer, in powder (sunk, the launch, the roost, the carve), climbing, the tracks, the hop, the crash, at night, the model alone, and every camera rung riding it (`ARGS=--sheet=lenses`), on contact sheets.
- `make screenshots ARGS="--surface sled-park,sled-go,sled"` (after `make build`): the built app stood on its boards at the bottom, riding away, and riding up the mountain on the pre-roll's hands (`sledPilot`).
- `make audition ARGS=--meter`: the snowmobile's presets (idling, pinned in powder, cruising, high-marking, off a crest, idling 60 m off) and its one-shots, levelled against the rest of the game.
