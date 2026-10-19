// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI PATROL AT THE SCENE, PLANNED — the four patrollers of a rescue by
// snowmobile (`rescue-sled-route.ts` plans the machines, `rescue-sled.ts`
// places them) at every moment of the call: riding up two to a machine,
// stepping off, fetching the board out of the toboggan, the scoop and the
// carry, him lowered into the toboggan and lashed in, and back on the
// machines by the time the convoy leaves. Three-free and DOM-free, a pure
// function of the call's clock, so the suite reads it; the view poses the
// figures and seats the riders off it.
//
// THE WORK reuses the air ambulance's: the scoop (`scoopAt`) and the carry
// (`tripAt`) run on a `RescuePlan` of our own whose carry ends with the
// stretcher's middle over the toboggan's, along its heading, and the walk
// with the board is the flight's lead (`onLead`): the two who carry it take
// it out of the toboggan facing up the hill, walk up past him, turn in a
// wide arc behind him and come down to him as the scoop walks up — he is
// scooped from behind, as the air crew scoop him, and the board never
// swings over him. The two who tend him walk round the toboggan and the
// machines to his far side and wait there. Everyone walks round a machine,
// the toboggan and him (`route`, a shortest way past their corners), never
// through them.
//
// THE SEATS: the two who carry the board ride the first machine (the one
// that tows), the two who tend him the second, each on the same seat both
// ways. A machine STOLEN while it stands, the work goes on; when it is time
// to go back to it, its two walk clear a few metres instead and stand
// watching (the other machine's two seats are its own riders'), and the
// toboggan, with neither machine left, stays where it is with all four by
// it. The research is `docs/rescue.md`.

import {
  RESCUE_SLEDS,
  freshSledsFrame,
  fromEuler,
  rescueSledsAt,
  rotate,
  sledCallGone,
  type Level,
  type RescueSledPlan,
  type RescueSledsFrame,
  type SledPark,
} from "@engine";

import { RESCUE_STRIDE, railOf, type CrewMove } from "./rescue-crew.ts";
import {
  BEARERS,
  LEVEL_MOST,
  RESCUE,
  S,
  clamp,
  ease,
  freshRescueFrame,
  fwdOf,
  hy,
  rightOf,
  wrap,
  type CrewPose,
  type P2,
  type RescueFrame,
  type RescuePlan,
} from "./rescue-defs.ts";
import { leadAt, onLead, smoothPath, type FlightTrip } from "./rescue-flight.ts";
import { handIn, scoopClock, tripAt } from "./rescue-plan.ts";
import { ON_SNOW, casualtyOn, scoopAt } from "./rescue-scoop.ts";

const K = RESCUE_SLEDS;
const Q = RESCUE.scoop;

/** The patrol's numbers at the scene, m, s, m/s. */
export const SLED_CREW = {
  /** WHERE THEY SIT on a machine: along from its middle (+ ahead) and the
   * seat's height over the snow, m. */
  seats: {
    driver: { along: 0.1, up: 0.8 },
    passenger: { along: -0.6, up: 0.88 },
  },
  /** How far out past a machine's side a rider stands to get on or off it, m. */
  step: 0.55,
  /** The toboggan's floor over the snow, m. */
  floor: 0.25,
  /** A brisk walk with the hands free, and two walking the board between
   * them, m/s. */
  walk: 1.4,
  board: 1.3,
  /** Seconds each part takes: off the seat and on it, the board taken out
   * of the toboggan, a turn on the spot, him lowered into the toboggan, its
   * straps (as many as the board's, `RESCUE.scoop.straps`) and stood up. */
  time: { off: 1.5, on: 1.5, take: 1.6, turn: 0.8, lower: 1.6, lash: 3.6, stand: 1.0 },
  /** The room a walker keeps from a machine, the toboggan and him, m. */
  room: 0.25,
  /** THE WALK WITH THE BOARD: the least radius it turns behind him on, m,
   * and how far behind the scoop's formation the turn starts, m. */
  round: 1.2,
  behind: 2.2,
  /** THE CARRY's straight into the toboggan, m. */
  run: 1.8,
  /** How far back from a machine's side the two whose machine is gone stand
   * to watch, m. */
  watch: 3.5,
} as const;

const C = SLED_CREW;

/** Where a patroller rides: which machine (0 the one that tows) and which
 * seat. */
export type SledSeat = { sled: 0 | 1; place: "driver" | "passenger" };

/** EACH OF THE FOUR'S SEAT, in `BEARERS`' order: the two who carry the board
 * (`across > 0`) on the first machine, the two who tend him on the second. */
export const SLED_SEATS: readonly SledSeat[] = [
  { sled: 1, place: "passenger" },
  { sled: 0, place: "passenger" },
  { sled: 1, place: "driver" },
  { sled: 0, place: "driver" },
];

/** THE MOMENT: the machines and the toboggan (`rescueSledsAt`), the four,
 * each one's seat while he rides (`on` 1 sat … 0 stood off it — the view
 * poses him sat on that machine, his `CrewPose` the seat's top under him),
 * the stretcher and him, and how many of the toboggan's straps are done up. */
export type SledCrewFrame = {
  sleds: RescueSledsFrame;
  crew: CrewPose[];
  seats: ((SledSeat & { on: number }) | null)[];
  stretcher: RescueFrame["stretcher"];
  casualty: RescueFrame["casualty"];
  lashed: number;
};

export function freshSledCrewFrame(): SledCrewFrame {
  const f = freshRescueFrame();
  return {
    sleds: freshSledsFrame(),
    crew: f.crew,
    seats: BEARERS.map(() => null),
    stretcher: f.stretcher,
    casualty: f.casualty,
    lashed: 0,
  };
}

type Lead = FlightTrip["lead"];

/** ONE WALK: its way, when it sets out, its pace, the heading he had
 * before it and the stride he reaches its end on. */
type Leg = { way: Lead; from: number; pace: number; h0: number; stride: number };

/** One patroller's own part: his seat, where he steps off and gets on, his
 * walk to the work, his walk back (and the one to stand watching instead),
 * and when he is sat again. */
type Part = {
  seat: SledSeat;
  off: P2;
  on: P2;
  watch: P2;
  toWork: Leg;
  back: Leg;
  clear: Leg;
  seated: number;
};

/** THE CREW'S PLAN for one call, worked out once (`crewPlanOf`). */
export type SledCrewPlan = {
  /** The scoop and the carry, its clock 0 the scoop's (`scoopAt`). */
  rescue: RescuePlan;
  /** The scoop's clock the four join it at. */
  entry: number;
  /** The walk with the board, from the toboggan to the scoop's formation,
   * and its origin (the two carriers' middle as the scoop is joined). */
  lead: Lead;
  origin: P2;
  /** Where the toboggan is left beside him. */
  toboggan: SledPark;
  /** The scoop's first moment they are in. */
  formation: RescueFrame;
  /** The carry's last moment (him held over the toboggan). */
  held: RescueFrame;
  /** The call's clock each part starts at: the board taken, the walk with
   * it, the scoop joined, him over the toboggan, lowered in, lashed, all
   * four stood up, and the last of them sat. */
  at: {
    take: number;
    lead: number;
    scoop: number;
    raise: number;
    lowered: number;
    lashed: number;
    up: number;
    done: number;
  };
  parts: Part[];
  /** Him as he was found, the stretcher's bed in the toboggan. */
  found: RescueFrame["casualty"];
};

/** The toboggan's bed: the stretcher's pose lying in it at `p` (turned end
 * for end when `flip` — the empty board rides up head-end first), pitched
 * and rolled to the snow under its runners. */
function bedOf(
  level: Level,
  p: SledPark,
  flip: boolean,
  out: RescueFrame["stretcher"],
): RescueFrame["stretcher"] {
  const h = p.heading + (flip ? Math.PI : 0);
  const f = fwdOf(h);
  const rt = rightOf(h);
  const L = K.toboggan.length / 2 - 0.15;
  const W = K.toboggan.width / 2 - 0.05;
  const g = (a: number, l: number): number =>
    level.groundAt(p.x + f.x * a + rt.x * l, p.z + f.z * a + rt.z * l);
  const lf = g(L, -W);
  const rf = g(L, W);
  const lb = g(-L, -W);
  const rb = g(-L, W);
  out.x = p.x;
  out.z = p.z;
  out.y = (lf + rf + lb + rb) / 4 + C.floor + ON_SNOW;
  out.heading = h;
  out.pitch = Math.atan2((lf + rf - lb - rb) / 2, 2 * L);
  out.roll = Math.atan2((lf + lb - rf - rb) / 2, 2 * W);
  return out;
}

// THE WAY ROUND: everything at the scene stands square to the toboggan's
// heading, so the obstacles are boxes in its frame (a ahead, l to the
// right of where he lay), and a walk is the shortest way past their
// corners.

type Loc = { a: number; l: number };
type Box = { a0: number; a1: number; l0: number; l1: number };

const grow = (b: Box, m: number): Box => ({
  a0: b.a0 - m,
  a1: b.a1 + m,
  l0: b.l0 - m,
  l1: b.l1 + m,
});
const inBox = (p: Loc, b: Box): boolean => p.a > b.a0 && p.a < b.a1 && p.l > b.l0 && p.l < b.l1;

/** Whether the segment p–q passes through the inside of `b`. */
function crosses(p: Loc, q: Loc, b: Box): boolean {
  let t0 = 0;
  let t1 = 1;
  const da = q.a - p.a;
  const dl = q.l - p.l;
  const sides: [number, number][] = [
    [-da, p.a - b.a0],
    [da, b.a1 - p.a],
    [-dl, p.l - b.l0],
    [dl, b.l1 - p.l],
  ];
  for (const [den, num] of sides) {
    if (den === 0) {
      if (num <= 0) return false;
    } else if (den < 0) t0 = Math.max(t0, num / den);
    else t1 = Math.min(t1, num / den);
  }
  return t0 < t1 - 1e-9;
}

/** THE SHORTEST WAY from `p` to `q` past `boxes` (each kept `room` off):
 * through their corners, a box either end stands in let be. */
function route(p: Loc, q: Loc, boxes: readonly Box[]): Loc[] {
  const big = boxes.map((b) => grow(b, C.room)).filter((b) => !inBox(p, b) && !inBox(q, b));
  const nodes: Loc[] = [p, q];
  for (const b of big) {
    const o = grow(b, 0.05);
    for (const c of [
      { a: o.a0, l: o.l0 },
      { a: o.a0, l: o.l1 },
      { a: o.a1, l: o.l0 },
      { a: o.a1, l: o.l1 },
    ]) {
      if (!big.some((x) => inBox(c, x))) nodes.push(c);
    }
  }
  const n = nodes.length;
  const dist = new Array<number>(n).fill(Infinity);
  const prev = new Array<number>(n).fill(-1);
  const done = new Array<boolean>(n).fill(false);
  dist[0] = 0;
  for (;;) {
    let i = -1;
    for (let k = 0; k < n; k++) if (!done[k] && (i < 0 || dist[k] < dist[i])) i = k;
    if (i < 0 || dist[i] === Infinity || i === 1) break;
    done[i] = true;
    for (let k = 0; k < n; k++) {
      if (done[k]) continue;
      if (big.some((b) => crosses(nodes[i], nodes[k], b))) continue;
      const d = dist[i] + hy(nodes[k].a - nodes[i].a, nodes[k].l - nodes[i].l);
      if (d < dist[k]) {
        dist[k] = d;
        prev[k] = i;
      }
    }
  }
  if (prev[1] < 0) return [p, q];
  const out: Loc[] = [];
  for (let k = 1; k >= 0; k = prev[k]) out.push(nodes[k]);
  return out.reverse();
}

/** The scene's frame: where he lay, the toboggan's heading. */
type Scene = { o: P2; f: P2; rt: P2; h: number };

const toWorld = (s: Scene, p: Loc): P2 => ({
  x: s.o.x + s.f.x * p.a + s.rt.x * p.l,
  z: s.o.z + s.f.z * p.a + s.rt.z * p.l,
});
const toLoc = (s: Scene, p: P2): Loc => ({
  a: (p.x - s.o.x) * s.f.x + (p.z - s.o.z) * s.f.z,
  l: (p.x - s.o.x) * s.rt.x + (p.z - s.o.z) * s.rt.z,
});

/** A walk from `p` to `q` round `boxes`, lightly rounded at its corners. */
function walkWay(s: Scene, p: P2, q: P2, boxes: readonly Box[]): Lead {
  const pts = route(toLoc(s, p), toLoc(s, q), boxes).map((l) => toWorld(s, l));
  return smoothPath(pts, 0.35);
}

/** A machine's or the toboggan's plan as a box in the scene's frame. */
function boxOf(s: Scene, p: SledPark, length: number, width: number): Box {
  const c = toLoc(s, p);
  return { a0: c.a - length / 2, a1: c.a + length / 2, l0: c.l - width / 2, l1: c.l + width / 2 };
}

/** Where a seat is on a machine at `p`. */
function seatOf(level: Level, p: SledPark, seat: SledSeat): { x: number; y: number; z: number } {
  const s = C.seats[seat.place];
  const f = fwdOf(p.heading);
  const x = p.x + f.x * s.along;
  const z = p.z + f.z * s.along;
  return { x, y: level.groundAt(x, z) + s.up, z };
}

/** Where a rider stands beside his seat, out on side `side` (+1 the
 * machine's right). */
function besideOf(p: SledPark, seat: SledSeat, side: number): P2 {
  const s = C.seats[seat.place];
  const f = fwdOf(p.heading);
  const rt = rightOf(p.heading);
  const out = side * (K.sled.width / 2 + C.step);
  return { x: p.x + f.x * s.along + rt.x * out, z: p.z + f.z * s.along + rt.z * out };
}

/** THE CREW'S PLAN for a call to a skier who lay at `casualty`. */
export function planSledCrew(
  level: Level,
  plan: RescueSledPlan,
  casualty: { x: number; z: number },
): SledCrewPlan {
  const tob = plan.toboggan;
  const h = tob.heading;
  const scene: Scene = { o: { x: casualty.x, z: casualty.z }, f: fwdOf(h), rt: rightOf(h), h };
  const T0 = toLoc(scene, tob);
  // THE CARRY: away from him along the toboggan's heading, a smooth S out
  // to its side, and straight in over it for its last metres.
  const run = Math.min(C.run, Math.max(0.6, T0.a - 2));
  const E = { a: T0.a - run, l: T0.l };
  const k = E.a * 0.4;
  const pts: P2[] = [];
  const N = 64;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const w1 = 3 * u * (1 - u) ** 2;
    const w2 = 3 * u * u * (1 - u);
    const w3 = u ** 3;
    pts.push(toWorld(scene, { a: w1 * k + w2 * (E.a - k) + w3 * E.a, l: (w2 + w3) * E.l }));
  }
  const M = Math.max(2, Math.ceil(run / 0.25));
  for (let i = 1; i <= M; i++) pts.push(toWorld(scene, { a: E.a + (run * i) / M, l: T0.l }));
  const s = [0];
  for (let i = 1; i < pts.length; i++)
    s.push(s[i - 1] + hy(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  const length = s[s.length - 1];
  const { scoop, rise } = scoopClock();
  const carry = rise + RESCUE.time.rise;
  const raise = carry + length / RESCUE.walk;
  const bed = bedOf(level, tob, false, { ...freshRescueFrame().stretcher });
  const never = Infinity;
  const rescue: RescuePlan = {
    spot: { x: casualty.x, y: level.groundAt(casualty.x, casualty.z), z: casualty.z },
    site: {
      x: tob.x,
      y: level.groundAt(tob.x, tob.z),
      z: tob.z,
      heading: h,
      pitch: 0,
      roll: 0,
      side: 1,
    },
    away: h,
    out: { x: 0, z: 0 },
    floor: bed.y,
    path: { pts, s, length },
    walk: RESCUE.walk,
    beside: RESCUE.scoop.beside,
    end: { x: tob.x, z: tob.z },
    cabin: { x: tob.x, z: tob.z },
    at: {
      scoop,
      rise,
      carry,
      raise,
      inch: never,
      climb: never,
      slide: never,
      clear: never,
      lift: never,
      gone: never,
    },
  };
  // THE SCOOP'S FORMATION as its walk-up ends, and the walk with the board
  // into it: its origin the two carriers' middle.
  const entry = Q.approach / Q.pace;
  const formation = scoopAt(level, rescue, entry, freshRescueFrame());
  const carriers = [0, 1, 2, 3].filter((j) => BEARERS[j].across > 0);
  const tenders = [0, 1, 2, 3].filter((j) => BEARERS[j].across < 0);
  const O = {
    x: (formation.crew[carriers[0]].x + formation.crew[carriers[1]].x) / 2,
    z: (formation.crew[carriers[0]].z + formation.crew[carriers[1]].z) / 2,
  };
  const fs = formation.stretcher;
  const alongB = (fs.x - O.x) * scene.f.x + (fs.z - O.z) * scene.f.z;
  const acrossB = (fs.x - O.x) * scene.rt.x + (fs.z - O.z) * scene.rt.z;
  // Taken out of the toboggan facing up the hill, the board in it at their
  // side; up past him, round behind him and down onto the walk-up.
  const P0 = { a: T0.a + alongB, l: T0.l + acrossB };
  const Ol = toLoc(scene, O);
  const lane =
    P0.l >= Ol.l ? Math.max(P0.l, Ol.l + 2 * C.round) : Math.min(P0.l, Ol.l - 2 * C.round);
  const aT = Ol.a - C.behind;
  const raw: Loc[] = [P0, { a: P0.a - 1.2, l: P0.l }];
  if (lane !== P0.l && P0.a - 1.2 > aT + 0.6) raw.push({ a: aT + 0.6, l: lane });
  const mid = (lane + Ol.l) / 2;
  const R = Math.abs(lane - Ol.l) / 2;
  for (let i = 0; i <= 12; i++) {
    const th = (i / 12) * Math.PI;
    raw.push({ a: aT - R * Math.sin(th), l: mid + (lane - mid) * Math.cos(th) });
  }
  raw.push(Ol);
  const lead = smoothPath(
    raw.map((p) => toWorld(scene, p)),
    0.5,
  );
  // THE SCENE'S SOLIDS: the two machines, the tow bar, the toboggan, him.
  const m0 = plan.park[0];
  const m1 = plan.park[1];
  const sleds = [
    boxOf(scene, m0, K.sled.length, K.sled.width),
    boxOf(scene, m1, K.sled.length, K.sled.width),
    boxOf(scene, tob, K.toboggan.length, K.toboggan.width),
  ];
  const bar = toLoc(scene, m0);
  sleds.push({ a0: T0.a, a1: bar.a, l0: T0.l - 0.1, l1: T0.l + 0.1 });
  const him: Box = { a0: -1.0, a1: 1.0, l0: Q.lies - 0.45, l1: Q.lies + 0.45 };
  // Which way the second machine is from the first: its two step off
  // toward it, and get on from there.
  const inward = Math.sign((m0.x - m1.x) * scene.rt.x + (m0.z - m1.z) * scene.rt.z) || 1;
  const sideOf = (seat: SledSeat, getOn: boolean): number =>
    seat.sled === 1 ? inward : getOn ? 1 : -1;
  const parts: Part[] = [];
  const offDone = [plan.parked[0] + C.time.off, plan.parked[1] + C.time.off];
  // THE WALKS TO THE WORK.
  const leadFrom0 = (j: number) => {
    const at = onLead(lead, 0, O, h, formation.crew[j]);
    return { x: at.x, z: at.z };
  };
  const leadStride = (j: number): number =>
    formation.crew[j].move.stride - lead.length / RESCUE_STRIDE;
  for (let j = 0; j < BEARERS.length; j++) {
    const seat = SLED_SEATS[j];
    const p = plan.park[seat.sled];
    const off = besideOf(p, seat, sideOf(seat, false));
    const on = besideOf(p, seat, sideOf(seat, true));
    const watch = { x: on.x - scene.f.x * C.watch, z: on.z - scene.f.z * C.watch };
    const carrier = BEARERS[j].across > 0;
    const goal = carrier ? leadFrom0(j) : formation.crew[j];
    const toWork: Leg = {
      way: walkWay(scene, off, goal, [...sleds, him]),
      from: offDone[seat.sled],
      pace: C.walk,
      h0: p.heading,
      stride: carrier ? leadStride(j) : formation.crew[j].move.stride,
    };
    const blank: Leg = { way: smoothPath([off, off]), from: 0, pace: C.walk, h0: h, stride: 0 };
    parts.push({ seat, off, on, watch, toWork, back: blank, clear: blank, seated: Infinity });
  }
  const arrive = (j: number): number => parts[j].toWork.from + parts[j].toWork.way.length / C.walk;
  const take = Math.max(...carriers.map(arrive));
  const ready = Math.max(...tenders.map((j) => arrive(j) + C.time.turn));
  const leadTime = lead.length / C.board;
  const leadAt0 = Math.max(take + C.time.take, ready - leadTime);
  const scoopStart = leadAt0 + leadTime;
  const raiseAt = scoopStart + (raise - entry);
  const lowered = raiseAt + C.time.lower;
  const lashed = lowered + C.time.lash;
  const up = lashed + C.time.stand;
  const held = tripAt(level, rescue, raise, freshRescueFrame());
  const cp: SledCrewPlan = {
    rescue,
    entry,
    lead,
    origin: O,
    toboggan: tob,
    formation,
    held,
    at: { take, lead: leadAt0, scoop: scoopStart, raise: raiseAt, lowered, lashed, up, done: 0 },
    parts,
    found: { ...scoopAt(level, rescue, -1, freshRescueFrame()).casualty },
  };
  // THE WALKS BACK, from where each stood up beside the toboggan.
  const stood = freshSledCrewFrame();
  inToboggan(level, cp, up, stood);
  let done = 0;
  for (let j = 0; j < BEARERS.length; j++) {
    const part = parts[j];
    const c = stood.crew[j];
    const from = { x: c.x, z: c.z };
    const leg = (to: P2): Leg => {
      const way = walkWay(scene, from, to, sleds);
      return {
        way,
        from: up,
        pace: C.walk,
        h0: c.heading,
        stride: c.move.stride + way.length / RESCUE_STRIDE,
      };
    };
    part.back = leg(part.on);
    part.clear = leg(part.watch);
    part.seated = up + part.back.way.length / C.walk + C.time.on;
    done = Math.max(done, part.seated);
  }
  cp.at.done = done;
  return cp;
}

const plans = new WeakMap<RescueSledPlan, { x: number; z: number; cp: SledCrewPlan }>();

/** The crew's plan for a call, worked out once per call and casualty. */
export function crewPlanOf(
  level: Level,
  plan: RescueSledPlan,
  casualty: { x: number; z: number },
): SledCrewPlan {
  const kept = plans.get(plan);
  if (kept && kept.x === casualty.x && kept.z === casualty.z) return kept.cp;
  const cp = planSledCrew(level, plan, casualty);
  plans.set(plan, { x: casualty.x, z: casualty.z, cp });
  return cp;
}

/** A free walker's move: stood (`walking` 0) or striding. */
function freeMove(stride: number, walking: number): CrewMove {
  return { rise: 1, stride, walking, hand: null, raise: 0 };
}

/** Somebody on `leg` at `t`: where he is, his heading — turned onto the
 * way as he sets out, and onto `end` once there — and his stride. */
function walkOn(level: Level, leg: Leg, t: number, end: number | null, c: CrewPose): void {
  const L = leg.way.length;
  const arc = clamp((t - leg.from) * leg.pace, 0, L);
  const p = leadAt(leg.way, arc);
  c.x = p.x;
  c.z = p.z;
  c.y = level.groundAt(p.x, p.z);
  const turn = (a: number, b: number, from: number): number =>
    a + wrap(b - a) * ease((t - from) / C.time.turn);
  if (arc < L || end === null) c.heading = L > 0.05 ? turn(leg.h0, p.heading, leg.from) : leg.h0;
  else {
    const there = leg.from + L / leg.pace;
    c.heading = turn(L > 0.05 ? p.heading : leg.h0, end, there);
  }
  c.move = freeMove(leg.stride - (L - arc) / RESCUE_STRIDE, arc > 0 && arc < L ? 1 : 0);
  c.shown = true;
}

/** HIM LOWERED INTO THE TOBOGGAN `t` on the call's clock (from the carry's
 * end to all four stood up): the stretcher let down from their hands into
 * its bed, the four crouched to it at its corners, its straps done up, and
 * them stood up. */
function inToboggan(level: Level, cp: SledCrewPlan, t: number, out: SledCrewFrame): void {
  const A = cp.at;
  const u = ease((t - A.raise) / C.time.lower);
  const from = cp.held.stretcher;
  const bed = bedOf(level, cp.toboggan, false, out.stretcher);
  const st = out.stretcher;
  st.x = from.x + (bed.x - from.x) * u;
  st.y = from.y + (bed.y - from.y) * u;
  st.z = from.z + (bed.z - from.z) * u;
  st.heading = from.heading + wrap(bed.heading - from.heading) * u;
  st.pitch = from.pitch + (bed.pitch - from.pitch) * u;
  st.roll = from.roll + (bed.roll - from.roll) * u;
  st.shown = true;
  st.straps = Q.straps;
  casualtyOn(st, out.casualty);
  out.lashed = Math.min(
    Q.straps,
    Math.floor(clamp((t - A.lowered) / C.time.lash, 0, 1) * Q.straps + 0.34),
  );
  const q = fromEuler(st.heading, st.pitch, st.roll);
  const f = fwdOf(st.heading);
  const rt = rightOf(st.heading);
  const standing = ease((t - A.lashed) / C.time.stand);
  for (let j = 0; j < BEARERS.length; j++) {
    const b = BEARERS[j];
    const c = out.crew[j];
    const was = cp.held.crew[j];
    const corner = rotate(q, { x: b.across * S.rail, y: 0, z: b.along * S.along });
    const ground = level.groundAt(was.x, was.z);
    const need = st.y + corner.y - ground;
    // Crouched as low as the rail is: the rise (knelt … stood), and past
    // the stood hold, the hand raised.
    const r0 = railOf(b.body, 0, 0);
    const r1 = railOf(b.body, 1, 0);
    let rise = clamp((need - r0) / (r1 - r0), 0, 1);
    let raise = 0;
    if (rise >= 1) {
      const span = railOf(b.body, 1, 1) - r1;
      raise = clamp((need - r1) / span, -LEVEL_MOST, LEVEL_MOST);
    }
    rise += (1 - rise) * standing;
    raise *= 1 - standing;
    const hand = handIn(rise);
    const cx = st.x + rt.x * b.across * S.rail + f.x * b.along * S.along;
    const cz = st.z + rt.z * b.across * S.rail + f.z * b.along * S.along;
    c.x = cx + rt.x * b.across * hand.x - f.x * hand.z;
    c.z = cz + rt.z * b.across * hand.x - f.z * hand.z;
    c.y = level.groundAt(c.x, c.z);
    c.heading = st.heading;
    c.shown = true;
    c.move = { rise, stride: was.move.stride, walking: 0, hand: b.hand, raise };
  }
}

/** When machine `k` was stolen on the call's clock, or Infinity. */
function takenAt(taken: readonly (number | null)[] | undefined, k: number): number {
  const v = taken?.[k];
  return v === null || v === undefined ? Infinity : v;
}

const scratch = freshSledCrewFrame();
const tripFrame = freshRescueFrame();

/** Someone sat on machine `k` as it stands in `sleds` (or as it stood
 * parked): his seat's place, the machine's heading. */
function sat(level: Level, p: SledPark, seat: SledSeat, shown: boolean, c: CrewPose): void {
  const at = seatOf(level, p, seat);
  c.x = at.x;
  c.y = at.y;
  c.z = at.z;
  c.heading = p.heading;
  c.move = freeMove(0, 0);
  c.shown = shown;
}

/** Between a seat and a stand beside it, `u` of the way (0 sat, 1 stood). */
function stepping(level: Level, p: SledPark, seat: SledSeat, stand: P2, u: number, c: CrewPose) {
  const at = seatOf(level, p, seat);
  const e = ease(u);
  c.x = at.x + (stand.x - at.x) * e;
  c.z = at.z + (stand.z - at.z) * e;
  const g = level.groundAt(c.x, c.z);
  c.y = at.y + (g - at.y) * ease(u / 0.7);
  c.heading = p.heading;
  c.move = freeMove(0, 0);
  c.shown = true;
}

/**
 * THE PATROL AT THE SCENE `t` s into the call (its clock): the machines
 * and the toboggan (the ones in `taken` stolen from the moment each was),
 * the four, their seats, the stretcher and him, written into `out`.
 */
export function sledCrewAt(
  level: Level,
  plan: RescueSledPlan,
  casualty: { x: number; z: number },
  taken: readonly (number | null)[] | undefined,
  t: number,
  out: SledCrewFrame,
): SledCrewFrame {
  const cp = crewPlanOf(level, plan, casualty);
  const A = cp.at;
  const fr = rescueSledsAt(plan, taken, t, out.sleds);
  const gone = t >= sledCallGone(plan, taken);
  out.lashed = 0;
  // THE STRETCHER AND HIM.
  const tob = fr.toboggan;
  if (t >= A.raise) {
    if (t < A.up) inToboggan(level, cp, t, out);
    else {
      bedOf(level, tob, false, out.stretcher);
      out.stretcher.shown = tob.shown;
      out.stretcher.straps = Q.straps;
      casualtyOn(out.stretcher, out.casualty);
      out.lashed = Q.straps;
    }
  } else if (t >= A.scoop) {
    tripAt(level, cp.rescue, t - A.scoop + cp.entry, tripFrame);
    Object.assign(out.stretcher, tripFrame.stretcher);
    Object.assign(out.casualty, tripFrame.casualty);
  } else {
    Object.assign(out.casualty, cp.found);
    boardBefore(level, cp, t, tob, out);
  }
  out.casualty.shown &&= !gone;
  out.stretcher.shown &&= !gone;
  // THE FOUR.
  for (let j = 0; j < BEARERS.length; j++) {
    crewOne(level, plan, cp, taken, j, t, out);
    if (gone) out.crew[j].shown = false;
  }
  return out;
}

/** The board before the scoop: in the toboggan (head end first), taken out
 * by its two, held, and walked round to him. */
function boardBefore(
  level: Level,
  cp: SledCrewPlan,
  t: number,
  tob: SledPark & { shown: boolean },
  out: SledCrewFrame,
): void {
  const A = cp.at;
  const st = out.stretcher;
  const fs = cp.formation.stretcher;
  const lift = fs.y - level.groundAt(fs.x, fs.z);
  const h = cp.rescue.site.heading;
  const arc = t < A.lead ? 0 : clamp((t - A.lead) * C.board, 0, cp.lead.length);
  const at = onLead(cp.lead, arc, cp.origin, h, fs);
  const held = {
    x: at.x,
    z: at.z,
    y: level.groundAt(at.x, at.z) + lift,
    heading: fs.heading + at.turn,
  };
  const p = t - A.take;
  bedOf(level, tob, true, st);
  st.shown = tob.shown;
  st.straps = 0;
  if (p < C.time.take * 0.55) return;
  const u = ease((p - C.time.take * 0.55) / (C.time.take * 0.45));
  st.x += (held.x - st.x) * u;
  st.z += (held.z - st.z) * u;
  st.y += (held.y - st.y) * u;
  st.heading += wrap(held.heading - st.heading) * u;
  st.pitch += (fs.pitch - st.pitch) * u;
  st.roll += (fs.roll - st.roll) * u;
  st.shown = true;
}

function copyCrew(from: CrewPose, to: CrewPose): void {
  to.x = from.x;
  to.y = from.y;
  to.z = from.z;
  to.heading = from.heading;
  to.shown = from.shown;
  to.move = { ...from.move };
}

/** How far up (knelt 0 … stood 1) bearer `j` stands with his hand on a rail
 * `need` m over the snow under him. */
function riseFor(j: number, need: number): number {
  const b = BEARERS[j].body;
  const r0 = railOf(b, 0, 0);
  return clamp((need - r0) / (railOf(b, 1, 0) - r0), 0, 1);
}

/** ONE OF THE FOUR on his way to the work: walked from where he stepped
 * off — a tender to his place at the scoop, turned to face down the way
 * the scoop walks up; a carrier to the board, which the two take out of
 * the toboggan and walk round to him. */
function toTheWork(level: Level, cp: SledCrewPlan, j: number, t: number, c: CrewPose): void {
  const A = cp.at;
  const leg = cp.parts[j].toWork;
  const h = cp.rescue.site.heading;
  const slot = cp.formation.crew[j];
  if (BEARERS[j].across < 0) {
    walkOn(level, leg, t, h, c);
    return;
  }
  walkOn(level, leg, t, slot.heading + Math.PI, c);
  if (t < A.take) return;
  const L = cp.lead.length;
  const arc = t < A.lead ? 0 : clamp((t - A.lead) * C.board, 0, L);
  const at = onLead(cp.lead, arc, cp.origin, h, slot);
  c.x = at.x;
  c.z = at.z;
  c.y = level.groundAt(at.x, at.z);
  if (t >= A.lead) c.heading = slot.heading + at.turn;
  const p = t - A.take;
  if (p < C.time.take) {
    // Crouched to the board in its bed, the hand on its rail, and up with it.
    const bed = bedOf(level, cp.toboggan, true, scratch.stretcher);
    const low = riseFor(j, bed.y - c.y);
    const dip =
      p < C.time.take * 0.55
        ? ease(p / (C.time.take * 0.4))
        : 1 - ease((p - C.time.take * 0.55) / (C.time.take * 0.45));
    c.move = {
      rise: 1 - (1 - low) * dip,
      stride: leg.stride,
      walking: 0,
      hand: BEARERS[j].hand,
      raise: 0,
    };
    return;
  }
  c.move = {
    ...slot.move,
    stride: slot.move.stride + (arc - L) / RESCUE_STRIDE,
    walking: t >= A.lead && arc < L ? 1 : 0,
  };
}

/** One of the four on his way back to his machine `t` on the call's
 * clock, getting on it and sat on it where it stands. */
function backTo(level: Level, park: SledPark, part: Part, t: number, c: CrewPose): number | null {
  const arrive = part.back.from + part.back.way.length / C.walk;
  if (t < arrive) {
    walkOn(level, part.back, t, null, c);
    return null;
  }
  if (t < part.seated) {
    const u = (t - arrive) / C.time.on;
    stepping(level, park, part.seat, part.on, 1 - u, c);
    return u;
  }
  sat(level, park, part.seat, true, c);
  return 1;
}

/** ONE OF THE FOUR at `t`, and his seat. */
function crewOne(
  level: Level,
  plan: RescueSledPlan,
  cp: SledCrewPlan,
  taken: readonly (number | null)[] | undefined,
  j: number,
  t: number,
  out: SledCrewFrame,
): void {
  const A = cp.at;
  const part = cp.parts[j];
  const k = part.seat.sled;
  const c = out.crew[j];
  const m = out.sleds.sleds[k];
  const park = plan.park[k];
  out.seats[j] = null;
  const seated = (on: number): void => {
    if (m.shown) out.seats[j] = { ...part.seat, on: clamp(on, 0, 1) };
  };
  // UP ON HIS MACHINE, and off it.
  if (t < plan.parked[k]) {
    sat(level, m, part.seat, m.shown, c);
    seated(1);
    return;
  }
  if (t < plan.parked[k] + C.time.off) {
    const u = (t - plan.parked[k]) / C.time.off;
    stepping(level, park, part.seat, part.off, u, c);
    seated(1 - u);
    return;
  }
  // AT THE WORK (the trip's and the toboggan's frames are already written).
  if (t < A.scoop) return toTheWork(level, cp, j, t, c);
  if (t < A.raise) return copyCrew(tripFrame.crew[j], c);
  if (t < A.up) return;
  // BACK: to his machine and on it, or — gone — clear of where it stood.
  const stolen = takenAt(taken, k);
  const tob = out.sleds.toboggan;
  const watching = Math.atan2(tob.x - part.watch.x, tob.z - part.watch.z);
  if (stolen < A.up) return walkOn(level, part.clear, t, watching, c);
  if (stolen >= plan.go) {
    if (t >= plan.go) {
      sat(level, m, part.seat, m.shown, c);
      seated(1);
      return;
    }
    const on = backTo(level, park, part, t, c);
    if (on !== null) seated(on);
    return;
  }
  if (t < stolen) {
    const on = backTo(level, park, part, t, c);
    if (on !== null) seated(on);
    return;
  }
  // Stolen from under him: off it if he was on it, and clear.
  const on = backTo(level, park, part, stolen, c);
  let from: P2 = { x: c.x, z: c.z };
  let set = stolen;
  if (on !== null) {
    if (t < stolen + C.time.off * on) {
      stepping(level, park, part.seat, part.on, 1 - on + (t - stolen) / C.time.off, c);
      return;
    }
    from = part.on;
    set = stolen + C.time.off * on;
  }
  const leg: Leg = {
    way: smoothPath([from, part.watch]),
    from: set,
    pace: C.walk,
    h0: c.heading,
    stride: c.move.stride,
  };
  leg.stride += leg.way.length / RESCUE_STRIDE;
  walkOn(level, leg, t, watching, c);
}
