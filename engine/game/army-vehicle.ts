// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND WAVES' VEHICLES — the tracked carriers, the trucks and the
// tanks a ground wave's mix names (`WANTED.waves`, read with `groundWave`
// by `army-wave.ts`), driven up the mountain at a man the army has hunted
// long enough. Their numbers are `ARMY_VEHICLE` in
// `engine/game/defs/army-vehicle.ts`; they live in `ArmyState.vehicles`.
//
// THE CALL. Each wave brings its vehicles up the valley with its men
// (`callVehicles`, from `army-wave.ts`' `sendWave`): they set off from the
// way up the column climbs, `back` m further down it than the column forms
// up — out of his sight — one after another `stagger` s apart, and drive
// THE WAY UP (the ski area's runs and cat tracks, as graded as anything on
// a mountain) as far as it goes. A truck that finds the village's road out
// comes in by it from the map's edge instead, and on up the way from where
// the road ends. At most `most` of them are out at once by stars.
//
// THE DRIVE. Four times a second each reads the snow ahead (`army-drive.ts`,
// as the snowmobiles do) — a fan of headings either side of the way to its
// next point (or, the way driven, to him): stopped short by a rise steeper
// than it climbs, a drop steeper than it goes down, water, the map's edge,
// costed for the solids near its line — and steers the cheapest; the move
// itself (its pace, its turn, the ground under it, what it may not drive
// through) is `army-vehicle-body.ts`'. Its WATCH counts the windows in
// which it meant to move and barely did: the first swings it off to a side,
// the second backs it down its own track, a third puts it back on the way
// up at the point it was making for (the lab counts those — always 0).
//
// WHAT EACH DOES THERE:
//   * A CARRIER drives up the way and then at him; within `drop.carrier` m
//     with him in sight (or `drop.blind` out of it), or held twice, it
//     halts and its section gets out of the back and goes after him as
//     every soldier on the ground does (`army-ground.ts`). It stays where
//     it put them down, its commander watching him from the hatch.
//   * A TRUCK drives the road and the way as far as its chains hold — up to
//     `drop.truck` m from him, the way's top, or the first rise it cannot
//     take — and its men climb on from there with the wave (`army-wave.ts`'
//     climb, on a way up of their own). Emptied, it turns back down.
//   * A TANK drives up the way and then at him, standing off `tank.lethal`
//     m (`tank.sfw` with SAFE FOR WORK on); with him in its crew's sight
//     inside `tank.range` it makes a SHORT HALT, lays its gun (the turret's
//     traverse, the gun's elevation) and fires its main gun through the
//     gunfire layer (`WEAPONS.tankGun`) — a high-explosive shell whose
//     burst is the BLAST (`blast.ts`): it throws him, strikes him with its
//     fragments and tears him apart near it. Inside `tank.ram` m of him,
//     shooting to kill, it runs him down instead (`army-vehicle-body.ts`'
//     strike, then `gore.ts`' tracks).
//
// SAFE FOR WORK (the INJURIES switch off): nothing of them wounds him. A
// tank's rounds are warning shots put down `tank.warn` m to a side of him,
// and nothing knocks him down but his own skiing into a hull; every
// vehicle stops `stop` m short of him, and the men they bring arrest him.
//
// THE COST is bounded: `most` vehicles out at once, the snow read four
// times a second at a few points a heading, one left far behind or out of
// his sight once the hunt is over taken off the map.
//
// THE PURSUERS: every crewed vehicle on the snow is one (`kind:
// "vehicle"`, ids from `ids.pursuer`). Nothing here draws from any stream:
// where each comes from, its side and its pauses are pure functions of the
// map, the state and its id. `ArmyState.vehicles` stays empty on every run
// whose hunt never sent a wave that names one.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { chooseWay, type TerrainRead } from "./army-drive.ts";
import { enlist } from "./army-troop.ts";
import {
  holdOffVehicles,
  moveVehicle,
  movedSince,
  sayVehicle,
  standingNear,
  specOf,
} from "./army-vehicle-body.ts";
import { ARMY_VEHICLE, type ArmyVehicleKind } from "./defs/army-vehicle.ts";
import { ARMY_WAVE } from "./defs/army-wave.ts";
import { TUNING } from "./defs/tuning.ts";
import { WANTED, type WaveMix } from "./defs/wanted.ts";
import { armGun, disarmGun, fireAt, gunReady } from "./gunfire.ts";
import { villageOf } from "./village.ts";
import { quarryOf, rosterOf, seesQuarry } from "./wanted.ts";
import type { ArmyState, ArmyVehicle, WaveRoute } from "./army-state.ts";
import type { GameEvent, GameState } from "./state.ts";
import type { WantedState } from "./wanted-state.ts";

const dt = TUNING.dt;
const K = ARMY_VEHICLE;
type P = WaveRoute["pts"][number];

/** A vehicle's men, once out, are a squad numbered past this. */
export const VEHICLE_SQUAD = K.ids.squad;

/** Each kind's reading of the ground: the snowmobiles' costs over its
 * own limits. */
const readOf = (k: ArmyVehicleKind): TerrainRead => ({
  ...K.terrain,
  climb: K.kinds[k].climb,
  cliff: K.kinds[k].cliff,
});
const READS: Record<ArmyVehicleKind, TerrainRead> = {
  carrier: readOf("carrier"),
  truck: readOf("truck"),
  tank: readOf("tank"),
};

const gunOf = (v: ArmyVehicle): number => K.ids.gun + v.id;

// ─── the call ──────────────────────────────────────────────────────────

/** THE VILLAGE'S ROAD OUT, from the map's edge in: the first street that
 * runs off the map, its points from its edge end. Null where there is
 * none. */
function roadIn(level: GameState["level"]): P[] | null {
  const village = villageOf(level);
  const road = village?.streets.find((s) => s.exit);
  if (!road || road.points.length < 2) return null;
  const pts: P[] = [];
  for (let i = road.points.length - 1; i >= 0; i -= 4)
    pts.push({ x: road.points[i].x, z: road.points[i].z, w: 6 });
  return pts;
}

/** THE WAVE'S VEHICLES brought up the valley: `down` the way from him
 * down to the valley (`army-wave.ts`' `wayDown`, carried on), `path` its
 * length to each point, `head` where its column forms up. */
export function callVehicles(
  state: GameState,
  a: ArmyState,
  w: WantedState,
  mix: WaveMix,
  wave: number,
  down: readonly P[],
  path: readonly number[],
  head: number,
  events: GameEvent[],
): void {
  const kinds: ArmyVehicleKind[] = [];
  const most = Math.max(mix.tracked, mix.trucks, mix.tanks);
  for (let i = 0; i < most; i++) {
    if (i < mix.tracked) kinds.push("carrier");
    if (i < mix.trucks) kinds.push("truck");
    if (i < mix.tanks) kinds.push("tank");
  }
  if (kinds.length === 0) return;
  let live = 0;
  for (const v of a.vehicles) if (v.mode !== "gone") live++;
  const room = Math.max(0, (K.most[w.stars] ?? 0) - live);
  // Where they set off: `back` m further down than the column forms.
  let k = head;
  while (k < down.length - 1 && path[k] < path[head] + K.back) k++;
  const up = down.slice(0, k + 1).reverse();
  const road = roadIn(state.level);
  let waiting = a.vehicles.filter((v) => v.mode === "due").length;
  for (const kind of kinds.slice(0, room)) {
    const route = kind === "truck" && road ? [...road, ...up] : up;
    const p0 = route[0];
    const p1 = route[Math.min(1, route.length - 1)];
    const heading = Math.atan2(p1.x - p0.x, p1.z - p0.z) || 0;
    const id = a.nextVehicle++;
    const v: ArmyVehicle = {
      id,
      kind,
      wave,
      mode: "due",
      due: state.t + K.stagger * waiting,
      t: 0,
      x: p0.x,
      y: state.level.groundAt(p0.x, p0.z),
      z: p0.z,
      heading,
      pitch: 0,
      roll: 0,
      speed: 0,
      rear: heading,
      way: heading,
      pace: 0,
      path: route,
      leg: Math.min(1, route.length - 1),
      aboard: specOf({ kind }).seats,
      turret: 0,
      gun: 0,
      shots: 0,
      next: state.t,
      fired: -Infinity,
      saw: -Infinity,
      wx: p0.x,
      wz: p0.z,
      wt: state.t,
      slow: 0,
      side: id % 2 === 0 ? 1 : -1,
      until: 0,
      dug: 0,
      stuck: 0,
    };
    a.vehicles.push(v);
    a.vehiclesCalled++;
    waiting++;
    sayVehicle(state, events, "called", v);
  }
}

/** OFF UP THE WAY, once its turn comes and the spot is clear. */
function setOff(state: GameState, a: ArmyState, v: ArmyVehicle, events: GameEvent[]): void {
  for (const o of a.vehicles) {
    if (o === v || o.mode === "due" || o.mode === "gone") continue;
    if (hypot(o.x - v.x, o.z - v.z) < K.room) {
      v.due = state.t + 1;
      return;
    }
  }
  v.mode = "drive";
  v.t = 0;
  v.wt = state.t;
  v.wx = v.x;
  v.wz = v.z;
  sayVehicle(state, events, "out", v);
}

// ─── the crew's eyes ───────────────────────────────────────────────────

/** Whether the crew see him now: looked every quarter second, each
 * vehicle in its own turn, and remembered half a second. */
function looks(state: GameState, v: ArmyVehicle, q: { x: number; y: number; z: number }) {
  const L = WANTED.lookEvery;
  const turn = (state.t + (v.id % 8) * (L / 8)) % L;
  if (turn < dt) {
    const p = { kind: "vehicle" as const, x: v.x, y: v.y + specOf(v).eyes, z: v.z };
    if (seesQuarry(state.level, p, q)) v.saw = state.t;
  }
  return state.t - v.saw < 0.5;
}

// ─── the drive ─────────────────────────────────────────────────────────

/** The next point of its way, taken once it is within `reach` of it or
 * past it; null once the way is driven. */
function nextPoint(v: ArmyVehicle): P | null {
  while (v.leg < v.path.length) {
    const p = v.path[v.leg];
    const b = v.path[Math.max(0, v.leg - 1)];
    const len = Math.max(0.1, hypot(p.x - b.x, p.z - b.z));
    const past = ((v.x - p.x) * (p.x - b.x) + (v.z - p.z) * (p.z - b.z)) / len;
    if (hypot(p.x - v.x, p.z - v.z) > K.drive.reach && past < 0) return p;
    v.leg++;
  }
  return null;
}

/** STEERED AND MOVED toward (tx, tz) at up to `pace` m/s: the way read off
 * the snow on its turn, a side held while swung off, and the watch kept. */
function driveTo(
  state: GameState,
  a: ArmyState,
  v: ArmyVehicle,
  tx: number,
  tz: number,
  pace: number,
  events: GameEvent[],
): void {
  const toward = Math.atan2(tx - v.x, tz - v.z);
  const D = K.drive;
  const turn = Math.floor((state.t + (v.id % 4) * 0.06) / D.decide);
  if (turn !== Math.floor((state.t + (v.id % 4) * 0.06 - dt) / D.decide)) {
    const S = specOf(v);
    const c = chooseWay(
      state,
      v.x,
      v.z,
      v.way,
      toward,
      READS[v.kind],
      D,
      S.halfWidth + K.terrain.trunk,
      standingNear,
    );
    v.way = c.way;
    v.pace = c.woods ? S.woods : S.cruise;
  }
  if (state.t < v.until) v.way = toward + v.side * 1.2;
  const go = Math.min(pace, v.pace);
  moveVehicle(state, v, go, v.way, a.vehicles);
  if (go > 1) watch(state, v, events);
  else rest(state, v);
}

/** NOT GETTING STUCK: progress checked a window at a time — a swing off to
 * a side, then backed down its own track, then put back on the way up at
 * the point it was making for. */
function watch(state: GameState, v: ArmyVehicle, events: GameEvent[]): void {
  const S = K.stuck;
  if (state.t - v.wt < S.window) return;
  const moved = movedSince(v);
  v.wx = v.x;
  v.wz = v.z;
  v.wt = state.t;
  if (moved >= S.least) {
    v.slow = 0;
    return;
  }
  v.slow++;
  if (v.slow === 1) {
    v.side = -v.side;
    v.until = state.t + S.detour;
    return;
  }
  if (v.slow === 2) {
    // BACKED OUT down the way it came, on the first open snow.
    const back = v.heading + Math.PI;
    for (let k = 1; k <= 3; k++) {
      const x = v.x + Math.sin(back) * S.dig * k;
      const z = v.z + Math.cos(back) * S.dig * k;
      if (standingNear(state.level, x, z, specOf(v).halfWidth + 1, near).length === 0) {
        v.x = x;
        v.z = z;
        break;
      }
    }
    v.speed = 0;
    v.y = state.level.groundAt(v.x, v.z);
    v.dug++;
    v.side = -v.side;
    v.until = state.t + S.detour;
    sayVehicle(state, events, "dug", v);
    return;
  }
  // HELD A THIRD TIME: put back on the way up, at the point it was making
  // for, facing on along it.
  const i = Math.min(v.leg, v.path.length - 1);
  const p = v.path[i];
  const n = v.path[Math.min(i + 1, v.path.length - 1)];
  v.x = p.x;
  v.z = p.z;
  v.y = state.level.groundAt(p.x, p.z);
  v.heading = n === p ? v.heading : Math.atan2(n.x - p.x, n.z - p.z);
  v.rear = v.heading;
  v.way = v.heading;
  v.speed = 0;
  v.leg = Math.min(i + 1, v.path.length);
  v.slow = 0;
  v.stuck++;
  sayVehicle(state, events, "stuck", v);
}

const near: number[] = [];

/** Stood on purpose: the watch starts its window again from here. */
function rest(state: GameState, v: ArmyVehicle): void {
  v.wt = state.t;
  v.wx = v.x;
  v.wz = v.z;
  v.slow = 0;
}

/** Braked to a stand where it is. */
function stand(state: GameState, a: ArmyState, v: ArmyVehicle): void {
  moveVehicle(state, v, 0, v.heading, a.vehicles);
  rest(state, v);
}

// ─── the men out ───────────────────────────────────────────────────────

/** HALTED AND EMPTIED: a man out of the back every `drop.every` s — a
 * carrier's after him at once, a truck's climbing on with the wave — and
 * on `drop.linger` s after the last. */
function unload(state: GameState, a: ArmyState, v: ArmyVehicle, w: WantedState, events: GameEvent[]) {
  stand(state, a, v);
  const D = K.drop;
  if (v.aboard > 0 && v.t >= D.every) {
    v.t = 0;
    const S = specOf(v);
    const back = v.kind === "carrier" ? v.rear : v.heading;
    const tail = v.kind === "carrier" ? K.rear.hitch + K.rear.back * 2 : S.halfLength;
    const lane = ((v.aboard % 3) - 1) * 1.4;
    const x = v.x - Math.sin(back) * (tail + D.out) + Math.cos(back) * lane;
    const z = v.z - Math.cos(back) * (tail + D.out) - Math.sin(back) * lane;
    const role = v.aboard % 3 === 0 ? "foot" : "rifle";
    const squad = VEHICLE_SQUAD + v.id;
    // A truck's men climb on with the wave, up the rest of its way.
    if (v.kind === "truck" && !hasRoute(a, squad) && v.leg < v.path.length) {
      const pts = [{ x: v.x, z: v.z, w: 6 }, ...v.path.slice(v.leg)];
      a.routes.push({ squad, pts });
    }
    if (v.kind === "truck" && hasRoute(a, squad)) {
      const s = enlist(state, a, role, "wave", squad, "climb", x, z, v.heading);
      s.leg = 1;
      s.lane = lane;
    } else {
      const s = enlist(state, a, role, "wave", squad, "chase", x, z, back + Math.PI);
      s.next = state.t + 1 + (s.id % 4) * 0.5;
    }
    v.aboard--;
    a.unloaded++;
    return;
  }
  if (v.aboard === 0 && v.t >= D.linger) {
    v.mode = v.kind === "carrier" && w.ended === null ? "park" : "leave";
    v.t = 0;
  }
}

/** Whether the squad's way up is laid. */
const hasRoute = (a: ArmyState, squad: number): boolean => a.routes.some((r) => r.squad === squad);

/** INTO THE HALT TO PUT THEM DOWN, as many as the waves' bound leaves
 * room for. */
function startDrop(state: GameState, a: ArmyState, v: ArmyVehicle, w: WantedState, events: GameEvent[]) {
  v.mode = "drop";
  v.t = 0;
  // Room for them under the waves' bound.
  let live = 0;
  for (const s of a.troops) if (s.from === "wave" && s.mode !== "gone" && s.mode !== "dead") live++;
  const most = ARMY_WAVE.most[w.stars] ?? 0;
  v.aboard = Math.max(0, Math.min(v.aboard, most - live));
  sayVehicle(state, events, "drop", v);
}

// ─── each kind's part ──────────────────────────────────────────────────

/** A CARRIER OR A TRUCK on its way: up the way, then at him; halted to
 * put its men down where its kind does. */
function carry(
  state: GameState,
  a: ArmyState,
  v: ArmyVehicle,
  w: WantedState,
  q: { x: number; y: number; z: number },
  events: GameEvent[],
): void {
  const sees = looks(state, v, q);
  const d = hypot(q.x - v.x, q.z - v.z);
  const p = nextPoint(v);
  const D = K.drop;
  const there =
    v.kind === "carrier"
      ? (sees && d < D.carrier) || d < D.blind || v.dug >= 2 || (!p && d < D.truck)
      : d < D.truck || !p || v.dug >= 1 || v.slow >= 1;
  if (v.aboard > 0 && there) {
    startDrop(state, a, v, w, events);
    return;
  }
  const to = p ?? (w.seen ? q : w.lastSeen);
  const pace = d < K.stop + 6 ? clamp((d - K.stop) / 6, 0, 1) * 4 : Infinity;
  driveTo(state, a, v, to.x, to.z, pace, events);
}

/** THE TANK on its way: up the way, then at him to its stand-off (or, in
 * reach, over him), halting to fire when it sees him. */
function hunt(
  state: GameState,
  a: ArmyState,
  v: ArmyVehicle,
  w: WantedState,
  q: { x: number; y: number; z: number },
  fire: "hold" | "warn" | "aim",
  events: GameEvent[],
): void {
  const T = K.tank;
  const sees = looks(state, v, q);
  const d = hypot(q.x - v.x, q.z - v.z);
  traverse(v, sees ? q : null);
  const down = !!state.skier.thrown;
  if (sees && !down && fire !== "hold" && d < T.range && state.t >= v.next) {
    v.mode = "halt";
    v.t = 0;
    v.shots = 0;
    sayVehicle(state, events, "halt", v);
    stand(state, a, v);
    return;
  }
  const p = nextPoint(v);
  const ram = w.lethal && !!state.gore && d < T.ram && sees;
  const to = ram || !p ? (w.seen ? q : w.lastSeen) : p;
  const off = w.lethal ? T.lethal : T.sfw;
  const pace = ram ? Infinity : !p && sees && d < off ? 0 : Infinity;
  if (pace === 0) stand(state, a, v);
  else driveTo(state, a, v, to.x, to.z, pace, events);
}

/** The turret turned toward him (or back over the nose), at its traverse. */
function traverse(v: ArmyVehicle, q: { x: number; z: number } | null): number {
  const want = q ? angleDiff(v.heading, Math.atan2(q.x - v.x, q.z - v.z)) : 0;
  const step = K.tank.traverse * dt;
  const off = angleDiff(v.turret, want);
  v.turret += clamp(off, -step, step);
  return Math.abs(off);
}

/** Where the muzzle is, world frame, m. */
export function muzzleOf(v: Pick<ArmyVehicle, "x" | "y" | "z" | "heading" | "turret" | "gun" | "pitch">) {
  const T = K.tank;
  const yaw = v.heading + v.turret;
  const el = v.gun + v.pitch * Math.cos(v.turret);
  const flat = Math.cos(el) * T.muzzle;
  return {
    x: v.x + Math.sin(yaw) * flat,
    y: v.y + T.ring + Math.sin(el) * T.muzzle,
    z: v.z + Math.cos(yaw) * flat,
  };
}

/** THE SHORT HALT: braked, the gun laid on him (or, SAFE FOR WORK, on the
 * snow well to a side of him) and fired — then on again. */
function halt(
  state: GameState,
  a: ArmyState,
  v: ArmyVehicle,
  w: WantedState,
  q: { x: number; y: number; z: number },
  events: GameEvent[],
): void {
  const T = K.tank;
  stand(state, a, v);
  const sees = looks(state, v, q);
  // The point laid on: him, or a warning shot's spot to his side.
  let tx = q.x;
  let tz = q.z;
  if (!w.lethal) {
    const across = Math.atan2(q.x - v.x, q.z - v.z) + Math.PI / 2;
    const side = (v.id + a.shells) % 2 === 0 ? 1 : -1;
    const r = T.warn.near + (T.warn.far - T.warn.near) * (((v.id + a.shells) * 0.618) % 1);
    tx += Math.sin(across) * r * side;
    tz += Math.cos(across) * r * side;
  }
  const ty = w.lethal ? q.y + WANTED.line.chest : state.level.groundAt(tx, tz);
  const yawOff = traverse(v, { x: tx, z: tz });
  const m = muzzleOf(v);
  const flat = hypot(tx - m.x, tz - m.z);
  const el = clamp(Math.atan2(ty - (v.y + T.ring), flat) - v.pitch * Math.cos(v.turret), T.low, T.high);
  const estep = T.elevate * dt;
  const elOff = el - v.gun;
  v.gun += clamp(elOff, -estep, estep);
  const lost = !sees && state.t - v.saw > 2;
  if (v.t > T.hold || lost || w.ended !== null || (v.shots >= T.shots && state.t - v.fired > 1.5)) {
    v.mode = "drive";
    v.t = 0;
    v.next = state.t + T.least + 4 * ((v.id * 0.618) % 1);
    rest(state, v);
    return;
  }
  if (v.shots >= T.shots || Math.abs(v.speed) > T.still) return;
  if (yawOff > T.laid || Math.abs(elOff) > T.laid) return;
  const gun = armGun(state, gunOf(v), "tankGun", m.x, m.y, m.z);
  gun.x = m.x;
  gun.y = m.y;
  gun.z = m.z;
  gun.vx = 0;
  gun.vy = 0;
  gun.vz = 0;
  if (!gunReady(gun)) return;
  const target = w.lethal
    ? ({ kind: "quarry" } as const)
    : ({ kind: "point", x: tx, y: state.level.groundAt(tx, tz), z: tz } as const);
  if (fireAt(state, gun, target)) {
    v.shots++;
    v.fired = state.t;
    a.shells++;
    sayVehicle(state, events, "fire", v);
  }
}

/** HOME: back down the way it came, and gone at its foot or after
 * `leave` s. */
function goHome(state: GameState, a: ArmyState, v: ArmyVehicle, events: GameEvent[]): void {
  traverse(v, null);
  if (v.t > K.leave || v.leg <= 0) {
    v.mode = "gone";
    sayVehicle(state, events, "gone", v);
    return;
  }
  const p = v.path[Math.min(v.leg, v.path.length) - 1];
  if (hypot(p.x - v.x, p.z - v.z) < K.drive.reach) v.leg--;
  driveTo(state, a, v, p.x, p.z, Infinity, events);
}

// ─── the step ──────────────────────────────────────────────────────────

/** THE WAVES' VEHICLES' STEP, on a hunted run: every vehicle out driven,
 * halted, emptied, fired or sent home, the skier held out of them, and the
 * pursuers written. After the snowmobiles, before the gunfire. */
export function stepArmyVehicles(state: GameState, events: GameEvent[]): void {
  const a = state.army;
  const w = state.wanted;
  if (!a || a.home || !w || a.vehicles.length === 0) return;
  const on = w.ended === null && w.stars > 0;
  const fire = rosterOf(on ? w.stars : 0).fire;
  const q = quarryOf(state);
  for (const v of a.vehicles) {
    v.t += dt;
    // Sent home: far behind him, or the hunt over and him well away.
    const far = on ? hypot(v.x - w.lastSeen.x, v.z - w.lastSeen.z) : hypot(v.x - q.x, v.z - q.z);
    if (v.mode !== "due" && v.mode !== "gone" && far > (on ? K.behind : K.home)) {
      v.mode = "gone";
      sayVehicle(state, events, "gone", v);
    }
    if (!on && (v.mode === "drive" || v.mode === "park" || v.mode === "halt")) {
      v.mode = "leave";
      v.t = 0;
    }
    switch (v.mode) {
      case "due":
        if (!on) v.mode = "gone";
        else if (state.t >= v.due) setOff(state, a, v, events);
        break;
      case "drive":
        if (v.kind === "tank") hunt(state, a, v, w, q, fire, events);
        else carry(state, a, v, w, q, events);
        break;
      case "drop":
        unload(state, a, v, w, events);
        break;
      case "park":
        looks(state, v, q);
        stand(state, a, v);
        break;
      case "halt":
        halt(state, a, v, w, q, events);
        break;
      case "leave":
        goHome(state, a, v, events);
        break;
      default:
        break;
    }
  }
  holdOffVehicles(state, a.vehicles, events);
  for (const v of a.vehicles) if (v.mode === "gone" && v.kind === "tank") disarmGun(state, gunOf(v));
  a.vehicles = a.vehicles.filter((v) => v.mode !== "gone");
  writeCrews(a, w);
}

/** WRITE THE CREWS into the wanted level's pursuers: every vehicle on the
 * snow with its crew in it. */
function writeCrews(a: ArmyState, w: WantedState): void {
  const lo = K.ids.pursuer;
  const kept = w.pursuers.filter((p) => p.id < lo || p.id >= lo + 1000);
  for (const v of a.vehicles) {
    if (v.mode === "due" || v.mode === "leave") continue;
    kept.push({ id: lo + (v.id % 1000), kind: "vehicle", x: v.x, y: v.y + specOf(v).eyes, z: v.z });
  }
  w.pursuers = kept;
}

/** The waves' vehicles on the map, for the drawing, the ear and the labs. */
export function armyVehicles(state: GameState): readonly ArmyVehicle[] {
  return state.army?.vehicles.filter((v) => v.mode !== "due") ?? [];
}
