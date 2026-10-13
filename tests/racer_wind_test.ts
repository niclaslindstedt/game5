// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The modelled racer's wind (`racer-model.ts`'s `createRacerWind`): the air
// read off his chest's motion, the bib's hem swung on what the chest feels,
// and both stepped on the run's clock.

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { bindPose } from "../pwa/src/game/dress-loft.ts";
import { createRacerWind, RACER_WIND } from "../pwa/src/game/racer-model.ts";

/** A chest bone in the group's frame, turned as it was bound. */
function rig(): { group: THREE.Group; chest: THREE.Bone } {
  const group = new THREE.Group();
  const chest = new THREE.Bone();
  const c = bindPose().frames.chest;
  chest.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(
      new THREE.Vector3(c.x.x, c.x.y, c.x.z),
      new THREE.Vector3(c.y.x, c.y.y, c.y.z),
      new THREE.Vector3(c.z.x, c.z.y, c.z.z),
    ),
  );
  group.add(chest);
  return { group, chest };
}

/** Steps the chest along `z` at `speed(t)` m/s for `seconds` at 60 Hz. */
function ride(
  wind: ReturnType<typeof createRacerWind>,
  { group, chest }: ReturnType<typeof rig>,
  from: number,
  seconds: number,
  speed: (t: number) => number,
): number {
  const dt = 1 / 60;
  let t = from;
  for (let i = 0; i < seconds * 60; i++) {
    chest.position.z += speed(t) * dt;
    group.updateMatrixWorld(true);
    t += dt;
    wind.clock(t);
    wind.update(group, chest, 0);
  }
  return t;
}

describe("the racer's wind", () => {
  it("reads the air past him as his own motion reversed", () => {
    const wind = createRacerWind();
    const r = rig();
    ride(wind, r, 0, 2, () => 20);
    const air = wind.uniforms.uAir.value;
    expect(air.z).toBeCloseTo(-20, 0);
    expect(Math.hypot(air.x, air.y)).toBeLessThan(0.5);
  });

  it("swings the hem forward when he brakes, and settles it after", () => {
    const wind = createRacerWind();
    const r = rig();
    let t = ride(wind, r, 0, 2, () => 20);
    expect(Math.abs(wind.uniforms.uSwing.value.z)).toBeLessThan(0.005);
    // A hard stop: 20 m/s to 5 in half a second.
    const start = t;
    t = ride(wind, r, t, 0.5, (s) => 20 - 30 * (s - start));
    const swung = wind.uniforms.uSwing.value.z;
    expect(swung).toBeGreaterThan(0.03);
    expect(wind.uniforms.uSwing.value.length()).toBeLessThanOrEqual(RACER_WIND.swingMost + 1e-9);
    ride(wind, r, t, 3, () => 5);
    expect(Math.abs(wind.uniforms.uSwing.value.z)).toBeLessThan(0.1 * swung);
  });

  it("holds on a held clock and lays him at rest on a step back", () => {
    const wind = createRacerWind();
    const r = rig();
    const t = ride(wind, r, 0, 1, () => 15);
    const air = wind.uniforms.uAir.value.clone();
    // The same moment again (a paused replay): nothing moves.
    wind.clock(t);
    wind.update(r.group, r.chest, 0);
    expect(wind.uniforms.uAir.value.equals(air)).toBe(true);
    // A restart's clock: everything laid at rest.
    wind.clock(0.1);
    wind.update(r.group, r.chest, 0);
    expect(wind.uniforms.uAir.value.length()).toBe(0);
    expect(wind.uniforms.uSwing.value.length()).toBe(0);
  });
});
