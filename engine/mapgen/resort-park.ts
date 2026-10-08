// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R20 ON A SKI AREA — THE TERRAIN PARK laid down a resort's course, the one
// a map built for a tricks run is ridden on. The park is the single piste's
// (`trick-field.ts`): the same three sizes in turn, the same gaps, the same
// lead off the start and the finish; what differs is the line it is laid
// down. The park is planned FIRST, keeping clear of the course's own kickers
// and the drops across it (R9, R24), and the course's gates are set round
// it (`courseGates`), as they are set round a drop.
//
// STAMPED ONTO A COPY of the ground: a ski area's mountain is built once and
// raced on any of its courses (`buildResort`'s cache), so the park dug into
// one course's map must never reach the next course's. The trees it moves
// the ground under are taken off as the single piste's are, and the course's
// stations are read back off the stamped ground.
//
// Nothing here draws from a stream, so asking for the park moves nothing a
// map built without one is.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { debug } from "@niclaslindstedt/oss-game-framework/core/output";
import { sampleField } from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { queriesOf } from "./compile.ts";
import { trackPointAt } from "./query.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import { startGateArc } from "./spawn.ts";
import { planTrickField, stampTrickField, type Corridor, type ParkLine } from "./trick-field.ts";
import type {
  Checkpoint,
  Cliff,
  Drift,
  GeneratedLevel,
  Kicker,
  TrackPoint,
  TreeDef,
} from "./types.ts";

/** How far a tree's foot may move under the park before it is taken off,
 * m — the single piste's rule (`generate.ts`). */
const TREE_SHIFT = 0.25;

/** R20 — the park down a course and the course's gates set round it:
 * planned first, clear of the course's own kickers, its drops and its
 * drifts (R9, R24, R17), each run-out far enough from the next ramp for a
 * gate to stand between them or two; then the gates set (`gatesFor`, the
 * course's own `courseGates` with the park's kickers as zones) and any
 * kicker the gates could not be set round dropped, until they stand. An
 * empty park where too few are left (R20's least). */
export function parkCourse(
  line: ParkLine,
  onCourse: readonly Kicker[],
  drops: readonly Cliff[],
  drifts: readonly Drift[],
  gatesFor: (park: readonly Kicker[]) => Checkpoint[],
): { field: Kicker[]; checkpoints: Checkpoint[] } {
  const F = R.trick;
  const G = RR.course.gates.spacing;
  const slot = F.gateClear.before + F.gateClear.after + 2;
  const fade = R.drift.fade;
  const planned = planTrickField(line, onCourse, drops, {
    gates: [startGateArc(), line.length],
    avoid: drifts.map((d) => [d.from - fade, d.to + fade] as [number, number]),
    apart: (gap) => (gap >= slot && gap <= slot + 14) || gap >= slot + G.min + 8,
  });
  if (typeof planned === "string") {
    debug(planned);
    return { field: [], checkpoints: gatesFor([]) };
  }
  let field = planned;
  for (let round = 0; round < 8 && field.length >= F.count.min; round++) {
    const checkpoints = gatesFor(field);
    const bad = new Set<Kicker>();
    const span = (k: Kicker): [number, number] => [
      (k.s ?? 0) - k.ramp - F.gateClear.before,
      (k.s ?? 0) + k.landing + F.gateClear.after,
    ];
    for (const k of field) {
      const [from, to] = span(k);
      const foot = (k.s ?? 0) - k.ramp;
      let before: Checkpoint | null = null;
      for (const g of checkpoints) {
        if (g.s > from + 1 && g.s < to - 1) bad.add(k);
        if (g.s <= from + 1 && (!before || g.s > before.s)) before = g;
      }
      if (before && before.y - lineY(line, foot) < F.runIn * k.height) bad.add(k);
    }
    for (let i = 0; i + 1 < checkpoints.length; i++) {
      const a = checkpoints[i].s;
      const b = checkpoints[i + 1].s;
      if (b - a >= G.min - 0.5 && b - a <= G.max + 0.5) continue;
      for (const k of field) {
        const [from, to] = span(k);
        if (from < b + G.max && to > a - G.max) bad.add(k);
      }
    }
    if (bad.size === 0) return { field, checkpoints };
    field = field.filter((k) => !bad.has(k));
  }
  debug(`only ${field.length} park kicker(s) stand among the course's gates (R20)`);
  return { field: [], checkpoints: gatesFor([]) };
}

/** The line's height at arc `s`, off its stations. */
function lineY(line: ParkLine, s: number): number {
  return trackPointAt({ track: line }, s).y;
}

/** `level` with its planned park stamped into a copy of its ground, the
 * trees it moved taken off and the course read back off the new ground. */
export function stampPark(level: GeneratedLevel, field: readonly Kicker[]): GeneratedLevel {
  const ground = { ...level.ground, data: level.ground.data.slice() };
  const line = { points: level.track.points, length: level.track.length };
  stampTrickField(ground, field, corridorOf(line.points, ground), line);
  const points = line.points.map((p) => ({ ...p, y: sampleField(ground, p.x, p.z) }));
  const trees: TreeDef[] = [];
  for (const t of level.trees) {
    const y = sampleField(ground, t.x, t.z);
    if (Math.abs(y - t.y) > TREE_SHIFT) continue;
    trees.push(y === t.y ? t : { ...t, y });
  }
  return {
    ...level,
    ground,
    ...queriesOf(ground, level.packed),
    track: { ...level.track, points },
    trees,
  };
}

/** The park's reach round a course: per cell of the ground's grid, the
 * station starting the nearest segment, how far along it and the distance
 * to the centreline — out to the widest half-width, the windrow's toe and
 * the park's fade (`stampTrickField` reads nothing further). */
function corridorOf(pts: readonly TrackPoint[], ground: GeneratedLevel["ground"]): Corridor {
  const { cols, rows, cell } = ground;
  const cells = cols * rows;
  const dist = new Float32Array(cells).fill(Infinity);
  const near = new Int32Array(cells).fill(-1);
  const along = new Float32Array(cells);
  let widest = 0;
  for (const p of pts) widest = Math.max(widest, p.width);
  const reach = widest / 2 + R.track.shoulder.flat + R.berm.width + R.trick.edge;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len2 = dx * dx + dz * dz || 1;
    const c0 = Math.max(0, Math.floor((Math.min(a.x, b.x) - reach - ground.originX) / cell));
    const c1 = Math.min(cols - 1, Math.ceil((Math.max(a.x, b.x) + reach - ground.originX) / cell));
    const r0 = Math.max(0, Math.floor((Math.min(a.z, b.z) - reach - ground.originZ) / cell));
    const r1 = Math.min(rows - 1, Math.ceil((Math.max(a.z, b.z) + reach - ground.originZ) / cell));
    for (let r = r0; r <= r1; r++) {
      const z = ground.originZ + r * cell;
      for (let c = c0; c <= c1; c++) {
        const x = ground.originX + c * cell;
        let t = ((x - a.x) * dx + (z - a.z) * dz) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const d = hypot(x - (a.x + dx * t), z - (a.z + dz * t));
        const o = r * cols + c;
        if (d < dist[o] && d <= reach) {
          dist[o] = d;
          near[o] = i;
          along[o] = t;
        }
      }
    }
  }
  return { near, along, dist };
}
