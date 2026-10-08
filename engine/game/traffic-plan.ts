// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S TRAFFIC PLANNED — who drives the village's streets and
// when, worked out once a map (`traffic.ts` reads it back):
//
//   * CARS ROUND THE LOOP, each way (`Village.loop` and its reverse), each
//     going round in a whole number of laps a period;
//   * VISITORS in off the road out, round to a bay of the day car park,
//     parked a while, backed out and away down the road again — off the
//     map's edge until their time comes round;
//   * CARS THROUGH, in off the road and out again (round the loop where
//     there is one road out, across to the other where there are two);
//   * THE SKI BUS, in off the road to the stop on the square, standing
//     there while its passengers get off and on, and away;
//   * CYCLISTS round the loop at the carriageway's edge.
//
// Every route comes round in a whole fraction of `TRAFFIC.period`, so the
// whole village's traffic does too, and each vehicle is put on its route
// at a PHASE chosen so that, over the whole period, it never comes within
// its room (its width and the gap it keeps ahead, `TRAFFIC.margin`) of
// any vehicle placed before it — at a junction, round a bend, behind the
// bus at its stop — tried at the phases dealt off the seed in turn; a
// vehicle with no such phase is not on the streets. A car overtaking a
// cyclist on his lane is the one meeting not held to: it swings out round
// him (`traffic.ts`).
//
// A pure function of the map, off hashes of its seed on a salt of its own
// (`TRAFFIC_SALT`) — never the stream — so no digest moves.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Level } from "../mapgen/types.ts";
import { pick } from "./cabin-site.ts";
import { DRIVES, TRAFFIC as T, VEHICLES, type Drive, type VehicleKind } from "./defs/traffic.ts";
import {
  arcNearest,
  bayTurn,
  drivePath,
  laneOffset,
  layPath,
  rawLine,
  streetOf,
  wholeVisit,
  type Driven,
  type Keep,
  type Visit,
} from "./traffic-route.ts";
import type { Village } from "./village.ts";
import type { Bay, Lane } from "./village-furniture.ts";
import { besidePoint, streetAt, type StreetPoint } from "./village-streets.ts";

/** The traffic's own salt on the map's seed. */
export const TRAFFIC_SALT = 7331;

/** A LEG of a route: driven along a line, stood where the last left off,
 * or off the map. `start` is its time into the route's period, `odo` the
 * distance the wheels have rolled by then (backing counts back). */
export type Leg =
  | { kind: "drive"; start: number; duration: number; odo: number; d: Driven }
  | { kind: "wait"; start: number; duration: number; odo: number; d: Driven }
  | { kind: "hide"; start: number; duration: number; odo: number };

/** What a route carries a vehicle as: a car, the bus or a bicycle. */
export type Role = "loop" | "visitor" | "through" | "bus" | "bike";

/** A ROUTE: its legs round one period of its own (a whole fraction of
 * `TRAFFIC.period`), and the wheels' roll over it. */
export type Route = { legs: Leg[]; period: number; roll: number; role: Role };

/** A VEHICLE ON THE STREETS: its kind, its route and its phase on it, s. */
export type Vehicle = { id: number; kind: VehicleKind; route: number; phase: number; role: Role };

/** A CAR PARKED in a bay all the while. */
export type Parked = {
  id: number;
  kind: VehicleKind;
  bay: string;
  x: number;
  y: number;
  z: number;
  heading: number;
};

/** THE VILLAGE'S TRAFFIC: the lanes it drives (the village's), its routes,
 * the vehicles on them and the cars parked. */
export type TrafficPlan = {
  level: Level;
  period: number;
  lanes: readonly Lane[];
  routes: Route[];
  vehicles: Vehicle[];
  parked: Parked[];
  /** The box round everything it drives, for a quick "is anything near". */
  box: { x0: number; z0: number; x1: number; z1: number };
};

/** A rear axle's pose on a route at a moment (`routeAt`). */
export type RoutePose = {
  shown: boolean;
  x: number;
  z: number;
  /** The way the body faces, and the speed along it (negative backing). */
  facing: number;
  speed: number;
  /** The line's curvature as the body goes (for the wheels' turn). */
  bend: number;
  lane: number;
  accel: number;
  turn: number;
  odo: number;
};

export function freshRoutePose(): RoutePose {
  return {
    shown: false,
    x: 0,
    z: 0,
    facing: 0,
    speed: 0,
    bend: 0,
    lane: -1,
    accel: 0,
    turn: 0,
    odo: 0,
  };
}

/** Where a driven leg leaves its vehicle at `i` + `u` of a step. */
function onLeg(d: Driven, i: number, u: number, out: RoutePose): void {
  const p = d.path;
  const n = p.n;
  const j = p.closed ? (i + 1) % n : Math.min(n - 1, i + 1);
  out.x = p.x[i] + (p.x[j] - p.x[i]) * u;
  out.z = p.z[i] + (p.z[j] - p.z[i]) * u;
  const dh = Math.atan2(Math.sin(p.h[j] - p.h[i]), Math.cos(p.h[j] - p.h[i]));
  const h = p.h[i] + dh * u;
  out.facing = d.reverse ? h + Math.PI : h;
  out.bend = (p.k[i] + (p.k[j] - p.k[i]) * u) * (d.reverse ? -1 : 1);
  out.lane = u < 0.5 ? p.lane[i] : p.lane[j];
  out.turn = d.reverse ? 0 : p.turn[i];
}

/** THE REAR AXLE'S POSE on `route` `tau` s into its period (any `tau`:
 * whole periods are rolled into the odometer). */
export function routeAt(route: Route, tau: number, out: RoutePose): RoutePose {
  const P = route.period;
  const laps = Math.floor(tau / P);
  const u = tau - laps * P;
  let leg = route.legs[route.legs.length - 1];
  for (const l of route.legs) {
    if (u < l.start + l.duration) {
      leg = l;
      break;
    }
  }
  const into = Math.max(0, u - leg.start);
  out.accel = 0;
  out.turn = 0;
  if (leg.kind === "hide") {
    out.shown = false;
    out.speed = 0;
    out.lane = -1;
    out.odo = laps * route.roll + leg.odo;
    return out;
  }
  out.shown = true;
  const d = leg.d;
  if (leg.kind === "wait") {
    const last = d.path.closed ? 0 : d.path.n - 1;
    onLeg(d, last, 0, out);
    out.speed = 0;
    out.turn = 0;
    out.odo = laps * route.roll + leg.odo;
    return out;
  }
  // A driven leg: the point it is at, the speed there and how it changes.
  const t = d.t;
  const lastT = t.length - 1;
  let i = 0;
  let f = 0;
  let speed = d.v[0];
  if (into >= t[lastT]) {
    i = d.path.closed ? lastT - 1 : d.path.n - 2;
    f = 1;
    speed = d.v[d.path.closed ? 0 : d.path.n - 1];
  } else {
    let lo = 0;
    let hi = lastT;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (t[mid] <= into) lo = mid;
      else hi = mid;
    }
    const n = d.path.n;
    const va = d.v[lo];
    const vb = d.v[(lo + 1) % n];
    const span = t[lo + 1] - t[lo];
    const tt = into - t[lo];
    const a = span > 0 ? (vb - va) / span : 0;
    const s = va * tt + 0.5 * a * tt * tt;
    const step = span > 0 ? ((va + vb) / 2) * span : d.ds;
    i = lo;
    f = step > 1e-9 ? Math.max(0, Math.min(1, s / step)) : 0;
    speed = va + a * tt;
    out.accel = a;
  }
  onLeg(d, i, f, out);
  out.speed = d.reverse ? -speed : speed;
  const rolled = (i + f) * d.ds;
  out.odo = laps * route.roll + leg.odo + (d.reverse ? -rolled : rolled);
  return out;
}

/** A small unit hash off the seed, an id and a number, on the salt. */
const deal = (seed: number, id: string, k: number): number => pick(seed, id, k, TRAFFIC_SALT);

/** THE LANES' WAYS: from each lane, the lanes it may turn onto (another
 * street at the junction it reaches — never back along its own). */
function nextLanes(lanes: readonly Lane[]): number[][] {
  return lanes.map((a) =>
    lanes.flatMap((b, j) => (b.from === a.to && b.street !== a.street ? [j] : [])),
  );
}

/** THE SHORTEST WAY from lane `a` to lane `b`, both in, by the streets'
 * lengths — through the car park's aisles and down a road out only where
 * one of them is `b`. */
function shortest(
  v: Village,
  lanes: readonly Lane[],
  next: readonly number[][],
  a: number,
  b: number,
): number[] | null {
  const dist = new Float64Array(lanes.length).fill(Infinity);
  const prev = new Int32Array(lanes.length).fill(-1);
  const done = new Uint8Array(lanes.length);
  dist[a] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < lanes.length; i++) {
      if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    }
    if (u < 0) return null;
    if (u === b) break;
    done[u] = 1;
    for (const w of next[u]) {
      const kind = streetOf(v, lanes[w].street).kind;
      if (w !== b && (kind === "aisle" || kind === "road")) continue;
      const d = dist[u] + lanes[w].length;
      if (d < dist[w]) {
        dist[w] = d;
        prev[w] = u;
      }
    }
  }
  const out: number[] = [];
  for (let u = b; u >= 0; u = prev[u]) out.unshift(u);
  return out[0] === a ? out : null;
}

/** A plan in the making: the map, its village and its lanes. */
type Making = {
  level: Level;
  v: Village;
  lanes: readonly Lane[];
  index: Map<string, number>;
  next: number[][];
  S: number;
};

/** The whole visits of a list of lanes. */
const visitsOf = (m: Making, ids: readonly number[]): Visit[] =>
  ids.map((i) => wholeVisit(m.v, m.lanes, i));

/** A line driven from `v0` to `v1` along `visits` (and on into `tail`). */
function driven(
  m: Making,
  visits: readonly Visit[],
  keep: Keep,
  drive: Drive,
  v0: number,
  v1: number,
  tail: { x: number; z: number; lane: number; top: number }[] = [],
): Driven {
  const raw = [...rawLine(m.level, m.v, m.lanes, visits, keep, drive, false), ...tail.slice(1)];
  return drivePath(layPath(raw, false), drive, v0, v1);
}

/** The length a driven leg rolls, m. */
const rollOf = (d: Driven): number => (d.path.closed ? d.path.n : d.path.n - 1) * d.ds;

/** A route of legs, the last hidden for what is left of `period`. */
function routeOf(
  role: Role,
  period: number,
  parts: ({ drive: Driven } | { wait: number } | { hide: number })[],
): Route | null {
  const legs: Leg[] = [];
  let start = 0;
  let odo = 0;
  let last: Driven | null = null;
  for (const p of parts) {
    if ("drive" in p) {
      legs.push({ kind: "drive", start, duration: p.drive.duration, odo, d: p.drive });
      start += p.drive.duration;
      odo += (p.drive.reverse ? -1 : 1) * rollOf(p.drive);
      last = p.drive;
    } else if ("wait" in p) {
      legs.push({ kind: "wait", start, duration: p.wait, odo, d: last! });
      start += p.wait;
    } else {
      legs.push({ kind: "hide", start, duration: p.hide, odo });
      start += p.hide;
    }
  }
  if (start > period) return null;
  if (start < period) legs.push({ kind: "hide", start, duration: period - start, odo });
  return { legs, period, roll: odo, role };
}

/** The whole fraction of the period nearest `t` s, its laps a divisor of
 * the samples so a phase on the sample grid stays on it. */
function fitPeriod(S: number, t: number): number {
  const want = Math.max(1, Math.round((S * T.sample) / t));
  let best = 1;
  for (let m = 1; m <= S; m++) {
    if (S % m === 0 && Math.abs(m - want) < Math.abs(best - want)) best = m;
  }
  return (S * T.sample) / best;
}

/** A LOOP round the village, the way `ids` go, kept to `keep`. */
function loopRoute(m: Making, ids: readonly number[], keep: Keep, drive: Drive, role: Role): Route {
  const raw = rawLine(m.level, m.v, m.lanes, visitsOf(m, ids), keep, drive, true);
  const path = layPath(raw, true);
  const free = drivePath(path, drive, 0, 0);
  const period = fitPeriod(m.S, free.duration);
  const d = drivePath(path, drive, 0, 0, false, period / free.duration);
  return {
    legs: [{ kind: "drive", start: 0, duration: period, odo: 0, d }],
    period,
    roll: rollOf(d),
    role,
  };
}

/** The loop's lanes, and the same the other way round. */
function loops(m: Making): [number[], number[]] {
  const a = m.v.loop.map((id) => m.index.get(id)!).filter((i) => i !== undefined);
  const b = m.v.loop
    .slice()
    .reverse()
    .map((id) => m.index.get(`${id.slice(0, -1)}${id.endsWith("+") ? "-" : "+"}`)!)
    .filter((i) => i !== undefined);
  return [a, b];
}

/** The roads out: each one's lane in (off the map) and out. */
function roadsOf(m: Making): { into: number; out: number; back: number }[] {
  return m.v.streets
    .filter((s) => s.kind === "road")
    .map((s) => ({
      into: m.index.get(`${s.id}-`)!,
      out: m.index.get(`${s.id}+`)!,
      back: s.from,
    }));
}

/** A car IN off the road to bay `bay`, parked `stay` s, backed out and
 * away down a road; null where no way is found. */
function visitorRoute(
  m: Making,
  kind: VehicleKind,
  bay: Bay,
  into: number,
  out: number,
  stay: number,
): Route | null {
  const drive = DRIVES.car;
  const aisle = m.index.get(`${bay.street}+`);
  if (aisle === undefined) return null;
  const lane = m.lanes[aisle];
  const st = streetOf(m.v, lane.street);
  const whole = wholeVisit(m.v, m.lanes, aisle);
  const sb = arcNearest(st, bay.x, bay.z);
  const sa = sb - T.approach;
  if (sa < whole.s0 + 1 || sb > whole.s1) return null;
  // In: off the road to the car park's first aisle, on round to the bay's.
  const toAisle = shortest(m.v, m.lanes, m.next, into, m.index.get("P1+")!);
  if (!toAisle) return null;
  const inner = bay.street === "P3" ? ["P2+", "P3+"].map((id) => m.index.get(id)!) : [];
  const ids = [...toAisle, ...inner];
  const visits = visitsOf(m, ids);
  visits[visits.length - 1] = { ...visits[visits.length - 1], s1: sa };
  const p: StreetPoint = { x: 0, y: 0, z: 0, s: 0, heading: 0 };
  streetAt(st, sa, p);
  const a = besidePoint(p, laneOffset(st, lane, "middle"));
  const ta = { x: Math.sin(p.heading), z: Math.cos(p.heading) };
  const V = VEHICLES[kind];
  const back = V.length / 2 - (V.length - V.wheelbase - V.front);
  const f = { x: Math.sin(bay.heading), z: Math.cos(bay.heading) };
  const b = { x: bay.x - f.x * back, z: bay.z - f.z * back };
  const turn = bayTurn(a, ta, b, f, drive.aisle);
  const inLeg = driven(m, visits, "middle", drive, drive.road, 0, turn);
  // Backed out along the same turn, and away.
  const backOut = drivePath(layPath(turn.slice().reverse(), false), drive, 0, 0, true);
  const onward = bay.street === "P1" ? ["P2+", "P3+"].map((id) => m.index.get(id)!) : [];
  const last = onward.length ? onward[onward.length - 1] : aisle;
  const away = shortest(m.v, m.lanes, m.next, last, out);
  if (!away) return null;
  const outVisits = [
    { lane: aisle, s0: sa, s1: whole.s1 },
    ...visitsOf(m, onward),
    ...visitsOf(m, away.slice(1)),
  ];
  const outLeg = driven(m, outVisits, "middle", drive, 0, drive.road);
  return routeOf("visitor", m.S * T.sample, [
    { drive: inLeg },
    { wait: stay },
    { drive: backOut },
    { drive: outLeg },
  ]);
}

/** A car through: in off one road and out by another, or round the loop
 * and back out the way it came where there is one road. */
function throughRoute(m: Making, k: number, loopIds: [number[], number[]]): Route | null {
  const drive = DRIVES.car;
  const roads = roadsOf(m);
  if (roads.length === 0) return null;
  const r = roads[Math.floor(deal(m.level.seed, "through", k) * roads.length) % roads.length];
  let ids: number[] | null = null;
  if (roads.length > 1) {
    const o = roads.find((x) => x !== r)!;
    ids = shortest(m.v, m.lanes, m.next, r.into, o.out);
  } else {
    const loop = loopIds[k % 2];
    const at = loop.findIndex((i) => m.lanes[i].from === r.back);
    if (at >= 0) ids = [r.into, ...loop.slice(at), ...loop.slice(0, at), r.out];
  }
  if (!ids) return null;
  const d = driven(m, visitsOf(m, ids), "middle", drive, drive.road, drive.road);
  return routeOf("through", m.S * T.sample, [{ drive: d }]);
}

/** THE SKI BUS: in off a road to the stop, standing `stay` s, and away. */
function busRoute(m: Making, stay: number): Route | null {
  const bus = m.v.bus;
  const roads = roadsOf(m);
  if (!bus || roads.length === 0) return null;
  const drive = DRIVES.bus;
  const at = m.index.get(bus.lane);
  if (at === undefined) return null;
  const lane = m.lanes[at];
  const st = streetOf(m.v, lane.street);
  const stopPt = { x: 0, z: 0 };
  {
    let acc = 0;
    const pts = lane.points;
    for (let i = 1; i < pts.length; i++) {
      const d = hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
      if (acc + d >= bus.s || i === pts.length - 1) {
        const u = d > 0 ? Math.min(1, (bus.s - acc) / d) : 0;
        stopPt.x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u;
        stopPt.z = pts[i - 1].z + (pts[i].z - pts[i - 1].z) * u;
        break;
      }
      acc += d;
    }
  }
  // The stop's arc on the street, the bus's rear axle that far short of
  // the shelter's middle so the doors stand at it.
  const V = VEHICLES.bus;
  const sm = arcNearest(st, stopPt.x, stopPt.z) - lane.dir * (V.length / 2 - V.front);
  const whole = wholeVisit(m.v, m.lanes, at);
  const lo = Math.min(whole.s0, whole.s1);
  const hi = Math.max(whole.s0, whole.s1);
  const stop = Math.max(lo + 2, Math.min(hi - 2, sm));
  const r = roads[Math.floor(deal(m.level.seed, "bus", 0) * roads.length) % roads.length];
  const o = roads[Math.floor(deal(m.level.seed, "bus", 1) * roads.length) % roads.length];
  const inIds = shortest(m.v, m.lanes, m.next, r.into, at);
  const outIds = shortest(m.v, m.lanes, m.next, at, o.out);
  if (!inIds || !outIds) return null;
  const inVisits = visitsOf(m, inIds);
  inVisits[inVisits.length - 1] = { ...whole, s1: stop };
  const outVisits = [{ ...whole, s0: stop }, ...visitsOf(m, outIds.slice(1))];
  const inLeg = driven(m, inVisits, "middle", drive, drive.road, 0);
  const outLeg = driven(m, outVisits, "middle", drive, 0, drive.road);
  return routeOf("bus", m.S * T.sample, [{ drive: inLeg }, { wait: stay }, { drive: outLeg }]);
}

/** A car's class, dealt by the shares. */
function carKind(u: number, lot: boolean): VehicleKind {
  const K = T.kinds;
  const shares = lot ? { ...K, van: 0 } : K;
  const total = shares.hatch + shares.estate + shares.suv + shares.van;
  let x = u * total;
  for (const k of ["hatch", "estate", "suv", "van"] as const) {
    x -= shares[k];
    if (x < 0) return k;
  }
  return "hatch";
}

/** The SAMPLES of a route: its rear axle every `TRAFFIC.sample` s round
 * its period, for the plan's check. */
type Samples = {
  n: number;
  x: Float32Array;
  z: Float32Array;
  facing: Float32Array;
  speed: Float32Array;
  lane: Int16Array;
  shown: Uint8Array;
};

function samplesOf(route: Route): Samples {
  const n = Math.round(route.period / T.sample);
  const s: Samples = {
    n,
    x: new Float32Array(n),
    z: new Float32Array(n),
    facing: new Float32Array(n),
    speed: new Float32Array(n),
    lane: new Int16Array(n),
    shown: new Uint8Array(n),
  };
  const p = freshRoutePose();
  for (let i = 0; i < n; i++) {
    routeAt(route, i * T.sample, p);
    s.x[i] = p.x;
    s.z[i] = p.z;
    s.facing[i] = p.facing;
    s.speed[i] = p.speed;
    s.lane[i] = p.lane;
    s.shown[i] = p.shown ? 1 : 0;
  }
  return s;
}

/** A vehicle's box at a sample: its middle, its way, its half length
 * (with the gap it keeps ahead, the box run on that far) and half width. */
type Box = { x: number; z: number; fx: number; fz: number; hl: number; hw: number };

function boxOf(kind: VehicleKind, s: Samples, i: number, out: Box): Box {
  const V = VEHICLES[kind];
  const fx = Math.sin(s.facing[i]);
  const fz = Math.cos(s.facing[i]);
  const mid = V.length / 2 - (V.length - V.wheelbase - V.front);
  const speed = Math.abs(s.speed[i]);
  const gap = (kind === "bike" ? 0.6 : T.margin.gap) + T.margin.headway * speed;
  const sign = s.speed[i] < 0 ? -1 : 1;
  out.x = s.x[i] + fx * mid + sign * fx * (gap / 2);
  out.z = s.z[i] + fz * mid + sign * fz * (gap / 2);
  out.fx = fx;
  out.fz = fz;
  out.hl = V.length / 2 + gap / 2;
  out.hw = V.width / 2 + T.margin.side;
  return out;
}

/** Whether two boxes overlap (the separating axes of both). */
function overlap(a: Box, b: Box): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  for (const [ax, az] of [
    [a.fx, a.fz],
    [a.fz, -a.fx],
    [b.fx, b.fz],
    [b.fz, -b.fx],
  ]) {
    const ra = a.hl * Math.abs(a.fx * ax + a.fz * az) + a.hw * Math.abs(a.fz * ax - a.fx * az);
    const rb = b.hl * Math.abs(b.fx * ax + b.fz * az) + b.hw * Math.abs(b.fz * ax - b.fx * az);
    if (Math.abs(dx * ax + dz * az) > ra + rb) return false;
  }
  return true;
}

/** The bays some vehicle's body passes over at some moment (its own box,
 * a hand's breadth round it): no car is parked in those. */
function sweptBays(
  bays: readonly Bay[],
  placed: readonly { kind: VehicleKind; s: Samples }[],
): Set<string> {
  const C = 8;
  const cells = new Map<number, Bay[]>();
  const key = (cx: number, cz: number) => cx * 4096 + cz;
  for (const b of bays) {
    const k = key(Math.floor(b.x / C), Math.floor(b.z / C));
    const list = cells.get(k);
    if (list) list.push(b);
    else cells.set(k, [b]);
  }
  const out = new Set<string>();
  const a: Box = { x: 0, z: 0, fx: 0, fz: 1, hl: 0, hw: 0 };
  const b: Box = { x: 0, z: 0, fx: 0, fz: 1, hl: 0, hw: 0 };
  for (const p of placed) {
    const V = VEHICLES[p.kind];
    const mid = V.length / 2 - (V.length - V.wheelbase - V.front);
    for (let q = 0; q < p.s.n; q++) {
      if (!p.s.shown[q]) continue;
      a.fx = Math.sin(p.s.facing[q]);
      a.fz = Math.cos(p.s.facing[q]);
      a.x = p.s.x[q] + a.fx * mid;
      a.z = p.s.z[q] + a.fz * mid;
      a.hl = V.length / 2 + 0.15;
      a.hw = V.width / 2 + 0.15;
      const cx = Math.floor(a.x / C);
      const cz = Math.floor(a.z / C);
      for (let ox = -1; ox <= 1; ox++) {
        for (let oz = -1; oz <= 1; oz++) {
          for (const bay of cells.get(key(cx + ox, cz + oz)) ?? []) {
            if (out.has(bay.id)) continue;
            b.x = bay.x;
            b.z = bay.z;
            b.fx = Math.sin(bay.heading);
            b.fz = Math.cos(bay.heading);
            b.hl = bay.length / 2 - 0.4;
            b.hw = bay.width / 2 - 0.3;
            if (overlap(a, b)) out.add(bay.id);
          }
        }
      }
    }
  }
  return out;
}

/** The cell of the plan's check a point is in. */
const CELL = 24;

/** THE TRAFFIC of `level`'s village, or null where it has none. */
export function planTraffic(level: Level, v: Village): TrafficPlan | null {
  const lanes = v.lanes;
  if (lanes.length === 0) return null;
  const S = Math.round(T.period / T.sample);
  const m: Making = {
    level,
    v,
    lanes,
    index: new Map(lanes.map((l, i) => [l.id, i])),
    next: nextLanes(lanes),
    S,
  };
  const seed = level.seed;
  const routes: Route[] = [];
  const wanted: { kind: VehicleKind; route: number; role: Role }[] = [];
  const add = (route: Route | null, kind: VehicleKind, role: Role): void => {
    if (!route) return;
    routes.push(route);
    wanted.push({ kind, route: routes.length - 1, role });
  };
  const [loopA, loopB] = loops(m);
  // THE BUS first: its stand at the stop is what the rest keep clear of.
  const busStay = T.bus.stay.least + (T.bus.stay.most - T.bus.stay.least) * deal(seed, "bus", 2);
  add(busRoute(m, busStay), "bus", "bus");
  // THE VISITORS, each to a bay of the car park of its own.
  const roads = roadsOf(m);
  const lot = v.bays.filter((b) => b.kind === "lot");
  const nVisit =
    lot.length > 0 && roads.length > 0
      ? T.visitors.least +
        Math.floor(deal(seed, "visitors", 0) * (T.visitors.most - T.visitors.least + 1))
      : 0;
  const reserved = new Set<string>();
  for (let k = 0, tries = 0; k < nVisit && tries < nVisit * 6; tries++) {
    const bay = lot[Math.floor(deal(seed, "bay", tries) * lot.length) % lot.length];
    if (reserved.has(bay.id)) continue;
    const kind = carKind(deal(seed, "visitor-kind", tries), true);
    const r = roads[Math.floor(deal(seed, "visitor-in", tries) * roads.length) % roads.length];
    const o = roads[Math.floor(deal(seed, "visitor-out", tries) * roads.length) % roads.length];
    const S0 = T.visitors.stay;
    const stay = S0.least + (S0.most - S0.least) * deal(seed, "stay", tries);
    const route = visitorRoute(m, kind, bay, r.into, o.out, stay);
    if (!route) continue;
    reserved.add(bay.id);
    add(route, kind, "visitor");
    k++;
  }
  // THE CARS THROUGH.
  for (let k = 0; k < T.through; k++) {
    add(
      throughRoute(m, k, [loopA, loopB]),
      carKind(deal(seed, "through-kind", k), false),
      "through",
    );
  }
  // THE CARS ROUND THE LOOP, each way, and the cyclists.
  const loopCars = [loopA, loopB].map(
    (_, w) => T.loop.least + Math.floor(deal(seed, "loop", w) * (T.loop.most - T.loop.least + 1)),
  );
  const routeA = loopA.length > 1 ? loopRoute(m, loopA, "middle", DRIVES.car, "loop") : null;
  const routeB = loopB.length > 1 ? loopRoute(m, loopB, "middle", DRIVES.car, "loop") : null;
  for (let k = 0; k < Math.max(...loopCars); k++) {
    for (const [w, r] of [routeA, routeB].entries()) {
      if (!r || k >= loopCars[w]) continue;
      const at = routes.indexOf(r);
      if (at < 0) routes.push(r);
      wanted.push({
        kind: carKind(deal(seed, `loop-kind-${w}`, k), false),
        route: routes.indexOf(r),
        role: "loop",
      });
    }
  }
  const nBikes =
    T.bikes.least + Math.floor(deal(seed, "bikes", 0) * (T.bikes.most - T.bikes.least + 1));
  const bikeRoutes = [loopA, loopB].map((ids) =>
    ids.length > 1 ? loopRoute(m, ids, "edge", DRIVES.bike, "bike") : null,
  );
  for (let k = 0; k < nBikes; k++) {
    const r = bikeRoutes[Math.floor(deal(seed, "bike-way", k) * 2) % 2] ?? bikeRoutes[0];
    if (!r) continue;
    if (!routes.includes(r)) routes.push(r);
    wanted.push({ kind: "bike", route: routes.indexOf(r), role: "bike" });
  }

  // THE PHASES: each vehicle at the first dealt phase whose period crosses
  // no vehicle placed before it.
  const samples = routes.map(samplesOf);
  const grid = new Map<number, number[]>();
  const placed: { kind: VehicleKind; s: Samples; shift: number }[] = [];
  const vehicles: Vehicle[] = [];
  const a: Box = { x: 0, z: 0, fx: 0, fz: 1, hl: 0, hw: 0 };
  const b: Box = { x: 0, z: 0, fx: 0, fz: 1, hl: 0, hw: 0 };
  const keyOf = (i: number, cx: number, cz: number) => (i * 512 + cx) * 512 + cz;
  const TRIES = 24;
  wanted.forEach((w, k) => {
    const s = samples[w.route];
    const n = s.n;
    const offset = Math.floor(deal(seed, "phase", k) * TRIES);
    for (let j = 0; j < TRIES; j++) {
      const shift = Math.floor((((j + offset) % TRIES) * n) / TRIES);
      let clear = true;
      for (let i = 0; i < S && clear; i++) {
        const q = (i + shift) % n;
        if (!s.shown[q]) continue;
        boxOf(w.kind, s, q, a);
        const cx = Math.floor(a.x / CELL);
        const cz = Math.floor(a.z / CELL);
        for (let ox = -1; ox <= 1 && clear; ox++) {
          for (let oz = -1; oz <= 1 && clear; oz++) {
            const list = grid.get(keyOf(i, cx + ox, cz + oz));
            if (!list) continue;
            for (const other of list) {
              const o = placed[other];
              const oq = (i + o.shift) % o.s.n;
              // A car passing a cyclist on his own lane swings out round
              // him (`traffic.ts`): the one meeting not held to.
              if (
                (o.kind === "bike") !== (w.kind === "bike") &&
                o.s.lane[oq] === s.lane[q] &&
                s.lane[q] >= 0
              ) {
                continue;
              }
              boxOf(o.kind, o.s, oq, b);
              if (overlap(a, b)) {
                clear = false;
                break;
              }
            }
          }
        }
      }
      if (!clear) continue;
      const id = placed.length;
      placed.push({ kind: w.kind, s, shift });
      for (let i = 0; i < S; i++) {
        const q = (i + shift) % n;
        if (!s.shown[q]) continue;
        boxOf(w.kind, s, q, a);
        const key = keyOf(i, Math.floor(a.x / CELL), Math.floor(a.z / CELL));
        const list = grid.get(key);
        if (list) list.push(id);
        else grid.set(key, [id]);
      }
      vehicles.push({
        id: vehicles.length,
        kind: w.kind,
        route: w.route,
        phase: shift * T.sample,
        role: w.role,
      });
      return;
    }
  });

  // THE CARS PARKED: in the kerbs' bays and the car park's, those no
  // visitor drives to — the car park fuller in the lifts' hours.
  const hour = level.sun?.hour ?? 12;
  const H = T.parked.hours;
  const lotShare = hour >= H[0] && hour < H[1] ? T.parked.day : T.parked.night;
  // ...and none where a moving vehicle's body would pass through it (a
  // visitor swinging into the next bay).
  const blocked = sweptBays(v.bays, placed);
  const parked: Parked[] = [];
  for (const bay of v.bays) {
    if (reserved.has(bay.id) || blocked.has(bay.id)) continue;
    const share = bay.kind === "kerb" ? T.parked.kerb : lotShare;
    if (deal(seed, `park-${bay.id}`, 0) >= share) continue;
    parked.push({
      id: parked.length,
      kind: carKind(deal(seed, `park-${bay.id}`, 1), bay.kind === "lot"),
      bay: bay.id,
      x: bay.x,
      y: bay.y,
      z: bay.z,
      heading: bay.heading,
    });
  }

  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const st of v.streets) {
    for (const p of st.points) {
      x0 = Math.min(x0, p.x);
      z0 = Math.min(z0, p.z);
      x1 = Math.max(x1, p.x);
      z1 = Math.max(z1, p.z);
    }
  }
  return {
    level,
    period: S * T.sample,
    lanes,
    routes,
    vehicles,
    parked,
    box: { x0: x0 - 15, z0: z0 - 15, x1: x1 + 15, z1: z1 + 15 },
  };
}
