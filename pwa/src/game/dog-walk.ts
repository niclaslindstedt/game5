// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// PEOPLE WALKING THEIR DOGS ON THE VILLAGE'S SIDEWALKS — the households of
// a ski area's village with a dog (`DOG_WALK.households`), each going out
// from its door with one dog or two (and on some walks a child alongside),
// round the sidewalks (`dog-walk-net.ts`) and home again, over and over
// through the run: stopping as the dog stops to SNIFF, to LIFT A LEG at a
// lamp post or the windrow, to SQUAT and POOP at the sidewalk's edge, the
// owner waiting — and now and then bending to bag it, but mostly not; at
// a CROSSING stopping at the kerb with the dog sat beside him till the
// street is clear of cars (`vehicleAt`), and crossing only there.
//
// WHAT A DOG LEAVES STAYS: every pile a dog has dropped since the run began
// lies on the sidewalk where it fell, steaming its first minute, and a
// yellow patch marks where a dog lifted its leg (`messAt`) — gone only if
// the owner bagged it.
//
// PRESENTATION ONLY, the civilians' rule: dealt off the map's seed on a
// salt of its own (`DOG_SALT`), never `state.rng`, the map read and never
// written, so no digest moves. A WALK is dealt off its household and its
// number on a stream of its own, its timeline built once (`walkOf`) and
// kept, so where everybody is at a moment, and what lies on the sidewalk,
// is a PURE FUNCTION of the plan and the clock (`dogWalkerAt`, `dogAt`,
// `messAt`): the same moment is the same picture, whatever was asked
// before it. Three-free and DOM-free; `tests/dog_walkers_test.ts` holds it.

import {
  createRng,
  trafficOf,
  vehicleAt,
  freshVehiclePose,
  villageOf,
  VEHICLES,
  type CrowdBody,
  type Level,
  type Rng,
  type TrafficPlan,
} from "@engine";

import {
  DOG_COATS,
  DOG_COLLARS,
  DOG_GAIT,
  DOG_HOURS,
  DOG_KINDS,
  DOG_SHARE,
  DOG_SPECS,
  DOG_WALK as W,
  type DogKind,
} from "./dog-defs.ts";
import { footY, walkNetOf, wanderFrom, type NetDoor, type WalkNet } from "./dog-walk-net.ts";
import {
  lineOf,
  onSidewalk,
  pointAt,
  stretchAt,
  type LinePoint,
  type WalkLine,
} from "./dog-walk-route.ts";

/** The salt on the map's seed the dog walks are dealt off. */
export const DOG_SALT = 0xd09;

/** One dog: its kind and size, its coat and whether it is out in a dog
 * coat (and its colour), its collar, whether it is a male (who lifts a
 * leg), how far ahead of the hand it goes on the lead and to which side,
 * and the lead's length. */
export type Dog = {
  readonly id: number;
  readonly kind: DogKind;
  readonly scale: number;
  readonly coat: number;
  readonly dressed: boolean;
  readonly garment: number;
  readonly collar: number;
  readonly male: boolean;
  readonly ahead: number;
  readonly side: number;
  readonly lead: number;
};

/** A household: its door, how keen it is to be out at an hour, who walks
 * (and the child who comes along on a family's walk), its dogs and its
 * pace. */
export type Household = {
  readonly id: number;
  readonly door: NetDoor;
  readonly keen: number;
  readonly walker: CrowdBody;
  readonly child: CrowdBody | null;
  readonly dogs: readonly Dog[];
  readonly pace: number;
  /** Where in its round of walks it starts the run, s. */
  readonly phase: number;
};

/** What a dog does at a stop: sniffs, lifts a leg (a male), squats to pee
 * (a female), or squats to poop. */
export type DogStop = "sniff" | "mark" | "pee" | "poop";

/** A dog's stop on a walk: what, where along the line and how far to the
 * right of it, which way it turns there (rad off the line), the side a
 * leg is lifted to, and when it gets there, when it is done and when it
 * has caught its owner up again. */
export type Stop = {
  dog: number;
  act: DogStop;
  s: number;
  lat: number;
  yaw: number;
  lift: number;
  te: number;
  tr: number;
  tc: number;
  /** A poop's: the circling before the squat, s. */
  circle: number;
};

/** A stretch of the owner's walk: from `t0` to `t1` he goes from `s0` to
 * `s1` along the line (the same, stood), doing `act`. */
type Leg = {
  t0: number;
  t1: number;
  s0: number;
  s1: number;
  act: "walk" | "kerb" | "wait" | "stoop" | "chat";
};

/** What lies on the snow after a dog: a pile, or a yellow patch where it
 * peed; where, the way the dog faced, how big (the dog's height), the
 * moment it was laid (s of the run's clock) and the moment it was bagged
 * (`Infinity` when never). */
export type Mess = {
  readonly kind: "poop" | "pee";
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly heading: number;
  readonly size: number;
  readonly at: number;
  readonly until: number;
  /** The household whose dog left it, and a number its look is dealt off. */
  readonly household: number;
  readonly seed: number;
};

/** ONE WALK: when it starts and ends, its line, the owner's legs, the
 * dogs' stops, the kerbs he waits at (and whether the dogs sit there), a
 * chat's sit, and what is left behind. */
export type Walk = {
  readonly t0: number;
  readonly t1: number;
  readonly line: WalkLine;
  readonly legs: readonly Leg[];
  readonly stops: readonly Stop[];
  readonly kerbs: readonly { t0: number; t1: number; sit: boolean }[];
  readonly mess: readonly Mess[];
  /** From `bag` s on the owner carries a bag (`Infinity` when he never
   * bagged anything). */
  readonly bag: number;
};

export type DogPlan = {
  readonly level: Level;
  readonly net: WalkNet;
  readonly households: readonly Household[];
  /** Each household's walks dealt so far, in order. */
  readonly walks: Walk[][];
  /** Every mess of every walk dealt so far, by the moment it was laid. */
  messes: Mess[];
  /** Up to when every household's walks are dealt, s, and how many walks
   * `messes` was gathered from. */
  dealt: number;
  gathered: number;
};

/** A small integer hash. */
function hash(a: number, b: number, c = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h = Math.imul(h ^ (c + 0x27d4eb2f), 0x165667b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  return h >>> 0;
}

/** A kind dealt by the shares. */
function kindOf(rng: Rng): DogKind {
  const total = DOG_KINDS.reduce((a, k) => a + DOG_SHARE[k], 0);
  let r = rng.next() * total;
  for (const k of DOG_KINDS) {
    r -= DOG_SHARE[k];
    if (r <= 0) return k;
  }
  return DOG_KINDS[0];
}

const WALKERS: readonly CrowdBody[] = [
  "man",
  "woman",
  "woman",
  "man",
  "oldMan",
  "oldWoman",
  "teen",
  "freerider",
];

/** THE DOG WALKS OF `level`'s VILLAGE, or null where it has no
 * sidewalks. Deterministic in the map's seed on a stream of its own. */
export function planDogWalks(level: Level): DogPlan | null {
  const net = walkNetOf(level);
  if (!net || net.doors.length === 0) return null;
  const rng = createRng((level.seed ^ (DOG_SALT * 0x10001)) >>> 0);
  const households: Household[] = [];
  const doors = [...net.doors];
  let dogId = 0;
  for (let h = 0; h < W.households; h++) {
    // A door of its own while there are doors, then shared (a block of flats).
    const door =
      doors.length > 0 ? doors.splice(rng.int(0, doors.length - 1), 1)[0] : rng.pick(net.doors);
    const two = rng.chance(W.pair);
    const family = !two && rng.chance(W.family);
    const dogs: Dog[] = [];
    for (let d = 0; d < (two ? 2 : 1); d++) {
      const kind = d === 1 && rng.chance(0.5) ? dogs[0].kind : kindOf(rng);
      const spec = DOG_SPECS[kind];
      const side = two ? (d === 0 ? 0.4 : -0.4) : rng.range(0.2, 0.4);
      dogs.push({
        id: dogId++,
        kind,
        scale: rng.range(0.92, 1.08),
        coat: rng.int(0, spec.coats.length - 1),
        dressed: rng.chance(spec.dressed),
        garment: rng.int(0, DOG_COATS.length - 1),
        collar: rng.int(0, DOG_COLLARS.length - 1),
        male: rng.chance(0.5),
        // A small dog is kept nearer the hand.
        ahead: rng.range(W.ahead[0], W.ahead[1]) * (spec.height < 0.35 ? 0.7 : 1),
        side,
        lead: rng.range(W.lead[0], W.lead[1]),
      });
    }
    households.push({
      id: h,
      door,
      keen: rng.next(),
      walker: rng.pick(WALKERS),
      child: family ? "child" : null,
      dogs,
      pace: family ? rng.range(W.familyPace[0], W.familyPace[1]) : rng.range(W.pace[0], W.pace[1]),
      phase: rng.range(0, 420),
    });
  }
  return {
    level,
    net,
    households,
    walks: households.map(() => []),
    messes: [],
    dealt: -Infinity,
    gathered: 0,
  };
}

const plans = new WeakMap<Level, DogPlan | null>();

/** The map's dog walks, dealt once a map and shared by everything that
 * draws or reads them (the walkers, the dogs, what they leave). */
export function dogPlanFor(level: Level): DogPlan | null {
  if (!plans.has(level)) plans.set(level, planDogWalks(level));
  return plans.get(level) ?? null;
}

/** The share of the dog walkers out at `hour`. */
export function dogShareAt(hour: number): number {
  const h = ((hour % 24) + 24) % 24;
  for (let k = 0; k + 1 < DOG_HOURS.length; k++) {
    const [h0, s0] = DOG_HOURS[k];
    const [h1, s1] = DOG_HOURS[k + 1];
    if (h >= h0 && h <= h1) return h1 > h0 ? s0 + ((s1 - s0) * (h - h0)) / (h1 - h0) : s1;
  }
  return 0;
}

/** Whether household `h` is out walking at `hour` at all. */
export function householdOut(plan: DogPlan, h: number, hour: number): boolean {
  return plan.households[h].keen < dogShareAt(hour);
}

// --- BUILDING A WALK ------------------------------------------------------

/** Whether the street at a crossing is clear of traffic from `t` for `span`
 * s: at no moment of it a vehicle on the crossing or coming at it within
 * `W.headway` s (its own length and a step added), over the carriageway
 * it crosses — a car stood at a bus stop down the street does not keep
 * him waiting. */
function streetClear(
  traffic: TrafficPlan,
  c: { x: number; z: number; heading: number; across: number },
  t: number,
  span: number,
): boolean {
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  for (let tau = t; tau <= t + span; tau += 0.5) {
    for (let k = 0; k < traffic.vehicles.length; k++) {
      vehicleAt(traffic, k, tau, VEHICLE);
      if (!VEHICLE.shown) continue;
      const dx = VEHICLE.x - c.x;
      const dz = VEHICLE.z - c.z;
      const along = dx * fx + dz * fz;
      const side = dx * fz - dz * fx;
      const half = VEHICLES[VEHICLE.kind].length / 2;
      // On the crossing (a car's length and a step either side of it), or
      // coming at it within a couple of seconds.
      const reach = half + 3 + VEHICLE.speed * W.headway;
      if (Math.abs(along) < reach && Math.abs(side) < c.across / 2 + 2) return false;
    }
  }
  return true;
}
const VEHICLE = freshVehiclePose();

/** The arc of the point of `line` nearest (x, z) and how far it is, read
 * stretch by stretch (a stretch further than `within` off skipped). */
function nearestOn(line: WalkLine, x: number, z: number, within: number): { s: number; d: number } {
  let best = { s: 0, d: Infinity };
  for (let k = 0; k + 1 < line.s.length; k++) {
    const ax = line.x[k];
    const az = line.z[k];
    const bx = line.x[k + 1];
    const bz = line.z[k + 1];
    if (
      x < Math.min(ax, bx) - within ||
      x > Math.max(ax, bx) + within ||
      z < Math.min(az, bz) - within ||
      z > Math.max(az, bz) + within
    )
      continue;
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz || 1;
    const f = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const d = Math.hypot(ax + dx * f - x, az + dz * f - z);
    if (d < best.d) best = { s: line.s[k] + f * Math.sqrt(l2), d };
  }
  return best;
}

/** A dog's stops on a line, before they are timed: sniffs every while,
 * marks at the lamp posts passed (else the windrow), a poop or two — each
 * on a sidewalk, clear of a crossing, a corner and a door, and apart. */
function stopsOn(
  rng: Rng,
  level: Level,
  line: WalkLine,
  hh: Household,
  d: number,
  taken: number[],
): Stop[] {
  const dog = hh.dogs[d];
  const out: Stop[] = [];
  const free = (s: number, apart = 6): boolean =>
    onSidewalk(line, s, 3.5) && taken.every((o) => Math.abs(o - s) > apart);
  const stop = (act: DogStop, s: number, lat: number, yaw: number, lift = 0): void => {
    taken.push(s);
    out.push({ dog: d, act, s, lat, yaw, lift, te: 0, tr: 0, tc: 0, circle: 0 });
  };
  const kerbAt = (s: number): { side: number; half: number } => {
    const k = stretchAt(line, s);
    return { side: line.kerb[k], half: line.half[k] };
  };
  // THE POOP (or two), somewhere in the walk's middle, at the kerb's edge.
  const poops = rng.chance(W.poop) ? (rng.chance(W.twice) ? 2 : 1) : 0;
  for (let p = 0; p < poops; p++) {
    for (let tries = 0; tries < 30; tries++) {
      const s = line.length * rng.range(p === 0 ? 0.15 : 0.55, p === 0 ? 0.6 : 0.85);
      if (!free(s, 8)) continue;
      const k = kerbAt(s);
      stop("poop", s, k.side * (k.half - 0.32), k.side * rng.range(-0.3, 0.6));
      break;
    }
  }
  // THE MARKS: at the lamp posts by the line first, then the windrow.
  const v = villageOf(level);
  const marks = rng.int(W.marks[0], W.marks[1]);
  const at: LinePoint = { x: 0, z: 0, heading: 0 };
  const lamps: { s: number; lat: number }[] = [];
  for (const lamp of v?.lamps ?? []) {
    const best = nearestOn(line, lamp.x, lamp.z, 1.9);
    if (best.d > 1.9 || best.s < 2 || best.s > line.length - 2) continue;
    pointAt(line, best.s, 0, at);
    const right = (lamp.x - at.x) * Math.cos(at.heading) - (lamp.z - at.z) * Math.sin(at.heading);
    lamps.push({ s: best.s, lat: Math.sign(right) * Math.max(0, Math.abs(right) - 0.42) });
  }
  for (let m = 0; m < marks; m++) {
    const lamp =
      lamps.length > 0 && rng.chance(0.65)
        ? lamps.splice(rng.int(0, lamps.length - 1), 1)[0]
        : null;
    if (lamp && free(lamp.s)) {
      const side = Math.sign(lamp.lat) || 1;
      stop(dog.male ? "mark" : "pee", lamp.s, lamp.lat, 0, side);
      continue;
    }
    for (let tries = 0; tries < 12; tries++) {
      const s = rng.range(10, line.length - 10);
      if (!free(s)) continue;
      const k = kerbAt(s);
      stop(dog.male ? "mark" : "pee", s, k.side * (k.half - 0.28), 0, k.side);
      break;
    }
  }
  // THE SNIFFS, every while along the way, at the kerb or the back edge.
  for (
    let s = rng.range(10, 30);
    s < line.length - 8;
    s += rng.range(W.sniffEvery[0], W.sniffEvery[1])
  ) {
    if (!free(s, 5)) continue;
    const k = kerbAt(s);
    const toKerb = rng.chance(0.7) ? 1 : -1;
    stop("sniff", s, k.side * toKerb * (k.half - 0.3), k.side * toKerb * rng.range(0.35, 0.8));
  }
  return out;
}

/** The owner's arc at `t` along his legs. */
export function walkerArc(legs: readonly Leg[], t: number): number {
  if (legs.length === 0) return 0;
  if (t <= legs[0].t0) return legs[0].s0;
  let lo = 0;
  let hi = legs.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (legs[mid].t0 <= t) lo = mid;
    else hi = mid - 1;
  }
  const g = legs[lo];
  if (t >= g.t1) return g.s1;
  return g.s0 + ((g.s1 - g.s0) * (t - g.t0)) / Math.max(1e-6, g.t1 - g.t0);
}

/** How far a dog is held back from its usual place ahead of the hand at a
 * kerb (0 none … 1 sat beside him): eased in as he comes up to it and out
 * as he steps off. */
export function kerbHold(kerbs: Walk["kerbs"], t: number): number {
  let most = 0;
  for (const k of kerbs) {
    if (t < k.t0 - 1.6 || t > k.t1 + 1.6) continue;
    const w = t < k.t0 ? ease((t - (k.t0 - 1.6)) / 1.6) : t > k.t1 ? 1 - ease((t - k.t1) / 1.6) : 1;
    most = Math.max(most, w);
  }
  return most;
}

/** Where a dog sits relative to the hand at a kerb, m along. */
const KERB_AHEAD = -0.15;

const ease = (u: number): number => {
  const c = Math.max(0, Math.min(1, u));
  return c * c * (3 - 2 * c);
};

/** A DOG'S ARC along the line at `t` on walk `w`, before its stops: its
 * place ahead of the hand, held back at the kerbs. */
function followArc(w: Walk, dog: Dog, t: number): number {
  const a = dog.ahead + (KERB_AHEAD - dog.ahead) * kerbHold(w.kerbs, t);
  return walkerArc(w.legs, t) + a;
}

/** A dog's arc at `t`, its stops in: stood at a stop's place from when it
 * gets there till it is done, then trotting after its owner till caught. */
export function dogArc(
  w: Walk,
  dog: Dog,
  d: number,
  t: number,
): { arc: number; stop: Stop | null } {
  for (const st of w.stops) {
    if (st.dog !== d || t < st.te || t >= st.tc) continue;
    if (t < st.tr) return { arc: st.s, stop: st };
    const base = followArc(w, dog, t);
    const arc = base >= st.s ? Math.min(base, st.s + catchSpeed(w, t) * (t - st.tr)) : st.s;
    return { arc, stop: null };
  }
  return { arc: followArc(w, dog, t), stop: null };
}

/** How fast a dog trots to catch its owner up: his pace and some. */
function catchSpeed(w: Walk, t: number): number {
  void t;
  return w.legs.length > 0 ? paceOfWalk(w) + DOG_GAIT.catchUp : 1.5;
}
const paceOfWalk = (w: Walk): number => {
  const g = w.legs.find((l) => l.act === "walk" && l.t1 > l.t0);
  return g ? (g.s1 - g.s0) / (g.t1 - g.t0) : 1.2;
};

/** BUILD WALK `k` OF HOUSEHOLD `h`, starting at `t0`. */
function buildWalk(plan: DogPlan, h: number, k: number, t0: number): Walk {
  const hh = plan.households[h];
  const level = plan.level;
  const rng = createRng(hash(level.seed ^ DOG_SALT, h, k));
  const way = wanderFrom(plan.net, hh.door, rng.range(W.length[0], W.length[1]), rng);
  const line = lineOf(plan.net, way);
  const v = villageOf(level);
  const traffic = trafficOf(level);
  const night = level.sun.hour < 7 || level.sun.hour > 18;
  const taken: number[] = [];
  let stops: Stop[] = [];
  hh.dogs.forEach((_, d) => (stops = stops.concat(stopsOn(rng, level, line, hh, d, taken))));
  const pickUp = rng.chance(night ? W.pickUpNight : W.pickUp);
  const chatAt = rng.chance(W.chat) ? line.length * rng.range(0.3, 0.7) : -1;
  const chatFor = rng.range(W.chatFor[0], W.chatFor[1]);
  const sits = hh.dogs.map(() => rng.chance(W.sit));
  const kerbWaits = line.kind.map(() => rng.range(W.kerb[0], W.kerb[1]));
  const durations = stops.map((st) =>
    st.act === "sniff"
      ? rng.range(W.sniff[0], W.sniff[1])
      : st.act === "poop"
        ? rng.range(W.squat[0], W.squat[1])
        : rng.range(W.mark[0], W.mark[1]),
  );
  const circles = stops.map(() => rng.range(W.circle[0], W.circle[1]));
  const deltas = stops.map(() => rng.range(-0.25, 0.45));
  // Tried, and a stop dropped where it would start before its dog has
  // caught up from the last.
  let dropped = new Set<number>();
  for (let round = 0; ; round++) {
    const walk = timeWalk(plan, hh, line, t0, stops, dropped, {
      pickUp,
      chatAt,
      chatFor,
      sits,
      kerbWaits,
      durations,
      circles,
      deltas,
      traffic,
      crossings: v?.crossings ?? [],
    });
    const late = clash(walk);
    if (late < 0 || round > 8) return walk;
    dropped = new Set([...dropped, late]);
  }
}

type Dealt = {
  pickUp: boolean;
  chatAt: number;
  chatFor: number;
  sits: boolean[];
  kerbWaits: number[];
  durations: number[];
  circles: number[];
  deltas: number[];
  traffic: TrafficPlan | null;
  crossings: readonly { id: string; x: number; z: number; heading: number; across: number }[];
};

/** The index (into the walk's dealt stops) of a stop that begins before
 * its dog is back with its owner from the one before, or −1. */
function clash(w: Walk & { order?: number[] }): number {
  const last = new Map<number, number>();
  for (let i = 0; i < w.stops.length; i++) {
    const st = w.stops[i];
    const prev = last.get(st.dog);
    if (prev !== undefined && st.te < prev + 0.5) return w.order ? w.order[i] : i;
    last.set(st.dog, st.tc);
  }
  return -1;
}

/** The walk timed: the owner walked along the line at his pace, stopping
 * at each kerb till the street is clear, as each dog stops, for a chat. */
function timeWalk(
  plan: DogPlan,
  hh: Household,
  line: WalkLine,
  t0: number,
  dealtStops: readonly Stop[],
  dropped: ReadonlySet<number>,
  D: Dealt,
): Walk & { order: number[] } {
  const v = hh.pace;
  const legs: Leg[] = [];
  const kerbs: { t0: number; t1: number; sit: boolean }[] = [];
  const mess: Mess[] = [];
  let t = t0;
  let s = 0;
  let bag = t0;
  const walkTo = (to: number): void => {
    if (to <= s + 1e-6) return;
    const dt = (to - s) / v;
    legs.push({ t0: t, t1: t + dt, s0: s, s1: to, act: "walk" });
    t += dt;
    s = to;
  };
  const wait = (dt: number, act: Leg["act"]): void => {
    legs.push({ t0: t, t1: t + dt, s0: s, s1: s, act });
    t += dt;
  };
  // Every thing he stops for, by where along the line.
  type Item = { s: number; what: "kerb" | "stop" | "chat"; k: number };
  const items: Item[] = [];
  line.kind.forEach((kind, k) => {
    if (kind === "crossing") items.push({ s: line.s[k], what: "kerb", k });
  });
  const order: number[] = [];
  dealtStops.forEach((st, i) => {
    if (dropped.has(i)) return;
    const ahead = hh.dogs[st.dog].ahead;
    items.push({ s: st.s - ahead, what: "stop", k: i });
  });
  if (D.chatAt > 0 && onSidewalk(line, D.chatAt, 3))
    items.push({ s: D.chatAt, what: "chat", k: 0 });
  items.sort((a, b) => a.s - b.s);
  const stops: Stop[] = [];
  for (const it of items) {
    if (it.what === "kerb") {
      walkTo(Math.max(s, it.s - 0.15));
      const kerbAt = t;
      let go = t + D.kerbWaits[it.k];
      const id = line.crossing[it.k];
      // The crossing this stretch is (two can share a name, a street's
      // both ends at a square): the one of that name nearest its middle.
      const mx = (line.x[it.k] + line.x[it.k + 1]) / 2;
      const mz = (line.z[it.k] + line.z[it.k + 1]) / 2;
      let c: Dealt["crossings"][number] | undefined;
      for (const q of D.crossings) {
        if (q.id !== id) continue;
        if (!c || Math.hypot(q.x - mx, q.z - mz) < Math.hypot(c.x - mx, c.z - mz)) c = q;
      }
      if (c && D.traffic) {
        const span = (line.s[it.k + 1] - line.s[it.k]) / v + 1.5;
        for (let tries = 0; tries < 480 && !streetClear(D.traffic, c, go, span); tries++) go += 0.5;
      }
      wait(go - t, "kerb");
      kerbs.push({ t0: kerbAt, t1: go, sit: D.sits[0] });
      continue;
    }
    if (it.what === "chat") {
      walkTo(Math.max(s, it.s));
      wait(D.chatFor, "chat");
      continue;
    }
    const dealt = dealtStops[it.k];
    const dog = hh.dogs[dealt.dog];
    const spec = DOG_SPECS[dog.kind];
    const dur = D.durations[it.k];
    const st: Stop = { ...dealt, te: 0, tr: 0, tc: 0, circle: 0 };
    // He walks on till the dog is at its place, the dog stops there and he
    // goes on a step or two (or, to bag a pile, stops just short of it).
    const arrive = Math.max(s, st.s - dog.ahead);
    // Pushed on past where it was meant by a stop before: stood where it
    // gets to instead, if that is still a sidewalk's edge.
    if (!onSidewalk(line, arrive + dog.ahead, 2.5)) continue;
    walkTo(arrive);
    st.te = t;
    st.s = arrive + dog.ahead;
    const bodyBack = 0.45 * spec.length * dog.scale;
    const bagIt = st.act === "poop" && D.pickUp && bag === t0;
    const stopAt = bagIt
      ? Math.max(arrive, st.s - bodyBack - 0.6)
      : Math.max(arrive, st.s + D.deltas[it.k]);
    walkTo(stopAt);
    st.circle = st.act === "poop" ? D.circles[it.k] : 0;
    st.tr = Math.max(st.te + st.circle + dur, t + 1.2);
    wait(st.tr - t, "wait");
    if (st.act === "poop" || st.act === "mark" || st.act === "pee") {
      const at = pointAt(line, st.s, st.lat, { x: 0, z: 0, heading: 0 });
      const heading = at.heading + st.yaw;
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      const back = st.act === "mark" ? 0.25 * spec.length * dog.scale : bodyBack + 0.04;
      let x = at.x - fx * back;
      let z = at.z - fz * back;
      if (st.act === "mark") {
        // Under the lifted leg, splashed toward what it was lifted at.
        x += Math.cos(heading) * st.lift * 0.3 * spec.height;
        z -= Math.sin(heading) * st.lift * 0.3 * spec.height;
      }
      const laid = st.act === "poop" ? st.te + st.circle + Math.min(4, dur * 0.4) : st.te + 1.5;
      let until = Infinity;
      if (bagIt) {
        wait(W.stoop, "stoop");
        until = t - W.stoop * 0.35;
        bag = until;
      }
      mess.push({
        kind: st.act === "poop" ? "poop" : "pee",
        x,
        y: footY(plan.level, x, z),
        z,
        heading,
        size: spec.height * dog.scale,
        at: laid,
        until,
        household: hh.id,
        seed: hash(hh.id, Math.floor(t0 * 7), stops.length),
      });
    }
    stops.push(st);
    order.push(it.k);
  }
  walkTo(line.length);
  // Every dog hurries home through the door with him.
  const walk: Walk & { order: number[] } = {
    t0,
    t1: t + 0.6,
    line,
    legs,
    stops,
    kerbs,
    mess,
    bag: bag === t0 ? Infinity : bag,
    order,
  };
  // When each dog is back at its place ahead of the hand.
  for (const st of stops) {
    const dog = hh.dogs[st.dog];
    st.tc = st.tr;
    const vc = paceOfWalk(walk) + DOG_GAIT.catchUp;
    for (let u = st.tr; u < st.tr + 90; u += 0.05) {
      const base = followArc(walk, dog, u);
      st.tc = u;
      if (base >= st.s && st.s + vc * (u - st.tr) >= base) break;
    }
  }
  return walk;
}

/** WALK `k` OF HOUSEHOLD `h`, dealt and timed once and kept. */
export function walkOf(plan: DogPlan, h: number, k: number): Walk {
  const list = plan.walks[h];
  while (list.length <= k) {
    const n = list.length;
    const hh = plan.households[h];
    const prev = list[n - 1];
    const rest = createRng(hash(plan.level.seed ^ DOG_SALT, h, 1000 + n));
    const t0 = prev ? prev.t1 + rest.range(W.home[0], W.home[1]) : -hh.phase;
    list.push(buildWalk(plan, h, n, t0));
  }
  return list[k];
}

/** The walk household `h` is out on at `t` (or null, at home). */
export function walkAt(plan: DogPlan, h: number, t: number): Walk | null {
  for (let k = 0; ; k++) {
    const w = walkOf(plan, h, k);
    if (t < w.t0) return null;
    if (t < w.t1) return w;
  }
}

/** Deal every household's walks up to `t`, and gather what they left. */
function dealTo(plan: DogPlan, t: number): void {
  if (t > plan.dealt) {
    const upTo = Math.max(t, plan.dealt + 120);
    plan.households.forEach((_, h) => {
      let k = 0;
      while (walkOf(plan, h, k).t0 <= upTo) k++;
    });
    plan.dealt = upTo;
  }
  // Gathered afresh whenever a walk has been dealt since (by anything).
  const walks = plan.walks.reduce((n, list) => n + list.length, 0);
  if (walks !== plan.gathered) {
    plan.messes = plan.walks.flat().flatMap((w) => w.mess);
    plan.messes.sort((a, b) => a.at - b.at);
    plan.gathered = walks;
  }
}

/**
 * WHAT LIES ON THE SIDEWALKS AT `t`: every pile and patch the village's
 * dogs have left since the run began (laid at or after 0 and by `t`, and
 * not bagged by then), of the households out at `hour` — the latest
 * `DOG_WALK.kept` of them, oldest first, into `out`.
 */
export function messAt(plan: DogPlan, t: number, hour: number, out: Mess[] = []): Mess[] {
  dealTo(plan, t);
  out.length = 0;
  for (const m of plan.messes) {
    if (m.at > t) break;
    if (m.at < 0 || m.until <= t) continue;
    // A household not out at this hour has left nothing.
    if (!householdOut(plan, m.household, hour)) continue;
    out.push(m);
  }
  const start = Math.max(0, out.length - W.kept);
  if (start > 0) out.splice(0, start);
  return out;
}
