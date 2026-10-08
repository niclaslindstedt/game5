# The hot air balloon

A free ride can start in the basket of a hot air balloon. Pick **BALLOON** on the start card's RUN row (after PARAMOTOR, before SNOWMOBILE), or follow a `?start=free&balloon=1` link. You start standing in the wicker basket on the valley floor, the envelope inflated over you and held down by its tether. Burn until it is light and the tether lets go; the day's wind carries you up the mountain. Land it softly and step out, or jump over the side.

The engine side is `engine/game/balloon.ts` (the flight), `balloon-air.ts` (the air it flies in), `balloon-state.ts` (its state and events), `balloon-pilot.ts` (the bot's hands) and `defs/balloon.ts` (every number). The app side today is `pwa/src/game/balloon-scene.ts` (a stand-in drawing: a lathed envelope, a box basket and four cables hung on the engine's state), `strings-balloon.ts` and the start card's RUN stop. The model, the burner's flame, the fire, the cameras and the HUD are still to come.

## What it is

A **sport balloon of the "90" class** — about 90,000 cubic feet, 2,550 m³ — the size that carries three or four. The numbers come from the class's published figures, flight manuals as accident reports quote them, and the research on envelope heat transfer:

| Part | Value | Why |
| --- | --- | --- |
| Envelope volume | 2,550 m³ | the "90" class (77–105 is the common sport range) |
| Envelope diameter × height | 17.2 m × 19.5 m (mouth to crown) | the class's published dimensions |
| Mouth | 4.2 m across, 4.6 m over the basket floor | the throat over the burner, its load cables and frame between |
| Parachute valve | 5.2 m across, at the crown | the usual top vent, pulled open on a cord |
| Gores | 16 | the vertical panels between load tapes |
| Fabric area | 960 m² | a natural shape of that size |
| Basket | 1.35 m × 1.75 m floor, 1.12 m wall | a four-person wicker basket on a stainless frame |
| Masses | envelope 140 kg, basket 85 kg, burner 32 kg, three cylinders 51 kg empty + 60 kg propane | the class's weights; the skier's own added while he is aboard |
| Burner | 5 MW gross (a double burner of about 2.5 MW a coil), 70 % into the envelope's air | a single coil is quoted at 3–3.5 MW (about 10–12 million BTU an hour); no burner is fully efficient |
| Fabric limit | 120 °C working, scorching past 135 °C | the coating's limit; a fusible link in the crown melts near 127 °C to tell the pilot after the flight |
| Surface wind | about 7.5 m/s (15 kt) | the most a flight manual allows at take-off; pilots usually cancel past 10–12 kt |

## The flight model

Every step at 120 Hz, in `balloon.ts`'s `fly`:

- **The envelope's air** is one temperature (a lumped model, as the published control models treat it). Heat comes in from the burner; it goes out through the fabric by **radiation** to a sky colder than the air (an effective emissivity of 0.45, the sky 20 K under the air) and by **convection** off both faces (1.5 W/(m²K) in still air, rising by 1.0 for every m/s of air past it — a wind, a climb or a descent cools it faster); the **parachute valve** dumps up to 30 kW per kelvin of excess temperature. The research behind this split puts radiation at about 70 % of the loss and convection at about 20 %, and finds a burner on 10–28 % of the time to hold height, with the outside air's temperature the biggest factor.
- **The outside air** is the standard atmosphere off a winter day: −3 °C at the sea, falling 6.5 K per km, the pressure by the barometric law. Cold air lifts well: at the valley floor this balloon floats with its air near 40 °C, far under its limit.
- **The lift** is the weight of the outside air the envelope displaces less the weight of its own warm air, against the whole weight. Climbing or sinking, the envelope's drag (a coefficient of 0.6 on its plan area) holds it back. The mass that must be moved is the balloon's, the air inside it (about 2.9 t) and half the air it displaces (the added mass) — about 5 t. That is why **a burn takes tens of seconds to become a climb**: a five-second burn at the trim adds about 6 K, and the climb it buys comes on over the next half minute.
- **Across the ground** the balloon drifts with the wind at its envelope's centre: the drag on its side area (0.45 on 0.8 of the diameter times the height) pulls its way toward the wind's over the same great mass, so a balloon climbing into a faster layer feels the air rush past it until it has caught up.
- **The basket's lean**: the skier's weight off the floor's middle tips the basket about its load ring (a few degrees at the wall), and a basket dragged on the snow digs its leading edge in.

Climbs and sinks come out at what pilots fly: the bot holds a couple of metres a second climbing, a full valve sinks it at 3–4 m/s, and a cold envelope falls past 4 m/s. Holding the burner open climbs at 8 m/s and cooks the fabric within two minutes.

## The air it flies in

`balloon-air.ts`. Only a balloon ride reads it, so no other run's wind moves.

- **The up-valley wind.** On a fine day the sun warms the slopes, the air over them rises, and the valley's air flows up the valley toward the summit to replace it. On a balloon ride the map's own wind is turned to blow that way: toward the summit from wherever the balloon is, easing onto the mountain's axis within 250 m of the top so it carries on over the ridge. Its strength is a 2.5 m/s day breeze and the map's own wind summed as two flows at right angles — a calm map a gentle drift, a storm a storm. The map's gusts are kept.
- **The gradient.** The wind grows with height by the log law to a 400 m layer, so a balloon that climbs drifts faster.
- **The veer.** The wind turns with height, up to 0.35 rad by 500 m, one way or the other by the map's seed, with a slow swing. Climbing or sinking into a layer that blows a little to one side is the only steering a balloonist has.
- **The rise along the slope.** The up-valley flow follows the warmed snow: near the ground it rises at the wind's speed times the slope along its way, dying out over 120 m of height. A balloon low over a slope is lifted with it, though not as fast as the slope rises under a quick drift.

## The fire

A balloon's envelope catches fire in two ways, and the game has both:

- **The flame meets the fabric.** The skirt and the scoop at the mouth keep a wind off the flame, up to a point. When the air pushes past the envelope faster than **7 m/s** — burning on the tether in a strong wind, or climbing fast through the gradient — the mouth is pushed in over the burner, and every second of burning scorches the fabric by (air speed − 7) / 3 of the way to alight. Accident reports describe exactly this: the flame contacting the fabric near the mouth while the pilot burned in wind shear.
- **The fabric cooks.** Past 135 °C it scorches at (temperature − 135) / 10 a second, burner or not.

Alight, the fabric burns away over 12 s: the hot air pours out through the holes (up to 90 kW per kelvin), the lift goes with it, and the cloth left streams as a drag area a quarter of the plan. The balloon falls at well over the snow's limit. The way out is over the side.

## The snow and the trees

- **A crash**: the basket met along the snow's normal faster than **4.5 m/s** — a cold envelope falling, a burning one, or a drift into the rising slope — or dragged along the snow faster than **7 m/s**, or a tree's crown met faster than **3 m/s**. The skier is thrown out with the basket's way onto his own body (the `balloon` crash cause, `CRASH.over.balloon`), and the ride starts again at the bottom once he has lain 6 s.
- **A soft landing**: the basket settles, the wicker's friction (0.35) against what the lift leaves of the weight holding it while the envelope still pulls. Dragged faster than 0.3 m/s it is `dragging`.
- **A crown met slowly** snags the basket: its drift stops until it climbs out.

## The controls

The skier's own keys:

| Key | In the basket |
| --- | --- |
| Tuck (↑, the lever on touch) | the BLAST VALVE — held, the burner roars; it is on or off |
| Skid (↓) | the PARACHUTE VALVE's cord — hot air out of the crown |
| Edge (← →) and lean | WALK about the basket at a shuffle (0.9 m/s), never through the wicker; he turns to face the way he walks |
| Machine (Enter, a double tap) | OVER THE SIDE — or, the basket still on the snow, STEP OUT |
| Reset (R) | start again in the basket on the valley floor |

On touch the edge thumb walks him across the basket; walking along it on a left d-pad is open (see below).

## The start

`balloonSiteOf` finds open, level snow on the valley floor by the village (or the finish): the helipad's search (`heli-pad.ts`'s `openSpotNear`) with 14 m of room for the envelope, a lean under 0.06, clear of trunks, lifts and tunnels, and 70 m off the helicopter's pad and the snowmobile's spot. The balloon stands there tethered, its air 2 % short of floating it; the tether lets go when its lift beats its weight by 150 N.

## The labs

- `make balloon-flight`: scripted flights in pure Node on a generated map — the bot holding 120 m and 300 m over the snow ahead of it, a hop off the tether, the valve held, the burner held, a jump, a walk, a breeze and a gale. It prints the top, the climb and sink, the lag from the first burn to a climb, the envelope's hottest, the propane burnt, the way carried up the mountain, the fire and how each ended. Keep `ARGS=--json=previews/balloon-before.json` before a change and `ARGS=--compare=…` after; `ARGS="--trace=pilot"` prints a row's flight every 5 s.
- `tests/balloon_test.ts` holds it: the tether, the drift up the mountain, the lag, the valve, the crash of a cooled envelope and the restart, the fire in a gale, the jump, the walk, the step out, the reset, determinism, and the site.

## What is still open

- The model (envelope gores and colours, the wicker, the burner frame and cylinders), the burner's flame and the fire as drawn, and the envelope deflating on the snow — `balloon-scene.ts` is a stand-in.
- A camera ladder of its own (the first-person rung in the basket looking down over the side), the HUD (altimeter, variometer, envelope temperature with its red line, fuel, wind) and the sound (the burner's roar, the pilot light, the fire).
- On touch, a left d-pad to walk the basket both ways (the helicopter's `StickZone`).
