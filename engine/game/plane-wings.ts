// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S WINGS (`plane.ts`) — what each takes and when it is torn
// off. A wingtip pressed into the snow is held up by it (a spring under the
// tip, a crush rather than a damper, the snow's friction along it — so a
// wing dropped on the take-off roll SCRAPES, slews the plane toward it and
// is lifted again) and worn by it; a tip driven in past what the spar holds
// at its root, a trunk or a crown's limbs met at speed, or a wing's own lift
// past its ultimate load in the air TEARS IT OFF. The plane flies on with
// what it has left — the torn side's sections gone from the air
// (`plane-aero.ts`), so it rolls in toward that side — and the torn wing,
// its tank spilt, tumbles down and slides to rest on its own. Nothing here
// lights a fire: the fuel streams away from the engine, and a wreck burns
// only by `wreckIgnites`. The numbers and their research are
// `defs/plane-wings.ts`'s.
//
// Pure over the level, the state and the clock: nothing here draws from the
// stream.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  integrate,
  rotate,
  unrotate,
  type Vec3,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import { treesNear } from "./collision.ts";
import { felledTrees } from "./felled.ts";
import { PLANE } from "./defs/plane.ts";
import { PLANE_WINGS } from "./defs/plane-wings.ts";
import { TUNING } from "./defs/tuning.ts";
import { COG, type PlaneAir } from "./plane-aero.ts";
import type { Level } from "../mapgen/types.ts";
import type { GameEvent, GameState } from "./state.ts";
import type { PlaneState, PlaneWing, TornWing } from "./plane-state.ts";

const N = PLANE_WINGS;
const W = PLANE.wing;
const dt = TUNING.dt;

/** The side a body x stands on: 0 the left wing (the engine's +x), 1 the
 * right; and the sign of a side's x. */
const sideOf = (x: number): 0 | 1 => (x > 0 ? 0 : 1);
const signOf = (side: number): number => (side === 0 ? 1 : -1);

/** The wingtips tested on the snow (`PLANE.crash.strike`'s first four: each
 * tip's leading and trailing edge), from the CoG. */
const TIPS: readonly Vec3[] = PLANE.crash.strike.slice(0, 4).map((p) => ({
  x: p.x,
  y: p.y - COG.y,
  z: p.z - COG.z,
}));
/** The wings' points the trees are asked about, from the CoG: out along
 * each at its tip, its strut's head and inboard. */
export const WING_TREE_POINTS: readonly Vec3[] = [-7.9, -5.5, -3.2, 3.2, 5.5, 7.9].map((x) => ({
  x,
  y: W.root.y + Math.abs(x) * Math.tan(W.dihedral) - COG.y,
  z: W.root.le - W.chord / 2 - COG.z,
}));
/** A wing's middle, from the ground datum (where a torn one is flown from):
 * at its strut's head, mid-chord. */
export function wingMiddle(side: number): Vec3 {
  const x = PLANE.struts.head.x;
  return {
    x: signOf(side) * x,
    y: W.root.y + x * Math.tan(W.dihedral),
    z: W.root.le - W.chord / 2,
  };
}

export function freshWing(): PlaneWing {
  return { health: 1, force: 0, touching: false, torn: null };
}

/** Whether a side's wing is still on. */
export const wingOn = (p: PlaneState, side: number): boolean => !p.wings[side].torn;

const slide = [0, 0];
const was = [false, false];
const normal = { x: 0, y: 1, z: 0 };

/** THE TIPS ON THE SNOW this step, into the forces and torques the gear's
 * loop sums (world force, body torque about the CoG, `out`), the CoG at
 * (cx, cy, cz) and the body turning at `omega` (world frame): each tip
 * held up by the snow under it and dragged along it, and the force on each
 * wing kept for `judgeWings`. */
export function tipContacts(
  level: Level,
  p: PlaneState,
  cx: number,
  cy: number,
  cz: number,
  omega: Vec3,
  out: { fx: number; fy: number; fz: number; tx: number; ty: number; tz: number },
): void {
  out.fx = out.fy = out.fz = out.tx = out.ty = out.tz = 0;
  for (let s = 0; s < 2; s++) {
    was[s] = p.wings[s].touching;
    p.wings[s].touching = false;
    p.wings[s].force = 0;
    slide[s] = 0;
  }
  const T = N.tip;
  for (const tip of TIPS) {
    const s = sideOf(tip.x);
    const w = p.wings[s];
    if (w.torn) continue;
    const r = rotate(p.q, tip);
    const px = cx + r.x;
    const py = cy + r.y;
    const pz = cz + r.z;
    const pen = level.groundAt(px, pz) - py;
    if (pen <= 0) continue;
    level.normalAt(px, pz, normal);
    const depth = Math.min(pen * normal.y, T.buried);
    const vx = p.vx + (omega.y * r.z - omega.z * r.y);
    const vy = p.vy + (omega.z * r.x - omega.x * r.z);
    const vz = p.vz + (omega.x * r.y - omega.y * r.x);
    const vn = vx * normal.x + vy * normal.y + vz * normal.z;
    const Fn = Math.max(0, T.spring * depth - T.damping * vn);
    const tx = vx - vn * normal.x;
    const ty = vy - vn * normal.y;
    const tz = vz - vn * normal.z;
    const tv = hypot3(tx, ty, tz);
    const f = -(T.friction * Fn + T.plough * depth * tv * tv) / (tv + 0.3);
    const fx = Fn * normal.x + f * tx;
    const fy = Fn * normal.y + f * ty;
    const fz = Fn * normal.z + f * tz;
    out.fx += fx;
    out.fy += fy;
    out.fz += fz;
    const tw = unrotate(p.q, {
      x: r.y * fz - r.z * fy,
      y: r.z * fx - r.x * fz,
      z: r.x * fy - r.y * fx,
    });
    out.tx += tw.x;
    out.ty += tw.y;
    out.tz += tw.z;
    // The wing's load from it: up and down at full strength, fore and aft
    // against the spar's far stiffer depth.
    const b = unrotate(p.q, { x: fx, y: fy, z: fz });
    w.force += hypot(b.y, hypot(b.x, b.z) / N.tear.inPlane);
    w.touching = true;
    slide[s] = Math.max(slide[s], tv);
  }
}

const say = (
  run: GameState,
  events: GameEvent[],
  phase: "scrape" | "tear",
  at: Vec3,
  speed: number,
) => events.push({ kind: "plane", t: run.t, phase, x: at.x, y: at.y, z: at.z, speed });

/** A point of the plane, body frame from the ground datum, in the world. */
function worldOf(p: PlaneState, b: Vec3): Vec3 {
  const w = rotate(p.q, b);
  return { x: p.x + w.x, y: p.y + w.y, z: p.z + w.z };
}

/** TEAR A WING OFF: the piece let go where it stood with the airframe's own
 * way there (a share of it, by what tore it), flung up and out and set
 * tumbling; its tank's share of the fuel spilt with it; that side's lift
 * gone from the air (`plane-aero.ts` reads `torn`). */
export function tearWing(
  run: GameState,
  p: PlaneState,
  side: number,
  cause: TornWing["cause"],
  events: GameEvent[],
): void {
  const w = p.wings[side];
  if (w.torn) return;
  const L = N.loose;
  const mid = wingMiddle(side);
  const at = worldOf(p, mid);
  const omega = rotate(p.q, { x: p.wx, y: p.wy, z: p.wz });
  const r = rotate(p.q, { x: mid.x - COG.x, y: mid.y - COG.y, z: mid.z - COG.z });
  const vx = p.vx + (omega.y * r.z - omega.z * r.y);
  const vy = p.vy + (omega.z * r.x - omega.x * r.z);
  const vz = p.vz + (omega.x * r.y - omega.y * r.x);
  const keep = L.keep[cause];
  const outward = rotate(p.q, { x: signOf(side), y: 0, z: 0 });
  const on = p.wings.filter((x) => !x.torn).length;
  const spill = on > 0 ? p.fuel / on : 0;
  p.fuel -= spill;
  const sg = signOf(side);
  w.health = 0;
  w.touching = false;
  w.torn = {
    cause,
    t: run.t,
    fuel: spill,
    ...at,
    vx: vx * keep + outward.x * L.kick,
    vy: vy * keep + L.kick,
    vz: vz * keep + outward.z * L.kick,
    q: { ...p.q },
    // Tumbled about its chord (rolled over its root) and slewed off its
    // way, body frame — the airframe's own turn kept.
    wx: p.wx,
    wy: p.wy + sg * (cause === "load" ? 0.8 : 2.2),
    wz: p.wz + sg * (cause === "load" ? 4 : 2.5),
    rest: false,
  };
  say(run, events, "tear", at, hypot3(vx, vy, vz));
}

/** THE TREES ON THE WINGS this step: a trunk or the crown's limbs met fast
 * tear a wing off, the twigs batter it. */
function treeWings(run: GameState, p: PlaneState, events: GameEvent[]): void {
  if (p.agl > 60) return;
  const level = run.level;
  const T = N.trees;
  const cog = rotate(p.q, COG);
  const cx = p.x + cog.x;
  const cy = p.y + cog.y;
  const cz = p.z + cog.z;
  const speed = hypot3(p.vx, p.vy, p.vz);
  // A tree felled for the village or the strip stands nowhere.
  const gone = felledTrees(level);
  for (const i of treesNear(level, cx, cz, 14, near)) {
    if (gone[i]) continue;
    const t = level.trees[i];
    const top = t.y + t.height;
    for (const b of WING_TREE_POINTS) {
      const s = sideOf(b.x);
      if (p.wings[s].torn) continue;
      const r = rotate(p.q, b);
      const y = cy + r.y;
      if (y > top) continue;
      const d = hypot(cx + r.x - t.x, cz + r.z - t.z);
      const spread = t.crown * Math.min(1, (top - y) / Math.max(1, t.height * 0.8));
      const trunk = d < t.radius + 0.3;
      const limbs = d < spread * T.core;
      if ((trunk && speed > T.trunk) || (limbs && speed > T.limbs)) {
        tearWing(run, p, s, "tree", events);
        continue;
      }
      if (trunk || limbs || d < spread * T.twigs) {
        p.wings[s].health -= T.batter * (speed / 30) * dt * (trunk ? 4 : 1);
        p.wings[s].touching = true;
        torn[s] = "tree";
      }
    }
  }
}

const near: number[] = [];
const torn: TornWing["cause"][] = ["tip", "tip"];

/** THE WINGS JUDGED after the step: a tip pressed past what its spar holds
 * (less as it is battered) or a wing's lift past its ultimate load tears it
 * off; a scrape and the twigs wear it, and a wing worn through goes too. A
 * touch begun is a `scrape`. */
export function judgeWings(
  run: GameState,
  p: PlaneState,
  air: PlaneAir,
  events: GameEvent[],
): void {
  torn[0] = torn[1] = "tip";
  treeWings(run, p, events);
  const R = N.tear;
  const S = N.scrape;
  for (let s = 0; s < 2; s++) {
    const w = p.wings[s];
    if (w.torn) continue;
    // In the air: past the ultimate load up or down.
    const lift = s === 0 ? air.liftL : air.liftR;
    if (!p.grounded && (lift > N.air.up || lift < -N.air.down)) {
      tearWing(run, p, s, "load", events);
      continue;
    }
    if (w.force > 0) {
      const holds = R.force * (R.weak + (1 - R.weak) * clamp(w.health, 0, 1));
      if (w.force > holds) {
        tearWing(run, p, s, "tip", events);
        continue;
      }
      w.health -= ((w.force / R.force) ** 2 * S.rate + slide[s] * S.perMetre) * dt;
    }
    if (w.health <= 0) {
      tearWing(run, p, s, torn[s], events);
      continue;
    }
    if (w.touching && !was[s] && (w.force > S.least || w.force === 0)) {
      say(run, events, "scrape", worldOf(p, wingMiddle(s)), hypot3(p.vx, p.vy, p.vz));
    }
  }
}

/** THE TORN WINGS' FLIGHT this step: down under their weight against their
 * tumbling drag, onto the snow, bounced, slid and come to rest. */
export function stepLooseWings(run: GameState, p: PlaneState): void {
  const L = N.loose;
  const level = run.level;
  const g = TUNING.g;
  for (const w of p.wings) {
    const t = w.torn;
    if (!t || t.rest) continue;
    const v = hypot3(t.vx, t.vy, t.vz);
    const drag = (0.5 * p.density * L.drag * v) / L.mass;
    t.vx -= drag * t.vx * dt;
    t.vy -= (drag * t.vy + g) * dt;
    t.vz -= drag * t.vz * dt;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    t.z += t.vz * dt;
    t.q = integrate(t.q, t.wx, t.wy, t.wz, dt);
    const floor = level.groundAt(t.x, t.z) + 0.15;
    if (t.y <= floor) {
      t.y = floor;
      if (t.vy < 0) t.vy = -t.vy * L.bounce;
      const h = hypot(t.vx, t.vz);
      const keep = h > 1e-6 ? Math.max(0, h - L.friction * g * dt) / h : 0;
      t.vx *= keep;
      t.vz *= keep;
      const k = Math.exp(-4 * dt);
      t.wx *= k;
      t.wy *= k;
      t.wz *= k;
      // A slab on the snow falls over onto whichever face is nearer down:
      // turned about the level line across its lean until it lies flat.
      const up = rotate(t.q, { x: 0, y: 1, z: 0 });
      const s = up.y >= 0 ? 1 : -1;
      const fall = unrotate(t.q, { x: -up.z * s * L.settle, y: 0, z: up.x * s * L.settle });
      t.q = integrate(t.q, fall.x, fall.y, fall.z, dt);
      const flat = Math.abs(up.y) > 0.97;
      if (flat && h < L.rest && Math.abs(t.vy) < 1 && hypot3(t.wx, t.wy, t.wz) < 0.3) {
        t.rest = true;
        t.vx = t.vy = t.vz = 0;
        t.wx = t.wy = t.wz = 0;
      }
    } else {
      const k = Math.exp(-0.3 * dt);
      t.wx *= k;
      t.wy *= k;
      t.wz *= k;
    }
  }
}
