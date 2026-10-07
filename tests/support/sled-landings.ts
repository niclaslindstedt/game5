// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S LANDINGS ON THE BENCH: a row of staged rides over
// ground shaped by hand (`shapedLevel`) — rollers, whoops, kickers onto
// the flat and onto a landing, banked lips that set it down on its side,
// drops off a ledge, a cliff ridden off and a wall ridden into — each
// ridden by the REAL ENGINE on the rider's own controls, and read back as
// whether the rider was THROWN and what the ride did to the machine. Every
// row says what a rider would expect: a sled ridden on snow, onto snow,
// rides it out; set down on its side, dropped off a height or driven into
// a wall, it throws him. `tests/sled_landing_test.ts` holds each row to its
// expectation; `make sled-land` prints the table.

import {
  NEUTRAL_INPUT,
  createGame,
  standSled,
  step,
  type GameState,
  type Level,
  type SkierInput,
} from "@engine";

import { shapedLevel } from "./synthetic.ts";

/** The strip: 600 m square, the ride straight down its middle along +z. */
const SIZE = 600;
const MID = SIZE / 2;
/** Where every ride starts, and where the feature stands. */
const START = 150;
const AT = 200;

const smooth = (u: number): number => u * u * (3 - 2 * u);

/** A KICKER on the flat: a ramp curving up over `run` m to `rise` m at z =
 * `at` (its lip at `lip` rad), and the ground gone from under it there —
 * down to the flat again, or onto a landing falling at `fall` m/m from the
 * knuckle `table` m past the lip, down to `floor` m (the flat by default). `bank` rad tips
 * the ramp across, its right side high. */
function kicker(o: {
  rise: number;
  lip: number;
  bank?: number;
  table?: number;
  fall?: number;
  floor?: number;
}): (x: number, z: number) => number {
  // A ramp of constant curvature from flat to the lip's angle: its run
  // is what reaches `rise` at that angle.
  const run = (2 * o.rise) / Math.tan(o.lip);
  const bank = Math.tan(o.bank ?? 0);
  const table = o.table ?? -1;
  const fall = o.fall ?? 0;
  const floor = o.floor ?? 0;
  return (x, z) => {
    if (z < AT - run) return 0;
    if (z <= AT) {
      const u = (z - (AT - run)) / run;
      return o.rise * u * u + bank * (x - MID) * smooth(u);
    }
    if (table < 0) return 0;
    if (z <= AT + table) return o.rise;
    return Math.max(floor, o.rise - (z - AT - table) * fall);
  };
}

/** A LEDGE `height` m high, ridden off at z = `AT` onto the flat (or onto a
 * slope falling at `fall` m/m below it). */
function ledge(height: number, fall = 0): (x: number, z: number) => number {
  return (_x, z) => (z < AT ? height : -Math.max(0, z - AT) * fall);
}

/** A KNUCKLE at z = `AT`: the flat rounded over `round` m into a face
 * falling at `fall` m/m, 80 m of it, then the flat again. */
function knuckle(fall: number, round: number): (x: number, z: number) => number {
  return (_x, z) => {
    const u = z - AT;
    if (u <= 0) return 0;
    const drop = u < round ? (fall * u * u) / (2 * round) : fall * (u - round / 2);
    return -Math.min(drop, 80);
  };
}

/** A WALL `height` m high across the strip at z = `AT`, rising at `slope`
 * m/m — a cliff band ridden into. */
function wall(height: number, slope: number): (x: number, z: number) => number {
  return (_x, z) => Math.min(height, Math.max(0, (z - AT) * slope));
}

/** ROLLERS from z = `AT` on: `height` m trough to crest, one every `length`
 * m, for `count` of them. */
function rollers(height: number, length: number, count: number): (x: number, z: number) => number {
  return (_x, z) => {
    const u = z - AT;
    if (u <= 0 || u >= length * count) return 0;
    return (height / 2) * (1 - Math.cos((2 * Math.PI * u) / length));
  };
}

/** One staged ride. `throws` is what a rider would expect: false — he rides
 * it out; true — he is thrown. */
export type SledLanding = {
  id: string;
  what: string;
  ground: (x: number, z: number) => number;
  /** 1 the groomer, 0 powder. */
  packed: number;
  /** The way on at the start, km/h. */
  kmh: number;
  /** The controls held the whole ride — on the snow, the throttle the
   * most he gives it to hold the way he came in at. */
  input: Partial<SkierInput>;
  /** The controls held in the air, in place of `input`'s. */
  inAir?: Partial<SkierInput>;
  /** Full lock one way then the other, a whole swing every `weave` s. */
  weave?: number;
  /** How long it is ridden, s. */
  seconds: number;
  throws: boolean;
};

export const SLED_LANDINGS: SledLanding[] = [
  {
    id: "rollers",
    what: "1 m rollers every 14 m on the groomer, flat out",
    ground: rollers(1, 14, 12),
    packed: 1,
    kmh: 80,
    input: { tuck: 1 },
    seconds: 10,
    throws: false,
  },
  {
    id: "whoops",
    what: "0.7 m whoops every 6 m on the groomer at 60",
    ground: rollers(0.7, 6, 20),
    packed: 1,
    kmh: 60,
    input: { tuck: 0.6 },
    seconds: 8,
    throws: false,
  },
  {
    id: "whoops-powder",
    what: "0.8 m whoops every 8 m in powder at 60",
    ground: rollers(0.8, 8, 16),
    packed: 0,
    kmh: 60,
    input: { tuck: 1 },
    seconds: 8,
    throws: false,
  },
  {
    id: "carve",
    what: "full-lock turns side to side on the groomer at 70",
    ground: () => 0,
    packed: 1,
    kmh: 70,
    input: { tuck: 1 },
    weave: 2.5,
    seconds: 10,
    throws: false,
  },
  {
    id: "carve-powder",
    what: "full-lock turns side to side in powder at 60",
    ground: () => 0,
    packed: 0,
    kmh: 60,
    input: { tuck: 1 },
    weave: 3,
    seconds: 10,
    throws: false,
  },
  {
    id: "sidehill",
    what: "across a 25° powder face at 50, the bars into the hill",
    ground: (x) => (x - MID) * 0.47,
    packed: 0,
    kmh: 50,
    input: { tuck: 1, steer: 0.3 },
    seconds: 8,
    throws: false,
  },
  {
    id: "kicker",
    what: "a 1.5 m kicker onto the flat groomer at 60",
    ground: kicker({ rise: 1.5, lip: 0.45 }),
    packed: 1,
    kmh: 60,
    input: { tuck: 0.5 },
    seconds: 7,
    throws: false,
  },
  {
    id: "kicker-big",
    what: "a 2.5 m kicker onto the flat groomer at 80",
    ground: kicker({ rise: 2.5, lip: 0.5 }),
    packed: 1,
    kmh: 80,
    input: { tuck: 0.5 },
    seconds: 7,
    throws: false,
  },
  {
    id: "kicker-powder",
    what: "a 2.5 m kicker onto flat powder at 80",
    ground: kicker({ rise: 2.5, lip: 0.5 }),
    packed: 0,
    kmh: 80,
    input: { tuck: 0.6 },
    seconds: 7,
    throws: false,
  },
  {
    id: "over-the-edge",
    what: "over the rounded edge of a 30° powder face at 60",
    ground: knuckle(0.58, 6),
    packed: 0,
    kmh: 60,
    input: { tuck: 0.4 },
    seconds: 7,
    throws: false,
  },
  {
    id: "step-down",
    what: "a 1 m kicker at 60 onto a 30° powder landing below it",
    ground: kicker({ rise: 1, lip: 0.2, table: 0, fall: 0.58, floor: -80 }),
    packed: 0,
    kmh: 60,
    input: { tuck: 0.4 },
    seconds: 7,
    throws: false,
  },
  {
    id: "throttle-air",
    what: "a 2.5 m kicker at 80, pinned in the air — the belt's gyro lifting the nose",
    ground: kicker({ rise: 2.5, lip: 0.5 }),
    packed: 1,
    kmh: 80,
    input: { tuck: 0.5 },
    inAir: { tuck: 1 },
    seconds: 7,
    throws: false,
  },
  {
    id: "case",
    what: "a 4 m kicker at 110 onto the flat — cased from a height",
    ground: kicker({ rise: 4, lip: 0.55 }),
    packed: 1,
    kmh: 110,
    input: { tuck: 0.6 },
    seconds: 8,
    throws: true,
  },
  {
    id: "nose-dropped",
    what: "a 2.5 m kicker at 80, the brake held in the air — onto its nose",
    ground: kicker({ rise: 2.5, lip: 0.5 }),
    packed: 1,
    kmh: 80,
    input: { tuck: 0.5 },
    inAir: { brake: 1 },
    seconds: 7,
    throws: true,
  },
  {
    id: "looped",
    what: "a 2.5 m kicker at 80, thrown back in the air — looped",
    ground: kicker({ rise: 2.5, lip: 0.5 }),
    packed: 1,
    kmh: 80,
    input: { tuck: 0.5 },
    inAir: { tuck: 1, lean: 1 },
    seconds: 7,
    throws: true,
  },
  {
    id: "banked",
    what: "a 2 m kicker banked 10° across, at 70",
    ground: kicker({ rise: 2, lip: 0.45, bank: 0.17 }),
    packed: 1,
    kmh: 70,
    input: { tuck: 0.5 },
    seconds: 7,
    throws: false,
  },
  {
    id: "rolled-off",
    what: "a 1.2 m kicker banked 45° across, at 70 — set down on its side",
    ground: kicker({ rise: 1.2, lip: 0.45, bank: 1 }),
    packed: 1,
    kmh: 80,
    input: { tuck: 0.5 },
    seconds: 7,
    throws: true,
  },
  {
    id: "drop",
    what: "off a 2.5 m ledge onto the flat groomer at 40",
    ground: ledge(2.5),
    packed: 1,
    kmh: 40,
    input: { tuck: 0.3 },
    seconds: 6,
    throws: false,
  },
  {
    id: "drop-powder",
    what: "off a 4 m ledge into flat powder at 40",
    ground: ledge(4),
    packed: 0,
    kmh: 40,
    input: { tuck: 0.5 },
    seconds: 6,
    throws: false,
  },
  {
    id: "drop-slope",
    what: "off a 6 m ledge onto a 35° slope below it at 50",
    ground: ledge(6, 0.7),
    packed: 0,
    kmh: 50,
    input: { tuck: 0.3 },
    seconds: 6,
    throws: false,
  },
  {
    id: "drop-high",
    what: "off a 10 m ledge onto the flat groomer at 50",
    ground: ledge(10),
    packed: 1,
    kmh: 50,
    input: { tuck: 0.3 },
    seconds: 6,
    throws: true,
  },
  {
    id: "cliff",
    what: "off a 25 m cliff into flat powder at 60",
    ground: ledge(25),
    packed: 0,
    kmh: 60,
    input: { tuck: 0.3 },
    seconds: 7,
    throws: true,
  },
  {
    id: "bank",
    what: "straight up a 40° powder bank at 60",
    ground: wall(40, 0.84),
    packed: 0,
    kmh: 60,
    input: { tuck: 1 },
    seconds: 6,
    throws: false,
  },
  {
    id: "wall-crawl",
    what: "into a 6 m rock wall at 20 — stopped against it",
    ground: wall(6, 6),
    packed: 1,
    kmh: 20,
    input: { tuck: 0.3 },
    seconds: 12,
    throws: false,
  },
  {
    id: "wall",
    what: "into a 6 m rock wall at 70",
    ground: wall(6, 6),
    packed: 1,
    kmh: 70,
    input: { tuck: 1 },
    seconds: 5,
    throws: true,
  },
];

/** What a staged ride did. */
export type SledLandingResult = {
  id: string;
  thrown: boolean;
  /** When he was thrown, s, or −1. */
  at: number;
  /** The longest flight, s. */
  air: number;
  /** The hardest landing's closing speed into the snow, m/s. */
  impact: number;
  /** The most the machine rolled and pitched, degrees. */
  roll: number;
  pitch: number;
  /** The way on at the end (or when he was thrown), km/h. */
  kmh: number;
};

/** The level a row is ridden on, built once a row. */
const levels = new Map<string, Level>();

export function landingLevel(row: SledLanding): Level {
  let lv = levels.get(row.id);
  if (!lv) {
    lv = shapedLevel(row.ground, { packed: row.packed, size: SIZE });
    levels.set(row.id, lv);
  }
  return lv;
}

/** Ride `row` and read it back. */
export function rideLanding(row: SledLanding): SledLandingResult {
  const level = landingLevel(row);
  const s: GameState = createGame({ level, mode: "free", sled: true, crowd: 0, quiet: true });
  const sled = s.sled!;
  const v = row.kmh / 3.6;
  standSled(s, sled, MID, START, 0);
  sled.vz = v;
  sled.treadSpeed = v;
  const ground: SkierInput = { ...NEUTRAL_INPUT, ...row.input };
  const air: SkierInput = { ...ground, ...row.inAir };
  // THE RIDER'S THUMB: on the snow he holds the way he came in at (the
  // row's throttle the most he gives it); in the air it stays where it was
  // unless the row says otherwise — the belt's gyro is his to use there.
  const most = ground.tuck;
  let thumb = most;
  const out: SledLandingResult = {
    id: row.id,
    thrown: false,
    at: -1,
    air: 0,
    impact: 0,
    roll: 0,
    pitch: 0,
    kmh: 0,
  };
  const steps = Math.round(row.seconds * 120);
  for (let i = 0; i < steps; i++) {
    let input: SkierInput;
    if (sled.airborne) input = row.inAir ? air : { ...ground, tuck: thumb };
    else {
      thumb = Math.min(most, Math.max(0, (v - sled.way) * 0.8 + 0.25));
      // A quarter swing first, so the heading swings about the way it came
      // in on and the line keeps to the strip's middle.
      const swing = row.weave ? (Math.cos((2 * Math.PI * s.t) / row.weave) >= 0 ? 1 : -1) : 0;
      input = { ...ground, tuck: thumb, steer: row.weave ? swing : ground.steer };
    }
    step(s, input);
    for (const e of s.events) {
      if (e.kind === "land") {
        out.air = Math.max(out.air, e.airTime);
        out.impact = Math.max(out.impact, e.impact);
      }
      if (e.kind === "sled" && e.phase === "crash" && !out.thrown) {
        out.thrown = true;
        out.at = s.t;
      }
    }
    if (out.thrown) break;
    out.roll = Math.max(out.roll, Math.abs(sled.roll) * (180 / Math.PI));
    out.pitch = Math.max(out.pitch, Math.abs(sled.pitch) * (180 / Math.PI));
  }
  out.kmh = sled.speed * 3.6;
  return out;
}
