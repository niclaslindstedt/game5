// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R25 — A REAL FACE'S HINTS: where the real ski area on a real face has
// its lifts, its pistes and its houses, coarsely.
//
// Baked offline off OpenStreetMap by `scripts/real-hints.mjs` into a
// generated file a face (`real-hints/hints-<id>.ts`, under the Open
// Database Licence, listed in `real-hints-index.ts`) on the
// same crop as the face's heights, so a hint stands on the map where the
// real lift, piste or house stands on the face. Nothing is named: a lift
// is its two ends and its kind, a piste its grade and a few bends down its
// line, a house its middle, its size and its bearing, a street of the town
// at the foot its class (a main road or a street) and a few bends, the
// town its middle and radius.
//
// They are HINTS, not a plan: the generator leans its stations, its runs
// and the village's buildings toward them where its own rules allow, and
// builds what they cannot fit as it would on any massif.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { PISTE_GRADES, type PisteGrade, type RunGrade } from "./grades.ts";
import { base64 } from "./base64.ts";
import { HINT_GRAIN, HINT_LOADERS, type HintData } from "./real-hints-index.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";

/** A real lift: its kind and its ends, the bottom the lower. */
export type HintLift = {
  readonly kind: "chair" | "gondola" | "drag";
  readonly bottom: Point;
  readonly top: Point;
};

/** A real piste: its grade and its bends, top first, with its width at
 * each bend (m, 0 where the map gives none). */
export type HintPiste = {
  readonly grade: RunGrade;
  readonly points: readonly Point[];
  readonly widths: readonly number[];
};

/** A real house: its middle, its size (the side of a square of its
 * footprint's area halved, m) and its longest wall's bearing (rad, from +z
 * clockwise, folded into half a turn). */
export type HintHouse = {
  readonly x: number;
  readonly z: number;
  readonly size: number;
  readonly turn: number;
};

/** A real street of the town at the face's foot, roughly: whether it is a
 * MAIN road (a through road) or a street, and its bends to a few metres. */
export type HintStreet = {
  readonly main: boolean;
  readonly points: readonly Point[];
};

/** The real town, roughly: its middle (where the most street lies) and the
 * radius that holds most of its streets, m. */
export type HintTown = { readonly x: number; readonly z: number; readonly r: number };

export type RealHints = {
  readonly lifts: readonly HintLift[];
  readonly pistes: readonly HintPiste[];
  readonly houses: readonly HintHouse[];
  /** The town's streets, the most central first (none where the face has
   * no town), and the town itself (null then). */
  readonly streets: readonly HintStreet[];
  readonly town: HintTown | null;
};

/** A point on the map, m. */
export type Point = { readonly x: number; readonly z: number };

const KINDS = ["chair", "gondola", "drag"] as const;
const GRADES: readonly RunGrade[] = ["green", "blue", "red", "black", "orange"];

const loaded = new Map<string, HintData>();
const decoded = new Map<string, RealHints>();

/** Whether a face has hints at all. */
export function faceHasHints(id: string): boolean {
  return HINT_LOADERS[id] !== undefined;
}

/** Fetch a face's hints, once — `loadRealFace`'s half; true for a face
 * with none. */
export async function loadRealHints(id: string): Promise<boolean> {
  const load = HINT_LOADERS[id];
  if (!load) return true;
  if (!loaded.has(id)) loaded.set(id, (await load()).HINTS);
  return true;
}

/** Whether a face's hints are in hand. */
export function realHintsLoaded(id: string): boolean {
  return loaded.has(id);
}

/** A face's hints by its id, decoded once; null for a face with none.
 * Throws for a face whose hints are not loaded (`loadRealFace`). */
export function realHints(id: string): RealHints | null {
  const kept = decoded.get(id);
  if (kept) return kept;
  if (!faceHasHints(id)) return null;
  const data = loaded.get(id);
  if (!data) throw new Error(`real face ${id} is not loaded (loadRealFace)`);
  const hints = decode(data);
  decoded.set(id, hints);
  return hints;
}

/** The bake's `encode` undone. */
function decode(h: HintData): RealHints {
  const bytes = base64(h.data);
  let at = 0;
  const get = (): number => {
    let z = 0;
    let shift = 0;
    let b: number;
    do {
      b = bytes[at++];
      z += (b & 0x7f) * 2 ** shift;
      shift += 7;
    } while (b & 0x80);
    return z % 2 ? -(z + 1) / 2 : z / 2;
  };
  const { coarse, fine, size, width, bearings, town: townStep } = HINT_GRAIN;
  const lifts: HintLift[] = [];
  for (let i = get(); i > 0; i--) {
    const kind = KINDS[get()];
    const bottom = { x: get() * coarse, z: get() * coarse };
    const top = { x: get() * coarse, z: get() * coarse };
    lifts.push({ kind, bottom, top });
  }
  const pistes: HintPiste[] = [];
  for (let i = get(); i > 0; i--) {
    const grade = GRADES[get()];
    const points: Point[] = [];
    const widths: number[] = [];
    let [x, z] = [0, 0];
    for (let k = get(); k > 0; k--) {
      x += get();
      z += get();
      points.push({ x: x * coarse, z: z * coarse });
      widths.push(get() * width);
    }
    pistes.push({ grade, points, widths });
  }
  const houses: HintHouse[] = [];
  let [x, z] = [0, 0];
  for (let i = get(); i > 0; i--) {
    z += get();
    x += get();
    const v = get();
    houses.push({
      x: x * fine,
      z: z * fine,
      size: Math.floor(v / bearings) * size,
      turn: ((v % bearings) / bearings) * Math.PI,
    });
  }
  const streets: HintStreet[] = [];
  let town: HintTown | null = null;
  const nStreets = at < bytes.length ? get() : 0;
  if (nStreets > 0) {
    town = { x: get() * coarse, z: get() * coarse, r: get() * townStep };
    let [x, z] = [0, 0];
    for (let i = nStreets; i > 0; i--) {
      const main = get() === 0;
      const points: Point[] = [];
      for (let k = get(); k > 0; k--) {
        x += get();
        z += get();
        points.push({ x: x * coarse, z: z * coarse });
      }
      streets.push({ main, points });
    }
  }
  return { lifts, pistes, houses, streets, town };
}

// ── Leaning on them ─────────────────────────────────────────────────────

/** How far a station is moved toward a real lift's end at most, m, and how
 * far up or down the face (`rise`, m). */
export type HintReach = { readonly reach: number; readonly rise: number };

/** A station (a lift's top or bottom) leant onto the nearest real lift end
 * of the same kind of end within `reach` that no other station took, its
 * height down the face moved at most `rise`; `keepZ` leaves it on its row
 * (a top on the summit ridge). Unchanged where no real end is near. */
export function leanStation(
  hints: RealHints,
  used: Set<HintLift>,
  at: Point,
  end: "bottom" | "top",
  r: HintReach,
  keepZ = false,
): Point {
  let best: HintLift | null = null;
  let bestD = r.reach;
  for (const l of hints.lifts) {
    if (used.has(l)) continue;
    const p = l[end];
    const d = hypot(p.x - at.x, p.z - at.z);
    if (d < bestD && Math.abs(p.z - at.z) <= r.rise * 2) {
      best = l;
      bestD = d;
    }
  }
  if (!best) return at;
  used.add(best);
  const p = best[end];
  const z = keepZ ? at.z : at.z + Math.max(-r.rise, Math.min(r.rise, p.z - at.z));
  return { x: p.x, z };
}

/** The real piste a run leaving (`x`, `z`) for `target` follows, as the
 * bends it steers through on its way: the one whose top is nearest within
 * `reach` (a piste of the run's own grade nearer by `same` m) and which
 * falls most of the way to the target's row; its bends between the start
 * and the target's row, a margin off each. Null where none is near. */
export function pisteVia(
  hints: RealHints,
  used: Set<HintPiste>,
  start: Point,
  target: Point,
  grade: RunGrade,
  r: { readonly reach: number; readonly same: number; readonly margin: number },
): readonly Point[] | null {
  let best: HintPiste | null = null;
  let bestD = r.reach;
  const drop = target.z - start.z;
  for (const p of hints.pistes) {
    if (used.has(p) || p.points.length < 3) continue;
    const top = p.points[0];
    const fall = p.points[p.points.length - 1].z - top.z;
    if (fall < drop * 0.4) continue;
    const d = hypot(top.x - start.x, top.z - start.z) - (p.grade === grade ? r.same : 0);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  if (!best) return null;
  const via = best.points.filter(
    (q, i) => i > 0 && q.z > start.z + r.margin && q.z < target.z - r.margin,
  );
  if (via.length === 0) return null;
  used.add(best);
  return via;
}

/** A lift (`bottom` to `top`) leant onto the real lift of one of `kinds`
 * whose line passes nearest its two ends, each within `reach`, that no
 * other lift took: its top moved onto the real one's (at most `rise` up or
 * down the face, or left on its row where `keep.top` says — a top on the
 * summit ridge), its bottom onto the real one's, or — where `keep.bottom`
 * leaves it on its row (a bottom on the valley floor, below where most
 * real lifts start) — onto the real line carried on down to that row, no
 * further than `carry` m. Null where none is near. */
export function leanLift(
  hints: RealHints,
  used: Set<HintLift>,
  bottom: Point,
  top: Point,
  kinds: readonly HintLift["kind"][],
  r: HintReach & { readonly carry: number },
  keep: { readonly bottom: boolean; readonly top: boolean },
): { bottom: Point; top: Point } | null {
  const along = (l: HintLift, z: number): number | null => {
    const dz = l.bottom.z - l.top.z;
    if (dz <= 0 || z - l.bottom.z > r.carry) return null;
    return l.top.x + ((l.bottom.x - l.top.x) * (z - l.top.z)) / dz;
  };
  let best: { l: HintLift; xb: number } | null = null;
  let bestD = Infinity;
  for (const l of hints.lifts) {
    if (used.has(l) || !kinds.includes(l.kind)) continue;
    const xb = keep.bottom ? along(l, bottom.z) : l.bottom.x;
    if (xb === null) continue;
    const db = keep.bottom ? Math.abs(xb - bottom.x) : hypot(xb - bottom.x, l.bottom.z - bottom.z);
    const dt = hypot(l.top.x - top.x, l.top.z - top.z);
    if (db < r.reach && dt < r.reach && db + dt < bestD) {
      best = { l, xb };
      bestD = db + dt;
    }
  }
  if (!best) return null;
  used.add(best.l);
  const { l, xb } = best;
  const moved = (at: number, to: number): number =>
    at + Math.max(-r.rise, Math.min(r.rise, to - at));
  return {
    bottom: { x: xb, z: keep.bottom ? bottom.z : moved(bottom.z, l.bottom.z) },
    top: { x: l.top.x, z: keep.top ? top.z : moved(top.z, l.top.z) },
  };
}

/** Where a run at (`x`, `z`) steers to follow the real pistes: the nearest
 * point on any of them `ahead.min`–`ahead.max` m further down the face
 * and no more than `aside` m across from it (one of `grade` nearer by
 * `same` m), or null where no real piste is near. A pure function of the
 * hints, read a walk step at a time; the pistes' bends are kept bucketed
 * by their rows so a step reads only those near it. */
export function pisteAhead(
  hints: RealHints,
  grade: RunGrade | null,
  r: {
    readonly ahead: { readonly min: number; readonly max: number };
    readonly aside: number;
    readonly same: number;
  },
): (x: number, z: number) => Point | null {
  const ROW = 100;
  const rows = new Map<number, { a: Point; b: Point; mine: boolean }[]>();
  for (const p of hints.pistes) {
    for (let i = 1; i < p.points.length; i++) {
      const [a, b] = [p.points[i - 1], p.points[i]];
      const seg = { a, b, mine: p.grade === grade };
      const lo = Math.floor(Math.min(a.z, b.z) / ROW);
      const hi = Math.floor(Math.max(a.z, b.z) / ROW);
      for (let k = lo; k <= hi; k++) {
        const row = rows.get(k) ?? [];
        row.push(seg);
        rows.set(k, row);
      }
    }
  }
  return (x, z) => {
    let best: Point | null = null;
    let bestD = Infinity;
    const z0 = z + r.ahead.min;
    const z1 = z + r.ahead.max;
    const seen = new Set<object>();
    for (let k = Math.floor(z0 / ROW); k <= Math.floor(z1 / ROW); k++) {
      for (const s of rows.get(k) ?? []) {
        if (seen.has(s)) continue;
        seen.add(s);
        // The segment's stretch inside the rows ahead, its nearest point
        // across to the run.
        const dz = s.b.z - s.a.z;
        const t0 = dz === 0 ? 0 : Math.max(0, Math.min(1, (z0 - s.a.z) / dz));
        const t1 = dz === 0 ? 1 : Math.max(0, Math.min(1, (z1 - s.a.z) / dz));
        const [lo, hi] = [Math.min(t0, t1), Math.max(t0, t1)];
        const dx = s.b.x - s.a.x;
        const t = dx === 0 ? lo : Math.max(lo, Math.min(hi, (x - s.a.x) / dx));
        const p = { x: s.a.x + dx * t, z: s.a.z + dz * t };
        if (p.z < z0 - 1 || p.z > z1 + 1) continue;
        const d = Math.abs(p.x - x) - (s.mine ? r.same : 0);
        if (Math.abs(p.x - x) <= r.aside && d < bestD) {
          best = p;
          bestD = d;
        }
      }
    }
    return best;
  };
}

/** The real piste a run leaving `start` for `target` is laid on, whatever
 * its colour (the run takes the real one's): the one whose top is nearest
 * within `reach` and which falls `fall` of the way to the target's row, that
 * no other run took. A ski route (orange) is never one — the game finds
 * its own. Null where none is near. */
export function pisteFor(
  hints: RealHints,
  used: Set<HintPiste>,
  start: Point,
  target: Point,
  r: { readonly reach: number; readonly fall: number },
): HintPiste | null {
  let best: HintPiste | null = null;
  let bestD = r.reach;
  const drop = target.z - start.z;
  for (const p of hints.pistes) {
    if (used.has(p) || p.grade === "orange" || p.points.length < 3) continue;
    const top = p.points[0];
    if (p.points[p.points.length - 1].z - top.z < drop * r.fall) continue;
    const d = hypot(top.x - start.x, top.z - start.z);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  if (best) used.add(best);
  return best;
}

/** Where a run at (`x`, `z`) steers to stay on ONE real piste: the
 * nearest point of its line `ahead` m further down the face, no more than
 * `aside` m across — `pisteAhead` read on that piste alone. */
export function alongPiste(
  piste: HintPiste,
  r: { readonly ahead: { readonly min: number; readonly max: number }; readonly aside: number },
): (x: number, z: number) => Point | null {
  return pisteAhead(
    { lifts: [], pistes: [piste], houses: [], streets: [], town: null },
    piste.grade,
    { ...r, same: 0 },
  );
}

/** The real width of the pistes at (`x`, `z`), m: the width the map gives
 * at the nearest bend within `near` m, 0 where none is given. */
export function pisteWidth(hints: RealHints, near: number): (x: number, z: number) => number {
  const CELL = 50;
  const cells = new Map<number, { x: number; z: number; w: number }[]>();
  const key = (i: number, j: number): number => i * 4096 + j;
  for (const p of hints.pistes) {
    p.points.forEach((q, i) => {
      const w = p.widths[i];
      if (w <= 0) return;
      const k = key(Math.floor(q.x / CELL), Math.floor(q.z / CELL));
      const cell = cells.get(k) ?? [];
      cell.push({ x: q.x, z: q.z, w });
      cells.set(k, cell);
    });
  }
  return (x, z) => {
    const ci = Math.floor(x / CELL);
    const cj = Math.floor(z / CELL);
    let best = 0;
    let bestD = near;
    for (let i = ci - 1; i <= ci + 1; i++) {
      for (let j = cj - 1; j <= cj + 1; j++) {
        for (const q of cells.get(key(i, j)) ?? []) {
          const d = hypot(q.x - x, q.z - z);
          if (d < bestD) {
            best = q.w;
            bestD = d;
          }
        }
      }
    }
    return best;
  };
}

/** The colour a run is BILLED: the colour of the real piste it was laid on
 * where it measures within `RR.massif.real.least.signed` colours of it (a
 * real ski area signs a run by more than its steepest pitch), else the
 * colour it measures. A run on no real piste is billed what it measures. */
export function billedColour(signed: PisteGrade | undefined, measured: PisteGrade): PisteGrade {
  if (!signed) return measured;
  const off = Math.abs(PISTE_GRADES.indexOf(signed) - PISTE_GRADES.indexOf(measured));
  return off <= RR.massif.real.least.signed ? signed : measured;
}
