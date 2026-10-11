// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R29, R30 — THE HUB AND ITS WIND TUNNELS: the foot of the mountain, where
// every run that reaches the valley floor ends and the valley's bottom
// stations stand, laid once the runs are walked.
//
// A ski area's foot is not a clearing round the village: it is the open,
// groomed snow along the bottom of the face that every finish runs out into
// and every valley lift leaves from — where a skier comes down one sector
// and crosses to the lift of another. So the hub is a BAND across the floor:
// from past the outermost finish or bottom station on one side to past the
// outermost on the other, its lower edge out over the flat floor, its upper
// edge where the ground starts to rise into the face (but always above
// every finish and every station), eased along x so it reads as one sweep
// of open snow. The woods thin into it over a fringe whose line wanders, so
// its edge is a forest's edge and not a ruled line.
//
// Along it, below every finish, run the two WIND TUNNELS (R30): straight
// lines across the floor from the station or finish at one end of the hub
// to the one at the other, one each way, so a skier who came down at one
// end is blown to the lifts at the other without skiing a metre.
//
// Pure functions of the walked runs and the untouched mountain, drawing
// nothing from any stream.

import { smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { valueNoise } from "@niclaslindstedt/oss-game-framework/core/noise";
import { outsideHub } from "./query.ts";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import type { TerrainPlan } from "./terrain.ts";
import type { Hub, WindTunnel } from "./types.ts";

/** A place on the floor the hub must hold: a finish's end, or a valley
 * bottom station. */
export type FloorPoint = { x: number; z: number };

/** The hub and the two lines its tunnels run along, z on the map. */
export type HubPlan = { hub: Hub; lanes: [number, number]; from: number; to: number };

/** R29 — lay the hub round the floor's finishes and bottom stations, with
 * room below them for the tunnels (R30). */
export function planHub(
  plan: TerrainPlan,
  ground: Heightfield,
  floor: readonly FloorPoint[],
  seed: number,
): HubPlan {
  const H = RR.hub;
  const T = RR.tunnel;
  const cx = plan.size / 2;
  const inner = (plan.flankBand ?? RR.massif.flank).inner - 40;
  let minX = Infinity;
  let maxX = -Infinity;
  let lowest = plan.baseZ;
  for (const p of floor) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    lowest = Math.max(lowest, p.z);
  }
  if (!Number.isFinite(minX)) {
    minX = cx;
    maxX = cx;
  }
  // On a REAL FACE the village stands below the real town (`massif.ts`), so
  // a station beside it may stand past the side ridges' inner edge; the
  // tunnels are kept inside the band the hub is (a dealt map's stations
  // never stand out there).
  if (plan.face) {
    minX = Math.max(cx - inner + H.step, Math.min(cx + inner - H.step, minX));
    maxX = Math.max(cx - inner + H.step, Math.min(cx + inner - H.step, maxX));
  }
  // The tunnels never shorter than `tunnel.length`: a hub whose stations
  // stand close together is still crossed end to end.
  const short = T.length - (maxX - minX);
  if (short > 0) {
    minX = Math.max(cx - inner + H.step, minX - short / 2);
    maxX = Math.min(cx + inner - H.step, minX + T.length);
  }
  // The tunnels' two lines, below the lowest finish; the band's lower edge
  // below the outer one.
  const lane1 = lowest + T.under;
  const lane2 = lane1 + T.gap;
  const least = lane2 + T.width / 2 + H.inside;
  const x0 = Math.floor(Math.max(cx - inner, minX - H.reach) / H.step) * H.step;
  const x1 = Math.ceil(Math.min(cx + inner, maxX + H.reach) / H.step) * H.step;
  const n = Math.max(2, Math.round((x1 - x0) / H.step) + 1);
  const xs = Array.from({ length: n }, (_, i) => x0 + i * H.step);
  // The lower edge out over the floor, wandering a little along it, never
  // inside the outer tunnel.
  const bottoms = xs.map((x) =>
    Math.max(least, plan.baseZ + H.below + H.wander * (2 * valueNoise(x, 0, H.ease, seed) - 1)),
  );
  // The upper edge as the ground has it: walked up from the floor until it
  // has risen `rise`, within the depth's band.
  const contour = xs.map((x, i) => {
    const bottom = bottoms[i];
    const floorY = sampleField(ground, x, bottom);
    let z = bottom - H.depth.min;
    while (z > bottom - H.depth.max && sampleField(ground, x, z) - floorY < H.rise) z -= 5;
    // Closing at its two ends, so the band ends in the woods' curve.
    const end = Math.min(x - x0, x1 - x);
    const open = H.depth.min + (H.depth.max - H.depth.min) * smoothstep(0, H.reach, end);
    return Math.max(z, bottom - open);
  });
  // ...but above every finish and station near this column.
  const half = H.ease / 2;
  const need = xs.map((x) => {
    let z = Infinity;
    for (const p of floor) if (Math.abs(p.x - x) <= half + H.step) z = Math.min(z, p.z - H.margin);
    return z;
  });
  const raw = contour.map((z, i) => Math.min(z, need[i]));
  const k = Math.max(1, Math.round(half / H.step));
  const top = raw.map((_, i) => {
    let sum = 0;
    let w = 0;
    for (let j = Math.max(0, i - k); j <= Math.min(n - 1, i + k); j++) {
      sum += raw[j];
      w++;
    }
    return Math.max(bottoms[i] - H.depth.max, Math.min(sum / w, need[i], bottoms[i] - H.depth.min));
  });
  return {
    hub: { x0, step: H.step, top, bottom: bottoms },
    lanes: [lane1, lane2],
    from: minX,
    to: maxX,
  };
}

/** R29 — whether the woods leave a plan point open for the hub: inside it,
 * or in its fringe where the wandering edge of the woods has not reached. */
export function hubClear(hub: Hub, seed: number, x: number, z: number): boolean {
  const d = outsideHub(hub, x, z);
  if (d === 0) return true;
  if (d >= RR.hub.fringe) return false;
  return d < RR.hub.fringe * valueNoise(x, z, EDGE_SCALE, seed);
}

/** The wavelength the woods' edge wanders over along the hub, m. */
const EDGE_SCALE = 45;

/** R29 — groom the hub: the packed share 1 over the band, faded out past
 * its edge. */
export function groomHub(hub: Hub, packed: Heightfield): void {
  const cell = packed.cell;
  const x1 = hub.x0 + hub.step * (hub.top.length - 1);
  const z0 = Math.min(...hub.top) - RR.hub.fade;
  const z1 = Math.max(...hub.bottom) + RR.hub.fade;
  const c0 = Math.max(0, Math.floor((hub.x0 - RR.hub.fade) / cell));
  const c1 = Math.min(packed.cols - 1, Math.ceil((x1 + RR.hub.fade) / cell));
  const r0 = Math.max(0, Math.floor(z0 / cell));
  const r1 = Math.min(packed.rows - 1, Math.ceil(z1 / cell));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const d = outsideHub(hub, c * cell, r * cell);
      const groom = 1 - smoothstep(0, RR.hub.fade, d);
      const i = r * packed.cols + c;
      if (groom > packed.data[i]) packed.data[i] = groom;
    }
  }
}

/** How far either side of a tunnel's width its bed is eased into the
 * floor, m; how many stations either way a pass of the bed's smoothing
 * averages over, and the most passes. */
const BED_EASE = 10;
const BED_REACH = 8;
const BED_PASSES = 12;

/** R30 — the two wind tunnels along the hub: W1 from the station or finish
 * at its one end to the one at its other along the upper line, W2 back
 * along the lower — each a line of stations every `tunnel.step` metres on
 * a BED graded into the floor (the floor's folds smoothed out of it until
 * it falls nowhere steeper than a little inside `tunnel.grade`), entrance
 * to exit. Presses `ground`. */
export function layTunnels(h: HubPlan, ground: Heightfield): WindTunnel[] {
  const T = RR.tunnel;
  const line = (id: string, z: number, from: number, to: number): WindTunnel => {
    const length = Math.abs(to - from);
    const n = Math.max(1, Math.round(length / T.step));
    const dir = Math.sign(to - from) || 1;
    const heading = Math.atan2(dir, 0);
    const xs = Array.from({ length: n + 1 }, (_, i) => from + (dir * (i * length)) / n);
    const bed = bedOf(
      xs.map((x) => sampleField(ground, x, z)),
      length / n,
    );
    pressBed(ground, xs, bed, z);
    const points = xs.map((x, i) => ({
      x,
      z,
      y: sampleField(ground, x, z),
      s: (i * length) / n,
      heading,
    }));
    return { id, points, length, width: T.width, speed: T.speed };
  };
  return [line("W1", h.lanes[0], h.from, h.to), line("W2", h.lanes[1], h.to, h.from)];
}

/** A tunnel's bed: the floor under its stations, smoothed pass by pass
 * until no window of it falls steeper than seven tenths of
 * `tunnel.grade`. */
function bedOf(raw: readonly number[], step: number): number[] {
  const T = RR.tunnel;
  const k = Math.max(1, Math.round(T.window / step));
  let ys = raw.slice();
  const steepest = (v: readonly number[]): number => {
    let m = 0;
    for (let i = 0; i + k < v.length; i++) m = Math.max(m, Math.abs(v[i + k] - v[i]) / (k * step));
    return m;
  };
  for (let pass = 0; pass < BED_PASSES && steepest(ys) > T.grade * 0.7; pass++) {
    ys = ys.map((_, i) => {
      let sum = 0;
      let w = 0;
      for (let j = Math.max(0, i - BED_REACH); j <= Math.min(ys.length - 1, i + BED_REACH); j++) {
        sum += ys[j];
        w++;
      }
      return sum / w;
    });
  }
  return ys;
}

/** Press a tunnel's bed into the floor: the ground across its width (and
 * a little) set to the bed, eased back into the floor over `BED_EASE`
 * either side and past either end. */
function pressBed(
  ground: Heightfield,
  xs: readonly number[],
  bed: readonly number[],
  z: number,
): void {
  const half = RR.tunnel.width / 2 + 2;
  const reach = half + BED_EASE;
  const x0 = Math.min(xs[0], xs[xs.length - 1]);
  const x1 = Math.max(xs[0], xs[xs.length - 1]);
  const step = (x1 - x0) / Math.max(1, xs.length - 1);
  const asc = xs[0] <= xs[xs.length - 1];
  const cell = ground.cell;
  const c0 = Math.max(0, Math.floor((x0 - BED_EASE - ground.originX) / cell));
  const c1 = Math.min(ground.cols - 1, Math.ceil((x1 + BED_EASE - ground.originX) / cell));
  const r0 = Math.max(0, Math.floor((z - reach - ground.originZ) / cell));
  const r1 = Math.min(ground.rows - 1, Math.ceil((z + reach - ground.originZ) / cell));
  for (let r = r0; r <= r1; r++) {
    const across = Math.abs(ground.originZ + r * cell - z);
    for (let c = c0; c <= c1; c++) {
      const x = ground.originX + c * cell;
      const past = Math.max(0, x0 - x, x - x1);
      const w = (1 - smoothstep(half, reach, across)) * (1 - smoothstep(0, BED_EASE, past));
      if (w <= 0) continue;
      const u = Math.min(xs.length - 1, Math.max(0, (Math.min(x1, Math.max(x0, x)) - x0) / step));
      const i = Math.min(xs.length - 2, Math.floor(u));
      const f = u - i;
      const a = asc ? i : xs.length - 1 - i;
      const b = asc ? i + 1 : xs.length - 2 - i;
      const y = bed[a] + (bed[b] - bed[a]) * f;
      const k = r * ground.cols + c;
      ground.data[k] += (y - ground.data[k]) * w;
    }
  }
}
