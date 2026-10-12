// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE PEOPLE GO — how much each of the village's kerbside bays draws a
// car, and how built-up its loop of streets is, read off what stands
// along them (`TRAFFIC.demand`): a village parks its cars in front of its
// shops, its flats and its houses, by the square and at the lift, and a
// bare stretch of street with nothing on it keeps the odd car or none.
//
// Every building the map stands (`cabinsOf`: the base's own, the town's
// and, on a real face, its real houses) pulls by its kind; the square and
// every lift's foot station pull as a busy shop does. A pull fades
// linearly to nothing over `demand.reach` m from the bay. The car park is
// not asked: it is the lifts' and stays full by day (`TRAFFIC.parked`).
//
// A pure function of the map — no stream, no hash — so no digest moves.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Level } from "../mapgen/types.ts";
import { cabinsOf } from "./cabins.ts";
import { TRAFFIC } from "./defs/traffic.ts";
import type { Village } from "./village.ts";
import type { StreetPoint } from "./village-streets.ts";

const D = TRAFFIC.demand;

/** A point that draws people, and how strongly. */
type Pull = { x: number; z: number; w: number };

/** Everything on the map that draws a car: the buildings by kind, the
 * square and the lifts' foot stations. */
function pullsOf(level: Level, v: Village): Pull[] {
  const out: Pull[] = [];
  for (const c of cabinsOf(level)) {
    const w = D.kinds[c.kind] ?? 0;
    if (w > 0) out.push({ x: c.x, z: c.z, w });
  }
  for (const a of v.areas) if (a.kind === "square") out.push({ x: a.x, z: a.z, w: D.square });
  for (const l of level.resort?.lifts ?? []) out.push({ x: l.bottom.x, z: l.bottom.z, w: D.lift });
  return out;
}

/** THE PULL ON EACH KERBSIDE BAY of `v`: the sum over what stands near it
 * of its weight, faded to nothing at `demand.reach` m. */
export function bayPulls(level: Level, v: Village): Map<string, number> {
  const pulls = pullsOf(level, v);
  const out = new Map<string, number>();
  for (const b of v.bays) {
    if (b.kind !== "kerb") continue;
    let sum = 0;
    for (const p of pulls) {
      const d = hypot(p.x - b.x, p.z - b.z);
      if (d < D.reach) sum += p.w * (1 - d / D.reach);
    }
    out.set(b.id, sum);
  }
  return out;
}

/** The share of a kerbside bay taken, out of its pull (`bayPulls`): the
 * kerb's share at a pull of `demand.full` or more, down to `demand.floor`
 * of it where nothing pulls. */
export function kerbShare(pull: number): number {
  const k = TRAFFIC.parked.kerb;
  return k * Math.max(D.floor, Math.min(1, pull / D.full));
}

function nearLine(pts: readonly StreetPoint[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const c = pts[i];
    const ex = c.x - a.x;
    const ez = c.z - a.z;
    const t = Math.max(
      0,
      Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / Math.max(1e-9, ex * ex + ez * ez)),
    );
    best = Math.min(best, hypot(x - a.x - ex * t, z - a.z - ez * t));
  }
  return best;
}

/** HOW BUILT-UP THE LOOP IS, 0..1: the pull of everything within
 * `demand.front` m of the loop's streets per hundred metres of them, over
 * `demand.busy`. A village built all round its loop is 1; a loop with its
 * buildings along one street and nothing on the others a fraction. */
export function loopBusy(level: Level, v: Village): number {
  const ids = new Set(v.loop.map((id) => id.slice(0, -1)));
  const streets = v.streets.filter((s) => ids.has(s.id));
  const length = streets.reduce((sum, s) => sum + s.length, 0);
  if (length <= 0) return 0;
  let sum = 0;
  for (const p of pullsOf(level, v)) {
    if (streets.some((s) => nearLine(s.points, p.x, p.z) < D.front)) sum += p.w;
  }
  return Math.min(1, ((sum / length) * 100) / D.busy);
}
