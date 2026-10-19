// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTER AS PLACES (`army-heli-plan.ts`): the doorways, the
// door guns' arcs and frames, the gunners' hands, the seats and the fast
// ropes — each where the table (`ARMY_HELI`) says, inside the airframe
// where it must be, and the left the right's mirror.

import { describe, expect, it } from "vitest";
import { ARMY_HELI } from "@engine";

import {
  benchSeats,
  clampAim,
  doorSeats,
  doorSlide,
  doorwayOf,
  gunAxes,
  gunHolds,
  gunnerSeat,
  gunPivot,
  lightsOf,
  muzzleOf,
  onRope,
  ropeHook,
  SIDES,
  troopSeats,
  type P3,
} from "../pwa/src/game/army-heli-plan.ts";

const dist = (a: P3, b: P3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const dot = (a: P3, b: P3) => a.x * b.x + a.y * b.y + a.z * b.z;
const half = ARMY_HELI.body.width / 2;

describe("the army's helicopter's places", () => {
  it("states a machine of the class: a four-bladed rotor about 14 m across, about 13 m nose to fin", () => {
    expect(ARMY_HELI.rotor.blades).toBe(4);
    expect(2 * ARMY_HELI.rotor.radius).toBeGreaterThan(13.5);
    expect(2 * ARMY_HELI.rotor.radius).toBeLessThan(14.5);
    const length = ARMY_HELI.body.nose - ARMY_HELI.body.tail;
    expect(length).toBeGreaterThan(12);
    expect(length).toBeLessThan(14);
  });

  it("opens each doorway in the cabin's side between the crew's bulkhead and the troops', and slides its door aft its own width", () => {
    for (const side of SIDES) {
      const d = doorwayOf(side);
      expect(d.x).toBeCloseTo(side * half);
      expect(d.front).toBeGreaterThan(d.back);
      expect(d.head - d.sill).toBeGreaterThan(1.1);
      expect(d.sill).toBe(ARMY_HELI.sill);
    }
    expect(doorSlide(0)).toBe(0);
    expect(doorSlide(1)).toBeCloseTo(ARMY_HELI.door.front - ARMY_HELI.door.back, 1);
    expect(doorSlide(2)).toBe(doorSlide(1));
    expect(doorSlide(-1)).toBe(0);
  });

  it("stands each gun's pivot in its doorway, the left the right's mirror", () => {
    const r = gunPivot(1);
    const l = gunPivot(-1);
    expect(l).toEqual({ x: -r.x, y: r.y, z: r.z });
    const d = doorwayOf(1);
    expect(r.z).toBeLessThanOrEqual(d.front);
    expect(r.z).toBeGreaterThanOrEqual(d.back);
    expect(r.y).toBeGreaterThan(d.sill);
    expect(r.y).toBeLessThan(d.head);
  });

  it("holds an aim inside the gun's stops", () => {
    const g = ARMY_HELI.gun;
    expect(clampAim(9, 9)).toEqual({ yaw: g.yaw, pitch: g.pitch.up });
    expect(clampAim(-9, -9)).toEqual({ yaw: -g.yaw, pitch: -g.pitch.down });
    expect(clampAim(0.1, -0.2)).toEqual({ yaw: 0.1, pitch: -0.2 });
  });

  it("frames the gun with three square unit axes: out of the door at rest, toward the nose with yaw, up with pitch", () => {
    for (const side of SIDES) {
      for (const [yaw, pitch] of [
        [0, 0],
        [0.6, -0.4],
        [-0.9, 0.2],
      ]) {
        const f = gunAxes(side, yaw, pitch);
        for (const a of [f.ahead, f.up, f.left]) expect(Math.hypot(a.x, a.y, a.z)).toBeCloseTo(1);
        expect(dot(f.ahead, f.up)).toBeCloseTo(0);
        expect(dot(f.ahead, f.left)).toBeCloseTo(0);
        expect(dot(f.up, f.left)).toBeCloseTo(0);
      }
      const rest = gunAxes(side, 0, 0);
      expect(rest.ahead.x).toBeCloseTo(side);
      expect(rest.up.y).toBeCloseTo(1);
      // Looking out of the right door, his left is toward the nose.
      expect(rest.left.z).toBeCloseTo(side);
      expect(gunAxes(side, 0.5, 0).ahead.z).toBeGreaterThan(0);
      expect(gunAxes(side, 0, 0.2).ahead.y).toBeGreaterThan(0);
    }
  });

  it("puts the muzzle outside the cabin at any aim, where the rounds can clear the airframe", () => {
    for (const side of SIDES) {
      for (const yaw of [-1.2, -0.6, 0, 0.6, 1.2]) {
        for (const pitch of [-1.05, -0.5, 0, 0.3]) {
          const m = muzzleOf(side, yaw, pitch);
          expect(side * m.x, `${side} ${yaw} ${pitch}`).toBeGreaterThan(half - 0.05);
        }
      }
    }
  });

  it("puts the gunner's hands and cheek on his gun within an arm's reach of his seat", () => {
    for (const side of SIDES) {
      const s = gunnerSeat(side);
      expect(Math.sign(s.x)).toBe(side);
      expect(s.facing).toBeCloseTo((side * Math.PI) / 2);
      for (const [yaw, pitch] of [
        [0, 0],
        [0.7, -0.2],
        [-0.7, -0.2],
        [0, -0.6],
      ]) {
        const h = gunHolds(side, yaw, pitch);
        const shoulder = { x: s.x + side * 0.15, y: s.y + 0.55, z: s.z };
        for (const p of [h.right, h.left, h.cheek]) expect(dist(p, shoulder)).toBeLessThan(0.75);
        // The right fist on the grip under the gun, the cheek on its stock
        // behind the grip.
        expect(dist(h.right, h.left)).toBeGreaterThan(0.05);
        expect(dist(h.cheek, gunPivot(side))).toBeGreaterThan(dist(h.right, gunPivot(side)));
      }
    }
  });

  it("seats a section inside the cabin: two doorways' places and the bench, the gunners apart", () => {
    const seats = troopSeats();
    expect(seats).toHaveLength(2 * ARMY_HELI.seats.z.length + ARMY_HELI.bench.x.length);
    for (const s of seats) {
      expect(Math.abs(s.x)).toBeLessThan(half);
      expect(s.z).toBeLessThanOrEqual(ARMY_HELI.cabin.front);
      expect(s.z).toBeGreaterThanOrEqual(ARMY_HELI.cabin.back);
      for (const side of SIDES) expect(dist(s, gunnerSeat(side))).toBeGreaterThan(0.4);
    }
    for (const side of SIDES) {
      for (const s of doorSeats(side)) expect(s.facing).toBeCloseTo((side * Math.PI) / 2);
    }
    for (const s of benchSeats()) expect(s.facing).toBe(0);
  });

  it("hangs each fast rope outside the doorway, plumb under its hook", () => {
    for (const side of SIDES) {
      const h = ropeHook(side);
      expect(side * h.x).toBeGreaterThan(half);
      expect(h.z).toBeLessThan(ARMY_HELI.door.front);
      expect(h.z).toBeGreaterThan(ARMY_HELI.door.back);
      expect(onRope(side, 5)).toEqual({ x: h.x, y: h.y - 5, z: h.z });
      expect(onRope(side, -1)).toEqual(h);
    }
  });

  it("lights it with the beacons on the centre line and the nav lights red to port, green to starboard", () => {
    const l = lightsOf();
    for (const b of l.beacons) expect(b.x).toBe(0);
    expect(l.red.x).toBeLessThan(0);
    expect(l.green.x).toBeGreaterThan(0);
    expect(l.red.y).toBe(l.green.y);
  });
});
