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
const HIP = 1.02;
const THIGH = 0.52;
const SHIN = 0.5;
const TRUNK = 0.86;
const UPPER = 0.46;
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
  const mantle = paint(0x6e5b47);
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
  const hips = joint(0, HIP, 0, group);
  hips.add(mesh(lump(0.3, 0.2, 0.24), fur, 0, 0.02, 0));
  // THE TRUNK, leant from the hips: the barrel, the grizzled hump over the
  // shoulders, and a ruff of tufts down the back.
  const trunk = joint(0, 0.05, 0, hips);
  trunk.add(mesh(lump(0.4, 0.48, 0.34), fur, 0, TRUNK * 0.45, 0.02));
  trunk.add(mesh(lump(0.46, 0.26, 0.36), mantle, 0, TRUNK * 0.8, -0.04));
  const tuft = lump(0.08, 0.16, 0.08, 0);
  for (let i = 0; i < 5; i++) {
    const m = mesh(
      tuft,
      mantle,
      (i % 2 ? 0.12 : -0.12) * (1 - i * 0.15),
      TRUNK * (0.95 - i * 0.16),
      -0.3,
    );
    m.rotation.x = -0.6;
    trunk.add(m);
  }
  // THE HEAD on a thick neck, set forward of the hump as a bear's is.
  const head = joint(0, TRUNK * 0.92, 0.2, trunk);
  head.add(mesh(lump(0.2, 0.19, 0.22), fur, 0, 0.12, 0.04));
  head.add(mesh(lump(0.11, 0.09, 0.15), pale, 0, 0.07, 0.26));
  head.add(mesh(lump(0.05, 0.035, 0.035, 0), horn, 0, 0.1, 0.4));
  for (const side of [-1, 1]) {
    head.add(mesh(lump(0.065, 0.065, 0.035, 0), fur, side * 0.14, 0.3, -0.02));
    head.add(mesh(lump(0.025, 0.02, 0.015, 0), eye, side * 0.09, 0.18, 0.2));
  }
  const jaw = joint(0, 0.02, 0.12, head);
  jaw.add(mesh(lump(0.09, 0.04, 0.13), pale, 0, -0.02, 0.11));
  // THE ARMS, long, from the shoulders: the spread outward, the swing, the
  // elbow, a clawed paw.
  const claw = new THREE.ConeGeometry(0.018, 0.09, 4);
  claw.rotateX(Math.PI);
  geometries.push(claw);
  const arms = [-1, 1].map((side) => {
    const spread = joint(side * 0.44, TRUNK * 0.78, 0, trunk);
    const swing = joint(0, 0, 0, spread);
    swing.add(mesh(limb(0.13, 0.1, UPPER), fur, 0, 0, 0));
    const elbow = joint(0, -UPPER, 0, swing);
    elbow.add(mesh(limb(0.1, 0.085, FORE), fur, 0, 0, 0));
    elbow.add(mesh(lump(0.1, 0.07, 0.11), fur, 0, -FORE - 0.04, 0.02));
    for (let k = 0; k < 4; k++) {
      elbow.add(mesh(claw, horn, (k - 1.5) * 0.04, -FORE - 0.12, 0.08));
    }
    return { spread, swing, elbow, side };
  });
  // THE LEGS: a man's, to run on, under a bear's thighs and broad feet.
  const legs = [-1, 1].map((side) => {
    const hip = joint(side * 0.17, 0, 0, hips);
    hip.add(mesh(limb(0.15, 0.11, THIGH), fur, 0, 0, 0));
    const knee = joint(0, -THIGH, 0, hip);
    knee.add(mesh(limb(0.11, 0.085, SHIN), fur, 0, 0, 0));
    knee.add(mesh(lump(0.1, 0.06, 0.17), fur, 0, -SHIN - 0.02, 0.07));
    for (let k = 0; k < 3; k++) {
      const m = mesh(claw, horn, (k - 1) * 0.05, -SHIN - 0.05, 0.25);
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
        arm.swing.rotation.x = -pose.shoulder[i];
        arm.elbow.rotation.x = -pose.elbow[i];
      }
    },
    dispose() {
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
    },
  };
}
