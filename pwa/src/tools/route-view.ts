// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S SKI ROUTE VIEWS (`make world ARGS=--views=routes`): the
// ORANGE grade past black (R42, `ski-routes.ts`) as a skier meets it.
//
//   * route-head — its sign at the pad's rim, from a step back up the line
//     at a skier's eye, looking past it down the route;
//   * route-amateur, route-amateur-close — the locals' homemade sign
//     pointing at it (`route-sign-plan.ts`), from where a rider comes to it
//     off the lift, and a step from it;
//   * route-warn — its wooden WARNING board before the slope, from up on
//     the pad at a skier's eye;
//   * route-fallen — the first of its stakes planted lying on the snow,
//     with the hard-leaning ones round it, close at a skier's eye;
//   * route-in — a quarter of the way down, at his eye, down the fall line:
//     how steep the steepest country a lift serves is, and its stakes;
//   * route-steep — at its steepest hundred metres, the same;
//   * route-side — the whole route from across the face, its stakes down
//     both sides and the run it comes onto;
//   * route-air — high over the route's middle, the lift's top it leaves,
//     its line and the groomed runs beside it.
//
// A map with none answers "no ski route on this map".

import {
  LEVEL_RULES,
  skiRoutesOf,
  stakePlan,
  trackPointAt,
  type Level,
  type SkiRoute,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { amateurSigns } from "../game/route-sign-plan.ts";
import { signPlan } from "../game/run-sign-plan.ts";

export const ROUTE_VIEWS = [
  "route-head",
  "route-amateur",
  "route-amateur-close",
  "route-warn",
  "route-fallen",
  "route-in",
  "route-steep",
  "route-side",
  "route-air",
] as const;

const asTrack = (r: SkiRoute) => ({ track: { points: r.points, length: r.length } });

/** At `s` along `r`, `back` m up its line and `up` m over the snow, looking
 * `ahead` m down it at `drop` m under the snow there. */
function along(
  level: Level,
  r: SkiRoute,
  s: number,
  back: number,
  up: number,
  ahead: number,
  fov = 62,
): LensPose {
  const at = trackPointAt(asTrack(r), Math.max(0, s - back));
  const to = trackPointAt(asTrack(r), Math.min(r.length, s + ahead));
  return {
    eye: { x: at.x, y: level.groundAt(at.x, at.z) + up, z: at.z },
    target: { x: to.x, y: level.groundAt(to.x, to.z) + 1, z: to.z },
    fov,
    roll: 0,
  };
}

/** Where along `r` its steepest colour window starts, m. */
function steepestAt(r: SkiRoute): number {
  const span = LEVEL_RULES.track.colourWindow;
  let best = 0;
  let at = 0;
  let j = 0;
  for (let i = 0; i < r.points.length; i++) {
    while (j < r.points.length && r.points[j].s - r.points[i].s < span) j++;
    if (j >= r.points.length) break;
    const g = (r.points[i].y - r.points[j].y) / (r.points[j].s - r.points[i].s);
    if (g > best) {
      best = g;
      at = r.points[i].s;
    }
  }
  return at;
}

export function routeView(level: Level, name: string): { pose: LensPose; note: string } | null {
  const r = skiRoutesOf(level)[0];
  if (!r) return null;
  const said = `${r.id} off ${r.from} onto run ${r.into.run}, ${Math.round(r.length)} m, steepest ${Math.round(r.steepest * 100)} %`;
  switch (name) {
    case "route-head": {
      // From the pad's rim, a few metres up and aside of the sign, looking
      // past it down the first stretch of the route.
      const post = signPlan(level).find((p) => p.boards.some((b) => b.run === r.id && !b.warning));
      const head = r.points[0];
      const on = trackPointAt(asTrack(r), 30);
      const d = Math.hypot(on.x - head.x, on.z - head.z) || 1;
      const fx = (on.x - head.x) / d;
      const fz = (on.z - head.z) / d;
      const px = post?.x ?? head.x;
      const pz = post?.z ?? head.z;
      const x = px - fx * 6 + fz * 2.5;
      const z = pz - fz * 6 - fx * 2.5;
      const to = trackPointAt(asTrack(r), 60);
      return {
        pose: {
          eye: { x, y: level.groundAt(x, z) + 1.8, z },
          target: { x: to.x, y: level.groundAt(to.x, to.z) + 1, z: to.z },
          fov: 66,
          roll: 0,
        },
        note: `the head of ${said}`,
      };
    }
    case "route-amateur":
    case "route-amateur-close": {
      // From where the rider it is turned to comes to it, at his eye, a
      // little to the side so the point and the route beyond both show.
      const sign = amateurSigns(level).find((a) => a.route === r.id);
      if (!sign) return null;
      const close = name === "route-amateur-close";
      const back = close ? 2.2 : 5.5;
      const fx = Math.sin(sign.heading);
      const fz = Math.cos(sign.heading);
      const aside = sign.point === "right" ? -1 : 1;
      const x = sign.x - fx * back - fz * aside * (close ? 0.5 : 1.2);
      const z = sign.z - fz * back + fx * aside * (close ? 0.5 : 1.2);
      // The board's middle: off the stick toward its point.
      const k = sign.point === "right" ? 1 : -1;
      const tx = sign.x - fz * k * 0.35;
      const tz = sign.z + fx * k * 0.35;
      return {
        pose: {
          eye: { x, y: level.groundAt(x, z) + 1.65, z },
          target: { x: tx, y: sign.y + sign.boardY, z: tz },
          fov: close ? 40 : 55,
          roll: 0,
        },
        note: `the locals' sign pointing ${sign.point} at ${said}`,
      };
    }
    case "route-warn": {
      // From up on the pad behind the route's head, a step aside, looking
      // at the warning board a skier passes before the slope.
      const post = signPlan(level).find((p) => p.boards.some((b) => b.run === r.id && b.warning));
      if (!post) return null;
      const fx = Math.sin(post.heading);
      const fz = Math.cos(post.heading);
      const x = post.x - fx * 7 - fz * 2;
      const z = post.z - fz * 7 + fx * 2;
      return {
        pose: {
          eye: { x, y: level.groundAt(x, z) + 1.7, z },
          target: { x: post.x, y: post.y + 1.6, z: post.z },
          fov: 50,
          roll: 0,
        },
        note: `the warning before ${said}`,
      };
    }
    case "route-fallen": {
      // The first orange stake that lies on the snow, from a few metres
      // up the slope and aside of it.
      const plan = stakePlan(level);
      let i = -1;
      for (let k = 0; k < plan.count; k++) {
        if (plan.grade[k] === "orange" && Math.hypot(plan.leanX[k], plan.leanZ[k]) > 0.9) {
          i = k;
          break;
        }
      }
      if (i < 0) return null;
      // From the side it fell to, so its length lies across the frame.
      const p = plan.stakes[i];
      const lean = Math.hypot(plan.leanX[i], plan.leanZ[i]);
      const dx = plan.leanX[i] / lean;
      const dz = plan.leanZ[i] / lean;
      const mx = p.x + dx * 1.4;
      const mz = p.z + dz * 1.4;
      const x = mx + dz * 5;
      const z = mz - dx * 5;
      return {
        pose: {
          eye: { x, y: level.groundAt(x, z) + 1.5, z },
          target: { x: mx, y: level.groundAt(mx, mz) + 0.2, z: mz },
          fov: 55,
          roll: 0,
        },
        note: `a fallen stake on ${said}`,
      };
    }
    case "route-in":
      return { pose: along(level, r, r.length * 0.25, 0, 1.7, 45), note: `a quarter down ${said}` };
    case "route-steep": {
      const s = steepestAt(r);
      return { pose: along(level, r, s, 0, 1.7, 40), note: `the steepest of ${said}` };
    }
    case "route-side":
    case "route-air": {
      const mid = trackPointAt(asTrack(r), r.length / 2);
      const across = mid.heading + Math.PI / 2;
      const far = name === "route-air" ? 160 : Math.max(260, r.length * 0.55);
      const high = name === "route-air" ? 220 : 160;
      // The side the ground falls away to, so no spur stands in between.
      const side = [1, -1].reduce((a, b) =>
        level.groundAt(mid.x + Math.sin(across) * far * b, mid.z + Math.cos(across) * far * b) <
        level.groundAt(mid.x + Math.sin(across) * far * a, mid.z + Math.cos(across) * far * a)
          ? b
          : a,
      );
      const ex = mid.x + Math.sin(across) * far * side;
      const ez = mid.z + Math.cos(across) * far * side;
      return {
        pose: {
          eye: { x: ex, y: Math.max(level.groundAt(ex, ez), mid.y) + high, z: ez },
          target: { x: mid.x, y: mid.y, z: mid.z },
          fov: 55,
          roll: 0,
        },
        note: `${name === "route-air" ? "over" : "across from"} ${said}`,
      };
    }
  }
  return null;
}
