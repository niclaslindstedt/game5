// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A VENUE BUILT STRAIGHT DOWN THE FACE — what every freestyle venue cut on a
// line of its own shares (R37's big air jump, R38's knuckle, R39's
// slopestyle course): a PROFILE drawn against the horizontal with a pen,
// the LINE searched down the face where that profile cuts and fills least,
// and the ground GRADED to it, groomed, its woods cleared and the piste's
// kickers, drops and cliffs in it taken out.
//
// THE PEN. A profile is drawn every `dx` m of plan from the start
// platform's back: a stretch at a grade (`straight`), a bend from one grade
// to another on a radius (`bend`), a single step (`step`). The descent is
// down the fall line positive, so a kicker's take-off is a negative angle.
// A table must be level in absolute terms (the ski cross's lesson), which
// is why nothing here is laid relative to the ground under it.
//
// THE LANDING (`shapeLanding`): at every point past the knuckle the flight
// that reaches it is worked out back to the take-off speed it needs, and
// the slope there is laid just steeper than that flight by what a fall of
// `fall` metres meets the snow at — the equivalent fall height design of
// terrain-park jumps — until a skier `fast` times the design speed has come
// down on it, never steeper than `steepest`.
//
// Everything is a pure function of the map, drawing nothing from any stream
// — so no digest moves and a restart stands on the very venue it left.

import { clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  sampleFieldGradient,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { LEVEL_RULES } from "./rules.ts";
import type { JumpRule } from "./trick-rules.ts";
import type { Cliff, Kicker, Level, TrackPoint, Vec3 } from "./types.ts";

const G = 9.81;
const RAD = Math.PI / 180;

/** What any venue's rule says about where and how wide it is built. */
export type VenueRule = Pick<JumpRule, "width" | "ease" | "margin" | "search" | "fit" | "arena">;

/** A PROFILE: its height every `dx` m of plan from the platform's back,
 * where its finish line stands and where it ends, m of plan. */
export type VenueProfile = { dx: number; y: Float64Array; finish: number; end: number };

/** The profile's height `x` m of plan along it, m. */
export function jumpHeightAt(p: VenueProfile, x: number): number {
  const f = clamp(x / p.dx, 0, p.y.length - 1);
  const i = Math.min(p.y.length - 2, Math.floor(f));
  return p.y[i] + (p.y[i + 1] - p.y[i]) * (f - i);
}

/** THE PEN a profile is drawn with: where it has got to (`x` of plan, `y`
 * of height), the descent it is drawing (`a`, rad, down positive) and
 * every height so far. */
export type Pen = {
  readonly dx: number;
  x: number;
  y: number;
  a: number;
  ys: number[];
  /** One step at the descent `to`. */
  step(to: number): void;
  /** Bend toward `to` on `radius` m — down or up. */
  bend(to: number, radius: number): void;
  /** `length` m at the descent `at`. */
  straight(length: number, at: number): void;
};

export function createPen(dx = 0.25): Pen {
  const pen: Pen = {
    dx,
    x: 0,
    y: 0,
    a: 0,
    ys: [0],
    step(to: number): void {
      pen.x += dx;
      pen.y -= Math.tan(to) * dx;
      pen.a = to;
      pen.ys.push(pen.y);
    },
    bend(to: number, radius: number): void {
      const sign = Math.sign(to - pen.a);
      while (sign !== 0 && Math.sign(to - pen.a) === sign) {
        const turn = dx / Math.cos(pen.a) / radius;
        pen.step(sign > 0 ? Math.min(to, pen.a + turn) : Math.max(to, pen.a - turn));
      }
    },
    straight(length: number, at: number): void {
      const end = pen.x + length;
      while (pen.x < end) pen.step(at);
    },
  };
  return pen;
}

/** THE LANDING past a lip at `lip` m of plan and `yLip` of height, shaped
 * by the equivalent fall height of `R` (see the header) for a take-off of
 * `R.kick` degrees left at `R.launch` of it. Drawn on from where the pen
 * stands — the table's end. */
export function shapeLanding(
  pen: Pen,
  R: Pick<
    JumpRule,
    "kick" | "launch" | "fall" | "speed" | "fast" | "steepest" | "knuckle" | "past"
  >,
  lip: number,
  yLip: number,
): void {
  const dx = pen.dx;
  const u = Math.sqrt(2 * G * R.fall);
  const fast = R.speed * R.fast;
  // The flight leaves the lip flatter than the lip (`launch`).
  const take = R.kick * RAD * R.launch;
  let down: number | null = null;
  for (let i = 0; i < 8000; i++) {
    const lx = pen.x + dx - lip;
    const ly = pen.y - yLip;
    // The take-off speed whose flight passes through here.
    const den = 2 * Math.cos(take) ** 2 * (lx * Math.tan(take) - ly);
    const v0 = Math.sqrt((G * lx * lx) / den);
    const vx = v0 * Math.cos(take);
    const vy = v0 * Math.sin(take) - (G * lx) / vx;
    const fall = -Math.atan2(vy, vx);
    const want = clamp(fall - Math.asin(Math.min(1, u / hypot(vx, vy))), 0, R.steepest * RAD);
    // Rounded over at the knuckle, never sharper than its radius.
    pen.step(Math.min(want, pen.a + dx / Math.cos(pen.a) / R.knuckle));
    if (down === null && v0 > fast) down = pen.x;
    if (down !== null && pen.x > down + R.past) break;
  }
}

/** A line down the face and how the venue sits on it. */
export type Fit = { x: number; z: number; heading: number; shift: number; cost: number };

/** THE VENUE'S LINE on `level`: the column, the bearing and the start
 * where the profile cuts and fills least, clear of the stations and the
 * village; null on a map too small for it. */
export function findLine(level: Level, p: VenueProfile, R: VenueRule): Fit | null {
  const S = R.search;
  const n = Math.ceil(p.end / S.step) + 1;
  const prof = new Float64Array(n);
  for (let k = 0; k < n; k++) prof[k] = jumpHeightAt(p, k * S.step);
  const ground = new Float64Array(n);
  let best: Fit | null = null;
  const resort = level.resort;
  for (let cx = S.edge; cx <= level.size - S.edge; cx += S.stride) {
    for (const deg of S.bearings) {
      const heading = deg * RAD;
      const fx = Math.sin(heading);
      const fz = Math.cos(heading);
      for (let d = 0; ; d += S.starts) {
        const x0 = cx + fx * d;
        const z0 = S.top + fz * d;
        const x1 = x0 + fx * p.end;
        const z1 = z0 + fz * p.end;
        if (z1 > level.size - S.edge || x1 < S.edge || x1 > level.size - S.edge) break;
        if (x0 < S.edge || x0 > level.size - S.edge) continue;
        let mean = 0;
        for (let k = 0; k < n; k++) {
          ground[k] = level.groundAt(x0 + fx * k * S.step, z0 + fz * k * S.step);
          mean += ground[k] - prof[k];
        }
        mean /= n;
        let sq = 0;
        let deepest = 0;
        for (let k = 0; k < n; k++) {
          const e = prof[k] + mean - ground[k];
          sq += e * e;
          deepest = Math.max(deepest, Math.abs(e));
        }
        const cost = Math.sqrt(sq / n) + R.fit.deepest * deepest;
        if (best && cost >= best.cost) continue;
        if (resort && near(resort, x0, z0, heading, p.end, R)) continue;
        best = { x: x0, z: z0, heading, shift: mean, cost };
      }
    }
  }
  return best;
}

/** Whether a lift station or the village stands on or beside the venue. */
function near(
  resort: NonNullable<Level["resort"]>,
  x: number,
  z: number,
  heading: number,
  length: number,
  R: VenueRule,
): boolean {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const at = (q: Vec3, r: number): boolean => {
    const along = (q.x - x) * fx + (q.z - z) * fz;
    const across = (q.x - x) * fz - (q.z - z) * fx;
    return along > -r && along < length + r && Math.abs(across) < R.width / 2 + R.ease + r;
  };
  for (const l of resort.lifts) {
    if (at(l.bottom, R.fit.stations) || at(l.top, R.fit.stations)) return true;
  }
  return at(resort.village, R.fit.village);
}

/** The map under any course built over `level`. */
export function originalOf(level: Level): Level {
  return (
    level.slalom?.base ??
    level.downhill?.base ??
    level.superG?.base ??
    level.giantSlalom?.base ??
    level.speedSki?.base ??
    level.skiCross?.base ??
    level.bigAir?.base ??
    level.knuckleHuck?.base ??
    level.slopestyle?.base ??
    level
  );
}

/** A VENUE GRADED over a map: the line it stands on and the frame along
 * it, its height `yAt` m of plan, the map with its ground graded and
 * groomed and its woods, kickers, drops and cliffs cleared (every course
 * on it taken off), and the `track` down it. */
export type GradedVenue = {
  fit: Fit;
  fx: number;
  fz: number;
  rx: number;
  rz: number;
  yAt: (d: number) => number;
  level: Level;
};

/** THE VENUE OF PROFILE `p` TO RULE `R` over `original` (a map with no
 * course on it), on the line searched for it. `kickers` are what it adds
 * to the map's own. */
export function gradeVenue(
  original: Level,
  p: VenueProfile,
  R: VenueRule,
  extra: (v: Omit<GradedVenue, "level">) => Kicker[],
): GradedVenue {
  const fit = findLine(original, p, R) ?? {
    x: original.size / 2,
    z: R.search.top,
    heading: 0,
    shift: original.groundAt(original.size / 2, R.search.top),
    cost: 0,
  };
  const fx = Math.sin(fit.heading);
  const fz = Math.cos(fit.heading);
  const rx = Math.cos(fit.heading);
  const rz = -Math.sin(fit.heading);
  const yAt = (d: number): number => jumpHeightAt(p, d) + fit.shift;
  // The track, every 2 m of plan — the arc IS the plan distance along the
  // line, as on a speed track.
  const points: TrackPoint[] = [];
  for (let s = 0; s <= p.end + 1e-6; s += 2) {
    points.push({
      x: fit.x + fx * s,
      z: fit.z + fz * s,
      y: yAt(s),
      s,
      heading: fit.heading,
      width: R.width,
    });
  }
  const length = points[points.length - 1].s;
  // THE GROUND graded to the profile across the venue, eased out past it.
  const half = R.width / 2;
  const field = original.ground;
  const ground: Heightfield = { ...field, data: new Float32Array(field.data) };
  const packedField = original.packed;
  const packed = packedField ? { ...packedField, data: new Float32Array(packedField.data) } : null;
  const fade = LEVEL_RULES.track.shoulder.packed;
  const reach = half + Math.max(R.ease, fade) + 2;
  const corners = [
    [-R.ease, -reach],
    [-R.ease, reach],
    [length + R.ease, -reach],
    [length + R.ease, reach],
  ].map(([a, c]) => ({ x: fit.x + fx * a + rx * c, z: fit.z + fz * a + rz * c }));
  const xs = corners.map((q) => q.x);
  const zs = corners.map((q) => q.z);
  const c0 = clamp(Math.floor((Math.min(...xs) - field.originX) / field.cell), 0, field.cols - 1);
  const c1 = clamp(Math.ceil((Math.max(...xs) - field.originX) / field.cell), 0, field.cols - 1);
  const r0 = clamp(Math.floor((Math.min(...zs) - field.originZ) / field.cell), 0, field.rows - 1);
  const r1 = clamp(Math.ceil((Math.max(...zs) - field.originZ) / field.cell), 0, field.rows - 1);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = field.originX + c * field.cell;
      const z = field.originZ + r * field.cell;
      const dx = x - fit.x;
      const dz = z - fit.z;
      const along = dx * fx + dz * fz;
      const across = Math.abs(dx * rx + dz * rz);
      const ends = smoothstep(-R.ease, 0, along) * (1 - smoothstep(length, length + R.ease, along));
      if (ends <= 0) continue;
      const i = r * field.cols + c;
      const w = (1 - smoothstep(half, half + R.ease, across)) * ends;
      if (w > 0) ground.data[i] += w * (yAt(clamp(along, 0, length)) - ground.data[i]);
      if (packed) {
        const firm = (1 - smoothstep(half, half + fade, across)) * ends;
        if (firm > packed.data[i]) packed.data[i] = firm;
      }
    }
  }
  // THE WOODS and the finish arena cleared; the piste's kickers and drops
  // in the cut taken out with the ground they stood on.
  const A = R.arena;
  const off = (x: number, z: number, r: number): boolean => {
    const dx = x - fit.x;
    const dz = z - fit.z;
    const along = dx * fx + dz * fz;
    const across = Math.abs(dx * rx + dz * rz);
    if (along > -20 && along < length + half && across < half + r) return true;
    return along > p.finish - A.before && along < p.finish + A.past && across < A.half;
  };
  const trees: Level["trees"] = original.trees.filter((t) => !off(t.x, t.z, R.margin));
  const kickers = (original.kickers ?? [])
    .filter((k) => !off(k.x, k.z, R.ease + k.ramp))
    .map((k) => ({ ...k, onTrack: false, s: undefined }));
  const cliffs: Cliff[] = (original.cliffs ?? [])
    .filter((k) => !off(k.x, k.z, R.ease + k.width / 2))
    .map((k) => ({ ...k, onTrack: false, s: undefined }));
  const frame = { fit, fx, fz, rx, rz, yAt };
  const scratch = new Float64Array(3);
  const level: Level = {
    ...original,
    ground,
    groundAt: (x, z) => sampleField(ground, x, z),
    normalAt: (x: number, z: number, n: Vec3) => {
      sampleFieldGradient(ground, x, z, scratch);
      const nx = -scratch[1];
      const nz = -scratch[2];
      const inv = 1 / Math.sqrt(nx * nx + 1 + nz * nz);
      n.x = nx * inv;
      n.y = inv;
      n.z = nz * inv;
    },
    ...(packed ? { packed, packedAt: (x: number, z: number) => sampleField(packed, x, z) } : {}),
    track: { points, length, closed: false },
    trees,
    kickers: [...kickers, ...extra(frame)],
    cliffs,
    drifts: [],
    slalom: undefined,
    downhill: undefined,
    superG: undefined,
    giantSlalom: undefined,
    speedSki: undefined,
    skiCross: undefined,
    bigAir: undefined,
    knuckleHuck: undefined,
    slopestyle: undefined,
    jibs: undefined,
  };
  return { ...frame, level };
}
