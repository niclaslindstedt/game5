// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R42 — WHAT IS LAID DOWN A WILD SKI ROUTE once its line is found
// (`ski-routes.ts`): the trunks it threads felled, and its JUMPS.
//
// A wild line goes THROUGH the woods: every trunk whose bark stands within
// `route.open` metres of it is felled, and nothing else — so a tree run is
// a lane a few metres wide with the wood standing at its edges.
//
// Its JUMPS are kickers stood on the line's ROLLS — where the ground past
// the lip falls away steeper than it came up to it by `wild.jump.roll` —
// facing the way the LINE goes there, not the fall line: one on a traverse
// throws a skier across the face, one before a bend throws him straight on
// past it. Each is scored by how much the ground rolls away under it, how
// hard the line turns over its landing and whether that landing is an
// edge or the woods; the best are kept `wild.jump.spacing` apart, clear of
// the line's ends and its drops, up to `wild.jump.count`. The lip stands
// higher the harder the ground rolls. They are cut into the ground as any
// off-piste kicker is (`stampKicker`), and no lip is laid where it would
// make the line steeper than a route may be. Nothing draws from a stream.

import { hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { onKicker, stampKicker } from "./kickers.ts";
import { LEVEL_RULES as R } from "./rules.ts";
import { RESORT_RULES } from "./resort-rules.ts";
import { DROP_SPAN, steepestAlong } from "./ski-routes.ts";
import { fallAlong } from "./spawn.ts";
import type { Kicker, SkiRoute, TrackPoint, TreeDef } from "./types.ts";

const K = RESORT_RULES.route;
const J = K.wild.jump;

/** The heading change from `a` to `b`, rad, in −π..π. */
function turnOf(a: number, b: number): number {
  return Math.atan2(Math.sin(b - a), Math.cos(b - a));
}

/** The station of `points` at arc `s` (the nearest laid). */
function stationAt(points: readonly TrackPoint[], s: number): TrackPoint {
  const i = Math.round(s / K.station);
  return points[Math.max(0, Math.min(points.length - 1, i))];
}

/** THE GAP past a route jump's lip: a trench `length` m down the line and
 * `wild.jump.dig` deep at its middle, as wide as the jump, its sides eased
 * back into the snow — the lip's landing lowered into it. */
function stampGap(
  ground: Heightfield,
  x: number,
  z: number,
  heading: number,
  length: number,
): void {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const edge = R.kickers.edge;
  const reach = length + J.width / 2 + edge;
  const cell = ground.cell;
  const c0 = Math.max(0, Math.floor((x - reach) / cell));
  const c1 = Math.min(ground.cols - 1, Math.ceil((x + reach) / cell));
  const r0 = Math.max(0, Math.floor((z - reach) / cell));
  const r1 = Math.min(ground.rows - 1, Math.ceil((z + reach) / cell));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const dx = c * cell - x;
      const dz = r * cell - z;
      const u = dx * fx + dz * fz;
      if (u <= 0.5 || u >= length + 0.5) continue;
      const v = Math.abs(dx * fz - dz * fx);
      const across = 1 - smoothstep(J.width / 2, J.width / 2 + edge, v);
      if (across <= 0) continue;
      ground.data[r * ground.cols + c] -= across * J.dig * Math.sin((Math.PI * (u - 0.5)) / length);
    }
  }
}

/** THE TRUNKS A WILD ROUTE FELLS: every trunk within `route.open` m of its
 * line or on one of its jumps' footprints. Returns the trees left. */
export function fellOnRoutes(
  trees: readonly TreeDef[],
  routes: readonly SkiRoute[],
  kickers: readonly Kicker[],
): TreeDef[] {
  const cell = 8;
  const near = new Map<number, TrackPoint[]>();
  const key = (i: number, j: number): number => i * 100003 + j;
  for (const r of routes) {
    for (const p of r.points) {
      const k = key(Math.floor(p.x / cell), Math.floor(p.z / cell));
      const list = near.get(k);
      if (list) list.push(p);
      else near.set(k, [p]);
    }
  }
  return trees.filter((t) => {
    const reach = K.open + t.radius;
    const i = Math.floor(t.x / cell);
    const j = Math.floor(t.z / cell);
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++)
        for (const p of near.get(key(i + di, j + dj)) ?? [])
          if (hypot(p.x - t.x, p.z - t.z) < reach) return false;
    return !onKicker(kickers, t.x, t.z, 2);
  });
}

/** THE JUMPS down every wild route, cut into `ground` (see the header);
 * each route's stations re-read off the ground and its steepest window
 * re-measured after. Ids `O1…` across the map, in the routes' order. */
export function layRouteJumps(ground: Heightfield, routes: SkiRoute[]): Kicker[] {
  const out: Kicker[] = [];
  for (const r of routes) {
    const pts = r.points;
    const drops = r.drops ?? [];
    type Lip = { p: TrackPoint; score: number; roll: number };
    const lips: Lip[] = [];
    for (const p of pts) {
      if (p.s < Math.max(J.ends, K.lead) || p.s > r.length - J.ends) continue;
      if (drops.some((d) => Math.abs(d.s - p.s) < J.clear + DROP_SPAN)) continue;
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const above = fallAlong(ground, p.x - fx * J.ramp, p.z - fz * J.ramp, p.heading, J.ramp);
      const below = fallAlong(ground, p.x, p.z, p.heading, J.landing);
      // A ramp that would climb is no lip, and the ground must roll away.
      if (above.gentlest < 0.2) continue;
      const roll = below.steepest - above.gentlest;
      if (roll < J.roll) continue;
      // Neither the line's colour window nor its pitch pushed past a
      // route's by the lip's fall.
      const window = pts.filter((q) => Math.abs(q.s - p.s) <= R.track.colourWindow);
      if (
        steepestAlong(window, R.track.colourWindow) + J.height.max / R.track.colourWindow >
        K.steepest
      ) {
        continue;
      }
      const local = pts.filter((q) => q.s > p.s - 30 && q.s < p.s + J.landing + 20);
      if (steepestAlong(local, K.pitchWindow) + (2 * J.height.max) / J.landing / 2 > K.cliff)
        continue;
      // How hard the line bends where he comes down, and whether there
      // is an edge or the woods there.
      const land = stationAt(pts, p.s + J.landing);
      const bend = Math.abs(turnOf(p.heading, stationAt(pts, p.s + J.landing + 20).heading));
      const narrow = land.width < K.width ? 1 : 0;
      lips.push({ p, roll, score: roll * 12 + bend * 3 + narrow });
    }
    lips.sort((a, c) => c.score - a.score || a.p.s - c.p.s);
    const kept: Lip[] = [];
    for (const l of lips) {
      if (kept.length >= J.count.max) break;
      if (kept.some((o) => Math.abs(o.p.s - l.p.s) < J.spacing)) continue;
      kept.push(l);
    }
    kept.sort((a, c) => a.p.s - c.p.s);
    for (const { p, roll } of kept) {
      const height = J.height.min + (J.height.max - J.height.min) * Math.min(1, roll / 0.25);
      stampKicker(ground, p.x, p.z, p.heading, height, J.ramp, J.landing, J.width);
      const share = (height - J.height.min) / (J.height.max - J.height.min);
      stampGap(ground, p.x, p.z, p.heading, J.gap.min + (J.gap.max - J.gap.min) * share);
      out.push({
        id: `O${out.length + 1}`,
        x: p.x,
        z: p.z,
        y: 0,
        heading: p.heading,
        height,
        ramp: J.ramp,
        landing: J.landing,
        width: J.width,
        onTrack: false,
        route: r.id,
      });
    }
  }
  for (const k of out) k.y = sampleField(ground, k.x, k.z);
  for (const r of routes) {
    for (const p of r.points) p.y = sampleField(ground, p.x, p.z);
    r.steepest = steepestAlong(r.points, R.track.colourWindow);
  }
  return out;
}
