# The army, as drawn

The army that hunts a wanted skier ([`wanted.md`](wanted.md)) needs a machine to come in and people to fire its guns ([`gunfire.md`](gunfire.md)). **This page is how they look.** It covers the military helicopter, the winter infantry on skis and on foot, the door gunner and the anti-armour man. It says what each is drawn from and why.

Nothing in the game spawns any of them yet. The parts that fly the machine and send its section out build on what is here: the view classes, the places on the machine, and the soldiers' poses.

| Piece | Where |
| --- | --- |
| The machine's numbers and the places on it | `engine/game/defs/army-heli.ts` (`ARMY_HELI`) |
| The machine as modelled | `scripts/blender/army.py` (`make models KIND=army`), committed as `pwa/models/army.glb` |
| The places, side by side (doors, guns, seats, ropes, lights) | `pwa/src/game/army-heli-plan.ts` |
| The machine as drawn | `pwa/src/game/army-heli-view.ts` (`createArmyHeliView`) |
| The soldiers' kit (colours, rifle, launcher, skis, camouflage) | `pwa/src/game/soldier-kit.ts` |
| The soldiers' poses | `pwa/src/game/soldier-pose.ts` |
| The soldiers as built and drawn | `pwa/src/game/soldier-shapes.ts` (`buildSoldierFigure`, `SoldierView`) |
| The lab | `make army` (`scripts/army-preview.mjs`, `pwa/src/tools/army-harness.ts`, `pwa/army-preview.html`) |
| The tests | `tests/army_heli_test.ts`, `tests/soldier_test.ts`, `tests/models_test.ts`, `tests/model_registry_test.ts` |

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
| `soldiers` | `ski`, `foot`, `rocket` (every pose from the front, the side and behind at the chase camera's range), `gunner` (sat at his gun at each aim), `lods` (the three cuts) |

Pass `--poses=aim,kneel` to shoot a few poses and `--smock=whites` for plain whites. Each sheet is `previews/army-<view>.png`, and every frame is also written alone.
