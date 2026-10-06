# The helicopter

A free ride's way up the mountain with no lift at all. A helicopter stands on its pad on the valley floor, its nose to the summit (`heli-pad.ts`'s `summitward`); its pilot sets it down that way again when he flies it home. A skier who stops beside its right skid and presses **Enter** (a double tap on touch) is sat on the skid, and then the player flies it by hand — every control theirs, nothing holding it — anywhere on the mountain and as high as they like. They land it and step off, or, where it cannot land, push off the skid — Enter again either way. The skis are theirs again, and the pilot flies the machine home to its pad. Flown into the snow, into a crown or onto a slope too steep to land on, it crashes: the airframe is torn apart in a fireball, the skier on it is flung clear by the blast, and once the wreck has burned for a few seconds the ride starts again from the pad.

It is reached two ways:

- **The start card's RUN row**, whose last stop is HELICOPTER (`free-ride.ts`'s `HELI_RUN`). The ride begins sat on the skid on the pad with the rotor turning. `?start=free&heli=1` is the same ride from a link.
- **Getting on at the pad.** On every free ride it waits on its pad. Within 90 m of it, the machine and the painted pad light up and the HUD calls the skier to it (`snapshot.ts`'s `heliOf`). Within `HELI.board.reach` (6 m) of the right skid, slower than `HELI.board.fastest` (12 m/s, a cruise — no need to stop) (`heliWithin`), the call becomes a press reading **ENTER OR CLICK TO FLY** (**TAP TO FLY** on touch), and the MACHINE press (`SkierInput.machine`: Enter, the skier's `machine` key in `settings-input.ts`, the call tapped or clicked — `hud-machine-press.tsx` — the machine itself tapped or clicked on screen — `machine-pick.ts` — or a double tap on touch) sits him on the skid. Skiing past it never does.

There is no ceiling, by design. That is the point of the game it makes: climb, push off, and see what the damage meter and the anatomy plate say when the snow comes.

## Where it lives

| Piece | File |
| --- | --- |
| Every number, and the geometry the model is built to | `engine/game/defs/heli.ts` (`HELI`) |
| The flight, the boarding, the drop, the pilot flying home, the crash, the restart | `engine/game/heli.ts` (`stepHeli`, `thrustMost`, `pilotInput`, `startAgain`) |
| What the crash does to the body: the stop up the seat, the fireball's heat and the burns | `engine/game/defs/heli-wreck.ts` (`WRECK`, `fireballAt`, `fireFlux`), `engine/game/body.ts` (`wreckSeat`, `wreckFire`) |
| Where the pad stands | `engine/game/heli-pad.ts` (`helipadOf`) |
| The rotor's wash, as air | `engine/game/heli-wash.ts` (`washAt`, `inducedOf`), read by `air.ts` and the renderer |
| The state and its events | `HeliState`, the `heli` event, `RunRules.heli`, `GameState.heli` in `engine/game/state.ts` |
| The machine as drawn (the model, the rotors as an eye sees them spool up — `rotor-look.ts` —, the lights, the pad and the wind sock, the wreck, the wash's snow) | `pwa/src/game/heli-view.ts` |
| The airframe torn into its pieces and flung | `pwa/src/game/heli-shatter.ts` |
| The fireball (its size, life, lobes, lift-off) | `pwa/src/game/fireball.ts` |
| The explosion: the flash, the sparks and embers, the shards, the scorch, the pool fire and its smoke | `pwa/src/game/explosion.ts`, `sparks.ts`, drawn in one sorted batch by `billboards.ts` |
| The lens while riding it, and flown onto it and off it | `pwa/src/game/camera-heli.ts`, `heli-scene.ts` |
| The lens on a crash | `pwa/src/game/camera-crash.ts` |
| The rider's legs and skis swinging off the skid | `pwa/src/game/skier-dangle.ts` (fed by `heli-scene.ts`'s `perch`) |
| The screenshot lab | `make heli` — `scripts/heli-preview.mjs` over `pwa/src/tools/heli-harness.ts`, `heli-scenes.ts`, `heli-spots.ts` |
| Everything the renderer holds it by | `pwa/src/game/heli-scene.ts` |
| The HUD's readout | `pwa/src/game/hud-heli.tsx`, `pwa/src/heli.css` |
| The sound | `pwa/src/game/audio/heli-*.ts` (see `docs/audio.md`) |
| The Blender model | `scripts/blender/heli.py`, `scripts/blender/kinds/heli.mjs`, published to `pwa/models/heli.glb` by `make models` |

## The machine

The class is the light single-engine utility helicopter heli-ski operators fly:

- a three-bladed main rotor about 10.7 m across, turning clockwise seen from above at about 390 rpm, with a tip speed near 220 m/s;
- a two-bladed tail rotor 1.86 m across at about 2,050 rpm, on the right of a slim boom (the side a clockwise rotor puts it);
- skid gear on two arched cross tubes, with a ski basket on the left skid;
- about 1,175 kg empty and 2,250 kg at its maximum weight.

It is flown at a working weight of 1,780 kg: the empty machine, a pilot, a guide, three quarters of its fuel and the basket. The skier on the right skid is added on top while he rides it. He rides the skid the machine hovers low on anyway.

The frame is the skier's: x right, y up, z forward. The origin is the SKID DATUM, the ground under the middle of the skids, so a machine resting on level snow stands at `groundAt`.

## The flight

The model is a rigid airframe hung under a rotor whose thrust points along its disc.

**The thrust the rotor can give** comes from momentum theory (`thrustMost`). The power that reaches the induced flow, `HELI.power` (420 kW, the engine's shaft power at a generous figure of merit, so the lever climbs it briskly), buys thrust T at P = T·(v_c + v_i). The induced velocity comes from Glauert's forward-flight relation, v_i = v_h² / √(V² + (v_c + v_i)²), with v_h = √(T / 2ρA). So:

- the rotor gives about 1.8 times the machine's weight at the hover;
- it gives more in forward flight (translational lift sets in at 8–12 m/s);
- it gives less climbing, and only its own weight at about 20 m/s of climb.

The parasite power ½ρfV³ (f = 1.4 m²) comes off the top at speed. Near the snow, GROUND EFFECT multiplies it by 1 / (1 − (R / 4z)²) (Cheeseman and Bennett), where z is the hub's height over the snow. That is 1.22 on the skids and gone by a rotor diameter up.

The air's density is held at 1.0 kg/m³ whatever the height. A real machine of this class runs out of power at about 4,500 m with this load. This one never does, on purpose.

**The air** drags on the airframe's front, side and plan areas (`HELI.drag`). The drag is against the weather's wind where the machine flies (`windAt`, brought to its height by the log law, `profileAt`). The fin turns the nose into a crosswind (`HELI.vane`), so a gust moves the helicopter and the pilot's feet hold the heading.

**The skier on the right skid** is weight off the centre line. His rolling moment leaves a hang of a few degrees to his side, which the stabilisation trims against. He is also mass the collective is lifting. When he jumps, the collective (which answers in `pilot.lag`, 0.3 s) is still lifting him, so the machine lurches up and rolls back off his side before the pilot takes it out.

**It is flown by hand, and nothing flies it for you** (`HELI.flight`). There is no stability augmentation, no height hold, no heading hold and no turn coordination: it is a mode of its own inside the ski game, and it is meant to be hard.

- **The collective** is a lever. It sets the thrust's share of what the rotor can give, answered in `flight.lag` (0.3 s), and it stays where it is left. The height held is your hand's. About 0.55 hovers; ground effect helps near the snow.
- **The cyclic tilts the rotor disc**, and the thrust goes where the disc points. It sets a rate against the rotor's damping. Let go, and the disc stays where it was left: it never levels itself. Nothing stops it either: held over, it carries on past the vertical and round, so a machine high enough can be ROLLED and LOOPED (a full turn takes about eight seconds and a couple of hundred metres of height). The fuselage swings the short way round after it, and the HUD's horizon turns over with it. The air through the disc blows it back (the flapback, `flight.flapback`), so the nose comes up as the speed builds and forward flight needs forward cyclic held.
- **The fuselage hangs under the hub** as a damped pendulum (`flight.hang`), swinging under the disc as it is thrown about. The skier's weight on the skid hangs it a degree or two to his side: his share of the mass over the hub's height above the centre of gravity. When he jumps it swings back, and the collective, still lifting his weight, lurches it up.
- **The pedals** turn it against the tail rotor's and the fin's damping. The main rotor's torque swings the nose left as the collective comes up (`flight.torque`), so every change of collective wants the pedals with it. The fin turns the nose into a crosswind.
- **The air** drags on the front, side and plan areas against the weather's wind where it flies. Nothing takes the side slip out.

**The bot's hands** (`heli-pilot.ts`) are the proof that it can be flown. They are a cascade on the same four controls the player has, flying the bare physics: position to velocity to acceleration to disc tilt to cyclic, height to climb to collective, and the way it is going to heading to pedals. They fly a link's pre-roll, a card's run behind it, the labs' scenes, and the machine home after the drop.

## The controls

Flying has a key table of its own (`settings-heli-keys.ts`, `Settings.heliKeys`, rebindable under OPTIONS ▸ KEYS ▸ HELICOPTER). The input manager reads it for the four controls while the skier sits on the skid (`input.ts`, `input-model.ts`'s `sampleHeli`, `SkierInput.heli`). The way off is the skier's own MACHINE key, the press that sat him on it, so the helicopter's table has no row for it.

| | Keys | Touch |
| --- | --- | --- |
| Collective up / down | ↑ / ↓, Shift / Z | the right pad pushed up / pulled down (moves the lever while held, and it stays where it is left) |
| Cyclic fore and aft | W / S | the left pad up / down |
| Cyclic left and right | A / D | the left pad left / right |
| Pedals | Q / E, ← / → | the right pad left / right |
| Jump off, or step off where it has landed | Enter (the machine key) | a double tap on either thumb |
| Back to the pad | R | the reset press |

On touch, both thumbs become pads while flying (`StickZone`): the edge thumb's glass (the left, as it ships) a sprung CYCLIC stick — up tilts the helicopter forward, down back, across banks it — and the lever's glass (the right) the POWER PAD — up and down work the collective at a rate and leave it where it is let go, across is the pedals, sprung back to centre. The power pad's axes each have a dead band (`POWER_PAD_DEAD`), so working the pedals never creeps the collective. A left-handed skier who has moved the lever to the left gets the pads swapped with it. Each pad is drawn under the thumb as a d-pad's cross (`hud-heli-pad.tsx`), every arm's arrow lit by how hard the thumb leans that way: the cyclic's knob is the helicopter seen from behind, banking with the stick; the power pad's is its rotor seen from above, turning with the pedals, with turn arrows on its side arms and the collective's gauge down its upright. The HUD reads like a cockpit (`hud-heli.tsx`): the DROP under the skids, the climb and the ALTITUDE over the pad it took off from, an artificial horizon, and the collective's gauge. Both of the collective's gauges are written every frame off the run (`hud-live.ts`), not off the HUD's ~12 Hz snapshot, so they fill smoothly while the thumb holds the pad. The minimap opens with the height on the skid (`minimap-view.ts`'s `airSpanFor`): past 20 m over the snow every metre climbed adds 6 m to its window, up to the whole map, so the ski area comes into view as he climbs and the plate closes back in as he comes down.

## The pad, the drop and the pilot

**The pad** (`helipadOf`) is a level patch of the hub's open snow (R29), as near the village as one lies. The rotor's sweep plus a margin must be clear of every trunk, every lift line and bottom station, and both wind tunnels. A map with no hub puts it beside the finish.

**Landing is the ordinary way off.** Set it down on snow flat enough (`crash.slope`, about 9°), slowly enough (`crash.sink`, 3.2 m/s; the gear is certified for 2.5) and level enough, and press Enter to step off onto the snow. The pilot shuts down where it stands. Where the snow is too steep to land on, **the drop** is the way off: it sends the skier off the seat with the machine's velocity plus `HELI.drop` (out over the skid and a little up). He faces the way it was flying, or out over the skid at the hover. From there he is an ordinary skier in the air: the flight, the landing load (`flight.ts`), the wipeout, the ragdoll and the injuries (`crash.ts`, `body.ts`) are the game's own. Deep powder gives more than a groomer, and a skier who leaves the skid high enough reaches the snow at the speed of a long fall.

**The pilot** holds the machine level for a beat (`home.beat`). He then climbs to `home.clear` over the snow ahead, flies home at `home.cruise`, slows in time to stop over the pad, comes down onto it and shuts down. A parked machine can be boarded again.

## The crash

A crash ends the flight. It happens when, while the player flies:

- the rotor disc's rim meets the snow, or meets a crown it sweeps (a tree's cone at the disc's height);
- the chin, the boom or the fin meets the snow;
- the skids touch down faster than `crash.sink` (3.2 m/s; the gear is certified for 2.5 with a reserve to 3.1) or `crash.slide` along the snow;
- the airframe stands more than `crash.tilt` off the snow's lean;
- the snow is steeper than `crash.slope`. A flight manual's slope limits are 6–10°, and a machine pivoting on one skid is past saving at 5–8°. Both are held a little wider here.

The wreck burns for `crash.wreck` seconds (7). A skier aboard is flung off the skid by the blast (`crash.blast`: 15 m/s out from the machine's side and 10 m/s up, on top of its way along the snow — the snow stops its fall and his), tumbling tens of metres (the `heli` crash cause, with its own tumble in `defs/crash.ts`). Accident reports put an occupant thrown in a crash at 5–20 m/s. He lies where he fell — the reset does not stand him up while the wreck burns — and then the ride starts again on the pad. The pilot flying home is tested against the mountain too. If he ever flies it in, a fresh machine waits on the pad when the fire is out.

### What the crash does to the skier

A crash HURTS him, through the same body every fall is judged on (`body.ts`, `defs/anatomy.ts`), with the wreck's own numbers in `engine/game/defs/heli-wreck.ts` (`WRECK`), which also says what the research found.

- **The impact, up the seat.** Studies of helicopter crashes agree that a helicopter comes down mostly vertically, and that the vertical load is the one the body bears worst. A belted occupant survives the forward and sideways loads of a survivable crash, but the headward one goes up the seat into the spine. Military crashworthiness rules are built round it: a survivable crash is a vertical change of speed of about 12.8 m/s, and a crashworthy seat strokes at about 12–14.5 g so the lumbar spine never takes more. The hallmark injury without that stroke is a compression or burst fracture of the thoracolumbar spine, often with the pelvis and the lower legs. The skier on the skid has no stroking seat. The step it crashes, the machine's speed DOWN (`HeliState.wreck.sink`, its fall from a crown or the rotor's strike counted in) is taken into the airframe's own frame, and only its part along the airframe's UP (`wreck.seat`) is stopped over the skid gear's crush (`WRECK.stroke`, 0.3 m) and the snow's give. That stop is the load up his spine (`load`, the same dose a landing hands it), the pelvis's blow on the tube, the neck's whip and — his skis on the snow under the skid — his feet and shins driven up (`WRECK.legs`). A touchdown just past `crash.sink` is a jolt. One at the survivability limit is a broken back, and often the cord. The g meter bills it as the helicopter's.
- **The angle it comes down at.** A helicopter that comes down rolled or nose-low hands the stop across the body instead, and a side impact's injuries follow it: the ribs and the shoulder on the struck side, the organ under them (the liver on the right, the spleen on the left), the pelvis squeezed and the head against the structure, with little up the spine. Rolled onto its side, the spine takes nothing. Rolled toward the skier's own side (`wreck.out` positive), he is pitched out face first onto the snow and the airframe's side comes down on his back (`WRECK.pinned`, over its crush `WRECK.side` and the snow's give). Rolled away from him, he is thrown back against the cabin's side (`WRECK.thrown`). Nose or tail first (`wreck.across`), he is thrown along the skid into its cross tube flank first, the flank that leads struck as by a trunk beside him.
- **Thrown.** The rest is blunt trauma, and that is the ragdoll's. In autopsy series of air crash victims the ribs are broken in some four in five, the skull in three in four, the pelvis in three in five and the spine in half. The organs torn are the lungs, the heart, the liver, the aorta and the spleen, the liver and the spleen most often beside broken ribs over them. The skier flung off the skid meets the snow point by point (`ragdollBlows`), and his chest, abdomen, kidneys, spleen and liver are hurt by which side he lands on.
- **The fire.** A fuel fireball is a deflagration, not a detonation. Its overpressure is a few kPa, where an eardrum needs some 35 and a lung 70 or more, so the blast wave itself does little: it is the HEAT that harms. Thermal harm goes as the thermal dose, (kW/m²)^4/3 · s on bare skin: about 105 for a first-degree burn, 290 for a second-degree one and about 1,000 for a full-thickness one. The engine keeps the drawn fireball's size, lift-off and rise (`fireballAt`; `fireball.ts` draws the same ball) and its skin radiates `WRECK.fire.emissive` (200 kW/m², a sooty kerosene ball's), less as it burns down to soot. A body inside it takes that whole flux, and one outside it a sphere's view of it, (r / d)². The dose is summed in `BodyState.heat` while the ball burns, wherever he lies, and judged ONCE as it goes out. The burns land where the clothes let the heat through (`burntFace` to `legBurns`): the face bare between the helmet and the goggles, the neck half under the collar, the hands a third through gloves, the arms and legs a quarter through the shell. A body engulfed long enough burns its AIRWAY breathing the ball in. Flung clear at once he is burnt on the face and hands. Left lying in it, he is burnt deep. A reset or the ride begun again mends him.

## The wash

The rotor drives its flow down through the disc at the induced velocity v_i = √(T / 2ρA), about 10 m/s for this machine at the hover, and on to twice that in the far wake. Over the snow the column turns into a thin radial OUTWASH WALL JET:

- its peak is 1.9 v_i at `wash.core` (1.7) rotor radii out;
- beyond the peak it falls off as 1/r and mixes away a dozen radii out;
- it leaves the snow once the hub is more than `wash.reach` (2.5) rotor diameters up.

Dry snow starts to blow at 4–11 m/s of wind, so a hover over powder blows snow out to 25–45 m. Below about one rotor diameter, the machine sits in its own whiteout.

`washAt` is air like any other. The skier's drag is against it (`air.ts`), so a skier standing by a machine lifting off is pushed off the pad. The renderer reads the same field to throw the snow cloud's puffs (`heli-view.ts`).

## The look and the sound

The model is made in Blender off `HELI` (`make models`). The renderer hangs it on the skid datum and spins `heli_rotor` and `heli_tail_rotor`. Both rotors are drawn the way an eye or a camera sees a rotor spool up (`rotor-look.ts`, held by `tests/rotor_look_test.ts`). Each picture is gathered over an exposure (1/30 s), and a blade sweeps its speed times that while it is: at a crawl the model's blades are sharp; as they come up they are handed over to a drawn SMEAR, each blade's darkness spread over the arc it swept, so they widen into pale wedges and thin away into a haze — darkest at the root, with the painted tips a ring at the rim. Pictures also come at a rate (20.25 a second, just under the main rotor's blade-pass rate of 19.5 at full rpm), and a three-bladed rotor looks the same every third of a turn, so the pattern is drawn at the true turn folded into a sixth of a turn either way a picture — the wagon-wheel effect. Spooling up, the rotor turns forward and quickens, dissolves into an even haze where forward and back are equally near, and comes back as a ghost turning BACKWARDS, fast at first and slowing to a slow creep at full rpm, as a rotor does on film. The pattern is stepped on the frame's own time, so it stands still behind the pause card.

While the skier rides it, the helicopter takes the lens (`camera-heli.ts`):

- CHASE: behind and over the machine;
- FAR: the same, further out;
- HIGH: high over it, looking down at the drop;
- TIPS: THE NOSE — a lens bolted under the chin, ahead of the airframe, looking out along the nose; it pitches, rolls and shakes with the machine;
- HELMET: the nose LOOKING DOWN — the same place on a level mount, turned only with the heading and tipped down at the snow ahead, the lens a landing or a drop is aimed with.

Every change of lens is FLOWN, never cut, over the same 0.6 s the skier's ladder takes — and round the machine rather than through it (`orbitBlend`: the eye swung about the airframe's middle, kept clear of the rotor's tips half-way), since a straight line from the chase to the nose runs through the cabin. The lens is flown onto the helicopter the same way as he sits on the skid, from the skier's own ladder; after the drop it is held on him for a beat, turning down after him, and flown back to his ladder. Only a new run and the ride begun again after a crash cut to it.

THE RIDER on the skid is not a statue (`skier-dangle.ts`): each leg — shin, boot and ski, hung at the knee — is a damped pendulum, swung by gravity less the machine's acceleration (so the legs keep hanging toward the snow as the machine tilts and trail as it brakes), blown downwind by the air past his boots (the weather's wind and the rotor's wash, less his own way), shaken at the rotor's blade-passage rate, and kicked now and then by his own idle swing; the two legs are a little unlike, so they drift out of step. On the snow the dangle fades out as his skis come down to rest.

THE CRASH is drawn off the research on fuel fireballs and helicopter accident sites:

- **The airframe comes apart** (`heli-shatter.ts`). The machine's own meshes are cut once into the pieces an airframe breaks into: the cabin's shell in panels, the nose, the skids and their cross tubes, the tail boom whole with its fin (a boom most often survives in one piece), the tail rotor, and each main blade broken at its root and again along its span. The moment it goes down every piece is flung from where it was drawn: off the blast at the fuel cells, with the machine's own way, the blade sections slung on along their turn (a tip turns at some 210 m/s; the sections land 20–100 m off). The pieces tumble, strike the snow with sparks and a puff, and slide to rest. About half of them burn as they fly, trailing fire and smoke, and burn on in the snow. They char as the wreck burns.
- **The fireball** (`fireball.ts`) is a fireball rather than a blast, because a light helicopter's fuel deflagrates. Filmed fuel impacts burn only a tenth to a quarter of the fuel in the ball. A hydrocarbon fireball is about 5.8 M^⅓ m across and lives about 0.45 M^⅓ s (M the fuel it burns, kg), which is some 28 m for two seconds here. It reaches its size in the first third of its life, a dome hugging the snow, and is a cauliflower of bulging cells drawn out along the way the wreck was sliding. It is white-yellow at its heart for a beat, then a deep orange, with soot pockets darkening inside it and black smoke rolling off its skin. Then it lifts off, rising at 15–20 m/s, and rolls up into a black mushroom. Smaller balls light along the fuel's spray.
- **Around it** (`explosion.ts`): a flash lighting the snow; a shower of white-hot sparks and lofted embers (`sparks.ts`); small shards of the skin; a ring of snow thrown up and out; the snow under it scorched dark; and the wreck left burning as a **pool fire** of the spilled fuel. Some 30–45 MW of kerosene in a pool a few metres across burns 10–12 m tall by the flame-height correlation, PUFFING at about 0.65 Hz, under a column of black smoke that stands 80 m and more after ten seconds.
- **The lens** (`camera-crash.ts`) starts exactly where the lens stood when it struck, whichever rung it was on. It pulls back from there, up over the snow and a little round the wreck, its look coming off what it was aimed at onto the fireball and the skier the blast threw, until the whole of it is in the frame. The look rises after the smoke. A lens that was at the impact itself (the nose lens) is thrown back out of the fireball at once. The shock reaches the lens at the speed of sound and shakes it. A lens with a trunk in the way rises until it sees over it. Then, as the skier's flight nears its apex (`CRASH_LOOK.zoomLead` s before it), it CLOSES IN ON HIM and rides his path: a low tracking shot 3 m behind him along his way and 2 m off to its side, carried along at his own speed and looking down the way he is going, so the snow and the trees stream past. It is left a little behind as he gathers speed falling, and the fov opens (46° to 70°) and the frame tilts the faster he goes. It follows him through the fall and the tumble along the snow until he stops, and never goes inside the fireball (`fireballAt`).

The fire and the smoke are one depth-sorted batch of billboards, one draw call for hundreds of puffs. They are tinted a little over white so the tone map keeps them glowing without washing them out, since fire only added on is lost against snow.

The sound is `docs/audio.md`'s. In brief:

- the rotor's whop at its blade-passage frequency (3 × 390 / 60 = 19.5 Hz), sharpening into blade slap in descents and turns;
- the turbine's whine following the spool;
- the tail rotor's buzz at about 68 Hz;
- the wash's roar of blowing snow near the ground;
- the explosion's whump, crack and fire.

## Measuring it

- `npx vitest run tests/heli_test.ts`: the thrust against momentum theory, the climb with no ceiling, the hang toward the skier, the turn, the drop and the lurch, the pilot home, the boarding, the crash and the restart, the wash, and determinism.
- `make screenshots ARGS="--surface heli-pad,heli-wash,heli"` (after `make build`): the machine on its pad, lifting off into its wash, and flown up the mountain by the pre-roll's pilot (`pilotInput`).
- `npx vitest run tests/heli_wreck_test.ts`: the crash's stop up the seat into the spine only along the airframe's up, a crash rolled onto either side or nose or tail first hurting him across the body instead (the airframe on him rolled his way, his leading flank along the skid), the fireball's heat (inside it and a sphere's view of it outside), the burns judged once as it goes out, and the body mended on the pad.
- `npx vitest run tests/heli_camera_test.ts`: the nose lens, a change of rung flown round the machine and never through it, the crash's lens taking over from the lens on screen and pulling back from it, then closing in on the thrown skier before his apex and riding his path down as a tracking shot, and the fireball's size and life off its fuel.
- `make heli`: the helicopter lab — every event staged deterministically on the game's own renderer and laid out on contact sheets (`ARGS=--sheet=crash`: the crash frame by frame from the chase, from the nose and at speed, and the thrown rider from the side; `ARGS=--sheet=handover`: a change of rung in flight).
