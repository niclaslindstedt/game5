// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R27 — THE NETWORK'S INDEX: every run of a resort laid so far, hashed by
// its segments, and the one question every walk, lane and check asks of
// it: "which other run is nearest here?" (`network.ts` walks the runs).

import { angleDiff, cellKey } from "@niclaslindstedt/oss-game-framework/core/math";
import { RESORT_RULES as RR } from "./resort-rules.ts";
import type { TrackPoint } from "./types.ts";

/** One entry of the index: a segment of a run. */
type Entry = { readonly run: number; readonly index: number };

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

/** Every segment of every run laid so far, hashed. Runs are added whole as
 * they are walked; the index never forgets one. */
export class NetIndex {
  readonly runs: {
    points: readonly TrackPoint[];
    rank: number;
    into: number;
    from: number;
    road: boolean;
  }[] = [];
  private readonly cells = new Map<number, Entry[]>();

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
      const c0 = Math.floor(Math.min(a.x, b.x) / CELL);
      const c1 = Math.floor(Math.max(a.x, b.x) / CELL);
      const r0 = Math.floor(Math.min(a.z, b.z) / CELL);
      const r1 = Math.floor(Math.max(a.z, b.z) / CELL);
      for (let c = c0; c <= c1; c++) {
        for (let r = r0; r <= r1; r++) {
          const key = cellKey(c, r);
          const list = this.cells.get(key);
          const e = { run, index: i };
          if (list) list.push(e);
          else this.cells.set(key, [e]);
        }
      }
    }
    return run;
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
    // Ring by ring outward, stopping once nothing in a further ring could
    // be nearer than what is held.
    for (let ring = 0; ring <= rings; ring++) {
      for (let dc = -ring; dc <= ring; dc++) {
        const edge = dc === -ring || dc === ring;
        for (let dr = -ring; dr <= ring; dr += edge ? 1 : 2 * ring) {
          const list = this.cells.get(cellKey(qc + dc, qr + dr));
          if (list) this.scan(list, x, z, within, skip, out);
          if (ring === 0) break;
        }
      }
      if (out.distance <= ring * CELL) break;
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
    for (;;) {
      const h = this.nearest(x, z, within, (r) => seen.includes(r), out);
      if (h.distance === Infinity) return false;
      if (h.distance < h.width / 2 + pad) return true;
      seen.push(h.run);
    }
  }

  private scan(
    list: readonly Entry[],
    x: number,
    z: number,
    within: number,
    skip: (run: number, s: number) => boolean,
    out: NetHit,
  ): void {
    for (const e of list) {
      const pts = this.runs[e.run].points;
      if (skip(e.run, pts[e.index].s)) continue;
      const a = pts[e.index];
      const b = pts[e.index + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz || 1;
      let t = ((x - a.x) * dx + (z - a.z) * dz) / len2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x - (a.x + dx * t);
      const ez = z - (a.z + dz * t);
      const d2 = ex * ex + ez * ez;
      if (d2 >= out.distance * out.distance || d2 > within * within) continue;
      const d = Math.sqrt(d2);
      const len = Math.sqrt(len2);
      out.run = e.run;
      out.index = e.index;
      out.s = a.s + (b.s - a.s) * t;
      out.distance = d;
      out.lateral = (ex * dz - ez * dx) / len;
      out.heading = a.heading + angleDiff(a.heading, b.heading) * t;
      out.width = a.width + (b.width - a.width) * t;
      out.x = a.x + dx * t;
      out.z = a.z + dz * t;
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
