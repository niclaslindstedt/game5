# The piste machines

A free ride after dark has the ski area's night shift out on it. Up to two big tracked snow groomers work its runs, one to a run. Which runs they work is dealt as the ride starts. Each machine works its run in lanes: down one lane with the tiller laying fresh corduroy behind it, a pivot on its tracks at the bottom onto the next lane, up that one, a pivot at the top, and so across the run and back. Behind the tiller the snow is milled, pressed and combed. Ahead of the blade lies the day's skied-up piste. When the ride starts, each machine has already done a part of its night's work. The machines are big and lit up like a stage: a bar of LED work lamps across the roof, a pair on the nose, a pair on the A-pillars, a pair on the blade's arms, a bar on the back of the roof over the tiller, and an amber beacon turning on top.

A skier can **take one**. He stops beside its cab and presses **Enter** (a double tap on either thumb on touch, or the HUD's call tapped, or the machine itself clicked). He is up in the cab and drives it:

- the tuck drives it forward, the back key puts it in reverse;
- the edge pivots it on its tracks;
- it goes up the run, down it, or anywhere, and the tiller lays corduroy wherever it goes forward.

**Enter** again lets him down onto his skis beside the cab. The machine stands where he left it, engine running and lamps lit, and can be taken again.

**Skiing into one** is twelve tonnes of steel. A skier who closes on it faster than a shuffle is knocked down. That is the `groomer` crash cause (the news reads BONK! PISTE MACHINE). His body takes a hard blow across the trunk, the head and the limbs, read on the HUD's anatomy plate as the injuries any other blow leaves. Nothing is drawn but the fall, and a reset mends it. Leaned on gently, the machine only holds him off, like a wall.

It is reached two ways:

- **A free ride after dark.** The machines are out whenever the sun is under 2° at the map's hour (`GROOMER.night`, `groomersOut`). The start card's HOUR row is how a ride gets there.
- **A link.** `?start=free&groomer=1` puts them out whatever the hour, and `0` keeps them in (`url-params.ts`).

They are a free ride's alone (`RunRules.groomer`): no race, trial or trick run ever has them.

## Where it lives

| Piece | File |
| --- | --- |
| Every number: the class's measures, the pace, the lanes, the press, the strike | `engine/game/defs/groomer.ts` (`GROOMER`) |
| Out or not, dealt to its runs, the lanes worked, the pivots, taken and driven, let down, skied into | `engine/game/groomer.ts` (`groomersOut`, `freshGroomers`, `stepGroomers`, `groomerWithin`, `groomerStrike`, `seatOf`) |
| The snow it grooms, as the physics reads it | `engine/game/groomed.ts` (`groomSegment`, `groomedFresh`), read through `snow.ts`'s `packedSnow` |
| The state and its events | `GroomerState`, `GroomedSnow`, `GroomerEvent` in `engine/game/groomer-state.ts`; `RunRules.groomer`, `GameState.groomers` / `.groomed`, `CreateGameOptions.groomer` |
| The blow on the body | `engine/game/body.ts` (the `groomer` cause), `defs/crash.ts` (how he goes over) |
| The machine as drawn: the belts, the cab, the blade, the tiller, the lamps and the beacon | `pwa/src/game/groomer-view.ts` (built in code off `GROOMER`) |
| The swath stamped as corduroy, the belts' prints, the tiller's mist, the lamps dealt to the slots | `pwa/src/game/groomer-scene.ts`, held with the helicopter and the snowmobile by `machines.ts` |
| The corduroy and the skied-up piste as drawn | `pwa/src/game/trail-map.ts` (the groom pass: the swath wiped smooth, the comb's axis kept), `snow-glsl.ts` (`snowGroomed`, `snowWorked`) |
| The lamps' light on the snow, the woods and the falling snow | `pwa/src/game/headlamp.ts` (`Flood`: a colour, a beam and a power of its own), `haze.ts`'s lamp slots |
| The camera while he drives one: the ladder framed off the machine | `pwa/src/game/camera-groomer.ts` (`GROOMER_RIGS`, `groomerRigPose`) |
| The lens kept out of it | `pwa/src/game/camera-clear.ts` (`movers`) |
| The HUD's call and its readout | `pwa/src/game/hud-groomer.tsx`, `snapshot.ts`'s `groomerOf`, `strings-groomer.ts` |
| The sound | `pwa/src/game/audio/route.ts` (the snowmobile's board, hop and crash) |
| The lab | `make groomer`: `scripts/groomer-preview.mjs` over `pwa/src/tools/groomer-harness.ts` and `groomer-scenes.ts` |

## The machine

The class is the largest size of piste machine a ski area runs. Its measures are taken across the current machines of that size; no make is named:

- a rubber-belted crawler some 8.9 m long with its blade and tiller on, 4.2 m wide over two tracks 1.65 m across;
- the cab's roof 2.9–3.3 m over the snow;
- 10.8–13.2 t ready to work (12 t here);
- a twelve-way blade 5.25 m wide open and some 1.2 m tall;
- a tiller 5.5–6.2 m wide with its finisher flaps out (5.5 m here), the comb laying the corduroy behind it;
- a six-cylinder diesel of some 340 kW;
- grooming at 10–15 km/h (12 km/h down a run, 9 km/h up one), and travelling at about 22 km/h at most.

## The work

As the ride starts, `freshGroomers` takes the resort's runs (`crowd.ts`'s `crowdNet`) at least `GROOMER.shortest` (250 m) long and deals each machine its own run. The deal is drawn off a stream of the machines' own (`GROOMER_SALT`), never `state.rng`. The run's width is cut into lanes one swath wide (5.2 m, each overlapping the last by 0.6 m), and each machine is dealt:

- the lane it starts on, at the top;
- which way across the run it works;
- how much of the night it has done: from a quarter of a pass to `doneLanes` (three) lanes and most of the next.

That night's work so far is worked out on the spot, at a quarter of a second a step, and its swath is laid. From then on every machine is stepped with the run:

- forward along its lane at the working pace;
- turned to the snow under it (pitched along its tracks' run and rolled across them);
- a swath segment laid behind the tiller every 2 m while the tiller is down;
- at a lane's end (`margin`, 18 m inside each end of the run), a pivot on its tracks round onto the next lane — the tiller up, the heading eased round half a turn while it moves across.

The lanes ping-pong across the run and back.

## The groomed snow

Every swath segment does two things:

- **The physics.** The 2 m cells whose middles the tiller covered are marked groomed (`groomed.ts`), each with the new snow there was when it was groomed. `packedSnow` reads a groomed cell as packed through, under only the snow that has fallen since. Anywhere else it is the map's own packed field under the whole fall, exactly as a ride with no machines reads it. On a snowing night the swath is firm groomer while the rest of the piste goes soft under the fall.
- **The picture.** The renderer stamps the swath into the trail map as a GROOM stamp (`Stamp.groom`). It wipes every furrow under it flat, sets the groomed channel to fresh and keeps the comb's axis. The snow shader draws crisp, unworn corduroy along that axis. The rest of a worked piste is drawn skied-up: scraped swells where the turns shoved the snow, heaps pushed up between them and the scratches of a thousand edges (`snowWorked`). The fresh mark fades as new snow falls on it (`FRESH_LOOK`), the corduroy fading with it.

The rest of the runs are the day the ride is stood up in (`piste-day.ts`, `docs/riding.md`'s *The piste through the day*): the night's work is why the first chair rides whole corduroy, and from then the day skis it up, a snowing sky lays new snow on it and a spring sun slushes it and lets it freeze. A swath the machines lay on the ride is none of that — groomed now, under only the snow that has fallen since.

The belts press their prints ahead of the tiller, and the tiller throws a thin mist of fine snow off its back that hangs in the rear lamps' light.

## Taken, and driven

`groomerWithin` is the one question the press and the HUD's call both ask. It finds the nearest machine within `board.reach` (3 m) of its footprint that the skier meets slower than `board.fastest` (4 m/s).

- **Taken.** The press puts him in its cab (the `board` event). While he drives it, the run's step is the machine's, as on the snowmobile.
- **Driven.**
  - The tuck drives it forward up to 22 km/h; the back key reverses it at up to 10 km/h. Speed is gathered at 0.9 m/s².
  - The edge pivots it at up to 0.42 rad/s, moving or standing.
  - Driven into a trunk, it is stopped against it.
  - The tiller is down and the corduroy laid whenever it goes forward.
- **The skier.** He sits at `seat`, hidden in the cab. The camera ladder is framed off the machine on rows of its own (`camera-groomer.ts`):
  - TIPS on the blade;
  - HELMET at the driver's eye;
  - CHASE, FAR and HIGH booms behind it;
  - ORBIT round it.
- **Let down.** The press again sets him down on his skis beside the cab, to its left, with its way (the `hop` event). The machine is left `parked`.

## Skied into

`groomerStrike` is asked after the skier's own step, beside the chairs' strike. A skier on his skis inside a machine's footprint is put back out through its nearest face.

- **Closing at `strike.push` (2.5 m/s) or slower**, he is only held off it, as off a wall.
- **Closing faster**, he is knocked down: the `strike` event, then the `groomer` crash cause, thrown back off it at `bounce` (0.35) of the closing speed. `body.ts` lands a blow:
  - at the closing speed, but at least `strike.least` (8 m/s), times `strike.hard` (1.3);
  - against the blade's 15 mm of give;
  - on the chest, the abdomen, the pelvis, the head and neck, both shoulders, arms, thighs, knees and shins;
  - each blow capped at three of an ordinary blow.

A run into a parked machine at 47 km/h leaves an injury severity score of about 50. Nothing is drawn but the fall and the plate's broken bones. The reset mends him as it mends any other fall.

## Deterministic

The machines draw only at creation, off their own stream. They are created only when the app asks for them, on a free ride. A run without them never comes into `groomer.ts`, and `packedSnow` with no groomed grid is `packedUnder` over the map's own field. So no digest moves: a free ride, a race or a measurement without the machines is the run it always was.

## The lab

`make groomer` photographs the machines through the game's own renderer, a contact sheet a group under `previews/groomer-<group>.png`:

| Sheet | What it shows |
| --- | --- |
| `figure` | The turntable from eight sides with the skier beside it for size, and close-ups of the blade, the cab, the tracks, the tiller and the roof bar. |
| `day` | At work by day and at dusk: ahead of the blade, the quarter, behind over the swath, high over the run, and along the swath's edge. |
| `night` | The same after dark with every lamp lit, low, wide and close, and from the skier's chase. |
| `snow` | The same in a snowfall and in a storm. |
| `groom` | The corduroy behind it from the skier's own chase, far and high rungs. |
| `ride` | Beside it, taken, driven on its own ladder, turning, and let down again. |
| `strike` | Skied into, frame by frame from a planted lens, and the death cam. |

Pick sheets with `ARGS="--sheet=night,snow"`, views with `--views=turntable`, and a map with `SEED=12`.
