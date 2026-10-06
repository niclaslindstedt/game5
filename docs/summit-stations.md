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
| The last tower       | A tower a span or less from the terminal, its sheave train the last the rope rides over, standing tall so the rope comes DOWN from it into the terminal. A chair rocks as its grip runs over the sheaves — the lurch every rider knows.                                            | 30–80 m before the wheel                    |
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
  the face. R26 asks for one (`lift.top`: 48 m across, leaning off its deck).
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

- **The pad (from generator v5, `station-pad.ts`)** — every top station off the
  valley floor stands on a pad 48 m across (R26, `lift.top`), cut more than
  filled into the slope (a quarter of the fill a level-at-the-middle pad would
  need) and eased into the mountain over 22 m. It is not flat: its DECK, 7 m
  either side of the line — the wheel, the ramp and the way off — is level,
  and from the deck the pad LEANS off to both sides at 11 % to its rim, about
  2 m under the deck, so a rider who turns off the way slides toward his run
  gathering speed, with room to turn about, and the rim is the lip he drops
  over onto the face. A chair's pad carries the UNLOAD RAMP, 1.2 m of packed
  snow under the chair and the lane beside it up to the unload point, falling
  from there on up the line over 7 m — 16 % — so a rider stood up there slides
  on ahead of the chair, never back into the cut under its way in (v6; v4's
  is a mound falling every way). The runs off a
  top leave from beyond the pad's rim — their starts and first stretch keep
  10 m past it, and a lane's route 12 m. The campaign's maps stand on
  generator v4, whose pads are level and 30 m across (`levelPads`).
- **Every run under its top (generator v6, `run-start.ts`)** — a rider off a
  lift must never climb to his run: every run off a top, a transport lane
  too, STARTS UNDER it by 4 m and a tenth of the way from the pad's rim to
  it, within reach of a ramp, slid down the fall line from the top's contour
  until it is; and a start is only taken where a ramp has ROOM to come down
  to it from the rim (`rampRoom`) — clear of every run walked before it, a
  station and a lift's line, falling at least 10 % to the run's edge and not
  too steeply to its line. That room is KEPT: every run walked after it, and
  every lane, keeps off it (`nearRoom`). The analyzer refuses a map with a
  run off a chair's or a gondola's top starting against it (R27).
- **The ramps off a top (generator v6, `summit-ramps.ts`)** — from the pad's
  rim a RAMP 26 m wide, groomed, comes down to every run the top serves, so
  the way from the lift to the slope is one wide run-out rather than the raw
  face. It leaves from whichever point of the rim reaches the run most
  gently and comes down onto the run's own snow — onto its head from behind
  where it can — at that snow's own height (a run is not level across: its
  edge up the slope stands over its line), pressed over the run's own
  shoulder on the way; never across another run's ground, a station, another
  ramp or under a lift's line. It FALLS at least 10 % all the way, so a rider
  let go at a crawl gathers speed down it, and EVENLY to its foot, the run's
  own head its LIP — never a knee a rider following the sign is thrown off:
  to a green or a blue no more than 20 %, to a red or a black 48 %. The ramps are published on the lift
  (`Lift.ramps`): the runs' signs stand beside the piste map board, the
  runs whose ramps leave to the rider's left at its left and the rest at
  its right, turned to where he comes off the lift (a drag's top, with no
  board, signs each ramp at its head), and the run's own sign a dozen
  metres past its foot, turned up the ramp to him as he comes onto the run; a rider skis
  down them, and the lens holds its summit look to the lip. A DRAG'S top has
  ramps too, from the ground round where it lets its rider go (12 m), laid
  once the drags have settled — but only where they fit: the nursery drag is
  re-laid after its runs are walked and its top often ends up too far above
  them for a green's gentle ramp.
- **The approach under the line (from generator v5)** — a chair's bullwheel
  stands 3.8 m over the deck and the chairs come down to the unload ramp,
  so a mountain that stays level, or bulges, under the last of the line
  stands up into the chairs: a rider is dragged up through the snow. So the
  ground under the last 90 m of every line, from 3 m behind the unload
  point (so the unload ramp under the rider's tails is never cut), is
  cut away beneath the rope's way in (a straight line from the wheel to a
  tower) by a carrier's hang and 0.8 m more, and the analyzer holds every
  lift to it: out of the load and unload zones no carrier's lowest point
  meets the snow (`ropeShortfall`).
- **The way off a chair's top (`chairLane`, `CHAIR_EXIT`)** — the rider
  stands up at the unload point and slides STRAIGHT ON down the ramp, a step
  out of the chair's way into a LANE 2.4 m outside the up rope, clear of the
  chairs swinging round the wheel. The machine house stands on the lane's
  outer side, 2.2 m clear of it, ending a step short of the PARTING 3 m past
  the wheel, where the paths go off either way across the pad. Nothing stands
  across the way: no stop gate and no netting, so a rider slides straight on
  down the ramp and through the parting. Straight ahead, 14 m past the wheel
  and facing him, stands the PISTE MAP BOARD (below).
- **The run signs (`summitSigns`, `run-sign-plan.ts`)** — every run a rider
  let go on a top can ski onto has its sign at the HEAD OF ITS RAMP: on the
  pad 3 m in from the rim, at the ramp's right-hand edge, read looking down
  the ramp — the piste signs' own weathered plank with the run's mark, its
  number and its name burned in and an arrow down the ramp. So the sign
  stands LOWER than he came off the lift, down the pad's lean in front of
  him, and he follows the one he wants straight down its ramp onto its run.
  Nobody picks a run on the unload ramp. (A map from before the ramps keeps
  one post at a chair's parting, an arrow board a run.)
- **The piste map board (`map-board.ts`)** — at every chair's and gondola's
  top, facing where the rider is let go: a stout timber frame and roof round
  a face painted as the free ride's start card paints the ski area — the
  panorama from over the valley, every run in its colour on its casing, the
  lifts, each run's number in its grade's sign — under a PISTE MAP header,
  with YOU ARE HERE at the top it stands on and the four signs along its
  foot. The picture is the start card's own (`map-board-picture.ts`): a free
  ride begun off the card is painted with the panorama the card already
  showed; any other map is painted as its scene is built, under the loading
  card.
- **The stations drawn (`station-plan.ts`, `station-parts.ts`, `lifts.ts`)** —
  at a chair's top the terminal's hood over the wheel, the machine house beside
  the way off, the operator's booth behind it with glass all round, the run
  signs at the ramps' heads, the map board, the wind mast on the house's far
  corner — no stop gate and no netting, which a game's rider only skis into,
  and no patrol hut. At a chair's foot the hood, the booth by the load
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
- **The boarding ring (`boardingRing`, `boarding-rings.ts`)** — a lit amber
  circle of 3.5 m radius, on the queue's lane a metre past the open
  end of the corral, with a column of light standing out of it (a free
  ride's alone). Ride into it under 14 m/s, facing any way, and you are
  glided up the queue's lane through the corral (`ringWalk`) to the load
  zone and boarded as above.
- **The way in (`lift-line.ts`, `LiftLook.in` and `.rail`)** — the last
  tower stands past the pad's rim, 30 m short of a chair's top wheel (34 m
  of a gondola's) and slid on back off any groomed snow, as tall as it must
  be for the rope to FALL into the terminal at least 22 % — so a chair comes
  in over the cut under the line from above and settles onto the terminal's
  level rail over the unload ramp, the last ten metres at the wheel's
  height, never dragged up the snow. The towers stand 13 m (a chair's) and
  18 m (a gondola's) to the rope on columns most of a metre across, the last
  one up to 28 m and 34 m.
- **The ride up** — a chair rides at line speed, its hanger a pendulum: a
  lurch of a few degrees as the grip runs over each tower's sheaves, a swing
  forward as it slows into the top terminal, coming down to the ramp with his
  skis just on the snow, never through it; the rider sits back against the
  chair's backrest, and is stood up at the unload point and sent straight on
  down the ramp into the lane. The chair he got off runs on empty over the
  ramp to the wheel at the terminal's speed (`SkierState.chairLeft`,
  `emptyChairAt`), never hidden — and a skier who stops in its way is swept
  off his feet by it (`chairStrike`, the `chair` wipeout). A free ride
  STARTS on one: the last eight seconds of the lift serving the run picked
  on the start card (`freeRunOf`, `lift.arrive`), the chair over the last
  tower and down onto the terminal's rail. Stood off it — at a chair's
  unload, out of a gondola's door, off a drag's T-bar — the skis are his at
  once: NOTHING
  LEADS HIM OFF A TOP. The way down is the ground's: the unload ramp, the
  pad's lean, his run's sign and its ramp.
- **The lens on a lift (`camera-lift.ts`)** — carried up a chair the chase
  boom comes in close behind him and a little over his head, level, the
  chair's back and hanger in the frame's foot and the rope running on up to
  the top station ahead, and once the lift lets him go it eases out to the
  chase — on the pad the summit's own low look. The empty chair stays in
  the frame as it runs on behind him. `make lift-ride` rides the whole sequence unbroken at sixty frames a second
  and photographs it round the unload.
- **The drop (`camera-summit.ts`, `camera-rigs.ts`)** — on a top station's
  pad the chase lens comes down and in behind him, LOW and LEVEL (`SUMMIT_LOOK`:
  3.4 m back and under a metre over him, his figure near the middle of the
  frame) instead of standing up behind him and leaning with the face, so the
  pad's edge ahead is the edge of the world and the face beyond it is out of
  sight — the lip reads as a cliff, whatever colour the run off it. Its
  height hangs on the softer in-flight spring, so as he drops over the lip
  the lens holds a beat at the top and TIPS DOWN after him; the chase's own
  height and lean are handed back over the first dozen metres he drops below
  the deck — or, down a ramp off the top, below the ramp's lip (`rampLip`).
