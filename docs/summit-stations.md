# The summit stations

How the top of a lift is laid out, why, and what the game builds of it. This
page is the research behind R26's pad (`engine/mapgen/station-pad.ts`), the
stations as drawn (`pwa/src/game/station-plan.ts`, `lifts.ts`) and the free
ride's arrival by chair (`engine/game/lift-ride.ts`). It names no lift maker,
resort or mountain: the numbers are a class's measured bands.

## What a top station is made of

A chairlift's top terminal, walked in the order a rider meets it:

| Part                 | What it is                                                                                                                                                                                                                                                                          | The band                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| The last tower       | A tower a span or less from the terminal, its sheave train the last the rope rides over. A chair rocks as its grip runs over the sheaves — the lurch every rider knows.                                                                                                             | 30–80 m before the wheel                    |
| The approach         | The rope comes down toward the bullwheel and the chair down toward the snow, the seat a little over knee height above the ramp's top at the unload point.                                                                                                                           | seat 0.4–0.6 m over the snow                |
| The UNLOAD POINT     | Where the rider stands up. A marked line (a board or paint) a few metres before the wheel.                                                                                                                                                                                          | 5–8 m before the wheel                      |
| The UNLOAD RAMP      | A short pitched ramp of packed snow the rider slides down off the chair, clear of the chair turning round the wheel. It runs straight ahead or diagonally off to one side.                                                                                                          | 12–25 % pitch, 6–10 m long, 1–1.5 m of drop |
| The STOP GATE        | A light bar, a line or a light beam just past the unload point: a rider who did not get off stops the lift with his legs.                                                                                                                                                           | 1–2 m past the unload point                 |
| The BULLWHEEL        | The wheel the rope turns round, flat at the rope's height, the chairs swinging round it. On a top-drive lift the motor, the gearbox and the brakes sit under it.                                                                                                                    | 4–6 m up; a radius of half the gauge        |
| The TERMINAL HOOD    | On a detachable lift the chairs leave the rope at the terminal and are slowed on tyres to about 1 m/s from a line speed of about 5 m/s; the long hood over the wheel and the rails is the terminal's silhouette. A fixed-grip lift has an open frame instead and runs at 2–2.5 m/s. | 15–25 m long, 5–7 m high                    |
| The OPERATOR'S BOOTH | The control room: a small glazed hut beside the unload, on the side with a view down the ramp and up the line, with the stop button, the phone to the bottom operator and the wind readout. Glass on three sides, a door on the fourth.                                             | 2.5 × 2.5 m, 2.5–3 m high                   |
| The MACHINE ROOM     | On a top drive, a house under or behind the wheel for the drive and the emergency engine.                                                                                                                                                                                           | the hood's length, 3–4 m high               |
| The WIND MAST        | An anemometer and a vane on a mast at the terminal or on the last tower — the operator slows or stops the lift on a gust.                                                                                                                                                           | 6–10 m                                      |

Past the ramp, the station's ground:

- **The PAD** — a level area cut and filled into the slope, groomed, that the
  ramp runs out onto. It is where a rider stops, gets his bearings and picks a
  way down; a skier coming off a chair needs a few metres of nearly flat snow
  before anything steeper. On a peak it is cut into the slope above and
  filled below, so its downhill edge is a LIP: level snow rolling over onto
  the face. R26 already asked for one (`lift.pad`, 30 m across).
- **The DISPERSAL AREA** — the pad's downhill edge, where the runs leave. The
  piste signs stand here, pointing at each run, its colour on the sign. The
  runs fan out from it rather than from the unload: a rider is never asked to
  pick a run on the ramp.
- **FENCING** — orange safety netting and rope lines on poles keep riders off
  the chairs' path round the wheel, off the towers, and off any cliff edge
  near the pad; padding wraps a tower or a post near a run.
- **The PATROL HUT** — on the highest station, a hut for the patrol with a
  sled rack beside it; a piste map board at the head of the dispersal area.

## How each kind is boarded, at its foot

| Kind             | How a skier gets on                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | The band                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| A CHAIR          | Through a roped MAZE (corral) that brings the line in, a gate per lane opening as each chair comes round; the skier slides out to the LOAD LINE ("load here", a painted board across the lane), stands facing up the line and looks back over his shoulder, and the chair comes in behind him and scoops him up. On a detachable lift the chair has left the rope and runs slowly through the terminal (some lifts carry the skiers to the line on a conveyor); the operator watches from the booth beside the load line. | chairs every 6–8 s; about 1 m/s through the terminal |
| A GONDOLA        | Walked in: through the station house's door, the skis put in a rack on the outside of the cabin, and in through the cabin's doors as it creeps through the station.                                                                                                                                                                                                                                                                                                                                                       | about 0.3 m/s through the station                    |
| A T-BAR (a drag) | The skier lines up in the TRACK, skis pointing up it; the operator (or the skier) puts the bar behind his thighs as it comes round the wheel, and he is PULLED up the track standing on his skis — never sat on the bar, knees soft, skis parallel. At the top he lets go on the unload area and steps out of the track to the side. Surface lifts are often driven from the BASE.                                                                                                                                        | 2.5–3.5 m/s                                          |

A gondola's top station is a whole building: the cabins run through it and the
rider walks out of a door onto the pad, so it has no ramp. A drag's top is a
pad the skier lets go of the bar onto; no booth, a hut at most.

## What the game builds

- **The pad (generator v4, `station-pad.ts`)** — every top station off the
  valley floor stands on a level pad 30 m across (R26), cut more than filled
  into the slope (a quarter of the fill a level-at-the-middle pad would need)
  and eased into the mountain over 22 m; a chair's pad carries the unload
  ramp as a low mound of packed snow under the unload point, 1.2 m high and
  7 m in reach — 16 % — so a rider stood up there slides off it whichever way
  he turns. The runs off a top leave from the pad's EDGES — their starts and
  first stretch keep 25 m off its middle, a lane's route keeps off it — and a
  groomed DISPERSAL LANE, kept clear of trees, runs from the pad down to each
  run off its lift where it first passes below the pad. v3 maps (every
  campaign map) keep the mountain as it was (`rawStations`).
- **The stations drawn (`station-plan.ts`, `station-parts.ts`, `lifts.ts`)** —
  at a chair's top the terminal's hood over the wheel, the machine room, the
  operator's booth beside the unload with glass all round, the stop gate, the
  orange netting round the wheel, the wind mast; on the highest top the patrol
  hut and the map board. At a chair's foot the hood, the booth by the load
  line, the blue load line across the up rope's lane and the roped corral
  bringing a skier in on the diagonal past the house; a gondola's station door
  with its canopy and corral; a drag's hut, corral and track board.
- **The lifts always run (`carrierAt`)** — every chair, cabin and T-bar on
  every lift moves round its loop at the rope's speed, on every map in every
  mode, a pure function of the engine's clock: a replay hangs them where the
  run did, and a skier seated on carrier `k` — a rider of the field, one day —
  is wherever it is.
- **Boarding in the free ride (`lift-ride.ts`)** — ride slowly into a lift's
  LOAD ZONE facing up its line and it takes you: a chair from its load line
  (glided out onto it, scooped up from behind and sat down), a gondola through
  its station's door (in a cabin, out of sight, and walked out of the top
  station onto the pad facing down), a drag from the head of its track
  (pulled up it standing on the skis and let go short of the top wheel).
- **The ride up** — a chair rides at line speed, its hanger a pendulum: a
  lurch of a few degrees as the grip runs over each tower's sheaves, a swing
  forward as it slows into the top terminal; the rider is stood up at the
  unload point and sent down the ramp on the diagonal, clear of the chairs
  round the wheel. A free ride STARTS on one: seated a span or two below the
  top of the chair whose run passes nearest the spot picked (among the runs a
  rider can drop onto from its pad), led round on the pad and over its lip
  onto that run, and from the first touch of a control the skis are his.
- **The drop (`camera-summit.ts`, `camera-rigs.ts`)** — on a top station's
  pad and over its lip the chase lens is held near level instead of leaning
  with the face, its height hung on the softer in-flight spring and its fov
  opened a little, so the slope falls away under the horizon and reads as
  straight down; the lean is handed back as he drops below the pad and away
  from it.
