// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SOLDIERS UP THE LIFTS — from the star that asks for them
// (`WANTED.roster`'s `lifted`), squads of the army ride the ski area's own
// lifts up and ski down at him from the top, as troops on a mountain with
// lifts use them.
//
// A squad is dropped at the foot of the lift whose TOP is nearest him and
// well above him (`ARMY_GROUND.lift.above`) — put down at the far end of
// its queue's lane (`queueSpot`), as if off a truck from the valley — and
// skates up the lane to the load line. The carrier that comes round takes
// them (`carrierPassing`, the crowd's own boarding): as many as it has free
// seats after the amateurs already on it (`crowd-lift.ts`), the rest the
// next one. Each rides THAT carrier up (`carrierAt` — the lifts always
// run), sat on a chair, stood on a T-bar, out of sight in a cabin, and is
// let go at its top where the crowd is (`offAt`) — and from there he is
// after him (`army-ground.ts`), downhill.
//
// The lifts' squads are sent again while the roster is short of them, one
// every `lift.every` s. Nothing here draws from any stream: the lift taken
// is the nearest, the seats the next free.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { CROWD } from "./defs/crowd.ts";
import { ARMY_GROUND } from "./defs/army-ground.ts";
import { TUNING } from "./defs/tuning.ts";
import { loadAt, offAt } from "./crowd-lift.ts";
import {
  DRAG_ARM,
  carrierAt,
  carrierGripAt,
  carrierPassing,
  carrierSpeedAt,
  liftPlans,
  queueSpot,
  ropeAt,
  upRope,
  type LiftPlan,
} from "./lift-line.ts";
import { enlist, goToward, stopHere } from "./army-troop.ts";
import type { ArmyState, Soldier } from "./army-state.ts";
import type { GameEvent, GameState } from "./state.ts";

const dt = TUNING.dt;
const L = ARMY_GROUND.lift;
const R = CROWD.ride;

/** A lift's squad is numbered past every machine's id. */
export const LIFT_SQUAD = 10_000;

/** Whether a soldier still counts in the roster: out on the map and fit. */
export function fit(s: Soldier): boolean {
  return s.mode !== "dead" && s.mode !== "hurt" && s.mode !== "gone";
}

/** THE LIFT a squad takes to come down at a man at (x, y, z): the one
 * whose top is nearest him and `above` m over him — or, with none so high,
 * the one whose top is highest over him. −1 with no lift. */
export function liftFor(state: GameState, x: number, y: number, z: number): number {
  const plans = liftPlans(state.level);
  let best = -1;
  let cost = Infinity;
  plans.forEach((p, i) => {
    const top = p.lift.top;
    const ty = state.level.groundAt(top.x, top.z);
    const c = hypot(top.x - x, top.z - z) + (ty < y + L.above ? 5000 - ty : 0);
    if (c < cost) {
      cost = c;
      best = i;
    }
  });
  return best;
}

/** SEND A SQUAD UP when the roster is short of lifted men, after the
 * call's delay and then one every `lift.every` s. */
export function sendLiftSquads(
  state: GameState,
  a: ArmyState,
  want: number,
  q: { x: number; y: number; z: number },
  events: GameEvent[],
): void {
  let live = 0;
  for (const s of a.troops) if (s.from === "lift" && fit(s)) live++;
  if (live >= want) {
    a.liftDue = NaN;
    return;
  }
  if (Number.isNaN(a.liftDue)) a.liftDue = state.t + L.respond;
  if (state.t < a.liftDue) return;
  a.liftDue = state.t + L.every;
  const lift = liftFor(state, q.x, q.y, q.z);
  if (lift < 0) return;
  const plan = liftPlans(state.level)[lift];
  const squad = LIFT_SQUAD + a.liftSquads++;
  const n = Math.min(L.squad, want - live);
  for (let i = 0; i < n; i++) {
    // Put down at the lane's far end, a man's room apart.
    const at = queueSpot(plan, L.lane + i);
    const s = enlist(state, a, "rifle", "lift", squad, "walk", at.x, at.z, at.heading);
    s.lift = lift;
    s.seat = i;
    const to = queueSpot(plan, i);
    s.tx = to.x;
    s.tz = to.z;
    events.push({ kind: "soldier", t: state.t, change: "out", id: s.id, x: s.x, y: s.y, z: s.z });
  }
}

/** How many of the crowd ride carrier `k` of lift `lift` just now. */
function crowdOn(state: GameState, lift: number, k: number): number {
  let n = 0;
  for (const m of state.crowd?.amateurs ?? [])
    if (m.mode === "ride" && m.lift === lift && m.carrier === k) n++;
  return n;
}

/** THE LIFTS' SOLDIERS this step: up the lane to the load line, taken by
 * the carrier that comes round, carried up and let go at the top. */
export function stepLiftTroops(state: GameState, a: ArmyState, events: GameEvent[]): void {
  const plans = liftPlans(state.level);
  const boarded = new Map<number, number>();
  for (const s of a.troops) {
    if (s.lift < 0 || !plans[s.lift]) continue;
    const plan = plans[s.lift];
    if (s.mode === "walk") {
      goToward(state, s, a.troops, s.tx, s.tz, R.skate * 1.3, 0.2);
      if (hypot(s.tx - s.x, s.tz - s.z) < 0.6) {
        s.mode = "wait";
        s.t = 0;
      }
    } else if (s.mode === "wait") {
      stopHere(state, s);
      s.heading = queueSpot(plan, 0).heading;
      const k = carrierPassing(plan, loadAt(plan), state.t, dt);
      if (k < 0) continue;
      const key = s.lift * 100_000 + k;
      const taken = boarded.get(key) ?? crowdOn(state, s.lift, k);
      if (taken >= R.seats[plan.lift.kind]) continue;
      boarded.set(key, taken + 1);
      s.mode = "ride";
      s.t = 0;
      s.carrier = k;
      s.seat = taken;
      events.push({
        kind: "soldier",
        t: state.t,
        change: "lift",
        id: s.id,
        x: s.x,
        y: s.y,
        z: s.z,
      });
    } else if (s.mode === "ride") ride(state, plan, s);
  }
}

/** On his carrier, up the line; let go at the top onto the snow, after
 * him. */
function ride(state: GameState, plan: LiftPlan, s: Soldier): void {
  const at = carrierAt(plan, s.carrier, state.t);
  const kind = plan.lift.kind;
  const seats = R.seats[kind];
  const across = (s.seat - (seats - 1) / 2) * (kind === "drag" ? 2 * R.tee : R.seat);
  const side = (kind === "drag" ? DRAG_ARM : upRope(plan)) + (kind === "gondola" ? 0 : across);
  s.x = plan.lift.bottom.x + plan.dx * at.u + plan.dz * side;
  s.z = plan.lift.bottom.z + plan.dz * at.u - plan.dx * side;
  s.y =
    kind === "drag"
      ? state.level.groundAt(s.x, s.z)
      : kind === "gondola"
        ? ropeAt(plan, at.u) - R.under - 2
        : carrierGripAt(plan, at.u) - R.under;
  s.heading = plan.heading;
  s.speed = carrierSpeedAt(plan, at.u, at.side);
  s.vx = plan.dx * s.speed;
  s.vz = plan.dz * s.speed;
  if (at.side === 0 && at.u < offAt(plan)) return;
  // AT THE TOP: stood where the carrier lets him go, and after him.
  const off = offAt(plan);
  const place = s.seat - (seats - 1) / 2;
  const stand = kind === "chair" ? upRope(plan) + place * R.seat : place * R.apart;
  s.x = plan.lift.bottom.x + plan.dx * off + plan.dz * stand;
  s.z = plan.lift.bottom.z + plan.dz * off - plan.dx * stand;
  s.y = state.level.groundAt(s.x, s.z);
  s.lift = -1;
  s.carrier = -1;
  s.mode = "chase";
  s.t = 0;
  s.wt = state.t;
  s.wx = s.x;
  s.wz = s.z;
}

/** Whether a soldier riding a lift is out of sight: in a gondola's cabin. */
export function inGondola(state: GameState, s: Soldier): boolean {
  if (s.mode !== "ride" || s.lift < 0) return false;
  return liftPlans(state.level)[s.lift]?.lift.kind === "gondola";
}
