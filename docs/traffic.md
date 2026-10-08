# The village's traffic

A ski area's village at the bottom of the mountain carries traffic: the
guests' cars going round its streets and into the car park, a hotel's or a
builder's van, the SKI BUS running to its stop by the lifts, and a few
winter cyclists. This page is what the game builds of it, and the research
its numbers come from, in our own words.

## What is built

- **THE PLAN** (`engine/game/traffic-plan.ts`'s `planTraffic`): dealt off the
  map's seed on a salt of its own (`TRAFFIC_SALT`), never `state.rng`, so no
  digest moves. Cars go round the village's loop of streets each way, visitors
  come in off the road to a bay in the car park, stay a while and leave, a few
  cars pass straight through, cyclists ride the loop near the kerb, and the
  ski bus comes in to its stop, stands there and leaves again. Everything comes
  round again every `TRAFFIC.period` (600 s). Each vehicle's legs (drive, wait,
  hidden off the map) are phased by a solver that keeps every pair apart —
  the boxes of two vehicles never overlap, checked every quarter second.
- **THE ROUTE** (`traffic-route.ts`): a path down the lanes, its corners turned
  on Bézier curves sized to the turn, the rear axle following it and the body
  set over it; a speed profile capped by each street's limit and by the bend's
  sideways pull, accelerating and braking at a driver's rates.
- **A VEHICLE AT A MOMENT** (`traffic.ts`'s `vehicleAt`, `trafficOf`): a pure
  function of the map and the clock — its place, height, heading, speed, the
  front wheels' steer, the odometer the wheels and the cranks turn by, the
  brake and the indicator. `parkedCars` are the bays' cars, taken by the hour
  (more by day than at night) and never in a mover's way.
- **MET BY THE SKIER** (`traffic-contact.ts`'s `trafficStrike`), on a free ride
  only (`RunRules.traffic`): a shuffle against a car is held off it; faster, he
  is knocked down — the `car` crash cause, a blow over the bodywork's give
  (`body.ts`).
- **AS DRAWN** (`pwa/src/game/traffic-shapes.ts`, `traffic-view.ts`,
  `traffic-look.ts`, `traffic-rider.ts`): every body built in code, low-poly
  and faceted — a loft of rings under the class's side profile, its wheel
  arches cut, its glass shaded from the cabin's dark to the sky it mirrors,
  the lamps, plates, mirrors and grille; snow on the flat faces of a car parked
  through the night and a slab on the roof of a third of the cars driving; a
  ROOF BOX or a SKI RACK with skis on some; wheels turning by the odometer and
  steering; instanced, a near and a far cut. The cyclist is one of the crowd's
  bodies in winter kit, posed by eight keys of the cranks' turn. After dark the
  head, tail, brake and indicator lamps glow, the nearest cars' headlamps are
  dealt lamp slots and light the snow, and the bus's windows are lit.

## The numbers

### The vehicles (`VEHICLES`)

| Kind | Length | Width | Height | Wheelbase | Tyre (radius) |
| --- | --- | --- | --- | --- | --- |
| Hatch (small five-door) | 3.6–4.1 m (4.05) | 1.6–1.75 (1.75) | 1.4–1.5 (1.47) | 2.4–2.6 (2.56) | 0.315 |
| Estate (compact) | 4.4–4.75 (4.65) | 1.8 | under 1.5 (1.48) | 2.65–2.7 (2.69) | 0.325 |
| SUV (compact crossover) | 4.2–4.6 (4.45) | 1.8 (1.82) | 1.6–1.7 (1.67) | 2.6–2.7 (2.63) | 0.355 |
| Van (medium panel van) | 5.5–5.9 (5.55) | 2.0–2.06 (2.05) | 2.35–2.65 (2.45) | 3.3 | 0.35 |
| Ski bus (12 m single-deck) | 12 | 2.55 (the legal most) | 3.0–3.1 (3.1) | 5.9, front axle 2.7 back | 0.48 |
| Winter bicycle | 1.8–1.9 (1.85) | bars 0.6 | rider 1.75 | 1.1 | 0.36 (fat or studded 26–29") |

### How they drive (`DRIVES`)

- A village street is signed at 20–30 km/h; a car drives it at 25, a bus at
  22, the road out of the village at 45–50, a car-park aisle at walking pace
  (10).
- A careful driver on a snowy street takes a corner at some 1.1–1.4 m/s² of
  sideways pull — about 15 km/h round a village corner.
- Pulling away 0.8 (a bus) to 1.3 m/s² (a car); a gentle stop 1.2–1.7 m/s².
- A winter cyclist rides at about 13 km/h, his cranks turning some 60 times a
  minute in an easy gear (3.6 m a turn).

### The village's traffic (`TRAFFIC`)

- Two or three cars round the loop each way, four to six visitors in and out
  of the car park (staying 1.5–5 minutes on the game's clock), two passing
  through, three or four cyclists, one ski bus standing 25–45 s at its stop.
- A car's class: hatch 35 %, SUV 30 %, estate 20 %, van 15 %.
- The kerbs' bays are about 60 % taken; the car park 80 % in the lifts' hours
  (08–17) and 30 % after.
- A car keeps a quarter of a metre to either side and 1.2 m plus 0.6 s of its
  speed ahead; it swings 0.9 m out round a cyclist.

### The look (`traffic-look.ts`)

- PAINT: a European winter car park is mostly grey, white and black — about a
  quarter of new cars white or pearl, a quarter grey or silver, a fifth black,
  a tenth blue, then red, green and the browns. Vans are mostly white.
- SNOW: a car parked through a snowfall wears it on every flat face (most of
  the parked ones); a car on the road has had its screens cleared and keeps a
  slab on its roof about one time in three.
- ROOF: a ski area's cars carry a roof box (250–600 l, about 1.9 m long, 0.8
  wide and 0.35 tall, mostly black or dark grey) on one car in five, a ski
  rack of two bars with skis on it on one in seven.
- LAMPS: dipped headlamps after dark and daytime running lamps by day; the tail
  lamps a few candela after dark, the brake lamps an order of magnitude
  brighter; indicators flashing at 1.5 Hz (the rule's 60–120 a minute).
- A cyclist wears a helmet a little over half the time, a beanie otherwise.

### Met by the skier (`TRAFFIC_STRIKE`)

- Under 2 m/s of closing speed the skier is held off the bodywork; over it he
  is knocked down, bounced off at 0.3 of the closing speed.
- The blow is a stop over the bodywork's give — a bumper and bonnet crumple
  some 12 cm, as pedestrian impacts are measured — and the bus's flat front
  half of that.

## Labs

`make world SEED=38 ARGS="--free --views=village-traffic,village-junction,village-carpark,village-bus,village-cyclist,vehicles"`
(and `--hour=21` for the night; `vehicle-<kind>` one kind close), and
`npx vitest run tests/traffic_test.ts`. `make sim`'s digests must not move.

## Still open

- No engine or tyre sound bed, no bus diesel, no bicycle bell — only the
  knock when the skier is struck.
- The cars carry no drivers; the bus no passengers in its windows.
- Vehicles do not yield to the skier or to the people on foot.
