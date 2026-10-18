// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE EVERY ANIMAL IS — the roster in `defs/beasts.ts` laid over the map,
// and where each animal of each group is at a moment, as plain numbers. ONE
// PLAN for the engine and the drawing: the engine meets an animal where
// `beastPlace` puts it (`beast-hit.ts`), the app's `beast-plan.ts` stands it
// on the drawn snow, and `tests/birds_test.ts` holds the model.
//
// A GROUP IS A ROUND, NOT A POSITION. What is planned is a HOME (a wood's
// edge, a meadow) and a ROUND — a closed ellipse on the open snow beside it
// — walked in a CYCLE of standing and moving. The distance walked is a
// closed form of the clock (`walked`: a trapezoid of speed per cycle — set
// off, walk, slow, stand), so where an animal is at time `t` is a pure
// function of the group and the clock: it never slides, never teleports,
// and a replay walks it again step for step.
//
// THE FRIGHT is the one memory: a group an engine comes within `wary` of
// runs `flee` metres — straight away from it, or, as often as its row's
// `bolts` says, ACROSS the line of the skier who put it up — and stays
// there, its whole round carried with it, until the next fright. `spookAt`
// is the rule, stated once; on a free ride the engine keeps the memory
// (`GameState.wild`), elsewhere the drawing does (`beasts.ts`).
//
// WHERE A HOME MAY BE is decided here too (`planBeasts`), on a generator of
// its own off the map's seed: never on or beside a piste, never in the
// woods — at the EDGE of them, or out in a MEADOW — and on a ski area
// beside its RUNS, about one group a run, so a skier going down one meets
// one. The map is read and never written, so a pinned map's digest cannot
// see an animal, and nothing is drawn from `state.rng`.

import { TAU, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { hash2 } from "@niclaslindstedt/oss-game-framework/core/noise";
import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { regionOf } from "../mapgen/regions.ts";
import type { Level } from "../mapgen/types.ts";
import { BEASTS, beastById, type BeastId, type BeastSpec } from "./defs/beasts.ts";
import type { Band } from "../mapgen/rules.ts";
import { groupCount } from "./rarity.ts";
import type { GameState } from "./state.ts";
import { wildGround, type WildGround } from "./wild-ground.ts";

/** The salt on the map's seed the animals are dealt off. */
export const BEAST_SALT = 0x2f7a;

/** How close to the LOOP a group's home is held, m — an animal nobody
 * rides past is an animal nobody sees. */
const NEAR_COURSE = 220;
/** Clear snow a round keeps from the loop's centreline, m: past the
 * groomer, the berm and a margin — an animal is never met ON the track —
 * and from any other run's of the ski area, whose width is not known here. */
const OFF_TRACK = 18;
const OFF_RUN = 26;
/** On a ski area, how far off a run a group's home lies, m: off the piste
 * and in sight of it. */
const BESIDE_RUN = { min: 34, max: 140 } as const;
/** On a ski area, GROUPS PER KILOMETRE of each run — about one a run. */
const PER_RUN_KM = 0.9;
/** The bolt across a skier's line: how far ahead of him it is aimed, rad
 * off square, and the least speed he must be going for it to happen, m/s. */
const BOLT_LEAD = 0.35;
const BOLT_SPEED = 3;
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
  const n = hypot(vx, vz) || 1;
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
/** How long a fleeing animal takes to wheel onto its flight, and back
 * onto its round as the flight runs out, s. */
const TURN_ONTO = 0.4;
const TURN_OFF = 0.8;

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
 * pace — without the ground under it. The one place an animal is: the
 * drawing stands it on the drawn snow (`beastPose`), the engine meets it
 * where this puts it (`beast-hit.ts`). */
export function beastPlace(
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
  const walkHeading = Math.atan2(at.fx * group.round.sense, at.fz * group.round.sense);
  // Stood still, a herd faces every way a head can dig.
  const idle = (hash2(i, 2, group.scatter) - 0.5) * 2.6 * (1 - pace);
  let heading = walkHeading + idle;
  if (running) {
    // Wheeled round onto the flight as it breaks, and back onto its round
    // as the flight runs out — a turn, never a frame's jump.
    const into = smooth((t - spook.at) / TURN_ONTO);
    const out = smooth((spook.at + fleeSeconds(spec) - t) / TURN_OFF);
    const away = Math.atan2(spook.dx, spook.dz);
    const gap = Math.atan2(Math.sin(away - heading), Math.cos(away - heading));
    heading += gap * Math.min(into, out);
  }
  const flight = hypot(spook.dx, spook.dz) * f;
  const u = (t - spook.at) / fleeSeconds(spec);
  const fleePace = running ? Math.sin(Math.PI * Math.min(1, Math.max(0, u))) : 0;
  // How hard the legs go, 0..1: an unhurried round is a fraction of the
  // gait's full swing, a flight all of it.
  const effort = Math.max(pace * (0.35 + 0.65 * (spec.speed / spec.fleeSpeed)), fleePace);
  return { x, z, heading, pace: effort, s: own, flight };
}

/** Is a point off every piste: the loop and every run of the ski area. */
function offPiste(ground: WildGround, x: number, z: number): boolean {
  return ground.trackDistance(x, z) >= OFF_TRACK && ground.runDistance(x, z, OFF_RUN) >= OFF_RUN;
}

/** Where a flight ends is a place an animal may stand. */
function landsWell(ground: WildGround, x: number, z: number): boolean {
  return ground.inside(x, z, 20) && offPiste(ground, x, z) && !ground.onIce(x, z);
}

/**
 * THE FRIGHT RULE: the spook a group is under at `state.t`, given every
 * skier on the map. A group that has settled from its last flight and has
 * an engine inside `wary` of its leader runs `flee` metres from the
 * nearest one: as often as its row `bolts` (dealt off a hash of the group
 * and the moment — never `state.rng`), ACROSS his line ahead of him, the
 * deer over the road; otherwise straight away, turned aside if that would
 * put it on a piste or off the map. Returns `spook` itself when nothing
 * happens, so a caller can tell a new fright by the change.
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
  const lead = beastPlace(group, spec, 0, t, spook);
  let nx = 0;
  let nz = 0;
  let nvx = 0;
  let nvz = 0;
  let best = spec.wary;
  const hear = (x: number, z: number, vx: number, vz: number): void => {
    const d = hypot(lead.x - x, lead.z - z);
    if (d < best) {
      best = d;
      nx = x;
      nz = z;
      nvx = vx;
      nvz = vz;
    }
  };
  const c = state.skier;
  hear(c.x, c.z, c.vx, c.vz);
  for (const r of state.rivals) hear(r.run.skier.x, r.run.skier.z, r.run.skier.vx, r.run.skier.vz);
  if (best >= spec.wary) return spook;
  const ox = spook.ox + spook.dx;
  const oz = spook.oz + spook.dz;
  // THE BOLT: square across his way, to the far side of it from where the
  // group stood, aimed a little ahead of him.
  const v = hypot(nvx, nvz);
  if (v >= BOLT_SPEED && hash2(group.scatter, Math.floor(t * 8), 11) < spec.bolts) {
    const way = Math.atan2(nvx, nvz);
    const side = nvx * (lead.z - nz) - nvz * (lead.x - nx) >= 0 ? 1 : -1;
    const a = way + side * (Math.PI / 2 - BOLT_LEAD);
    const dx = Math.sin(a) * spec.flee;
    const dz = Math.cos(a) * spec.flee;
    if (landsWell(ground, lead.x + dx, lead.z + dz)) return { at: t, dx, dz, ox, oz };
  }
  const away = Math.atan2(lead.x - nx, lead.z - nz);
  for (const turn of [0, 0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
    const a = away + turn;
    const dx = Math.sin(a) * spec.flee;
    const dz = Math.cos(a) * spec.flee;
    if (landsWell(ground, lead.x + dx, lead.z + dz)) return { at: t, dx, dz, ox, oz };
  }
  return { at: t, dx: 0, dz: 0, ox, oz };
}

/** Is a round clear of the loop and the trunks, on the map and on ground
 * an animal walks? */
function roundFits(ground: WildGround, round: Round): boolean {
  for (let k = 0; k < ROUND_SAMPLES; k++) {
    roundAt(round, (k / ROUND_SAMPLES) * round.length, at);
    if (!ground.inside(at.x, at.z, 20)) return false;
    if (!offPiste(ground, at.x, at.z)) return false;
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

/** A group laid off `home`, its round in the open beside it, or null when
 * the round does not fit. */
function groupAt(
  rng: Rng,
  ground: WildGround,
  spec: BeastSpec,
  home: { x: number; z: number },
  n: number,
): BeastGroup | null {
  const radius = inBand(rng, spec.round);
  const ovality = rng.range(0.35, 0.85);
  const heading = rng.range(0, TAU);
  // The round stands off the home into the open, so the edge's animals
  // keep the wood at their backs.
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
  if (!roundFits(ground, round)) return null;
  return {
    id: `A${n + 1}`,
    species: spec.id,
    count: rng.int(spec.herd.min, spec.herd.max),
    home,
    round: { ...round, sense: rng.chance(0.5) ? 1 : -1 },
    cycle: inBand(rng, spec.cycle),
    phase: rng.next(),
    scatter: rng.int(1, 0x7fffffff),
  };
}

/** One try at a home BESIDE A RUN: a point off its line to one side, and
 * — for an animal of the wood's edge — the open snow off the trunk nearest
 * it. */
function homeBeside(
  rng: Rng,
  ground: WildGround,
  spec: BeastSpec,
  points: readonly { x: number; z: number; heading: number }[],
): { x: number; z: number } | null {
  const p = points[rng.int(0, points.length - 1)];
  const side = rng.chance(0.5) ? 1 : -1;
  const off = rng.range(BESIDE_RUN.min, BESIDE_RUN.max) * side;
  const x = p.x + Math.cos(p.heading) * off;
  const z = p.z - Math.sin(p.heading) * off;
  if (spec.home === "meadow" || ground.level.trees.length === 0) {
    return ground.nearestTree(x, z, MEADOW_OPEN) ? null : { x, z };
  }
  const tree = ground.nearestTree(x, z, BESIDE_RUN.max * 0.5);
  if (!tree) return null;
  const a0 = rng.range(0, TAU);
  for (let k = 0; k < 8; k++) {
    const a = a0 + (k / 8) * TAU;
    const ex = tree.x + Math.sin(a) * EDGE_WOOD * 0.8;
    const ez = tree.z + Math.cos(a) * EDGE_WOOD * 0.8;
    if (!ground.nearestTree(ex, ez, EDGE_OPEN)) return { x: ex, z: ez };
  }
  return null;
}

/** A species of the region, drawn by how common each is (`perKm`). */
function pickSpecies(rng: Rng, roster: readonly BeastSpec[], total: number): BeastSpec {
  let u = rng.next() * total;
  for (const spec of roster) {
    u -= spec.perKm;
    if (u < 0) return spec;
  }
  return roster[roster.length - 1];
}

/** Lay every group over the map. Deterministic in the map's seed on a
 * generator of its own; reads the map and never writes it. On a SKI AREA
 * the groups go beside its runs, `PER_RUN_KM` of them a kilometre of each
 * and each a species of the region drawn by how common it is; on a map
 * with none, `perKm` a kilometre of the loop. */
export function planBeasts(level: Level): BeastPlan {
  const rng = createRng(level.seed ^ BEAST_SALT);
  const ground = wildGround(level);
  const groups: BeastGroup[] = [];
  const region = regionOf(level).id;
  const roster = BEASTS.filter((spec) => spec.regions.includes(region));
  const runs = level.resort?.runs ?? [];
  if (runs.length > 0 && roster.length > 0) {
    const total = roster.reduce((a, spec) => a + spec.perKm, 0);
    for (const run of runs) {
      if (run.points.length === 0) continue;
      const want = groupCount(rng, PER_RUN_KM, run.length / 1000);
      for (let n = 0; n < want; n++) {
        const spec = pickSpecies(rng, roster, total);
        for (let attempt = 0; attempt < TRIES; attempt++) {
          const home = homeBeside(rng, ground, spec, run.points);
          if (!home || !ground.inside(home.x, home.z, 40) || !offPiste(ground, home.x, home.z)) {
            continue;
          }
          const group = groupAt(rng, ground, spec, home, groups.length);
          if (group) {
            groups.push(group);
            break;
          }
        }
      }
    }
    return { seed: level.seed, groups };
  }
  const km = level.track.length / 1000;
  for (const spec of roster) {
    const want = groupCount(rng, spec.perKm, km);
    for (let n = 0; n < want; n++) {
      for (let attempt = 0; attempt < TRIES; attempt++) {
        const home = homeFor(rng, ground, spec);
        if (!home || !ground.inside(home.x, home.z, 40)) continue;
        const toTrack = ground.trackDistance(home.x, home.z);
        if (toTrack > NEAR_COURSE || toTrack < OFF_TRACK) continue;
        const group = groupAt(rng, ground, spec, home, groups.length);
        if (group) {
          groups.push(group);
          break;
        }
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

/** LAY A MAP'S ANIMALS BY HAND: `plan` is what every reader of `level`
 * gets from now on — a lab's or a test's animal stood where it wants it. */
export function layBeasts(level: Level, plan: BeastPlan): void {
  beastPlans.set(level, plan);
}

/** How many animals a plan holds of a species — an instance budget. */
export function beastCount(plan: BeastPlan, id: BeastId): number {
  let n = 0;
  for (const g of plan.groups) if (g.species === id) n += g.count;
  return n;
}
