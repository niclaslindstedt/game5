// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S TRAFFIC — the cars, the ski bus and the bicycles on a ski
// area's village streets (`village.ts`), and the cars parked along its
// kerbs and in its day car park. Planned once a map (`traffic-plan.ts`,
// over the routes `traffic-route.ts` lays), and read here: where each
// vehicle is at a moment (`vehicleAt`) is a PURE FUNCTION OF THE MAP AND
// THE CLOCK, as a lift's chairs are (`lift-line.ts`'s `carrierAt`) —
// nothing stepped, nothing stored on the state, nothing drawn from any
// stream — so the engine (a skier met, `traffic-contact.ts`), the drawing
// and the sound all ask the one question and get the one answer, and no
// digest moves.
//
// A car overtaking a cyclist on his own lane swings out round him: the
// one meeting the plan does not hold the two apart for (`TRAFFIC.pass`).

import type { Level } from "../mapgen/types.ts";
import { TRAFFIC as T, VEHICLES, type VehicleKind } from "./defs/traffic.ts";
import {
  freshRoutePose,
  planTraffic,
  routeAt,
  type Parked,
  type RoutePose,
  type TrafficPlan,
  type Vehicle,
} from "./traffic-plan.ts";
import { villageOf } from "./village.ts";

const plans = new WeakMap<Level, TrafficPlan | null>();

/** THE TRAFFIC of `level`'s village, worked out once, or null where it
 * has no streets. */
export function trafficOf(level: Level): TrafficPlan | null {
  const had = plans.get(level);
  if (had !== undefined) return had;
  const v = villageOf(level);
  const plan = v ? planTraffic(level, v) : null;
  plans.set(level, plan);
  return plan;
}

/** A VEHICLE AT A MOMENT (`vehicleAt`): whether it is on the map (a car
 * off down the road out is not), its middle on the snow, the way its body
 * faces and its speed along that (negative backing), the front wheels'
 * turn (rad, positive toward the heading's growing side), how far its
 * wheels have rolled (m — a wheel's turn is that over its radius), its
 * brake lights, its indicator (−1, 0, 1: the side it turns to, by the
 * heading's sign) and the lane it is on (an index into the plan's lanes,
 * −1 between them). */
export type VehiclePose = {
  shown: boolean;
  kind: VehicleKind;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  steer: number;
  roll: number;
  brake: boolean;
  signal: -1 | 0 | 1;
  lane: number;
};

export function freshVehiclePose(): VehiclePose {
  return {
    shown: false,
    kind: "hatch",
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    speed: 0,
    steer: 0,
    roll: 0,
    brake: false,
    signal: 0,
    lane: -1,
  };
}

/** How far the middle of a vehicle of `kind` stands ahead of its rear
 * axle, m. */
export function axleToMiddle(kind: VehicleKind): number {
  const V = VEHICLES[kind];
  return V.length / 2 - (V.length - V.wheelbase - V.front);
}

const rear = freshRoutePose();
const other = freshRoutePose();

/** The rear axle of vehicle `veh` at `t`, into `out`. */
function rearOf(plan: TrafficPlan, veh: Vehicle, t: number, out: RoutePose): RoutePose {
  return routeAt(plan.routes[veh.route], t + veh.phase, out);
}

/** How far a car swings out round a cyclist on its lane at `t`, m. */
function swingOut(plan: TrafficPlan, veh: Vehicle, p: RoutePose, t: number): number {
  if (veh.kind === "bike" || p.lane < 0) return 0;
  const fx = Math.sin(p.facing);
  const fz = Math.cos(p.facing);
  const mid = axleToMiddle(veh.kind);
  let most = 0;
  for (const b of plan.vehicles) {
    if (b.kind !== "bike") continue;
    rearOf(plan, b, t, other);
    if (!other.shown || other.lane !== p.lane) continue;
    const along = (other.x - p.x) * fx + (other.z - p.z) * fz - mid;
    const P = T.pass;
    const half = VEHICLES[veh.kind].length / 2;
    if (along > P.ahead + half || along < -P.behind - half) continue;
    // Out full beside him, eased in over the way up to him and back.
    const lead = Math.max(0, along - half) / P.ahead;
    const tail = Math.max(0, -along - half) / P.behind;
    const w = 1 - Math.min(1, Math.max(lead, tail));
    most = Math.max(most, P.swing * w * w * (3 - 2 * w));
  }
  return most;
}

/**
 * VEHICLE `k` OF THE PLAN AT `t` s of the run's clock, into `out`: off its
 * route at its phase, its middle the rear axle's line carried forward, and
 * — a car beside a cyclist on its lane — swung out round him.
 */
export function vehicleAt(plan: TrafficPlan, k: number, t: number, out: VehiclePose): VehiclePose {
  const veh = plan.vehicles[k];
  const V = VEHICLES[veh.kind];
  rearOf(plan, veh, t, rear);
  out.kind = veh.kind;
  out.shown = rear.shown;
  out.lane = rear.lane;
  if (!rear.shown) {
    out.speed = 0;
    out.brake = false;
    out.signal = 0;
    return out;
  }
  const fx = Math.sin(rear.facing);
  const fz = Math.cos(rear.facing);
  const mid = axleToMiddle(veh.kind);
  const swing = swingOut(plan, veh, rear, t);
  // The heading's right is (cos h, −sin h) (`besidePoint`); a lane keeps
  // its kerb on the other side, so out round a cyclist is toward it.
  out.x = rear.x + fx * mid + Math.cos(rear.facing) * swing;
  out.z = rear.z + fz * mid - Math.sin(rear.facing) * swing;
  out.y = plan.level.groundAt(out.x, out.z);
  out.heading = rear.facing;
  out.speed = rear.speed;
  out.steer = Math.max(-0.6, Math.min(0.6, Math.atan(V.wheelbase * rear.bend)));
  out.roll = rear.odo;
  const moving = Math.abs(rear.speed);
  out.brake = moving < 0.2 || rear.accel * Math.sign(rear.speed || 1) < -0.35;
  out.signal =
    rear.speed > 0.1 && Math.abs(rear.turn) > T.signal.turn ? (rear.turn > 0 ? 1 : -1) : 0;
  return out;
}

/** How many vehicles the plan has on the streets. */
export function vehicleCount(plan: TrafficPlan): number {
  return plan.vehicles.length;
}

/** The cars parked all the while. */
export function parkedCars(plan: TrafficPlan): readonly Parked[] {
  return plan.parked;
}

/** Whether (x, z) is within `pad` m of anything the traffic drives. */
export function nearTraffic(plan: TrafficPlan, x: number, z: number, pad = 0): boolean {
  const b = plan.box;
  return x >= b.x0 - pad && x <= b.x1 + pad && z >= b.z0 - pad && z <= b.z1 + pad;
}

export type { Parked, TrafficPlan, Vehicle } from "./traffic-plan.ts";
