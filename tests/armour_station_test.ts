// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRUCK'S CAB AND THE TANK'S STATIONS, DECIDED — the DOM-free half of
// `truck-cab.ts`, `tank-driver.ts` and `tank-gunner.ts` (their plans,
// `truck-cab-plan.ts` and `tank-station-plan.ts`) and the lenses they are
// seen through (`camera-armour.ts`, `armour-cabs.ts`): the truck's driver
// sees his cluster over the wheel, inside a cab inside its shell; his
// hands stay on the rim; the air gauge reads the brakes; the tank's driver
// looks out of his vision blocks from under the deck, his hands on the
// T-bar's grips; the gunner's station is in the turret, and the sight
// looks along the gun's own line — taken while he lays the gun and held a
// moment after.

import { describe, expect, it } from "vitest";

import { ARMY_VEHICLE, fromEuler, rotate, type ArmyVehicle } from "@engine";
import { handsOnWheel, wheelFrame } from "../pwa/src/game/army-cab-plan.ts";
import { ARMOUR_RIGS, armourRigPose } from "../pwa/src/game/camera-armour.ts";
import type { RigPose } from "../pwa/src/game/camera-rigs.ts";
import {
  createSightMemory,
  gunnerLens,
  handsOnYoke,
  SIGHT_HOLD,
  sightLens,
  TANK_DRIVER,
  TANK_GUNNER,
  TANK_SIGHT,
  tankGauges,
  tankStation,
  turretLens,
} from "../pwa/src/game/tank-station-plan.ts";
import { TRUCK_CAB, truckGauges } from "../pwa/src/game/truck-cab-plan.ts";

type V3 = { x: number; y: number; z: number };
const dist = (a: V3, b: V3) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const norm = (a: V3) => {
  const l = Math.hypot(a.x, a.y, a.z);
  return { x: a.x / l, y: a.y / l, z: a.z / l };
};

describe("the truck's cab", () => {
  const C = TRUCK_CAB;
  it("sits inside the cab's shell, the eye inside the cab under its roof", () => {
    const S = C.shell;
    expect(C.inner.half).toBeLessThan(S.half);
    expect(C.inner.roof).toBeLessThan(S.roof);
    expect(C.inner.back).toBeGreaterThan(S.back);
    expect(C.inner.floor).toBeGreaterThan(S.low);
    expect(C.screen.foot.z).toBeLessThan(S.front);
    const e = C.eye;
    expect(Math.abs(e.x)).toBeLessThan(C.inner.half - 0.2);
    expect(e.y).toBeLessThan(C.inner.roof - 0.15);
    expect(e.y).toBeGreaterThan(C.screen.foot.y);
    expect(e.y).toBeLessThan(C.screen.head.y);
    expect(e.z).toBeGreaterThan(C.inner.back);
    expect(e.z).toBeLessThan(C.screen.head.z - 0.4);
    // The cab is the truck's own: inside its plan's length and width.
    const K = ARMY_VEHICLE.kinds.truck;
    expect(S.front).toBeLessThanOrEqual(K.halfLength);
    expect(S.half).toBeLessThanOrEqual(K.halfWidth);
  });

  it("shows the driver his cluster over the wheel's rim", () => {
    const f = wheelFrame(C.wheel);
    const D = C.dash;
    const up = C.cluster.up / Math.hypot(D.top - D.foot.y, D.back - D.foot.z);
    const cluster = {
      x: C.cluster.x,
      y: D.foot.y + (D.top - D.foot.y) * up,
      z: D.foot.z + (D.back - D.foot.z) * up,
    };
    // Where the sight line crosses the rim's top's place along z, it is
    // over the rim.
    const top = { y: f.hub.y + f.up.y * C.wheel.r, z: f.hub.z + f.up.z * C.wheel.r };
    const e = C.eye;
    const k = (top.z - e.z) / (cluster.z - e.z);
    expect(e.y + (cluster.y - e.y) * k).toBeGreaterThan(top.y);
  });

  it("keeps his hands on its rim as it turns", () => {
    const f = wheelFrame(C.wheel);
    for (const turn of [0, 0.7, -0.7, 2.6]) {
      const { left, right } = handsOnWheel(turn, C.wheel);
      for (const h of [left, right])
        expect(Math.abs(dist(h, f.hub) - (C.wheel.r - 0.005))).toBeLessThan(1e-6);
    }
  });

  it("reads the brakes on the air gauge and the tyres let down for the snow", () => {
    const cruise = truckGauges(10, 1, 2, false);
    const braking = truckGauges(10, -1, 2, false);
    expect(braking.air[0]).toBeLessThan(cruise.air[0]);
    expect(cruise.air[0]).toBeGreaterThan(7);
    expect(cruise.tyres).toBeLessThan(2);
    expect(cruise.locks).toBe(true);
    expect(truckGauges(0, 0, 2, true).rpm).toBe(0);
  });

  it("puts the HELMET lens at the driver's eye however the truck leans", () => {
    const rig = ARMOUR_RIGS.truck.helmet;
    if (rig.kind !== "bolted") throw new Error("the helmet rung is bolted");
    for (const [pitch, roll] of [
      [0, 0],
      [0.2, -0.1],
    ]) {
      const v = { x: 5, y: 10, z: -3, heading: 1.2, pitch, roll, speed: 3 } as ArmyVehicle;
      const pose = armourRigPose({} as RigPose, v, null);
      const q = fromEuler(v.heading, pitch, roll);
      const eye = rotate(q, rig.eye);
      const want = rotate(q, C.eye);
      expect(pose.x + eye.x).toBeCloseTo(v.x + want.x, 9);
      expect(pose.y + eye.y).toBeCloseTo(v.y + want.y, 9);
      expect(pose.z + eye.z).toBeCloseTo(v.z + want.z, 9);
    }
  });
});

describe("the tank's driver's station", () => {
  const D = TANK_DRIVER;
  it("puts his eye under the deck, inside the compartment, at the vision blocks' band", () => {
    const R = D.room;
    const e = D.eye;
    expect(e.y).toBeLessThan(R.roof);
    expect(e.y).toBeGreaterThan(D.blocks.lo);
    expect(e.y).toBeLessThan(D.blocks.hi);
    expect(e.x).toBeLessThan(R.left);
    expect(e.x).toBeGreaterThan(R.right);
    expect(e.z).toBeGreaterThan(R.back);
    // Every block ahead of him, within the compartment.
    for (const b of D.blocks.at) {
      expect(b.z).toBeGreaterThan(e.z);
      expect(b.x).toBeLessThan(R.left);
      expect(b.x).toBeGreaterThan(R.right);
    }
    // The deck the hull is built with is over him.
    expect(R.roof).toBeLessThan(1.56);
    expect(ARMOUR_RIGS.tank.helmet).toMatchObject({ eye: { x: e.x, z: e.z } });
  });

  it("keeps his hands on the T-bar's grips, the left coming back as it turns right", () => {
    const rest = handsOnYoke(0);
    expect(rest.left.x).toBeGreaterThan(rest.right.x);
    expect(dist(rest.left, rest.right)).toBeCloseTo(D.yoke.half * 2, 9);
    const right = handsOnYoke(0.4);
    expect(right.left.z).toBeLessThan(rest.left.z);
    expect(right.right.z).toBeGreaterThan(rest.right.z);
    expect(dist(right.left, right.right)).toBeCloseTo(D.yoke.half * 2, 9);
  });

  it("reads the gear, the turret and a knock-out on his display", () => {
    expect(tankGauges(0, 0, 0, 1, false, 12).gear).toBe("N");
    expect(tankGauges(-1, -1, 0, 1, false, 12).gear).toBe("R");
    expect(tankGauges(11, 1, 0.5, 1, false, 12)).toMatchObject({ gear: "4", turret: 0.5 });
    expect(tankGauges(0, 0, 0, 1, true, 12).rpm).toBe(0);
  });
});

describe("the tank's gunner's station and his sight", () => {
  const hull = { x: 40, y: 12, z: -20, heading: 0.8, pitch: 0, roll: 0 };
  const ride = (
    o: Partial<{ laying: boolean; traverse: number; elevate: number; fired: number }>,
  ) => ({
    rider: true,
    laying: o.laying ?? false,
    traverse: o.traverse ?? 0,
    elevate: o.elevate ?? 0,
    body: { kind: "tank", fired: o.fired ?? -Infinity },
  });

  it("is the gunner's on TIPS and the driver's on HELMET, none elsewhere or out of a tank", () => {
    const m = createSightMemory();
    expect(tankStation(m, "tips", ride({}), 10, 0.1)).toBe("gunner");
    expect(tankStation(m, "helmet", ride({}), 10, 0.1)).toBe("driver");
    expect(tankStation(m, "chase", ride({}), 10, 0.1)).toBe(null);
    expect(
      tankStation(m, "tips", { ...ride({}), body: { kind: "truck", fired: 0 } }, 10, 0.1),
    ).toBe(null);
    expect(tankStation(m, "tips", null, 10, 0.1)).toBe(null);
  });

  it("takes the lens to the sight while he lays the gun, and holds it a moment after", () => {
    const m = createSightMemory();
    expect(tankStation(m, "tips", ride({ traverse: 0.6 }), 10, 0.1)).toBe("sight");
    let t = 10;
    let at = "sight";
    while (at === "sight" && t < 20) {
      t += 0.1;
      at = tankStation(m, "tips", ride({}), t, 0.1) ?? "none";
    }
    expect(t - 10).toBeGreaterThan(SIGHT_HOLD - 0.15);
    expect(t - 10).toBeLessThan(SIGHT_HOLD + 0.25);
    expect(at).toBe("gunner");
    // A shot brings the eye to the sight; on HELMET only the trick key does.
    expect(tankStation(m, "tips", ride({ fired: 30 }), 30.2, 0.1)).toBe("sight");
    expect(tankStation(m, "helmet", ride({ traverse: 1 }), 31, 0.1)).toBe("driver");
    expect(tankStation(m, "helmet", ride({ laying: true }), 31, 0.1)).toBe("sight");
  });

  it("looks along the gun's own line from the sight's head on the roof", () => {
    for (const [turret, gun] of [
      [0, 0],
      [0.7, 0.1],
      [-2, -0.12],
    ]) {
      const lens = sightLens(hull, turret, gun);
      const f = norm({
        x: lens.target.x - lens.eye.x,
        y: lens.target.y - lens.eye.y,
        z: lens.target.z - lens.eye.z,
      });
      // The engine's line (`sightPoint`): yaw the heading and the turret,
      // raised the gun.
      const yaw = hull.heading + turret;
      expect(f.x).toBeCloseTo(Math.sin(yaw) * Math.cos(gun), 6);
      expect(f.y).toBeCloseTo(Math.sin(gun), 6);
      expect(f.z).toBeCloseTo(Math.cos(yaw) * Math.cos(gun), 6);
      // The eye at the head, turned with the turret, over the roof.
      const want = rotate(fromEuler(yaw, 0, 0), TANK_SIGHT.head);
      expect(lens.eye.x).toBeCloseTo(hull.x + want.x, 6);
      expect(lens.eye.y).toBeCloseTo(hull.y + TANK_SIGHT.head.y, 6);
      expect(lens.fov).toBe(TANK_SIGHT.fov);
      expect(Math.abs(lens.roll)).toBeLessThan(1e-6);
    }
  });

  it("stands the lens up for the turret's own up as the hull leans", () => {
    const leant = { ...hull, roll: 0.2 };
    expect(Math.abs(turretLens(leant, 0, TANK_SIGHT.head, 0, 10).roll)).toBeGreaterThan(0.15);
  });

  it("sits the gunner's eye inside the turret, behind his sight", () => {
    const G = TANK_GUNNER;
    const e = G.eye;
    expect(e.x).toBeGreaterThan(G.room.gun);
    expect(e.x).toBeLessThan(G.room.wall);
    expect(e.y).toBeGreaterThan(G.room.floor);
    expect(e.y).toBeLessThan(G.room.roof);
    expect(e.z).toBeLessThan(G.sight.z - G.sight.half);
    expect(e.z).toBeGreaterThan(G.room.back);
    const lens = gunnerLens(hull, 0);
    // Looking down at his sight and handles.
    expect(lens.target.y).toBeLessThan(lens.eye.y);
  });
});
