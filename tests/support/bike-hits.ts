// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIKE AGAINST THE WORLD (`make bike-hit`, `tests/bike_hit_test.ts`):
// the downhill bike ridden through the game's own step into everything a
// summer mountain stands in its way — a trunk head-on and glancing at 10,
// 20 and 35 km/h on the bench, then on a summer map a rock garden, a lift's
// tower, a building's wall, a floodlight mast, the race line's tape, a parked
// car, a trail's bench edge (into its cut and off its fill), a steep meadow
// ridden across, and a pond — each row read for what came of it: thrown or
// not and how, the hardest closing speed and blow (g, `body.ts`), the
// injuries, how deep the bike or the rider ever stood inside a solid, how
// far the bike went on once it threw him (a bike left frozen in the air is
// a fault), and whether the restart stood him clear.

import {
  bikeAim,
  bikePilot,
  bikeTrailById,
  bikeWorldOf,
  createGame,
  NEUTRAL_INPUT,
  placeBike,
  postsOf,
  solidsNear,
  solidsOf,
  step,
  SUMMER_DAY,
  TUNING,
  liftPlans,
  severityOf,
  trafficOf,
  wallSegmentsOf,
  type BodyPart,
  type GameState,
  type Level,
  type SkierInput,
  type TreeDef,
} from "@engine";
import { shapedLevel } from "./synthetic.ts";
import { summerMap } from "./bike-bot.ts";

/** What one staged meeting came to. */
export type HitResult = {
  thrown: boolean;
  /** How the bike said it threw him, or the skier's own crash cause when
   * something else did (a car), else null. */
  how: string | null;
  /** The hardest closing speed into a solid the bike said, m/s. */
  hit: number;
  /** The hardest blow on his body, g, and the part that took it. */
  g: number;
  part: BodyPart | null;
  injuries: string[];
  iss: number;
  /** The deepest the bike's frame, and the rider (stood or thrown), ever
   * stood inside a solid's own radius, m (0: never). */
  bikeIn: number;
  riderIn: number;
  /** How fast the bike was going as it threw him, m/s, and how far it went
   * on in the next second, m. */
  bikeAt: number;
  bikeOn: number;
  /** How far its own speed said it went in that second, m: a bike whose
   * speed says it moves while it stands still is frozen. */
  bikeSaid: number;
  /** Stood back up (`right`): how deep the bike stood into a solid's reach. */
  restartIn: number | null;
  /** How far the bike got from where it was staged, m, and its speed at
   * the end, km/h. */
  went: number;
  end: number;
};

/** What a row holds the meeting to. `thrown` null: either. */
export type HitExpect = {
  thrown: boolean | null;
  how?: readonly string[];
  /** The hardest blow's band, g. */
  g?: readonly [number, number];
  /** It must have got this far on, m (ridden through, not stopped). */
  past?: number;
  /** ...or been stopped within this, m. */
  within?: number;
};

export type HitRow = {
  id: string;
  group: string;
  label: string;
  expect: HitExpect;
  run(): HitResult;
};

/** How deep a solid may be stood in before it is a fault, m — the push out
 * of a step leaves a body a hair inside. */
export const INSIDE = 0.05;

// ---- staging ---------------------------------------------------------------

type Stage = {
  level: Level;
  x: number;
  z: number;
  heading: number;
  /** km/h. */
  kmh: number;
  seconds?: number;
  /** The keys each step; neutral (coasting, hands on) unless given. */
  hand?: (s: GameState, t: number) => SkierInput;
  /** Built on a map that asks for summer's own day. */
  day?: { dayOfYear: number };
};

/** A summer bike ride on `o.level`, the bike stood at (x, z) facing
 * `heading` rolling at `kmh`, stepped for `seconds` under `hand`. */
export function stageHit(o: Stage): HitResult {
  let s = createGame({
    level: o.level,
    mode: "free",
    summer: true,
    bike: true,
    day: o.day,
    spawn: { x: o.x, z: o.z },
    quiet: true,
  });
  const b0 = s.bike!;
  placeBike(b0, bikeWorldOf(s.level, 0), o.x, o.z, o.heading, o.kmh / 3.6);
  s.skier.x = b0.rider.x;
  s.skier.y = b0.rider.y;
  s.skier.z = b0.rider.z;
  const solids = solidsOf(s.level);
  const out: HitResult = {
    thrown: false,
    how: null,
    hit: 0,
    g: 0,
    part: null,
    injuries: [],
    iss: 0,
    bikeIn: 0,
    riderIn: 0,
    bikeAt: 0,
    bikeOn: 0,
    bikeSaid: 0,
    restartIn: null,
    went: 0,
    end: 0,
  };
  let thrownAt: { x: number; z: number; t: number } | null = null;
  const steps = Math.round((o.seconds ?? 4) / TUNING.dt);
  for (let i = 0; i < steps; i++) {
    const t = i * TUNING.dt;
    s = step(s, o.hand ? o.hand(s, t) : NEUTRAL_INPUT);
    const b = s.bike!;
    const c = s.skier;
    for (const e of s.events) {
      if (e.kind === "hit") out.hit = Math.max(out.hit, e.speed);
      if (e.kind === "injury") out.injuries.push(`${e.part}:${e.injury}:${e.ais}`);
      if (e.kind === "wipeout" && !out.thrown) {
        out.thrown = true;
        // Thrown by something past the bike (a car), the wipeout says so.
        if (e.cause !== "bike") out.how = e.cause;
        out.bikeAt = Math.hypot(b.vx, b.vz);
        thrownAt = { x: b.x, z: b.z, t };
      }
      if (e.kind === "bike" && e.phase === "crash" && e.how && !out.how) out.how = e.how;
      if (e.kind === "bike" && e.phase === "right" && out.restartIn === null)
        out.restartIn = Math.max(0, bikeDepth(s, near(s, solids, b.x, b.z), BIKE_HALF.w));
    }
    // The restart mends him: the worst he ever lay hurt.
    if (s.events.some((e) => e.kind === "injury")) out.iss = Math.max(out.iss, severityOf(c.body));
    if (c.body.impact && c.body.impact.g > out.g) {
      out.g = c.body.impact.g;
      out.part = c.body.impact.part;
    }
    out.bikeIn = Math.max(out.bikeIn, bikeDepth(s, near(s, solids, b.x, b.z), 0));
    const p = c.thrown ? c.thrown.points : null;
    out.riderIn = Math.max(
      out.riderIn,
      riderDepth(s, near(s, solids, p ? p[0] : c.x, p ? p[2] : c.z)),
    );
    if (thrownAt && t - thrownAt.t <= 1) {
      out.bikeOn = Math.hypot(b.x - thrownAt.x, b.z - thrownAt.z);
      out.bikeSaid += Math.hypot(b.vx, b.vz) * TUNING.dt;
    }
  }
  const b = s.bike!;
  out.went = Math.hypot(b.x - o.x, b.z - o.z);
  out.end = b.speed * 3.6;
  out.iss = Math.max(out.iss, severityOf(s.skier.body));
  return out;
}

/** The bike's plan as `bike.ts` meets the solids with. */
const BIKE_HALF = { l: 1.05, w: 0.3 };

/** How deep the bike's centre line stands inside any solid's radius plus
 * `pad`, m (negative: clear). Only the bike's own plan while upright. */
function bikeDepth(s: GameState, solids: readonly SolidLike[], pad: number): number {
  const b = s.bike!;
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  let worst = -Infinity;
  for (const t of solids) {
    if (Math.abs(t.x - b.x) > 4 || Math.abs(t.z - b.z) > 4) continue;
    if (b.y < t.y - 1 || b.y > t.y + t.height) continue;
    const u = Math.max(-BIKE_HALF.l, Math.min(BIKE_HALF.l, (t.x - b.x) * fx + (t.z - b.z) * fz));
    const d = Math.hypot(b.x + fx * u - t.x, b.z + fz * u - t.z);
    worst = Math.max(worst, t.radius + pad - d);
  }
  return worst;
}

type SolidLike = { x: number; z: number; y: number; height: number; radius: number };

const nearIds: number[] = [];
/** The solids within a few metres of (x, z) — the map's woods are
 * thousands of trunks, so the depths read only these. */
function near(s: GameState, solids: readonly SolidLike[], x: number, z: number): SolidLike[] {
  return solidsNear(s.level, x, z, 5, nearIds).map((i) => solids[i]);
}

/** How deep the rider (stood, or every point of his thrown body) stands
 * inside any solid, m. */
function riderDepth(s: GameState, solids: readonly SolidLike[]): number {
  const c = s.skier;
  const pts: number[] = c.thrown ? (c.thrown.points as number[]) : [c.x, c.y, c.z];
  let worst = 0;
  for (let k = 0; k < pts.length; k += 3) {
    const x = pts[k];
    const y = pts[k + 1];
    const z = pts[k + 2];
    for (const t of solids) {
      if (Math.abs(t.x - x) > 3 || Math.abs(t.z - z) > 3) continue;
      if (y < t.y - 0.5 || y > t.y + t.height) continue;
      worst = Math.max(worst, t.radius - Math.hypot(x - t.x, z - t.z));
    }
  }
  return worst;
}

// ---- the bench: a lone trunk -------------------------------------------------

/** A trunk on a gentle meadow: 30 cm across at the breast (a grown spruce
 * of a ski area's woods), on a 4 % fall so the bike keeps its pace. */
const TRUNK: TreeDef = { x: 300, z: 300, y: 0, height: 14, radius: 0.15, crown: 2.5 };
// isolation:stateless: its benches, built once and read only (tests/support/isolation.ts).
let bench: Level | null = null;
function trunkLevel(): Level {
  bench ??= shapedLevel((_x, z) => -0.04 * z, { trees: [{ ...TRUNK }] });
  return bench;
}

/** Into the lone trunk at `kmh`: head-on (`off` 0) or glancing, its line
 * `off` m to the trunk's side. */
function trunk(kmh: number, off: number): HitResult {
  return stageHit({
    level: trunkLevel(),
    x: TRUNK.x + off,
    z: TRUNK.z - 7,
    heading: 0,
    kmh,
    seconds: 6,
  });
}

// ---- a summer map ----------------------------------------------------------

const MAP_SEED = 38;
let built: GameState | null = null;
/** Seed 38 in midsummer with its bike park laid, once. */
function summer(): GameState {
  built ??= createGame({
    level: summerMap(MAP_SEED),
    mode: "free",
    summer: true,
    bike: true,
    day: { dayOfYear: SUMMER_DAY },
    quiet: true,
  });
  return built;
}
const map = (): Level => summer().level;

/** The fall line's heading at (x, z): the way the ground drops. */
function fallHeading(level: Level, x: number, z: number): number {
  const n = { x: 0, y: 1, z: 0 };
  level.normalAt(x, z, n);
  return Math.atan2(n.x, n.z);
}

/** A run-up `back` m long toward (x, z) along `heading`: clear of every
 * solid but `skip` by `room` m, and never steeper than `steep`. */
const around: number[] = [];
function clearRun(
  level: Level,
  x: number,
  z: number,
  heading: number,
  back: number,
  skip: number,
  room = 1.2,
  steep = 0.35,
  from = 0.5,
): boolean {
  const solids = solidsOf(level);
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  for (let d = from; d <= back; d += 0.5) {
    const px = x - fx * d;
    const pz = z - fz * d;
    if (Math.abs(level.groundAt(px + fx, pz + fz) - level.groundAt(px, pz)) > steep) return false;
    for (const i of solidsNear(level, px, pz, room + 1, around)) {
      if (i === skip) continue;
      const t = solids[i];
      if (Math.hypot(t.x - px, t.z - pz) < t.radius + room) return false;
    }
  }
  return true;
}

/** A SOLID of seed 38's summer map, met from `back` m up its fall line: the
 * first in `pick` (indices into `solidsOf`) with a clear run-up. */
function intoSolid(pick: (level: Level) => number[], kmh: number, back = 8): HitResult {
  const level = map();
  const solids = solidsOf(level);
  for (const i of pick(level)) {
    const t = solids[i];
    const h = fallHeading(level, t.x, t.z);
    if (!clearRun(level, t.x, t.z, h, back + 2, i)) continue;
    return stageHit({
      level,
      x: t.x - Math.sin(h) * back,
      z: t.z - Math.cos(h) * back,
      heading: h,
      kmh,
      seconds: 8,
      day: { dayOfYear: SUMMER_DAY },
    });
  }
  throw new Error("no solid with a clear run-up");
}

/** The lifts' towers (not the bullwheels' posts), by index into `solidsOf`. */
function towers(level: Level): number[] {
  const first = level.trees.length;
  const out: number[] = [];
  let k = first;
  for (const plan of liftPlans(level)) {
    plan.supports.forEach((s, j) => {
      if (j > 0 && j < plan.supports.length - 1 && !s.pad) out.push(k + j);
    });
    k += plan.supports.length;
  }
  return out;
}

/** The posts past the lifts' (masts, guns), by index into `solidsOf`. */
function masts(level: Level): number[] {
  const first = level.trees.length;
  let lifts = 0;
  for (const plan of liftPlans(level)) lifts += plan.supports.length;
  const out: number[] = [];
  for (let k = first + lifts; k < first + postsOf(level).length; k++) out.push(k);
  return out;
}

/** The trunks within a few metres of a trail's tread, nearest first. */
function trailTrees(level: Level): number[] {
  const park = level.bikePark;
  const out: number[] = [];
  if (!park) return out;
  const near: number[] = [];
  for (const tr of park.trails) {
    for (let k = 0; k < tr.points.length && out.length < 200; k += 4) {
      const p = tr.points[k];
      for (const i of solidsNear(level, p.x, p.z, 4, near)) {
        if (i < level.trees.length && level.trees[i].radius >= 0.12 && !out.includes(i))
          out.push(i);
      }
    }
  }
  return out;
}

/** Into a building's wall square from `back` m out, at `kmh`. */
function intoWall(kmh: number, back = 7): HitResult {
  const level = map();
  for (const w of wallSegmentsOf(level)) {
    const len = Math.hypot(w.bx - w.ax, w.bz - w.az);
    if (len < 5) continue;
    const mx = (w.ax + w.bx) / 2;
    const mz = (w.az + w.bz) / 2;
    for (const side of [1, -1]) {
      const nx = (-(w.bz - w.az) / len) * side;
      const nz = ((w.bx - w.ax) / len) * side;
      const heading = Math.atan2(-nx, -nz);
      const x0 = mx + nx * (w.half + 0.4);
      const z0 = mz + nz * (w.half + 0.4);
      // The wall's own posts are what it is ridden into: the run-up is
      // held clear from 2 m out.
      if (!clearRun(level, x0, z0, heading, back + 1, -1, 1.2, 0.25, 2)) continue;
      return stageHit({
        level,
        x: x0 - Math.sin(heading) * back,
        z: z0 - Math.cos(heading) * back,
        heading,
        kmh,
        seconds: 8,
        day: { dayOfYear: SUMMER_DAY },
      });
    }
  }
  throw new Error("no wall with a clear run-up");
}

/** A trail's point `s` m along trail `id` (or the first trail of `kind`/a
 * feature `feature`), and the trail. */
function trailAt(pick: { feature?: string; race?: boolean; grade?: string }) {
  const park = map().bikePark!;
  for (const t of park.trails) {
    if (pick.race && t.kind !== "race") continue;
    if (pick.grade && t.grade !== pick.grade) continue;
    if (pick.feature) {
      const f = t.features.find((x) => x.kind === pick.feature);
      if (!f) continue;
      return { trail: t, s: f.from };
    }
    return { trail: t, s: t.start + 200 };
  }
  throw new Error("no such trail");
}

function pointAt(trailId: string, s: number) {
  const t = bikeTrailById(map(), trailId)!;
  let best = t.points[0];
  for (const p of t.points) if (Math.abs(p.s - s) < Math.abs(best.s - s)) best = p;
  return best;
}

/** Down a rock garden from `before` m short of it: on the bot's own line
 * (`bot`) or coasting straight in at `kmh`. */
function rockGarden(kmh: number, bot: boolean): HitResult {
  const { trail, s } = trailAt({ feature: "rocks", grade: "black" });
  const p = pointAt(trail.id, s - 8);
  let aim: ReturnType<typeof bikeAim> | null = null;
  return stageHit({
    level: map(),
    x: p.x,
    z: p.z,
    heading: p.heading,
    kmh,
    seconds: 6,
    day: { dayOfYear: SUMMER_DAY },
    hand: bot
      ? (st) => {
          if (!aim) {
            aim = bikeAim(st, trail.id);
            aim.s = p.s;
          }
          return bikePilot(st, aim);
        }
      : undefined,
  });
}

/** Off a trail's tread square across it, at `kmh`: `into` the bench's cut
 * (its uphill side) or off its fill (downhill). */
function benchEdge(kmh: number, into: boolean): HitResult {
  const { trail } = trailAt({ grade: "red" });
  // A stretch on a real sidehill: the most cut or fill along it.
  let best = trail.points[10];
  let most = 0;
  for (const p of trail.points.slice(10, -10)) {
    const cut = Math.abs(p.ground - p.y);
    if (cut > most) {
      most = cut;
      best = p;
    }
  }
  // +1: the right of the way it runs is downhill.
  const right = best.heading + Math.PI / 2;
  const heading = into === (best.downhill === 1) ? right + Math.PI : right;
  return stageHit({
    level: map(),
    x: best.x - Math.sin(heading) * 2,
    z: best.z - Math.cos(heading) * 2,
    heading,
    kmh,
    seconds: 5,
    day: { dayOfYear: SUMMER_DAY },
  });
}

/** Across a steep open meadow (30°–40°) along its contour, at `kmh`. */
function sideSlope(kmh: number): HitResult {
  const level = map();
  const n = { x: 0, y: 1, z: 0 };
  const step = 16;
  for (let z = 200; z < level.size - 200; z += step) {
    for (let x = 200; x < level.size - 200; x += step) {
      level.normalAt(x, z, n);
      const pitch = Math.acos(n.y);
      if (pitch < 0.55 || pitch > 0.68) continue;
      const contour = Math.atan2(n.x, n.z) + Math.PI / 2;
      if (!clearRun(level, x, z, contour, 0.5, -1, 2, 10)) continue;
      if (
        !clearRun(
          level,
          x + Math.sin(contour) * 12,
          z + Math.cos(contour) * 12,
          contour,
          12,
          -1,
          2,
          10,
        )
      )
        continue;
      return stageHit({
        level,
        x,
        z,
        heading: contour,
        kmh,
        seconds: 5,
        day: { dayOfYear: SUMMER_DAY },
      });
    }
  }
  throw new Error("no steep meadow");
}

/** Along the race line's taped edge at `kmh`, the tread's edge under the
 * outer wheel. */
function tape(kmh: number): HitResult {
  const { trail } = trailAt({ race: true });
  // The straightest stretch of it clear of its features (a rock garden on
  // it would throw him wherever on the tread he rode).
  const clear = (s: number) => !trail.features.some((f) => s > f.from - 5 && s < f.to + 30);
  let best = 20;
  let least = Infinity;
  for (let k = 20; k < trail.points.length - 30; k++) {
    if (!clear(trail.points[k].s)) continue;
    const bend = Math.abs(trail.points[k + 15].heading - trail.points[k].heading);
    if (bend < least) {
      least = bend;
      best = k;
    }
  }
  const p = trail.points[best];
  const right = p.heading + Math.PI / 2;
  const off = p.width / 2 - 0.15;
  return stageHit({
    level: map(),
    x: p.x + Math.sin(right) * off,
    z: p.z + Math.cos(right) * off,
    heading: p.heading,
    kmh,
    seconds: 3,
    day: { dayOfYear: SUMMER_DAY },
  });
}

/** Into a car parked in the village's car park, from its side. */
function parkedCar(kmh: number): HitResult {
  const level = map();
  const plan = trafficOf(level);
  if (!plan) throw new Error("no traffic");
  for (const p of plan.parked) {
    const side = p.heading + Math.PI / 2;
    const x0 = p.x - Math.sin(side) * 8;
    const z0 = p.z - Math.cos(side) * 8;
    if (Math.abs(level.groundAt(x0, z0) - level.groundAt(p.x, p.z)) > 1) continue;
    return stageHit({
      level,
      x: x0,
      z: z0,
      heading: side,
      kmh,
      seconds: 6,
      day: { dayOfYear: SUMMER_DAY },
    });
  }
  throw new Error("no parked car");
}

/** A pond on the bench, ridden into at `kmh`. */
let pondLevel: Level | null = null;
function pond(kmh: number): HitResult {
  if (!pondLevel) {
    pondLevel = shapedLevel(() => 0);
    const ring = new Float32Array([280, 300, 320, 300, 320, 340, 280, 340]);
    pondLevel.water = [{ kind: "pond", rings: [ring], y: 0, area: 1600 }];
  }
  return stageHit({ level: pondLevel, x: 300, z: 290, heading: 0, kmh, seconds: 5 });
}

// ---- the rows --------------------------------------------------------------

/** Thrown over the bars into or off a solid: what `bike.ts` calls it. */
const STRUCK = ["hit", "bars"] as const;
const DOWN = ["down", "lowside", "washout", "hit", "bars"] as const;

export const HIT_ROWS: HitRow[] = [
  // A trunk met square stops the front wheel dead: at 10 km/h a rider
  // stops on it or steps off; from 20 km/h he goes over the bars into it.
  ...[10, 20, 35].map((k): HitRow => ({
    id: `tree-${k}`,
    group: "trunk",
    label: `a 30 cm trunk head-on at ${k} km/h`,
    expect:
      k <= 10
        ? { thrown: null, within: 8 }
        : { thrown: true, how: STRUCK, g: [k < 30 ? 10 : 25, 400] },
    run: () => trunk(k, 0),
  })),
  // Glancing: the bar end or a shoulder clipped — a turn off it at 10 km/h,
  // the bar snatched and him off at speed.
  ...[10, 20, 35].map((k): HitRow => ({
    id: `glance-${k}`,
    group: "trunk",
    label: `a 30 cm trunk glancing (bar end) at ${k} km/h`,
    expect:
      k <= 10
        ? { thrown: false, past: 8 }
        : k <= 20
          ? { thrown: null }
          : { thrown: true, how: DOWN },
    run: () => trunk(k, 0.5),
  })),
  {
    id: "trail-tree",
    group: "map",
    label: "a trunk beside a trail, at 25 km/h",
    expect: { thrown: true, how: STRUCK, g: [15, 400] },
    run: () => intoSolid(trailTrees, 25),
  },
  {
    id: "rocks-bot",
    group: "map",
    label: "a black's rock garden on the bot's line",
    expect: { thrown: null, past: 10 },
    run: () => rockGarden(15, true),
  },
  {
    id: "rocks-25",
    group: "map",
    label: "a black's rock garden coasted into at 25 km/h",
    expect: { thrown: null },
    run: () => rockGarden(25, false),
  },
  {
    id: "tower",
    group: "map",
    label: "a lift tower's column at 25 km/h",
    expect: { thrown: true, how: STRUCK, g: [15, 400] },
    run: () => intoSolid(towers, 25),
  },
  {
    id: "mast",
    group: "map",
    label: "a mast or a post at 25 km/h",
    expect: { thrown: true, how: STRUCK, g: [15, 400] },
    run: () => intoSolid(masts, 25),
  },
  {
    id: "wall",
    group: "map",
    label: "a building's wall square at 20 km/h",
    expect: { thrown: true, how: STRUCK, g: [10, 400] },
    run: () => intoWall(20),
  },
  {
    id: "car",
    group: "map",
    label: "a parked car's side at 20 km/h",
    expect: { thrown: true, how: ["car"] },
    run: () => parkedCar(20),
  },
  {
    id: "tape",
    group: "map",
    label: "along the race line's taped edge at 30 km/h",
    expect: { thrown: false, past: 15 },
    run: () => tape(30),
  },
  {
    id: "cut",
    group: "map",
    label: "square into a red's bench cut at 15 km/h",
    expect: { thrown: null },
    run: () => benchEdge(15, true),
  },
  {
    id: "fill",
    group: "map",
    label: "square off a red's bench fill at 15 km/h",
    expect: { thrown: null },
    run: () => benchEdge(15, false),
  },
  {
    id: "steep",
    group: "map",
    label: "across a 32–39° meadow at 15 km/h",
    expect: { thrown: true, how: DOWN },
    run: () => sideSlope(15),
  },
  {
    id: "pond",
    group: "bench",
    label: "into a pond at 20 km/h",
    // 10 m of grass to its shore, then the water's drag (Crr 0.5) stops it
    // within a few metres of it.
    expect: { thrown: null, within: 15 },
    run: () => pond(20),
  },
];

/** Whether a meeting came out as its row holds: the expected throw, its
 * how, its blow, its distance — and never a solid stood inside, a bike
 * frozen while it threw him, or a restart into a solid. */
export function hitFaults(row: HitRow, r: HitResult): string[] {
  const e = row.expect;
  const out: string[] = [];
  if (e.thrown !== null && r.thrown !== e.thrown) out.push(r.thrown ? "thrown" : "not thrown");
  if (r.thrown && e.how && r.how && !e.how.includes(r.how)) out.push(`how ${r.how}`);
  if (r.thrown && e.g && (r.g < e.g[0] || r.g > e.g[1])) out.push(`g ${r.g.toFixed(0)}`);
  if (e.past !== undefined && r.went < e.past) out.push(`stopped at ${r.went.toFixed(1)} m`);
  if (e.within !== undefined && r.went > e.within && !r.thrown)
    out.push(`ran ${r.went.toFixed(1)} m`);
  if (r.bikeIn > INSIDE) out.push(`bike ${r.bikeIn.toFixed(2)} m in`);
  if (r.riderIn > INSIDE + 0.1) out.push(`rider ${r.riderIn.toFixed(2)} m in`);
  // Thrown, the bike goes where its own speed says: a bike whose speed says
  // half a metre or more while it stands still is frozen (or pinned on a
  // solid it should have stopped against).
  if (r.thrown && r.bikeSaid > 0.5 && r.bikeOn < 0.5 * r.bikeSaid) out.push("bike frozen");
  if (r.restartIn !== null && r.restartIn > INSIDE)
    out.push(`restart ${r.restartIn.toFixed(2)} m in`);
  return out;
}
