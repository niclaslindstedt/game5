// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BONES LAB's page (driven by `scripts/bones-preview.mjs`): every long
// bone that can stand out through the skin (`gore-bones.ts`'s
// `OPEN_BONES`), built by the game's own builder and drawn in the gore
// view's own wet material on a limb of the game's measure in a jacket's
// red — a row a bone, a column a grade (a simple break, a wedge, shattered)
// seen from three quarters ahead, and the simple break from the side, from
// above and from behind — under a winter sun, so the shaft, the jagged
// break, the marrow and the torn wound can be judged close, at a size the
// game's lens never comes to. `?bones=humerusL,tibiaL` draws a subset.
//
// Sets `window.__done` when the sheet is on screen.

import * as THREE from "three";

import { FRACTURE_GRADE, type BONES } from "@engine";

import { OPEN_BONES, openBreakGeometry, placeBreak } from "../game/gore-bones.ts";
import type { BoneFrame } from "../game/skier-rig.ts";

type Bone = (typeof BONES)[number];

const CELL_W = 360;
const CELL_H = 270;

const query = new URLSearchParams(location.search);
const ROWS: { bone: Bone; limb: number; label: string }[] = [
  { bone: "humerusL", limb: 0.065, label: "humerus · upper arm" },
  { bone: "radiusL", limb: 0.05, label: "radius · forearm" },
  { bone: "ulnaL", limb: 0.05, label: "ulna · forearm" },
  { bone: "femurL", limb: 0.09, label: "femur · thigh" },
  { bone: "tibiaL", limb: 0.06, label: "tibia · shin" },
];
const want = query.get("bones");
const rows = want ? ROWS.filter((r) => want.split(",").includes(r.bone)) : ROWS;

/** A column: the grade and where the lens stands about the wound (azimuth
 * round the limb from ahead of the bone's end, degrees; elevation over the
 * skin, degrees; distance, m). */
type Col = { name: string; grade: number; az: number; el: number; dist: number };
const COLS: Col[] = [
  { name: "simple", grade: FRACTURE_GRADE.simple, az: 40, el: 35, dist: 0.32 },
  { name: "wedge", grade: FRACTURE_GRADE.wedge, az: 40, el: 35, dist: 0.32 },
  { name: "shattered", grade: FRACTURE_GRADE.shatter, az: 40, el: 35, dist: 0.32 },
  { name: "simple · side", grade: FRACTURE_GRADE.simple, az: 90, el: 8, dist: 0.32 },
  { name: "simple · above", grade: FRACTURE_GRADE.simple, az: 0, el: 85, dist: 0.3 },
  { name: "simple · behind", grade: FRACTURE_GRADE.simple, az: 180, el: 30, dist: 0.32 },
  { name: "simple · far", grade: FRACTURE_GRADE.simple, az: 40, el: 25, dist: 1.6 },
];

const canvas = document.getElementById("stage") as HTMLCanvasElement;
const W = CELL_W * COLS.length;
const H = CELL_H * rows.length;
canvas.width = W;
canvas.height = H;
canvas.style.width = `${W}px`;
canvas.style.height = `${H}px`;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.setScissorTest(true);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xcfdcef, 0xf2f5f8, 1.1));
const sun = new THREE.DirectionalLight(0xfff3e2, 2.4);
sun.position.set(0.6, 1, 0.45);
sun.castShadow = true;
scene.add(sun);

// The limb lies along +x, its front (`BoneFrame.z`) toward +z, the bone's
// end pointing down it (+x): its frame's x is y × z.
const frame = (): BoneFrame => ({
  head: { x: -0.25, y: 0, z: 0 },
  y: { x: 1, y: 0, z: 0 },
  z: { x: 0, y: 0, z: 1 },
  x: { x: 0, y: -1, z: 0 },
  length: 0.5,
});
const flesh = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.32,
  metalness: 0.02,
  side: THREE.DoubleSide,
});
const sleeve = new THREE.MeshStandardMaterial({ color: 0xb8241c, roughness: 0.75 });

const labels = document.getElementById("labels") as HTMLDivElement;
const label = (x: number, y: number, text: string) => {
  const div = document.createElement("div");
  div.className = "label";
  div.style.left = `${x}px`;
  div.style.top = `${y}px`;
  div.textContent = text;
  labels.appendChild(div);
};

rows.forEach((row, ri) => {
  const o = OPEN_BONES[row.bone]!;
  const f = frame();
  COLS.forEach((col, ci) => {
    const limb = new THREE.Mesh(new THREE.CylinderGeometry(row.limb, row.limb, 0.5, 40), sleeve);
    limb.rotation.z = Math.PI / 2;
    limb.castShadow = limb.receiveShadow = true;
    const mesh = new THREE.Mesh(
      openBreakGeometry({
        r: o.r,
        out: o.out,
        limb: row.limb,
        grade: col.grade,
        seed: ri * 5.1 + 1,
      }),
      flesh,
    );
    mesh.castShadow = true;
    placeBreak(mesh, o, f, 0.25, row.limb);
    scene.add(limb, mesh);
    // The lens about the wound: azimuth round the skin's normal from the
    // way the bone points.
    const n = new THREE.Vector3(0, 1, 0).applyQuaternion(mesh.quaternion);
    const along = new THREE.Vector3(0, 0, 1).applyQuaternion(mesh.quaternion);
    const side = new THREE.Vector3().crossVectors(n, along);
    const az = (col.az * Math.PI) / 180;
    const el = (col.el * Math.PI) / 180;
    const look = mesh.position.clone().addScaledVector(n, o.out * 0.3);
    const eye = look
      .clone()
      .addScaledVector(along, Math.cos(az) * Math.cos(el) * col.dist)
      .addScaledVector(side, Math.sin(az) * Math.cos(el) * col.dist)
      .addScaledVector(n, Math.sin(el) * col.dist);
    const cam = new THREE.PerspectiveCamera(35, CELL_W / CELL_H, 0.01, 20);
    cam.position.copy(eye);
    cam.up.copy(n.y > 0.3 ? new THREE.Vector3(0, 1, 0) : n);
    cam.lookAt(look);
    const x = ci * CELL_W;
    const y = (rows.length - 1 - ri) * CELL_H;
    renderer.setViewport(x, y, CELL_W, CELL_H);
    renderer.setScissor(x, y, CELL_W, CELL_H);
    renderer.setClearColor(0x9fb3c8);
    renderer.render(scene, cam);
    scene.remove(limb, mesh);
    label(x, ri * CELL_H, `${row.label} · ${col.name}`);
  });
});

(window as unknown as { __done: boolean }).__done = true;
