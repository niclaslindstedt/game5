// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A WAVE VEHICLE ON THE SNOW (`army-vehicle.ts`): how a carrier, a truck or
// a tank moves over the mountain, a step at a time, and what it does to a
// skier it meets.
//
// THE MOVE is a ground vehicle's on its tracks or its wheels, kept simple
// on purpose (dozens of them may be out, and each costs a step): its pace
// along its heading gathered and shed at its own rates, slowed up a rise in
// proportion to the steepest it climbs and stopped dead at it; its heading
// turned at its own rate (a tracked machine pivots on the spot, a truck
// turns no tighter than its wheels allow); its middle set on the snow and
// its attitude read off the ground under its ends and its sides. Nothing
// stood in the snow is driven through: a trunk, a post or a wall at its
// front, open water there, or another vehicle in its way stops it — and
// its watch (`army-vehicle.ts`) swings it off, backs it out or puts it
// back on the way. The vehicle a skier took (`armour.ts`) is driven on
// this same move, and stands in their way as theirs stand in his. A CARRIER'S REAR UNIT trails the front about the steered
// hitch between them, as a trailer does: its heading swings toward the
// front's at the pace over the hitch's length (θ' = v/L · sin(θf − θr)).
//
// THE SKIER is held out of every hull (`meetBoxes`, steel; a carrier's two
// units each a box). Met by a moving vehicle's front faster than
// `ARMY_VEHICLE.strike.closing` — and only where the army shoots to kill —
// he is knocked down (`armour`); a tank going on over him is
// `gore.ts`' to answer.
//
// Pure over the state; nothing here draws from any stream.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { waterWithin } from "../mapgen/real-water.ts";
import { meetBoxes, type StripBox } from "./airstrip-solids.ts";
import { throwRider } from "./crash.ts";
import { ARMY_VEHICLE, type VehicleSpec } from "./defs/army-vehicle.ts";
import { TUNING } from "./defs/tuning.ts";
import { lethalOf } from "./gunfire.ts";
import { solidsNear, solidsOf } from "./posts.ts";
import { tunnelWithin } from "./army-drive.ts";
import type { ArmyVehicle, ArmyVehicleEvent } from "./army-state.ts";
import type { GameEvent, GameState } from "./state.ts";

const dt = TUNING.dt;
const K = ARMY_VEHICLE;
const near: number[] = [];

/** A kind's body and drive. */
export const specOf = (v: Pick<ArmyVehicle, "kind">): VehicleSpec => K.kinds[v.kind];

/** Say what happened to `v`. */
export function sayVehicle(
  state: GameState,
  events: GameEvent[],
  change: ArmyVehicleEvent["change"],
  v: ArmyVehicle,
): void {
  events.push({
    kind: "army-vehicle",
    t: state.t,
    change,
    id: v.id,
    vehicle: v.kind,
    x: v.x,
    y: v.y,
    z: v.z,
  });
}

/** Where a carrier's rear unit's middle is, m. */
export function rearOf(v: Pick<ArmyVehicle, "x" | "z" | "heading" | "rear">): {
  x: number;
  z: number;
} {
  const R = K.rear;
  const hx = v.x - Math.sin(v.heading) * R.hitch;
  const hz = v.z - Math.cos(v.heading) * R.hitch;
  return { x: hx - Math.sin(v.rear) * R.back, z: hz - Math.cos(v.rear) * R.back };
}

/** WHAT STANDS within `r` m of (x, z) — every solid of the map (a trunk,
 * a post, a wall) whose own girth reaches that far, the trees felled for
 * the village (kept in the list with no girth) left out, and anything
 * thinner than `ARMY_VEHICLE.flatten` (a lamp's or a sign's post, a
 * sapling: driven over) — by index into `solidsOf`, into `out`. */
export function standingNear(
  level: GameState["level"],
  x: number,
  z: number,
  r: number,
  out: number[],
): number[] {
  solidsNear(level, x, z, r + 1, out);
  const all = solidsOf(level);
  let n = 0;
  for (const i of out) {
    const u = all[i];
    if (u.radius < K.flatten || u.height <= 0) continue;
    if (hypot(u.x - x, u.z - z) > r + u.radius) continue;
    out[n++] = i;
  }
  out.length = n;
  return out;
}

/** WHETHER SOMETHING STANDS IN ITS WAY at its front (or its back,
 * backing): a solid within its half width, open water, a wind tunnel's
 * tube, or another vehicle
 * of the waves within reach ahead. */
function blocked(state: GameState, v: ArmyVehicle, all: readonly ArmyVehicle[]): boolean {
  const S = specOf(v);
  const dir = v.speed >= 0 ? 1 : -1;
  const fx = Math.sin(v.heading) * dir;
  const fz = Math.cos(v.heading) * dir;
  const px = v.x + fx * (S.halfLength + 0.6);
  const pz = v.z + fz * (S.halfLength + 0.6);
  if (standingNear(state.level, px, pz, S.halfWidth * 0.8, near).length > 0) return true;
  if (waterWithin(state.level.water, px, pz, 1)) return true;
  // A wind tunnel's tube is a wall — unless it is already in one, when
  // it must be let out.
  if (
    tunnelWithin(state.level, px, pz, S.halfWidth * 0.8) &&
    !tunnelWithin(state.level, v.x, v.z, 0)
  )
    return true;
  // ...and the one he took, whoever is driving which.
  const his = state.armour?.body;
  const others = his && his !== v ? [...all, his] : all;
  for (const o of others) {
    if (o === v || o.mode === "due" || o.mode === "gone") continue;
    const dx = o.x - v.x;
    const dz = o.z - v.z;
    const along = dx * fx + dz * fz;
    const room = S.halfLength + specOf(o).halfLength + 2;
    if (along <= 0 || along > room) continue;
    if (Math.abs(dx * fz - dz * fx) < S.halfWidth + specOf(o).halfWidth + 0.5) return true;
  }
  return false;
}

/** ONE STEP OF THE MOVE toward `pace` m/s (negative: backing) on the way
 * `way` rad: the pace gathered or shed, slowed up a rise and stopped at
 * one too steep or by what stands in its way, the heading turned, the
 * middle set on the snow and the attitude read off it. */
export function moveVehicle(
  state: GameState,
  v: ArmyVehicle,
  pace: number,
  way: number,
  all: readonly ArmyVehicle[],
): void {
  const S = specOf(v);
  const level = state.level;
  const fx = Math.sin(v.heading);
  const fz = Math.cos(v.heading);
  // The rise under it along its heading, as a slope.
  const L = S.halfLength;
  const rise =
    (level.groundAt(v.x + fx * L, v.z + fz * L) - level.groundAt(v.x - fx * L, v.z - fz * L)) /
    (2 * L);
  const up = pace >= 0 ? rise : -rise;
  let want = pace;
  if (up > S.climb) want = 0;
  else if (up > 0) want *= 1 - (1 - S.creep) * (up / S.climb);
  const dv = want - v.speed;
  v.speed += clamp(dv, -S.brake * dt, (dv > 0 && v.speed >= 0 ? S.accel : S.brake) * dt);
  if (Math.abs(v.speed) > 0.05 && blocked(state, v, all)) v.speed = 0;
  // The turn: a tracked machine at any pace, a truck by its wheels.
  const most = S.radius > 0 ? Math.min(S.turn, Math.abs(v.speed) / S.radius) : S.turn;
  const off = angleDiff(v.heading, v.speed < -0.05 ? way + Math.PI : way);
  v.heading += clamp(off, -most * dt, most * dt);
  v.heading = Math.atan2(Math.sin(v.heading), Math.cos(v.heading));
  v.x += Math.sin(v.heading) * v.speed * dt;
  v.z += Math.cos(v.heading) * v.speed * dt;
  v.y = level.groundAt(v.x, v.z);
  // A carrier's rear unit trails the front about the hitch.
  if (v.kind === "carrier") {
    const r = (v.speed / (K.rear.hitch + K.rear.back)) * Math.sin(angleDiff(v.rear, v.heading));
    v.rear += r * dt;
    // Never folded past what the hitch's rams allow.
    v.rear = v.heading - clamp(angleDiff(v.rear, v.heading), -0.6, 0.6);
  } else v.rear = v.heading;
  // The attitude off the ground under its ends and its sides, eased.
  const W = S.halfWidth;
  const nx = Math.sin(v.heading);
  const nz = Math.cos(v.heading);
  const front = level.groundAt(v.x + nx * L, v.z + nz * L);
  const back = level.groundAt(v.x - nx * L, v.z - nz * L);
  const right = level.groundAt(v.x + nz * W, v.z - nx * W);
  const left = level.groundAt(v.x - nz * W, v.z + nx * W);
  const pitch = Math.atan2(front - back, 2 * L);
  const roll = Math.atan2(left - right, 2 * W);
  const k = Math.min(1, dt * 8);
  v.pitch += (pitch - v.pitch) * k;
  v.roll += (roll - v.roll) * k;
}

const hulls: StripBox[] = [];

/** One hull as a box on the snow. */
function hull(
  state: GameState,
  x: number,
  z: number,
  heading: number,
  S: VehicleSpec,
  half: number,
) {
  const g = state.level.groundAt(x, z);
  hulls.push({
    x,
    z,
    dx: Math.sin(heading),
    dz: Math.cos(heading),
    halfLength: half,
    halfWidth: S.halfWidth,
    base: g - 0.3,
    top: g + S.height,
    stuff: "steel",
  });
}

/** THE SKIER HELD OUT OF EVERY HULL — and, where the army shoots to kill,
 * knocked down by a moving vehicle's front that meets him faster than its
 * strike. */
export function holdOffVehicles(
  state: GameState,
  all: readonly ArmyVehicle[],
  events: GameEvent[],
): void {
  const c = state.skier;
  if (c.thrown || c.lift || state.sled?.rider || state.heli?.rider || state.plane?.rider) return;
  if (state.armour?.rider) return;
  hulls.length = 0;
  for (const v of all) {
    if (v.mode === "due" || v.mode === "gone") continue;
    const S = specOf(v);
    const reach = S.halfLength * 2 + 4;
    if (Math.abs(c.x - v.x) > reach || Math.abs(c.z - v.z) > reach) continue;
    if (strikes(state, v, S, events)) return;
    if (v.kind === "carrier") {
      hull(state, v.x, v.z, v.heading, S, S.halfLength);
      const r = rearOf(v);
      hull(state, r.x, r.z, v.rear, S, K.rear.back + 0.2);
    } else hull(state, v.x, v.z, v.heading, S, S.halfLength);
  }
  if (hulls.length) meetBoxes(state, hulls, events);
}

/** A MOVING FRONT INTO HIM: he is within half a metre of its face, and
 * the two close faster than its strike — knocked down, thrown off it the
 * way it goes. */
function strikes(state: GameState, v: ArmyVehicle, S: VehicleSpec, events: GameEvent[]): boolean {
  if (Math.abs(v.speed) < 1 || !lethalOf(state)) return false;
  const c = state.skier;
  const dir = v.speed > 0 ? 1 : -1;
  const fx = Math.sin(v.heading) * dir;
  const fz = Math.cos(v.heading) * dir;
  const dx = c.x - v.x;
  const dz = c.z - v.z;
  const along = dx * fx + dz * fz;
  const across = dx * fz - dz * fx;
  if (
    along < S.halfLength - 0.5 ||
    along > S.halfLength + 0.8 ||
    Math.abs(across) > S.halfWidth + 0.3
  )
    return false;
  if (c.y > v.y + S.height || c.y < v.y - 1.5) return false;
  const speed = Math.abs(v.speed);
  const closing = speed - (c.vx * fx + c.vz * fz);
  if (closing < K.strike.closing) return false;
  sayVehicle(state, events, "strike", v);
  throwRider(
    state,
    "armour",
    { x: fx * (speed + 2) + c.vx * 0.3, y: 2.5, z: fz * (speed + 2) + c.vz * 0.3 },
    events,
  );
  return true;
}

/** How far it has come off the snow it stood on at the watch's last look. */
export const movedSince = (v: ArmyVehicle): number => hypot(v.x - v.wx, v.z - v.wz);
