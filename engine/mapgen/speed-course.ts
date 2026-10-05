// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SPEED EVENT'S COURSE — what a downhill (R32) and a super-G (R33) share
// once set over a built map: the RACING LINE relaxed out of the piste's
// centreline to bend the least inside its edges (`racingLine`), the one
// reader of the line as set (`speedLineAt` — its offset and its signed
// bend), and the SPEED TRAP's place (`trapArc`). Which course a map
// carries is one question (`speedCourseOf`), asked by the nets, the trap,
// the bot and the par alike. Everything is a pure function of the map,
// drawing nothing from any stream.

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { trackPointAt } from "./query.ts";
import type { Level, SpeedCourse, TrackPoint } from "./types.ts";

/** The speed course set on `level` — a downhill's or a super-G's — or null
 * on a map with neither. */
export function speedCourseOf(level: Level): SpeedCourse | null {
  return level.downhill ?? level.superG ?? null;
}

/** How a racing line is laid (a discipline rule's `line` row): a station
 * every `step` m, kept `margin` m inside the piste's edges — and, where the
 * row says, never more than `most` m off its centreline — the room it is
 * held in opening and closing no faster than `ease` m a metre, relaxed over
 * `passes` at each of the `strides`, coarse to fine. */
export type LineRule = {
  readonly step: number;
  readonly margin: number;
  readonly most?: number;
  readonly ease: number;
  readonly passes: number;
  readonly strides: readonly number[];
};

/** What a speed trap is placed by (a discipline rule's `trap` row). */
export type TrapRule = {
  readonly run: number;
  readonly straight: number;
  readonly span: number;
  readonly late: number;
  readonly end: number;
};

const pa: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const pb: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };

/** The piste's signed bend at arc `s`, 1/m, over `span` m either side —
 * positive turning to the skier's right. */
export function pisteBendAt(level: Level, s: number, span: number): number {
  trackPointAt(level, s - span, pa);
  trackPointAt(level, s + span, pb);
  return angleDiff(pa.heading, pb.heading) / (2 * span);
}

/** THE SPEED TRAP's arc: where the piste has fallen the most over the
 * `T.run` metres before it, on a straight, late in the course. */
export function trapArc(level: Level, from: number, to: number, T: TrapRule): number {
  const lo = from + (to - from) * T.late;
  const hi = to - T.end;
  let best = hi;
  let most = -Infinity;
  for (const straight of [true, false]) {
    for (let s = Math.max(lo, from + T.run); s <= hi; s += 2) {
      if (straight) {
        let bent = false;
        for (let u = s - T.span; u <= s + T.span; u += 10) {
          if (Math.abs(pisteBendAt(level, u, 10)) > 1 / T.straight) {
            bent = true;
            break;
          }
        }
        if (bent) continue;
      }
      const fall = trackPointAt(level, s - T.run, pa).y - trackPointAt(level, s, pb).y;
      if (fall > most) {
        most = fall;
        best = s;
      }
    }
    if (most > -Infinity) break;
  }
  return best;
}

/** THE RACING LINE from `from` to `to`: how far right of the piste's
 * centreline it stands at each station `L.step` m apart, m. It starts and
 * ends on the centreline (the house and the finish) and between them bends
 * as little as the piste lets it, held `L.margin` m inside its edges: each
 * station drawn to the midpoint of its neighbours a stride either side,
 * coarse strides first so a long bend is straightened as one and the short
 * ones last. */
export function racingLine(level: Level, from: number, to: number, L: LineRule): Float64Array {
  const n = Math.max(2, Math.floor((to - from) / L.step) + 1);
  const cx = new Float64Array(n);
  const cz = new Float64Array(n);
  const rx = new Float64Array(n);
  const rz = new Float64Array(n);
  const room = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const p = trackPointAt(level, from + i * L.step, pa);
    cx[i] = p.x;
    cz[i] = p.z;
    rx[i] = Math.cos(p.heading);
    rz[i] = -Math.sin(p.heading);
    room[i] = Math.max(0, p.width / 2 - L.margin);
    if (L.most !== undefined) room[i] = Math.min(room[i], L.most);
  }
  // The room opens and closes gradually, up the piste and down it.
  const ease = L.ease * L.step;
  for (let i = 1; i < n; i++) room[i] = Math.min(room[i], room[i - 1] + ease);
  for (let i = n - 2; i >= 0; i--) room[i] = Math.min(room[i], room[i + 1] + ease);
  const o = new Float64Array(n);
  for (const k of L.strides) {
    if (k >= n - 1) continue;
    for (let pass = 0; pass < L.passes; pass++) {
      for (let i = 1; i < n - 1; i++) {
        const a = Math.max(0, i - k);
        const b = Math.min(n - 1, i + k);
        const mx = (cx[a] + rx[a] * o[a] + cx[b] + rx[b] * o[b]) / 2;
        const mz = (cz[a] + rz[a] * o[a] + cz[b] + rz[b] * o[b]) / 2;
        const t = (mx - cx[i]) * rx[i] + (mz - cz[i]) * rz[i];
        o[i] = clamp(t, -room[i], room[i]);
      }
    }
  }
  return o;
}

/** The line's offset `at` m down the piste, off its stations from `from`
 * `step` m apart. */
export function lineOffset(
  line: ArrayLike<number>,
  from: number,
  at: number,
  step: number,
): number {
  const f = clamp((at - from) / step, 0, line.length - 1);
  const i = Math.min(line.length - 2, Math.floor(f));
  return line[i] + (line[i + 1] - line[i]) * (f - i);
}

/** The step every speed course's line is laid at, m — the downhill's and
 * the super-G's rule rows both say it, and `tests/super_g_test.ts` holds
 * them to this. */
export const LINE_STEP = 4;

/** How far either side the line's bend is read over, m. */
const BEND_SPAN = 8;
type LineTable = { from: number; offset: Float64Array; bend: Float64Array };
const tables = new WeakMap<Level, LineTable | null>();

function lineTable(level: Level): LineTable | null {
  if (tables.has(level)) return tables.get(level) ?? null;
  const course = speedCourseOf(level);
  let table: LineTable | null = null;
  if (course && course.line.length >= 3) {
    const n = course.line.length;
    const offset = new Float64Array(n);
    const px = new Float64Array(n);
    const pz = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const { s, x } = course.line[i];
      const p = trackPointAt(level, s, pa);
      offset[i] = x;
      px[i] = p.x + Math.cos(p.heading) * x;
      pz[i] = p.z - Math.sin(p.heading) * x;
    }
    // The line's heading change over BEND_SPAN either side, per metre:
    // positive turning to the skier's right.
    const k = Math.max(1, Math.round(BEND_SPAN / LINE_STEP));
    const bend = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - k);
      const b = Math.min(n - 1, i + k);
      if (a === i || b === i) continue;
      const h0 = Math.atan2(px[i] - px[a], pz[i] - pz[a]);
      const h1 = Math.atan2(px[b] - px[i], pz[b] - pz[i]);
      bend[i] = angleDiff(h0, h1) / (((b - a) * LINE_STEP) / 2);
    }
    table = { from: course.line[0].s, offset, bend };
  }
  tables.set(level, table);
  return table;
}

const lineOut = { offset: 0, bend: 0 };

/** THE RACING LINE `s` metres down a speed course's piste (R32, R33): how
 * far right of the centreline, m, and how sharply it turns there, 1/m,
 * signed (positive to the right) — read over a few metres either side.
 * Null on a map with no speed course. The object is reused: read it before
 * the next call. */
export function speedLineAt(level: Level, s: number): { offset: number; bend: number } | null {
  const t = lineTable(level);
  if (!t) return null;
  const f = clamp((s - t.from) / LINE_STEP, 0, t.offset.length - 1);
  const i = Math.min(t.offset.length - 2, Math.floor(f));
  const u = f - i;
  lineOut.offset = t.offset[i] + (t.offset[i + 1] - t.offset[i]) * u;
  lineOut.bend = t.bend[i] + (t.bend[i + 1] - t.bend[i]) * u;
  return lineOut;
}

/** How a speed course's gates are spaced down the piste, m. */
export type SpacingRule = { readonly min: number; readonly max: number; readonly target: number };

/** The arcs of the gates between the start gate at `from` and the finish
 * at `to`: as near `G.target` apart as divides the piste, each stepped off
 * a jump's take-off and landing — no gate within `clear` metres of one —
 * inside the spacing's band. */
export function gateArcs(
  from: number,
  to: number,
  jumps: readonly number[],
  G: SpacingRule,
  clear: number,
): number[] {
  const near = (at: number): number | undefined =>
    jumps.find((j) => at > j - clear && at < j + clear);
  const arcs: number[] = [];
  for (let prev = from; ;) {
    const left = to - prev;
    if (left <= G.max) break;
    let at = prev + left / Math.max(1, Math.round(left / G.target));
    const j = near(at);
    if (j !== undefined) {
      const fits = [j - clear, j + clear].filter(
        (a) => a >= prev + G.min && a <= prev + G.max && to - a >= G.min,
      );
      fits.sort((a, b) => Math.abs(a - at) - Math.abs(b - at));
      at = fits[0] ?? at;
    }
    arcs.push(at);
    prev = at;
  }
  return arcs;
}
