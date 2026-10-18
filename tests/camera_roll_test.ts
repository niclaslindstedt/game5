// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A LENS BOLTED TO HIS HEAD BANKS THE WAY HIS HEAD DOES. The engine's roll
// is right side down in axes the renderer draws mirrored, so a helmet lens
// that rolled by the engine's angle tipped the horizon against him: banked
// under the paramotor's wing his own arms and skis swung off across the
// frame the other way. Held here through three.js's own `lookAt`, exactly
// as `aimLens` lays a lens on (`camera-roll.ts`).

import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { fromEuler, rotate } from "@engine";

import { PARA_RIGS } from "../pwa/src/game/camera-para.ts";
import {
  createBoomState,
  frameRig,
  RIGS,
  type LensPose,
  type RigPose,
} from "../pwa/src/game/camera-rigs.ts";

const pose = (heading: number, pitch: number, roll: number): RigPose => ({
  x: 0,
  y: 300,
  z: 0,
  heading,
  pitch,
  roll,
  vx: 0,
  vy: 0,
  vz: 15,
  speed: 15,
  airborne: true,
  packed: 0,
  q: fromEuler(heading, pitch, roll),
});

/** The screen's up and right of `lens` in the world, as `aimLens` stands it. */
function axesOf(lens: LensPose) {
  const cam = new THREE.PerspectiveCamera();
  cam.position.set(lens.eye.x, lens.eye.y, lens.eye.z);
  cam.up.set(0, 1, 0);
  cam.lookAt(lens.target.x, lens.target.y, lens.target.z);
  cam.rotateZ(-lens.roll);
  return {
    up: new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion),
    right: new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion),
  };
}

describe("a lens bolted to his head", () => {
  const cases = [
    { name: "the paramotor's helmet", rig: PARA_RIGS.helmet },
    { name: "the paramotor's look down", rig: PARA_RIGS.tips },
  ];
  for (const { name, rig } of cases) {
    it(`stands ${name} up on his own up, banked either way`, () => {
      for (const bank of [-0.7, -0.3, 0.3, 0.7]) {
        for (const heading of [0, 1.2, -2.5]) {
          const p = pose(heading, 0.1, bank);
          const lens = frameRig(rig, p, createBoomState(), 1 / 60, () => 0);
          const { up, right } = axesOf(lens);
          // His body's own right, as the engine states it: the screen's
          // right never has it swung the other way, and his head's up
          // (square to the look) is the screen's up.
          const look = new THREE.Vector3(
            lens.target.x - lens.eye.x,
            lens.target.y - lens.eye.y,
            lens.target.z - lens.eye.z,
          ).normalize();
          const b = rotate(p.q, { x: 0, y: 1, z: 0 });
          const head = new THREE.Vector3(b.x, b.y, b.z);
          head.addScaledVector(look, -head.dot(look)).normalize();
          // The look turned into the turn tips the up a little off his own.
          expect(up.dot(head)).toBeGreaterThan(0.97);
          // His left hand (the engine's −x) is on the screen's right — the
          // mirror — and stays there however far he banks.
          const left = rotate(p.q, { x: -1, y: 0, z: 0 });
          expect(right.dot(new THREE.Vector3(left.x, left.y, left.z))).toBeGreaterThan(0.9);
        }
      }
    });
  }

  it("banks a skier's helmet the way he leans, by its share", () => {
    for (const bank of [-0.4, 0.4]) {
      const p = pose(0, 0, bank);
      const lens = frameRig(RIGS.helmet, p, createBoomState(), 1 / 60, () => 0);
      const { up } = axesOf(lens);
      const b = rotate(p.q, { x: 0, y: 1, z: 0 });
      // Tipped toward his up, not away from it.
      expect(Math.sign(up.x)).toBe(Math.sign(b.x));
    }
  });
});
