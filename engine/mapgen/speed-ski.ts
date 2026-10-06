// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R34 — A SPEED-SKIING TRACK SET OVER A BUILT MAP. Not a course on the
// piste: a track of its own, cut STRAIGHT down the fall line of the face —
// as a real one is, a strip of the mountain closed off, graded smooth and
// groomed hard, with a 25 m margin cleared either side of it. Down it the
// racer is launched from a start platform near the top, TIMED through a
// 100 m zone, and stopped on a run-out whose slope eases off into the
// valley; the result is his speed between the zone's two lines.
//
// THE LINE IS SEARCHED, never laid by hand: every column of the face and a
// few bearings either side of the fall line, each read down the face as the
// ground across the track's width, combed to its mean along it, its crests
// rounded so nothing at 200 km/h leaves the snow and never rising — the
// profile the snowcats would grade — and held within a few metres of the
// ground it is cut from. Down each, every start is skied by a point mass
// with the top class's numbers (`speedSki.stop`: its tuck to the trap, then
// stood up into the wind and skidding once slow): the line whose final
// comes through the trap nearest the speed this map's track is built for
// (dealt inside the top class's band), and whose run-out stops
// that racer before the map ends, is the track. A QUALIFICATION starts
// lower down the same track, where the launch gives `speedSki.qualify` km/h
// less. Everything is a pure function of the map, drawing nothing from any
// stream (the speed a track is built for is dealt off the map's seed on a
// stream of its own) — so no digest moves and a restart stands on the very
// track it left.

import { clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import {
  sampleField,
  sampleFieldGradient,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { DISCIPLINE_RULES } from "./discipline-rules.ts";
import { LEVEL_RULES } from "./rules.ts";
import type { Checkpoint, Level, Spawn, SpeedSkiCourse, TrackPoint, Vec3 } from "./types.ts";

const K = DISCIPLINE_RULES.speedSki;
const G = 9.81;

/** What a track's speed is dealt off beside the map's seed. */
const SPEED_SKI_SALT = 0x5bd1;

/** A line down the face: its head, its bearing, and the graded profile and
 * the ground under its middle every `search.step` m of plan along it. */
type Line = {
  x: number;
  z: number;
  heading: number;
  profile: Float64Array;
  ground: Float64Array;
};

/** Where on a line a track stands: the final's start (the platform's lip),
 * the zone's two lines and the stop, as plan distances down the line, m. */
type Fit = {
  start: number;
  entry: number;
  exit: number;
  stop: number;
  speed: number;
  launch: number;
};

/** The profile under (`below`) or over `y` whose curvature is held to
 * `c` the other way: the lower convex hull of y + c·x²/2 less the parabola
 * again (no crest sharper than 1/c, only ever cut), or the upper concave
 * hull of y − c·x²/2 plus it (no knee sharper, only ever filled). In place. */
export function hullOf(y: Float64Array, step: number, c: number, below: boolean): void {
  const n = y.length;
  const k = below ? c / 2 : -c / 2;
  const lift = (i: number): number => y[i] + k * (i * step) ** 2;
  const sign = below ? 1 : -1;
  const hull: number[] = [];
  for (let i = 0; i < n; i++) {
    while (hull.length >= 2) {
      const a = hull[hull.length - 2];
      const b = hull[hull.length - 1];
      // b on the wrong side of the chord a–i: not on the hull.
      const cross = (lift(b) - lift(a)) * (i - a) - (lift(i) - lift(a)) * (b - a);
      if (sign * cross >= 0) hull.pop();
      else break;
    }
    hull.push(i);
  }
  const out = new Float64Array(n);
  for (let h = 0; h < hull.length - 1; h++) {
    const a = hull[h];
    const b = hull[h + 1];
    for (let i = a; i <= b; i++) {
      const at = lift(a) + ((lift(b) - lift(a)) * (i - a)) / Math.max(1, b - a);
      out[i] = at - k * (i * step) ** 2;
    }
  }
  y.set(out);
}

/** NEVER RISING down the track, every crest ROUNDED to no tighter than
 * `speedSki.crest` m of radius — cut — and every knee where the steep
 * meets the gentle to no tighter than `speedSki.knee` — filled — so the
 * racer is neither thrown off the snow nor slammed into it at 200 km/h.
 * In place. */
function roundProfile(y: Float64Array, step: number): void {
  const n = y.length;
  for (let i = 1; i < n; i++) y[i] = Math.min(y[i], y[i - 1]);
  hullOf(y, step, 1 / K.crest, true);
  hullOf(y, step, 1 / K.knee, false);
  for (let i = 1; i < n; i++) y[i] = Math.min(y[i], y[i - 1]);
}

/** THE GROUND ACROSS A LINE, combed and graded: read every `step` m down
 * it from its head until it leaves the map. */
function readLine(level: Level, x: number, z: number, heading: number): Line | null {
  const step = K.search.step;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);
  const half = K.width / 2;
  const lo = K.search.edge;
  const hi = level.size - K.search.edge;
  const raw: number[] = [];
  const middle: number[] = [];
  for (let d = 0; ; d += step) {
    const px = x + fx * d;
    const pz = z + fz * d;
    if (px < lo || px > hi || pz > level.size - 40) break;
    let sum = 0;
    for (let k = -2; k <= 2; k++) {
      sum += level.groundAt(px + (rx * k * half) / 2, pz + (rz * k * half) / 2);
    }
    raw.push(sum / 5);
    middle.push(level.groundAt(px, pz));
  }
  const n = raw.length;
  if (n < 80) return null;
  // COMBED: the mean along it over `smooth` either side.
  const w = Math.max(1, Math.round(K.smooth / step));
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
  roundProfile(y, step);
  return { x, z, heading, profile: y, ground: Float64Array.from(middle) };
}

/** A point mass of the top class launched from `start` (a sample of
 * `line`) at a push's speed, tucked all the way down: the slope distance
 * and the clock at every sample from it on. */
function tuckDown(
  line: Line,
  start: number,
  along: Float64Array,
  clock: Float64Array,
  speed: Float64Array,
): number {
  const S = K.stop;
  const step = K.search.step;
  const y = line.profile;
  const tuck = (0.5 * S.air * S.tuck) / S.mass;
  let v = 2;
  along[0] = 0;
  clock[0] = 0;
  speed[0] = v;
  let k = 1;
  for (let i = start; i < y.length - 1; i++, k++) {
    const dy = y[i] - y[i + 1];
    const ds = hypot(step, dy);
    const fall = G * ((dy - S.friction * step) / ds);
    const v1 = Math.sqrt(Math.max(0.01, v * v + 2 * ds * (fall - tuck * v * v)));
    along[k] = along[k - 1] + ds;
    clock[k] = clock[k - 1] + (2 * ds) / (v + v1);
    speed[k] = v1;
    v = v1;
  }
  return k;
}

/** Where the run-out stops a racer at `v` m/s at sample `from` of `line`
 * — stood up into the wind, skidding once slow — as a plan distance, m;
 * null where the line ends first. */
function stopOn(line: Line, from: number, v: number): number | null {
  const S = K.stop;
  const exitAt = from * K.search.step;
  const step = K.search.step;
  const y = line.profile;
  const stood = (0.5 * S.air * S.stood) / S.mass;
  for (let i = from; i < y.length - 1; i++) {
    const dy = y[i] - y[i + 1];
    const ds = hypot(step, dy);
    const fall = G * ((dy - S.friction * step) / ds);
    const braking = (i + 1) * step - exitAt >= K.runOut.brake;
    const skid = braking && v < S.below ? (S.skid * G * step) / ds : 0;
    v = Math.sqrt(Math.max(0, v * v + 2 * ds * (fall - stood * v * v - skid)));
    if (v <= S.rest) return (i + 1) * step;
  }
  return null;
}

/** The sample at which `along` (rising) passes `length`, as a fraction. */
function sampleAt(along: Float64Array, count: number, length: number): number {
  let lo = 0;
  let hi = count - 1;
  if (along[hi] < length) return -1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (along[mid] < length) lo = mid;
    else hi = mid;
  }
  return lo + (length - along[lo]) / Math.max(1e-9, along[hi] - along[lo]);
}

function lerpAt(a: Float64Array, f: number): number {
  const i = Math.floor(f);
  return a[i] + (a[i + 1] - a[i]) * (f - i);
}

/** Whether the stretch of `line` from `a` to `b` (plan distances, m) keeps
 * clear of every lift station and the village, and its profile within
 * `speedSki.cut` of the ground under its middle. */
function clearOf(level: Level, line: Line, a: number, b: number): number | null {
  const step = K.search.step;
  const fx = Math.sin(line.heading);
  const fz = Math.cos(line.heading);
  const near = (p: Vec3, r: number): boolean => {
    const dx = p.x - line.x;
    const dz = p.z - line.z;
    const along = dx * fx + dz * fz;
    const across = dx * fz - dz * fx;
    return along > a - r && along < b + r && Math.abs(across) < K.width / 2 + r;
  };
  const resort = level.resort;
  if (resort) {
    for (const l of resort.lifts) {
      if (near(l.bottom, K.stations) || near(l.top, K.stations)) return null;
    }
    if (near(resort.village, 150)) return null;
  }
  let deepest = 0;
  for (let i = Math.round(a / step); i <= Math.min(line.profile.length - 1, b / step); i++) {
    deepest = Math.max(deepest, Math.abs(line.profile[i] - line.ground[i]));
  }
  return deepest <= K.cut ? deepest : null;
}

/** THE TRACK'S LINE on `level` (R34): the line and the fit that wins — the
 * final nearest the speed aimed at inside the band, a gentle trap, a
 * run-out of a real track's length, then the least graded — or, on a face
 * where nothing fits the band, the one that comes nearest. */
function findTrack(level: Level): { line: Line; fit: Fit } | null {
  const step = K.search.step;
  const B = K.speed;
  // THE SPEED THIS TRACK IS BUILT FOR, dealt off the map's seed inside the
  // band: some tracks give 190 km/h, a few a record's.
  const dealt = createRng((level.seed ^ SPEED_SKI_SALT) >>> 0).next();
  const aim = B.aim.min + (B.aim.max - B.aim.min) * dealt;
  const F = K.fit;
  let best: { line: Line; fit: Fit; score: number } | null = null;
  const size = Math.ceil(level.size / step) + 2;
  const along = new Float64Array(size);
  const clock = new Float64Array(size);
  const speed = new Float64Array(size);
  for (let x = K.search.edge; x <= level.size - K.search.edge; x += K.search.stride) {
    for (const deg of K.search.bearings) {
      const line = readLine(level, x, K.search.top, (deg * Math.PI) / 180);
      if (!line) continue;
      const y = line.profile;
      const n = y.length;
      for (let i = 0; i < n - 40; i += K.search.starts) {
        const count = tuckDown(line, i, along, clock, speed);
        for (const launch of K.launch) {
          const e = sampleAt(along, count, launch);
          const x2 = e < 0 ? -1 : sampleAt(along, count, launch + K.trap);
          if (x2 < 0) break;
          const v = (K.trap / (lerpAt(clock, x2) - lerpAt(clock, e))) * 3.6;
          const miss = Math.abs(v - aim) + (v < B.min || v > B.max ? 1000 : 0);
          if (best && miss > best.score) continue;
          const entry = (i + e) * step;
          const exit = (i + x2) * step;
          const trapGrade = (lerpAt(y, i + e) - lerpAt(y, i + x2)) / (exit - entry);
          let score =
            miss +
            F.trap * Math.max(0, trapGrade - F.trapGrade) +
            F.launch * Math.abs(launch - F.launchAim);
          if (best && score > best.score) continue;
          const stop = stopOn(line, Math.ceil(i + x2), lerpAt(speed, x2));
          if (stop === null || stop + K.past > (n - 1) * step) continue;
          score += F.outrun * Math.max(0, stop - exit - F.outrunMost);
          if (best && score > best.score) continue;
          const cut = clearOf(level, line, i * step - K.platform, stop + K.past);
          if (cut === null) continue;
          score += F.cut * cut;
          if (!best || score < best.score) {
            best = { line, fit: { start: i * step, entry, exit, stop, speed: v, launch }, score };
          }
        }
      }
    }
  }
  return best ? { line: best.line, fit: best.fit } : null;
}

/** The arc, m, `length` m along the snow down `points` from arc `from`. */
function arcAlong(points: readonly TrackPoint[], from: number, length: number): number {
  let along = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (b.s <= from) continue;
    const s0 = Math.max(a.s, from);
    const share = (b.s - s0) / (b.s - a.s);
    const seg = hypot(b.s - a.s, b.y - a.y) * share;
    if (along + seg >= length) return s0 + ((length - along) / seg) * (b.s - s0);
    along += seg;
  }
  return points[points.length - 1].s;
}

/** The height of the track at arc `s`, m. */
function heightAt(points: readonly TrackPoint[], s: number): number {
  const step = points[1].s - points[0].s;
  const f = clamp(s / step, 0, points.length - 1);
  const i = Math.min(points.length - 2, Math.floor(f));
  return points[i].y + (points[i + 1].y - points[i].y) * (f - i);
}

/** The speed through the zone, km/h, of the rule's point mass launched from
 * arc `from` on the built track. */
function zoneSpeed(
  points: readonly TrackPoint[],
  from: number,
  entry: number,
  exit: number,
): number {
  const S = K.stop;
  const tuck = (0.5 * S.air * S.tuck) / S.mass;
  const ds = 1;
  let v = 2;
  let t = 0;
  for (let s = from; s < exit; s += ds) {
    const dy = heightAt(points, s) - heightAt(points, s + ds);
    const len = hypot(ds, dy);
    const sin = dy / len;
    const cos = ds / len;
    const v1 = Math.sqrt(
      Math.max(0.01, v * v + 2 * len * (G * (sin - S.friction * cos) - tuck * v * v)),
    );
    if (s >= entry) t += (2 * len) / (v + v1);
    v = v1;
  }
  return t > 0 ? (K.trap / t) * 3.6 : 0;
}

/** The graded map with the track on it, shared by both runs. */
type Graded = {
  level: Level;
  top: number;
  entry: number;
  exit: number;
  stop: number;
  final: number;
  qualify: number;
};
const graded = new WeakMap<Level, Graded>();

/** THE TRACK CUT INTO `original` (R34): its own `track`, the ground graded
 * to its profile across its width, the snow groomed, the margin and the
 * finish enclosure cleared, the piste's kickers and drops off it. */
function gradeTrack(original: Level): Graded {
  const known = graded.get(original);
  if (known) return known;
  const found = findTrack(original);
  const step = K.search.step;
  // A face too small for any track: a straight cut down its middle anyway.
  const line = found?.line ??
    readLine(original, original.size / 2, K.search.top, 0) ?? {
      x: original.size / 2,
      z: K.search.top,
      heading: 0,
      profile: Float64Array.from({ length: 400 }, (_, i) =>
        original.groundAt(original.size / 2, K.search.top + i * step),
      ),
      ground: new Float64Array(400),
    };
  const fit = found?.fit ?? {
    start: 20,
    entry: 300,
    exit: 380,
    stop: (line.profile.length - 30) * step,
    speed: 0,
    launch: K.launch[0],
  };
  const fx = Math.sin(line.heading);
  const fz = Math.cos(line.heading);
  const rx = Math.cos(line.heading);
  const rz = -Math.sin(line.heading);
  // The track: from the platform's top to past the stop, every 2 m.
  const d0 = Math.max(0, fit.start - K.platform);
  const dEnd = Math.min((line.profile.length - 1) * step, fit.stop + K.past);
  // Read between the samples on a cubic (Catmull-Rom) — a straight line
  // between them would leave a kink in the snow every few metres, and a
  // racer at 55 m/s rides every one of them.
  const P = line.profile;
  const last = P.length - 1;
  const profileAt = (d: number): number => {
    const f = clamp(d / step, 0, last);
    const i = Math.min(last - 1, Math.floor(f));
    const u = f - i;
    const p0 = P[Math.max(0, i - 1)];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[Math.min(last, i + 2)];
    return (
      p1 + 0.5 * u * (p2 - p0 + u * (2 * p0 - 5 * p1 + 4 * p2 - p3 + u * (3 * (p1 - p2) + p3 - p0)))
    );
  };
  const yAt = profileAt;
  const points: TrackPoint[] = [];
  for (let s = 0; s <= dEnd - d0 + 1e-6; s += 2) {
    points.push({
      x: line.x + fx * (d0 + s),
      z: line.z + fz * (d0 + s),
      y: yAt(d0 + s),
      s,
      heading: line.heading,
      width: K.width,
    });
  }
  const length = points[points.length - 1].s;
  // THE GROUND graded to the profile across the track, eased out past it.
  const half = K.width / 2;
  const field = original.ground;
  const ground: Heightfield = { ...field, data: new Float32Array(field.data) };
  const packedField = original.packed;
  const packed = packedField ? { ...packedField, data: new Float32Array(packedField.data) } : null;
  const fade = LEVEL_RULES.track.shoulder.packed;
  const reach = half + Math.max(K.ease, fade) + 2;
  const corners = [
    [d0 - K.ease, -reach],
    [d0 - K.ease, reach],
    [dEnd + K.ease, -reach],
    [dEnd + K.ease, reach],
  ].map(([a, c]) => ({ x: line.x + fx * a + rx * c, z: line.z + fz * a + rz * c }));
  const xs = corners.map((p) => p.x);
  const zs = corners.map((p) => p.z);
  const c0 = clamp(Math.floor((Math.min(...xs) - field.originX) / field.cell), 0, field.cols - 1);
  const c1 = clamp(Math.ceil((Math.max(...xs) - field.originX) / field.cell), 0, field.cols - 1);
  const r0 = clamp(Math.floor((Math.min(...zs) - field.originZ) / field.cell), 0, field.rows - 1);
  const r1 = clamp(Math.ceil((Math.max(...zs) - field.originZ) / field.cell), 0, field.rows - 1);
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const x = field.originX + c * field.cell;
      const z = field.originZ + r * field.cell;
      const dx = x - line.x;
      const dz = z - line.z;
      const along = dx * fx + dz * fz;
      const across = Math.abs(dx * rx + dz * rz);
      const ends =
        smoothstep(d0 - K.ease, d0, along) * (1 - smoothstep(dEnd, dEnd + K.ease, along));
      if (ends <= 0) continue;
      const i = r * field.cols + c;
      const w = (1 - smoothstep(half, half + K.ease, across)) * ends;
      if (w > 0) ground.data[i] += w * (yAt(clamp(along, d0, dEnd)) - ground.data[i]);
      if (packed) {
        const firm = (1 - smoothstep(half, half + fade, across)) * ends;
        if (firm > packed.data[i]) packed.data[i] = firm;
      }
    }
  }
  // THE MARGIN and the finish enclosure cleared; the piste's kickers and
  // drops in the cut taken out with the ground they stood on, and the rest
  // no longer on any track a racer skis.
  const A = K.arena;
  const off = (x: number, z: number, r: number): boolean => {
    const dx = x - line.x;
    const dz = z - line.z;
    const along = dx * fx + dz * fz;
    const across = Math.abs(dx * rx + dz * rz);
    if (along > d0 - 20 && along < dEnd + 10 && across < half + r) return true;
    return along > fit.stop - A.before && along < fit.stop + A.past && across < A.half;
  };
  const trees = original.trees.filter((t) => !off(t.x, t.z, K.margin));
  const kickers = (original.kickers ?? [])
    .filter((k) => !off(k.x, k.z, K.ease + k.ramp))
    .map((k) => ({ ...k, onTrack: false, s: undefined }));
  const cliffs = (original.cliffs ?? [])
    .filter((k) => !off(k.x, k.z, K.ease + k.width / 2))
    .map((k) => ({ ...k, onTrack: false, s: undefined }));
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
    kickers,
    cliffs,
    drifts: [],
    slalom: undefined,
    downhill: undefined,
    superG: undefined,
    giantSlalom: undefined,
    skiCross: undefined,
    bigAir: undefined,
    knuckleHuck: undefined,
    slopestyle: undefined,
    jibs: undefined,
  };
  // The arcs on the built track: the final's wand at the platform's lip,
  // the zone along the snow from it.
  const top = fit.start - d0;
  const entry = arcAlong(points, top, fit.launch);
  const exit = arcAlong(points, entry, K.trap);
  const stop = fit.stop - d0;
  const final = zoneSpeed(points, top, entry, exit);
  // THE QUALIFICATION'S START, lowered until the launch gives `qualify`
  // km/h less.
  let qualify = top;
  for (let s = top; s < entry - 60; s += 1) {
    qualify = s;
    if (zoneSpeed(points, s, entry, exit) <= final - K.qualify) break;
  }
  const out: Graded = { level, top, entry, exit, stop, final, qualify };
  graded.set(original, out);
  return out;
}

/** A line across the track at arc `s`. */
function across(level: Level, s: number, width: number): Checkpoint {
  const points = level.track.points;
  const step = points[1].s - points[0].s;
  const i = clamp(Math.round(s / step), 0, points.length - 1);
  const p = points[i];
  const u = s - p.s;
  const x = p.x + Math.sin(p.heading) * u;
  const z = p.z + Math.cos(p.heading) * u;
  return { x, z, y: heightAt(points, s), heading: p.heading, width, s, colour: "red" };
}

const runs = new WeakMap<Level, Map<1 | 2, Level>>();

/** R34 — A SPEED TRACK SET OVER `level`, for run `run` (the qualification,
 * 1, or the final, 2): the track cut down the face as the map's own
 * `track`, its checkpoints the run's start gate and the timing zone's two
 * lines, its spawn the run's start house. A map already carrying this run
 * is that map; one carrying any other course is set over the map under it.
 * Kept per map, so a restart or a replay stands on the track the renderer
 * already built. The track keeps the day and the sky of the map it was
 * set over. */
export function setSpeedSki(level: Level, run: 1 | 2 = 2): Level {
  if (level.speedSki?.run === run) return level;
  const original =
    level.speedSki?.base ??
    level.slalom?.base ??
    level.downhill?.base ??
    level.superG?.base ??
    level.giantSlalom?.base ??
    level.skiCross?.base ??
    level.bigAir?.base ??
    level.knuckleHuck?.base ??
    level.slopestyle?.base ??
    level;
  let mine = runs.get(original);
  if (!mine) {
    mine = new Map();
    runs.set(original, mine);
  }
  let course = mine.get(run);
  if (!course) {
    course = runOver(original, run);
    mine.set(run, course);
  }
  return course.sun === level.sun && course.weather === level.weather
    ? course
    : { ...course, sun: level.sun, weather: level.weather };
}

/** Run `run`'s track over `original`, a map with no course on it. */
function runOver(original: Level, run: 1 | 2): Level {
  const g = gradeTrack(original);
  const base = g.level;
  const from = run === 2 ? g.top : g.qualify;
  const wide = K.width + 2 * K.margin;
  const start = across(base, from, 2);
  const checkpoints: Checkpoint[] = [
    start,
    across(base, g.entry, wide),
    across(base, g.exit, wide),
  ];
  let zone = 0;
  const pts = base.track.points;
  for (let s = g.entry; s < g.exit - 1e-9; s += 0.5) {
    zone += hypot(
      Math.min(0.5, g.exit - s),
      heightAt(pts, s) - heightAt(pts, Math.min(g.exit, s + 0.5)),
    );
  }
  const house = across(base, from - K.stand, 2);
  const spawn: Spawn = { x: house.x, z: house.z, heading: start.heading };
  const speedSki: SpeedSkiCourse = {
    run,
    base: original,
    from,
    to: g.exit,
    vertical: start.y - checkpoints[2].y,
    zone: { from: g.entry, to: g.exit, length: zone },
    top: g.top,
    stop: g.stop,
    width: K.width,
  };
  return { ...base, checkpoints, spawn, grid: [spawn], speedSki };
}

/** The speed, km/h, the rule's point mass of the top class carries through
 * the timing zone of `level`'s track on this run — what the setter aimed
 * its line at; 0 on a map with no speed track. */
export function speedSkiAim(level: Level): number {
  const sk = level.speedSki;
  if (!sk) return 0;
  return zoneSpeed(level.track.points, sk.from, sk.zone.from, sk.zone.to);
}

/** THE RUN-OUT'S LINES on `level`'s speed track (R34), as gates a drawing
 * can stand on: the BRAKING LINE `speedSki.runOut.brake` m past the timing
 * zone — no skid and no turn before it — and the FINISH ENCLOSURE'S line at
 * the run-out's end, where a racer stopped is home and the crowd stands.
 * Neither is a gate the run owes: the run ends at the zone's bottom line.
 * Null on a map with no speed track. */
export function speedSkiLines(level: Level): { braking: Checkpoint; finish: Checkpoint } | null {
  const sk = level.speedSki;
  if (!sk) return null;
  const braking = across(level, sk.zone.to + K.runOut.brake, sk.width);
  const finish = across(level, sk.stop, sk.width + 6);
  return { braking: { ...braking, colour: "blue" }, finish };
}
