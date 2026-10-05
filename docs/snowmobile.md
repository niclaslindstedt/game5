# The snowmobile

A free ride's way up the mountain on the snow itself. A deep-snow mountain sled is parked at the bottom of the mountain, beside the village. A skier who stops beside it and presses **Enter** (a double tap on either thumb on touch) is taken on: his skis and poles go into the rack on its tunnel and he stands on its running boards in his boots. Then the player rides it — the thumb throttle, the brake, the bars and his weight — anywhere on the mountain, up the faces no lift reaches. **Enter** again steps him off: his skis are on his feet again and the machine stays where he left it, idling a while and then shut off, to be taken again. Rolled over, looped off a drop, landed too hard or run into a trunk, it throws its rider; stood back up, he is back on it, the machine back on its belt.

It is reached two ways:

- **The start card's RUN row**, whose second-last stop is SNOWMOBILE (`free-ride.ts`'s `SLED_RUN`). The ride begins stood on its boards at the bottom, the engine running. `?start=free&sled=1` is the same ride from a link.
- **Getting on where it stands.** On every free ride it waits at the bottom (`sled-pad.ts`'s `sledSpotOf`). Within 60 m of it the HUD calls the skier to it and a halo over it pulses; within 45 m it lights up (`snapshot.ts`'s `sledOf`, `sled-view.ts`). Stood within `SLED.board.reach` of it, slower than `SLED.board.fastest` (`sledWithin`), the call says **ENTER TO RIDE**, and the MACHINE press (`SkierInput.machine`: Enter, the skier's `machine` key in `settings-input.ts`, or a double tap on touch) takes him on. Skiing into it never does. A machine left anywhere on the mountain is taken the same way, and one lying on its side is stood back on its belt as he takes it.

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
- **The arcade's hand** (models nothing, says so): on the snow the yaw rate is held toward the one the skis ask for, no faster than the grip can turn the way, and the nose toward the way it is going.

What it does, held by `tests/sled_test.ts`:

- about 140 km/h flat out on the groomer;
- sits 20–30 cm down into powder at rest and climbs out onto it as it gathers speed;
- climbs a 24° powder face from a standing start;
- charged at a 35° face at 50 km/h, it bogs and stalls — a high-mark;
- rolls onto its inside edge through a powder turn.

Pinned from a crawl in powder, the belt spins far faster than the machine goes. That slip is what throws the roost and what the churn and the belt's whine say.

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
- stands past `crash.over` (about 72°) of roll or pitch off the snow for `crash.overFor` (0.6 s): rolled or looped;
- lands closing harder than `crash.landing` (9 m/s).

The machine goes on without him and lies where it comes to rest. When he is stood up (the reset), he is back on it, standing it on its belt again.

## The look

The model is made in Blender off `SLED` and the class's traced profile (`make models KIND=sled`). It is cut into rigid nodes the game poses every frame off the engine (`SLED_NODES`):

- the bars, turned about the post with the skis;
- each ski, lifted on its compression and turned about its spindle;
- the rear suspension, swung up about the drive as the belt's springs take load;
- the paddles, run round the loop at the belt's speed by one morph;
- the ski rack, carrying the rider's pair in his topsheet's colours while he rides.

The rider stands on the boards (`skier-sled.ts`'s `boardPose`): a boot on each board wherever his weight has moved him, the trunk leant over the bars, more on the throttle and less leaning back, his hands on the grips turned with the bars. His skis are drawn as his boots alone (the pair is on the rack) and his poles are stowed.

**The tracks.** The belt cuts a wide trench as deep as it sinks, or as its paddles chew, and each ski cuts its own groove beside it. Both are stamped into the trail map the skiers' furrows are (`sled-scene.ts`), so a climb up a powder face stays written on it.

**The roost.** A mountain sled's paddles throw the powder they cannot bite back off the belt's end, high and long behind it when the belt spins. The heavy clumps go into the spray and the fine snow into the snow cloud, where it hangs and drifts. The skis throw powder off their tips, a nose buried in deep snow pushes a bow wave, and a landing bursts.

## The sound

Eight layers (`docs/audio.md`), the sibling sled game's engine voice for its 850 two-stroke:

- the block's hum and the firing note at two firings a revolution (a 50 Hz chug at idle, near 280 Hz on the limiter);
- the expansion chamber's rasp coming in as it comes on the pipe;
- the bass and the intake;
- the CVT belt's whine at the track's own speed — so under full throttle the note barely moves while the whine climbs;
- the churn of the paddles in powder.

It is heard from the skier: under him on the boards, and going away down the snow when he skis off. Its one-shots are stepping on and the engine starting, stepping off, heaving it back up, and the crash.

## Measuring it

- `npx vitest run tests/sled_test.ts tests/sled_audio_test.ts`: the drive, the top speed, the sink and the float, the climb and the high-mark, the carve's roll, the parking, getting on and off on the machine press, the crash and the remount, determinism, and the voice.
- `make sled`: the lab — parked, boarded, on the groomer, in powder (sunk, the launch, the roost, the carve), climbing, the tracks, the hop, the crash, at night, and the model alone, on contact sheets.
- `make screenshots ARGS="--surface sled-park,sled-go,sled"` (after `make build`): the built app stood on its boards at the bottom, riding away, and riding up the mountain on the pre-roll's hands (`sledPilot`).
- `make audition ARGS=--meter`: the snowmobile's presets (idling, pinned in powder, cruising, high-marking, off a crest, idling 60 m off) and its one-shots, levelled against the rest of the game.
