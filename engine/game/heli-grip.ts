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
import { rotate, unrotate, type Quat } from "@niclaslindstedt/oss-game-framework/core/quat";
import { HELI } from "./defs/heli.ts";
import { TUNING } from "./defs/tuning.ts";
import { heliPoint, heliQuat } from "./heli-rotor.ts";
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
  const dt = TUNING.dt;
  if (load > G.hold) h.grip -= ((load - G.hold) / ((1 - G.hold) * G.endure)) * dt;
  else h.grip = Math.min(1, h.grip + dt / G.recover);
  return h.grip <= 0;
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
