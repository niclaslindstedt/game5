// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R32 — A DOWNHILL SET OVER A BUILT MAP. The map is the mountain and stays
// it; a downhill is raced down the WHOLE of its piste, from the start gate
// under the summit station to the finish line in the village — the
// longest, fastest course the game sets. What it sets over the map is the
// course: a start house over the top of the piste, the SPEED GATES down it
// (four poles and two red panels, set to mark the line rather than to make
// the turns), the A-NETS along both its edges, the SPEED TRAP and the
// intermediate timing points — and what the organisers prepare for it,
// as for a slalom (`course-prep.ts`): the kickers levelled, the snow
// groomed hard and combed of its short lips, the trees cut.
//
// WHICH COURSE: a ski area has a course down from every top station
// (R28); a downhill is raced on the one with the most vertical
// (`downhillCourseOf`), which on a mountain with a black is the black
// from under the summit to the village — some 2.7–3.2 km over 900–1100 m,
// a men's downhill's band.
//
// THE LINE COMES FIRST, the gates after it: a downhill's racing line is
// the line down the piste that bends the least — inside every bend's apex,
// across the piste between two bends, straight over a jump — kept a gate's
// half-width inside the piste's edges, and its gates MARK it, a speed gate
// centred on it about every eighty metres (the measured median), none on a
// jump. The line is relaxed out of the centreline coarse to fine (`line`),
// so a long bend is read as one. Everything is a pure function of the map,
// drawing nothing from any stream — so no digest moves and a
// restart stands on the very course it left.

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { clearedTrees, prepareCourse } from "./course-prep.ts";
import { DISCIPLINE_RULES } from "./discipline-rules.ts";
import { trackPointAt } from "./query.ts";
import type { Checkpoint, DownhillCourse, Level, Spawn, TrackPoint } from "./types.ts";

const D = DISCIPLINE_RULES.downhill;

/** R32 — THE COURSE A DOWNHILL IS RACED ON: the id of the ski area's course
 * (R28) with the most vertical — the one inside the rule's band first,
 * where the area has one — or null on a map that is not a ski area. */
export function downhillCourseOf(level: Level): string | null {
  const courses = level.resort?.courses ?? [];
  let best: { id: string; drop: number; fits: boolean } | null = null;
  for (const c of courses) {
    const fits = c.drop >= D.vertical.min && c.drop <= D.vertical.max;
    if (
      !best ||
      (fits && !best.fits) ||
      (fits === best.fits && (c.drop > best.drop || (c.drop === best.drop && c.id < best.id)))
    ) {
      best = { id: c.id, drop: c.drop, fits };
    }
  }
  return best?.id ?? null;
}

const pa: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
const pb: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };

/** The piste's signed bend at arc `s`, 1/m, over `span` m either side —
 * positive turning to the skier's right. */
function bendAt(level: Level, s: number, span: number): number {
  trackPointAt(level, s - span, pa);
  trackPointAt(level, s + span, pb);
  return angleDiff(pa.heading, pb.heading) / (2 * span);
}

/** The arcs of the gates between the start gate at `from` and the finish
 * at `to`: as near `spacing.target` apart as divides the piste, each
 * stepped off a jump's take-off and landing inside the spacing's band. */
function gateArcs(from: number, to: number, jumps: readonly number[]): number[] {
  const G = D.spacing;
  const near = (at: number): number | undefined =>
    jumps.find((j) => at > j - D.jump && at < j + D.jump);
  const arcs: number[] = [];
  for (let prev = from; ;) {
    const left = to - prev;
    if (left <= G.max) break;
    let at = prev + left / Math.max(1, Math.round(left / G.target));
    const j = near(at);
    if (j !== undefined) {
      const fits = [j - D.jump, j + D.jump].filter(
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

/** R32 — THE SPEED TRAP's arc: where the piste has fallen the most over the
 * `trap.run` metres before it, on a straight, late in the course. */
function trapArc(level: Level, from: number, to: number): number {
  const T = D.trap;
  const lo = from + (to - from) * T.late;
  const hi = to - T.end;
  let best = hi;
  let most = -Infinity;
  for (const straight of [true, false]) {
    for (let s = Math.max(lo, from + T.run); s <= hi; s += 2) {
      if (straight) {
        let bent = false;
        for (let u = s - T.span; u <= s + T.span; u += 10) {
          if (Math.abs(bendAt(level, u, 10)) > 1 / T.straight) {
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

/** R32 — THE RACING LINE from `from` to `to`: how far right of the
 * piste's centreline it stands at each station `line.step` m apart, m. It
 * starts and ends on the centreline (the house and the finish) and between
 * them bends as little as the piste lets it, held `line.margin` m inside
 * its edges: each station drawn to the midpoint of its neighbours a stride
 * either side, coarse strides first so a long bend is straightened as one
 * and the short ones last. */
function racingLine(level: Level, from: number, to: number): Float64Array {
  const L = D.line;
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

/** The line's offset `at` m down the piste, off its stations from `from`. */
function lineOffset(line: ArrayLike<number>, from: number, at: number): number {
  const f = clamp((at - from) / D.line.step, 0, line.length - 1);
  const i = Math.min(line.length - 2, Math.floor(f));
  return line[i] + (line[i + 1] - line[i]) * (f - i);
}

/** How far either side the line's bend is read over, m. */
const BEND_SPAN = 8;
type LineTable = { from: number; offset: Float64Array; bend: Float64Array };
const tables = new WeakMap<Level, LineTable | null>();

function lineTable(level: Level): LineTable | null {
  if (tables.has(level)) return tables.get(level) ?? null;
  const dh = level.downhill;
  let table: LineTable | null = null;
  if (dh && dh.line.length >= 3) {
    const n = dh.line.length;
    const offset = new Float64Array(n);
    const px = new Float64Array(n);
    const pz = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const { s, x } = dh.line[i];
      const p = trackPointAt(level, s, pa);
      offset[i] = x;
      px[i] = p.x + Math.cos(p.heading) * x;
      pz[i] = p.z - Math.sin(p.heading) * x;
    }
    // The line's heading change over BEND_SPAN either side, per metre:
    // positive turning to the skier's right.
    const k = Math.max(1, Math.round(BEND_SPAN / D.line.step));
    const bend = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - k);
      const b = Math.min(n - 1, i + k);
      if (a === i || b === i) continue;
      const h0 = Math.atan2(px[i] - px[a], pz[i] - pz[a]);
      const h1 = Math.atan2(px[b] - px[i], pz[b] - pz[i]);
      bend[i] = angleDiff(h0, h1) / (((b - a) * D.line.step) / 2);
    }
    table = { from: dh.line[0].s, offset, bend };
  }
  tables.set(level, table);
  return table;
}

const lineOut = { offset: 0, bend: 0 };

/** THE RACING LINE `s` metres down a downhill's piste (R32): how far right
 * of the centreline, m, and how sharply it turns there, 1/m, signed
 * (positive to the right) — read over a few metres either side. Null on a
 * map with no downhill. The object is reused: read it before the next
 * call. */
export function downhillLineAt(level: Level, s: number): { offset: number; bend: number } | null {
  const t = lineTable(level);
  if (!t) return null;
  const f = clamp((s - t.from) / D.line.step, 0, t.offset.length - 1);
  const i = Math.min(t.offset.length - 2, Math.floor(f));
  const u = f - i;
  lineOut.offset = t.offset[i] + (t.offset[i + 1] - t.offset[i]) * u;
  lineOut.bend = t.bend[i] + (t.bend[i + 1] - t.bend[i]) * u;
  return lineOut;
}

const set = new WeakMap<Level, Level>();

/** R32 — A DOWNHILL SET OVER `level`: its whole piste as a downhill course,
 * as a map whose checkpoints are its gates and whose spawn is the start
 * house. A map that already carries a downhill is that map; one carrying a
 * slalom is set over the map under it. Kept per map, so a restart or a
 * replay stands on the course the renderer already built. The course keeps
 * the day and the sky of the map it was set over. */
export function setDownhill(level: Level): Level {
  if (level.downhill) return level;
  const original = level.slalom?.base ?? level;
  let course = set.get(original);
  if (!course) {
    course = courseOver(original);
    set.set(original, course);
  }
  return course.sun === level.sun && course.weather === level.weather
    ? course
    : { ...course, sun: level.sun, weather: level.weather };
}

/** The downhill set over `original`, a map with no course on it. */
function courseOver(original: Level): Level {
  const L = original.track.length;
  const from = original.checkpoints[0]?.s ?? 0;
  const to = L;
  const stretch = { from, to };
  const base = prepareCourse(original, stretch, D);
  // The jumps the course keeps: its drops (R24), by arc.
  const jumps = (base.cliffs ?? [])
    .filter((c) => c.onTrack && c.s !== undefined && c.s > from && c.s < to)
    .map((c) => c.s ?? 0)
    .sort((a, b) => a - b);
  const line = racingLine(base, from, to);
  const offsetAt = (at: number): number => lineOffset(line, from, at);
  const arcs = gateArcs(from, to, jumps);
  const checkpoints: Checkpoint[] = [];
  const startAt = trackPointAt(base, from);
  checkpoints.push({
    x: startAt.x,
    z: startAt.z,
    y: startAt.y,
    heading: startAt.heading,
    width: 2,
    s: from,
    colour: "red",
  });
  for (const at of arcs) {
    const p = trackPointAt(base, at);
    const offset = offsetAt(at);
    const x = p.x + Math.cos(p.heading) * offset;
    const z = p.z - Math.sin(p.heading) * offset;
    checkpoints.push({
      x,
      z,
      y: base.groundAt(x, z),
      heading: p.heading,
      width: D.width,
      s: at,
      colour: "red",
      offset,
      span: p.width,
      panels: true,
    });
  }
  const finishAt = trackPointAt(base, to);
  checkpoints.push({
    x: finishAt.x,
    z: finishAt.z,
    y: finishAt.y,
    heading: finishAt.heading,
    width: Math.max(D.finishWidth, finishAt.width + 6),
    s: to,
    colour: "red",
  });
  const house = trackPointAt(base, from - D.stand);
  const spawn: Spawn = { x: house.x, z: house.z, heading: startAt.heading };
  const trapS = trapArc(base, from, to);
  const trapAt = trackPointAt(base, trapS);
  const downhill: DownhillCourse = {
    base: original,
    from,
    to,
    vertical: startAt.y - finishAt.y,
    trap: {
      s: trapS,
      x: trapAt.x,
      z: trapAt.z,
      heading: trapAt.heading,
      width: trapAt.width + 2 * D.nets.gap,
    },
    nets: { gap: D.nets.gap, height: D.nets.height, from: from - D.stand - 6, to: to - 10 },
    jumps,
    line: Array.from(line, (x, i) => ({ s: from + i * D.line.step, x })),
  };
  return {
    ...base,
    checkpoints,
    spawn,
    grid: [spawn],
    trees: clearedTrees(base, stretch, D),
    downhill,
  };
}
