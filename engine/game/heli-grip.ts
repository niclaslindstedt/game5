// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER'S HOLD ON THE SKID, AND THE ROTOR OVER HIM (`heli.ts`). Sat on
// the right skid's tube with his back to the cabin, nothing straps him in:
// the seat and the cabin's side carry what presses him into them and his
// HANDS the rest (`HELI.grip`). Rolled or looped past what they hold, the
// hold drains and he lets go — and a machine turned over him has its rotor
// under him: his fall is taken in its own frame (`HELI.blades.carry`) so it
// runs down through the disc, and every point of his body a blade passes
// through is struck there — kicked along the blade's way and, on a run that
// carries its wounds, torn off (`gore.ts`'s `rotor`).
//
// Pure over the state and the clock: nothing here draws from the stream,
// and a run whose rules carry no helicopter never comes in here.

import { hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  normalize,
  rotate,
  unrotate,
  type Quat,
  type Vec3,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import { HELI } from "./defs/heli.ts";
import { TUNING } from "./defs/tuning.ts";
import { SEAT, heliPoint, heliQuat } from "./heli-rotor.ts";
import { RAGDOLL } from "./ragdoll.ts";
import type { GameEvent, GameState, HeliState, Thrown } from "./state.ts";

const G = HELI.grip;
const B = HELI.blades;
const R = HELI.rotor.radius;
/** The rotor's turn a second at full rpm, rad/s. */
const OMEGA = (HELI.rotor.rpm / 60) * 2 * Math.PI;
/** The hub, body frame. */
const HUB = { x: 0, y: HELI.rotor.hub, z: HELI.rotor.at };
/** How near the disc's plane a point counts as in it, m — a blade's chord
 * and its coning, near enough. */
const SLAB = 0.12;

/** WHAT HIS HANDS CARRY, a share of his weight, sat at `q` (his own frame:
 * x his right, y up, z out over the skid): gravity's pull off the seat
 * (y up), forward off the tube (z out) and along it (x), less what the
 * seat and the cabin's side carry by their friction. */
export function gripLoad(q: Quat): number {
  const g = unrotate(q, { x: 0, y: -1, z: 0 });
  const seat = Math.max(0, -g.y);
  const back = Math.max(0, -g.z);
  const off = Math.max(0, g.y);
  const out = Math.max(0, g.z - G.friction * seat);
  const along = Math.max(0, Math.abs(g.x) - G.friction * (seat + back));
  return hypot(off, hypot(out, along));
}

/** ONE STEP OF HIS HOLD, sat at `q` in the air: drained past `hold`,
 * coming back under it. True when it has given out. */
export function stepGrip(h: HeliState, q: Quat): boolean {
  const load = gripLoad(q);
  h.load = load;
  const dt = TUNING.dt;
  if (load > G.hold) h.grip -= ((load - G.hold) / ((1 - G.hold) * G.endure)) * dt;
  else h.grip = Math.min(1, h.grip + dt / G.recover);
  return h.grip <= 0;
}

/** The fuselage's side and floor off the tube he hangs from, m, his body's
 * half thickness kept off them (`HELI.grip.hang.clear`). */
const CABIN_SIDE = Math.abs(SEAT.x) - HELI.body.width / 2 - G.hang.clear;
const CABIN_FLOOR = HELI.body.floor - SEAT.y - G.hang.clear;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Where he is sat or hung, world frame: his body's origin and its
 * orientation. */
type Frame = { x: number; y: number; z: number; q: Quat };

/** HUNG FROM HIS HANDS (`HELI.grip.hang`): the seat's frame `s` carried
 * over to his body swung under his grip on the tube by `HeliState.hung`,
 * which this steps (once a step, off `HeliState.load`) — and the
 * pendulum with it. Sat, `s` itself. */
export function hangFrame(h: HeliState, s: Frame): Frame {
  const H = G.hang;
  const dt = TUNING.dt;
  const want = smooth(H.from, H.full, h.load);
  const was = h.hung;
  h.hung = Math.max(
    0,
    Math.min(1, h.hung + Math.max(-dt / H.off, Math.min(dt / H.on, want - h.hung))),
  );
  if (h.hung <= 0) return s;
  const q = heliQuat(h);
  const grip = heliPoint(h, SEAT);
  const w = h.sway;
  if (was <= 0) {
    // Slid off the tube forward, out over the snow, his hands behind him.
    const off = rotate(q, { x: Math.sign(SEAT.x) * H.slid.out, y: -H.slid.down, z: 0 });
    w.x = grip.x + off.x * H.reach;
    w.y = grip.y + off.y * H.reach;
    w.z = grip.z + off.z * H.reach;
    w.vx = h.vx;
    w.vy = h.vy;
    w.vz = h.vz;
  }
  // Gravity, and his arms and the air damping him against the machine's way.
  w.vx -= H.damp * (w.vx - h.vx) * dt;
  w.vy -= (TUNING.g + H.damp * (w.vy - h.vy)) * dt;
  w.vz -= H.damp * (w.vz - h.vz) * dt;
  const ox = w.x;
  const oy = w.y;
  const oz = w.z;
  let dx = w.x + w.vx * dt - grip.x;
  let dy = w.y + w.vy * dt - grip.y;
  let dz = w.z + w.vz * dt - grip.z;
  // Kept out of the cabin: his middle never in the fuselage's side of the
  // tube and over its floor at once — pushed to the nearer of the two —
  // so he hangs down its side or swings in under its belly.
  const m = unrotate(q, { x: dx, y: dy, z: dz });
  const inward = -Math.sign(SEAT.x);
  const a = m.x * inward - CABIN_SIDE;
  const b = m.y - CABIN_FLOOR;
  if (a > 0 && b > 0) {
    if (a < b) m.x -= a * inward;
    else m.y -= b;
    ({ x: dx, y: dy, z: dz } = rotate(q, m));
  }
  const len = hypot3(dx, dy, dz) || 1;
  w.x = grip.x + (dx / len) * H.reach;
  w.y = grip.y + (dy / len) * H.reach;
  w.z = grip.z + (dz / len) * H.reach;
  w.vx = (w.x - ox) / dt;
  w.vy = (w.y - oy) / dt;
  w.vz = (w.z - oz) / dt;
  // His body stood along the line up to his hands, the tube across his
  // grip his right (or, the tube stood on end, facing out off the
  // machine), turned to from the seat's by how far he hangs.
  const k = h.hung;
  const turned = slerp(s.q, hangQuat(s.q, q, -dx / len, -dy / len, -dz / len), k);
  return {
    x: s.x + (w.x - s.x) * k,
    y: s.y + (w.y - s.y) * k,
    z: s.z + (w.z - s.z) * k,
    q: turned,
  };
}

/** The body's orientation with its up along (`ux`, `uy`, `uz`) and its
 * right as near the seat's right as that allows — else its forward as near
 * the machine's out. */
function hangQuat(seat: Quat, machine: Quat, ux: number, uy: number, uz: number): Quat {
  const u = { x: ux, y: uy, z: uz };
  const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a: Vec3, b: Vec3): Vec3 => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  });
  const off = (v: Vec3): Vec3 => {
    const d = dot(v, u);
    return { x: v.x - u.x * d, y: v.y - u.y * d, z: v.z - u.z * d };
  };
  let r = off(rotate(seat, { x: 1, y: 0, z: 0 }));
  let n = hypot3(r.x, r.y, r.z);
  if (n < 0.3) {
    const f = off(rotate(machine, { x: Math.sign(SEAT.x), y: 0, z: 0 }));
    r = cross(u, f);
    n = hypot3(r.x, r.y, r.z) || 1;
  }
  r = { x: r.x / n, y: r.y / n, z: r.z / n };
  const f = cross(r, u);
  // The rotation whose columns are right, up and forward.
  const [m00, m01, m02] = [r.x, u.x, f.x];
  const [m10, m11, m12] = [r.y, u.y, f.y];
  const [m20, m21, m22] = [r.z, u.z, f.z];
  const tr = m00 + m11 + m22;
  let q: Quat;
  if (tr > 0) {
    const t = Math.sqrt(tr + 1) * 2;
    q = { w: t / 4, x: (m21 - m12) / t, y: (m02 - m20) / t, z: (m10 - m01) / t };
  } else if (m00 > m11 && m00 > m22) {
    const t = Math.sqrt(1 + m00 - m11 - m22) * 2;
    q = { w: (m21 - m12) / t, x: t / 4, y: (m01 + m10) / t, z: (m02 + m20) / t };
  } else if (m11 > m22) {
    const t = Math.sqrt(1 + m11 - m00 - m22) * 2;
    q = { w: (m02 - m20) / t, x: (m01 + m10) / t, y: t / 4, z: (m12 + m21) / t };
  } else {
    const t = Math.sqrt(1 + m22 - m00 - m11) * 2;
    q = { w: (m10 - m01) / t, x: (m02 + m20) / t, y: (m12 + m21) / t, z: t / 4 };
  }
  return normalize(q);
}

/** From `a` to `b` by `k`, the short way round. */
function slerp(a: Quat, b: Quat, k: number): Quat {
  if (k <= 0) return a;
  let d = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
  const s = d < 0 ? -1 : 1;
  d *= s;
  if (k >= 1) return b;
  if (d > 0.9995) {
    return normalize({
      x: a.x + (s * b.x - a.x) * k,
      y: a.y + (s * b.y - a.y) * k,
      z: a.z + (s * b.z - a.z) * k,
      w: a.w + (s * b.w - a.w) * k,
    });
  }
  const th = Math.acos(d);
  const wa = Math.sin((1 - k) * th) / Math.sin(th);
  const wb = (s * Math.sin(k * th)) / Math.sin(th);
  return {
    x: a.x * wa + b.x * wb,
    y: a.y * wa + b.y * wb,
    z: a.z * wa + b.z * wb,
    w: a.w * wa + b.w * wb,
  };
}

/** WHETHER HIS FALL FROM THE SEAT RUNS INTO THE DISC: the line gravity
 * pulls him along in the machine's frame, from his middle sat on the
 * skid, met by the disc's plane inside its radius. */
export function fallsIntoRotor(h: HeliState, seat: { x: number; y: number; z: number }): boolean {
  const g = unrotate(heliQuat(h), { x: 0, y: -1, z: 0 });
  if (g.y < 0.1) return false;
  const k = (HUB.y - seat.y) / g.y;
  if (k <= 0) return false;
  return hypot(seat.x + g.x * k - HUB.x, seat.z + g.z * k - HUB.z) < R + 0.4;
}

/** HIS FALL IN THE MACHINE'S FRAME: every point of his body given the
 * airframe's own acceleration this step (`ax`, `ay`, `az`, m/s²) on top of
 * the gravity the ragdoll already falls by. */
export function carryFall(b: Thrown, ax: number, ay: number, az: number): void {
  const dt2 = TUNING.dt * TUNING.dt;
  const P = b.points;
  for (let i = 0; i < RAGDOLL.count; i++) {
    P[3 * i] += ax * dt2;
    P[3 * i + 1] += ay * dt2;
    P[3 * i + 2] += az * dt2;
  }
}

/** THE BLADE'S WAY AT A POINT of the disc, world frame, m/s, into `out`:
 * the rotor turning clockwise seen from over it (against its torque, which
 * swings the nose left — `heli.ts`), Ω·r at the rotor's speed. */
export function bladeAt(
  h: HeliState,
  x: number,
  y: number,
  z: number,
  out: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const q = heliQuat(h);
  const hub = heliPoint(h, HUB);
  const p = unrotate(q, { x: x - hub.x, y: y - hub.y, z: z - hub.z });
  const w = OMEGA * h.spool;
  const v = rotate(q, { x: p.z * w, y: 0, z: -p.x * w });
  out.x = v.x;
  out.y = v.y;
  out.z = v.z;
  return out;
}

const blade = { x: 0, y: 0, z: 0 };

/** THE ROTOR THROUGH A BODY THROWN NEAR IT, after the ragdoll's step: each
 * point that crossed the disc's plane this step (or lies in it) inside its
 * radius, with the rotor turning, is struck — kicked along the blade's way
 * and down with the wash, and written to `HeliState.cut` for the body and
 * the wounds to read. A point is struck once. */
export function rotorStrike(run: GameState, b: Thrown, events: GameEvent[]): void {
  const h = run.heli;
  if (!h) return;
  h.cut = 0;
  h.cutSpeed = 0;
  if (h.rider || h.mode === "wreck" || h.mode === "parked" || h.spool < B.spool) return;
  const hub = heliPoint(h, HUB);
  if (hypot3(b.x - hub.x, b.y - hub.y, b.z - hub.z) > R + 3) return;
  const dt = TUNING.dt;
  const q = heliQuat(h);
  const down = rotate(q, { x: 0, y: -1, z: 0 });
  const was = { x: hub.x - h.vx * dt, y: hub.y - h.vy * dt, z: hub.z - h.vz * dt };
  const P = b.points;
  const L = b.last;
  for (let i = 0; i < RAGDOLL.count; i++) {
    const bit = 1 << i;
    if (h.taken & bit) continue;
    const j = 3 * i;
    const now = unrotate(q, { x: P[j] - hub.x, y: P[j + 1] - hub.y, z: P[j + 2] - hub.z });
    const then = unrotate(q, { x: L[j] - was.x, y: L[j + 1] - was.y, z: L[j + 2] - was.z });
    const crossed = now.y > 0 !== then.y > 0 || Math.abs(now.y) < SLAB;
    const r = hypot(now.x, now.z);
    if (!crossed || r < B.mast || r > R) continue;
    h.cut |= bit;
    h.taken |= bit;
    bladeAt(h, P[j], P[j + 1], P[j + 2], blade);
    const speed = hypot3(blade.x, blade.y, blade.z);
    h.cutSpeed = Math.max(h.cutSpeed, speed);
    // The kick, as a change of the step's way (`last` is a step back).
    const kx = blade.x * B.kick + down.x * B.wash;
    const ky = blade.y * B.kick + down.y * B.wash;
    const kz = blade.z * B.kick + down.z * B.wash;
    L[j] -= kx * dt;
    L[j + 1] -= ky * dt;
    L[j + 2] -= kz * dt;
  }
  if (!h.cut) return;
  if (h.bladed < 0) h.bladed = run.t;
  events.push({
    kind: "heli",
    t: run.t,
    phase: "rotor",
    x: b.x,
    y: b.y,
    z: b.z,
    speed: h.cutSpeed,
  });
}
