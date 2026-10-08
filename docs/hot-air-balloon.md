# The hot air balloon

A free ride can start in the basket of a hot air balloon. Pick **BALLOON** on the start card's RUN row (after PARAMOTOR, before SNOWMOBILE), or follow a `?start=free&balloon=1` link. You start standing in the wicker basket on the valley floor, the envelope inflated over you and held down by its tether. Burn until it is light and the tether lets go; the day's wind carries you up the mountain. Land it softly and step out, or jump over the side.

The engine side is `engine/game/balloon.ts` (the flight), `balloon-air.ts` (the air it flies in), `balloon-state.ts` (its state and events), `balloon-pilot.ts` (the bot's hands) and `defs/balloon.ts` (every number). The app side is the balloon as drawn (below: `balloon-look.ts`, `balloon-envelope.ts`, `balloon-basket.ts`, hung on the engine's state by `balloon-scene.ts`; its fire in `balloon-fire-plan.ts`, `balloon-flame.ts` and `balloon-fire.ts`), `strings-balloon.ts` and the start card's RUN stop. The cameras, the HUD and the sound are still to come.

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

## As drawn

Everything is built in code off `BALLOON`, so the picture and the physics cannot part. The measures and the rules are in `pwa/src/game/balloon-look.ts` (three-free, held by `tests/balloon_look_test.ts`); the meshes in `balloon-envelope.ts` and `balloon-basket.ts`; `balloon-scene.ts` hangs them on the engine's state every frame.

- **The envelope** is a natural shape, as a sport balloon's is: a cubic flare out of the 4.2 m mouth into a cone about 30° off the axis, widest (17.2 m) at the engine's equator 11.5 m up, rounding over a superellipse crown to 19.5 m. Its sixteen GORES bulge in LOBES between the load tapes (a sagitta of 0.13 of the chord, normalised so the lobes, not the tapes, make the girth), and the drawn volume comes to about 2,590 m³ against the class's 2,550. Each gore is sewn of sixteen panels about 1.5 m tall, the top four rows a parachute cap with its dark rim, and the bottom a scoop of a skirt 1.7 m long in the dark slot. About 14,000 triangles.
- **The paint**: a colourway is dealt off the map's seed on a salt of its own (never the run's stream, so no digest moves) — one of seven patterns (alternate gores, bands, chevrons, diamonds, a spiral, a rainbow, a sunburst round the crown) over one of six palettes. The same rule is written twice, in `paintSlot` and the shader's `PAINT_GLSL`, and the test holds them to each other. Tapes are drawn darker down every seam and round every row; sunlight shows through the fabric on its shaded side.
- **The glow**: `EnvelopeLook.glow` (the engine's `flame` each frame) lights the inside — brightest a little over the mouth, the tapes standing dark against it — the thing a balloon looks like at dusk. `.burnt` eats holes and a char band into the fabric and shrinks and streams what is left; `.scorch` browns it round the mouth.
- **The shape moves**: the envelope leans off the basket by the engine's `lean` toward the drift, dents on its windward side in a strong shear, and the valve pulls its crown down. Down, it tips over downwind and lays out flat on the snow, rucked, as `deflate` runs from 0 to 1.
- **The rigging and the basket**: sixteen flying wires from the tapes at the mouth, four to each corner of the burner frame; the double burner — two coils, the jets, the blast valves with their red grips — on padded uprights; a wicker basket (a woven texture and its normal map, generated) with a suede rim roll, rope handles, ash runners and three quilted cylinders, their hoses to the burner. The skier stands in it with no poles, his skis lashed outside the long wall. Past 110 m a few boxes and a cylinder stand in for the basket.

## The fire as drawn

Decided in `pwa/src/game/balloon-fire-plan.ts` (three-free, held by `tests/balloon_fire_test.ts`), drawn by `balloon-flame.ts` and `balloon-fire.ts`, hung on the balloon by `balloon-scene.ts`. Presentation only: it reads `BalloonState` (`valve`, `flame`, `pilot`, `shear`, `leanTo`, `scorch`, `burning`, `burnt`, `mode`) and never writes it, and every flicker runs off the run's clock and every scatter off a stream of its own.

What it was made to look like, from flight manuals, burner makers' descriptions, accident reports and photographs and film of burns by day and at night:

- **The main burner** fires vaporised propane through its coil as a long, narrow "pencil" flame — over five metres at full blast, more than eight on the biggest ride-balloon burners. It leaves the jets blue and nearly clear, turns within half a metre into a bright yellow-white body with orange, turbulent tongues tearing off its top, and roars from a little over head height up into the mouth, so its upper half is inside the envelope. A whisper (liquid-fire) valve burns a softer golden flame at about two thirds of the power; the game's valve is the main burner.
- **The pilot light** is a small, steady blue flame at each coil, lit for the whole flight.
- **At dusk and after dark** a burn turns the envelope into a lantern and throws an orange light down on the basket, the pilot and the snow under it.
- **Envelope fires** start where the flame meets the cloth: in wind shear the windward side of the mouth is pushed in over the burner (the reports' advice is to look up before every burn), or the envelope tips over onto a burning burner on the ground. The base panels are a heat-resistant aramid; the coated nylon above burns fast, the flames running up the gores far faster than down or round, the cloth melting and dropping burning, and the whole envelope can be engulfed in well under a minute.

So:

| Part | Value |
| --- | --- |
| The flame | 5.4 m at full blast (a quarter of it just lit or nearly out), widest 0.27 m a third of the way up each jet; a blue root of 0.4 m; tongues climbing at about 9 m/s |
| Ignition | the flame 35 % bigger and brighter for a moment, dying away over 0.28 s |
| The tail | the valve shut, the flame goes out from the coil first, its root climbing at 12 m/s, the last of it lifting into the mouth |
| The bend | the top laid over the way the envelope leans by (air past ÷ 14 m/s) of its length, at most 0.85 |
| The pilot | 0.2 m, 0.03 m across, blue with a yellow tip |
| Its light | a lamp slot (`Flood`) a third of the way up the flame, warm orange, 0.9 of a flood at full flame and a glimmer for the pilot — lit with the dark, as every lamp is |
| The spread | from where it caught (2.6 m up the cloth from the mouth on the windward side when the shear lit it, the crown when it cooked): a climb counted at 0.5 of its height, a descent at 1.9, the cloth's own noise ±1.6 m; the front sweeps the farthest cloth by `burnt` = 0.85 |
| The front | the last 1.3 m of cloth behind it alight in the shader, 1.8 m ahead browned by the heat; behind it the cloth is gone but for the charred streamers |
| What it throws | at a full front, 150 flames, 40 puffs of black smoke (3–6 m, climbing at 7 m/s and carried off on the wind), 45 embers, 36 burning drips and 1.6 shreds of cloth a second |
| The wreck | burns down over about 25 s on the snow and smoulders for minutes |

- **The flame** is one open tube a jet, shaped in the vertex shader (narrow at the coil, widest a third of the way up, wobbling more the higher it goes, its top bent) and burnt in the fragment shader: how much flame the eye looks through at each point (the most at the silhouette's middle, and the whole of it when looking up the axis from the basket), a warped noise streaming up it that tears the upper half into tongues, the blue root, a yellow heart, orange tongues and a dull red top. Its colours sit a little over one so the tone map keeps it burning against the snow. A halo round it after dark.
- **The envelope glows** with the flame as drawn (the tail's last light included), flickering with it, the more after dark; and with the fire's own light as it burns.
- **Scorching**, the cloth where the flame is laid into it browns and smokes, then catches in licks.
- **Alight**, the envelope's shader eats the cloth behind the spread's front (`FIRE_GLSL`, the same key as `spreadKey`), blackens it and glows patchily along the front; flames stand on the front (billboards off the helicopter's billow strip, `explosion.ts`, in one sorted batch, `billboards.ts`), black smoke rolls off it and drifts downwind, embers and burning drips fall through the helicopter's spark pool (`sparks.ts`), shreds of cloth tear off burning and flutter down to lie charred on the snow. A falling balloon leaves its smoke standing in the sky.
- **Cheap on purpose**: the flame is four small tubes and a halo (about 0.01 ms of the processor a frame); a burning envelope about 0.5 ms (its update and its sort), and nothing at all while it does not burn.

## The labs

- `make balloon-flight`: scripted flights in pure Node on a generated map — the bot holding 120 m and 300 m over the snow ahead of it, a hop off the tether, the valve held, the burner held, a jump, a walk, a breeze and a gale. It prints the top, the climb and sink, the lag from the first burn to a climb, the envelope's hottest, the propane burnt, the way carried up the mountain, the fire and how each ended. Keep `ARGS=--json=previews/balloon-before.json` before a change and `ARGS=--compare=…` after; `ARGS="--trace=pilot"` prints a row's flight every 5 s.
- `make balloon`: the balloon as drawn, through the game's own renderer on a generated map (the harness `pwa/balloon-preview.html` over `pwa/src/tools/balloon-harness.ts` and `balloon-scenes.ts`): tethered, in flight from six sides, the basket close, up into the mouth and the valve, leaning, dusk and night, burning, down on the snow, every colourway, the walk, a turntable, the jump and every camera rung — and the fire: `fire` (the pilot lights close, the ignition and the tail frame by frame, the burn from the basket up into the mouth, by day, at dusk and at night, the flame laid over by 3, 7 and 11 m/s), `catch` (the envelope scorching and catching on its tether in a 13 m/s wind, then burning, frame by frame) and `inferno` (alight in flight, the skier over the side, engulfed, falling, the wreck burning down and smouldering; and after dark). A contact sheet a group in `previews/balloon-<group>.png`; `ARGS=--sheet=colours,night` some.
- `tests/balloon_fire_test.ts` holds the fire's plan: the flame's length against the class's, the burst, the tail, the bend, where it catches, the spread up and down the gores and the whole envelope swept before it is burnt through.
- `tests/balloon_look_test.ts` holds the drawing to the engine: the volume, the shape and where it is widest, the panels, the lobes, the mesh, the wires, the burner, the cylinders, the wicker, the paint's rule and the envelope laid on the snow.
- `tests/balloon_test.ts` holds it: the tether, the drift up the mountain, the lag, the valve, the crash of a cooled envelope and the restart, the fire in a gale, the jump, the walk, the step out, the reset, determinism, and the site.

## What is still open

- The envelope's cloth is a shape, not a cloth simulation: it does not billow as it lays down, nor stream as it burns beyond the shrink and the ripple. The flame has no heat shimmer (a refraction pass the renderer does not have), and the whisper burner's golden flame is not drawn (the game has one valve). The holes the fire eats are not cut out of the envelope's shadow.
- A camera ladder of its own (the first-person rung in the basket looking down over the side), the HUD (altimeter, variometer, envelope temperature with its red line, fuel, wind) and the sound (the burner's roar, the pilot light, the fire).
- On touch, a left d-pad to walk the basket both ways (the helicopter's `StickZone`).
