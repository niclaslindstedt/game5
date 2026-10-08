// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S TRAFFIC — the numbers the cars, the ski bus and the
// bicycles on a ski area's village streets (`traffic.ts`) are dealt and
// driven by. Measured off the real thing (`docs/traffic.md`); every number
// is metres, seconds or metres a second unless it says otherwise.

/** The kinds of vehicle the village's streets carry. */
export type VehicleKind = "hatch" | "estate" | "suv" | "van" | "bus" | "bike";

/** A VEHICLE'S MEASURES, the class's typical one (no make): its length,
 * width (the body, mirrors folded) and height over the road; its
 * wheelbase and the front overhang ahead of the front axle (the rear's is
 * what is left of its length); the wheel's radius (the tyre's) and the
 * track between the wheels' middles. A bicycle's height is its rider's
 * over the road. */
export type VehicleSize = {
  length: number;
  width: number;
  height: number;
  wheelbase: number;
  front: number;
  wheel: number;
  track: number;
};

/** THE CLASSES, by their measured middles:
 *   * HATCH — a small five-door: 3.6–4.1 m long, 1.6–1.75 wide, 1.4–1.5
 *     tall on a 2.4–2.6 m wheelbase, 15-inch wheels (a 0.63 m tyre).
 *   * ESTATE — a compact estate: 4.4–4.75 m long, 1.8 wide, under 1.5 tall,
 *     a 2.65–2.7 m wheelbase.
 *   * SUV — a compact crossover: 4.2–4.6 m long, 1.8 wide, 1.6–1.7 tall, a
 *     2.6–2.7 m wheelbase and a 0.7 m tyre on a 17-inch wheel.
 *   * VAN — a medium panel van (a hotel's, a builder's): 5.5–5.9 m long,
 *     2.0–2.06 wide, 2.35–2.65 tall on a 3.3 m wheelbase.
 *   * BUS — the ski bus: a 12 m single-deck bus, 2.55 m wide (the legal
 *     most), 3.0–3.1 tall, the front axle 2.7 m back and a 5.9 m
 *     wheelbase, a 0.96 m tyre.
 *   * BIKE — a winter bicycle: 1.8–1.9 m long, its bars 0.6 wide, a
 *     1.1 m wheelbase on fat or studded 26–29-inch tyres (0.72 m). */
export const VEHICLES: Readonly<Record<VehicleKind, VehicleSize>> = {
  hatch: {
    length: 4.05,
    width: 1.75,
    height: 1.47,
    wheelbase: 2.56,
    front: 0.84,
    wheel: 0.315,
    track: 1.5,
  },
  estate: {
    length: 4.65,
    width: 1.8,
    height: 1.48,
    wheelbase: 2.69,
    front: 0.92,
    wheel: 0.325,
    track: 1.55,
  },
  suv: {
    length: 4.45,
    width: 1.82,
    height: 1.67,
    wheelbase: 2.63,
    front: 0.88,
    wheel: 0.355,
    track: 1.56,
  },
  van: {
    length: 5.55,
    width: 2.05,
    height: 2.45,
    wheelbase: 3.3,
    front: 1.0,
    wheel: 0.35,
    track: 1.72,
  },
  bus: {
    length: 12,
    width: 2.55,
    height: 3.1,
    wheelbase: 5.9,
    front: 2.7,
    wheel: 0.48,
    track: 2.1,
  },
  bike: {
    length: 1.85,
    width: 0.62,
    height: 1.75,
    wheelbase: 1.1,
    front: 0.38,
    wheel: 0.36,
    track: 0,
  },
};

/** How a vehicle drives: its top speed on each kind of street (a village's
 * 25 km/h, the car park's walking pace, the road out's 50), the sideways
 * pull it takes a bend at (a careful driver on a snowy street — some
 * 15 km/h round a village corner), how hard it pulls away and how gently
 * it slows, and its pace backing out of a bay. A bicycle rides at a winter
 * cyclist's 13 km/h, a little more on the road out. */
export type Drive = {
  street: number;
  aisle: number;
  road: number;
  lateral: number;
  accel: number;
  brake: number;
  reverse: number;
};

export const DRIVES: Readonly<Record<"car" | "bus" | "bike", Drive>> = {
  car: {
    street: 25 / 3.6,
    aisle: 10 / 3.6,
    road: 50 / 3.6,
    lateral: 1.4,
    accel: 1.3,
    brake: 1.7,
    reverse: 1.4,
  },
  bus: {
    street: 22 / 3.6,
    aisle: 10 / 3.6,
    road: 45 / 3.6,
    lateral: 1.1,
    accel: 0.8,
    brake: 1.2,
    reverse: 1,
  },
  bike: {
    street: 13 / 3.6,
    aisle: 8 / 3.6,
    road: 15 / 3.6,
    lateral: 1,
    accel: 0.5,
    brake: 1,
    reverse: 1,
  },
};

/** THE TRAFFIC a village is dealt and how it runs.
 *   * `period`: everything the streets carry comes round again this
 *     often — the bus's timetable and the visitors' coming and going — s.
 *   * `sample`: how finely a plan is checked for two vehicles meeting, s.
 *   * `loop`: cars going round the village's loop, each way, dealt.
 *   * `visitors`: cars in off the road to a bay in the car park, parked a
 *     while (`stay`, s, dealt) and away again.
 *   * `through`: cars in off the road and out again.
 *   * `bikes`: cyclists round the loop; `edge` how far in from the
 *     carriageway's edge a cyclist rides.
 *   * `bus`: the ski bus's stand at the stop, s, dealt.
 *   * `kinds`: the shares of a car's class.
 *   * `parked`: the share of the kerbs' bays taken, and of the car park's
 *     by day (`day`, the lifts' hours) and after (`night`).
 *   * `margin`: the room each vehicle keeps beside it and the gap it
 *     keeps ahead, m and s of its speed, which two vehicles never close.
 *   * `trim`: how far short of a junction's crossing carriageway a lane is
 *     left to turn on, m; `approach`, how far back down an aisle a car
 *     starts its turn into a bay.
 *   * `pass`: how far a car swings out round a cyclist on its lane, m, and
 *     how far ahead and behind of him.
 *   * `signal`: how far ahead a turn lights the indicator, m, and how much
 *     of a turn, rad.
 *   * `reach`: how far round the village its traffic is looked for, m. */
export const TRAFFIC = {
  period: 600,
  sample: 0.25,
  loop: { least: 2, most: 3 },
  visitors: { least: 4, most: 6, stay: { least: 90, most: 300 } },
  through: 2,
  bikes: { least: 3, most: 4, edge: 0.65 },
  bus: { stay: { least: 25, most: 45 } },
  kinds: { hatch: 0.35, estate: 0.2, suv: 0.3, van: 0.15 } as Readonly<
    Record<"hatch" | "estate" | "suv" | "van", number>
  >,
  parked: { kerb: 0.62, day: 0.8, night: 0.3, hours: [8, 17] as const },
  margin: { side: 0.25, gap: 1.2, headway: 0.6 },
  trim: 1.5,
  approach: 6.5,
  pass: { swing: 0.9, ahead: 14, behind: 6 },
  signal: { ahead: 28, turn: 0.6 },
  reach: 250,
} as const;

/** MET BY A VEHICLE (`traffic-contact.ts`): a skier on his skis against a
 * car's, the bus's or a bike's footprint is held off it at a closing
 * speed under `push` (a shuffle), and over it knocked down — off the
 * bodywork at `bounce` of the closing speed. The blow (`body.ts`): at
 * `least` m/s at the least, the bodywork giving `give` m — a car's bumper
 * and bonnet crumple, as a pedestrian's impact is measured — and the bus's
 * flat front `bus` of that. */
export const TRAFFIC_STRIKE = {
  push: 2,
  bounce: 0.3,
  least: 3,
  give: 0.12,
  bus: 0.5,
} as const;
