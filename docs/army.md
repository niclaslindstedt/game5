# The army

The army that hunts a wanted skier ([`wanted.md`](wanted.md)) needs a machine to come in and people to fire its guns ([`gunfire.md`](gunfire.md)). **This page is how they look and how its helicopters fly.** It covers the military helicopter, the winter infantry on skis and on foot, the door gunner and the anti-armour man, and what each is drawn from and why. Then it covers the helicopters [in flight](#in-flight): called in, hunting him and firing.

The helicopters fly in the game, the soldiers are set down [on the ground](#on-the-ground), the roster's snowmobiles drive after him [on snowmobiles](#on-snowmobiles), and the ground waves climb the mountain at him [in waves](#ground-waves), and riflemen on paramotors and rocketeers in balloons come [by air](#paramotors-and-balloons).

| Piece | Where |
| --- | --- |
| The machine's numbers and the places on it | `engine/game/defs/army-heli.ts` (`ARMY_HELI`) |
| The machine as modelled | `scripts/blender/army.py` (`make models KIND=army`), committed as `pwa/models/army.glb` |
| The places, side by side (doors, guns, seats, ropes, lights) | `pwa/src/game/army-heli-plan.ts` |
| The machine as drawn | `pwa/src/game/army-heli-view.ts` (`createArmyHeliView`) |
| The soldiers' kit (colours, rifle, launcher, skis, camouflage) | `pwa/src/game/soldier-kit.ts` |
| The soldiers' poses | `pwa/src/game/soldier-pose.ts` |
| The soldiers as built and drawn | `pwa/src/game/soldier-shapes.ts` (`buildSoldierFigure`, `SoldierView`) |
| The machines in flight: the call, the flight, the hunt, the guns, the ram | `engine/game/army.ts`, its numbers `engine/game/defs/army.ts` (`ARMY`), its state `engine/game/army-state.ts` (`GameState.army`) |
| The machines in flight as drawn and heard | `pwa/src/game/army-air-view.ts` (held by `machines.ts`), `pwa/src/game/audio/army-bed.ts` |
| The army on snowmobiles: the call, the drive, the short halt, the crew off, the machine taken | `engine/game/army-sled.ts`, its numbers `engine/game/defs/army-sled.ts` (`ARMY_SLED`), `ArmyState.sleds` |
| The snowmobiles as drawn and heard | `pwa/src/game/army-sled-view.ts`, `sled-army-kit.ts`, `sled-livery.ts` (`army`), `soldier-pose.ts` (`sledDriverPose`, `sledGunnerPose`), `audio/army-bed.ts` |
| The ground waves up the mountain: the waves, the way up, the column, the climb | `engine/game/army-wave.ts`, its numbers `engine/game/defs/army-wave.ts` (`ARMY_WAVE`), `ArmyState.waves`, `ArmyState.routes` |
| The army's paramotors and balloons: the call, the flight, the rifles and the rockets, brought down, a burst among the army's own | `engine/game/army-air.ts`, `army-para.ts`, `army-balloon.ts`, `army-burst.ts`, its numbers `engine/game/defs/army-air.ts` (`ARMY_AIR`), `ArmyState.air` |
| The paramotors and balloons as drawn and heard | `pwa/src/game/army-craft-view.ts` (held by `machines.ts`), `para-scene.ts` and `para-canopy.ts` (`ARMY_CANOPY_PAINT`), `balloon-scene.ts` and `balloon-look.ts` (`ARMY_COLOURWAY`), `audio/army-air-bed.ts` |
| Soldiers by the hundred, as drawn | `pwa/src/game/soldier-batch.ts` (held by `army-ground-view.ts`) |
| The labs | `make army` (`scripts/army-preview.mjs`, `pwa/src/tools/army-harness.ts`, `pwa/army-preview.html`), `make army-flight` (`scripts/army-flight.mjs`) |
| The tests | `tests/army_heli_test.ts`, `tests/soldier_test.ts`, `tests/army_test.ts`, `tests/army_sled_test.ts`, `tests/army_wave_test.ts`, `tests/army_air_test.ts`, `tests/models_test.ts`, `tests/model_registry_test.ts` |

## The helicopter

**The class.** Armies move troops in a medium, twin-engine utility helicopter. Its outline is well known:

- a boxy cabin for a crew of two and up to about a dozen troops;
- a large sliding door on each side;
- two turboshafts side by side under one cowl;
- a four-bladed main rotor about 14 m across;
- a two-bladed tail rotor high on the fin, on its right;
- skids rather than wheels.

Published figures for the class are a rotor diameter of about 14 m and a fuselage of about 13 m, about 17 m with the rotors turning. It stands about 4.6 m tall and has a maximum weight of about 5,400 kg. It cruises at about 225 km/h.

`ARMY_HELI` keeps those proportions as numbers. It names no maker and no model. The builder is handed the table and uses no numbers of its own. The blocks it shares with the heli-ski machine's `HELI` (`rotor`, `tail`, `body`, `skid`) have the same names and shapes, so one builder's machinery lays either skin.

**The paint.** Military machines in snow-covered theatres are not repainted for winter. A temporary, washable white is daubed over their green in broad patches. Armies exercising in the far north have done this, and so have forces whitewashing their machines for a winter of snow. One navy's trials found that a mottled scheme hid a helicopter in snow better than a plain one.

The model does the same. An olive airframe carries soft-edged white patches laid as a field on the skin, so they cross the doors and the panels as a brush would. The finish is flat with no clear coat. The windows are dark, and the low-visibility marks are grey: a ring on the boom and the number panels.

**What it carries.**

- **The sliding doors.** One on each side, cut from the skin's own faces so the camouflage runs across them. Each slides aft its own width on rails at the sill and the roof's edge.
- **The door guns.** A 7.62 mm-class general-purpose machine gun on a pintle at each doorway's forward edge, with the ammunition box and its belt. Each gun turns about 69° either side of square and depresses to about 60°.
- **The gunner's seat.** It sits just inboard of the gun and faces out of the door. The pivot is set high enough that a seated man's cheek reaches the stock.
- **The troop places.** The doorway places (sat on the floor at the sill's edge, legs over it, ready to drop onto the skid) and a bench across the aft bulkhead.
- **The fast-rope bars.** One over each door, swung out from the roof's edge, with a brace and a hook.
- **The lights.** Red anti-collision beacons on the fin and under the belly, and navigation lights (red to port, green to starboard).
- **The rest of the kit.** The intakes and exhausts of the twin cowl, wire cutters, a chin sensor turret, the landing lights and the antennas.

**The model.** `scripts/blender/army.py` runs the heli builder's top half as a module, so it uses the same skin, regions and export machinery as the heli-ski machine. It then lays its own airframe over that machinery: the profiles, the cabin, the cowl, the fin, the doors, the guns and the rotor. The model has seven nodes, named in `ARMY_NODES`:

- the airframe;
- the main rotor, whose origin is the hub;
- the tail rotor;
- each sliding door, whose origin is the doorway's forward edge at the sill;
- each door gun, whose origin is its pivot.

The game cut has about 21,000 triangles. The LOD1 cut has about 9,000. `tests/models_test.ts` holds the budget at 24,000 and checks every node and the place it hangs.

**The drawing.** `army-heli-view.ts` loads the model under the heli's switch (`VITE_MODEL_HELI`). If the model cannot be loaded, the view uses a code-built stand-in with the same node names.

The view mirrors the model's z axis rather than turning it round. That makes the machine's group exactly `ARMY_HELI`'s body frame, so a figure stood at a plan's place lands on the model.

The rotor blur is the heli's own (`rotorDisc`, `createRotorEye`), with four blades. `pose()` sets four things:

- the doors' slide (0 shut, 1 open);
- each gun's yaw and pitch, inside its stops;
- the rotor's spool;
- the lights, which come on with the rotor.

## The places

`army-heli-plan.ts` hands out every place in the body frame: x right, y up, z forward, origin on the ground under the skids. `ARMY_HELI` states each place for the right side; the plan mirrors it for the left.

- **The doors and guns:** `doorwayOf`, `doorSlide`, `gunPivot`, `clampAim`.
- **The gun's own frame at an aim:** `gunAxes` gives the axes, `muzzleOf` where the rounds leave, and `gunHolds` where the gunner's right fist, left hand and cheek go.
- **The seats:** `gunnerSeat`, `doorSeats`, `benchSeats`, `troopSeats`. Each seat carries the way it faces.
- **The rope:** `ropeHook`, and `onRope`, which hangs a man plumb under the hook.
- **The lights:** `lightsOf`.

## The soldiers

**What a winter soldier looks like.** Armies that fight in snow put a white over-garment on top of the field uniform:

- a smock and trousers, either plain whites or a snow camouflage (white with sparse grey-green and grey blotches), cut loose so they go over everything;
- a helmet in a white cloth cover;
- goggles over a balaclava;
- a chest rig of magazine pouches;
- mittens;
- a large pack, its cover white too.

Ski troops move on long, wide, plain white touring skis with a cable binding and carry their rifle slung low on the chest, muzzle down: it is to hand at once, and a fall lands on the stock rather than the muzzle. The weapons stay dark: a 5.56 mm-class assault rifle under a metre long and, for the section's anti-armour man, a disposable launcher tube about a metre long and under a decimetre across.

**Drawn in code, like the crowd.** The soldiers are built on the crowd's bench and rig (`crowd-shapes.ts`' `Figure`, `crowd-rig.ts`'s `Posed`), so they are chunky, faceted and low-poly. From forty metres the silhouette and the colour are what read: a white figure with a helmet, a big pack and a black rifle. The figure is built for that:

- The cloth (smock, trousers, sleeves) is white. In the `camo` smock, the blotches are laid triangle by triangle, read where each triangle sits at the rest pose, so a blotch stays on its cloth through every pose.
- The webbing is off-white and the helmet cover white.
- The goggles are dark, and the boots and weapons are the only other dark things on him.
- The ski tops are white and their edges grey, so the skis still read on the snow.
- The pack is a large-volume patrol rucksack (some 80 to 100 litres: about 0.6 m tall, 0.35 m wide and 0.25 m deep loaded) under a white snow cover. Its frame holds it close to the back from the small of it to the shoulders. So it is lofted as a soft, rounded bag whose face lies on the smock and whose belly stands out, with a domed lid a shade greyer over its top and a compression strap round each side, low and high (`PACK`, `emitPack`). Sat on a chair, the figure is set forward by the pack's depth, so the bag sits against the backrest rather than through it.
- The rifle rides on a CHEST SLING whenever he is not using it: on skis, skinning, on a rope and lying down (`chestSling`). It hangs low across the front of him over the chest rig, the butt up on his right breast and the muzzle down past his left hip, steep enough to stay between his arms so the poles swing clear of it. It lies on its side, its top toward his left shoulder, so its magazine and grip lie flat against him rather than pointing into the rig. Bent over (a tuck, a pole plant), it swings toward the ground and out past the left knee rather than between his thighs. Under the loaded pack his tuck is a taller one than a racer's. Sat on a chair, the sling let out, it lies along his left thigh with the muzzle past the knee (`lapSling`). The rocket man keeps his rifle on his back while the launcher is on his shoulder. Every pose that aims or fires keeps the rifle in his hands.

There are four figures (`SoldierKind`), each at three cuts (`CrowdLod`: about 500, 440 and 160 triangles). Every pose of a figure is a morph target, so one draw call can hold a whole squad. A pose no morph target holds can be set outright on the same mesh with `poseSoldierFigure` or `SoldierView.posed`. The gunner at an arbitrary aim is drawn this way.

| Figure | Carries | Poses (the first its rest) |
| --- | --- | --- |
| `skier` | rifle on the chest sling (along the left thigh when seated), poles | `ski`, `tuck`, `lean`, `leanLeft`, `pole`, `skiAim` (stood on his skis aiming, the poles planted beside him) |
| `foot` | rifle in his hands | `ready` (the low ready), `walkA`, `walkB`, `aim` (stood, bladed, the butt in the shoulder), `kneel` (off the right knee), `doorSit` (in a doorway, the rifle across his lap), `rope` (hand under hand, the rifle slung) |
| `gunner` | nothing (the door gun is the machine's) | `sit`, `fire`, `fireDown`, `fireFore`, `fireAft` |
| `rocketeer` | rifle, launcher | `carry`, `walkA`, `walkB` (rifle at the ready, the launcher across his back), `launch`, `kneelLaunch` (the launcher on his right shoulder) |

**The poses.** The skiing poses are the crowd's: the player's own pose, solved to a soldier's body and his 2.1 m pair. The poses on foot are keys laid on the same body, as a civilian's are (`party-pose.ts`, `keyPosed`).

The weapons are placed after the body is posed, so they follow the hands:

- A rifle in the hands has its grip in the right fist and runs through the left.
- Aimed, its butt sits in the pocket inside the right shoulder and it points along the pose's aim.
- Slung, it lies diagonally over the pack.
- The launcher sits on the right shoulder with its rear behind him, clear of his head.

`soldierPose(kind, name)` hands back the joints and where each weapon is (`Carried`: rear, front, up), so a later part can put a muzzle flash at the rifle's front.

**The door gunner** is posed in his seat's frame (`seatFrame`), facing out of the door:

- His fists go where `gunHolds` puts them for the gun's aim.
- His trunk leans toward the stock and his head nods onto it.
- `gunnerPosed(side, yaw, pitch)` poses him for any aim on either side.

## The lab

`make army` stands everything on the flattest stretch of seed 38's piste and photographs it through the game's own renderer. It uses the game's light, haze and shadows; the lab stands the objects itself with `DevRenderer.stage`.

| Sheet | Views |
| --- | --- |
| `heli` | `turntable` (eight bearings round it landed), `close` (the door gun and its gunner, the doorway, the nose, the tail rotor, the skids, the rope bar), `doors` (both doors open, the gunners on their guns, a section in the doorways), `squad` (landed, its section out on the snow round it) |
| `flight` | `flight-day`, `flight-dusk`: in the air over the slope, the rotors turning, the gunner on his gun, a man on the fast rope |
| `hunt` | the army in the game, a hunted free ride run on the real engine with the bot: `hunt-2` (two stars, warning fire), `hunt-4` (four stars, two machines, aimed fire), `hunt-heli` (him in the stolen air ambulance, chased); each from behind him at the machine after him, beside its door, and wide |
| `ground` | the soldiers in the game, a hunted free ride run on the real engine, him stood still: `ground-land` (a machine set down, its squad spilling out and kneeling), `ground-file` (the squad skiing in file after him), `ground-fire` (a soldier knelt on his skis firing), `ground-lift` (a squad on a chair), `ground-arrest` (SAFE FOR WORK: him face down and held, the squad round him) |
| `soldiers` | `ski`, `foot`, `rocket` (every pose from the front, the side and behind at the chase camera's range), `gunner` (sat at his gun at each aim), `lods` (the three cuts) |

Pass `--poses=aim,kneel` to shoot a few poses and `--smock=whites` for plain whites. Each sheet is `previews/army-<view>.png`, and every frame is also written alone.

## In flight

`engine/game/army.ts` flies the machines the wanted level's roster asks for (`rosterOf(stars).helicopters`: one at one to three stars, two at four, three at five). Its numbers are `ARMY` in `engine/game/defs/army.ts`, and its state is `GameState.army`. That state is absent until a hunt asks for a machine, so a run nobody hunts moves no digest. Every draw it makes (the bearing they come in on, the way each one circles) comes off a stream of its own, seeded off the run, never `state.rng`.

**How a door gunner's helicopter hunts.** A gun on a pintle in a side door bears square out of the side. So the crew fly a **pylon turn**: a steady circle round the target, at a height and radius that keep the man square out of the gunner's door, with the machine banked into the circle so the inside door looks down at him. Door gunners qualify against targets from about 150 to 800 m, from the hover and moving at about 70 knots.

The game's circle is 220 m across the ground at 70 m over him, flown at 30 m/s. That puts the gun about 230 m off him, inside the gun's best band, and banks the machine about 23° (tan φ = v²/(g·r)).

A target that **runs** (a stolen helicopter at speed) cannot be circled. The machine sits in **echelon** off his tail quarter instead, 140 m behind and 90 m out to the gun's side, and flies his speed. The gun, yawed toward the nose, bears on him there.

**The call.** When the roster asks for more machines than are out, each is called. After the crew's scramble (`ARMY.respond`, 10 s, the next ones 7 s apart) it comes in at the **map's edge**:

- `inset` m inside the edge;
- on a bearing from the map's middle toward where he was when the hunt began, give or take `drift`, each machine called with it spread either side;
- 150 m over the snow and already at its cruise.

A machine lost is called again. **Until the first machine has reached the search, the search's clock does not run**: the stars flash, but a hunt nobody has yet flown is not lost.

**The flight** is a point flown with a pilot's limits rather than the player's rotor physics, which is built for one machine on one state:

- the velocity it wants: round its circle, at its place in echelon, or out to the edge;
- the acceleration that asks for, no more than the disc leant 34° gives (g·tan of it), smoothed over 0.6 s so the bank rolls in rather than snaps;
- its attitude read off that acceleration as a helicopter's is: leant into it, the nose hung down at speed;
- its height kept 30 m over the highest snow it reads seven seconds ahead, climbing at up to 10 m/s and sinking at up to 12;
- a cruise of 62 m/s (the class's 225 km/h), and a dash of 72 m/s to keep station on a fleeing machine;
- **a hard floor**: its skid datum is never let under 12 m over the highest snow under its disc, nor under 4 m over any crown the disc sweeps, whatever its station asks.

Two machines out keep 120 m apart (`separate`).

**The hunt.** Where a pursuer sees him, the machine circles him with the gunner's door inward. Its nose is turned along the circle, so he is square out of the door. Out of every pursuer's sight it **searches**: it circles where he was last seen (`WantedState.lastSeen`), wider (half the star's search radius), higher and slower. When the hunt is over (the stars lost, he dead or taken in) it turns for the edge, climbs, and is gone 150 m past it.

**The guns.** The roster's door gunners are shared out a machine at a time, two to a machine, the inward door first.

- Each door slides open within 1.4 km of him.
- Each manned gun is turned onto him at a man's pace, where its arc lets it.
- It fires whenever its door is open and he is within 650 m and in its gunner's sight (`seesQuarry` from the gun).

Every burst goes through the gunfire layer (`armGun`, `fireAt`) under the wanted level's rules of fire: none at one star, warning fire at two, aimed from three, and never aimed with SAFE FOR WORK on. The gunfire's aim leads him by his way relative to the gun's own, as a gunner allows for his machine's speed. A stolen helicopter is shot down through the gunfire's machine damage and its own crash.

**The pursuers.** Every machine hunting and every gunner in an open door is written into `WantedState.pursuers` each step (ids from `ARMY.ids.pursuer`), so the wanted level's sight test sees through their eyes.

**A ram.** His stolen machine's disc into one of theirs brings theirs down: the discs within 2.5 m of each other's height, or the cabins within 6 m. Theirs spins down with its tail gone and burns where it lands for two minutes. His crashes by its own rules (`heli.ts`' `crashHeli`), and bringing one down is an offence (`downed-helicopter`). With SAFE FOR WORK on nothing is struck: his machine is put back outside their disc.

`CreateGameOptions.army: false` keeps the machines home, so a hunt is the wanted level alone. The wanted level's own tests run that way.

**Events.** One `army` event, its `change` saying what happened: `called`, `arrived`, `leaving`, `gone`, `rammed`, `down`. A ram is heard as the blades meeting, and the wreck as the helicopter's explosion (`route.ts`).

### As drawn and heard

`army-air-view.ts` draws every machine out with `createArmyHeliView`, where the engine has it this frame, carried on its way by the share of a step the picture is past the state.

- The rotor turns at its spool.
- The doors slide open as it engages.
- Each manned gun turns where the engine aims it, and the door gunner sits at it, posed to that aim by `gunnerPosed`.
- The beacons flash and the navigation lights burn while the rotor turns.
- A machine rammed out of the air goes up where it lands on the game's explosion, and its wreck burns.

The camera is the run's own.

`audio/army-bed.ts` hears each machine as the free ride's helicopter is heard (`heli-voice.ts`, one rack a machine, up to three): from the skier's head, falling off with distance and losing its top to the air, pitched by the Doppler shift of its closing speed and panned across his heading. Over that it lays the class's own voice. Four blades at its own rpm give a lower, heavier blade passage, with the thump half as loud again. Its twin turbines whine a little lower, and the second layer is a second turbine a few cents off the first, so the two beat against each other.

### The labs

`make army-flight` is pure Node and takes tens of seconds. On a real map (seed 38) it runs each star against two quarries: the bot skiing away, and him in the stolen helicopter, flown corner to corner by the bot's hands. Each row gives:

- when the first machine came in, and when it was on station;
- the slant range held while he was seen, and the share of the time he was seen;
- the rounds fired and the rounds in him;
- when he died or his machine was brought down;
- the least height over the snow and over the crowns, and the steps under the floor (always 0).

A run of `make army-flight ARGS="--seconds=120"`:

Seed 38, 120 s a hunt, INJURIES on.

| Quarry | Stars | Machines | In, s | On station, s | Range p10 / med / p90, m | Seen | Rounds | In him | Dead, s | Downed, s | Least over snow, m | Over crowns, m | Under floor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 1 | 1 | 10 | 27 | 242 / 250 / 266 | 93% | 264 | 0 | — | — | 32.9 | 20.4 | 0 |
| skier | 2 | 1 | 10 | 27 | 241 / 249 / 266 | 93% | 288 | 4 | 101 | — | 32.9 | 20.4 | 0 |
| skier | 3 | 1 | 10 | 27 | 203 / 246 / 253 | 93% | 129 | 1 | 59 | — | 34.3 | 20.2 | 0 |
| skier | 4 | 2 | 10 | 27 | 189 / 398 / 822 | 93% | 61 | 2 | 37 | — | 92.8 | 75.7 | 0 |
| skier | 5 | 3 | 10 | 27 | 245 / 253 / 332 | 93% | 688 | 12 | 88 | — | 28.7 | 12.5 | 0 |
| heli | 1 | 1 | 10 | 20 | 166 / 166 / 218 | 100% | 59 | 0 | 61 | 61 | 105.3 | 90.7 | 0 |
| heli | 2 | 1 | 10 | 20 | 166 / 166 / 218 | 100% | 143 | 0 | 61 | 61 | 105.3 | 90.7 | 0 |
| heli | 3 | 1 | 10 | 20 | 164 / 176 / 287 | 100% | 46 | 2 | 35 | 35 | 146.8 | 131.4 | 0 |
| heli | 4 | 2 | 10 | 20 | 165 / 1318 / 1804 | 100% | 46 | 2 | 35 | 35 | 146.8 | 131.4 | 0 |
| heli | 5 | 3 | 10 | 20 | 166 / 762 / 1756 | 100% | 64 | 1 | 35 | 35 | 147.3 | 131.4 | 0 |

The stolen helicopter at one and two stars comes down at 61 s with no round in it: the lab's pilot (the bot's hands, flown corner to corner) flies it into the mountain, not the army. The machines' least height over the snow and the crowns is the floor at work; the wide ranges of the stolen helicopter's four- and five-star rows are taken after it is down, while the machines fly home.

The army lab's `hunt` sheet (`make army ARGS="--sheet=hunt"`) photographs the same hunts through the game's own renderer.

### Not yet

- They cannot be shot down; a ram is the one way to bring one down.

## On the ground

`engine/game/army-ground.ts` puts the roster's soldiers (`rosterOf(stars).soldiers`: four at two stars, eight at three and four, twelve at five) on the snow and sends them after him. Its numbers are `ARMY_GROUND` in `engine/game/defs/army-ground.ts`; the soldiers live in `ArmyState.troops`. Nothing on the ground draws from any stream, `state.rng` included: every choice is a pure function of the state, so a hunt replays and no digest moves. All of it waits for the wanted level to ask: a run nobody hunts, or a hunt at one star, puts nobody down.

**What the real thing does.** A utility helicopter of this class lands on a slope of up to about 5 to 8 degrees across or along it, depending on the manual. Steeper, a side slope rolls it over on its skids at about 15 to 18. Where it cannot land, troops come down a FAST ROPE from a hover of about 10 to 15 m: a thick braided rope from a bar over the door, gripped with gloves and boots and slid, one man a second or so behind the next. Out of a machine on the ground they run out to the edge of the rotor disc, clear of the tail rotor, and **kneel facing outward**, rifles out, until it lifts; then they move. Ski troops fight from a stop: off one knee or prone, the poles planted. A squad left behind is **leapfrogged**: picked up and set down again ahead.

**The landing.** A machine with men aboard asks for a place to put them down while he is on the snow, seen, and the roster is short of men (`askLandings`, once a second). `landingSpot` (`army-land.ts`) searches a ring round him, 60 to 280 m out on an 8 m grid. It prefers 120 m off, a place AHEAD of him (where he is going), and one not far below him. A place it lands on must be:

- no steeper than 0.12 over the disc's circle (about 7°, `heli-pad.ts`' `leanOver`);
- clear under the whole disc and 4 m past it of trunks, posts, lifts and water (`clearAt`, `solidsNear`).

Where nothing in the ring is, a **fast rope's** place will do: 5 m clear round a man's drop, under a hover the rope reaches (22 m at most). Where neither is, it asks again a second later.

The machine flies its approach as a pilot flares into a landing: in along the way at no more than the speed that stops it over the spot at 4 m/s² of braking (`sqrt(2·a·d)`), held over the snow and the crowns until it is within 6 m and slowed under 3 m/s, then down at up to 4 m/s, onto the snow (`set`) or to the rope's hover (`rope`). Its doors slide open on the way down. A drop he has skied 450 m from before a man is out is given up, and a nearer place asked for.

With more than one machine out, the first not already set on a landing stays up as the **overwatch**: it never lands, and its door guns cover the men on the ground.

**Out of the doors.** One man every 0.7 s, from each door in turn (a man every 1.2 s down the rope from either hook). At four stars and up the second man out is the **rocketeer** (`rocketFrom`). Each runs 9 m out square to the machine, spread along its length, and kneels facing away from it. Once every man is out and knelt it lingers 1.5 s more and lifts (`rise`), and back on the hunt it says `lifted`. Only then does the squad move. A man down a rope slides at 4 m/s and lands on his skis.

**The chase.** Each soldier is a point on the heightfield with the crowd's numbers for a man on skis (`army-troop.ts`):

- gravity along the way he faces, the snow's drag and the air's;
- a turn no tighter than his speed allows, and the skid that scrubs speed off when he turns harder;
- a pace he brakes to (16 m/s);
- a working floor: up a rise he skates and herringbones at 3.4 m/s, or traverses in zig-zags of 7 m when it is steeper than 0.45;
- trunks, posts and lift towers pushed round, and the other men kept 2.5 m apart.

A **watchdog** counts the windows of 4 s in which a man meaning to move barely did, and side-steps him round whatever holds him. The anti-armour man walks, at 1.6 m/s.

**Firing.** A soldier who has him in sight within 260 m (the rocketeer 300) **stops**: a hockey stop, a settle of 0.7 s, then he fires off one knee where the snow is flat enough (under 0.35) and stood on his skis where it is not. He fires a few bursts through the gunfire layer (`armGun`, `fireAt`, the `rifle` or the `rocket`) under the wanted level's rules of fire, then skis on for 5 s before he may stop again. He shouts once within 60 m. His view is staggered across the squad, a look every quarter second.

**Safe for work.** The soldiers never wound him. Their fire is the gunfire's warning fire, never at him, and inside 45 m they stop firing and **run him down**. A soldier who reaches him (`WANTED.arrest.reach`, 2 m) while he is slow (under 3 m/s) or down **arrests** him (`arrestSkier`). He is thrown face down (crash cause `arrest`) and held there: his body is drawn over 0.8 s into a prone lay, his hands at the small of his back, and held still while the soldier kneels at his side with his hands on him. `run.ts` never stands him up while the hunt has ended `arrested`. The rest of the squad close round him in a ring 3.5 m out, facing him (`cover`). The ARRESTED card takes the run from there (`wanted.md`).

**Body on body.** A soldier is one of the people on foot to the skier (`foot.ts`' `meetPerson`, 105 kg with his kit). The player skiing into one knocks him down on the same ragdoll as a civilian, raises the heat (`hit-soldier`), and the soldier gets up again when his body has come to rest. With the INJURIES on a hard enough blow hurts or kills him, and he lies there.

**Leapfrog and re-embark.** A machine whose squad are all far (350 m) from where he was last seen, and have not seen him for 15 s, picks them up: a landing near them (10 to 160 m out), its men waiting clear of the disc until it is down, then in at its nearer door. It then hunts again with them aboard, and drops them where he is.

**Up the lifts.** At three stars and up, squads of four are sent up the ski area's own lifts (`army-lift.ts`, the roster's `lifted`): 20 s after the call, then one every 30 s while the roster is short of lifted men. Each takes the lift whose top is nearest him and at least 30 m above him. It walks into the queue at the bottom, boards the next carrier after the crowd's riders, rides it on the crowd's own sums (`carrierAt`, `carrierGripAt`, `loadAt`, `offAt`), is let go at the top and chases from there. In a gondola's cabin a soldier is not drawn and not a pursuer.

**The woods hide him.** Every soldier on the snow or on a lift (not one knocked down, nor one in a gondola's cabin) is a pursuer the wanted level sees through (`WantedState.pursuers`, ids from 2000). A soldier's line of sight is blocked by the terrain as before, and now by three or more crowns along it (`wanted.ts`' `throughWoods`, for every pursuer on the snow), so a man skiing into a forest can lose them; the machines in the air still look down through the trees.

**Events.** One `soldier` event, its `change` saying what happened: `out` (on the snow), `aim` (stopped to fire), `down`, `up`, `dead`, `aboard`, `lift` (sent up one), `arrest`, `shout`. `army` gains `landed` and `lifted`. The soldiers are heard by their rifles (the gunfire's) and their bodies struck (`struck`); they have no voices yet.

### As drawn

`army-ground-view.ts` (held by `army-air-view.ts`) draws every soldier as the part-3 figures (`soldier-shapes.ts`), in the pose his mode says, where he is this frame:

- a rifleman on his skis (the `skier` figure): tucked, leant into his turn or poling up a rise as he goes; stood or knelt on his skis to aim (`skiAim`, `skiKneel`); knelt facing out at the dismount; sat on a chair (`seat`); knelt over the man he arrests (`pin`);
- down a fast rope (the `foot` figure's `rope`), the rope itself hung from the door's hook to the snow;
- the anti-armour man walking, and the launcher on his shoulder stood or knelt;
- knocked down or killed: hung on his body's ragdoll (`crowd-fall.ts`' `lyingPose`, sized to the soldier), posed outright while it moves;
- aboard a machine or in a gondola's cabin: not drawn.

A kneel on skis keeps both skis flat on the snow (`flatSkis`): a key's boot is squared to its shin, which would stand a ski on its tail. His muzzle flashes, tracers and strikes are the gunfire's (`gunfire-view.ts`).

### The labs

`make army-ground` is pure Node and takes a minute or two. On a real map (seed 38) it runs each star against two quarries: the bot skiing away, and a man stood still where the hunt found him. Each row gives:

- when the first machine set down, and how many landed and roped;
- the men put down;
- the first contact (the first stop to fire), the rounds and the rounds in him;
- his death, or (with `--sfw`) his arrest;
- the men picked up again, the men who rode a lift and the most at once;
- the men knocked down, and the men STUCK — always 0.

A run of `make army-ground ARGS="--seconds=150"`:

Seed 38, 150 s a hunt, INJURIES on.

| Quarry | Stars | Set down, s | Landed / roped | Men put down | First contact, s | Rounds | In him | Dead, s | Arrested, s | Picked up | Rode a lift (most at once) | Knocked down | Stuck |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 51 | 2 / 0 | 8 | 87 | 20 | 2 | 99 | — | 0 | 4 (4) | 0 | 0 |
| skier | 3 | 51 | 1 / 0 | 8 | — | 0 | 0 | — | — | 8 | 8 (8) | 0 | 0 |
| skier | 4 | 50 | 1 / 0 | 8 | — | 0 | 0 | 70 | — | 0 | 8 (8) | 0 | 0 |
| skier | 5 | 51 | 2 / 0 | 16 | — | 0 | 0 | 70 | — | 0 | 8 (8) | 0 | 0 |
| still | 2 | 58 | 2 / 0 | 8 | 74 | 31 | 3 | 90 | — | 0 | 0 (0) | 0 | 0 |
| still | 3 | 49 | 1 / 0 | 8 | 63 | 23 | 3 | 75 | — | 0 | 4 (4) | 0 | 0 |
| still | 4 | 50 | 1 / 0 | 3 | — | 0 | 0 | 52 | — | 0 | 4 (4) | 0 | 0 |
| still | 5 | 51 | 1 / 0 | 2 | — | 0 | 0 | 52 | — | 0 | 4 (4) | 0 | 0 |

The same with `--sfw`:

| Quarry | Stars | Set down, s | Landed / roped | Men put down | First contact, s | Rounds | In him | Dead, s | Arrested, s | Picked up | Rode a lift (most at once) | Knocked down | Stuck |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 51 | 2 / 0 | 8 | 87 | 228 | 0 | — | — | 0 | 4 (4) | 0 | 0 |
| skier | 3 | 51 | 1 / 0 | 8 | — | 0 | 0 | — | — | 8 | 8 (8) | 0 | 0 |
| skier | 4 | 50 | 3 / 0 | 16 | 106 | 141 | 0 | — | — | 0 | 12 (12) | 0 | 0 |
| skier | 5 | 51 | 2 / 0 | 16 | 106 | 85 | 0 | — | — | 4 | 12 (12) | 0 | 0 |
| still | 2 | 58 | 2 / 0 | 8 | 70 | 35 | 0 | — | 92 | 0 | 0 (0) | 0 | 0 |
| still | 3 | 49 | 1 / 0 | 8 | 64 | 108 | 0 | — | 94 | 0 | 4 (4) | 0 | 0 |
| still | 4 | 50 | 1 / 0 | 8 | 70 | 54 | 0 | — | 90 | 0 | 8 (8) | 0 | 0 |
| still | 5 | 51 | 2 / 0 | 16 | 71 | 113 | 0 | — | 89 | 0 | 10 (10) | 0 | 0 |

The rounds and the rounds in him are the soldiers' alone (the rifle and the launcher); the door guns are `make army-flight`'s. With the INJURIES on at four and five stars the door gunners kill a man stood still before a squad is near him, so those rows show no contact. A skier at speed outruns a squad on skis: the leapfrog (picked up) and the lifts are how they keep up. No fast rope was flown on seed 38; `tests/army_ground_test.ts` flies one over a forest.

The army lab's `ground` sheet (`make army ARGS="--sheet=ground"`) photographs the same hunts through the game's own renderer: `ground-land` (a machine set down, its squad spilling out and kneeling), `ground-file` (the squad skiing in file after him), `ground-fire` (a soldier knelt on his skis firing), `ground-lift` (a squad on a chair), `ground-arrest` (SAFE FOR WORK: him face down and held, the squad round him).

### Not yet

- The soldiers have no voices: the shout and the arrest are events only.
- They do not go prone, take cover behind a trunk, or ski a drop-off on purpose.
- The rocketeer walks; he has no skis.

## On snowmobiles

`engine/game/army-sled.ts` sends the roster's military snowmobiles (`rosterOf(stars).snowmobiles`: one at three stars, two at four, three at five) after him. Its numbers are `ARMY_SLED` in `engine/game/defs/army-sled.ts`; the machines live in `ArmyState.sleds`. Like the soldiers, nothing here draws from any stream, so a hunt replays and no digest moves, and a run nobody hunts or a hunt under three stars calls none.

**What the real thing does.** An army's over-snow sled is a long-track utility snowmobile, ridden two up: a long seat with a pillion and grab handles behind the driver, and a tubular rack over the tunnel's end for the crew's kit, a fuel can and a radio. It is painted a flat olive drab and, in a snow theatre, given white panels or daubed with a temporary white over the green. It carries a pair of riflemen fast over open snow and stops to let them fight: a machine on the move bucks under every bump and is a poor gun platform, so the man behind fires from a **short halt** (the driver brakes to a stop, the gunner fires a few bursts, and they move on before the target can answer). A skier who keeps moving and keeps something between him and them makes them stop often and is hard to hit from one.

**The machine.** Each is the free ride's own snowmobile (`sled.ts`): the same body, belt and engine (`rideSled`), stepped on the same snow, with the trunks and the map's edge (`sledSolids`, `sledBounds`) and the pilot's hands (`sledPilot`, aimed at a point of the army's choosing). It is laden with two men in their kit and 40 kg of gun, ammunition and packs. It is called out of the village: 20 s after the roster asks, one every 8 s after the first, each from its own place beside the free ride's snowmobile spot (`sledPad`), 5 m to alternate sides, clear of trunks and water.

**Reading the snow.** Every tenth of a second each machine weighs nine headings across 1.6 rad either side of the way to him (`wayCost`), reading 36 m ahead every 6 m. A heading is no way at all where:

- a rise is steeper than 0.75 (more than a laden machine climbs);
- a drop is steeper than 0.9 (a cliff it will not ride off);
- open water is within 6 m;
- the map's edge is within 40 m.

A heading also costs for every radian off the way to him, every metre it is stopped short, every trunk within 3 m of its line, and for leaving the heading it holds. Among the trees it slows from 17 m/s (some 60 km/h, a laden utility machine and not a racer) to 8, and inside 60 m of where it stands off him it eases to a crawl. A **watchdog** counts the windows of 4 s in which it meant to move and barely did: the first swings it off to a side for 3 s, the second **digs it out** (stood 6 m back on its own track, facing him). Its crew see him as a snowmobile's do (`WANTED.sight`, 400 m), through the terrain and not through three or more crowns (`throughWoods`), so the woods lose him to them.

**The short halt.** With him in their own sight, between 20 and 380 m, and the last halt over, the driver turns the machine broadside (the gunner fires past the driver's back, clear of him) and brakes it to a stop. Under 1.5 m/s and once the gunner has settled for 1.5 s with his aim laid on him, the gunner fires up to three bursts of the **light machine gun** (`lmg`, a 5.56 mm-class belt-fed gun: 850 rounds a minute, bursts of 3 to 6, aimed to 600 m) through the gunfire layer under the roster's rules of fire. After 8 s, three bursts, or 1.5 s out of sight they drive on, and halt again no sooner than 6 to 11 s later. Nobody halts to fire at a man already down. With the INJURIES on they stand off him at 110 m.

**Safe for work.** They never wound him: the gun's fire is the gunfire's warning fire, never at him. They run him down and stand off at 7 m; with him seen within 14 m and slow, or down, the crew **get off** and become two soldiers on the ground (`army-ground.ts`, `from: "sled"`), who arrest him exactly as a squad does. The machine is left standing empty.

**Body on machine.** The skier is held out of every machine's hull (`meetBoxes`, steel). Skiing into one at speed strikes the crewman on the side he meets (`foot.ts`' `meetPerson`): he is knocked off onto the snow as a soldier down, the heat rises (`hit-soldier`), the other man gets off after him to chase on skis, and the machine is left standing empty.

**Taken.** An empty machine standing still is a machine to take (`steal.ts`' `ARMY_SLED_SOURCE`): the machine press beside it puts him on it as his own snowmobile in the army's livery, and the theft is an offence (`stole-snowmobile`). At most three machines are left standing; one is gone once the hunt is over and he is 300 m off.

**The pursuers.** Every crewed machine on the snow is one pursuer (`kind: "snowmobile"`, ids from 5000). **Events:** one `army-sled` event, its `change` saying what happened: `called`, `out`, `halt`, `knocked`, `dismount`, `dug`, `stolen`, `gone`.

### As drawn and heard

`army-sled-view.ts` (held by `army-air-view.ts`) draws each machine as the free ride's model in the army's livery (`sled-livery.ts`' `army` row: olive drab) with its kit (`sled-army-kit.ts`: white daubed over the hood and the tunnel in ragged blotches, a white panel on the hood, the pillion and its grab handles, the rack with a fuel can and a white-covered pack, and the radio's whip). The crew are the part-3 soldier figures: the driver astride the seat with his fists on the grips (`sledDriverPose`), the gunner on the pillion with the gun laid where the engine aims it (`sledGunnerPose`). A man off it is drawn as a soldier on the ground. A machine he has taken is drawn the same, kit and all (`sled-view.ts`). Each is heard as the free ride's snowmobile (`audio/army-bed.ts`, the sled's voice racks, three at most); the gun is heard as the rifle (`audio/route.ts`).

### The labs

`make army-ground ARGS="--table=sleds"` adds a second table: the snowmobiles out (and the most at once), the first out and the first halt, the halts, the rounds and the rounds in him, his death or arrest, the crews off to arrest him, the machines dug out, and the machines STUCK (still held after the swing and the dig out: a third window of 4 s running in which it barely moved) — always 0. `--alone` hunts him with the snowmobiles alone (the roster's door gunners, soldiers and lifted men held back). A run of `make army-ground ARGS="--seconds=180 --table=sleds"` on seed 38, before the snowmobiles:

| Quarry | Stars | Snowmobiles out (most at once) | First out, s | First halt, s | Halts | Rounds | In him | Dead, s | Arrested, s | Crews off to arrest | Dug out | Stuck |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 0 (0) | — | — | 0 | 0 | 0 | 99 | — | 0 | 0 | 0 |
| skier | 3 | 0 (0) | — | — | 0 | 0 | 0 | 163 | — | 0 | 0 | 0 |
| skier | 4 | 0 (0) | — | — | 0 | 0 | 0 | 70 | — | 0 | 0 | 0 |
| skier | 5 | 0 (0) | — | — | 0 | 0 | 0 | 70 | — | 0 | 0 | 0 |
| still | 2 | 0 (0) | — | — | 0 | 0 | 0 | 90 | — | 0 | 0 | 0 |
| still | 3 | 0 (0) | — | — | 0 | 0 | 0 | 75 | — | 0 | 0 | 0 |
| still | 4 | 0 (0) | — | — | 0 | 0 | 0 | 52 | — | 0 | 0 | 0 |
| still | 5 | 0 (0) | — | — | 0 | 0 | 0 | 52 | — | 0 | 0 | 0 |

After, INJURIES on:

| Quarry | Stars | Snowmobiles out (most at once) | First out, s | First halt, s | Halts | Rounds | In him | Dead, s | Arrested, s | Crews off to arrest | Dug out | Stuck |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 1 (1) | 84 | — | 0 | 0 | 0 | 99 | — | 0 | 0 | 0 |
| skier | 3 | 2 (2) | 20 | 121 | 1 | 10 | 0 | 131 | — | 0 | 2 | 0 |
| skier | 4 | 2 (2) | 20 | — | 0 | 0 | 0 | 70 | — | 0 | 0 | 0 |
| skier | 5 | 3 (3) | 20 | — | 0 | 0 | 0 | 70 | — | 0 | 0 | 0 |
| still | 2 | 1 (1) | 89 | — | 0 | 0 | 0 | 90 | — | 0 | 0 | 0 |
| still | 3 | 1 (1) | 20 | 64 | 1 | 8 | 1 | 69 | — | 0 | 0 | 0 |
| still | 4 | 2 (2) | 20 | — | 0 | 0 | 0 | 52 | — | 0 | 0 | 0 |
| still | 5 | 3 (3) | 20 | — | 0 | 0 | 0 | 52 | — | 0 | 0 | 0 |

SAFE FOR WORK:

| Quarry | Stars | Snowmobiles out (most at once) | First out, s | First halt, s | Halts | Rounds | In him | Dead, s | Arrested, s | Crews off to arrest | Dug out | Stuck |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 2 (2) | 84 | 101 | 5 | 64 | 0 | — | — | 0 | 0 | 0 |
| skier | 3 | 2 (2) | 20 | 67 | 7 | 78 | 0 | — | — | 0 | 0 | 0 |
| skier | 4 | 2 (2) | 20 | 55 | 5 | 45 | 0 | — | 90 | 1 | 0 | 0 |
| skier | 5 | 3 (3) | 20 | 55 | 23 | 200 | 0 | — | — | 0 | 4 | 0 |
| still | 2 | 1 (1) | 89 | — | 0 | 0 | 0 | — | 92 | 0 | 0 | 0 |
| still | 3 | 1 (1) | 20 | 59 | 1 | 11 | 0 | — | 69 | 1 | 0 | 0 |
| still | 4 | 2 (2) | 20 | 59 | 2 | 13 | 0 | — | 69 | 1 | 0 | 0 |
| still | 5 | 3 (3) | 20 | 59 | 2 | 13 | 0 | — | 69 | 1 | 0 | 0 |

The snowmobiles alone, INJURIES on:

| Quarry | Stars | Snowmobiles out (most at once) | First out, s | First halt, s | Halts | Rounds | In him | Dead, s | Arrested, s | Crews off to arrest | Dug out | Stuck |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 2 (2) | 83 | 101 | 3 | 39 | 2 | — | — | 0 | 1 | 0 |
| skier | 3 | 2 (2) | 20 | 59 | 4 | 25 | 8 | 140 | — | 0 | 3 | 0 |
| skier | 4 | 3 (3) | 20 | 55 | 3 | 12 | 5 | 125 | — | 0 | 5 | 0 |
| skier | 5 | 3 (3) | 20 | 55 | 6 | 12 | 3 | 91 | — | 0 | 1 | 0 |
| still | 2 | 1 (1) | 84 | 127 | 2 | 6 | 6 | 139 | — | 0 | 0 | 0 |
| still | 3 | 1 (1) | 20 | 64 | 1 | 12 | 5 | 71 | — | 0 | 0 | 0 |
| still | 4 | 2 (2) | 20 | 64 | 1 | 12 | 5 | 71 | — | 0 | 0 | 0 |
| still | 5 | 3 (3) | 20 | 64 | 1 | 12 | 5 | 71 | — | 0 | 0 | 0 |

The snowmobiles alone, SAFE FOR WORK:

| Quarry | Stars | Snowmobiles out (most at once) | First out, s | First halt, s | Halts | Rounds | In him | Dead, s | Arrested, s | Crews off to arrest | Dug out | Stuck |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 2 (2) | 83 | 101 | 7 | 48 | 0 | — | — | 0 | 0 | 0 |
| skier | 3 | 1 (1) | 20 | 59 | 3 | 24 | 0 | — | 95 | 1 | 0 | 0 |
| skier | 4 | 5 (3) | 20 | 55 | 15 | 148 | 0 | — | — | 2 | 0 | 0 |
| skier | 5 | 3 (3) | 20 | 55 | 14 | 138 | 0 | — | — | 0 | 0 | 0 |
| still | 2 | 1 (1) | 84 | 123 | 1 | 11 | 0 | — | 138 | 1 | 0 | 0 |
| still | 3 | 1 (1) | 20 | 59 | 1 | 11 | 0 | — | 69 | 1 | 0 | 0 |
| still | 4 | 2 (2) | 20 | 59 | 2 | 11 | 0 | — | 69 | 1 | 0 | 0 |
| still | 5 | 3 (3) | 20 | 59 | 2 | 11 | 0 | — | 69 | 1 | 0 | 0 |

The heat climbs on its own the longer he survives, so a hunt raised at two stars has its first machine out at three. With the whole army out, the door guns kill a man before the snowmobiles reach him at four and five stars. Alone, the machines put a man stood still down at the first halt, and a skier going straight down the piste (the bot does not dodge) within two minutes or so; one who weaves through the woods is out of their sight. With SAFE FOR WORK no round is ever in him, and a man who stands still is arrested by a sled's crew.

The army lab's `sleds` sheet (`make army ARGS="--sheet=sleds"`) photographs the same hunts through the game's own renderer: `sled-chase` (a crewed machine after him, and the crew close up), `sled-halt` (stopped broadside, the gunner firing), `sled-arrest` (SAFE FOR WORK: the empty machine, its crew off and him held).

### Not yet

- The crew have no voices, and the machine has no siren or horn.
- They do not tow a sledge (an ahkio) or carry more than two.

## Ground waves

`engine/game/army-wave.ts` sends the wanted level's GROUND WAVES up the mountain (`WANTED.waves`, read with `groundWave(stars, n)` and counted with `wavesSent`): from two stars, the first `first` s after he reached the star he carries and then one every `every` s, each the base plus the growth for every wave before it this hunt, so the longer he survives, the bigger every wave. Its numbers are `ARMY_WAVE` in `engine/game/defs/army-wave.ts`; the ways being climbed live in `ArmyState.routes` and the count in `ArmyState.waves`. Nothing here draws from any stream: where a column forms, how it is laid out and who walks are pure functions of the map, the state and the men's ids, so a hunt replays and no digest moves.

**What the real thing does.** Troops brought up a valley by road get down from their trucks where the road ends or where the enemy cannot see them, form up, and go on foot. In deep snow a winter infantryman moves on skis, with skins under them for the climb: a ski-tourer's herringbone on a short rise and a zig-zag traverse up a long steep one. On a packed road or a groomed slope men can also slog in their boots. A column climbs the easiest line there is. On a ski area that line is the runs and the cat tracks, which are packed and graded for the machines that groom them.

**The way up.** `wayDown(level, x, z)` reads the way down from where he is to the valley: the ski area's run nearest him, from its nearest point to its end, then the run it merges into from where it does (`Run.into`), and on to the village, with a point every `sample` (8) m and the run's width at each. Read backwards it is the way up. On a map with no ski area it is the fall line, and on ground with no fall at all, a straight line away from the summit.

**The column.** A wave dismounts `start` (380) m down the way from him, as the runs wind rather than as the crow flies. While he could see that place (`seesQuarry` from a man's eyes there) it goes further down, up to `hidden` (720) m. It never forms nearer him than `apart` (300) m as the crow flies, because a run can wind back on itself; where the way ends nearer him than that, it is carried on down the fall line, leading away from him. There the men form a column of files: up to `abreast` (5) men across, `gap` (3.2) m apart and no wider than the run less `margin` (2) m each side, with ranks `rank` (4.5) m apart down the run. Each man is set a little off his file and his rank by his id, so the column reads as men and not a grid. Every `slog`th (3rd) man is on foot (`role: "foot"`); the rest are on skis with skins.

**The climb.** Each man (`mode: "climb"`) climbs to the next point of the way on his own file (`Soldier.leg`, `.lane`). He takes the next point once he is within `reach` (6) m of it or past it. He climbs as any soldier on the ground moves (`army-troop.ts`): on skins he herringbones a rise and traverses a steep one, and on foot he walks, slower uphill. He keeps clear of the trunks and of the men round him, and the same watchdog side-steps a man who is held. A man leaves the column when he sees him within a rifle's range, when he is within `engage` (220) m of where he was last seen, or when he has climbed the whole way. From then on he is a soldier on the ground like any other: the chase, the stop to fire from one knee or stood, the shout, and, with SAFE FOR WORK on, the run-down and the arrest.

**What a wave brings.** The wave's mix names snowmobiles, tracked carriers, trucks, tanks and men on foot. The snowmobiles are the army's own (`army-sled.ts`): a wave raises how many it keeps out on top of the roster's (`ArmyState.waveSleds`, at most `sleds` (5)), and they come out of the village as the roster's do. The carriers, the trucks and the tanks are driven up after the column (below, [the waves' vehicles](#the-waves-vehicles)).

**The bound.** At most `most` men of the waves are out at once (24 at two stars, 48 at three, 96 at four, 160 at five); a wave that would put more out puts what the bound leaves room for. A man of a wave further than `behind` (1,100) m from where he was last seen is taken off the map, out of the fight and out of the step's cost. With the hunt over, every man of them further than `home` (450) m from him is taken off too.

**Safe for work.** They never wound him. Their fire is the gunfire's warning fire, and they run him down and arrest him as every soldier does (`arrestSkier`). Once he is taken, the nearest `cover` (12) men of the waves within `coverNear` (60) m close round him, and the rest come up to a ring 9 to 40 m round him (each at his own distance) and stand there facing him.

**Events.** The `army` event's `wave` change: `id` the wave's number this hunt, and the place its column forms up at. A man leaving the column is a `soldier` event as any other (`aim`, `arrest`, `down`).

### As drawn

The men of the waves are drawn by `army-ground-view.ts` as every soldier is: the men on skis as the `skier` figure poling stride on stride while they climb, and the men on foot as the `foot` figure walking (`walkA`/`walkB` by the ground covered, each man on his own foot so a column does not march in step), aiming stood (`aim`) or knelt (`kneel`). A man near the lens (inside the crowd's `near` cut) is drawn on a mesh of his own. Past it, every man of one figure at one cut is an instance of one draw (`soldier-batch.ts`'s `SoldierBatch`): an instanced mesh of the part-3 figure, placed by its matrix and posed by its own morph weights, as the crowd's amateurs are. So a column of a hundred costs a handful of draws.

### The labs

`make army-ground ARGS="--table=waves"` adds the waves' table. For each row it gives:

- the waves sent and when the first set off;
- the men they marched out, and the most out at once;
- the snowmobiles the waves keep out;
- the carriers, trucks and tanks they brought;
- when a man of a wave first stopped to fire at him;
- his death or his arrest;
- the men of the waves STUCK (always 0);
- the step's cost: the wall time of a whole engine step while hunted, its mean and its 99th percentile.

On seed 38, 180 s a hunt, INJURIES on, before the waves (the four tables were cut back to back on one machine, so their step times compare with each other and not with a table cut elsewhere):

| Quarry | Stars | Waves (first, s) | Men marched (most at once) | Snowmobiles | Carriers / trucks / tanks | First contact, s | Dead, s | Arrested, s | Stuck | Step, ms (p99) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | 99 | — | 0 | 0.330 (1.161) |
| skier | 3 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | 131 | — | 0 | 0.301 (0.867) |
| skier | 4 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | 70 | — | 0 | 0.277 (0.687) |
| skier | 5 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | 70 | — | 0 | 0.268 (0.669) |
| still | 2 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | 90 | — | 0 | 0.186 (0.494) |
| still | 3 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | 69 | — | 0 | 0.214 (0.519) |
| still | 4 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | 52 | — | 0 | 0.232 (0.715) |
| still | 5 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | 52 | — | 0 | 0.237 (0.592) |

After:

| Quarry | Stars | Waves (first, s) | Men marched (most at once) | Snowmobiles | Carriers / trucks / tanks | First contact, s | Dead, s | Arrested, s | Stuck | Step, ms (p99) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | 99 | — | 0 | 0.361 (1.313) |
| skier | 3 | 2 (60) | 30 (30) | 2 | 0 / 0 / 0 | 70 | 136 | — | 0 | 0.407 (1.222) |
| skier | 4 | 1 (45) | 16 (16) | 2 | 0 / 0 / 0 | — | 70 | — | 0 | 0.412 (1.165) |
| skier | 5 | 1 (30) | 24 (24) | 3 | 0 / 0 / 0 | 40 | 53 | — | 0 | 0.384 (0.953) |
| still | 2 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | 90 | — | 0 | 0.243 (0.654) |
| still | 3 | 1 (60) | 8 (8) | 2 | 0 / 0 / 0 | — | 69 | — | 0 | 0.261 (0.618) |
| still | 4 | 1 (45) | 16 (16) | 2 | 0 / 0 / 0 | — | 52 | — | 0 | 0.278 (0.815) |
| still | 5 | 1 (30) | 24 (24) | 3 | 0 / 0 / 0 | — | 52 | — | 0 | 0.333 (0.921) |

SAFE FOR WORK, before:

| Quarry | Stars | Waves (first, s) | Men marched (most at once) | Snowmobiles | Carriers / trucks / tanks | First contact, s | Dead, s | Arrested, s | Stuck | Step, ms (p99) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | — | — | 0 | 0.305 (1.116) |
| skier | 3 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | — | — | 0 | 0.255 (0.667) |
| skier | 4 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | — | 90 | 0 | 0.266 (0.703) |
| skier | 5 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | — | — | 0 | 0.362 (1.016) |
| still | 2 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | — | 92 | 0 | 0.166 (0.453) |
| still | 3 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | — | 69 | 0 | 0.180 (0.490) |
| still | 4 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | — | 69 | 0 | 0.238 (0.679) |
| still | 5 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | — | 69 | 0 | 0.266 (0.791) |

After:

| Quarry | Stars | Waves (first, s) | Men marched (most at once) | Snowmobiles | Carriers / trucks / tanks | First contact, s | Dead, s | Arrested, s | Stuck | Step, ms (p99) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 1 (124) | 8 (8) | 2 | 0 / 0 / 0 | 140 | — | — | 0 | 0.405 (1.441) |
| skier | 3 | 2 (60) | 30 (30) | 2 | 0 / 0 / 0 | 70 | — | 165 | 0 | 0.397 (1.157) |
| skier | 4 | 1 (45) | 16 (16) | 2 | 0 / 0 / 0 | 59 | — | 90 | 0 | 0.365 (0.934) |
| skier | 5 | 2 (30) | 56 (56) | 3 | 0 / 0 / 0 | 40 | — | 99 | 0 | 0.547 (1.472) |
| still | 2 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | — | 92 | 0 | 0.224 (0.567) |
| still | 3 | 1 (60) | 8 (8) | 2 | 0 / 0 / 0 | — | — | 69 | 0 | 0.277 (0.610) |
| still | 4 | 1 (45) | 16 (16) | 2 | 0 / 0 / 0 | — | — | 69 | 0 | 0.362 (0.987) |
| still | 5 | 1 (30) | 24 (24) | 3 | 0 / 0 / 0 | — | — | 69 | 0 | 0.435 (1.133) |

With the INJURIES on, the door gunners kill a man stood still at four and five stars before a column is near him, so those rows end after one wave or two. A skier going down the piste skis into the columns climbing it, so their first contact comes within seconds of the wave. With SAFE FOR WORK on, no round is in him. The step's cost was measured at the bound as well: at five stars with the waves sent every 8 s, 160 men out add about 0.3 to 0.4 ms to a step on a desktop processor (`previews/wave-cost.mjs`, kept local).

With the vehicles (part 7b), seed 38, 180 s a hunt, INJURIES on:

| Quarry | Stars | Waves (first, s) | Men marched (most at once) | Snowmobiles | Carriers / trucks / tanks | First contact, s | Dead, s | Arrested, s | Stuck | Step, ms (p99) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | 99 | — | 0 | 0.377 (1.223) |
| skier | 3 | 1 (60) | 8 (16) | 2 | 1 / 1 / 0 | 70 | 111 | — | 0 | 0.463 (1.920) |
| skier | 4 | 1 (45) | 16 (24) | 2 | 2 / 2 / 0 | 69 | 70 | — | 0 | 0.450 (1.299) |
| skier | 5 | 1 (30) | 24 (32) | 3 | 1 / 1 / 1 | 40 | 49 | — | 0 | 0.423 (1.174) |
| still | 2 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | 90 | — | 0 | 0.277 (0.651) |
| still | 3 | 1 (60) | 8 (8) | 2 | 1 / 1 / 0 | — | 69 | — | 0 | 0.297 (0.802) |
| still | 4 | 1 (45) | 16 (16) | 2 | 1 / 1 / 0 | — | 52 | — | 0 | 0.329 (1.256) |
| still | 5 | 1 (30) | 24 (24) | 3 | 2 / 1 / 1 | — | 52 | — | 0 | 0.375 (1.255) |

SAFE FOR WORK:

| Quarry | Stars | Waves (first, s) | Men marched (most at once) | Snowmobiles | Carriers / trucks / tanks | First contact, s | Dead, s | Arrested, s | Stuck | Step, ms (p99) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 1 (124) | 8 (28) | 2 | 1 / 1 / 0 | 140 | — | — | 0 | 0.492 (1.849) |
| skier | 3 | 2 (60) | 30 (66) | 2 | 3 / 3 / 0 | 70 | — | 171 | 0 | 0.503 (1.562) |
| skier | 4 | 1 (45) | 16 (32) | 2 | 2 / 2 / 0 | 59 | — | 77 | 0 | 0.429 (1.271) |
| skier | 5 | 1 (30) | 24 (40) | 3 | 2 / 2 / 1 | 40 | — | 69 | 0 | 0.469 (1.544) |
| still | 2 | 0 (—) | 0 (0) | 0 | 0 / 0 / 0 | — | — | 92 | 0 | 0.237 (0.601) |
| still | 3 | 1 (60) | 8 (8) | 2 | 1 / 1 / 0 | — | — | 69 | 0 | 0.267 (0.680) |
| still | 4 | 1 (45) | 16 (16) | 2 | 2 / 2 / 0 | — | — | 69 | 0 | 0.408 (1.222) |
| still | 5 | 1 (30) | 24 (24) | 3 | 2 / 2 / 1 | — | — | 69 | 0 | 0.481 (1.585) |

The vehicles' men put down near him bring the first contact and the end of the hunt sooner on most rows; no vehicle is stuck and, with SAFE FOR WORK on, no round is in him.

The army lab's `waves` sheet (`make army ARGS="--sheet=waves"`) photographs the waves through the game's own renderer at five stars, with the roster's door gunners, squads and lifts held back so the hunt lasts long enough for the columns to come: `wave-climb` (a column climbing a run at him), `wave-mass` (three waves out, the mountain below him soldiers) and `wave-arrest` (SAFE FOR WORK: him taken by a man of a wave, the rest come up round him).

### Not yet

- The men of the waves have no voices, and the column has no sound of its own.

## The waves' vehicles

`engine/game/army-vehicle.ts` brings the carriers, the trucks and the tanks a ground wave's mix names (`groundWave`), and drives them. Their body on the snow and its watchdog are `army-vehicle-body.ts`; the terrain reading they share with the army's snowmobiles is `army-drive.ts` (`chooseWay`, `wayCost`). The numbers are `ARMY_VEHICLE` in `engine/game/defs/army-vehicle.ts`, and the vehicles live in `ArmyState.vehicles`. Nothing draws from any stream: where each is called, how it steers and when it fires are pure functions of the map, the state and its id. So a hunt replays and no digest moves.

**What the real things are.** These are the classes, never a maker's model. The numbers are the band the service vehicles of each class sit in, restated from open references.

- **The tracked carrier.** The northern armies' articulated over-snow carrier is two short units on four wide rubber band tracks: a cab with the engine in front and a troop body behind, joined by a steered hitch. It is about 7 m long, 2 m wide and 2.3 m tall. It does about 50 km/h on a road and half that in deep snow. Its wide tracks press the snow about as lightly as a man on skis, so it climbs steep firm snow. The rear unit carries a section of eight or more.
- **The truck.** A six-wheel-drive cross-country cargo truck with a cab forward, a canvas tilt over the bed and chains on its wheels in winter. It is about 8 m long, 2.5 m wide and 3.4 m to the tilt. On packed snow it holds a grade of about 30 % before the chains spin. Its bed seats two squads.
- **The tank.** A main battle tank: a 7.5–8 m hull, about 3.7 m wide and 2.4–3 m to the turret's roof, 55–65 t. It does 40–50 km/h off a road and climbs a 60 % grade. Its turret goes round in about nine seconds, and it fires its main gun from a short halt, a round every six to ten seconds.
- **In winter** all three are painted white, or washed white over their green in broken patches. That breaks the outline better than solid white does.

**The call.** Each wave of three stars and up names its vehicles. They are called with it, interleaved by kind, no more than `most` out at once (2 at two stars, 4 at three, 8 at four, 12 at five; a wave of two stars names none). Each starts `back` (260) m further down the wave's way up than its column, staggered `stagger` (6) s apart. The trucks come up the village's road out instead (`roadIn`: its exit street from the map's edge inward) and then on up the way.

**The drive.** A vehicle is driven as a body on the snow (`moveVehicle`), not on the snowmobile's physics. Its pace is gathered and shed at its own `accel` and `brake`. A grade slows it in proportion, down to `creep` of its pace at its `climb` limit (0.8 for the carrier, 0.3 for the truck, 0.6 for the tank), and stops it past that. It turns at its own rate: the tracked ones pivot, and the truck is held to its turning radius. Its attitude is read off the snow under its four corners. The carrier's rear unit follows on its hitch: the hitch's heading eases toward the rear unit's own at the pace over its length, held within ±0.6 rad of the front's. Each `decide` (0.25) s the snowmobiles' terrain reading weighs a fan of headings `look` (40) m ahead for rises past its limit, drops, water, trunks, the map's edge and the way it wants to go. It slows in the woods to `woods`.

**Never stuck.** Every `stuck.window` (5) s a vehicle that wanted to move and has not covered `least` (2.5) m is held. The first window it swings off to a side for `detour` (4) s. The second it backs out `dig` (8) m (the `dug` event). The third puts it back on the way at the next point it can stand on (the `stuck` event, which the lab counts and which must stay 0).

**The carrier.** It drives up the way until it is within `drop.carrier` (170) m of him, or `drop.blind` (110) m where he cannot see it. There it stops and puts its section of eight down out of its back, a man every `drop.every` (0.45) s, each straight into the chase (`VEHICLE_SQUAD` + its id). Then it parks.

**The truck.** It stops further off, at `drop.truck` (320) m, or sooner where the climb is too steep for it or it has been held. It puts its twelve down, and they form a column of the wave's and climb on from there.

**The tank.** It climbs at him and, once its crew sees him within `tank.range` (900) m, halts (`halt`). It lays its turret at `traverse` (0.7 rad/s) and its gun (−0.16 to +0.35 rad), fires `shots` (2) rounds through the gunfire layer (`WEAPONS.tankGun`, `armGun`, `fireAt`), and goes on. It halts again no sooner than `hold` (14) s later. The shell bursts through the BLAST LAYER (`blast.ts`' `blastAt`, below). With the INJURIES on, a tank within `ram` (45) m of him drives straight at him, and its front meeting him at more than `strike.closing` (2.5) m/s throws him (`armour`). Once he is down, `gore.ts`' `runOver` takes the tank over him as it takes a piste machine.

**The blast layer.** A burst goes off through `blastAt(state, stream, def, x, y, z, weapon, key, events)` in `engine/game/blast.ts`, whatever fired it. It raises the event, damages every machine within reach, and with the INJURIES on throws him, fragments him and tears him apart close in. The weapon's `BlastDef` also names its CRATER (a tank shell's 1.8 m across and 0.55 m deep), which the app presses into the snow. The tank's shell is its first caller beside the rocket, and later weapons call it the same way ([`gunfire.md`](gunfire.md)).

**Safe for work.** They never wound him. The tank's gun is laid on the snow `warn.near` to `warn.far` (55–85) m to a side of him, never at him. It never drives at him, and no front of theirs throws him. Their men arrest him as every soldier does.

**Home.** With the hunt over, each vehicle drives back down its way and is taken off the map once it is `home` (450) m from him or after `leave` (90) s. A vehicle more than `behind` (1,300) m from where he was last seen is taken off as well.

**Events.** `army-vehicle`, by `change`: `called`, `out`, `drop`, `halt`, `fire`, `dug`, `stuck`, `strike`, `gone`, with the vehicle's kind and place. The strike is heard as the steel's crash. The gun and its burst are the gunfire's events.

### As drawn and heard

The vehicles are BUILT IN CODE (`army-vehicle-shapes.ts`) off the engine's own plan of each: its half length and width, its height, the carrier's hitch, the tank's turret ring and muzzle. They are low-poly and painted face by face in their camouflage, and every vehicle of a kind shares one geometry:

- **The carrier:** two boxy units on black rubber tracks with rounded ends. The front unit is a cab with a sloped nose, a deep windscreen and side windows; the rear is a taller box with small windows, a door at the back and a covered load on its roof. It is white with broken olive and washed patches.
- **The truck:** a flat-fronted cab with a two-pane windscreen, mirrors and a bumper, six big tyres, and a long bed under an arched white tilt. It is olive with a white wash daubed over it.
- **The tank:** a long low hull with side skirts over its road wheels and a steep glacis. Its turret is wide and flat with a wedge front, a stowage basket at the back, a commander's cupola and a loader's hatch, and a long gun with a sleeve. It is white with large grey and dark-grey patches.

`army-vehicle-view.ts` (held by `army-air-view.ts`) stands each one where the engine has it, leaned to the ground's attitude. It draws the carrier's rear unit on its own heading behind the hitch (`rearOf`), and the tank's turret and gun as the engine lays them. The gun runs back as it fires and runs out again, and a commander rides up in the hatch. The tracks and the tyres press their prints into the trail map, the tracks throw a little snow off their backs, and the main gun's blast kicks the snow up round the tank. The shell's burst is the gunfire's: the game's explosion, bigger, and its crater pressed into the snow.

They are heard by their own diesel (`audio/army-vehicle-voice.ts`, steered by `audio/army-bed.ts` for the nearest four): the block's firing note (a six's for the carrier and the truck, a twelve's for the tank), the injection's knock, the bass, the turbo's whistle, and, on the tracked ones, the track's clatter at the links' passing rate and its squeal (on the truck, its chains' rumble instead). The tank's gun is the gunfire bank's `tank_gun`, and its burst the explosion's. `make audition` has a panel for one vehicle. Its `--meter` rows are below, beside a skier cruising the piste and the snowmobile for scale: a tank grinding past at 20 m is louder than the skier's own snow, and one 400 m off is a murmur under it.

| Preset | Mean | Peak |
| --- | --- | --- |
| cruising the piste | -42.9 dBFS | -42.5 dBFS |
| on the sled, idling | -31.9 dBFS | -27.9 dBFS |
| left idling, 60 m off | -56.6 dBFS | -51.9 dBFS |
| tank idling, 25 m off | -39.1 dBFS | -36.0 dBFS |
| tank climbing past, 20 m | -32.6 dBFS | -29.8 dBFS |
| tank climbing, 400 m off | -61.1 dBFS | -57.7 dBFS |
| carrier at cruise, 30 m | -39.9 dBFS | -38.0 dBFS |
| truck on chains, 30 m | -42.9 dBFS | -38.9 dBFS |
| tank_gun (the bank, peak) | — | -19.6 dBFS |

### The labs

`make army-ground ARGS="--table=vehicles"` gives, for each star and quarry: the vehicles out of each kind and the most at once, when the first set off, the men they put down, when a man of theirs first stopped to fire at him, the tank's shells and when the first was fired, the shells that threw him, the vehicles dug out and STUCK (always 0), and the step's cost. `--waves` holds back the roster's door gunners, squads, lifts and snowmobiles, so the hunt lasts long enough for the waves to come; with the INJURIES on the door gunners otherwise kill a man stood still before the first vehicle is near. The waves table's carriers / trucks / tanks column now counts them.

Its columns are the vehicles of each kind (and the most out at once), when the first set off, the men they put down, their first contact, the shells (and when the first was fired), the shells that threw him, his death or arrest, the vehicles dug out and stuck, and the step's cost. A hunt raised to two stars climbs to three as he survives, so its rows bring vehicles too, late.

On seed 38, 180 s a hunt, `--waves`, INJURIES on:

| Quarry | Stars | Carriers / trucks / tanks (most at once) | First out, s | Men put down | Their first contact, s | Shells (first, s) | In him | Dead, s | Arrested, s | Dug out | Stuck | Step, ms (p99) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 1 / 1 / 0 (2) | 123 | 20 | 144 | 0 (—) | 0 | — | — | 0 | 0 | 0.292 (1.158) |
| skier | 3 | 1 / 1 / 0 (2) | 60 | 8 | 75 | 0 (—) | 0 | 115 | — | 0 | 0 | 0.267 (0.933) |
| skier | 4 | 2 / 2 / 0 (4) | 45 | 8 | 62 | 0 (—) | 0 | 68 | — | 0 | 0 | 0.253 (0.683) |
| skier | 5 | 5 / 5 / 2 (12) | 30 | 24 | 43 | 2 (43) | 0 | 117 | — | 0 | 0 | 0.468 (1.463) |
| still | 2 | 1 / 1 / 0 (2) | 124 | 0 | — | 0 (—) | 0 | — | — | 0 | 0 | 0.249 (0.955) |
| still | 3 | 3 / 3 / 0 (6) | 60 | 20 | 152 | 0 (—) | 0 | 163 | — | 1 | 0 | 0.365 (1.304) |
| still | 4 | 5 / 5 / 1 (11) | 45 | 40 | 137 | 0 (—) | 0 | 149 | — | 2 | 0 | 0.469 (1.793) |
| still | 5 | 5 / 5 / 2 (12) | 30 | 32 | 122 | 8 (76) | 0 | 134 | — | 0 | 0 | 0.480 (1.520) |

SAFE FOR WORK:

| Quarry | Stars | Carriers / trucks / tanks (most at once) | First out, s | Men put down | Their first contact, s | Shells (first, s) | In him | Dead, s | Arrested, s | Dug out | Stuck | Step, ms (p99) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 2 | 1 / 1 / 0 (2) | 123 | 20 | 144 | 0 (—) | 0 | — | — | 0 | 0 | 0.269 (0.954) |
| skier | 3 | 3 / 3 / 0 (6) | 60 | 47 | 75 | 0 (—) | 0 | — | — | 1 | 0 | 0.341 (1.418) |
| skier | 4 | 2 / 2 / 0 (4) | 45 | 16 | 62 | 0 (—) | 0 | — | 91 | 0 | 0 | 0.261 (0.966) |
| skier | 5 | 2 / 2 / 1 (5) | 30 | 16 | 43 | 3 (42) | 0 | — | 68 | 0 | 0 | 0.312 (1.004) |
| still | 2 | 1 / 1 / 0 (2) | 124 | 0 | — | 0 (—) | 0 | — | — | 0 | 0 | 0.190 (0.687) |
| still | 3 | 3 / 3 / 0 (6) | 60 | 20 | 151 | 0 (—) | 0 | — | 171 | 1 | 0 | 0.324 (1.269) |
| still | 4 | 6 / 5 / 1 (12) | 45 | 40 | 136 | 0 (—) | 0 | — | 157 | 2 | 0 | 0.525 (1.948) |
| still | 5 | 5 / 5 / 2 (12) | 30 | 32 | 128 | 11 (76) | 0 | — | 138 | 0 | 0 | 0.478 (1.538) |

No vehicle is ever stuck. A man stood still in the woods is out of every crew's sight, so the tanks fire on him only when the hunt's men see him and radio it (the five-star rows' shells). With SAFE FOR WORK on no shell lands within 54 m of him and none is in him. With twelve vehicles out at five stars a whole engine step stays under half a millisecond on average (about 1.5 ms at its 99th percentile) on the machine these tables were cut on.

The army lab's `vehicles` sheet (`make army ARGS="--sheet=vehicles"`) photographs them through the game's own renderer: `vehicle-stand` (a tank, a carrier and a truck stood on the piste below him, and round each), `vehicle-wave` (a wave's vehicles climbing at him) and `vehicle-fire` (a tank halted and firing, and the shell's burst).

### Not yet

- Stealing one: a parked carrier or a halted tank taken with the machine press through `steal.ts`, with its heat.
- Their crews never get out and fight; a vehicle's men are only its passengers.
- A rocket's or a shell's burst within a few metres knocks one out ([paramotors and balloons](#paramotors-and-balloons)); nothing else does yet.

## Paramotors and balloons

`engine/game/army-air.ts` calls and steps the army's air beside its helicopters: riflemen flying the game's own paramotor (`army-para.ts`) and army hot-air balloons with rocketeers in the basket (`army-balloon.ts`). A rocket's burst among the army's own is `army-burst.ts`. The numbers are `ARMY_AIR` in `engine/game/defs/army-air.ts`, and the state is `ArmyState.air` (`army-air-state.ts`), created the first time a hunt calls one. Nothing draws from any stream: every choice is a pure function of the map, the state and the craft's id, so a hunt replays and no digest moves.

**What the real things are.** Armies have flown foot-launched powered paragliders for some years, to put a man over ground no vehicle can cross. It is a paraglider wing over a harness with a small two-stroke and a caged propeller on the pilot's back. It flies at about 15 m/s hands up, a few more on the speed bar, and a pilot will not fly it in a wind of much more than two thirds of that. No army flies hot-air balloons in a fight. The game's are a stand-in for an observation balloon, with the service's low-visibility paint.

**The call.** The roster names them from four stars (`rosterOf`: two paramotors and a balloon with two rocketeers at four stars; four paramotors and two balloons with four rocketeers between them at five), and `airWanted` adds one more of each for every `grow.every` (75) s he has held his star, up to `grow.paramotors` (6) and `grow.balloons` (3) at once. None is flown in a wind past its limit at 10 m over him (`para.most` 9 m/s, `balloon.most` 7.5 m/s): the roster's paramotors and balloons then stay on the ground. The first paramotor is out `para.respond` (20) s after the roster asks and the rest `para.stagger` (6) s apart. Each is launched off a road or a ridge on its bearing toward him, inside the map's edge but no further than `para.near` (750) m from him, `para.enter` (90) m over the snow and at least the orbit's height over him. A balloon is let go `balloon.respond` (30) s after the ask and the rest `stagger` (25) s apart, `upwind` (600) m upwind of him, already flying.

**The paramotor's flight** is the free ride's paramotor on the canopy's maths (`canopy.ts`: `lineDir`, `wayOf`, `liftDrag`, `swingDamp`, `pullLines`) and its own numbers (`PARA`): the wing a point mass flying by its polar on its lines, the turn a side force toward the toggle pulled and the canopy righting itself as it banks, the engine's thrust falling with the air through the propeller, and the speed bar trimming the wing faster. The pilot is a soldier with his kit and the motor (`ARMY_GROUND.mass` + `PARA.motorMass`) and a seated man's drag (`para.drag`, 0.6 m²).

**The pilot's hands.** He circles him at `orbit.radius` (150) m and `orbit.height` (60) m over him. He flies a GROUND VELOCITY, not a heading: round the circle at `orbit.speed` (15) m/s, closing on its radius, carried along at his quarry's own velocity, and straight in at `orbit.dash` (19) m/s from further out than `orbit.far` (1.8) radii. The heading through the air that sums with the wind to that is the crab a pilot reads off his drift. The toggles follow it, damped against the turn already going and never past `hands.most` (0.35): a steady turn, never a spiral. More than `hands.under` (20) m under the height he wants, he turns no harder than `hands.climbing` (0.15), because a wing banked hard sinks. The speed bar goes out when the track needs more than the trim. The throttle holds the height. Out of sight, he circles where his quarry was last seen, `search.wider` (1.6) times wider and `search.height` (90) m over it.

**Clear of everything.** Every `READ` (0.5) s the height he holds is lifted over the highest the circle, the next `clear.look` (6) s of his way and the first `clear.toward` (400) m of the way to the circle must clear (a ridge between them is climbed before it is reached): the snow by `clear.snow` (40) m, a crown by `clear.crowns` (22) m and a lift's rope by `clear.rope` (25) m. Under `clear.floor` (18) m over the snow the throttle goes to full. With the snow or a crown at three, six or nine seconds ahead higher than he will have climbed to, he turns down the fall line, as steeply as `hands.escape` (0.6) of the toggle lets him, spending height to come round in time. Near the stall (`hands.stallMargin`, 0.04 rad short of it) he lets the toggles up, pushes the bar out and holds the throttle at trim, and a stalled wing surges forward and refills as the free ride's does. Two paramotors push off each other's tracks inside `separate` (70) m, and both keep `heli` (60) m off an army helicopter's disc. A paramotor flown into the snow or a crown is a fault the labs count (`parasLost`, the `crash` event), and it must stay at 0.

**Going home.** Once the hunt is over (he is arrested, dead or got away), or the roster asks for fewer than are up, the paramotors leave. Each picks, among `leave.ways` (12) bearings, the one whose snow over the next `leave.look` (400) m is lowest, keeps it unless another is `leave.keep` (25) m lower, climbs to `leave.height` (120) m over the snow and is gone `leave.past` (80) m past the map's edge.

**The rifle.** He fires a burst at a time through the gunfire layer (`WEAPONS.rifle`), within `fire.range` (340) m of him with him in sight, `fire.every` (3.5) s apart at the least, under the wanted level's rules of fire.

**The balloon** is the free ride's balloon (`flyBalloon`, its pilot's hands `balloonHands`) with its crew's weight in the basket (`BalloonState.crew`). It drifts with the up-valley wind, which veers with height. Every `height.pick` (6) s its pilot reads `height.layers` (6) heights between `height.low` (90) and `height.high` (260) m over the snow for the one whose drift carries it closest to him, and holds it on the burner. It never goes under `height.floor` (45) m over the snow or `height.crowns` (25) m over a crown. Once it has drifted `leave.past` (450) m beyond him downwind, it is out of the fight. It then climbs to `leave.height` (300) m and is taken off at `leave.gone` (1,400) m or the map's edge.

**The rockets.** The rocketeers take turns, a man at a time, `fire.every` (4) s apart across the basket, within `fire.range` (420) m of him once he is in sight. Each rocket is the gunfire layer's (`WEAPONS.rocket`): fired from the rim on the man's side, a visible body flying on its motor with a smoke trail, and its burst going off through the BLAST LAYER (`blastAt`), which throws him with the INJURIES on.

**Brought down.** A skier cannot reach either. A STOLEN HELICOPTER can bring a paramotor down: its disc within `downed.disc` (4) m of the wing, or the wing in its wash within `downed.wash` (1.6) rotor radii across and no more than `downed.under` (25) m under the hub. So can a rocket's burst within `burst.wing` (6) m of the wing or the man. With SAFE FOR WORK on he always rides his reserve down; with the INJURIES on he does if he is more than 60 m up. Under it he sinks at `downed.reserve` (5.5) m/s with the wind. On the snow he is a soldier on foot from then on (`enlist`, his squad `AIR_SQUAD` + his id), and he chases him with the rest. Without a reserve he falls under the cloth and lies `downed.lie` (60) s. Bringing one down raises the heat as a soldier hit does.

**A burst among the army's own.** Whoever fired it, a rocket's or a shell's burst knocks out a carrier, a truck or a tank whose middle is within `burst.vehicle` (5) m: a shoulder rocket's shaped charge through a carrier's or a truck's skin, or down through a tank's thin roof. The vehicle stands there burning (its `wreck` mode, for `ARMY_VEHICLE.wreck`, 90 s), and its men aboard are lost with it. The machines the blast layer already damages (his stolen helicopter among them) take the burst as before.

**Safe for work.** They never wound him. A rifleman's fire is the gunfire layer's warning fire. A rocket is laid on the snow `fire.warn.near` to `fire.warn.far` (35–60) m to a side of him, never at him. The soldiers on the ground arrest him. (A skier who skis toward the warning point can be counted in the labs' "burst near him" column with SAFE FOR WORK on. He is never thrown, because a burst under these rules of fire wounds nobody.)

**Events.** `army-air`, by `change`: `called`, `out`, `fire` (a rifle burst), `rocket`, `downed`, `landed`, `crash` (a fault), `knocked` (a vehicle knocked out by a burst), `gone`, with the craft (`paramotor`, `balloon` or `vehicle`), its id and its place. The rifle, the rocket and the burst are the gunfire's events. The pursuers the HUD and the hunt read are written into `WantedState.pursuers` (`paramotor` 7000 + n, `balloon` 7500 + n).

### As drawn and heard

`army-craft-view.ts` draws each one with the free ride's own drawing, hung off the army's craft instead of the player's. The paramotor is `para-scene.ts` in the army's olive wing (`ARMY_CANOPY_PAINT`: an olive drab base, a grey-green swoosh, dark tips), with a soldier sat in its harness, his rifle in his lap (`doorSit`). Brought down, he comes down under a round olive reserve. The balloon is `balloon-scene.ts` in the army's olive and khaki gores under a pale crown (`ARMY_COLOURWAY`, a palette the maps are never dealt). Its rocketeers stand in the basket, each turned to his aim with the launcher up on his shoulder as he fires, and a man stands at the burner. The rockets, their smoke and their bursts are the gunfire's (`gunfire-view.ts`). A vehicle knocked out burns with the army's explosion (`army-air-view.ts`), its gun drooped.

ALL OF IT IS BUILT AT LOAD on every run whose rules can raise the hunt (the free ride), behind the loading card: a fixed pool of as many as the hunt ever flies (`ARMY_AIR.grow`), shown and hidden. The gunfire's view is built at load there too. Nothing builds a mesh, a material or a light mid-run, and no light is added: the burner's light is a slot of the floods (`headlamp.ts`), as the free ride's balloon's is.

They are heard by `audio/army-air-bed.ts`. Each paramotor is the free ride's single-cylinder two-stroke (`para-bed.ts`' `paraEngine`), the nearest three a rack each, falling off with distance as a snowmobile's engine does. Each balloon's burner, pilot light and vent are the free ride's (`balloon-voice.ts`), the nearest two, silent between burns and a roar overhead as it fires. A rocket's launch is the gunfire bank's `rocket_launch`, and its burst is the explosion's. A vehicle knocked out goes up with the helicopter's crash, lower.

### The labs

`make army-flight ARGS="--table=air"` gives, for each star and quarry: the paramotors and balloons out and the most at once, when the first was out and when one first fired, the rifle bursts and the rockets, the rockets that burst within their throw of him and the times he was thrown, the vehicles knocked out, the paramotors brought down, the craft LOST BY MISTAKE (always 0), the least height of a paramotor over the snow and over a crown, his death or arrest, and the step's cost. The quarries are `skier` (the bot skiing away), `still` (stood where the hunt found him) and `chase` (him in the stolen helicopter, the bot's hands flying it over the nearest paramotor). `--alone` holds back the rest of the roster and the ground waves, so a row shows the air's own.

*seed 38, 150 s a hunt, INJURIES on*

| Quarry | Stars | Paramotors (most at once) | Balloons (most at once) | First in, s | First contact, s | Rifle bursts | Rockets | Burst near him | Thrown | Vehicles knocked out | Brought down | Lost by mistake | Least over snow / crowns, m | Dead, s | Arrested, s | Step, ms (p99) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 3 | 1 (1) | 0 (0) | 105 | 105 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 74.4 / 56.9 | 110 | — | 1.338 (13.224) |
| skier | 4 | 2 (2) | 1 (1) | 20 | 38 | 4 | 2 | 2 | 1 | 0 | 0 | 0 | 49.4 / 32.4 | 48 | — | 1.135 (13.467) |
| skier | 5 | 4 (4) | 1 (1) | 20 | 38 | 2 | 1 | 1 | 0 | 0 | 0 | 0 | 71.7 / 53.3 | 45 | — | 1.191 (11.116) |
| still | 3 | 0 (0) | 0 (0) | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — / — | 69 | — | 0.816 (11.032) |
| still | 4 | 2 (2) | 1 (1) | 20 | 45 | 9 | 1 | 1 | 0 | 0 | 0 | 0 | 38.0 / 20.5 | 63 | — | 0.604 (5.440) |
| still | 5 | 4 (4) | 2 (2) | 20 | 45 | 20 | 3 | 3 | 0 | 0 | 0 | 0 | 22.6 / 4.2 | 70 | — | 0.602 (2.188) |
| chase | 3 | 0 (0) | 0 (0) | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — / — | 34 | — | 0.242 (0.808) |
| chase | 4 | 2 (2) | 1 (1) | 20 | 20 | 6 | 1 | 0 | 0 | 0 | 0 | 0 | 178.2 / 160.5 | 39 | — | 0.295 (1.170) |
| chase | 5 | 4 (4) | 1 (1) | 20 | 20 | 6 | 1 | 0 | 0 | 0 | 0 | 0 | 106.4 / 88.7 | 39 | — | 0.327 (1.180) |

*seed 38, 150 s a hunt, SAFE FOR WORK*

| Quarry | Stars | Paramotors (most at once) | Balloons (most at once) | First in, s | First contact, s | Rifle bursts | Rockets | Burst near him | Thrown | Vehicles knocked out | Brought down | Lost by mistake | Least over snow / crowns, m | Dead, s | Arrested, s | Step, ms (p99) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 3 | 2 (2) | 1 (1) | 105 | 105 | 18 | 7 | 0 | 0 | 0 | 0 | 0 | 34.9 / 18.9 | — | — | 1.811 (17.272) |
| skier | 4 | 2 (2) | 1 (1) | 20 | 38 | 21 | 12 | 0 | 0 | 0 | 0 | 0 | 40.9 / 22.0 | — | 87 | 1.886 (17.132) |
| skier | 5 | 4 (4) | 2 (2) | 20 | 38 | 16 | 7 | 0 | 0 | 0 | 0 | 0 | 40.9 / 22.0 | — | 68 | 1.185 (11.292) |
| still | 3 | 0 (0) | 0 (0) | — | — | 0 | 0 | 0 | 0 | 0 | 0 | 0 | — / — | — | 69 | 0.307 (1.165) |
| still | 4 | 2 (2) | 1 (1) | 20 | 45 | 13 | 3 | 0 | 0 | 0 | 0 | 0 | 23.4 / 6.5 | — | 70 | 0.447 (1.300) |
| still | 5 | 4 (4) | 2 (2) | 20 | 45 | 19 | 3 | 0 | 0 | 0 | 0 | 0 | 23.6 / 6.6 | — | 70 | 0.682 (1.927) |
| chase | 3 | 2 (2) | 1 (1) | 100 | 100 | 21 | 9 | 0 | 0 | 0 | 0 | 0 | 178.4 / 160.6 | — | — | 0.516 (2.258) |
| chase | 4 | 4 (4) | 2 (2) | 20 | 20 | 57 | 29 | 0 | 0 | 0 | 0 | 0 | 154.9 / 137.3 | — | — | 0.842 (3.588) |
| chase | 5 | 5 (5) | 3 (3) | 20 | 20 | 101 | 36 | 0 | 0 | 0 | 0 | 0 | 154.9 / 137.3 | — | — | 0.859 (2.825) |

*seed 38, 150 s a hunt, INJURIES on, the air alone*

| Quarry | Stars | Paramotors (most at once) | Balloons (most at once) | First in, s | First contact, s | Rifle bursts | Rockets | Burst near him | Thrown | Vehicles knocked out | Brought down | Lost by mistake | Least over snow / crowns, m | Dead, s | Arrested, s | Step, ms (p99) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 4 | 2 (2) | 1 (1) | 20 | 38 | 12 | 6 | 5 | 1 | 0 | 0 | 0 | 31.0 / 12.4 | 64 | — | 0.906 (11.078) |
| skier | 5 | 4 (4) | 2 (2) | 20 | 38 | 13 | 6 | 5 | 1 | 0 | 0 | 0 | 31.0 / 12.4 | 64 | — | 0.796 (9.074) |
| still | 4 | 2 (2) | 1 (1) | 20 | 45 | 14 | 3 | 3 | 0 | 0 | 0 | 0 | 25.0 / 7.9 | 71 | — | 0.990 (12.831) |
| still | 5 | 4 (4) | 2 (2) | 20 | 45 | 11 | 1 | 1 | 0 | 0 | 0 | 0 | 38.1 / 21.0 | 63 | — | 0.931 (9.276) |
| chase | 4 | 2 (2) | 1 (1) | 20 | 20 | 25 | 13 | 0 | 0 | 0 | 0 | 0 | 178.2 / 160.5 | 88 | — | 0.704 (10.353) |
| chase | 5 | 4 (4) | 2 (2) | 20 | 20 | 30 | 14 | 0 | 0 | 0 | 0 | 0 | 178.2 / 160.5 | 76 | — | 0.439 (5.376) |

*seed 38, 150 s a hunt, SAFE FOR WORK, the air alone*

| Quarry | Stars | Paramotors (most at once) | Balloons (most at once) | First in, s | First contact, s | Rifle bursts | Rockets | Burst near him | Thrown | Vehicles knocked out | Brought down | Lost by mistake | Least over snow / crowns, m | Dead, s | Arrested, s | Step, ms (p99) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| skier | 4 | 4 (4) | 2 (2) | 20 | 38 | 63 | 20 | 0 | 0 | 0 | 0 | 0 | 39.0 / 22.0 | — | — | 0.909 (10.179) |
| skier | 5 | 5 (5) | 3 (3) | 20 | 38 | 111 | 40 | 0 | 0 | 0 | 0 | 0 | 33.4 / 15.6 | — | — | 0.872 (10.490) |
| still | 4 | 4 (4) | 2 (2) | 20 | 45 | 49 | 25 | 0 | 0 | 0 | 0 | 0 | 25.3 / 8.2 | — | — | 1.243 (13.130) |
| still | 5 | 5 (5) | 3 (3) | 20 | 45 | 90 | 40 | 0 | 0 | 0 | 0 | 0 | 22.1 / 5.5 | — | — | 1.165 (12.392) |
| chase | 4 | 4 (4) | 2 (2) | 20 | 20 | 57 | 29 | 0 | 0 | 0 | 0 | 0 | 154.9 / 137.3 | — | — | 0.367 (5.673) |
| chase | 5 | 5 (5) | 3 (3) | 20 | 20 | 101 | 36 | 0 | 0 | 0 | 0 | 0 | 154.9 / 137.3 | — | — | 0.356 (4.762) |

The army lab's `air` sheet (`make army ARGS="--sheet=air"`) photographs them through the game's own renderer: `air-para` (the riflemen circling him), `air-balloon` (a balloon in on the wind, its rocketeers in the basket), `air-rocket` (a rocket off a basket in flight, its smoke trail and its burst) and `air-wreck` (a carrier knocked out by a burst, burning).

### Not yet

- The bot's stolen-helicopter hands cannot catch a paramotor that circles him: the orbit is centred on the helicopter and moves with it. A player can. The `chase` rows' "brought down" column stays 0, and `tests/army_air_test.ts` holds the wash bringing one down.
- A balloon cannot be brought down by him, and it never burns in a fight.
- The paramotor's rifleman fires from his lap; he is not posed to his aim.
