# The army

The army that hunts a wanted skier ([`wanted.md`](wanted.md)) needs a machine to come in and people to fire its guns ([`gunfire.md`](gunfire.md)). **This page is how they look and how its helicopters fly.** It covers the military helicopter, the winter infantry on skis and on foot, the door gunner and the anti-armour man, and what each is drawn from and why. Then it covers the helicopters [in flight](#in-flight): called in, hunting him and firing.

The helicopters fly in the game. The soldiers are drawn, but nothing sets them down yet: the parts that send the section out build on the view classes, the places on the machine and the soldiers' poses here.

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
| The labs | `make army` (`scripts/army-preview.mjs`, `pwa/src/tools/army-harness.ts`, `pwa/army-preview.html`), `make army-flight` (`scripts/army-flight.mjs`) |
| The tests | `tests/army_heli_test.ts`, `tests/soldier_test.ts`, `tests/army_test.ts`, `tests/models_test.ts`, `tests/model_registry_test.ts` |

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

Ski troops move on long, wide, plain white touring skis with a cable binding and carry their rifle slung. The weapons stay dark: a 5.56 mm-class assault rifle under a metre long and, for the section's anti-armour man, a disposable launcher tube about a metre long and under a decimetre across.

**Drawn in code, like the crowd.** The soldiers are built on the crowd's bench and rig (`crowd-shapes.ts`' `Figure`, `crowd-rig.ts`'s `Posed`), so they are chunky, faceted and low-poly. From forty metres the silhouette and the colour are what read: a white figure with a helmet, a big pack and a black rifle. The figure is built for that:

- The cloth (smock, trousers, sleeves) is white. In the `camo` smock, the blotches are laid triangle by triangle, read where each triangle sits at the rest pose, so a blotch stays on its cloth through every pose.
- The webbing is off-white and the helmet cover white.
- The goggles are dark, and the boots and weapons are the only other dark things on him.
- The ski tops are white and their edges grey, so the skis still read on the snow.

There are four figures (`SoldierKind`), each at three cuts (`CrowdLod`: about 500, 440 and 160 triangles). Every pose of a figure is a morph target, so one draw call can hold a whole squad. A pose no morph target holds can be set outright on the same mesh with `poseSoldierFigure` or `SoldierView.posed`. The gunner at an arbitrary aim is drawn this way.

| Figure | Carries | Poses (the first its rest) |
| --- | --- | --- |
| `skier` | rifle slung over the pack, poles | `ski`, `tuck`, `lean`, `leanLeft`, `pole`, `skiAim` (stood on his skis aiming, the poles planted beside him) |
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

- The machines do not land, and nothing comes down the rope: the section on the ground is the next part's.
- They cannot be shot down; a ram is the one way to bring one down.
- The woods do not hide him from them.
