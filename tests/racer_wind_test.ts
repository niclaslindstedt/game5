import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { RACER_WIND, createRacerWind } from "../pwa/src/game/racer-model.ts";

// THE RACER'S CLOTH (`racer-model.ts`'s `createRacerWind`): the air past him
// read off his chest's motion, and the bib's swing — a damped spring driven
// by what he feels — stepped on the clock it is handed (the run's).

/** A skeleton of one bone, moved by hand. */
function rig(): { group: THREE.Group; chest: THREE.Bone } {
  const group = new THREE.Group();
  const chest = new THREE.Bone();
  group.add(chest);
  return { group, chest };
}

/** Ride the chest along `v` (m/s) for `s` seconds at 60 frames a second,
 * from run time `t0`; returns the run time reached. */
function ride(
  wind: ReturnType<typeof createRacerWind>,
  r: ReturnType<typeof rig>,
  v: THREE.Vector3,
  s: number,
  t0: number,
  each?: () => void,
): number {
  const dt = 1 / 60;
  let t = t0;
  for (let i = 0; i < Math.round(s / dt); i++) {
    t += dt;
    r.chest.position.addScaledVector(v, dt);
    r.group.updateMatrixWorld(true);
    wind.update(r.group, r.chest, t);
    each?.();
  }
  return t;
}

describe("the racer's cloth", () => {
  it("lies still at a steady speed: the air is his motion reversed and the bib hangs where it was cut", () => {
    const wind = createRacerWind();
    const r = rig();
    const v = new THREE.Vector3(0, -6, 20);
    ride(wind, r, v, 3, 0);
    expect(wind.uniforms.uAir.value.length()).toBeCloseTo(v.length(), 0);
    expect(wind.uniforms.uSwing.value.length()).toBeLessThan(1e-3);
  });

  it("swings the bib on a landing, never past its reach, and lets it settle again", () => {
    const wind = createRacerWind();
    const r = rig();
    // Falling, then stopped dead on the snow: a hard landing.
    let t = ride(wind, r, new THREE.Vector3(0, -8, 15), 1, 0);
    let most = 0;
    t = ride(wind, r, new THREE.Vector3(0, 0, 15), 0.4, t, () => {
      most = Math.max(most, wind.uniforms.uSwing.value.length());
    });
    expect(most).toBeGreaterThan(0.01);
    expect(most).toBeLessThanOrEqual(RACER_WIND.swingMost + 1e-9);
    ride(wind, r, new THREE.Vector3(0, 0, 15), 3, t);
    expect(wind.uniforms.uSwing.value.length()).toBeLessThan(2e-3);
  });

  it("is laid at rest by a jump in the clock or a teleport, never thrown by one", () => {
    const wind = createRacerWind();
    const r = rig();
    let t = ride(wind, r, new THREE.Vector3(0, -8, 15), 1, 0);
    t = ride(wind, r, new THREE.Vector3(0, 0, 15), 0.05, t);
    expect(wind.uniforms.uSwing.value.length()).toBeGreaterThan(0);
    // A restart: the clock goes back.
    r.group.updateMatrixWorld(true);
    wind.update(r.group, r.chest, 0.1);
    expect(wind.uniforms.uSwing.value.length()).toBe(0);
    // A reset: he is stood up 200 m away in one frame.
    t = ride(wind, r, new THREE.Vector3(0, 0, 15), 0.5, 0.1);
    r.chest.position.x += 200;
    r.group.updateMatrixWorld(true);
    wind.update(r.group, r.chest, t + 1 / 60);
    expect(wind.uniforms.uSwing.value.length()).toBe(0);
  });

  it("keeps the run's clock: a frame drawn twice at one moment moves nothing", () => {
    const wind = createRacerWind();
    const r = rig();
    let t = ride(wind, r, new THREE.Vector3(0, -8, 15), 1, 0);
    t = ride(wind, r, new THREE.Vector3(0, 0, 15), 0.05, t);
    const before = wind.uniforms.uSwing.value.clone();
    const air = wind.uniforms.uAir.value.clone();
    // Drawn again with the run held (a paused card, a second pass): the
    // chest is read at the same moment, so nothing is stepped.
    r.chest.position.z += 1;
    r.group.updateMatrixWorld(true);
    wind.update(r.group, r.chest, t);
    expect(wind.uniforms.uSwing.value.equals(before)).toBe(true);
    expect(wind.uniforms.uAir.value.equals(air)).toBe(true);
  });
});
