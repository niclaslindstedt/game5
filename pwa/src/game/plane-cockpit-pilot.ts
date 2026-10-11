// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S PILOT (`plane-cockpit.ts` seats him) — one of the
// people on foot's bodies (`civilian-shapes.ts`, the man at the near cut)
// dressed as a pilot — a dark flight jacket, grey trousers, his headset
// over his ears — sat in the left seat and posed every frame onto the
// controls: his left hand round the stick's grip, his right on the power
// lever, his feet on the pedals, his elbows and knees solved to them
// (`joint`). The joints are written in the cockpit's frame
// (`plane-cockpit-plan.ts`) and the figure is emitted there, so it hangs in
// the cockpit's mirrored room like the rest of it.
//
// From his own eyes (the HELMET rung) his head is drawn down into his
// collar, so the lens is never inside his skull; his arms, hands and knees
// are still seen on the controls.

import * as THREE from "three";

import { buildCivilianFigure, civilianMaterial, poseCivilianFigure } from "./civilian-shapes.ts";
import { PART } from "./civilian-dress.ts";
import type { Posed, V3 as P3 } from "./crowd-rig.ts";
import type { HazeUniforms } from "./haze.ts";
import { PLANE_COCKPIT, joint } from "./plane-cockpit-plan.ts";

type V3 = { x: number; y: number; z: number };

/** His kit, as eight indices into the people's palette: a navy jacket,
 * grey trousers, a black head, the skis' slot unused, a dark accent, the
 * skin, brown hair, the jacket again for the vest. */
const KIT = [10, 18, 25, 33, 6, 40, 45, 10];

export type CockpitPilot = {
  /** The figure and his headset, in the cockpit's frame. */
  group: THREE.Group;
  /** Posed with his hands at `left` (the stick) and `right` (the power
   * lever) and his feet on the pedals at `pedals` (left, right), his head
   * drawn in when `own` (the lens is his eyes). */
  pose(left: V3, right: V3, pedals: [V3, V3], own: boolean): void;
  dispose(): void;
};

const arr = (p: V3): P3 => [p.x, p.y, p.z];

export function createCockpitPilot(haze: HazeUniforms): CockpitPilot {
  const C = PLANE_COCKPIT;
  const Pi = C.pilot;
  const group = new THREE.Group();
  group.name = "cockpit_pilot";
  const geometry = buildCivilianFigure("man", "near").clone();
  geometry.morphAttributes = {};
  const attr = (v: number[]) => new THREE.InstancedBufferAttribute(new Float32Array(v), 4);
  geometry.setAttribute("aDress", attr(KIT.slice(0, 4)));
  geometry.setAttribute("aDress2", attr(KIT.slice(4, 8)));
  geometry.setAttribute("aKit", attr([PART.hair, 0, 0, 0]));
  const material = civilianMaterial(haze);
  const mesh = new THREE.InstancedMesh(geometry, material, 1);
  mesh.setMatrixAt(0, new THREE.Matrix4());
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = "cockpit_pilot_body";
  group.add(mesh);

  // THE HEADSET: two ear cups on a band over his head and the boom mic.
  const black = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.55 });
  const cups = new THREE.Group();
  for (const s of [-1, 1]) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.035, 14), black);
    cup.rotation.z = Math.PI / 2;
    cup.position.set(s * 0.115, 0, 0);
    cups.add(cup);
  }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.012, 6, 18, Math.PI), black);
  band.position.set(0, 0.0, 0);
  cups.add(band);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.13, 6), black);
  boom.rotation.x = Math.PI / 2;
  boom.rotation.y = 0.5;
  boom.position.set(-0.08, -0.06, 0.07);
  cups.add(boom);
  group.add(cups);

  const posed: Posed = {
    skiL: { tail: [0, 0, 0], tip: [0, 0, 1], mid: [0, 0, 0.5], side: [1, 0, 0.5] },
    skiR: { tail: [0, 0, 0], tip: [0, 0, 1], mid: [0, 0, 0.5], side: [1, 0, 0.5] },
    ankleL: [0, 0, 0],
    ankleR: [0, 0, 0],
    kneeL: [0, 0, 0],
    kneeR: [0, 0, 0],
    hipL: [0, 0, 0],
    hipR: [0, 0, 0],
    pelvis: [0, 0, 0],
    waist: [0, 0, 0],
    neck: [0, 0, 0],
    head: [0, 0, 0],
    shoulderL: [0, 0, 0],
    shoulderR: [0, 0, 0],
    elbowL: [0, 0, 0],
    elbowR: [0, 0, 0],
    handL: [0, 0, 0],
    handR: [0, 0, 0],
    basketL: [0, 0, 0],
    basketR: [0, 0, 0],
  };
  const x0 = -C.seat.x;
  const last = { key: "" };

  return {
    group,
    pose(left, right, pedals, own) {
      const key =
        [left, right, ...pedals]
          .map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)},${p.z.toFixed(3)}`)
          .join("|") + (own ? "o" : "");
      if (key === last.key) return;
      last.key = key;
      const pelvis = { x: x0, y: Pi.hip.y, z: Pi.hip.z };
      const neck = { x: x0, y: Pi.shoulder.y + 0.06, z: Pi.shoulder.z + 0.01 };
      const eye = C.eye;
      const head = own
        ? { x: x0, y: neck.y - 0.12, z: neck.z - 0.06 }
        : { x: eye.x, y: eye.y - 0.03, z: eye.z - 0.08 };
      posed.pelvis = arr(pelvis);
      posed.waist = [x0, (pelvis.y * 2 + neck.y) / 3, (pelvis.z * 2 + neck.z) / 3 - 0.02];
      posed.neck = arr(neck);
      posed.head = arr(head);
      // The arms, the elbows out and down: the left round the stick, the
      // right on the power lever, each wrist a hand's breadth short of the
      // grip.
      const arms: [V3, number, V3][] = [
        [left, -1, { x: -0.6, y: -0.7, z: -0.4 }],
        [right, 1, { x: 0.5, y: -0.8, z: -0.3 }],
      ];
      for (const [hand, side, pole] of arms) {
        const sh = { x: x0 + side * Pi.shoulder.half, y: Pi.shoulder.y, z: Pi.shoulder.z };
        const wrist = { x: hand.x - side * 0.01, y: hand.y + 0.02, z: hand.z - 0.06 };
        const el = joint(sh, wrist, Pi.upperArm, Pi.forearm, pole);
        if (side < 0) {
          posed.shoulderL = arr(sh);
          posed.elbowL = arr(el);
          posed.handL = arr(hand);
          posed.basketL = arr(hand);
        } else {
          posed.shoulderR = arr(sh);
          posed.elbowR = arr(el);
          posed.handR = arr(hand);
          posed.basketR = arr(hand);
        }
      }
      // The legs, the knees up and a little out, the feet flat on the
      // pedals.
      [-1, 1].forEach((side, i) => {
        const hip = { x: x0 + side * Pi.hip.half, y: Pi.hip.y, z: Pi.hip.z };
        const p = pedals[i];
        const ankle = { x: p.x, y: p.y + 0.08, z: p.z - 0.1 };
        const knee = joint(hip, ankle, Pi.thigh, Pi.shin, { x: side * 0.3, y: 1, z: 0.3 });
        const ski = {
          tail: [ankle.x, ankle.y - 0.08, ankle.z - 0.08] as P3,
          tip: [ankle.x, ankle.y + 0.02, ankle.z + 0.2] as P3,
          mid: [ankle.x, ankle.y - 0.05, ankle.z + 0.05] as P3,
          side: [ankle.x + 0.1, ankle.y - 0.05, ankle.z + 0.05] as P3,
        };
        if (side < 0) {
          posed.hipL = arr(hip);
          posed.kneeL = arr(knee);
          posed.ankleL = arr(ankle);
          posed.skiL = ski;
        } else {
          posed.hipR = arr(hip);
          posed.kneeR = arr(knee);
          posed.ankleR = arr(ankle);
          posed.skiR = ski;
        }
      });
      poseCivilianFigure("man", "near", posed, geometry);
      geometry.computeBoundingSphere();
      cups.visible = !own;
      cups.position.set(head.x, head.y + 0.01, head.z);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      black.dispose();
      cups.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    },
  };
}
