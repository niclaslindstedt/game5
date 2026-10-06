// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R35 — A SKI-CROSS COURSE BUILT OVER A MAP. A ski cross is not raced on a
// piste as it lies: it is BUILT, by snowcats and shovels, out of a gentle
// stretch of one — a fenced lane some fourteen metres wide weaving down it,
// its turns banked into BERMS, its straights carrying ROLLERS, JUMPS and
// STEP-DOWNS, a start gate of four doors over a steep start ramp at its top
// and a finish area at its foot. Four racers ski it at once.
//
// THE STRETCH is the piste's gentlest long enough for a course: the one
// whose course comes nearest the rule's mean gradient, with no drop across
// it where one can be found, and then the lowest — a course finishes on the
// valley floor beside the village.
//
// THE LINE is a course of its own, not the piste: a start straight down the
// piste's line, then legs swung either side of it in turn, each corner
// rounded into a turn of a radius dealt off the map's seed, and a finish
// straight back onto it. The line is the map's `track` from then on, so
// everything that asks the piste (the physics' queries, the course's gates,
// the bot, the minimap, the renderer) asks the course with no change — the
// way a speed-skiing track is set (R34).
//
// THE PROFILE is the ground under the course combed along it, never rising,
// its crests and knees rounded; the features are built on top of it, and the
// ground is graded to it across the course — the outside of every berm
// banked up into a wall. Everything is a pure function of the map, the set
// dealt off the map's seed on a stream of its own — so no digest moves and a
// restart stands on the very course it left.

import { angleDiff, clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import {
  sampleField,
  sampleFieldGradient,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { DISCIPLINE_RULES } from "./discipline-rules.ts";
import { kickerProfile } from "./kickers.ts";
import { LEVEL_RULES } from "./rules.ts";
import { nearestTrackPoint, nearestWithin, trackPointAt } from "./query.ts";
import { hullOf } from "./speed-ski.ts";
import type {
  Checkpoint,
  CrossFeature,
  Kicker,
  Level,
  SkiCrossCourse,
  Spawn,
  TrackHit,
  TrackPoint,
  Vec3,
} from "./types.ts";

const K = DISCIPLINE_RULES.skiCross;

/** What the course's set is dealt off beside the map's seed. */
const SKI_CROSS_SALT = 0x5c1c05;

/** The course's stations apart, m. */
const STEP = 2;

/** About how much longer a course weaving down a stretch is than the
 * stretch — what the stretch is chosen by before the course is laid. */
const STRETCH = 1.12;

/** A plan point and the way down the course there. */
type Pose = { x: number; z: number; heading: number };

/** A piece of the course's line: straight, or a turn of `r` m round a
 * centre, `sign` +1 to the right. */
type Piece =
  | { kind: "line"; x: number; z: number; heading: number; length: number }
  | {
      kind: "arc";
      cx: number;
      cz: number;
      r: number;
      heading: number;
      sign: number;
      length: number;
    };

/** A turn of the line: its arcs, which way it turns and how far, degrees. */
type Turn = { from: number; to: number; sign: -1 | 1; angle: number };

const rightX = (h: number): number => Math.cos(h);
const rightZ = (h: number): number => -Math.sin(h);

/** R35 — THE STRETCH OF THE PISTE a ski cross is built on: of every stretch
 * `skiCross.axis` long, the one whose course comes nearest the aimed mean
 * gradient (inside the rule's bands where one does), crossing the fewest
 * drops, and then the lowest. */
function pickStretch(level: Level): { from: number; to: number } {
  const L = level.track.length;
  const A = K.axis;
  const drops = (level.cliffs ?? []).filter((c) => c.onTrack && c.s !== undefined);
  let best: { from: number; to: number; score: number } | null = null;
  for (let len = A.min; len <= Math.min(A.max, L); len += 50) {
    for (let to = L; to - len >= 0; to -= A.step) {
      const from = to - len;
      const drop = trackPointAt(level, from).y - trackPointAt(level, to).y;
      const course = len * STRETCH;
      const grade = drop / course;
      let score = Math.abs(grade - K.grade.aim);
      if (grade < K.grade.min || grade > K.grade.max) score += 1;
      if (drop < K.vertical.min || drop > K.vertical.max) score += 1;
      if (course < K.length.min || course > K.length.max) score += 1;
      for (const d of drops) if ((d.s ?? 0) > from && (d.s ?? 0) < to) score += K.drop;
      // ...and then the lowest: the finish on the valley floor.
      score += (L - to) * 1e-5;
      if (!best || score < best.score) best = { from, to, score };
    }
  }
  return best ?? { from: 0, to: L };
}

/** THE LINE'S CORNERS down the stretch: the start, the end of the start
 * straight, the legs swung either side of the piste's line in turn — dealt
 * off `rng` — the start of the finish straight and the end. */
function corners(level: Level, rng: Rng, from: number, to: number): Pose[] {
  const at = (s: number, off: number): Pose => {
    const p = trackPointAt(level, s);
    return {
      x: p.x + rightX(p.heading) * off,
      z: p.z + rightZ(p.heading) * off,
      heading: p.heading,
    };
  };
  const out: Pose[] = [at(from, 0)];
  const first = from + K.start.straight;
  out.push(at(first, 0));
  // The finish straight: the finish area and a finish jump's room above it.
  const last = to - (K.finish.area + K.finish.straight);
  let side = rng.chance(0.5) ? 1 : -1;
  let s = first;
  while (true) {
    const leg = rng.range(K.leg.min, K.leg.max);
    if (s + leg > last - K.leg.min * 0.5) break;
    s += leg;
    out.push(at(s, side * rng.range(K.swing.min, K.swing.max)));
    side = -side;
  }
  out.push(at(last, 0));
  out.push(at(to, 0));
  return out;
}

/** THE LINE through `corners`, every corner rounded to a radius dealt off
 * `rng` — tighter only where the legs either side leave no room for it. */
function lay(rng: Rng, pts: Pose[]): { pieces: Piece[]; turns: Turn[]; length: number } {
  const n = pts.length;
  const heads: number[] = [];
  const lens: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    heads.push(Math.atan2(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z));
    lens.push(hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z));
  }
  // Each corner's turn, its radius and the tangent it takes off each leg.
  const cut: number[] = Array.from({ length: n }, () => 0);
  const radius: number[] = Array.from({ length: n }, () => 0);
  const turn: number[] = Array.from({ length: n }, () => 0);
  for (let i = 1; i < n - 1; i++) {
    const th = angleDiff(heads[i - 1], heads[i]);
    turn[i] = th;
    const half = Math.tan(Math.abs(th) / 2);
    if (half < 1e-4) continue;
    let r = rng.range(K.turn.radius.min, K.turn.radius.max);
    const room = 0.45 * Math.min(lens[i - 1], lens[i]);
    if (r * half > room) r = Math.max(K.turn.tightest, room / half);
    radius[i] = r;
    cut[i] = r * half;
  }
  const pieces: Piece[] = [];
  const turns: Turn[] = [];
  let s = 0;
  for (let i = 0; i < n - 1; i++) {
    const h = heads[i];
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const a = cut[i];
    const len = Math.max(0, lens[i] - a - cut[i + 1]);
    pieces.push({
      kind: "line",
      x: pts[i].x + fx * a,
      z: pts[i].z + fz * a,
      heading: h,
      length: len,
    });
    s += len;
    const j = i + 1;
    if (j < n - 1 && radius[j] > 0) {
      const sign = turn[j] >= 0 ? 1 : -1;
      const tx = pts[j].x - fx * cut[j];
      const tz = pts[j].z - fz * cut[j];
      const r = radius[j];
      const length = r * Math.abs(turn[j]);
      pieces.push({
        kind: "arc",
        cx: tx + rightX(h) * r * sign,
        cz: tz + rightZ(h) * r * sign,
        r,
        heading: h,
        sign,
        length,
      });
      turns.push({
        from: s,
        to: s + length,
        sign: sign as -1 | 1,
        angle: (Math.abs(turn[j]) * 180) / Math.PI,
      });
      s += length;
    }
  }
  return { pieces, turns, length: s };
}

/** Where the line is `s` m down it. */
function poseAt(pieces: readonly Piece[], s: number, out: Pose): Pose {
  let u = Math.max(0, s);
  for (let i = 0; i < pieces.length; i++) {
    const p = pieces[i];
    if (u > p.length && i < pieces.length - 1) {
      u -= p.length;
      continue;
    }
    if (p.kind === "line") {
      out.x = p.x + Math.sin(p.heading) * u;
      out.z = p.z + Math.cos(p.heading) * u;
      out.heading = p.heading;
    } else {
      const h = p.heading + (p.sign * u) / p.r;
      out.x = p.cx - rightX(h) * p.r * p.sign;
      out.z = p.cz - rightZ(h) * p.r * p.sign;
      out.heading = h;
    }
    return out;
  }
  return out;
}

/** THE PROFILE down the line, a sample every `STEP` m: the ground across
 * the course's width taken to its mean along it, never rising, its crests
 * and knees rounded. */
function baseProfile(level: Level, pieces: readonly Piece[], length: number): Float64Array {
  const n = Math.floor(length / STEP) + 1;
  const raw = new Float64Array(n);
  const half = K.width / 2;
  const pose: Pose = { x: 0, z: 0, heading: 0 };
  for (let i = 0; i < n; i++) {
    poseAt(pieces, i * STEP, pose);
    let sum = 0;
    for (let k = -2; k <= 2; k++) {
      const off = (k * half) / 2;
      sum += level.groundAt(
        pose.x + rightX(pose.heading) * off,
        pose.z + rightZ(pose.heading) * off,
      );
    }
    raw[i] = sum / 5;
  }
  const w = Math.max(1, Math.round(K.smooth / STEP));
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - w); j <= Math.min(n - 1, i + w); j++) {
      s += raw[j];
      c += 1;
    }
    y[i] = s / c;
  }
  for (let i = 1; i < n; i++) y[i] = Math.min(y[i], y[i - 1]);
  hullOf(y, STEP, 1 / K.crest, true);
  hullOf(y, STEP, 1 / K.knee, false);
  for (let i = 1; i < n; i++) y[i] = Math.min(y[i], y[i - 1]);
  return y;
}

/** THE START: the platform level under the doors, and the START RAMP cut
 * below them to the rule's grade, eased back onto the line. In place. */
function cutStart(y: Float64Array): void {
  const P = K.start.platform;
  const R = K.start.ramp;
  const at = (s: number): number => y[Math.min(y.length - 1, Math.round(s / STEP))];
  const level = at(P);
  const natural = (at(P) - at(P + R.length)) / R.length;
  // A smoothstep's steepest is 1.5 times its mean.
  const deep = Math.min(R.most, (Math.max(0, R.grade - natural) * R.length) / 1.5);
  const knee = P + R.length;
  for (let i = 0; i < y.length; i++) {
    const s = i * STEP;
    if (s <= P) y[i] = level;
    else if (s < knee) y[i] -= deep * smoothstep(P, knee, s);
    else y[i] -= deep * (1 - smoothstep(knee, knee + R.ease, s));
  }
}

/** A feature built on a straight: its arcs, its offset over the line at
 * `s`, and — a jump or a step-down — its kicker. */
type Built = {
  feature: CrossFeature;
  offset: (s: number) => number;
  kicker?: {
    lip: number;
    height: number;
    ramp: number;
    landing: number;
    deck: number;
    fall: number;
    dig: number;
  };
};

/** A feature dealt for a straight: how long it is, and where it is built
 * once that is known. */
type Plan = { length: number; place: (from: number, grade: number) => Built };

/** A series of ROLLERS. */
function rollers(rng: Rng, room: number): Plan | null {
  const R = K.rollers;
  const spacing = rng.range(R.spacing.min, R.spacing.max);
  const count = Math.min(rng.int(R.count.min, R.count.max), Math.floor(room / spacing));
  if (count < R.count.min) return null;
  const h = rng.range(R.height.min, R.height.max);
  const length = count * spacing;
  return {
    length,
    place: (from) => {
      const to = from + length;
      return {
        feature: { kind: "rollers", from, to, height: h },
        offset: (s) =>
          s <= from || s >= to ? 0 : (h * (1 - Math.cos((2 * Math.PI * (s - from)) / spacing))) / 2,
      };
    },
  };
}

/** A JUMP: up its ramp to the lip, across its table and down its landing —
 * a small one, the start straight's. The table is LEVEL, the line falling
 * away under it at `grade`, so its landing drops the lip's height, the
 * table's fall and its dig to the line again: a racer flies off the lip
 * onto the table at a crawl and onto the landing slope at race pace. */
function jump(rng: Rng, room: number, small = false): Plan | null {
  const J = K.jump;
  const ramp = rng.range(J.ramp.min, J.ramp.max);
  const deck = small ? J.deck.min : rng.range(J.deck.min, J.deck.max);
  const fall = rng.range(J.fall.min, J.fall.max);
  const height = small ? J.height.min : rng.range(J.height.min, J.height.max);
  const landing = deck + fall + J.out;
  if (ramp + landing > room) return null;
  return {
    length: ramp + landing,
    place: (from, grade) => {
      const lip = from + ramp;
      const top = height + grade * deck;
      return {
        feature: { kind: "jump", from, to: lip + landing, lip, height },
        offset: (s) => {
          const u = s - lip;
          if (u <= -ramp || u >= landing) return 0;
          if (u <= 0) return height * (1 + u / ramp) ** 2;
          if (u <= deck) return height + grade * u;
          const v = u - deck;
          if (v < fall) return top - (top + J.dig) * smoothstep(0, 1, v / fall);
          return -J.dig * (1 - smoothstep(0, 1, (v - fall) / J.out));
        },
        kicker: { lip, height, ramp, landing, deck, fall, dig: J.dig },
      };
    },
  };
}

/** A STEP-DOWN: the line raised over a long approach to a short lip, and a
 * landing back down onto it. */
function stepDown(rng: Rng, room: number): Plan | null {
  const S = K.step;
  const drop = rng.range(S.drop.min, S.drop.max);
  const fall = rng.range(S.fall.min, S.fall.max);
  const landing = S.deck + fall + 2;
  if (S.approach + landing > room) return null;
  const shape = { deck: S.deck, fall, dig: 0 };
  return {
    length: S.approach + landing,
    place: (from) => {
      const lip = from + S.approach;
      return {
        feature: { kind: "step", from, to: lip + landing, lip, height: drop },
        offset: (s) => kickerProfile(drop, S.approach, landing, s - lip, shape),
        kicker: { lip, height: drop, ramp: S.approach, landing, deck: S.deck, fall, dig: 0 },
      };
    },
  };
}

/** THE FEATURES on the course's straights: a jump on the start straight,
 * as many features a straight between the turns as fit — dealt by the
 * rule's weights, `skiCross.between` apart — and a finish jump on the
 * last, each straight's set centred on it. */
function layFeatures(
  rng: Rng,
  turns: readonly Turn[],
  rampEnd: number,
  finish: number,
  gradeOver: (from: number, to: number) => number,
): Built[] {
  const out: Built[] = [];
  const straights: { from: number; to: number; kind: "start" | "leg" | "finish" }[] = [];
  let s = rampEnd;
  turns.forEach((t, i) => {
    straights.push({ from: s, to: t.from - K.clear, kind: i === 0 ? "start" : "leg" });
    s = t.to + K.exit;
  });
  straights.push({ from: s, to: finish - 25, kind: "finish" });
  const W = K.weights;
  for (const st of straights) {
    const room = st.to - st.from;
    const plans: Plan[] = [];
    let used = 0;
    if (st.kind === "finish" || (st.kind === "start" && K.start.jump)) {
      const plan = jump(rng, room, st.kind === "start");
      if (plan) {
        plans.push(plan);
        used = plan.length;
      }
    } else {
      while (true) {
        const left = room - used - (plans.length > 0 ? K.between : 0);
        if (left < 20) break;
        const pick = rng.next();
        const order =
          pick < W.rollers
            ? [rollers, jump, stepDown]
            : pick < W.rollers + W.jump
              ? [jump, rollers, stepDown]
              : [stepDown, jump, rollers];
        let plan: Plan | null = null;
        for (const deal of order) {
          plan = deal(rng, left);
          if (plan) break;
        }
        if (!plan) break;
        used += plan.length + (plans.length > 0 ? K.between : 0);
        plans.push(plan);
      }
    }
    let at = st.from + (room - used) / 2;
    for (const plan of plans) {
      out.push(plan.place(at, gradeOver(at, at + plan.length)));
      at += plan.length + K.between;
    }
  }
  return out;
}

/** The bank angle of the berm at arc `s`, rad, and the side of its inside —
 * none off every berm. */
function bankAt(berms: readonly Turn[], s: number): { tan: number; side: number } {
  for (const t of berms) {
    if (s < t.from - K.turn.ease || s > t.to + K.turn.ease) continue;
    const w =
      s < t.from
        ? smoothstep(t.from - K.turn.ease, t.from, s)
        : s > t.to
          ? 1 - smoothstep(t.to, t.to + K.turn.ease, s)
          : 1;
    // The bank grows with how far the berm turns: a long sweeping corner is
    // banked less than a hairpin.
    const deg = K.turn.bank * clamp(t.angle / 60, 0.5, 1);
    return { tan: Math.tan((deg * Math.PI) / 180) * w, side: t.sign };
  }
  return { tan: 0, side: 0 };
}

/** A line across the course at arc `s`, `width` m wide. */
function across(level: Level, s: number, width: number, colour: "red" | "blue"): Checkpoint {
  const p = trackPointAt(level, s);
  return { x: p.x, z: p.z, y: p.y, heading: p.heading, width, s, colour };
}

/** R35 — THE COURSE A SKI CROSS IS BUILT ON, of the ski area's (R28): one
 * long enough for the rule's stretch (`skiCross.course.length`) with a
 * stretch's vertical under it, whose mean gradient comes nearest
 * `skiCross.course.grade` — a stretch of it gentler still is what the course
 * is built on — or null on a map that is not a ski area. */
export function skiCrossCourseOf(level: Level): string | null {
  const C = K.course;
  let best: { id: string; score: number } | null = null;
  for (const c of level.resort?.courses ?? []) {
    const score =
      Math.abs(c.drop / Math.max(1, c.length) - C.grade) +
      (c.length < C.length ? 1 : 0) +
      (c.drop < K.vertical.min * 1.5 ? 1 : 0);
    if (!best || score < best.score || (score === best.score && c.id < best.id)) {
      best = { id: c.id, score };
    }
  }
  return best?.id ?? null;
}

const set = new WeakMap<Level, Level>();

/** R35 — A SKI-CROSS COURSE BUILT OVER `level`, as a map whose `track` is
 * the course, whose checkpoints are its start gate, its flags and its
 * finish line, and whose grid is the start gate's lanes in the order the
 * best seed would choose them. A map already carrying one is that map; one
 * carrying any other course is built over the map under it. Kept per map,
 * so a restart or a replay stands on the course the renderer already built;
 * the course keeps the day and the sky of the map it was built over. */
export function setSkiCross(level: Level): Level {
  if (level.skiCross) return level;
  const original =
    level.slalom?.base ??
    level.downhill?.base ??
    level.superG?.base ??
    level.giantSlalom?.base ??
    level.speedSki?.base ??
    level.bigAir?.base ??
    level.knuckleHuck?.base ??
    level.slopestyle?.base ??
    level.railJam?.base ??
    level.halfpipe?.base ??
    level.moguls?.base ??
    level;
  let course = set.get(original);
  if (!course) {
    course = courseOver(original);
    set.set(original, course);
  }
  return course.sun === level.sun && course.weather === level.weather
    ? course
    : { ...course, sun: level.sun, weather: level.weather };
}

/** The ski cross built over `original`, a map with no course on it. */
function courseOver(original: Level): Level {
  const rng = createRng((original.seed ^ SKI_CROSS_SALT) >>> 0);
  const axis = pickStretch(original);
  const { pieces, turns, length } = lay(rng, corners(original, rng, axis.from, axis.to));
  const y = baseProfile(original, pieces, length);
  cutStart(y);
  const finishS = length - K.finish.area;
  const rampEnd = K.start.platform + K.start.ramp.length;
  const yAt = (s: number): number => y[clamp(Math.round(s / STEP), 0, y.length - 1)];
  const built = layFeatures(rng, turns, rampEnd, finishS, (a, b) =>
    Math.max(0, (yAt(a) - yAt(b)) / Math.max(1, b - a)),
  );
  const n = y.length;
  for (const b of built) {
    for (let i = 0; i < n; i++) {
      const s = i * STEP;
      if (s > b.feature.from - 1 && s < b.feature.to + 1) y[i] += b.offset(s);
    }
  }
  const berms = turns.filter((t) => t.angle >= K.turn.least);
  // THE STATIONS, every `STEP` m down the line.
  const points: TrackPoint[] = [];
  const pose: Pose = { x: 0, z: 0, heading: 0 };
  for (let i = 0; i < n; i++) {
    const s = i * STEP;
    poseAt(pieces, s, pose);
    const width =
      s < rampEnd + 10
        ? K.start.width + (K.width - K.start.width) * smoothstep(rampEnd, rampEnd + 10, s)
        : K.width;
    points.push({ x: pose.x, z: pose.z, y: y[i], s, heading: pose.heading, width });
  }
  const trackLength = points[n - 1].s;
  const track = { points, length: trackLength, closed: false as const };
  const heightAt = (s: number): number => {
    const f = clamp(s / STEP, 0, n - 1);
    const i = Math.min(n - 2, Math.floor(f));
    return y[i] + (y[i + 1] - y[i]) * (f - i);
  };
  // THE GROUND graded to the course across its width, every berm's outside
  // banked up into its wall, eased out beyond; the snow groomed.
  const half = K.width / 2;
  const reach = half + K.turn.wall + K.ease + 2;
  const field = original.ground;
  const ground: Heightfield = { ...field, data: new Float32Array(field.data) };
  const packedField = original.packed;
  const packed = packedField ? { ...packedField, data: new Float32Array(packedField.data) } : null;
  const fade = LEVEL_RULES.track.shoulder.packed;
  const seen = new Uint8Array(field.data.length);
  const hit: TrackHit = { index: 0, s: 0, distance: 0, lateral: 0, x: 0, z: 0 };
  const BOX = 16;
  for (let s0 = 0; s0 < trackLength; s0 += BOX) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (let s = s0; s <= Math.min(trackLength, s0 + BOX); s += STEP) {
      poseAt(pieces, s, pose);
      x0 = Math.min(x0, pose.x - reach);
      x1 = Math.max(x1, pose.x + reach);
      z0 = Math.min(z0, pose.z - reach);
      z1 = Math.max(z1, pose.z + reach);
    }
    const c0 = clamp(Math.floor((x0 - field.originX) / field.cell), 0, field.cols - 1);
    const c1 = clamp(Math.ceil((x1 - field.originX) / field.cell), 0, field.cols - 1);
    const r0 = clamp(Math.floor((z0 - field.originZ) / field.cell), 0, field.rows - 1);
    const r1 = clamp(Math.ceil((z1 - field.originZ) / field.cell), 0, field.rows - 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const i = r * field.cols + c;
        if (seen[i] === 1) continue;
        seen[i] = 1;
        const x = field.originX + c * field.cell;
        const z = field.originZ + r * field.cell;
        nearestTrackPoint({ track }, x, z, hit);
        if (hit.distance > reach) continue;
        const bank = bankAt(berms, hit.s);
        // Outward of the berm, positive: away from its inside.
        const out = -hit.lateral * bank.side;
        const walled = bank.tan > 0 && out > 0;
        const edge = walled ? half + K.turn.wall : half;
        const w = 1 - smoothstep(edge, edge + K.ease, hit.distance);
        if (w > 0) {
          const lift = bank.tan * clamp(out, -0.4 * half, half + K.turn.wall);
          const target = heightAt(hit.s) + lift;
          ground.data[i] += w * (target - ground.data[i]);
        }
        if (packed) {
          const firm = 1 - smoothstep(half, half + fade, hit.distance);
          if (firm > packed.data[i]) packed.data[i] = firm;
        }
      }
    }
  }
  // THE FENCE, the spill zones and the finish area cleared of trees; the
  // piste's kickers and drops under the course taken out with the ground
  // they stood on, and the rest no longer on any course a racer skis.
  const end = points[n - 1];
  const fx = Math.sin(end.heading);
  const fz = Math.cos(end.heading);
  const finishAt = trackPointAt({ track }, finishS);
  const clearOf = (x: number, z: number, r: number): boolean => {
    if (nearestWithin({ track }, x, z, half + r).distance <= half + r) return true;
    const dx = x - finishAt.x;
    const dz = z - finishAt.z;
    const along = dx * fx + dz * fz;
    const side = dx * fz - dz * fx;
    return along > -K.finish.before && along < K.finish.area + 10 && Math.abs(side) < K.finish.half;
  };
  const trees = original.trees.filter((t) => !clearOf(t.x, t.z, K.clearTrees));
  const kickers: Kicker[] = (original.kickers ?? [])
    .filter((k) => !clearOf(k.x, k.z, K.ease + k.ramp))
    .map((k) => ({ ...k, onTrack: false, s: undefined }));
  const cliffs = (original.cliffs ?? [])
    .filter((k) => !clearOf(k.x, k.z, K.ease + k.width / 2))
    .map((k) => ({ ...k, onTrack: false, s: undefined }));
  // THE COURSE'S OWN JUMPS, on its line.
  built.forEach((b, i) => {
    const k = b.kicker;
    if (!k) return;
    const p = trackPointAt({ track }, k.lip);
    kickers.push({
      id: `J${i + 1}`,
      x: p.x,
      z: p.z,
      y: heightAt(k.lip),
      heading: p.heading,
      height: k.height,
      ramp: k.ramp,
      landing: k.landing,
      width: K.width,
      onTrack: true,
      s: k.lip,
      shape: { deck: k.deck, fall: k.fall, dig: k.dig },
    });
  });
  const scratch = new Float64Array(3);
  const base: Level = {
    ...original,
    ground,
    groundAt: (x, z) => sampleField(ground, x, z),
    normalAt: (x: number, z: number, nrm: Vec3) => {
      sampleFieldGradient(ground, x, z, scratch);
      const nx = -scratch[1];
      const nz = -scratch[2];
      const inv = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
      nrm.x = nx * inv;
      nrm.y = inv;
      nrm.z = nz * inv;
    },
    ...(packed ? { packed, packedAt: (x: number, z: number) => sampleField(packed, x, z) } : {}),
    track,
    trees,
    kickers,
    cliffs,
    drifts: [],
    slalom: undefined,
    downhill: undefined,
    superG: undefined,
    giantSlalom: undefined,
    speedSki: undefined,
  };
  // THE GATES: a turning gate on the inside of every berm, a corridor gate
  // before every feature, red and blue in turn down the course.
  const doors = K.start.platform;
  type Gate = Omit<Checkpoint, "colour">;
  const gates: Gate[] = [];
  for (const t of berms) {
    const at = across(base, (t.from + t.to) / 2, K.width, "red");
    gates.push({ ...at, pole: "open", turn: t.sign, flags: true });
  }
  for (const b of built) {
    const at = across(base, b.feature.from - K.gateBefore, K.width, "red");
    gates.push({ ...at, flags: true });
  }
  gates.sort((a, b) => a.s - b.s);
  const checkpoints: Checkpoint[] = [
    across(base, doors + 0.3, K.start.width, "red"),
    ...gates.map((g, i): Checkpoint => ({ ...g, colour: i % 2 === 0 ? "red" : "blue" })),
    across(base, finishS, Math.max(K.finish.width, K.width + 1), "red"),
  ];
  // THE START GATE'S LANES, in the order the best seed would choose them:
  // the inside of the first turn first.
  const stand = trackPointAt(base, doors - K.start.stand);
  const inside = berms[0]?.sign ?? 1;
  const lanes: Spawn[] = [];
  for (let k = 0; k < K.start.lanes; k++) {
    const off = (k - (K.start.lanes - 1) / 2) * K.start.lane;
    lanes.push({
      x: stand.x + rightX(stand.heading) * off,
      z: stand.z + rightZ(stand.heading) * off,
      heading: stand.heading,
    });
  }
  const laneOff = (l: Spawn): number =>
    (l.x - stand.x) * rightX(stand.heading) + (l.z - stand.z) * rightZ(stand.heading);
  lanes.sort((a, b) => laneOff(b) * inside - laneOff(a) * inside);
  const features: CrossFeature[] = [
    ...berms.map((t): CrossFeature => ({ kind: "berm", from: t.from, to: t.to, side: t.sign })),
    ...built.map((b) => b.feature),
  ].sort((a, b) => a.from - b.from);
  const skiCross: SkiCrossCourse = {
    base: original,
    from: doors,
    to: finishS,
    vertical: heightAt(doors) - heightAt(finishS),
    width: K.width,
    features,
    nets: { gap: K.fence.gap, height: K.fence.height, from: doors + 2, to: finishS },
    axis,
  };
  const spawn: Spawn = { x: stand.x, z: stand.z, heading: stand.heading };
  return { ...base, checkpoints, spawn, grid: lanes, skiCross };
}
