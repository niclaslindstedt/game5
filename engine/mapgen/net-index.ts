// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R27 — THE NETWORK'S INDEX: every run of a resort laid so far, hashed by
// its segments, and the one question every walk, lane and check asks of
// it: "which other run is nearest here?" (`network.ts` walks the runs).

import { angleDiff, cellKey } from "@niclaslindstedt/oss-game-framework/core/math";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import type { TrackPoint } from "./types.ts";

/** The answer to "which other run is nearest here?" */
export type NetHit = {
  run: number;
  index: number;
  s: number;
  distance: number;
  /** Signed: positive to the right of the other run's travel, m. */
  lateral: number;
  heading: number;
  width: number;
  /** The nearest point on the other's centreline. */
  x: number;
  z: number;
};

const CELL = 24;

/** Half the widest a run is anywhere (R27's `piste.most`), m: the reach a
 * question about a run's surface must look out to. */
const WIDEST_HALF = RR.piste.most / 2;

/** The cells held in a flat grid rather than the map: the world's square
 * and a wide margin round it, where every run and nearly every question
 * lies. A cell outside it is still answered, off the map. */
const GRID_MARGIN = 24;
const GRID_SIDE = Math.ceil(Math.max(R.world.size, RR.massif.size) / CELL) + 2 * GRID_MARGIN;

/** How much further than the ring's square a segment not yet scanned must
 * lie before a ring scan stops, m: far more than the rounding of any
 * distance on a map of this size, so the stop never turns away a segment
 * the arithmetic would have taken. */
const STOP_SLACK = 1e-6;

/** Every segment of every run laid so far, hashed. Runs are added whole as
 * they are walked; the index never forgets one.
 *
 * A segment's geometry is kept as it was added (a run's line never moves
 * once it is laid — only its heights are read again), in flat arrays, so a
 * scan reads numbers rather than chasing a run's points; and its distance
 * is weighed before the caller's `skip` is asked, since a segment no nearer
 * than the one held is never taken whatever `skip` says. */
export class NetIndex {
  readonly runs: {
    points: readonly TrackPoint[];
    rank: number;
    into: number;
    from: number;
    road: boolean;
  }[] = [];
  private readonly grid: (number[] | undefined)[] = new Array(GRID_SIDE * GRID_SIDE);
  private readonly cells = new Map<number, number[]>();
  private segRun = new Int32Array(1024);
  private segIndex = new Int32Array(1024);
  /** Per segment: a.x, a.z, dx, dz, len2 and a.s. */
  private segGeo = new Float64Array(1024 * 6);
  private segs = 0;

  /** Add a run's line; `rank` is how hard it was built to (0 a green or a
   * lane … 3 a black), which says what may merge into it; `into` the run
   * it merges into, if any, from arc `from` on; `road` whether it is a
   * transport lane. */
  add(points: readonly TrackPoint[], rank = 0, into = -1, from = 0, road = false): number {
    const run = this.runs.length;
    this.runs.push({ points, rank, into, from, road });
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i];
      const b = points[i + 1];
      const g = this.segment(run, i, a, b);
      const c0 = Math.floor(Math.min(a.x, b.x) / CELL);
      const c1 = Math.floor(Math.max(a.x, b.x) / CELL);
      const r0 = Math.floor(Math.min(a.z, b.z) / CELL);
      const r1 = Math.floor(Math.max(a.z, b.z) / CELL);
      for (let c = c0; c <= c1; c++) {
        for (let r = r0; r <= r1; r++) {
          const list = this.list(c, r);
          if (list) list.push(g);
          else this.setList(c, r, [g]);
        }
      }
    }
    return run;
  }

  private segment(run: number, index: number, a: TrackPoint, b: TrackPoint): number {
    const g = this.segs++;
    if (g >= this.segRun.length) {
      const grow = <T extends Int32Array | Float64Array>(from: T, n: number): T => {
        const to = new (from.constructor as new (n: number) => T)(n);
        to.set(from);
        return to;
      };
      this.segRun = grow(this.segRun, g * 2);
      this.segIndex = grow(this.segIndex, g * 2);
      this.segGeo = grow(this.segGeo, g * 12);
    }
    this.segRun[g] = run;
    this.segIndex[g] = index;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const o = g * 6;
    this.segGeo[o] = a.x;
    this.segGeo[o + 1] = a.z;
    this.segGeo[o + 2] = dx;
    this.segGeo[o + 3] = dz;
    this.segGeo[o + 4] = dx * dx + dz * dz || 1;
    this.segGeo[o + 5] = a.s;
    return g;
  }

  private list(c: number, r: number): number[] | undefined {
    const gc = c + GRID_MARGIN;
    const gr = r + GRID_MARGIN;
    if (gc >= 0 && gc < GRID_SIDE && gr >= 0 && gr < GRID_SIDE)
      return this.grid[gr * GRID_SIDE + gc];
    return this.cells.get(cellKey(c, r));
  }

  private setList(c: number, r: number, list: number[]): void {
    const gc = c + GRID_MARGIN;
    const gr = r + GRID_MARGIN;
    if (gc >= 0 && gc < GRID_SIDE && gr >= 0 && gr < GRID_SIDE)
      this.grid[gr * GRID_SIDE + gc] = list;
    else this.cells.set(cellKey(c, r), list);
  }

  /** The nearest segment of any run within `within` metres, its EDGE-to-
   * point distance read as the centreline's less nothing — `distance` is to
   * the centreline. `skip` turns a run away (null: none). Infinity when
   * nothing is that near. */
  nearest(
    x: number,
    z: number,
    within: number,
    skip: (run: number, s: number) => boolean,
    out: NetHit,
  ): NetHit {
    out.distance = Infinity;
    const rings = Math.ceil(within / CELL) + 1;
    const qc = Math.floor(x / CELL);
    const qr = Math.floor(z / CELL);
    // How far the point stands inside its own cell from each side: a ring's
    // square reaches `ring` cells past these.
    const left = x - qc * CELL;
    const right = (qc + 1) * CELL - x;
    const top = z - qr * CELL;
    const bottom = (qr + 1) * CELL - z;
    const inside = Math.min(left, right, top, bottom);
    // Ring by ring outward, stopping once nothing in a further ring could
    // be nearer than what is held, or inside `within`: everything not yet
    // scanned lies wholly outside the square scanned so far.
    for (let ring = 0; ring <= rings; ring++) {
      for (let dc = -ring; dc <= ring; dc++) {
        const edge = dc === -ring || dc === ring;
        for (let dr = -ring; dr <= ring; dr += edge ? 1 : 2 * ring) {
          const list = this.list(qc + dc, qr + dr);
          if (list) this.scan(list, x, z, within, skip, out);
          if (ring === 0) break;
        }
      }
      const beyond = ring * CELL + inside - STOP_SLACK;
      if (out.distance <= beyond || beyond > within) break;
    }
    return out;
  }

  /** Whether (x, z) stands within some run's half-width and `pad` metres
   * of its centreline — ANY run's, not only the nearest's: beside a lane
   * that left a wide piste's top, the lane's centreline is the nearer and
   * the piste's surface still reaches past it. */
  covers(x: number, z: number, pad: number, out: NetHit): boolean {
    const seen: number[] = [];
    const within = WIDEST_HALF + pad;
    const skip = (r: number): boolean => seen.includes(r);
    for (;;) {
      const h = this.nearest(x, z, within, skip, out);
      if (h.distance === Infinity) return false;
      if (h.distance < h.width / 2 + pad) return true;
      seen.push(h.run);
    }
  }

  private scan(
    list: readonly number[],
    x: number,
    z: number,
    within: number,
    skip: (run: number, s: number) => boolean,
    out: NetHit,
  ): void {
    const geo = this.segGeo;
    const most = within * within;
    for (let k = 0; k < list.length; k++) {
      const g = list[k];
      const o = g * 6;
      const ax = geo[o];
      const az = geo[o + 1];
      const dx = geo[o + 2];
      const dz = geo[o + 3];
      const len2 = geo[o + 4];
      let t = ((x - ax) * dx + (z - az) * dz) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x - (ax + dx * t);
      const ez = z - (az + dz * t);
      const d2 = ex * ex + ez * ez;
      if (d2 >= out.distance * out.distance || d2 > most) continue;
      const run = this.segRun[g];
      if (skip(run, geo[o + 5])) continue;
      const index = this.segIndex[g];
      const pts = this.runs[run].points;
      const a = pts[index];
      const b = pts[index + 1];
      const d = Math.sqrt(d2);
      const len = Math.sqrt(len2);
      out.run = run;
      out.index = index;
      out.s = a.s + (b.s - a.s) * t;
      out.distance = d;
      out.lateral = (ex * dz - ez * dx) / len;
      out.heading = a.heading + angleDiff(a.heading, b.heading) * t;
      out.width = a.width + (b.width - a.width) * t;
      out.x = ax + dx * t;
      out.z = az + dz * t;
    }
  }
}

/** A fresh hit to reuse. */
export function netHit(): NetHit {
  return {
    run: -1,
    index: 0,
    s: 0,
    distance: Infinity,
    lateral: 0,
    heading: 0,
    width: 0,
    x: 0,
    z: 0,
  };
}
