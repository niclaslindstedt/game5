// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKIER MEETING THE VILLAGE'S TRAFFIC (`traffic.ts`) on a run whose rules
// carry it (`RunRules.traffic`, the free ride): a car's, the bus's, a
// bicycle's or a parked car's footprint, as the piste machines' is met
// (`groomer.ts`'s `groomerStrike`) — pushed out through its nearest side,
// held off it when the two close gently (a shuffle), and knocked down when
// they close harder, thrown off the bodywork (the `car` crash cause, whose
// blow `body.ts` reads). The vehicle never notices: it is where the plan
// has it.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { TRAFFIC, TRAFFIC_STRIKE as K, VEHICLES, type VehicleKind } from "./defs/traffic.ts";
import { onSkis } from "./groomer.ts";
import { derive } from "./skier.ts";
import type { GameEvent, GameState } from "./state.ts";
import { freshVehiclePose, nearTraffic, trafficOf, vehicleAt } from "./traffic.ts";

/** A SKIER KNOCKED DOWN by a vehicle: which kind, where, and the speed
 * the two closed at. */
export type TrafficEvent = {
  kind: "traffic";
  t: number;
  phase: "strike";
  vehicle: VehicleKind;
  x: number;
  z: number;
  speed: number;
};

/** The skier's reach round his middle, m. */
const R = 0.35;

const pose = freshVehiclePose();

/** One footprint met: pushed out of it, and the velocity he is thrown
 * with when met hard, or null. */
function meet(
  state: GameState,
  kind: VehicleKind,
  x: number,
  y: number,
  z: number,
  heading: number,
  speed: number,
  events: GameEvent[],
): { x: number; y: number; z: number } | null {
  const c = state.skier;
  const V = VEHICLES[kind];
  if (c.y > y + V.height + 0.3 || c.y < y - 1.5) return null;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const dx = c.x - x;
  const dz = c.z - z;
  const u = dx * fx + dz * fz;
  const v = dx * fz - dz * fx;
  const hl = V.length / 2;
  const hw = V.width / 2;
  const ou = Math.max(0, u - hl, -hl - u);
  const ov = Math.max(0, Math.abs(v) - hw);
  if (hypot(ou, ov) >= R) return null;
  // Out through the nearest face.
  const dFront = hl + R - u;
  const dBack = u + hl + R;
  const dSide = hw + R - Math.abs(v);
  let nx: number;
  let nz: number;
  let depth: number;
  if (dSide < Math.min(dFront, dBack)) {
    const s = v >= 0 ? 1 : -1;
    nx = fz * s;
    nz = -fx * s;
    depth = dSide;
  } else if (dFront < dBack) {
    nx = fx;
    nz = fz;
    depth = dFront;
  } else {
    nx = -fx;
    nz = -fz;
    depth = dBack;
  }
  c.x += nx * depth;
  c.z += nz * depth;
  const rel = (c.vx - fx * speed) * nx + (c.vz - fz * speed) * nz;
  if (rel >= 0 || -rel <= K.push) {
    if (rel < 0) {
      c.vx -= rel * nx;
      c.vz -= rel * nz;
    }
    derive(c, state.level);
    return null;
  }
  events.push({
    kind: "traffic",
    t: state.t,
    phase: "strike",
    vehicle: kind,
    x: c.x,
    z: c.z,
    speed: -rel,
  });
  const k = (1 + K.bounce) * rel;
  return { x: c.vx - k * nx, y: c.vy, z: c.vz - k * nz };
}

/** THE TRAFFIC MET: the skier on his skis against every vehicle on the
 * streets and every car parked — held off, or the velocity he is thrown
 * with (and the kind that threw him) when one met him hard. After the
 * skier's own step. */
export function trafficStrike(
  state: GameState,
  events: GameEvent[],
): { v: { x: number; y: number; z: number }; vehicle: VehicleKind } | null {
  if (!state.rules.traffic || !onSkis(state)) return null;
  const plan = trafficOf(state.level);
  const c = state.skier;
  if (!plan || !nearTraffic(plan, c.x, c.z, TRAFFIC.pass.ahead)) return null;
  for (let k = 0; k < plan.vehicles.length; k++) {
    vehicleAt(plan, k, state.t, pose);
    if (!pose.shown) continue;
    const reach = VEHICLES[pose.kind].length / 2 + R + 1;
    if (Math.abs(pose.x - c.x) > reach || Math.abs(pose.z - c.z) > reach) continue;
    const v = meet(state, pose.kind, pose.x, pose.y, pose.z, pose.heading, pose.speed, events);
    if (v) return { v, vehicle: pose.kind };
  }
  for (const p of plan.parked) {
    const reach = VEHICLES[p.kind].length / 2 + R + 1;
    if (Math.abs(p.x - c.x) > reach || Math.abs(p.z - c.z) > reach) continue;
    const v = meet(state, p.kind, p.x, p.y, p.z, p.heading, 0, events);
    if (v) return { v, vehicle: p.kind };
  }
  return null;
}
