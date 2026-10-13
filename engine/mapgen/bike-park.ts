// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R44, R45 — THE BIKE PARK laid over a summer ski area (`setBikePark`): the
// lifts that carry bikes chosen, a grade dealt to each trail off their
// tops, each trail WALKED down the face from its head on the top's apron to
// its end beside a bottom station (`bike-trail-walk.ts`), BENCHED into the
// hillside (`bike-trail-shape.ts`), its FEATURES laid (`bike-features.ts`)
// and the best of a slot's tries kept; then the DOWNHILL RACE LINE, the
// junctions, and the whole laid as a surface over the map
// (`bike-surface.ts`).
//
// Every draw is off the park's own stream (`park.salt` beside the map's
// seed), and the map it is laid on is not touched — `withBikeSurface`
// returns a new one — so no map's digest moves. A map with no ski area
// carries no park.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { liftPlans, type LiftPlan } from "../game/lift-line.ts";
import { parkKeep, type ParkKeep } from "./bike-park-keep.ts";
import { BIKE_PARK_RULES as B, type TrailGrade, type TrailRule } from "./bike-park-rules.ts";
import type {
  BikeApron,
  BikeFeature,
  BikeJunction,
  BikePark,
  BikeTrail,
  BikeTrailHead,
  BikeTrailPoint,
} from "./bike-park-types.ts";
import { crossingMiss, levelCrossings } from "./bike-crossings.ts";
import { layFeatures } from "./bike-features.ts";
import { withBikeSurface } from "./bike-surface.ts";
import { benchOf, turnsOf } from "./bike-trail-shape.ts";
import { fallAt, walkFailure, walkTrail, type WalkSlot } from "./bike-trail-walk.ts";
import type { Level } from "./types.ts";

const RAD = Math.PI / 180;
/** A try's score lost a metre its crossings miss the trails already laid
 * by (they are levelled after, `levelCrossings`, but a big miss is
 * levelled only by long ramps on both, or not at all). */
const CROSS_COST = 2;
const laid = new WeakMap<Level, Level>();

/** A lab's ear on the walk: every try's outcome, or nothing. */
let trace: ((line: string, trail?: BikeTrail) => void) | null = null;
/** Hand the lab every try's outcome (`null` to stop). */
export function traceBikePark(fn: ((line: string, trail?: BikeTrail) => void) | null): void {
  trace = fn;
}

const dealt = (rng: Rng, [lo, hi]: readonly [number, number]): number =>
  lo + rng.next() * (hi - lo);

/** `level` with its BIKE PARK laid over it (R44, R45), or `level` itself
 * where it has no ski area or no lift carries bikes. */
export function setBikePark(level: Level): Level {
  if (level.bikePark) return level;
  const had = laid.get(level);
  if (had) return had;
  const park = planPark(level);
  const out = park ? withBikeSurface(level, park) : level;
  laid.set(level, out);
  return out;
}

/** A lift's plan and its vertical, m. */
type Carrier = { plan: LiftPlan; vertical: number };

/** THE LIFTS THAT CARRY BIKES (R44), the lowest first. */
export function bikeLifts(level: Level): LiftPlan[] {
  return carriers(level).map((c) => c.plan);
}

function carriers(level: Level): Carrier[] {
  const all = liftPlans(level)
    .filter((p) => p.lift.kind !== "drag")
    .map((plan) => ({ plan, vertical: plan.lift.top.y - plan.lift.bottom.y }))
    .filter((c) => c.vertical >= B.park.vertical.least)
    .sort((a, b) => a.vertical - b.vertical || a.plan.lift.id.localeCompare(b.plan.lift.id));
  const within = all.filter((c) => c.vertical <= B.park.vertical.most).slice(0, B.park.lifts);
  return within.length > 0 ? within : all.slice(0, 1);
}

/** A trail to be laid: its grade, its lift, its head and its end. */
type Slot = {
  id: string;
  grade: TrailGrade;
  race: boolean;
  plan: LiftPlan;
  /** The head's angle off the line down from the top, rad (+ right). */
  angle: number;
  /** Its place on the end's ring, rad off up the line. */
  ring: number;
  /** Its corridor's axis off the line from its head to its end, m (+ the
   * right looking down). */
  offset: number;
};

function planPark(level: Level): BikePark | null {
  if (!level.resort) return null;
  const lifts = carriers(level);
  if (lifts.length === 0) return null;
  const rng = createRng((level.seed ^ B.park.salt ^ 0x5bd1e995) >>> 0);
  const keep = parkKeep(level);
  const slots = dealSlots(lifts);
  const trails: BikeTrail[] = [];
  // THE RACE LINE first, so it has the pick of the face (R45).
  let raceId: string | null = null;
  for (const race of raceSlots(level)) {
    const t = layTrail(level, race, keep, rng, trails);
    if (t) {
      trails.push(t);
      raceId = t.id;
      break;
    }
  }
  for (const slot of slots) {
    if (trails.length >= B.park.most + (raceId ? 1 : 0)) break;
    const t = layTrail(level, slot, keep, rng, trails);
    if (t) trails.push(t);
  }
  if (trails.length === 0) return null;
  levelCrossings(trails);
  return {
    base: level,
    trails,
    aprons: apronsOf(level, lifts, trails),
    junctions: junctionsOf(trails),
    race: raceId,
  };
}

/** THE SLOTS (R44): `park.deal`'s grades off each lift, the easiest
 * nearest the lift's line, alternating sides. */
function dealSlots(lifts: readonly Carrier[]): Slot[] {
  const out: Slot[] = [];
  let n = 0;
  lifts.forEach((carrier, k) => {
    const c0 = carrier.plan;
    const row = lifts.length === 1 ? B.park.one : B.park.deal[Math.min(k, B.park.deal.length - 1)];
    const ranks = { 1: 0, [-1]: 0 } as Record<number, number>;
    // Each side's corridors stand side by side out from the lift's line.
    const across = { 1: 0, [-1]: 0 } as Record<number, number>;
    row.forEach((grade, i) => {
      const side = i % 2 === 0 ? 1 : -1;
      const rank = ranks[side]++;
      const c = B.grades[grade].corridor;
      const half = (B.walk.spread * (c[0] + c[1])) / 2;
      const offset = across[side] + half;
      across[side] = offset + half;
      // The end on the ring on the trail's own side of the line.
      const ring = -side * (0.35 + (B.finish.spread - 0.35) * Math.min(1, rank / 2));
      out.push({
        id: `B${++n}`,
        grade,
        race: false,
        plan: c0,
        angle: side * (25 + 18 * rank) * RAD,
        ring,
        offset: side * offset,
      });
    });
  });
  return out;
}

/** THE RACE LINE's slots (R45): every lift offering `race.vertical.least`,
 * the most vertical first — the first one laid is kept. */
function raceSlots(level: Level): Slot[] {
  return liftPlans(level)
    .filter(
      (p) => p.lift.kind !== "drag" && p.lift.top.y - p.lift.bottom.y >= B.race.vertical.least,
    )
    .sort(
      (a, b) =>
        b.lift.top.y - b.lift.bottom.y - (a.lift.top.y - a.lift.bottom.y) ||
        a.lift.id.localeCompare(b.lift.id),
    )
    .map((plan) => ({
      id: "DH",
      grade: "black",
      race: true,
      plan,
      angle: -70 * RAD,
      ring: 0.2,
      offset: 0,
    }));
}

/** One slot laid: the best of its tries, kept in `keep`, or null — a try
 * that crosses one of the `laid` trails far above or below it scored down
 * by `CROSS_COST` a metre it misses by (`crossingMiss`). */
function layTrail(
  level: Level,
  slot: Slot,
  keep: ParkKeep,
  rng: Rng,
  laid: readonly BikeTrail[],
): BikeTrail | null {
  const rule: TrailRule = B.grades[slot.grade];
  const lift = slot.plan.lift;
  const P = slot.plan;
  // Down the line from the top, and its right.
  const ddx = -P.dx;
  const ddz = -P.dz;
  // Turned `angle` clockwise from the way down the line: (sin, cos) rotation.
  const headAt = (angle: number) => {
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    const hx = ddx * ca + ddz * sa;
    const hz = ddz * ca - ddx * sa;
    return {
      x: lift.top.x + hx * B.park.apron,
      z: lift.top.z + hz * B.park.apron,
      heading: Math.atan2(hx, hz),
    };
  };
  let head = headAt(slot.angle);
  let moved = 0;
  // The end: on the ring up the line from the bottom station, beside it.
  const cr = Math.cos(slot.ring);
  const sr = Math.sin(slot.ring);
  const ex = P.dx * cr + P.dz * sr;
  const ez = P.dz * cr - P.dx * sr;
  const end = {
    x: lift.bottom.x + ex * B.finish.ring,
    z: lift.bottom.z + ez * B.finish.ring,
    y: 0,
  };
  end.y = level.groundAt(end.x, end.z);
  const race = slot.race;
  const target = race ? B.race.target : rule.target;
  const steepest = race ? B.race.steepest : rule.steepest;
  let best: { trail: BikeTrail; score: number } | null = null;
  for (let k = 0; k < B.park.tries; k++) {
    const corridor = dealt(rng, race ? B.race.corridor : rule.corridor);
    const ws: WalkSlot = {
      head,
      end,
      target,
      half: race ? 1 : rule.half,
      leg: race ? B.race.leg : rule.leg,
      radius: race ? B.race.radius : rule.radius,
      corridor,
      offset: slot.offset,
      side: rng.chance(0.5) ? 1 : -1,
      wander:
        slot.grade === "green" || slot.grade === "blue" ? B.walk.wander.flow : B.walk.wander.tech,
      steer: B.walk.steer,
      home: Math.min(B.finish.grade, steepest),
      turnHill: Math.tan(B.walk.steep * RAD),
    };
    const walk = walkTrail(level, ws, keep, rng);
    if (!walk || walk.length < 60) {
      trace?.(`${slot.id} ${slot.grade} ${lift.id} try ${k}: no walk (${walkFailure})`);
      // A head that walks straight into something is moved round the rim.
      if (walkFailure.startsWith("lead")) {
        moved++;
        head = headAt(
          slot.angle + (moved % 2 === 1 ? 1 : -1) * Math.ceil(moved / 2) * B.park.nudge * RAD,
        );
      }
      continue;
    }
    const width = dealt(rng, race ? B.race.width : rule.width);
    const points = benchOf(level, walk, width, steepest);
    const turns = turnsOf(walk, points);
    const features = layFeatures(slot.id, points, turns, rule, rng, {
      race,
      trees: (x, z) => keep.woods(x, z),
    });
    widenBerms(points, features);
    const trail: BikeTrail = {
      id: slot.id,
      grade: slot.grade,
      kind: race ? "race" : "trail",
      tread: race || slot.grade === "red" || slot.grade === "black" ? "dirt" : "gravel",
      lift: lift.id,
      points,
      length: points[points.length - 1].s,
      vertical: points[0].y - points[points.length - 1].y,
      features,
      end: lift.id,
      start: race ? raceStart(points) : 0,
    };
    const verdict = judgeTrail(trail);
    if (!verdict.ok) {
      trace?.(
        `${slot.id} ${slot.grade} ${lift.id} try ${k}: ${verdict.why.join(",")} mean ${verdict.mean.toFixed(3)} steep ${verdict.steepest.toFixed(2)} cut ${verdict.cut.toFixed(1)} len ${trail.length.toFixed(0)}`,
        trail,
      );
      continue;
    }
    let woods = 0;
    for (const p of points) if (keep.woods(p.x, p.z)) woods++;
    const share = woods / points.length;
    const score =
      share * (slot.grade === "red" || slot.grade === "black" ? 3 : 1) -
      verdict.cut * 0.4 -
      Math.abs(verdict.mean - target) * 8 -
      crossingMiss(trail, laid) * CROSS_COST;
    if (!best || score > best.score) best = { trail, score };
  }
  if (!best) return null;
  keep.add(best.trail.points);
  return best.trail;
}

/** The race line's start (R45): the point `race.vertical.most` m above its
 * finish, or its head where it is lower. */
function raceStart(points: readonly BikeTrailPoint[]): number {
  const fin = points[points.length - 1].y;
  for (const p of points) if (p.y - fin <= B.race.vertical.most) return p.s;
  return 0;
}

/** The tread through each berm, `berm.widen` times as wide, eased in and
 * out over its first and last metres. */
function widenBerms(points: BikeTrailPoint[], features: readonly BikeFeature[]): void {
  for (const f of features) {
    if (f.kind !== "berm") continue;
    for (
      let i = Math.max(0, Math.floor(f.from - 3));
      i <= Math.min(points.length - 1, Math.ceil(f.to + 3));
      i++
    ) {
      const s = points[i].s;
      const w = Math.min(1, Math.max(0, Math.min(s - (f.from - 3), f.to + 3 - s) / 3));
      points[i].width = Math.max(points[i].width, points[i].width * (1 + (B.berm.widen - 1) * w));
    }
  }
}

/** A trail's measures against its grade's band (R44, R45): its mean grade,
 * its steepest pitch, its rise, its cut or fill — and whether it holds. */
export type TrailVerdict = {
  ok: boolean;
  mean: number;
  steepest: number;
  climb: number;
  cut: number;
  /** What failed, by its rule's name. */
  why: string[];
};

/** THE TRAIL JUDGED against its rule (R44 or R45): what `setBikePark`
 * keeps a line by, and what the analyzer re-reads off a finished park. */
export function judgeTrail(trail: BikeTrail): TrailVerdict {
  const pts = trail.points;
  const race = trail.kind === "race";
  const rule = B.grades[trail.grade];
  const start = race ? trail.start : 0;
  const i0 = pts.findIndex((p) => p.s >= start);
  const a = pts[Math.max(0, i0)];
  const z = pts[pts.length - 1];
  const length = z.s - a.s;
  const mean = (a.y - z.y) / Math.max(1, length);
  let steepest = 0;
  let climb = 0;
  let cut = 0;
  let j = 0;
  let k = 0;
  for (let i = 0; i < pts.length; i++) {
    while (j < pts.length - 1 && pts[j].s - pts[i].s < B.pitch) j++;
    if (pts[j].s - pts[i].s >= B.pitch * 0.9)
      steepest = Math.max(steepest, (pts[i].y - pts[j].y) / (pts[j].s - pts[i].s));
    while (k < pts.length - 1 && pts[k].s - pts[i].s < B.climb.window) k++;
    for (let m = i + 1; m <= k; m++) climb = Math.max(climb, pts[m].y - pts[i].y);
    cut = Math.max(cut, Math.abs(pts[i].y - pts[i].ground));
  }
  const why: string[] = [];
  const band = race ? B.race.mean : rule.mean;
  if (mean < band[0] - 1e-6 || mean > band[1] + 1e-6) why.push("mean");
  if (steepest > (race ? B.race.steepest : rule.steepest) + 1e-3) why.push("steepest");
  if (climb > B.climb.most + 1e-6) why.push("climb");
  if (cut > B.bench.most) why.push("cut");
  if (race) {
    const v = a.y - z.y;
    if (length < B.race.length[0] || length > B.race.length[1]) why.push("length");
    if (v < B.race.vertical.least - 1e-6 || v > B.race.vertical.most + 1e-6) why.push("vertical");
  }
  return { ok: why.length === 0, mean, steepest, climb, cut, why };
}

/** THE APRONS (R44): each carrying lift's top and the heads off it. */
function apronsOf(
  level: Level,
  lifts: readonly Carrier[],
  trails: readonly BikeTrail[],
): BikeApron[] {
  const ids = new Set(trails.map((t) => t.lift));
  const out: BikeApron[] = [];
  const plans = [...lifts.map((c) => c.plan)];
  for (const plan of liftPlans(level))
    if (ids.has(plan.lift.id) && !plans.includes(plan)) plans.push(plan);
  for (const plan of plans) {
    const l = plan.lift;
    if (!ids.has(l.id)) continue;
    const heads: BikeTrailHead[] = [];
    for (const t of trails) {
      if (t.lift !== l.id) continue;
      const p = t.points[0];
      // The sign stands on the head's left as it leaves, a metre off the tread.
      const off = p.width / 2 + 1.2;
      heads.push({
        trail: t.id,
        grade: t.grade,
        x: p.x,
        z: p.z,
        y: p.y,
        heading: p.heading,
        sign: { x: p.x - Math.cos(p.heading) * off, z: p.z + Math.sin(p.heading) * off },
      });
    }
    out.push({
      lift: l.id,
      x: l.top.x,
      z: l.top.z,
      y: level.groundAt(l.top.x, l.top.z),
      radius: B.park.apron,
      heads,
    });
  }
  return out;
}

/** WHERE TRAILS MEET: every place two trails' treads touch, the first of
 * each run of them. */
function junctionsOf(trails: readonly BikeTrail[]): BikeJunction[] {
  const out: BikeJunction[] = [];
  for (let i = 0; i < trails.length; i++) {
    for (let j = i + 1; j < trails.length; j++) {
      const A = trails[i];
      const C = trails[j];
      let last = -Infinity;
      for (let p = 0; p < A.points.length; p += 2) {
        const a = A.points[p];
        if (a.s - last < 30) continue;
        for (let q = 0; q < C.points.length; q += 2) {
          const c = C.points[q];
          if (hypot(a.x - c.x, a.z - c.z) < (a.width + c.width) / 2) {
            out.push({
              x: (a.x + c.x) / 2,
              z: (a.z + c.z) / 2,
              a: { trail: A.id, s: a.s },
              b: { trail: C.id, s: c.s },
            });
            last = a.s;
            break;
          }
        }
      }
    }
  }
  return out;
}

/** Where the fall line runs at the top of `plan`'s lift: for the lab. */
export function topFall(level: Level, plan: LiftPlan): number {
  return fallAt(level, plan.lift.top.x, plan.lift.top.z).heading;
}
