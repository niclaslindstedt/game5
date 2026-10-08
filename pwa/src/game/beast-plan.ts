// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE EVERY ANIMAL IS — the roster in `beast-defs.ts` laid over the map,
// and where each animal of each group is at a moment, as plain numbers.
// Three-free, the birds' split (`bird-plan.ts`): `beasts.ts` turns what
// comes back into instance matrices, and `tests/birds_test.ts` holds the
// model without a renderer in sight.
//
// A GROUP IS A ROUND, NOT A POSITION. What is planned is a HOME (a wood's
// edge, a meadow) and a ROUND — a closed ellipse on the open snow beside it
// — walked in a CYCLE of standing and moving. The distance walked is a
// closed form of the clock (`walked`: a trapezoid of speed per cycle — set
// off, walk, slow, stand), so where an animal is at time `t` is `beastPose`,
// a pure function of the group and the clock: it never slides, never
// teleports, and a replay walks it again step for step.
//
// THE FRIGHT is the one memory, and it is the caller's, exactly as the
// birds' flush is: a group an engine comes within `wary` of runs `flee`
// metres straight away from it and stays there — its whole round carried
// with it — until the next fright. `spookAt` is the rule, stated once;
// `beasts.ts` keeps the memory, and the model stays pure in its arguments.
//
// WHERE A HOME MAY BE is decided here too (`planBeasts`), on the renderer's
// own generator off the map's seed: never on or beside the loop, never in
// the woods — at the EDGE of them, or out in a MEADOW. The map is read and
// never written, so a pinned map's digest cannot see an animal.

import {
  TAU,
  createRng,
  regionOf,
  fromEuler,
  hash2,
  type GameState,
  type Level,
  type Quat,
  type Rng,
} from "@engine";

import { BEASTS, beastById, type BeastId, type BeastSpec } from "./beast-defs.ts";
import type { Band } from "./bird-defs.ts";
import { groupCount } from "./rarity.ts";
import { wildGround, type WildGround } from "./wild-ground.ts";

/** The salt on the map's seed the animals are dealt off. */
export const BEAST_SALT = 0x2f7a;

/** How close to the LOOP a group's home is held, m — an animal nobody
 * rides past is an animal nobody sees. */
const NEAR_COURSE = 220;
/** Clear snow a round keeps from the loop's centreline, m: past the
 * groomer, the berm and a margin — an animal is never met ON the track. */
const OFF_TRACK = 18;
/** Clear snow a round keeps from every trunk, m, at its samples. */
const OFF_TRUNK = 1.8;
/** A meadow home: no trunk within this much, m. An edge: a trunk within
 * `EDGE_WOOD` and none within `EDGE_OPEN` of the chosen spot. */
const MEADOW_OPEN = 22;
const EDGE_WOOD = 16;
const EDGE_OPEN = 7;
/** Steepest ground a round crosses. */
const ROUND_SLOPE = 0.6;
const ROUND_SAMPLES = 20;
const TRIES = 40;
/** How long a set-off or a pull-up takes, s. */
const RAMP = 2;
/** A frightened group: how long after its flight before it can be
 * frightened again, s. */
const SETTLE = 18;
/** The step a heading and a slope are read over, m. */
const LOOK = 0.6;

export type BeastGroup = {
  readonly id: string;
  readonly species: BeastId;
  readonly count: number;
  readonly home: { readonly x: number; readonly z: number };
  /** The round: centre, long semi-axis, squash, long axis heading, which
   * way round, and its length, m. */
  readonly round: {
    readonly x: number;
    readonly z: number;
    readonly radius: number;
    readonly ovality: number;
    readonly heading: number;
    readonly sense: 1 | -1;
    readonly length: number;
  };
  readonly cycle: number;
  readonly phase: number;
  readonly scatter: number;
};

export type BeastPlan = { readonly seed: number; readonly groups: readonly BeastGroup[] };

/** A group's fright: when it last ran, the run's own vector, and the
 * offset every run before it had already carried the group. */
export type Spook = {
  readonly at: number;
  readonly dx: number;
  readonly dz: number;
  readonly ox: number;
  readonly oz: number;
};

export const CALM: Spook = { at: -Infinity, dx: 0, dz: 0, ox: 0, oz: 0 };

export type BeastPose = {
  x: number;
  y: number;
  z: number;
  heading: number;
  pitch: number;
  q: Quat;
  /** Where in its gait cycle it is, rad, and how hard it is going, 0..1. */
  gait: number;
  stride: number;
  /** How far the head is down, 0..1. */
  graze: number;
};

export function freshBeastPose(): BeastPose {
  return {
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    pitch: 0,
    q: { x: 0, y: 0, z: 0, w: 1 },
    gait: 0,
    stride: 0,
    graze: 0,
  };
}

function smooth(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t;
  return x * x * (3 - 2 * x);
}

function inBand(rng: Rng, band: Band): number {
  return rng.range(band.min, band.max);
}

/** Ramanujan's ellipse perimeter. */
function perimeter(a: number, b: number): number {
  const h = ((a - b) / (a + b)) ** 2;
  return Math.PI * (a + b) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h)));
}

type Round = Pick<BeastGroup["round"], "x" | "z" | "radius" | "ovality" | "heading" | "length">;

/** The point `s` metres round a round (the angle taken as the arc's share
 * of the perimeter — near enough on these ellipses), and its tangent. */
export function roundAt(
  round: Round,
  s: number,
  out: { x: number; z: number; fx: number; fz: number },
): void {
  const a = (TAU * s) / round.length;
  const ch = Math.cos(round.heading);
  const sh = Math.sin(round.heading);
  const along = round.radius * Math.cos(a);
  const across = round.radius * round.ovality * Math.sin(a);
  out.x = round.x + along * sh + across * ch;
  out.z = round.z + along * ch - across * sh;
  const dA = -round.radius * Math.sin(a);
  const dC = round.radius * round.ovality * Math.cos(a);
  const vx = dA * sh + dC * ch;
  const vz = dA * ch - dC * sh;
  const n = Math.hypot(vx, vz) || 1;
  out.fx = vx / n;
  out.fz = vz / n;
}

/**
 * HOW FAR A GROUP HAS WALKED at `t`, m, and how hard it is walking now
 * (0..1 of its pace): per cycle it sets off, walks, pulls up and stands, a
 * trapezoid of speed whose integral is closed-form — so the distance is a
 * function of the clock, never a sum of frames.
 */
export function walked(group: BeastGroup, t: number): { s: number; pace: number } {
  const spec = beastById(group.species);
  const C = group.cycle;
  const m = spec.moveShare * C;
  const r = Math.min(RAMP, m / 3);
  const p = t / C + group.phase;
  const n = Math.floor(p);
  const u = (p - n) * C;
  let d: number;
  let pace: number;
  if (u < r) {
    d = (u * u) / (2 * r);
    pace = u / r;
  } else if (u < m - r) {
    d = r / 2 + (u - r);
    pace = 1;
  } else if (u < m) {
    d = m - r - ((m - u) * (m - u)) / (2 * r);
    pace = (m - u) / r;
  } else {
    d = m - r;
    pace = 0;
  }
  return { s: (n * (m - r) + d) * spec.speed * group.round.sense, pace };
}

/** How long a flight of this species takes, s. */
function fleeSeconds(spec: BeastSpec): number {
  return (spec.flee / spec.fleeSpeed) * 1.4;
}

/** How far through its latest flight a group is, 0..1. */
function fled(spec: BeastSpec, spook: Spook, t: number): number {
  const u = (t - spook.at) / fleeSeconds(spec);
  return u <= 0 ? 0 : u >= 1 ? 1 : smooth(u);
}

const at = { x: 0, z: 0, fx: 0, fz: 1 };

/** Where member `i` walks relative to the leader: how far BEHIND it round
 * the round, m, and how far to its right. The leader is 0, 0. */
export function memberSlot(
  group: BeastGroup,
  spec: BeastSpec,
  i: number,
): { lag: number; side: number } {
  if (i === 0) return { lag: 0, side: 0 };
  return {
    lag: i * spec.spread * 0.8,
    side: (hash2(i, 1, group.scatter) - 0.5) * 2 * spec.spread * 0.7,
  };
}

/** Where the member `i` stands in the plan at `t`, its heading and its
 * pace — without the ground under it. */
function placeOf(
  group: BeastGroup,
  spec: BeastSpec,
  i: number,
  t: number,
  spook: Spook,
): { x: number; z: number; heading: number; pace: number; s: number; flight: number } {
  const { s, pace } = walked(group, t);
  const { lag, side } = memberSlot(group, spec, i);
  const own = s - lag * group.round.sense;
  roundAt(group.round, own, at);
  const f = fled(spec, spook, t);
  const x = at.x + at.fz * side + spook.ox + spook.dx * f;
  const z = at.z - at.fx * side + spook.oz + spook.dz * f;
  const running = spook.at <= t && t - spook.at < fleeSeconds(spec);
  let heading: number;
  if (running) heading = Math.atan2(spook.dx, spook.dz);
  else {
    const walkHeading = Math.atan2(at.fx * group.round.sense, at.fz * group.round.sense);
    // Stood still, a herd faces every way a head can dig.
    const idle = (hash2(i, 2, group.scatter) - 0.5) * 2.6 * (1 - pace);
    heading = walkHeading + idle;
  }
  const flight = Math.hypot(spook.dx, spook.dz) * f;
  const u = (t - spook.at) / fleeSeconds(spec);
  const fleePace = running ? Math.sin(Math.PI * Math.min(1, Math.max(0, u))) : 0;
  // How hard the legs go, 0..1: an unhurried round is a fraction of the
  // gait's full swing, a flight all of it.
  const effort = Math.max(pace * (0.35 + 0.65 * (spec.speed / spec.fleeSpeed)), fleePace);
  return { x, z, heading, pace: effort, s: own, flight };
}

/**
 * Where animal `i` of `group` is at `t`, written into `out`: stood on the
 * DRAWN snow (sunk in by its own `sink`), pitched with the slope it stands
 * on, its gait read off the distance it has covered so the legs keep time
 * with the ground going by.
 */
export function beastPose(
  group: BeastGroup,
  i: number,
  t: number,
  ground: WildGround,
  out: BeastPose,
  spook: Spook = CALM,
): BeastPose {
  const spec = beastById(group.species);
  const p = placeOf(group, spec, i, t, spook);
  const hx = Math.sin(p.heading);
  const hz = Math.cos(p.heading);
  const half = Math.max(LOOK, spec.length * 0.5);
  const size = ground.level.size;
  const clampXZ = (v: number): number => Math.min(Math.max(v, 0), size);
  const ahead = ground.snowY(clampXZ(p.x + hx * half), clampXZ(p.z + hz * half));
  const behind = ground.snowY(clampXZ(p.x - hx * half), clampXZ(p.z - hz * half));
  const covered = Math.abs(p.s) + p.flight;
  const gait = (TAU * covered) / spec.stride + hash2(i, 3, group.scatter) * TAU;
  const stride = Math.min(1, p.pace);
  // A hare's bound lifts it clear of the snow at the top of every leap.
  const bounce = spec.gait === "bound" ? Math.abs(Math.sin(gait / 2)) * 0.18 * stride : 0;
  out.x = p.x;
  out.z = p.z;
  out.y = (ahead + behind) / 2 - spec.sink + bounce;
  out.heading = p.heading;
  out.pitch = Math.atan2(ahead - behind, 2 * half);
  out.gait = gait;
  out.stride = stride;
  out.graze = spec.grazes ? smooth(1 - stride * 4) : 0;
  const q = fromEuler(p.heading, out.pitch, 0);
  out.q.x = q.x;
  out.q.y = q.y;
  out.q.z = q.z;
  out.q.w = q.w;
  return out;
}

/**
 * THE FRIGHT RULE: the spook a group is under at `state.t`, given every
 * skier on the map. A group that has settled from its last flight and has
 * an engine inside `wary` of its leader runs `flee` metres straight away
 * from the nearest one — turned aside if straight away would put it on the
 * loop or off the map. Returns `spook` itself when nothing happens, so a
 * caller can tell a new fright by the change. The renderer keeps this
 * memory (`beasts.ts`); it is stated once, here.
 */
export function spookAt(
  group: BeastGroup,
  state: GameState,
  spook: Spook,
  ground: WildGround,
): Spook {
  const spec = beastById(group.species);
  const t = state.t;
  if (t - spook.at < fleeSeconds(spec) + SETTLE) return spook;
  const lead = placeOf(group, spec, 0, t, spook);
  let nx = 0;
  let nz = 0;
  let best = spec.wary;
  const hear = (x: number, z: number): void => {
    const d = Math.hypot(lead.x - x, lead.z - z);
    if (d < best) {
      best = d;
      nx = x;
      nz = z;
    }
  };
  hear(state.skier.x, state.skier.z);
  for (const r of state.rivals) hear(r.run.skier.x, r.run.skier.z);
  if (best >= spec.wary) return spook;
  const away = Math.atan2(lead.x - nx, lead.z - nz);
  const ox = spook.ox + spook.dx;
  const oz = spook.oz + spook.dz;
  for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
    const a = away + turn;
    const dx = Math.sin(a) * spec.flee;
    const dz = Math.cos(a) * spec.flee;
    const ex = lead.x + dx;
    const ez = lead.z + dz;
    if (!ground.inside(ex, ez, 20)) continue;
    if (ground.trackDistance(ex, ez) < OFF_TRACK) continue;
    if (ground.onIce(ex, ez)) continue;
    return { at: t, dx, dz, ox, oz };
  }
  return { at: t, dx: 0, dz: 0, ox, oz };
}

/** Is a round clear of the loop and the trunks, on the map and on ground
 * an animal walks? */
function roundFits(ground: WildGround, round: Round): boolean {
  for (let k = 0; k < ROUND_SAMPLES; k++) {
    roundAt(round, (k / ROUND_SAMPLES) * round.length, at);
    if (!ground.inside(at.x, at.z, 20)) return false;
    if (ground.trackDistance(at.x, at.z) < OFF_TRACK) return false;
    if (ground.nearestTree(at.x, at.z, OFF_TRUNK)) return false;
    if (ground.slope(at.x, at.z) > ROUND_SLOPE) return false;
    if (ground.onIce(at.x, at.z)) return false;
  }
  return true;
}

/** One try at a home of the kind a species keeps. */
function homeFor(rng: Rng, ground: WildGround, spec: BeastSpec): { x: number; z: number } | null {
  const level = ground.level;
  // With no wood to have an edge, an edge animal lives out in the open.
  if (spec.home === "meadow" || level.trees.length === 0) {
    const x = rng.range(0, level.size);
    const z = rng.range(0, level.size);
    if (ground.nearestTree(x, z, MEADOW_OPEN)) return null;
    return { x, z };
  }
  // The edge: a trunk near the loop, and the first open snow off it.
  const tree = rng.pick(level.trees);
  if (!tree) return null;
  const a0 = rng.range(0, TAU);
  for (let k = 0; k < 8; k++) {
    const a = a0 + (k / 8) * TAU;
    const x = tree.x + Math.sin(a) * EDGE_WOOD * 0.8;
    const z = tree.z + Math.cos(a) * EDGE_WOOD * 0.8;
    if (!ground.nearestTree(x, z, EDGE_OPEN)) return { x, z };
  }
  return null;
}

/** Lay every group over the map. Deterministic in the map's seed on the
 * renderer's own generator; reads the map and never writes it. */
export function planBeasts(level: Level): BeastPlan {
  const rng = createRng(level.seed ^ BEAST_SALT);
  const ground = wildGround(level);
  const km = level.track.length / 1000;
  const groups: BeastGroup[] = [];
  const region = regionOf(level).id;
  for (const spec of BEASTS) {
    if (!spec.regions.includes(region)) continue;
    const want = groupCount(rng, spec.perKm, km);
    for (let n = 0; n < want; n++) {
      for (let attempt = 0; attempt < TRIES; attempt++) {
        const home = homeFor(rng, ground, spec);
        if (!home || !ground.inside(home.x, home.z, 40)) continue;
        const toTrack = ground.trackDistance(home.x, home.z);
        if (toTrack > NEAR_COURSE || toTrack < OFF_TRACK) continue;
        const radius = inBand(rng, spec.round);
        const ovality = rng.range(0.35, 0.85);
        const heading = rng.range(0, TAU);
        // The round stands off the home into the open, so the edge's
        // animals keep the wood at their backs.
        const out = radius * rng.range(0.3, 0.9);
        const bearing = rng.range(0, TAU);
        const round = {
          x: home.x + Math.sin(bearing) * out,
          z: home.z + Math.cos(bearing) * out,
          radius,
          ovality,
          heading,
          length: perimeter(radius, radius * ovality),
        };
        if (!roundFits(ground, round)) continue;
        groups.push({
          id: `A${groups.length + 1}`,
          species: spec.id,
          count: rng.int(spec.herd.min, spec.herd.max),
          home,
          round: { ...round, sense: rng.chance(0.5) ? 1 : -1 },
          cycle: inBand(rng, spec.cycle),
          phase: rng.next(),
          scatter: rng.int(1, 0x7fffffff),
        });
        break;
      }
    }
  }
  return { seed: level.seed, groups };
}

const beastPlans = new WeakMap<Level, BeastPlan>();

/** THE PLAN FOR A MAP, laid once and kept against it. */
export function beastPlanFor(level: Level): BeastPlan {
  let hit = beastPlans.get(level);
  if (hit === undefined) {
    hit = planBeasts(level);
    beastPlans.set(level, hit);
  }
  return hit;
}

/** How many animals a plan holds of a species — an instance budget. */
export function beastCount(plan: BeastPlan, id: BeastId): number {
  let n = 0;
  for (const g of plan.groups) if (g.species === id) n += g.count;
  return n;
}
