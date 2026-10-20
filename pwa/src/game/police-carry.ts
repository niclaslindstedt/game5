// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BAG CARRIED IN, OPENED AND SHUT — how the body bag on its frame gets
// to where the recovery starts (`police-plan.ts`; the ambulance's scoop,
// `rescue-scoop.ts`, takes it from there), and when its lid is swung open
// beside him and back over him (`bagAt`; `police-bag.ts` draws it).
// Three-free, a pure function of the call's clock.
//
// The two ski patrollers bring it down the hill between them, one at each
// end on opposite rails (the front at its left, the back at its right), and
// walk it in along the scoop's own line to the place the scoop's two
// board-carriers hold it at its first moment. There the marker officer, who
// is waiting at its front right, takes the front, and the front patroller
// lets go and steps round to his own place for the roll. So the frame is in
// someone's hands from the moment it is first seen, and is where the scoop
// expects it when the scoop begins. Where their way crosses the cordon's
// tape (`gates`), the tape is lifted over them as they pass under it
// (`liftAt`, drawn by `police-view.ts`).

import type { Level } from "@engine";

import type { Act, P2, Path } from "./police-defs.ts";
import { onPath, route, type Keep } from "./police-scene.ts";
import { HOLD_HAND, RESCUE_STRIDE, railOf } from "./rescue-crew.ts";
import {
  BEARERS,
  RESCUE,
  S,
  ease,
  fwdOf,
  rightOf,
  type RescueFrame,
  type RescuePlan,
} from "./rescue-defs.ts";
import { axes, place } from "./rescue-scoop.ts";

const Q = RESCUE.scoop;

/** How far up the fall line from the board's first place the patrollers
 * set off, m; how far short of it they walk the scoop's own line straight,
 * m; and the room the frame and the two at it keep from the body and the
 * machine, past a walker's, m. */
const CARRY = { from: 30, straight: 3.5, room: 1.0 } as const;

/** THE CARRY IN, planned: the frame's middle's way and its clock, and the
 * two patrollers' places at it (to its right `lat` m and ahead `along` m,
 * the hand they hold it with). */
export type CarryIn = {
  path: Path;
  t0: number;
  t1: number;
  at: { lat: number; along: number; hand: "L" | "R" }[];
  /** Where the marker officer takes the front (the scoop's slot 1 holds
   * it there), and over which seconds the front passes to him. */
  taker: P2;
  swap: { t0: number; t1: number };
  /** Where the way crosses the tape: the span (`ring[span]` to the next
   * stake), how far along it (0 … 1), and when the frame's middle passes. */
  gates: { span: number; u: number; t: number }[];
};

/** THE TAPE LIFTED for the bag: how high its middle goes at the crossing,
 * m (from the tape's 0.92 to over a man's head), the lead and the trail
 * past the frame's ends the carriers keep it up, m, and how long it takes
 * to raise and to lower, s. */
export const TAPE_LIFT = { height: 1.2, past: 1.2, raise: 1 } as const;

/** Where segments `a`–`b` and `c`–`d` cross: the share of each, or null. */
function cross(a: P2, b: P2, c: P2, d: P2): { u: number; v: number } | null {
  const rx = b.x - a.x;
  const rz = b.z - a.z;
  const sx = d.x - c.x;
  const sz = d.z - c.z;
  const den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const u = ((c.x - a.x) * sz - (c.z - a.z) * sx) / den;
  const v = ((c.x - a.x) * rz - (c.z - a.z) * rx) / den;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1 ? { u, v } : null;
}

/** The frame's middle at arc `d` of its way, and the way it faces — read
 * over a stride of the way, so a corner of the route is a turn. */
function middleAt(path: Path, d: number): { x: number; z: number; heading: number } {
  const p = onPath(path, d);
  const a = onPath(path, d - 1.5);
  const b = onPath(path, d + 1.5);
  const h = Math.hypot(b.x - a.x, b.z - a.z) > 1e-3 ? Math.atan2(b.x - a.x, b.z - a.z) : p.heading;
  return { x: p.x, z: p.z, heading: h };
}

/** A path through `pts`, its arcs measured. */
function pathOf(pts: P2[]): Path {
  const s = [0];
  for (let i = 1; i < pts.length; i++)
    s.push(s[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return { pts, s, length: s[s.length - 1] };
}

/** THE CARRY to arrive at `arrive` s: from up the hill at `fall` (the way
 * down, unit), round `keeps`, onto the scoop's line — under the tape of
 * `ring` where it, or the scoop's own walk-up with it from `recover` s,
 * crosses it. */
export function planCarryIn(
  plan: RescuePlan,
  keeps: readonly Keep[],
  ring: readonly P2[],
  fall: P2,
  arrive: number,
  pace: number,
  handover: number,
  recover: number,
): CarryIn {
  const { f } = axes(plan);
  const end = place(plan, RESCUE.scoop.lies + plan.beside, -Q.approach);
  const short = { x: end.x - f.x * CARRY.straight, z: end.z - f.z * CARRY.straight };
  const start = { x: short.x - fall.x * CARRY.from, z: short.z - fall.z * CARRY.from };
  const wide = keeps.map((k) => ({ ...k, r: k.r + CARRY.room }));
  const way = route(start, short, wide);
  const path = pathOf([...way.pts, end]);
  const hold = S.rail + HOLD_HAND.x;
  const t0 = arrive - path.length / pace;
  const gates: CarryIn["gates"] = [];
  // Every leg the frame is walked: the carry's, and the scoop's walk-up
  // from the carry's end to beside him (`rescue-scoop.ts`).
  const legs: { a: P2; b: P2; t: number; dt: number }[] = [];
  for (let j = 0; j + 1 < path.pts.length; j++) {
    const seg = path.s[j + 1] - path.s[j];
    legs.push({ a: path.pts[j], b: path.pts[j + 1], t: t0 + path.s[j] / pace, dt: seg / pace });
  }
  const up = { x: end.x + f.x * Q.approach, z: end.z + f.z * Q.approach };
  legs.push({ a: end, b: up, t: recover, dt: Q.approach / Q.pace });
  for (const leg of legs) {
    for (let i = 0; i < ring.length; i++) {
      const x = cross(leg.a, leg.b, ring[i], ring[(i + 1) % ring.length]);
      if (x) gates.push({ span: i, u: x.v, t: leg.t + x.u * leg.dt });
    }
  }
  return {
    path,
    t0,
    t1: arrive,
    at: [
      // The front, at the left rail (where the scoop's slot 0 holds).
      { lat: -hold, along: S.along - HOLD_HAND.z, hand: "R" },
      // The back, at the right rail (the scoop's slot 3).
      { lat: hold, along: -S.along - HOLD_HAND.z, hand: BEARERS[3].hand },
    ],
    taker: place(plan, RESCUE.scoop.lies + plan.beside + hold, S.along - HOLD_HAND.z - Q.approach),
    swap: { t0: arrive, t1: arrive + handover },
    gates,
  };
}

/** How far up the tape of span `span` is lifted at `t` (0 … 1): raised
 * as the frame's front comes to it, held till its back is through. */
export function liftAt(c: CarryIn, span: number, t: number, pace: number): number {
  let most = 0;
  const half = (S.along + TAPE_LIFT.past) / pace;
  for (const g of c.gates) {
    if (g.span !== span) continue;
    const up = (t - (g.t - half - TAPE_LIFT.raise)) / TAPE_LIFT.raise;
    const down = (g.t + half + TAPE_LIFT.raise - t) / TAPE_LIFT.raise;
    most = Math.max(most, ease(Math.min(1, up, down)));
  }
  return most;
}

/** The two patrollers' stretches of it: a `carry` each, from `t0` to `t1`. */
export function carryActs(c: CarryIn): Act[][] {
  return c.at.map((_, k) => [
    { kind: "carry", t0: c.t0, t1: c.t1, carry: c, k, walked: 0 } satisfies Act,
  ]);
}

/** Patroller `k` of the carry at `t`, and his stride. */
export function carrierAt(c: CarryIn, k: number, t: number) {
  const u = Math.max(0, Math.min(1, (t - c.t0) / (c.t1 - c.t0 || 1)));
  const d = u * c.path.length;
  const m = middleAt(c.path, d);
  const f = fwdOf(m.heading);
  const rt = rightOf(m.heading);
  const o = c.at[k];
  return {
    x: m.x + rt.x * o.lat + f.x * o.along,
    z: m.z + rt.z * o.lat + f.z * o.along,
    heading: m.heading,
    walked: d,
    walking: u < 1 ? 1 : 0,
    hand: o.hand,
  };
}

/** THE FRAME at `t` while it is carried in (and set at its first place
 * once it has come), held level between the two at their rails. */
export function carriedAt(level: Level, c: CarryIn, t: number, st: RescueFrame["stretcher"]): void {
  const d = Math.max(0, Math.min(1, (t - c.t0) / (c.t1 - c.t0 || 1))) * c.path.length;
  const m = middleAt(c.path, d);
  const ys = c.at.map((_, k) => {
    const p = carrierAt(c, k, t);
    // The front patroller's body (`BEARERS[2]`) and the back one's.
    return level.groundAt(p.x, p.z) + railOf(BEARERS[k === 0 ? 2 : 3].body, 1, 0);
  });
  // The front passed to the marker officer at its right rail: its height
  // his hand's, as the scoop will hold it.
  const took = Math.max(0, Math.min(1, (t - c.swap.t0) / (c.swap.t1 - c.swap.t0 || 1)));
  if (took > 0) {
    const y = level.groundAt(c.taker.x, c.taker.z) + railOf(BEARERS[1].body, 1, 0);
    ys[0] += (y - ys[0]) * took;
  }
  Object.assign(st, {
    x: m.x,
    z: m.z,
    y: (ys[0] + ys[1]) / 2,
    heading: m.heading,
    pitch: Math.atan2(ys[0] - ys[1], 2 * S.along),
    roll: 0,
    shown: true,
    straps: 0,
  });
}

/** How long the lid takes to swing open, s. */
const BAG_OPEN = 1.2;

/** THE BAG'S LID, `tt` s into the trip's scoop (`plan.at.scoop`): shut
 * and empty on the frame until it is laid beside him; swung open flat onto
 * the snow beyond the outer rail as the two who brought it turn to it;
 * brought back over him once he is rolled onto it (when the ambulance's
 * crew would strap him) and filled by him as it comes down; zipped. `shut`
 * is from when the lid hides him. And the turn of his body onto the
 * frame's line as he is rolled onto it (`turn`, 0 … 1). */
export function bagAt(
  plan: RescuePlan,
  tt: number,
): { open: number; fill: number; shut: boolean; turn: number } {
  const A = plan.at.scoop;
  const T = RESCUE.scoop.time;
  const opened = ease((tt - A.turn) / BAG_OPEN);
  const closing = ease((tt - A.strap) / (T.strap * 0.6));
  return {
    open: opened * (1 - closing),
    fill: ease((tt - A.strap - T.strap * 0.3) / (T.strap * 0.4)),
    shut: closing > 0.86,
    turn: ease((tt - A.roll) / (A.back + T.back - A.roll)),
  };
}

/** The stride count a carrier's walked arc is. */
export const strideOf = (walked: number): number => walked / RESCUE_STRIDE;
