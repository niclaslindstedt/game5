// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RAM-AIR WING ON ITS LINES — the maths the paramotor's wing (`para.ts`)
// and the skydiver's canopy (`chute.ts`) both fly by, stated once: the
// lines' direction, the air's way square to them (the way the canopy noses
// into the flow), the lift square to the air on the lines' side and the
// drag down it, the swing about the pilot damped against the air, the lines
// pulled tight (they only pull), a crown the cloth is in, and a released
// piece falling as cloth. Each is the same arithmetic in the same order the
// paramotor first flew, so it flies bit for bit as it did.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { treesNear } from "./upright-grid.ts";
import type { Level } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";
import { derive } from "./skier.ts";
import type { GameState } from "./state.ts";

/** A body of the rig: where, m, and how fast, m/s, world frame. */
export type Moving = { x: number; y: number; z: number; vx: number; vy: number; vz: number };
/** A vector, written into. */
export type V3 = { x: number; y: number; z: number };

const dt = TUNING.dt;

/** THE LINES' DIRECTION, the pilot to the wing, unit, into `out` — straight
 * up when the two stand together. */
export function lineDir(wing: V3, pilot: V3, out: V3): V3 {
  let ux = wing.x - pilot.x;
  let uy = wing.y - pilot.y;
  let uz = wing.z - pilot.z;
  const len = hypot3(ux, uy, uz);
  if (len > 1e-6) {
    ux /= len;
    uy /= len;
    uz /= len;
  } else {
    ux = uz = 0;
    uy = 1;
  }
  out.x = ux;
  out.y = uy;
  out.z = uz;
  return out;
}

/** THE WING'S WAY: the air through it (`ax, ay, az`) square to the lines
 * `u` — the canopy noses into the flow — else `heading`'s, into `out`. */
export function wayOf(
  ax: number,
  ay: number,
  az: number,
  down: number,
  u: V3,
  heading: number,
  out: V3,
): V3 {
  let fwx = ax - down * u.x;
  let fwy = ay - down * u.y;
  let fwz = az - down * u.z;
  const fl = hypot3(fwx, fwy, fwz);
  if (fl > 0.5) {
    fwx /= fl;
    fwy /= fl;
    fwz /= fl;
  } else {
    fwx = Math.sin(heading);
    fwy = 0;
    fwz = Math.cos(heading);
  }
  out.x = fwx;
  out.y = fwy;
  out.z = fwz;
  return out;
}

/** THE AIR'S FORCE on the wing, N, into `out`: `lift` (a coefficient)
 * square to the air (`ax, ay, az`, of speed `V`) on the lines' (`u`) side,
 * `drag` down the air, both times `qS`. Nothing below a crawl of air. */
export function liftDrag(
  ax: number,
  ay: number,
  az: number,
  V: number,
  u: V3,
  qS: number,
  lift: number,
  drag: number,
  out: V3,
): V3 {
  let fx = 0;
  let fy = 0;
  let fz = 0;
  if (V > 0.1) {
    const vx = ax / V;
    const vy = ay / V;
    const vz = az / V;
    const along = u.x * vx + u.y * vy + u.z * vz;
    let lx = u.x - along * vx;
    let ly = u.y - along * vy;
    let lz = u.z - along * vz;
    const ll = hypot3(lx, ly, lz);
    if (ll > 1e-6) {
      lx /= ll;
      ly /= ll;
      lz /= ll;
    }
    fx = qS * (lift * lx - drag * vx);
    fy = qS * (lift * ly - drag * vy);
    fz = qS * (lift * lz - drag * vz);
  }
  out.x = fx;
  out.y = fy;
  out.z = fz;
  return out;
}

/** THE SWING DAMPED: the wing's motion about the pilot square to the lines
 * `u`, against the air at `damping` N per m/s — the force on the wing into
 * `out`, its opposite taken off the pilot (of mass `M`) now. */
export function swingDamp(
  wing: Moving,
  pilot: Moving,
  u: V3,
  damping: number,
  M: number,
  out: V3,
): V3 {
  const rvx = wing.vx - pilot.vx;
  const rvy = wing.vy - pilot.vy;
  const rvz = wing.vz - pilot.vz;
  const rl = rvx * u.x + rvy * u.y + rvz * u.z;
  const dx = -damping * (rvx - rl * u.x);
  const dy = -damping * (rvy - rl * u.y);
  const dz = -damping * (rvz - rl * u.z);
  pilot.vx -= (dx / M) * dt;
  pilot.vy -= (dy / M) * dt;
  pilot.vz -= (dz / M) * dt;
  out.x = dx;
  out.y = dy;
  out.z = dz;
  return out;
}

/** THE LINES PULLED TIGHT: the stretch past `lines` m taken out of the
 * wing (of mass `wingMass`) and the pilot (`M`) by their masses, and their
 * speed apart along the lines. The pull on them, N — 0 slack. */
export function pullLines(
  wing: Moving,
  pilot: Moving,
  lines: number,
  wingMass: number,
  M: number,
): number {
  const iw = 1 / wingMass;
  const ip = 1 / M;
  const sum = iw + ip;
  let nx = wing.x - pilot.x;
  let ny = wing.y - pilot.y;
  let nz = wing.z - pilot.z;
  const d = hypot3(nx, ny, nz);
  let tension = 0;
  if (d > lines) {
    nx /= d;
    ny /= d;
    nz /= d;
    const err = d - lines;
    wing.x -= nx * err * (iw / sum);
    wing.y -= ny * err * (iw / sum);
    wing.z -= nz * err * (iw / sum);
    pilot.x += nx * err * (ip / sum);
    pilot.y += ny * err * (ip / sum);
    pilot.z += nz * err * (ip / sum);
    const apart = (wing.vx - pilot.vx) * nx + (wing.vy - pilot.vy) * ny + (wing.vz - pilot.vz) * nz;
    if (apart > 0) {
      const j = apart / sum;
      wing.vx -= nx * j * iw;
      wing.vy -= ny * j * iw;
      wing.vz -= nz * j * iw;
      pilot.vx += nx * j * ip;
      pilot.vy += ny * j * ip;
      pilot.vz += nz * j * ip;
      tension = j / dt;
    }
  }
  return tension;
}

const trees: number[] = [];

/** THE CROWN the cloth at (x, y, z) is in — under the tree's top and
 * within `reach` m of its crown's edge — by its index into `level.trees`,
 * or −1. */
export function crownAt(level: Level, x: number, y: number, z: number, reach: number): number {
  const near = treesNear(level, x, z, 12, trees);
  for (let i = 0; i < near.length; i++) {
    const t = level.trees[near[i]];
    if (y < t.y + t.height && hypot(x - t.x, z - t.z) < t.crown + reach) return near[i];
  }
  return -1;
}

/** A released piece of the rig falling under its drag area `area`, m², of
 * mass `mass`, kg — against the air moving at (`wx`, `wz`), m/s — and lying
 * where it lands. */
export function fallPiece(
  level: Level,
  b: Moving & { down: boolean },
  mass: number,
  area: number,
  wx = 0,
  wz = 0,
): void {
  if (b.down) return;
  const ax = b.vx - wx;
  const az = b.vz - wz;
  const v = hypot3(ax, b.vy, az);
  const k = (0.5 * TUNING.airDensity * area * v) / mass;
  b.vx -= ax * k * dt;
  b.vy -= (b.vy * k + TUNING.g) * dt;
  b.vz -= az * k * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  const ground = level.groundAt(b.x, b.z);
  if (b.y <= ground) {
    b.y = ground;
    b.vx = b.vy = b.vz = 0;
    b.down = true;
  }
}

/** How fast the hanging pilot turns to the wing's heading and bank, s. */
const SWING = 0.3;
/** The most the hanging pilot is drawn banked, rad. */
const BANK_MOST = 1.15;

/** THE PILOT IN THE HARNESS, off the snow `agl` m: turned to the wing's
 * `heading`, hung under its `bank`, leant `lean` rad (forward negative) —
 * and, near the snow (from `stand` m over it, fully by `square` m), stood
 * up with his skis squared to the slope under him to land. */
export function hangUnder(
  state: GameState,
  heading: number,
  bank: number,
  agl: number,
  lean: number,
  stand: number,
  square: number,
): void {
  const c = state.skier;
  const level = state.level;
  const sq = clamp((stand - agl) / (stand - square), 0, 1);
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const L = c.spec.length / 2;
  const Wd = Math.max(0.3, c.spec.stance / 2);
  const slopePitch = Math.atan2(
    level.groundAt(c.x + fx * L, c.z + fz * L) - level.groundAt(c.x - fx * L, c.z - fz * L),
    2 * L,
  );
  const slopeRoll = Math.atan2(
    level.groundAt(c.x - fz * Wd, c.z + fx * Wd) - level.groundAt(c.x + fz * Wd, c.z - fx * Wd),
    2 * Wd,
  );
  const b = clamp(bank, -BANK_MOST, BANK_MOST);
  const wantPitch = slopePitch * sq + lean * (1 - sq);
  const wantRoll = b * (1 - sq) + slopeRoll * sq;
  const k = 1 - Math.exp(-dt / SWING);
  let dh = heading - c.heading;
  dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  const h = c.heading + dh * k;
  const pitch = c.pitch + (wantPitch - c.pitch) * k;
  const roll = c.roll + (wantRoll - c.roll) * k;
  c.q = fromEuler(h, pitch, roll);
  c.wx = c.wy = c.wz = 0;
  derive(c, level);
}
