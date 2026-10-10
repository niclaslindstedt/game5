// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REAL TOWN OF A REAL FACE — where a map raised on a real face (R25,
// `Level.face`) lays its village's streets the way the real town at the
// face's foot runs its own, roughly (`real-hints.ts`: the town's streets as
// a few bends each, main roads told from streets, and its middle and
// radius).
//
// The village's plan (`village-streets.ts`) keeps its shape — a main
// street along the hub's valley edge, a back street behind it, cross
// streets between and a road out — and leans each piece onto the real
// streets where they lie where that piece goes:
//   * THE CENTRE is tried first where the most real street (and house)
//     lies under the village's span (`realWeight`);
//   * THE MAIN STREET follows the real road that runs along the valley
//     through the village's band (`realProfile`, a main road over a
//     street), smoothed and held to a street's bends, and THE BACK STREET
//     the real one behind it;
//   * THE CROSS STREETS stand where real streets cross between the two
//     (`realCrosses`), the dealt ones filling in after;
//   * THE ROAD OUT leaves from the end nearer where a real road reaches
//     the valley edge, and wanders toward it (`realExit`);
//   * and THE TOWN'S OTHER STREETS (`townStreets`) are laid along the real
//     ones near the village or inside the real town, every stretch of them
//     that clears what a street keeps clear of, as streets of their own the
//     real houses then stand along (`real-houses.ts`).
//
// A pure function of the map and its face's baked hints — no stream, no
// hash — and a map with no face, or a face with no town, lays exactly
// what it laid before.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { realHints, type HintStreet, type HintTown, type Point } from "../mapgen/real-hints.ts";
import type { Level } from "../mapgen/types.ts";

/** How the real town is read, m and shares.
 *   * `least`: the fewest real streets a face's town needs before the
 *     village leans on it.
 *   * `along` / `across`: a stretch of real street runs ALONG the valley
 *     where it turns off the village's axis by less than ~40° (its share
 *     along over its length is past `along`), and ACROSS it where it turns
 *     off the axis out of the hub by less than ~50°.
 *   * `step`: how often a profile is read along the village, m;
 *     `smooth` the half-window it is smoothed over, m; `slope` the most a
 *     street laid on it bends off the axis (rise over run).
 *   * `main`: the band a real main street is read in, m out of the hub's
 *     edge, and the share of the span it must run along to lead; a main
 *     road counts `weight` times a street.
 *   * `back`: how far behind the main street a real back street is read.
 *   * `crosses`: the most real cross streets taken.
 *   * `exit`: how near the valley edge a real road must reach to lead the
 *     road out, m, and how far the road out wanders toward it.
 *   * `house`: the metres of real street a real house is worth when the
 *     village's centre is weighed.
 *   * `town`: the other streets — those within `reach` m of the village's
 *     middle or `grow` times the town's radius of the town's middle; a
 *     stretch shorter than `shortest` m is not laid, nor more than `most`
 *     streets; how far off another street's reach one keeps (`apart`), and
 *     the steepest one climbs along (`grade`, rise over run; a real
 *     village street is steeper than the plan's) and leans across. */
export const REAL_STREETS = {
  least: 4,
  along: 0.75,
  across: 0.65,
  step: 10,
  smooth: 30,
  slope: 0.3,
  main: { band: [34, 90] as const, cover: 0.45, weight: 2 },
  back: { gap: [40, 100] as const },
  crosses: 3,
  exit: { near: 60, wander: 70 },
  house: 25,
  town: {
    reach: 450,
    grow: 1.3,
    shortest: 40,
    most: 40,
    apart: 4,
    grade: { along: 0.16, across: 0.16 },
  },
} as const;

/** The real town of `level`'s face, or null (a dealt massif, a face with
 * no hints or too few streets). */
export function realTownOf(
  level: Level,
): { readonly town: HintTown; readonly streets: readonly HintStreet[] } | null {
  if (!level.face) return null;
  const h = realHints(level.face);
  if (!h?.town || h.streets.length < REAL_STREETS.least) return null;
  return { town: h.town, streets: h.streets };
}

/** One stretch of real street in the village's frame: `x` along the hub's
 * valley edge, `v` out of it into the valley. */
export type FrameSeg = {
  ax: number;
  av: number;
  bx: number;
  bv: number;
  main: boolean;
  len: number;
};

/** The real streets in the frame off the hub's edge at `z0`, the valley
 * toward `sV`. */
export function inFrame(streets: readonly HintStreet[], z0: number, sV: 1 | -1): FrameSeg[] {
  const out: FrameSeg[] = [];
  for (const st of streets) {
    for (let i = 1; i < st.points.length; i++) {
      const a = st.points[i - 1];
      const b = st.points[i];
      const len = hypot(b.x - a.x, b.z - a.z);
      if (len < 1) continue;
      out.push({ ax: a.x, av: (a.z - z0) * sV, bx: b.x, bv: (b.z - z0) * sV, main: st.main, len });
    }
  }
  return out;
}

/** How much real street lies under a village from `x0` to `x1` and `v`
 * 0..`depth` out of the hub, m (a main road `main.weight` times). */
export function realWeight(
  segs: readonly FrameSeg[],
  x0: number,
  x1: number,
  depth: number,
): number {
  let w = 0;
  for (const s of segs) {
    const mx = (s.ax + s.bx) / 2;
    const mv = (s.av + s.bv) / 2;
    if (mx < x0 || mx > x1 || mv < 0 || mv > depth) continue;
    w += s.len * (s.main ? REAL_STREETS.main.weight : 1);
  }
  return w;
}

/** Where along x the stretch `s` is, at `x`, as its `v` — or null where it
 * does not run along the valley or does not reach `x`. */
function alongAt(s: FrameSeg, x: number): number | null {
  if (Math.abs(s.bx - s.ax) / s.len < REAL_STREETS.along) return null;
  const lo = Math.min(s.ax, s.bx);
  const hi = Math.max(s.ax, s.bx);
  if (x < lo || x > hi) return null;
  return s.av + ((s.bv - s.av) * (x - s.ax)) / (s.bx - s.ax);
}

/**
 * A STREET'S LINE off the real streets: from `xa` to `xb`, the `v` out of
 * the hub of the real street running along the valley inside `lo(x)` ..
 * `hi(x)` (a main road over a street, the nearest the line so far), filled
 * across its gaps, carried flat past its ends, smoothed and held to a
 * street's bends — or null where real street runs along less than
 * `cover` of the way.
 */
export function realProfile(
  segs: readonly FrameSeg[],
  xa: number,
  xb: number,
  lo: (x: number) => number,
  hi: (x: number) => number,
  cover: number,
): ((x: number) => number) | null {
  const R = REAL_STREETS;
  const n = Math.max(2, Math.round((xb - xa) / R.step));
  const xs = Array.from({ length: n + 1 }, (_, i) => xa + ((xb - xa) * i) / n);
  const picks: (number | null)[] = xs.map(() => null);
  // Every sample's candidates, each weighed.
  const cands = xs.map((x) => {
    const out: { v: number; w: number }[] = [];
    for (const s of segs) {
      const v = alongAt(s, x);
      if (v === null || v < lo(x) || v > hi(x)) continue;
      out.push({ v, w: s.main ? R.main.weight : 1 });
    }
    return out;
  });
  // Seed at the sample with the weightiest candidate, then walk both ways
  // taking the candidate nearest the last taken (a heavier one first).
  let seed = -1;
  let seedW = 0;
  cands.forEach((c, i) => {
    const w = Math.max(0, ...c.map((o) => o.w));
    if (w > seedW) [seed, seedW] = [i, w];
  });
  if (seed < 0) return null;
  const heaviest = (c: { v: number; w: number }[]) =>
    c.reduce((a, b) => (b.w > a.w ? b : a), c[0]).v;
  picks[seed] = heaviest(cands[seed]);
  for (const dir of [1, -1]) {
    let last = picks[seed]!;
    for (let i = seed + dir; i >= 0 && i <= n; i += dir) {
      let best: number | null = null;
      let bestD = Infinity;
      for (const c of cands[i]) {
        const d = Math.abs(c.v - last) / c.w;
        if (Math.abs(c.v - last) <= R.step * 2 && d < bestD) [best, bestD] = [c.v, d];
      }
      if (best !== null) {
        picks[i] = best;
        last = best;
      }
    }
  }
  const have = picks.filter((p) => p !== null).length;
  if (have < cover * (n + 1)) return null;
  // Fill: across a gap linearly, past the ends flat.
  const vs = picks.slice() as (number | null)[];
  const first = vs.findIndex((p) => p !== null);
  let prev = first;
  for (let i = 0; i <= n; i++) {
    if (vs[i] !== null) {
      if (prev >= 0 && i - prev > 1) {
        for (let k = prev + 1; k < i; k++) {
          vs[k] = vs[prev]! + ((vs[i]! - vs[prev]!) * (k - prev)) / (i - prev);
        }
      }
      prev = i;
    }
  }
  for (let i = 0; i < first; i++) vs[i] = vs[first];
  for (let i = prev + 1; i <= n; i++) vs[i] = vs[prev];
  // Smooth, then hold each step's bend and the band.
  const k = Math.round(R.smooth / R.step);
  const smooth = vs.map((_, i) => {
    let sum = 0;
    let m = 0;
    for (let j = Math.max(0, i - k); j <= Math.min(n, i + k); j++) {
      sum += vs[j]!;
      m++;
    }
    return sum / m;
  });
  const most = R.slope * ((xb - xa) / n);
  for (let i = 1; i <= n; i++) {
    const d = smooth[i] - smooth[i - 1];
    if (Math.abs(d) > most) smooth[i] = smooth[i - 1] + Math.sign(d) * most;
  }
  for (let i = 0; i <= n; i++) {
    smooth[i] = Math.max(lo(xs[i]), Math.min(hi(xs[i]), smooth[i]));
  }
  return (x) => {
    const t = Math.max(0, Math.min(n, ((x - xa) / (xb - xa)) * n));
    const i = Math.min(n - 1, Math.floor(t));
    return smooth[i] + (smooth[i + 1] - smooth[i]) * (t - i);
  };
}

/** Where real streets cross between the main street and the back street,
 * along x, the weightiest first: each stretch running across the valley
 * through the middle between the two, inside `xa`..`xb`. */
export function realCrosses(
  segs: readonly FrameSeg[],
  xa: number,
  xb: number,
  mainV: (x: number) => number,
  backV: (x: number) => number,
): number[] {
  const out: { x: number; w: number }[] = [];
  for (const s of segs) {
    if (Math.abs(s.bv - s.av) / s.len < REAL_STREETS.across) continue;
    // Where it passes the middle line, by bisection on its own length.
    const mid = (x: number) => (mainV(x) + backV(x)) / 2;
    const f = (t: number) => s.av + (s.bv - s.av) * t - mid(s.ax + (s.bx - s.ax) * t);
    const [f0, f1] = [f(0), f(1)];
    if (f0 * f1 > 0) continue;
    let [t0, t1] = [0, 1];
    for (let i = 0; i < 20; i++) {
      const t = (t0 + t1) / 2;
      if (f(t) * f0 > 0) t0 = t;
      else t1 = t;
    }
    const x = s.ax + (s.bx - s.ax) * ((t0 + t1) / 2);
    if (x < xa || x > xb) continue;
    out.push({ x: Math.round(x), w: s.len * (s.main ? REAL_STREETS.main.weight : 1) });
  }
  return out.sort((a, b) => b.w - a.w || a.x - b.x).map((c) => c.x);
}

/** Where along x a real road reaches the valley's edge (`v` past `vMax`
 * less `exit.near`), from the village's ends outward and inward by
 * `exit.wander` at most: the x of the one nearest an end, or null. */
export function realExit(
  segs: readonly FrameSeg[],
  xa: number,
  xb: number,
  vMax: number,
): { end: 0 | 1; x: number } | null {
  const E = REAL_STREETS.exit;
  let best: { end: 0 | 1; x: number } | null = null;
  let bestD = Infinity;
  for (const s of segs) {
    for (const [x, v] of [
      [s.ax, s.av],
      [s.bx, s.bv],
    ]) {
      if (v < vMax - E.near) continue;
      for (const [end, x0] of [
        [0, xa],
        [1, xb],
      ] as const) {
        const d = Math.abs(x - x0) - (s.main ? E.near : 0);
        if (Math.abs(x - x0) <= E.wander * 2 && d < bestD) {
          best = { end, x };
          bestD = d;
        }
      }
    }
  }
  return best;
}

/**
 * THE TOWN'S OTHER STREETS: every real street within `REAL_STREETS.town`'s
 * reach of the village's middle `centre` or of the real town's, the main
 * roads and the longest first, read every `step` m and cut into the
 * stretches `ok` passes at every point, asked with the way the street runs
 * there (clear of what a street keeps clear of, off the streets laid so
 * far, no steeper along or across than a village street); each
 * stretch at least `shortest` long handed to `lay`, which lays it (true)
 * or not — so `ok` can keep the next off it — until `most` are laid.
 */
export function townLines(
  town: { readonly town: HintTown; readonly streets: readonly HintStreet[] },
  centre: Point,
  step: number,
  ok: (x: number, z: number, dx: number, dz: number) => boolean,
  lay: (main: boolean, points: Point[]) => boolean,
): void {
  const T = REAL_STREETS.town;
  const near = (p: Point) =>
    hypot(p.x - centre.x, p.z - centre.z) < T.reach ||
    hypot(p.x - town.town.x, p.z - town.town.z) < town.town.r * T.grow;
  const length = (st: HintStreet) =>
    st.points
      .slice(1)
      .reduce((s, p, i) => s + hypot(p.x - st.points[i].x, p.z - st.points[i].z), 0);
  const order = town.streets
    .map((st, i) => ({ st, i, len: length(st) }))
    .sort((a, b) => Number(b.st.main) - Number(a.st.main) || b.len - a.len || a.i - b.i);
  let laid = 0;
  for (const { st } of order) {
    if (laid >= T.most) return;
    let cur: Point[] = [];
    let len = 0;
    const close = () => {
      if (len >= T.shortest && laid < T.most && lay(st.main, cur)) laid++;
      cur = [];
      len = 0;
    };
    for (let i = 1; i < st.points.length; i++) {
      const a = st.points[i - 1];
      const b = st.points[i];
      const l = hypot(b.x - a.x, b.z - a.z);
      if (l < 1e-6) continue;
      const k = Math.max(1, Math.ceil(l / step));
      for (let j = i === 1 ? 0 : 1; j <= k; j++) {
        const p = { x: a.x + ((b.x - a.x) * j) / k, z: a.z + ((b.z - a.z) * j) / k };
        if (near(p) && ok(p.x, p.z, (b.x - a.x) / l, (b.z - a.z) / l)) {
          if (cur.length > 0) {
            const q = cur[cur.length - 1];
            len += hypot(p.x - q.x, p.z - q.z);
          }
          cur.push(p);
        } else close();
      }
    }
    close();
  }
}
