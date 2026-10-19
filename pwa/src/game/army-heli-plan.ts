// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTER, AS PLACES — where on the military helicopter
// (`ARMY_HELI`, `scripts/blender/army.py`) each of the army's people and
// its guns are, side by side, for whoever stands one there: the drawing
// (`army-heli-view.ts`), the lab (`make army`), and the parts that fly the
// machine and fill it (the door gunners aiming and firing, the troops sat
// in the doorways, a section going down the fast ropes). Three-free, so
// the suite reads it (`tests/army_heli_test.ts`).
//
// Every place is in the machine's BODY FRAME — `ARMY_HELI`'s: x to the
// right, y up, z forward (the nose), the origin the skid datum — and each
// table there states the RIGHT side; the left is the mirror, handed out
// here. A side is +1 (right) or -1 (left).

import { ARMY_HELI } from "@engine";

export type Side = 1 | -1;
export type P3 = { x: number; y: number; z: number };

/** The model's nodes, as `scripts/blender/army.py` names them: the
 * airframe (its origin the skid datum), the main rotor (its origin the
 * hub; it turns ANTICLOCKWISE seen from above — a positive angle about its
 * local up in three.js), the tail rotor (about its local x), each sliding
 * door (closed, its origin on the doorway's forward edge at the sill; open
 * is a slide aft) and each door gun (square out of its door, its origin
 * the pivot; yaw about its local up, elevation about its local fore-and-aft
 * axis — `GUN_EULER`). */
export const ARMY_NODES = {
  body: "army_body",
  rotor: "army_rotor",
  tail: "army_tail_rotor",
  doorR: "army_door_r",
  doorL: "army_door_l",
  gunR: "army_gun_r",
  gunL: "army_gun_l",
} as const;

/** The two sides, right first. */
export const SIDES: readonly Side[] = [1, -1];

const mirror = (p: P3, side: Side): P3 => ({ x: p.x * side, y: p.y, z: p.z });

/** THE DOORWAY on a side: its forward and aft edges (z), its sill and its
 * head (y), and the plane it stands in (x, the cabin's side). */
export function doorwayOf(side: Side): {
  front: number;
  back: number;
  sill: number;
  head: number;
  x: number;
} {
  const d = ARMY_HELI.door;
  return {
    front: d.front,
    back: d.back,
    sill: d.sill,
    head: d.head,
    x: (side * ARMY_HELI.body.width) / 2,
  };
}

/** How far aft the sliding door stands, m, at `open` (0 shut … 1 open). */
export function doorSlide(open: number): number {
  return ARMY_HELI.door.slide * Math.max(0, Math.min(1, open));
}

/** The door gun's pivot on a side. */
export function gunPivot(side: Side): P3 {
  return mirror(ARMY_HELI.gun.pivot, side);
}

/** A gun's aim held inside its stops: `yaw` from square out of the door
 * (positive toward the nose), `pitch` above level (positive up), rad. */
export function clampAim(yaw: number, pitch: number): { yaw: number; pitch: number } {
  const g = ARMY_HELI.gun;
  return {
    yaw: Math.max(-g.yaw, Math.min(g.yaw, yaw)),
    pitch: Math.max(-g.pitch.down, Math.min(g.pitch.up, pitch)),
  };
}

/** The gun's frame at an aim: its axis (`ahead`, out along the barrel),
 * its `up` and its `left`, unit vectors in the body frame. */
export function gunAxes(side: Side, yaw: number, pitch: number): { ahead: P3; up: P3; left: P3 } {
  const a = clampAim(yaw, pitch);
  const cy = Math.cos(a.yaw);
  const sy = Math.sin(a.yaw);
  const cp = Math.cos(a.pitch);
  const sp = Math.sin(a.pitch);
  // Square out of the door is +x on the right, -x on the left; forward is +z.
  const flat = { x: side * cy, y: 0, z: sy };
  const ahead = { x: flat.x * cp, y: sp, z: flat.z * cp };
  const up = { x: -flat.x * sp, y: cp, z: -flat.z * sp };
  // The frame is x right, y up, z forward: a man looking along `ahead`
  // has his left at ahead × up.
  const left = {
    x: ahead.y * up.z - ahead.z * up.y,
    y: ahead.z * up.x - ahead.x * up.z,
    z: ahead.x * up.y - ahead.y * up.x,
  };
  return { ahead, up, left };
}

/** A point on the gun at an aim — `ahead` along its axis from the pivot
 * and `up` above it, m — in the body frame. */
export function onGun(side: Side, yaw: number, pitch: number, ahead: number, up: number): P3 {
  const p = gunPivot(side);
  const f = gunAxes(side, yaw, pitch);
  return {
    x: p.x + f.ahead.x * ahead + f.up.x * up,
    y: p.y + f.ahead.y * ahead + f.up.y * up,
    z: p.z + f.ahead.z * ahead + f.up.z * up,
  };
}

/** Where a door gun's rounds leave it, at an aim (body frame). */
export function muzzleOf(side: Side, yaw: number, pitch: number): P3 {
  const m = ARMY_HELI.gun.muzzle;
  return onGun(side, yaw, pitch, m.ahead, m.up);
}

/** Where the gunner's hands and cheek are on his gun at an aim (body
 * frame): the right hand on the pistol grip, the left over the stock's
 * wrist, the cheek on the stock's comb. */
export function gunHolds(
  side: Side,
  yaw: number,
  pitch: number,
): {
  right: P3;
  left: P3;
  cheek: P3;
} {
  const g = ARMY_HELI.gun;
  const f = gunAxes(side, yaw, pitch);
  const right = onGun(side, yaw, pitch, g.grip.ahead, g.grip.up);
  const wrist = onGun(side, yaw, pitch, (g.grip.ahead + g.stock.ahead) / 2, 0.02);
  // The left hand over the stock's wrist, a little to the gun's left.
  const left = {
    x: wrist.x + f.left.x * 0.05,
    y: wrist.y + 0.02,
    z: wrist.z + f.left.z * 0.05,
  };
  return { right, left, cheek: onGun(side, yaw, pitch, g.stock.ahead + 0.12, 0.07) };
}

/** A seat: where the man's seat is (body frame) and the way he faces
 * (heading in the machine, rad: 0 the nose, π/2 the right). */
export type Seat = P3 & { facing: number };

/** THE GUNNER'S SEAT on a side, facing out of the door. */
export function gunnerSeat(side: Side): Seat {
  const g = ARMY_HELI.gunner;
  return { x: side * g.x, y: g.y, z: g.z, facing: (side * Math.PI) / 2 };
}

/** THE PLACES IN A DOORWAY: sat on the cabin's floor at the sill's edge,
 * facing out, the legs over it — the troops ready to drop onto the skid,
 * forward first. */
export function doorSeats(side: Side): Seat[] {
  const s = ARMY_HELI.seats;
  return s.z.map((z) => ({ x: side * s.x, y: ARMY_HELI.sill, z, facing: (side * Math.PI) / 2 }));
}

/** THE BENCH across the aft bulkhead, facing forward, left to right. */
export function benchSeats(): Seat[] {
  const b = ARMY_HELI.bench;
  return b.x.map((x) => ({ x, y: b.y, z: b.z, facing: 0 }));
}

/** Every seat the machine has: both doorways' places and the bench — a
 * section's worth — the gunners left out. */
export function troopSeats(): Seat[] {
  return [...doorSeats(1), ...doorSeats(-1), ...benchSeats()];
}

/** THE FAST ROPE on a side: its hook at the bar's end (body frame). */
export function ropeHook(side: Side): P3 {
  return mirror(ARMY_HELI.rope, side);
}

/** Where a man on the fast rope is, `down` m below its hook — a hand over
 * hand slide straight down it (the rope hangs plumb under a hover). */
export function onRope(side: Side, down: number): P3 {
  const h = ropeHook(side);
  return { x: h.x, y: h.y - Math.max(0, down), z: h.z };
}

/** THE LIGHTS, body frame: the red beacons, and the nav lights (red to
 * port, green to starboard). */
export function lightsOf(): { beacons: P3[]; red: P3; green: P3 } {
  const l = ARMY_HELI.lights;
  return {
    beacons: l.beacons.map((b) => ({ ...b })),
    red: mirror(l.nav, -1),
    green: mirror(l.nav, 1),
  };
}
