// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN ARMY VEHICLE TAKEN AND DRIVEN — a carrier, a truck or a tank of the
// ground waves (`army-vehicle.ts`) that a wanted skier walks up to while it
// stands and takes with THE MACHINE PRESS (`steal.ts`, `ARMOUR_SOURCE`):
//
//   * WHICH CAN BE TAKEN: a carrier or a truck standing with its men out
//     of the back (parked, or halted to put them down and emptied); a tank
//     at a short halt, its crew bailing out onto the snow as he climbs onto
//     the glacis (three soldiers on foot, after him at once). A wreck
//     cannot. The theft is an offence (`stole-vehicle`, `stole-tank`), and
//     the vehicle leaves the waves: it is HIS (`GameState.armour`), and
//     the hunt's every eye and gun is on it as the quarry (`quarryOf`).
//   * THE DRIVE is the waves' own body on the snow (`moveVehicle`): its
//     pace gathered and shed at the vehicle's own rates, slowed up a rise
//     and stopped at one past its CLIMB (the truck at 30 %, the tank at
//     60 %, the carrier at 80 %), turned at its own rate — the tracked ones
//     pivot, the truck no tighter than its wheels — and stopped by a trunk,
//     a post, open water or another vehicle at its front; the map's edge
//     holds it. His hands are the snowmobile's keys: the tuck forward, the
//     skid back, the edge to steer — eased onto the controls.
//   * THE TANK'S GUN: the lean traverses the turret, the jump key's press
//     fires — once the gun is loaded — a high-explosive shell through the
//     gunfire layer (`WEAPONS.tankGun`), its burst the blast layer's
//     (`blast.ts`: the army's own vehicles near it knocked out). The fire
//     control lays it: the sight's line read out along the bore to the
//     first snow or machine it meets, the shell's drop allowed for. With
//     the trick key held the lean lays the gun up and down instead.
//   * HIM IN IT: held in the driver's seat, his skis off the snow, out of
//     every round's reach but the cabin's (`gunfire-machine.ts`), and out of
//     every blast's but what knocks the vehicle out. The press at a crawl
//     sets him down beside its door; left, it stands, and the press at its
//     door takes him back in.
//
// Pure over the state; nothing here draws from `state.rng`, and a run that
// never took a vehicle never gets past the first line, so no digest moves.

import { angleDiff, clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler, rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { enlist } from "./army-troop.ts";
import { VEHICLE_SQUAD, muzzleOf } from "./army-vehicle.ts";
import { moveVehicle, specOf } from "./army-vehicle-body.ts";
import { standSkier } from "./course.ts";
import { ARMOUR } from "./defs/armour.ts";
import { ARMY_VEHICLE } from "./defs/army-vehicle.ts";
import { TUNING } from "./defs/tuning.ts";
import { armGun, fireAt, gunReady } from "./gunfire.ts";
import { inGrace } from "./machine-grace.ts";
import { derive } from "./skier.ts";
import type { ArmourEvent, ArmourRide } from "./armour-state.ts";
import type { ArmyVehicle } from "./army-state.ts";
import type { ArmyVehicleKind } from "./defs/army-vehicle.ts";
import type { GameEvent, GameState, SkierInput } from "./state.ts";
import type { StealSource, StealTarget } from "./steal.ts";

const dt = TUNING.dt;
const K = ARMOUR;
const T = ARMY_VEHICLE.tank;

/** Say what happened to his vehicle. */
function say(state: GameState, events: GameEvent[], change: ArmourEvent["change"], r: ArmourRide) {
  const b = r.body;
  events.push({ kind: "armour", t: state.t, change, vehicle: b.kind, x: b.x, y: b.y, z: b.z });
}

/** A place of a vehicle's body frame in the world, standing as `b` does. */
export function armourPoint(
  b: Pick<ArmyVehicle, "x" | "y" | "z" | "heading" | "pitch" | "roll">,
  p: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const w = rotate(fromEuler(b.heading, b.pitch, b.roll), p);
  return { x: b.x + w.x, y: b.y + w.y, z: b.z + w.z };
}

/** WHERE A VEHICLE'S DOOR IS on the snow: beside its cab on the driver's
 * side, a step out from the hull. */
export function armourDoor(b: Pick<ArmyVehicle, "kind" | "x" | "z" | "heading">): {
  x: number;
  z: number;
} {
  const D = K.cabs[b.kind].door;
  const out = (specOf(b).halfWidth + K.hop.out) * D.side;
  const fx = Math.sin(b.heading);
  const fz = Math.cos(b.heading);
  // The body's +x is the heading's right: (fz, −fx).
  return { x: b.x + fx * D.along + fz * out, z: b.z + fz * D.along - fx * out };
}

/** Whether a wave's vehicle stands to be taken: on the snow and stood
 * still, not a wreck, its men out — a carrier or a truck emptied, a tank
 * halted to fire. */
function standsToTake(v: ArmyVehicle): boolean {
  if (Math.abs(v.speed) > K.board.still) return false;
  if (v.kind === "tank") return v.mode === "halt";
  return v.aboard === 0 && (v.mode === "park" || v.mode === "drop" || v.mode === "leave");
}

/** THE WAVES' VEHICLES STANDING TO BE TAKEN (`steal.ts`): a carrier or a
 * truck with its men out, a tank at its halt. Index: the vehicle's id. */
export const ARMOUR_SOURCE: StealSource = {
  id: "armour",
  parked(state, out) {
    const a = state.army;
    if (!a?.vehicles.length || state.armour?.rider) return;
    for (const v of a.vehicles) {
      if (v.mode === "due" || v.mode === "gone" || v.mode === "wreck" || !standsToTake(v)) continue;
      out.push({
        kind: v.kind,
        livery: "army",
        from: "armour",
        index: v.id,
        x: v.x,
        y: v.y,
        z: v.z,
        heading: v.heading,
        pitch: v.pitch,
        roll: v.roll,
        door: armourDoor(v),
        reach: K.board.reach,
        fastest: K.board.fastest,
        spool: 1,
      });
    }
  },
  taken(state, index) {
    const a = state.army;
    const v = a?.vehicles.find((o) => o.id === index);
    if (!a || !v) return;
    // A tank's crew bail out of their hatches onto the snow, and after him.
    if (v.kind === "tank")
      for (let i = 0; i < K.tank.crew; i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const back = 1.5 + i;
        const x = v.x - Math.sin(v.heading) * back + Math.cos(v.heading) * side * 3;
        const z = v.z - Math.cos(v.heading) * back - Math.sin(v.heading) * side * 3;
        const s = enlist(state, a, "foot", "wave", VEHICLE_SQUAD + v.id, "chase", x, z, v.heading);
        s.next = state.t + 2 + i * 0.7;
      }
    v.mode = "gone";
  },
};

/** THE VEHICLE `id` of the waves made his: its body lifted out of the
 * waves into `GameState.armour`, the skier in its driver's seat. False when
 * there is no such vehicle. */
export function takeArmour(
  run: GameState,
  p: StealTarget,
  events: GameEvent[],
): ArmyVehicleKind | null {
  const v = run.army?.vehicles.find((o) => o.id === p.index);
  if (!v || v.kind !== p.kind) return null;
  const body: ArmyVehicle = {
    ...v,
    mode: "drive",
    speed: 0,
    pace: 0,
    path: [],
    leg: 0,
    aboard: 0,
    shots: 0,
  };
  run.armour = {
    body,
    rider: true,
    t: 0,
    drive: 0,
    steer: 0,
    traverse: 0,
    elevate: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    dead: false,
    trigger: false,
    shots: 0,
  };
  const c = run.skier;
  c.lift = null;
  c.tunnel = null;
  hold(run, run.armour);
  say(run, events, "board", run.armour);
  return v.kind;
}

/** WHETHER THE PRESS PUTS HIM BACK IN the vehicle he took and left: on his
 * skis, at its door, slow — and not in the grace after stepping out. */
export function armourWithin(state: GameState): boolean {
  const r = state.armour;
  if (!r || r.rider || inGrace(state)) return false;
  const c = state.skier;
  if (c.thrown || c.lift || c.tunnel) return false;
  const d = armourDoor(r.body);
  return hypot(c.x - d.x, c.z - d.z) <= K.board.reach && c.speed <= K.board.fastest;
}

/** THE SKIER IN THE SEAT: where the vehicle has him, facing its way,
 * moving with it — his skis off the snow. */
function hold(state: GameState, r: ArmourRide): void {
  const c = state.skier;
  const b = r.body;
  const at = armourPoint(b, K.cabs[b.kind].seat);
  const first = r.t <= dt;
  c.vx = first ? 0 : (at.x - c.x) / dt;
  c.vy = first ? 0 : (at.y - c.y) / dt;
  c.vz = first ? 0 : (at.z - c.z) / dt;
  c.x = at.x;
  c.y = at.y;
  c.z = at.z;
  const h = b.heading / 2;
  c.q = { x: 0, y: Math.sin(h), z: 0, w: Math.cos(h) };
  c.wx = c.wy = c.wz = 0;
  c.airborne = false;
  c.airTime = 0;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  derive(c, state.level);
  c.incline = 0;
  c.edge = 0;
  c.skid = 0;
  c.skiAngle = 0;
  c.tuck = 0;
  c.overFor = 0;
  c.stuckFor = 0;
}

/** Down out of it onto his skis, beside its door, with its way. */
function hop(state: GameState, r: ArmourRide, events: GameEvent[]): void {
  const b = r.body;
  const d = armourDoor(b);
  standSkier(state, d.x, d.z, b.heading);
  const c = state.skier;
  c.vx = Math.sin(b.heading) * b.speed;
  c.vz = Math.cos(b.heading) * b.speed;
  derive(c, state.level);
  r.rider = false;
  r.t = 0;
  r.drive = 0;
  r.steer = 0;
  r.traverse = 0;
  r.elevate = 0;
  say(state, events, "hop", r);
}

/** An axis eased toward where his hand has it. */
const ease = (v: number, want: number): number => v + clamp(want - v, -K.hands * dt, K.hands * dt);

/** DRIVEN: the tuck forward, the skid back, the edge steering — the
 * vehicle's own body on the snow. */
function drive(state: GameState, r: ArmourRide, input: SkierInput): void {
  const b = r.body;
  const live = !r.dead;
  r.drive = ease(r.drive, live ? clamp(input.tuck, 0, 1) - clamp(input.brake, 0, 1) : 0);
  r.steer = ease(r.steer, live ? clamp(input.steer, -1, 1) : 0);
  const top = K.top[b.kind];
  const pace = r.drive >= 0 ? r.drive * top : r.drive * top * K.reverse;
  // The way asked: off the heading by the edge — the far way round
  // backing, which the body turns the vehicle's tail toward.
  const off = r.steer * K.steer;
  const way = b.speed < -0.05 ? b.heading + Math.PI - off : b.heading + off;
  const x0 = b.x;
  const y0 = b.y;
  const z0 = b.z;
  moveVehicle(state, b, pace, way, state.army?.vehicles ?? []);
  // The map's edge holds it.
  const S = specOf(b);
  const lo = TUNING.bounds.margin + S.halfLength;
  const hi = state.level.size - lo;
  const cx = clamp(b.x, lo, hi);
  const cz = clamp(b.z, lo, hi);
  if (cx !== b.x || cz !== b.z) {
    b.x = cx;
    b.z = cz;
    b.y = state.level.groundAt(cx, cz);
    b.speed = 0;
  }
  r.vx = (b.x - x0) / dt;
  r.vy = (b.y - y0) / dt;
  r.vz = (b.z - z0) / dt;
}

/** THE SIGHT'S LINE: the first snow or machine the bore's line meets,
 * read out from the muzzle — what the fire control lays the shell on. */
export function sightPoint(state: GameState, b: ArmyVehicle): { x: number; y: number; z: number } {
  const m = muzzleOf(b);
  const yaw = b.heading + b.turret;
  const el = b.gun + b.pitch * Math.cos(b.turret);
  const dx = Math.sin(yaw) * Math.cos(el);
  const dy = Math.sin(el);
  const dz = Math.cos(yaw) * Math.cos(el);
  // A machine of the hunt's within the lock of the line, nearest first.
  let best: number = K.tank.sight;
  let hit: { x: number; y: number; z: number } | null = null;
  const a = state.army;
  const consider = (x: number, y: number, z: number): void => {
    const ox = x - m.x;
    const oy = y - m.y;
    const oz = z - m.z;
    const along = ox * dx + oy * dy + oz * dz;
    if (along < 20 || along >= best) return;
    const off = hypot3(ox - dx * along, oy - dy * along, oz - dz * along);
    if (off / along > K.tank.lock) return;
    best = along;
    hit = { x, y, z };
  };
  if (a) {
    for (const v of a.vehicles)
      if (v.mode !== "due" && v.mode !== "gone" && v.mode !== "wreck")
        consider(v.x, v.y + 1.2, v.z);
    for (const h of a.helis)
      if (h.phase !== "due" && h.phase !== "gone" && h.phase !== "wreck")
        consider(h.x, h.y + 1.4, h.z);
  }
  const level = state.level;
  for (let d = K.tank.step; d < best; d += K.tank.step) {
    const x = m.x + dx * d;
    const y = m.y + dy * d;
    const z = m.z + dz * d;
    if (y <= level.groundAt(x, z)) return { x, y: level.groundAt(x, z), z };
  }
  return hit ?? { x: m.x + dx * best, y: m.y + dy * best, z: m.z + dz * best };
}

/** WHERE HIS SHELL MEETS THE HUNT'S MACHINES along a step's path p → q
 * (world, m): the share along it (0..1) it first comes within a vehicle's
 * half width of its middle, or a helicopter's cabin — or −1. */
export function armyStruck(state: GameState, p: readonly number[], q: readonly number[]): number {
  const a = state.army;
  if (!a) return -1;
  const dx = q[0] - p[0];
  const dy = q[1] - p[1];
  const dz = q[2] - p[2];
  const L = dx * dx + dy * dy + dz * dz;
  if (L <= 0) return -1;
  let best = -1;
  const test = (x: number, y: number, z: number, r: number): void => {
    const u = Math.min(1, Math.max(0, ((x - p[0]) * dx + (y - p[1]) * dy + (z - p[2]) * dz) / L));
    const ox = p[0] + dx * u - x;
    const oy = p[1] + dy * u - y;
    const oz = p[2] + dz * u - z;
    if (ox * ox + oy * oy + oz * oz > r * r || (best >= 0 && u >= best)) return;
    // Back along the path to where it first came within reach.
    const back = Math.sqrt(Math.max(0, r * r - (ox * ox + oy * oy + oz * oz))) / Math.sqrt(L);
    best = Math.max(0, u - back);
  };
  for (const v of a.vehicles) {
    if (v.mode === "due" || v.mode === "gone" || v.mode === "wreck") continue;
    test(v.x, v.y + 1.2, v.z, specOf(v).halfWidth + 0.4);
  }
  for (const h of a.helis)
    if (h.phase !== "due" && h.phase !== "gone" && h.phase !== "wreck")
      test(h.x, h.y + 1.4, h.z, 2);
  return best;
}

/** THE TANK'S TURRET AND GUN in his hands, and the shot on the jump key's
 * press. */
function gunnery(state: GameState, r: ArmourRide, input: SkierInput, events: GameEvent[]): void {
  const b = r.body;
  const pull = !!input.jump && !r.trigger;
  r.trigger = !!input.jump;
  if (b.kind !== "tank" || r.dead) return;
  // The lean traverses the turret; held with the trick key, it lays the gun.
  const laying = !!input.trick;
  r.traverse = ease(r.traverse, laying ? 0 : clamp(input.lean, -1, 1));
  r.elevate = ease(r.elevate, laying ? clamp(-input.lean, -1, 1) : 0);
  b.turret = angleDiff(0, b.turret + r.traverse * K.tank.traverse * dt);
  b.gun = clamp(b.gun + r.elevate * K.tank.elevate * dt, T.low, T.high);
  const m = muzzleOf(b);
  const gun = armGun(state, K.tank.gun, "tankGun", m.x, m.y, m.z);
  gun.x = m.x;
  gun.y = m.y;
  gun.z = m.z;
  gun.vx = r.vx;
  gun.vy = r.vy;
  gun.vz = r.vz;
  if (!pull || !gunReady(gun)) return;
  const p = sightPoint(state, b);
  if (!fireAt(state, gun, { kind: "point", x: p.x, y: p.y, z: p.z }, "aim", true)) return;
  r.shots++;
  b.fired = state.t;
  say(state, events, "fire", r);
}

/** KNOCKED OUT under him (`gunfire-machine.ts`): it will not drive, and —
 * lost — is a wreck. */
export function knockOut(state: GameState, lost: boolean, events: GameEvent[]): void {
  const r = state.armour;
  if (!r) return;
  if (!r.dead) {
    r.dead = true;
    say(state, events, "dead", r);
  }
  if (lost) r.body.mode = "wreck";
}

/** ONE STEP OF HIS VEHICLE, before his own: boarded again on the press at
 * its door, driven and its gun worked, or left — him set down beside it on
 * the press. True while he is in it (the step is the vehicle's), and on
 * the step he gets out (the press is spent). */
export function stepArmour(run: GameState, input: SkierInput, events: GameEvent[]): boolean {
  const r = run.armour;
  if (!r) return false;
  r.t += dt;
  const b = r.body;
  if (!r.rider) {
    if (input.machine && armourWithin(run)) {
      r.rider = true;
      r.t = 0;
      run.skier.lift = null;
      hold(run, r);
      say(run, events, "board", r);
      return true;
    }
    // Left standing: it rolls to a stop where it is.
    if (Math.abs(b.speed) > 0.01) moveVehicle(run, b, 0, b.heading, run.army?.vehicles ?? []);
    r.vx = r.vy = r.vz = 0;
    return false;
  }
  if (run.skier.thrown || (input.machine && Math.abs(b.speed) < K.hop.fastest)) {
    hop(run, r, events);
    return true;
  }
  drive(run, r, input);
  gunnery(run, r, input, events);
  hold(run, r);
  return true;
}
