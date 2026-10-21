// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CARGO TRUCK'S CAB AS DRAWN — what the HELMET rung
// (`camera-armour.ts`) sees from the driver's seat of a truck he took from
// the army, laid out by `truck-cab-plan.ts` and painted by
// `truck-paint.ts`, built in code in the truck's frame on the cab bench
// (`cab-kit.ts`, `cab-parts.ts`):
//
//   * THE CAB'S INSIDE: the ribbed rubber floor, the walls in the hull's
//     olive round the door windows, the doors' seams, pull handles,
//     armrests, window cranks and pockets, the light headliner, the roof
//     hatch over the mate (its ring, lid, latches and handle), the back
//     wall with its small window onto the tilt and the spare wheel, a
//     rifle in its clips and a first-aid kit on it; the two-pane flat
//     windscreen in its frame and its centre post, the door windows in
//     their seals — clear from in here, the cab's shell from outside put
//     away while the eye is inside (`army-vehicle-view.ts`); the wipers
//     parked at the screen's foot, the sun visors, the grab handles on
//     the pillars, the dome lamp; the mirrors' glass out on their arms;
//   * THE DASHBOARD: its top and its demister slots, the crash pad, the
//     cluster under its hood in front of the wheel, the middle panel (the
//     tyre inflation, the differential locks and their levers, the
//     lights), the radio and its handset on the mate's side, the parking
//     brake's yellow knob, the eyeball vents;
//   * THE ENGINE'S COVER between the seats, the gearbox's selector in its
//     gate and the transfer box's lever;
//   * THE CONTROLS, MOVING with the truck's own (`ArmourRide`): the wheel
//     turned with the steering, the pedals pressed, the selector in D or R;
//   * THE SEATS on their air springs, the driver's and his mate's, and THE
//     DRIVER (`seated-figure.ts`), his hands on the rim, his feet on the
//     pedals;
//   * an extinguisher by the mate's door.
//
// Built with the world on a ride that carries the army (every program
// linked behind the loading card), hung in his truck as drawn and shown
// only while the lens is the driver's eye. Presentation only: it reads
// `GameState.armour` and writes nothing.

import * as THREE from "three";
import type { ArmourRide } from "@engine";

import { cabPose, handsOnWheel } from "./army-cab-plan.ts";
import { CabKit, mix, quad } from "./cab-kit.ts";
import {
  buildExtinguisher,
  buildPane,
  buildPedal,
  buildSeat,
  buildWheel,
  dashFace,
  faceQuad,
  wallAt,
} from "./cab-parts.ts";
import { paintRadio } from "./cab-paint.ts";
import type { CarrierCab } from "./carrier-cab.ts";
import type { HazeUniforms } from "./haze.ts";
import { createSeatedFigure } from "./seated-figure.ts";
import { mirrorGlass, TRUCK_CAB as C, truckGauges } from "./truck-cab-plan.ts";
import {
  LOCK_SWITCHES,
  paintTruckClusterBack,
  paintTruckClusterLive,
  paintTruckMiddle,
} from "./truck-paint.ts";

type V3 = { x: number; y: number; z: number };

/** How often the cluster's needles and the middle panel are painted
 * again, Hz. */
const PAINT_HZ = 12;
/** px a metre on the dash's faces. */
const PX = 1600;
/** His kit (`seated-figure.ts`): the carrier's driver's. */
const KIT = [0, 16, 25, 33, 1, 40, 45, 0];

/** The truck's cab has the carrier's hand: shown, moved, read, put away. */
export type TruckCab = CarrierCab;

export function createTruckCab(haze: HazeUniforms): TruckCab {
  const group = new THREE.Group();
  group.name = "truck_cab";
  group.visible = false;
  const kit = new CabKit(haze, "truck-cab");
  const ds = THREE.DoubleSide;
  const wall = kit.std({ color: 0x55603f, roughness: 0.8, side: ds });
  const liner = kit.std({ color: 0xa9ab9c, roughness: 0.95, side: ds });
  const floorMat = kit.std({ color: 0x1a1b1a, roughness: 0.92, side: ds });
  const dark = kit.std({ color: 0x1d1f1c, roughness: 0.8 });
  const black = kit.std({ color: 0x0e0f0f, roughness: 0.6 });
  const rubber = kit.std({ color: 0x0a0a0a, roughness: 0.85 });
  const steel = kit.std({ color: 0x8a8d88, roughness: 0.4, metalness: 0.7 });
  const vinyl = kit.std({ color: 0x2b2f27, roughness: 0.7 });
  const cloth = kit.std({ color: 0x353b2e, roughness: 0.97 });
  const red = kit.std({ color: 0xb21d17, roughness: 0.45 });
  const yellow = kit.std({ color: 0xe0b31c, roughness: 0.5 });
  const olive = kit.std({ color: 0x4a5236, roughness: 0.85 });
  const lamp = kit.std({
    color: 0xf2efe0,
    emissive: 0xfff2d0,
    emissiveIntensity: 0.15,
    roughness: 0.4,
  });
  const glass = kit.glass();

  const S = C.screen;
  const I = C.inner;
  const Wn = C.side;
  const screenZ = (y: number): number =>
    S.foot.z + ((y - S.foot.y) / (S.head.y - S.foot.y)) * (S.head.z - S.foot.z);
  const toe = C.dash.foot.z + 0.06;

  // ── THE SHELL ───────────────────────────────────────────────────────
  const mat = kit.canvas(64, 512);
  mat.ctx.fillStyle = "#1c1d1c";
  mat.ctx.fillRect(0, 0, 64, 512);
  for (let y = 0; y < 512; y += 16) {
    mat.ctx.fillStyle = "#2b2c2a";
    mat.ctx.fillRect(0, y, 64, 6);
  }
  mat.texture.wrapS = mat.texture.wrapT = THREE.RepeatWrapping;
  mat.texture.repeat.set(8, 4);
  floorMat.map = mat.texture;
  kit.mesh(
    quad(
      { x: I.half, y: I.floor, z: I.back },
      { x: -I.half, y: I.floor, z: I.back },
      { x: -I.half, y: I.floor, z: toe },
      { x: I.half, y: I.floor, z: toe },
    ),
    floorMat,
    group,
  );
  // The headliner.
  kit.mesh(
    quad(
      { x: I.half, y: I.roof, z: I.back },
      { x: -I.half, y: I.roof, z: I.back },
      { x: -I.half, y: I.roof, z: S.head.z },
      { x: I.half, y: I.roof, z: S.head.z },
    ),
    liner,
    group,
  );
  // THE ROOF HATCH over the mate: its ring, its lid, its latches, its handle.
  const H = C.hatch;
  const ring = kit.mesh(new THREE.TorusGeometry(H.r, 0.03, 8, 32), olive, group);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(H.x, I.roof - 0.03, H.z);
  const lid = kit.mesh(new THREE.CircleGeometry(H.r - 0.01, 28), olive, group);
  lid.rotation.x = Math.PI / 2;
  lid.position.set(H.x, I.roof + 0.03, H.z);
  for (const s of [-1, 1])
    kit.rod(
      { x: H.x + s * 0.2, y: I.roof - 0.04, z: H.z - 0.09 },
      { x: H.x + s * 0.2, y: I.roof - 0.04, z: H.z + 0.09 },
      0.013,
      steel,
      group,
    );
  kit.rod(
    { x: H.x - 0.1, y: I.roof - 0.08, z: H.z },
    { x: H.x + 0.1, y: I.roof - 0.08, z: H.z },
    0.012,
    black,
    group,
  );
  for (const s of [-1, 1])
    kit.rod(
      { x: H.x + s * 0.1, y: I.roof - 0.08, z: H.z },
      { x: H.x + s * 0.1, y: I.roof, z: H.z },
      0.01,
      black,
      group,
    );
  // The dome lamp.
  kit.box(0.18, 0.03, 0.09, { x: 0.15, y: I.roof - 0.015, z: I.back + 0.5 }, lamp, group, 0.01);

  // THE SIDE WALLS round each door window, its seal and pane.
  for (const s of [-1, 1]) {
    const x = s * I.half;
    const panel = (
      a: [number, number],
      b: [number, number],
      c: [number, number],
      d: [number, number],
    ) => wallAt(kit, group, x, wall, a, b, c, d);
    panel([I.back, I.floor], [S.foot.z, I.floor], [screenZ(Wn.lo), Wn.lo], [I.back, Wn.lo]);
    panel([I.back, Wn.hi], [screenZ(Wn.hi), Wn.hi], [S.head.z, I.roof], [I.back, I.roof]);
    panel([I.back, Wn.lo], [Wn.from, Wn.lo], [Wn.from, Wn.hi], [I.back, Wn.hi]);
    panel([Wn.to, Wn.lo], [screenZ(Wn.lo), Wn.lo], [screenZ(Wn.hi), Wn.hi], [Wn.to, Wn.hi]);
    const xi = x - s * 0.01;
    buildPane(
      kit,
      group,
      [
        { x: xi, y: Wn.lo, z: Wn.from },
        { x: xi, y: Wn.lo, z: Wn.to },
        { x: xi, y: Wn.hi, z: Wn.to },
        { x: xi, y: Wn.hi, z: Wn.from },
      ],
      { rubber, glass },
    );
    // THE DOOR: its seam, its pull handle and its armrest, the window's
    // crank, its pocket and the inner panel's ribs.
    const D = C.door;
    const seam: V3[] = [
      { x: xi, y: I.floor + 0.03, z: D.from },
      { x: xi, y: I.floor + 0.03, z: D.to },
      { x: xi, y: I.roof - 0.08, z: Math.min(D.to, screenZ(I.roof - 0.08) - 0.04) },
      { x: xi, y: I.roof - 0.08, z: D.from },
    ];
    for (let i = 0; i < 4; i++) kit.rod(seam[i], seam[(i + 1) % 4], 0.006, black, group, 4);
    kit.box(
      0.08,
      0.05,
      0.36,
      { x: x - s * 0.05, y: 2.15, z: (D.from + D.to) / 2 - 0.1 },
      vinyl,
      group,
      0.02,
    );
    kit.rod(
      { x: x - s * 0.05, y: 2.22, z: D.to - 0.42 },
      { x: x - s * 0.05, y: 2.22, z: D.to - 0.24 },
      0.012,
      steel,
      group,
    );
    const crank = { x: x - s * 0.03, y: 2.02, z: D.from + 0.42 };
    const boss = kit.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), black, group);
    boss.position.set(crank.x, crank.y, crank.z);
    boss.rotation.z = Math.PI / 2;
    kit.rod(crank, { x: crank.x, y: crank.y - 0.03, z: crank.z + 0.1 }, 0.008, steel, group, 6);
    kit.rod(
      { x: crank.x, y: crank.y - 0.03, z: crank.z + 0.1 },
      { x: crank.x - s * 0.05, y: crank.y - 0.03, z: crank.z + 0.1 },
      0.012,
      black,
      group,
      8,
    );
    kit.box(
      0.05,
      0.16,
      0.6,
      { x: x - s * 0.03, y: 1.7, z: (D.from + D.to) / 2 },
      dark,
      group,
      0.015,
    );
    for (const dy of [0, 0.06])
      kit.rod(
        { x: x - s * 0.01, y: 1.86 + dy, z: D.from + 0.08 },
        { x: x - s * 0.01, y: 1.86 + dy, z: D.to - 0.1 },
        0.006,
        wall,
        group,
        4,
      );
    // The grab handle on the pillar, to climb in by.
    kit.rod(
      { x: x - s * 0.05, y: 2.75, z: screenZ(2.75) - 0.08 },
      { x: x - s * 0.05, y: 2.3, z: screenZ(2.3) - 0.06 },
      0.015,
      black,
      group,
      8,
    );
  }
  // THE BACK WALL round its window onto the tilt; the window's pane.
  {
    const R = C.rear;
    const z = I.back;
    const back = (x0: number, x1: number, y0: number, y1: number) =>
      kit.mesh(
        quad({ x: x1, y: y0, z }, { x: x0, y: y0, z }, { x: x0, y: y1, z }, { x: x1, y: y1, z }),
        wall,
        group,
      );
    back(-I.half, I.half, I.floor, R.lo);
    back(-I.half, I.half, R.hi, I.roof);
    back(-I.half, R.x - R.half, R.lo, R.hi);
    back(R.x + R.half, I.half, R.lo, R.hi);
    buildPane(
      kit,
      group,
      [
        { x: R.x + R.half, y: R.lo, z: z + 0.01 },
        { x: R.x - R.half, y: R.lo, z: z + 0.01 },
        { x: R.x - R.half, y: R.hi, z: z + 0.01 },
        { x: R.x + R.half, y: R.hi, z: z + 0.01 },
      ],
      { rubber, glass },
      0.02,
    );
    // A carbine in its two clips over the mate's seat back, muzzle up.
    const rx = -0.62;
    const rz = z + 0.06;
    kit.box(0.05, 0.62, 0.05, { x: rx, y: 2.52, z: rz }, black, group, 0.01);
    kit.box(0.06, 0.2, 0.07, { x: rx, y: 2.12, z: rz }, black, group, 0.015);
    kit.box(0.04, 0.16, 0.06, { x: rx + 0.05, y: 2.36, z: rz + 0.02 }, black, group, 0.01);
    kit.rod({ x: rx, y: 2.83, z: rz }, { x: rx, y: 2.95, z: rz }, 0.008, black, group, 6);
    for (const y of [2.3, 2.7])
      kit.box(0.1, 0.03, 0.04, { x: rx, y, z: rz - 0.02 }, steel, group, 0.008);
    // The first-aid kit: a green case with a white cross.
    const fa = { x: 0.62, y: 2.62, z: z + 0.06 };
    kit.box(0.3, 0.2, 0.1, fa, kit.std({ color: 0x3e5a35, roughness: 0.8 }), group, 0.02);
    const white = kit.std({ color: 0xe8e8e0, roughness: 0.6 });
    kit.box(0.1, 0.03, 0.01, { x: fa.x, y: fa.y, z: fa.z + 0.051 }, white, group);
    kit.box(0.03, 0.1, 0.01, { x: fa.x, y: fa.y, z: fa.z + 0.051 }, white, group);
  }

  // THE WINDSCREEN: its frame, the centre post, the two panes; the wipers
  // parked on its foot outside; the visors.
  const sc = (x: number, top: boolean): V3 =>
    top ? { x, y: S.head.y, z: S.head.z } : { x, y: S.foot.y, z: S.foot.z };
  for (const top of [false, true])
    kit.rod(sc(S.half + 0.03, top), sc(-S.half - 0.03, top), C.frame, dark, group, 6);
  for (const x of [S.half + 0.02, 0, -S.half - 0.02])
    kit.rod(sc(x, false), sc(x, true), x === 0 ? S.post / 2 : C.frame, dark, group, 6);
  // The pillars down to the floor at the screen's sides, and the glass's
  // foot to the dash.
  for (const s of [-1, 1]) {
    const a = s * (S.post / 2);
    const b = s * S.half;
    buildPane(
      kit,
      group,
      [sc(b, false), sc(a, false), sc(a, true), sc(b, true)],
      { rubber: dark, glass },
      0.012,
    );
    const p = mix(sc(s * 0.5, false), sc(s * 0.5, true), 0.07);
    kit.rod(
      { x: p.x + s * 0.34, y: p.y, z: p.z + 0.04 },
      { x: p.x - s * 0.2, y: p.y + 0.03, z: p.z + 0.04 },
      0.008,
      black,
      group,
      5,
    );
    kit.box(
      0.42,
      0.016,
      0.2,
      { x: s * 0.5, y: I.roof - 0.025, z: S.head.z - 0.14 },
      vinyl,
      group,
      0.006,
    );
  }

  // ── THE DASHBOARD ──────────────────────────────────────────────────
  const D = C.dash;
  const face = dashFace({ y: D.top, z: D.back }, D.foot);
  const { on: onFace, len: faceLen, nrm } = face;
  const dashMat = kit.std({ color: 0x252723, roughness: 0.85 });
  kit.mesh(
    quad(onFace(D.half, 0), onFace(-D.half, 0), onFace(-D.half, faceLen), onFace(D.half, faceLen)),
    dashMat,
    group,
  );
  kit.mesh(
    quad(
      { x: D.half, y: D.top, z: D.back },
      { x: -D.half, y: D.top, z: D.back },
      { x: -D.half, y: S.foot.y, z: S.foot.z },
      { x: D.half, y: S.foot.y, z: S.foot.z },
    ),
    dashMat,
    group,
  );
  kit.rod(
    { x: D.half, y: D.top, z: D.back },
    { x: -D.half, y: D.top, z: D.back },
    0.035,
    vinyl,
    group,
    10,
  );
  // The demister's slots along the top, under the glass.
  for (const s of [-1, 1])
    for (let i = 0; i < 3; i++)
      kit.box(
        0.16,
        0.006,
        0.025,
        { x: s * (0.25 + i * 0.22), y: D.top + 0.012, z: (D.back + S.foot.z) / 2 },
        black,
        group,
      );
  // The knee panel and the toe board down to the floor.
  kit.mesh(
    quad(
      { x: D.half, y: I.floor, z: toe },
      { x: -D.half, y: I.floor, z: toe },
      onFace(-D.half, 0),
      onFace(D.half, 0),
    ),
    dashMat,
    group,
  );
  // The eyeball vents at the dash's ends.
  for (const s of [-1, 1]) {
    const v = onFace(s * (D.half - 0.09), faceLen * 0.55, 0.01);
    kit
      .mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 16), black, group)
      .position.set(v.x, v.y, v.z);
    kit.mesh(new THREE.SphereGeometry(0.03, 12, 8), dark, group).position.set(v.x, v.y, v.z);
  }

  // THE CLUSTER under its hood in front of the wheel.
  const K = C.cluster;
  const cluster = kit.canvas(Math.round(K.w * PX), Math.round(K.h * PX));
  const clusterBack = document.createElement("canvas");
  clusterBack.width = cluster.canvas.width;
  clusterBack.height = cluster.canvas.height;
  paintTruckClusterBack(clusterBack.getContext("2d")!);
  cluster.ctx.drawImage(clusterBack, 0, 0);
  faceQuad(kit, face, K.x, K.up, K.w, K.h, 0.012, kit.face(cluster.texture, 0.28), group);
  {
    const u1 = K.up + K.h / 2;
    const hoodA = onFace(K.x, u1 + 0.01, 0.0);
    const hood = kit.box(K.w + 0.06, 0.018, 0.13, hoodA, dashMat, group, 0.008);
    hood.rotation.x = 0.1;
    hood.position.set(hoodA.x, hoodA.y + nrm.y * 0.06, hoodA.z + nrm.z * 0.06);
    for (const s of [-1, 1]) {
      const c = onFace(K.x + s * (K.w / 2 + 0.025), K.up, 0.05);
      kit.box(0.018, K.h + 0.02, 0.1, c, dashMat, group, 0.006).rotation.x = face.tilt;
    }
  }
  // THE MIDDLE PANEL and the locks' levers.
  const M = C.middle;
  const middle = kit.canvas(Math.round(M.w * PX), Math.round(M.h * PX));
  paintTruckMiddle(middle.ctx, null);
  faceQuad(kit, face, M.x, M.up, M.w, M.h, 0.006, kit.face(middle.texture, 0.22), group);
  for (const t of LOCK_SWITCHES) {
    const x = M.x + M.w / 2 - t.x * M.w;
    const u = M.up + M.h / 2 - t.y * M.h;
    kit.rod(onFace(x, u, 0.006), onFace(x, u + 0.012, 0.03), 0.0035, steel, group, 6);
  }
  // THE RADIO, its handset on its hook.
  const R = C.radio;
  const radio = kit.canvas(Math.round(R.w * PX), Math.round(R.h * PX));
  paintRadio(radio.ctx, true);
  {
    const c = onFace(R.x, R.up, 0.02);
    const body = kit.box(
      R.w + 0.02,
      R.h + 0.02,
      R.depth,
      c,
      kit.std({ color: 0x2f3429, roughness: 0.8 }),
      group,
      0.01,
    );
    body.rotation.x = face.tilt;
    body.position.set(c.x, c.y - nrm.y * (R.depth / 2 - 0.02), c.z - nrm.z * (R.depth / 2 - 0.02));
    faceQuad(kit, face, R.x, R.up, R.w, R.h, 0.043, kit.face(radio.texture, 0.35), group);
    const hook = onFace(R.x + R.w / 2 + 0.08, R.up, 0.03);
    kit.box(0.05, 0.18, 0.05, hook, black, group, 0.02).rotation.x = face.tilt;
    kit.rod(hook, { x: hook.x - 0.05, y: hook.y - 0.25, z: hook.z - 0.05 }, 0.006, black, group, 5);
  }
  // THE PARKING BRAKE: the yellow push-pull knob of the air brakes.
  {
    const p = onFace(C.park.x, C.park.up, 0.0);
    const tip = onFace(C.park.x, C.park.up, 0.04);
    kit.rod(p, tip, 0.008, steel, group, 6);
    const knob = kit.box(0.05, 0.05, 0.035, tip, yellow, group, 0.01);
    knob.rotation.x = face.tilt;
    knob.rotation.z = Math.PI / 4;
  }

  // ── THE ENGINE'S COVER, THE SELECTOR, THE TRANSFER BOX ─────────────
  const Hm = C.hump;
  kit.box(
    Hm.half * 2,
    Hm.top - I.floor,
    Hm.to - Hm.from,
    { x: 0, y: (Hm.top + I.floor) / 2, z: (Hm.from + Hm.to) / 2 },
    vinyl,
    group,
    0.08,
  );
  const G = C.selector;
  const gate = kit.canvas(64, 192);
  gate.ctx.fillStyle = "#121312";
  gate.ctx.fillRect(0, 0, 64, 192);
  gate.ctx.fillStyle = "#d9dcd2";
  gate.ctx.font = "bold 22px sans-serif";
  gate.ctx.textAlign = "center";
  ["R", "N", "D", "4", "3", "2"].forEach((w, i) => gate.ctx.fillText(w, 46, 24 + i * 30));
  gate.ctx.fillStyle = "#000";
  gate.ctx.fillRect(14, 12, 8, 170);
  kit.mesh(
    quad(
      { x: G.x + 0.035, y: Hm.top + 0.004, z: G.z - 0.1 },
      { x: G.x - 0.035, y: Hm.top + 0.004, z: G.z - 0.1 },
      { x: G.x - 0.035, y: Hm.top + 0.004, z: G.z + 0.1 },
      { x: G.x + 0.035, y: Hm.top + 0.004, z: G.z + 0.1 },
    ),
    kit.face(gate.texture, 0.15),
    group,
  );
  const lever = new THREE.Group();
  lever.position.set(G.x + 0.015, Hm.top, G.z);
  group.add(lever);
  kit.rod({ x: 0, y: 0, z: 0 }, { x: 0, y: G.lever, z: 0 }, 0.008, steel, lever, 8);
  const knob = kit.mesh(new THREE.SphereGeometry(0.028, 14, 10), black, lever);
  knob.position.y = G.lever;
  knob.scale.set(1, 1.25, 1);
  // The transfer box's lever, its boot and its plate (H N L).
  const T = C.transfer;
  kit
    .mesh(new THREE.ConeGeometry(0.05, 0.06, 12), rubber, group)
    .position.set(T.x, Hm.top + 0.03, T.z);
  kit.rod(
    { x: T.x, y: Hm.top, z: T.z },
    { x: T.x, y: Hm.top + T.lever, z: T.z - 0.05 },
    0.009,
    steel,
    group,
    8,
  );
  kit.box(
    0.04,
    0.06,
    0.04,
    { x: T.x, y: Hm.top + T.lever + 0.02, z: T.z - 0.055 },
    red,
    group,
    0.015,
  );
  const hl = kit.canvas(96, 48);
  hl.ctx.fillStyle = "#121312";
  hl.ctx.fillRect(0, 0, 96, 48);
  hl.ctx.fillStyle = "#d9dcd2";
  hl.ctx.font = "bold 24px sans-serif";
  hl.ctx.textAlign = "center";
  hl.ctx.fillText("H  N  L", 48, 32);
  kit.mesh(
    quad(
      { x: T.x + 0.045, y: Hm.top + 0.004, z: T.z + 0.05 },
      { x: T.x - 0.045, y: Hm.top + 0.004, z: T.z + 0.05 },
      { x: T.x - 0.045, y: Hm.top + 0.004, z: T.z + 0.1 },
      { x: T.x + 0.045, y: Hm.top + 0.004, z: T.z + 0.1 },
    ),
    kit.face(hl.texture, 0.15),
    group,
  );

  // ── THE STEERING WHEEL ON ITS COLUMN ───────────────────────────────
  const turn = buildWheel(
    kit,
    group,
    C.wheel,
    { x: C.wheel.x, y: C.column.y, z: C.column.z },
    { black, dark, rubber },
    [0.3, Math.PI - 0.3, Math.PI / 2],
  );

  // ── THE PEDALS ─────────────────────────────────────────────────────
  const P = C.pedals;
  const pedal = (x: number, w: number, h: number): THREE.Group =>
    buildPedal(kit, group, { x, y: P.y + 0.16, z: P.z + 0.04 }, w, h, { steel, rubber });
  const gas = pedal(P.gas, 0.07, 0.17);
  const brake = pedal(P.brake, 0.13, 0.09);

  // ── THE SEATS on their air springs ─────────────────────────────────
  const St = C.seat;
  for (const x of [St.x, C.mate]) {
    buildSeat(kit, group, x, St, I.floor, { frame: dark, cloth, steel });
    // The spring's bellows and the seat's ride lever.
    kit
      .mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 14), rubber, group)
      .position.set(x, I.floor + 0.2, St.z);
    kit.rod(
      { x: x + 0.24, y: St.top - 0.12, z: St.z + 0.1 },
      { x: x + 0.28, y: St.top - 0.1, z: St.z + 0.2 },
      0.007,
      black,
      group,
      5,
    );
  }

  // ── THE REST ───────────────────────────────────────────────────────
  buildExtinguisher(
    kit,
    group,
    { x: -I.half + 0.1, y: I.floor + 0.22, z: C.door.from + 0.15 },
    { red, black, steel },
  );
  // THE MIRRORS' GLASS out on their arms, turned back at him. Nothing is
  // rendered into them: each is painted once with what a mirror set so
  // shows, the sky over the snow behind and the truck's own flank down its
  // inner edge (the corners' `u` runs inward on his side, outward on the
  // mate's).
  for (const s of [-1, 1] as const) {
    const { n, corners } = mirrorGlass(s);
    const [a, b, c, d] = corners.map((p) => ({
      x: p.x + n.x * 0.004,
      y: p.y,
      z: p.z + n.z * 0.004,
    }));
    const seen = kit.canvas(64, 128);
    paintMirror(seen.ctx, s > 0);
    const glassMat = kit.std({
      map: seen.texture,
      emissiveMap: seen.texture,
      emissive: 0xffffff,
      emissiveIntensity: 0.55,
      roughness: 0.15,
      metalness: 0.1,
    });
    kit.mesh(quad(a!, b!, c!, d!), glassMat, group).castShadow = false;
  }

  // ── THE DRIVER ────────────────────────────────────────────────────
  const Dr = C.driver;
  const driver = createSeatedFigure(
    haze,
    {
      x: St.x,
      left: 1,
      eye: C.eye,
      shoulder: Dr.shoulder,
      hip: Dr.hip,
      upperArm: Dr.upperArm,
      forearm: Dr.forearm,
      thigh: Dr.thigh,
      shin: Dr.shin,
    },
    KIT,
    "truck_driver",
  );
  group.add(driver.group);
  const rest: V3 = { x: St.x + 0.22, y: I.floor + 0.03, z: P.z - 0.06 };
  const hands0 = handsOnWheel(0, C.wheel);
  driver.pose(hands0.left, hands0.right, [rest, { x: P.gas, y: P.y, z: P.z }], false);

  let since = Infinity;
  return {
    group,
    update(r: ArmourRide, t, dt, shown, own) {
      group.visible = shown;
      if (!shown) {
        since = Infinity;
        return;
      }
      const b = r.body;
      const pose = cabPose(r, b.speed, C.wheel.lock);
      turn.rotation.y = -pose.wheel;
      gas.rotation.x = pose.gas * 0.3;
      brake.rotation.x = pose.brake * 0.35;
      lever.rotation.x = pose.reverse ? 0.3 : -0.18;
      const hands = handsOnWheel(pose.wheel, C.wheel);
      const foot: V3 =
        pose.brake > 0.05
          ? { x: P.brake, y: P.y - pose.brake * P.travel * 0.5, z: P.z - pose.brake * P.travel }
          : { x: P.gas, y: P.y - pose.gas * P.travel * 0.5, z: P.z - pose.gas * P.travel };
      driver.pose(hands.left, hands.right, [rest, foot], own);
      since += dt;
      if (since >= 1 / PAINT_HZ) {
        since = 0;
        const g = truckGauges(b.speed, r.drive, t, r.dead);
        paintTruckClusterLive(cluster.ctx, clusterBack, g);
        cluster.texture.needsUpdate = true;
        paintTruckMiddle(middle.ctx, g);
        middle.texture.needsUpdate = true;
      }
    },
    dispose() {
      driver.dispose();
      kit.dispose();
    },
  };
}

/** What a mirror shows him: the sky's gradient over the snow behind, a
 * shadowed band where they meet, and the truck's olive flank and its
 * wheels down the edge nearest the cab (`inner` the right-hand edge). */
function paintMirror(c: CanvasRenderingContext2D, inner: boolean): void {
  const { width: w, height: h } = c.canvas;
  const sky = c.createLinearGradient(0, 0, 0, h * 0.5);
  sky.addColorStop(0, "#7fa4c8");
  sky.addColorStop(1, "#c9d8e4");
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h * 0.5);
  c.fillStyle = "#8f9ea8";
  c.fillRect(0, h * 0.46, w, h * 0.05);
  const snow = c.createLinearGradient(0, h * 0.5, 0, h);
  snow.addColorStop(0, "#dfe6ec");
  snow.addColorStop(1, "#f4f6f8");
  c.fillStyle = snow;
  c.fillRect(0, h * 0.5, w, h * 0.5);
  // The tracks behind, running to the horizon.
  c.strokeStyle = "#b5c4d2";
  c.lineWidth = 3;
  for (const k of [0.3, 0.55]) {
    c.beginPath();
    c.moveTo(w * 0.5, h * 0.5);
    c.lineTo(w * k * (inner ? 0.6 : 1.4), h);
    c.stroke();
  }
  // The flank, wide at the glass's foot and narrowing up the far body.
  const x0 = inner ? w : 0;
  const x1 = inner ? w * 0.62 : w * 0.38;
  const x2 = inner ? w * 0.86 : w * 0.14;
  c.fillStyle = "#4a5236";
  c.beginPath();
  c.moveTo(x0, h * 0.42);
  c.lineTo(x2, h * 0.47);
  c.lineTo(x1, h);
  c.lineTo(x0, h);
  c.closePath();
  c.fill();
  c.fillStyle = "#151616";
  for (const [y, r] of [
    [0.62, 0.05],
    [0.76, 0.07],
  ] as const) {
    c.beginPath();
    c.arc(
      inner ? w * 0.88 - (y - 0.5) * w * 0.6 : w * 0.12 + (y - 0.5) * w * 0.6,
      h * (y + 0.06),
      h * r,
      0,
      Math.PI * 2,
    );
    c.fill();
  }
  // The glass's sheen.
  c.fillStyle = "rgba(255,255,255,0.12)";
  c.beginPath();
  c.moveTo(0, h * 0.1);
  c.lineTo(w, 0);
  c.lineTo(w, h * 0.12);
  c.lineTo(0, h * 0.3);
  c.fill();
}
