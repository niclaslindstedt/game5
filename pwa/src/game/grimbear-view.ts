// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRIMBEAR AS DRAWN — a bear's bulk on a man's frame, built in code in
// the trees' chunky, faceted look: a barrel of a trunk under a grizzled
// hump, a bear's head with a long pale muzzle and round ears, long arms
// ending in clawed paws, and a man's legs that run. Hung on a skeleton of
// groups the pose (`grimbear-pose.ts`) turns once a frame, and shown only
// while the engine has him out of hiding (`GrimbearState`).

import * as THREE from "three";
import type { GameState, Level } from "@engine";

import { freshGrimbearPose, grimbearPose } from "./grimbear-pose.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";

export type GrimbearView = {
  group: THREE.Group;
  update: (state: GameState) => void;
  dispose: () => void;
};

/** His measures, m: the hips over the snow, a thigh and a shin, the trunk,
 * the upper arm and the forearm. He stands about 2.3 m to the ears. */
const HIP = 1.0;
const THIGH = 0.52;
const SHIN = 0.5;
const TRUNK = 0.86;
const UPPER = 0.48;
const FORE = 0.46;

export function createGrimbearView(level: Level, haze: HazeUniforms): GrimbearView {
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const paint = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => {
    const m = hazeMaterial(
      new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true, ...extra }),
      haze,
      "grimbear",
    );
    materials.push(m);
    return m;
  };
  const fur = paint(0x3a2a1f);
  const mantle = paint(0x5e4a3a);
  const pale = paint(0x8d7660);
  const horn = paint(0x17120f, { roughness: 0.6 });
  const eye = paint(0x2a1a08, { emissive: 0xffa526, emissiveIntensity: 1.6 });

  /** A faceted lump: an icosahedron of radius 1 scaled to (sx, sy, sz). */
  const lump = (sx: number, sy: number, sz: number, detail = 1): THREE.BufferGeometry => {
    const g = new THREE.IcosahedronGeometry(1, detail);
    g.scale(sx, sy, sz);
    geometries.push(g);
    return g;
  };
  /** A limb hanging down from its joint: a six-sided taper `length` long. */
  const limb = (top: number, bottom: number, length: number): THREE.BufferGeometry => {
    const g = new THREE.CylinderGeometry(top, bottom, length, 6);
    g.translate(0, -length / 2, 0);
    geometries.push(g);
    return g;
  };
  const mesh = (
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    x = 0,
    y = 0,
    z = 0,
  ): THREE.Mesh => {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  };
  const joint = (x: number, y: number, z: number, parent: THREE.Object3D): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };

  const group = new THREE.Group();
  group.name = "grimbear";
  group.visible = false;
  /** SHAG: a tuft hanging off a part, its tip pointing down and back. */
  const tuft = (() => {
    const g = new THREE.ConeGeometry(0.07, 0.2, 5);
    g.rotateX(Math.PI);
    g.translate(0, -0.06, 0);
    geometries.push(g);
    return g;
  })();
  const shag = (
    parent: THREE.Object3D,
    material: THREE.Material,
    x: number,
    y: number,
    z: number,
    size = 1,
    tilt = -0.5,
  ): void => {
    const m = mesh(tuft, material, x, y, z);
    m.scale.setScalar(size);
    m.rotation.x = tilt;
    m.rotation.z = x * 1.2;
    parent.add(m);
  };
  const hips = joint(0, HIP, 0, group);
  hips.add(mesh(lump(0.34, 0.22, 0.27), fur, 0, 0.02, 0));
  // THE TRUNK, leant from the hips: a bear's pot belly and barrel chest, the
  // grizzled hump over the shoulders, a ruff at the throat and shag down
  // the flanks and the back.
  const trunk = joint(0, 0.05, 0, hips);
  trunk.add(mesh(lump(0.44, 0.4, 0.4), fur, 0, TRUNK * 0.32, 0.06));
  trunk.add(mesh(lump(0.5, 0.38, 0.4), fur, 0, TRUNK * 0.7, 0.02));
  trunk.add(mesh(lump(0.44, 0.19, 0.34), mantle, 0, TRUNK * 0.9, -0.08));
  trunk.add(mesh(lump(0.26, 0.16, 0.16), mantle, 0, TRUNK * 0.82, 0.3));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) shag(trunk, fur, side * 0.44, TRUNK * (0.25 + i * 0.22), 0, 1.1);
    shag(trunk, mantle, side * 0.3, TRUNK * 0.9, -0.36, 1.2, -1);
  }
  for (let i = 0; i < 3; i++) shag(trunk, fur, 0, TRUNK * (0.8 - i * 0.22), -0.36, 1.0, -1.2);
  // THE HEAD on a thick neck, slung low and forward of the hump as a
  // bear's is: the broad skull, the brow, the long pale muzzle, the round
  // ears, the small eyes that catch a light.
  const head = joint(0, TRUNK * 0.92, 0.32, trunk);
  head.add(mesh(lump(0.22, 0.2, 0.24), fur, 0, 0.08, 0.04));
  head.add(mesh(lump(0.2, 0.06, 0.1), fur, 0, 0.17, 0.16));
  head.add(mesh(lump(0.12, 0.1, 0.17), pale, 0, 0.03, 0.27));
  head.add(mesh(lump(0.055, 0.04, 0.04, 0), horn, 0, 0.07, 0.44));
  for (const side of [-1, 1]) {
    head.add(mesh(lump(0.07, 0.07, 0.04, 0), fur, side * 0.16, 0.26, -0.02));
    head.add(mesh(lump(0.026, 0.02, 0.015, 0), eye, side * 0.095, 0.14, 0.21));
    shag(head, fur, side * 0.2, 0.0, -0.02, 0.9, -0.2);
  }
  const jaw = joint(0, -0.03, 0.14, head);
  jaw.add(mesh(lump(0.1, 0.045, 0.14), pale, 0, -0.02, 0.1));
  // THE ARMS, long and heavy, from wide shoulders: the spread outward, the
  // swing, the elbow, shag down the back of the forearm, a clawed paw.
  const claw = new THREE.ConeGeometry(0.02, 0.13, 4);
  claw.rotateX(Math.PI);
  geometries.push(claw);
  const arms = [-1, 1].map((side) => {
    const spread = joint(side * 0.5, TRUNK * 0.74, 0, trunk);
    const swing = joint(0, 0, 0, spread);
    swing.add(mesh(limb(0.15, 0.12, UPPER), fur, 0, 0, 0));
    swing.add(mesh(lump(0.14, 0.21, 0.14), fur, 0, -UPPER * 0.4, 0));
    const elbow = joint(0, -UPPER, 0, swing);
    elbow.add(mesh(limb(0.12, 0.1, FORE), fur, 0, 0, 0));
    for (let i = 0; i < 3; i++) shag(elbow, fur, 0, -0.08 - i * 0.14, -0.1, 0.8, -0.9);
    elbow.add(mesh(lump(0.12, 0.08, 0.13), fur, 0, -FORE - 0.05, 0.02));
    for (let k = 0; k < 4; k++) {
      elbow.add(mesh(claw, horn, (k - 1.5) * 0.045, -FORE - 0.15, 0.09));
    }
    return { spread, swing, elbow, side };
  });
  // THE LEGS: a man's, to run on — the long thigh, the knee, the shin — in
  // a bear's heavy hams and shaggy calves, on broad clawed feet.
  const legs = [-1, 1].map((side) => {
    const hip = joint(side * 0.19, 0, 0, hips);
    hip.add(mesh(limb(0.19, 0.13, THIGH), fur, 0, 0, 0));
    hip.add(mesh(lump(0.17, 0.24, 0.18), fur, 0, -THIGH * 0.42, 0));
    const knee = joint(0, -THIGH, 0, hip);
    knee.add(mesh(limb(0.13, 0.1, SHIN), fur, 0, 0, 0));
    for (let i = 0; i < 2; i++) shag(knee, fur, 0, -0.1 - i * 0.16, -0.1, 0.85, -0.7);
    knee.add(mesh(lump(0.12, 0.065, 0.2), fur, 0, -SHIN - 0.02, 0.08));
    for (let k = 0; k < 3; k++) {
      const m = mesh(claw, horn, (k - 1) * 0.06, -SHIN - 0.04, 0.28);
      m.rotation.x = -Math.PI / 2;
      knee.add(m);
    }
    return { hip, knee };
  });

  const pose = freshGrimbearPose();
  return {
    group,
    update(state) {
      const b = state.grimbear;
      group.visible = b !== undefined && b.phase !== "away";
      if (!b || !group.visible) return;
      group.position.set(b.x, level.groundAt(b.x, b.z), b.z);
      group.rotation.y = b.heading;
      grimbearPose(b.phase, b.stride, b.speed, b.t, pose);
      // The hips come down as the knees fold under him.
      hips.position.y = HIP + pose.bob;
      trunk.rotation.x = pose.lean;
      head.rotation.x = pose.look - pose.lean * 0.6;
      jaw.rotation.x = pose.jaw * 0.6;
      for (let i = 0; i < 2; i++) {
        legs[i].hip.rotation.x = -pose.hip[i] - pose.lean * 0.3;
        legs[i].knee.rotation.x = pose.knee[i];
        const arm = arms[i];
        arm.spread.rotation.z = arm.side * pose.spread;
        // The shoulder's swing is off the plumb, whatever the trunk's lean.
        arm.swing.rotation.x = -pose.shoulder[i] - pose.lean;
        arm.elbow.rotation.x = -pose.elbow[i];
      }
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
