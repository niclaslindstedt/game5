// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HARNESS-CONTAINER ON THE SKIER (`chute-scene.ts` wears it) — built
// after the sport rigs a skydiver flies: one container on his back in two
// trays, the RESERVE on top under its own flap and the MAIN below it under
// a closing flap, the PILOT CHUTE's pouch on the BOTTOM OF THE CONTAINER
// with its little handle (a soft ball on a short tab) showing to the right,
// where the right hand finds it; the MAIN LIFT WEBS coming over his
// shoulders from the container and down his chest, their three-ring
// releases up by the collarbones; the RED CUT-AWAY PAD on the right lift web
// at the chest and the RESERVE'S metal handle on the left one; a CHEST
// STRAP across; and a LEG STRAP round each thigh. Everything is laid in his
// CHEST bone's frame (x across to his right, y up the spine, z out of his
// chest; `skier-rig.ts`) from the waist, so it turns with the trunk as
// posed, and the leg straps in each thigh's.

import * as THREE from "three";
import { CHUTE } from "@engine";

import type { BoneFrame } from "./skier-rig.ts";

/** WHERE THE PIECES ARE in his chest's frame, m: the container's middle
 * (out behind his back), how far his chest's front stands out of the spine
 * at the lift webs, the webs' line across, the pads' height up the chest. */
export const GEAR = {
  back: { up: 0.2, out: -0.17 },
  front: 0.115,
  webs: 0.105,
  pads: 0.21,
  chestStrap: 0.3,
  /** The pilot chute's handle at the bottom of the container, right of
   * the middle: where the pull reaches. */
  pouch: { x: 0.07, y: -0.085, z: -0.2 },
  /** The leg strap down each thigh from the hip, m, and round it. */
  leg: { down: 0.13, radius: 0.088 },
} as const;

export type Gear = {
  /** The container and harness, laid in the chest's frame. */
  body: THREE.Group;
  /** The leg straps, each in its thigh's frame. */
  legs: [THREE.Mesh, THREE.Mesh];
  /** The red cut-away pad and the pilot chute's handle: drawn on the
   * harness, or (`hold`) carried in a hand. */
  pad: THREE.Mesh;
  handle: THREE.Mesh;
  dispose(): void;
};

/** BUILD THE RIG off three materials: the container's cloth, its trim and
 * the webbing. */
export function createGear(
  cloth: THREE.Material,
  trim: THREE.Material,
  web: THREE.Material,
  std: (color: number, roughness: number) => THREE.MeshStandardMaterial,
): Gear {
  const K = CHUTE.container;
  const body = new THREE.Group();
  body.name = "harness";
  const geos: THREE.BufferGeometry[] = [];
  const box = (
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
    x: number,
    y: number,
    z: number,
  ): THREE.Mesh => {
    const g = new THREE.BoxGeometry(w, h, d);
    geos.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    body.add(mesh);
    return mesh;
  };
  const B = GEAR.back;
  const lower = K.height * 0.64;
  const upper = K.height - lower;
  const yBase = B.up - K.height / 2;
  // THE MAIN TRAY below, its closing flap on the back in a lighter panel.
  box(K.width, lower, K.depth, cloth, 0, yBase + lower / 2, B.out);
  box(
    K.width * 0.86,
    lower * 0.8,
    0.01,
    trim,
    0,
    yBase + lower * 0.52,
    B.out - K.depth / 2 - 0.004,
  );
  // THE RESERVE TRAY on top, a little narrower, under its own flap.
  box(K.width * 0.94, upper, K.depth * 0.88, cloth, 0, yBase + lower + upper / 2, B.out + 0.005);
  box(
    K.width * 0.9,
    upper * 0.55,
    K.depth * 0.7,
    trim,
    0,
    yBase + K.height - upper * 0.2,
    B.out - 0.01,
  );
  // THE BOC POUCH under the main, the handle's tab out of it to the right.
  const P = GEAR.pouch;
  box(0.16, 0.05, 0.07, cloth, 0, yBase - 0.02, B.out - 0.02);
  // The handle (a soft ball), kept out of `body` so a hand can carry it.
  const ballGeo = new THREE.SphereGeometry(0.026, 8, 6);
  geos.push(ballGeo);
  const handle = new THREE.Mesh(ballGeo, std(0xe8e4d6, 0.7));
  handle.position.set(P.x, P.y, P.z);
  body.add(handle);
  // THE MAIN LIFT WEBS: up out of the container over each shoulder and
  // down the chest, the three rings up by the collarbone.
  const F = GEAR.front;
  for (const side of [-1, 1]) {
    const x = side * GEAR.webs;
    // Up the back to the shoulder, over it, down the chest to the hip.
    const over = box(0.046, 0.008, F - B.out, web, x, B.up + K.height / 2 + 0.04, (F + B.out) / 2);
    over.rotation.x = 0.08;
    box(0.046, 0.48, 0.008, web, x, 0.25, F);
    const ring = new THREE.TorusGeometry(0.022, 0.005, 5, 10);
    geos.push(ring);
    const r = new THREE.Mesh(ring, std(0x9aa0a8, 0.35));
    r.position.set(x, 0.43, F + 0.008);
    body.add(r);
    // The waist's lateral straps round to the container.
    const lat = box(0.035, 0.035, F - B.out - 0.04, web, side * 0.15, 0.02, (F + B.out) / 2);
    lat.rotation.y = side * 0.12;
  }
  // THE CHEST STRAP across.
  box(GEAR.webs * 2 + 0.02, 0.028, 0.008, web, 0, GEAR.chestStrap, F + 0.004);
  // THE RESERVE'S HANDLE on the left web, metal.
  box(0.07, 0.035, 0.018, std(0xb9bec6, 0.3), -GEAR.webs - 0.012, GEAR.pads, F + 0.012);
  // THE CUT-AWAY PAD on the right web: a red pillow, kept apart so the hand
  // that punches it can carry it away.
  const padGeo = new THREE.BoxGeometry(0.075, 0.05, 0.026);
  geos.push(padGeo);
  const pad = new THREE.Mesh(padGeo, std(0xc8201c, 0.55));
  pad.position.set(GEAR.webs + 0.012, GEAR.pads, F + 0.014);
  body.add(pad);
  // THE LEG STRAPS, round each thigh (the torus's axis laid along the bone).
  const strap = new THREE.TorusGeometry(GEAR.leg.radius, 0.014, 5, 16);
  strap.rotateX(Math.PI / 2);
  geos.push(strap);
  const legs: [THREE.Mesh, THREE.Mesh] = [new THREE.Mesh(strap, web), new THREE.Mesh(strap, web)];
  return {
    body,
    legs,
    pad,
    handle,
    dispose() {
      for (const g of geos) g.dispose();
      (handle.material as THREE.Material).dispose();
      (pad.material as THREE.Material).dispose();
    },
  };
}

const m = new THREE.Matrix4();
const xs = new THREE.Vector3();
const ys = new THREE.Vector3();
const zs = new THREE.Vector3();
const keep = new THREE.Vector3();

/** Lay `obj` in a bone's frame (in `world`, the figure's group's matrix),
 * `down` m along the bone. */
export function layOnBone(obj: THREE.Object3D, f: BoneFrame, world: THREE.Matrix4, down = 0): void {
  m.makeBasis(
    xs.set(f.x.x, f.x.y, f.x.z),
    ys.set(f.y.x, f.y.y, f.y.z),
    zs.set(f.z.x, f.z.y, f.z.z),
  );
  m.setPosition(f.head.x + f.y.x * down, f.head.y + f.y.y * down, f.head.z + f.y.z * down);
  m.premultiply(world);
  m.decompose(obj.position, obj.quaternion, keep);
}
