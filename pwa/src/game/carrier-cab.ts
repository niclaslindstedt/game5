// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TRACKED CARRIER'S CAB AS DRAWN — what the HELMET rung
// (`camera-armour.ts`) sees from the driver's seat of a carrier he took
// from the army, laid out by `army-cab-plan.ts` and painted by
// `cab-paint.ts`, built in code in the front unit's frame:
//
//   * THE CAB'S INSIDE: the ribbed rubber floor, the walls in the hull's
//     grey-green round the side windows and the driver's door (its seam,
//     its handle, its pocket), the light headliner and the roof hatch's
//     ring and latches, the wall behind the passengers' bench; the
//     windscreen's two flat panes in their frame and the centre post, the
//     side windows' panes in their seals — clear from in here, the hull's
//     dark glass put away while the eye is inside (`army-vehicle-view.ts`);
//     the wipers parked at the screen's foot, the sun visors, the mirror;
//   * THE DASHBOARD: its top and crash pad, the cluster under its hood in
//     front of the wheel, the switch panel and its toggles in the middle,
//     the radio set on the mate's side, the eyeball vents, the heater and
//     the knee panel under it;
//   * THE ENGINE'S PADDED COVER between the front seats, the gearbox's
//     selector and its gate, the parking brake's lever;
//   * THE CONTROLS, MOVING with the vehicle's own (`ArmourRide`): the wheel
//     turned with the steering, the pedals pressed, the selector in D or R;
//   * THE SEATS, the driver's and his mate's, and THE DRIVER in his ski
//     jacket, his hands on the rim and his feet on the pedals
//     (`seated-figure.ts`);
//   * a fire extinguisher by the mate's door, a grab handle, a dome light.
//
// Built with the world on a ride that carries the army (every program
// linked behind the loading card), hung in his carrier as drawn and shown
// only while the lens is the driver's eye. Presentation only: it reads
// `GameState.armour` and writes nothing.

import * as THREE from "three";
import { ARMOUR, type ArmourRide } from "@engine";

import {
  CARRIER_CAB as C,
  cabGauges,
  cabPose,
  handsOnWheel,
  wheelFrame,
} from "./army-cab-plan.ts";
import { CabKit, mix, quad } from "./cab-kit.ts";
import {
  clusterSize,
  paintClusterBack,
  paintClusterLive,
  paintRadio,
  paintSwitches,
  TOGGLES,
} from "./cab-paint.ts";
import type { HazeUniforms } from "./haze.ts";
import { createSeatedFigure } from "./seated-figure.ts";

type V3 = { x: number; y: number; z: number };

/** How often the cluster's needles are painted again, Hz. */
const PAINT_HZ = 12;
/** His kit, as eight indices into the people's palette: the red shell he
 * skis in, black trousers, a black helmet, the skis' slot unused, a blue
 * accent, the skin, brown hair, the shell again. */
const KIT = [0, 16, 25, 33, 1, 40, 45, 0];

export type CarrierCab = {
  group: THREE.Group;
  /** One frame: shown or not (the lens the driver's eye), the controls
   * moved, the cluster read; `own` the lens is his own (his head drawn
   * in). */
  update(r: ArmourRide, t: number, dt: number, shown: boolean, own: boolean): void;
  dispose(): void;
};

export function createCarrierCab(haze: HazeUniforms): CarrierCab {
  const group = new THREE.Group();
  group.name = "carrier_cab";
  group.visible = false;
  const kit = new CabKit(haze, "cab");
  const ds = THREE.DoubleSide;
  const wall = kit.std({ color: 0x5d6553, roughness: 0.82, side: ds });
  const liner = kit.std({ color: 0xb3b5aa, roughness: 0.95, side: ds });
  const floorMat = kit.std({ color: 0x1a1b1a, roughness: 0.92, side: ds });
  const dark = kit.std({ color: 0x1d1f1c, roughness: 0.8 });
  const black = kit.std({ color: 0x0e0f0f, roughness: 0.6 });
  const rubber = kit.std({ color: 0x0a0a0a, roughness: 0.85 });
  const steel = kit.std({ color: 0x8a8d88, roughness: 0.4, metalness: 0.7 });
  const vinyl = kit.std({ color: 0x2c3028, roughness: 0.7 });
  const canvasSeat = kit.std({ color: 0x3f4536, roughness: 0.97 });
  const red = kit.std({ color: 0xb21d17, roughness: 0.45 });
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
  /** The windscreen's plane at height `y`: its z there. */
  const screenZ = (y: number): number =>
    S.foot.z + ((y - S.foot.y) / (S.head.y - S.foot.y)) * (S.head.z - S.foot.z);

  // ── THE SHELL ───────────────────────────────────────────────────────
  // The floor's ribbed mat, painted with its ribs on a canvas.
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
      { x: -I.half, y: I.floor, z: 0.32 },
      { x: I.half, y: I.floor, z: 0.32 },
    ),
    floorMat,
    group,
  );
  // The headliner, and the roof hatch's ring, its lid and its latches.
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
  const hatch = { x: 0, z: -0.6 };
  const ring = kit.mesh(new THREE.TorusGeometry(0.34, 0.025, 8, 32), dark, group);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(hatch.x, I.roof - 0.02, hatch.z);
  kit.mesh(new THREE.CircleGeometry(0.33, 28), dark, group).position.set(
    hatch.x,
    I.roof + 0.04,
    hatch.z,
  );
  (group.children[group.children.length - 1] as THREE.Mesh).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) {
    kit.rod(
      { x: hatch.x + s * 0.22, y: I.roof - 0.03, z: hatch.z - 0.08 },
      { x: hatch.x + s * 0.22, y: I.roof - 0.03, z: hatch.z + 0.08 },
      0.012,
      steel,
      group,
    );
  }
  // The dome light.
  kit.box(0.16, 0.03, 0.08, { x: 0, y: I.roof - 0.015, z: -0.12 }, lamp, group, 0.01);

  // THE SIDE WALLS round each window, the window's seal and pane.
  for (const s of [-1, 1]) {
    const x = s * I.half;
    const panel = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) =>
      kit.mesh(
        quad({ x, y: a[1], z: a[0] }, { x, y: b[1], z: b[0] }, { x, y: c[1], z: c[0] }, { x, y: d[1], z: d[0] }),
        wall,
        group,
      );
    // Under the window, over it, behind it and before it to the screen.
    panel([I.back, I.floor], [screenZ(Wn.lo) + 0.02, I.floor], [screenZ(Wn.lo), Wn.lo], [I.back, Wn.lo]);
    panel([I.back, Wn.hi], [screenZ(Wn.hi), Wn.hi], [S.head.z, I.roof], [I.back, I.roof]);
    panel([I.back, Wn.lo], [Wn.from, Wn.lo], [Wn.from, Wn.hi], [I.back, Wn.hi]);
    panel([Wn.to, Wn.lo], [screenZ(Wn.lo), Wn.lo], [screenZ(Wn.hi), Wn.hi], [Wn.to, Wn.hi]);
    // The seal round the window and its pane.
    const xi = x - s * 0.01;
    const corners: V3[] = [
      { x: xi, y: Wn.lo, z: Wn.from },
      { x: xi, y: Wn.lo, z: Wn.to },
      { x: xi, y: Wn.hi, z: Wn.to },
      { x: xi, y: Wn.hi, z: Wn.from },
    ];
    for (let i = 0; i < 4; i++) kit.rod(corners[i], corners[(i + 1) % 4], 0.018, rubber, group, 6);
    const pane = kit.mesh(
      quad(corners[0], corners[1], corners[2], corners[3]),
      glass,
      group,
    );
    pane.renderOrder = 4;
    pane.castShadow = false;
    // The door's seam round it, on the driver's side; its handle and
    // pocket.
    if (s === ARMOUR.cabs.carrier.door.side) {
      const d0 = -1.02;
      const d1 = 0.08;
      const seam: V3[] = [
        { x: xi, y: I.floor + 0.04, z: d0 },
        { x: xi, y: I.floor + 0.04, z: d1 },
        { x: xi, y: I.roof - 0.1, z: Math.min(d1, screenZ(I.roof - 0.1) - 0.05) },
        { x: xi, y: I.roof - 0.1, z: d0 },
      ];
      for (let i = 0; i < 4; i++) kit.rod(seam[i], seam[(i + 1) % 4], 0.006, black, group, 4);
      kit.box(0.04, 0.03, 0.14, { x: x - s * 0.03, y: 1.5, z: -0.2 }, steel, group, 0.008);
      kit.box(0.05, 0.12, 0.5, { x: x - s * 0.03, y: 1.22, z: -0.45 }, dark, group, 0.015);
      kit.box(0.07, 0.04, 0.32, { x: x - s * 0.04, y: 1.42, z: -0.55 }, vinyl, group, 0.015);
    }
  }
  // The wall behind the passengers' bench, and the bench.
  kit.mesh(
    quad(
      { x: -I.half, y: I.floor, z: I.back },
      { x: I.half, y: I.floor, z: I.back },
      { x: I.half, y: I.roof, z: I.back },
      { x: -I.half, y: I.roof, z: I.back },
    ),
    wall,
    group,
  );
  kit.box(I.half * 2 - 0.1, 0.1, 0.42, { x: 0, y: 1.36, z: I.back + 0.26 }, canvasSeat, group, 0.03);
  kit.box(I.half * 2 - 0.1, 0.48, 0.08, { x: 0, y: 1.68, z: I.back + 0.06 }, canvasSeat, group, 0.03);

  // THE WINDSCREEN: its frame, the centre post that splits it, the two
  // panes; the wipers parked on its foot outside; the visors, the mirror.
  const sc = (x: number, top: boolean): V3 =>
    top ? { x, y: S.head.y, z: S.head.z } : { x, y: S.foot.y, z: S.foot.z };
  const fr = C.frame;
  for (const top of [false, true]) kit.rod(sc(S.half + 0.03, top), sc(-S.half - 0.03, top), fr, dark, group, 6);
  for (const x of [S.half + 0.02, 0, -S.half - 0.02])
    kit.rod(sc(x, false), sc(x, true), x === 0 ? S.post / 2 : fr, dark, group, 6);
  for (const s of [-1, 1]) {
    const a = s * (S.post / 2);
    const b = s * S.half;
    const pane = kit.mesh(quad(sc(b, false), sc(a, false), sc(a, true), sc(b, true)), glass, group);
    pane.renderOrder = 4;
    pane.castShadow = false;
    // A wiper on the glass's outside, parked across its foot.
    const p = mix(sc(s * 0.38, false), sc(s * 0.38, true), 0.08);
    kit.rod(
      { x: p.x + s * 0.28, y: p.y, z: p.z + 0.03 },
      { x: p.x - s * 0.18, y: p.y + 0.02, z: p.z + 0.03 },
      0.007,
      black,
      group,
      5,
    );
    // The visor folded up against the headliner.
    kit.box(0.36, 0.014, 0.17, { x: s * 0.4, y: I.roof - 0.02, z: S.head.z - 0.12 }, vinyl, group, 0.006);
  }
  kit.rod({ x: 0, y: I.roof, z: S.head.z - 0.04 }, { x: 0, y: S.head.y - 0.08, z: S.head.z - 0.07 }, 0.008, black, group);
  kit.box(0.22, 0.06, 0.02, { x: 0, y: S.head.y - 0.11, z: S.head.z - 0.08 }, black, group, 0.01);

  // ── THE DASHBOARD ──────────────────────────────────────────────────
  const D = C.dash;
  const top = { y: D.top, z: D.back };
  const foot = D.foot;
  const faceLen = Math.hypot(top.y - foot.y, top.z - foot.z);
  const up = { y: (top.y - foot.y) / faceLen, z: (top.z - foot.z) / faceLen };
  // The face's normal, toward the driver.
  const nrm = { y: up.z, z: -up.y };
  /** A point on the dash's face: `x` across, `u` up it from its foot,
   * `o` out of it toward the driver. */
  const onFace = (x: number, u: number, o = 0): V3 => ({
    x,
    y: foot.y + up.y * u + nrm.y * o,
    z: foot.z + up.z * u + nrm.z * o,
  });
  const dashMat = kit.std({ color: 0x232521, roughness: 0.85 });
  kit.mesh(
    quad(onFace(D.half, 0), onFace(-D.half, 0), onFace(-D.half, faceLen), onFace(D.half, faceLen)),
    dashMat,
    group,
  );
  // The top, back to the screen's foot, and the crash pad's lip.
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
  kit.rod({ x: D.half, y: D.top, z: D.back }, { x: -D.half, y: D.top, z: D.back }, 0.03, vinyl, group, 10);
  // The knee panel down to the floor, and the toe board.
  kit.mesh(
    quad(
      { x: D.half, y: I.floor, z: 0.32 },
      { x: -D.half, y: I.floor, z: 0.32 },
      onFace(-D.half, 0),
      onFace(D.half, 0),
    ),
    dashMat,
    group,
  );
  // The eyeball vents at the dash's ends.
  for (const s of [-1, 1]) {
    const v = onFace(s * (D.half - 0.08), faceLen * 0.6, 0.01);
    kit.mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 16), black, group).position.set(v.x, v.y, v.z);
    const ball = kit.mesh(new THREE.SphereGeometry(0.03, 12, 8), dark, group);
    ball.position.set(v.x, v.y, v.z);
  }

  // THE CLUSTER under its hood in front of the wheel.
  const K = C.cluster;
  const [cw, ch] = clusterSize(K.w, K.h);
  const cluster = kit.canvas(cw, ch);
  const clusterBack = document.createElement("canvas");
  clusterBack.width = cw;
  clusterBack.height = ch;
  paintClusterBack(clusterBack.getContext("2d")!);
  cluster.ctx.drawImage(clusterBack, 0, 0);
  {
    const u0 = K.up - K.h / 2;
    const u1 = K.up + K.h / 2;
    kit.mesh(
      quad(
        onFace(K.x + K.w / 2, u0, 0.012),
        onFace(K.x - K.w / 2, u0, 0.012),
        onFace(K.x - K.w / 2, u1, 0.012),
        onFace(K.x + K.w / 2, u1, 0.012),
      ),
      kit.face(cluster.texture, 0.28),
      group,
    );
    // The hood: a shade over the dials and its two cheeks.
    const hoodA = onFace(K.x, u1 + 0.01, 0.0);
    const hood = kit.box(K.w + 0.06, 0.018, 0.13, hoodA, dashMat, group, 0.008);
    hood.rotation.x = 0.1;
    hood.position.set(hoodA.x, hoodA.y + nrm.y * 0.06, hoodA.z + nrm.z * 0.06);
    for (const s of [-1, 1]) {
      const c = onFace(K.x + s * (K.w / 2 + 0.025), K.up, 0.05);
      const cheek = kit.box(0.018, K.h + 0.02, 0.1, c, dashMat, group, 0.006);
      cheek.rotation.x = Math.atan2(up.z, up.y);
    }
  }
  // THE SWITCH PANEL and its toggles' levers.
  const W2 = C.switches;
  const sw = kit.canvas(Math.round(W2.w * 1600), Math.round(W2.h * 1600));
  paintSwitches(sw.ctx);
  kit.mesh(
    quad(
      onFace(W2.x + W2.w / 2, W2.up - W2.h / 2, 0.006),
      onFace(W2.x - W2.w / 2, W2.up - W2.h / 2, 0.006),
      onFace(W2.x - W2.w / 2, W2.up + W2.h / 2, 0.006),
      onFace(W2.x + W2.w / 2, W2.up + W2.h / 2, 0.006),
    ),
    kit.face(sw.texture, 0.2),
    group,
  );
  for (const t of TOGGLES) {
    // The canvas's x runs from the panel's left as seen (+x) to its right.
    const x = W2.x + W2.w / 2 - t.x * W2.w;
    const u = W2.up + W2.h / 2 - t.y * W2.h;
    const base = onFace(x, u, 0.006);
    const tip = onFace(x, u + 0.012, 0.03);
    kit.rod(base, tip, 0.0035, steel, group, 6);
  }
  // THE RADIO, its face on the dash and its body back into it; the
  // handset on its hook beside it.
  const R = C.radio;
  const radio = kit.canvas(Math.round(R.w * 1600), Math.round(R.h * 1600));
  paintRadio(radio.ctx, true);
  {
    const c = onFace(R.x, R.up, 0.02);
    const body = kit.box(R.w + 0.02, R.h + 0.02, R.depth, c, kit.std({ color: 0x2f3429, roughness: 0.8 }), group, 0.01);
    body.rotation.x = Math.atan2(up.z, up.y);
    body.position.set(c.x, c.y - nrm.y * (R.depth / 2 - 0.02), c.z - nrm.z * (R.depth / 2 - 0.02));
    kit.mesh(
      quad(
        onFace(R.x + R.w / 2, R.up - R.h / 2, 0.031),
        onFace(R.x - R.w / 2, R.up - R.h / 2, 0.031),
        onFace(R.x - R.w / 2, R.up + R.h / 2, 0.031),
        onFace(R.x + R.w / 2, R.up + R.h / 2, 0.031),
      ),
      kit.face(radio.texture, 0.35),
      group,
    );
    const hook = onFace(R.x - R.w / 2 - 0.08, R.up, 0.03);
    kit.box(0.05, 0.18, 0.05, hook, black, group, 0.02).rotation.x = Math.atan2(up.z, up.y);
  }
  // The heater under the mate's side, its louvres.
  kit.box(0.32, 0.16, 0.16, { x: -0.42, y: 1.1, z: 0.14 }, dark, group, 0.015);
  for (let i = 0; i < 4; i++)
    kit.rod({ x: -0.56, y: 1.06 + i * 0.03, z: 0.055 }, { x: -0.28, y: 1.06 + i * 0.03, z: 0.055 }, 0.005, black, group, 4);

  // ── THE ENGINE'S COVER, THE SELECTOR, THE PARKING BRAKE ────────────
  const H = C.hump;
  kit.box(
    H.half * 2,
    H.top - I.floor,
    H.to - H.from,
    { x: 0, y: (H.top + I.floor) / 2, z: (H.from + H.to) / 2 },
    vinyl,
    group,
    0.06,
  );
  const G = C.selector;
  const gate = kit.canvas(64, 192);
  gate.ctx.fillStyle = "#121312";
  gate.ctx.fillRect(0, 0, 64, 192);
  gate.ctx.fillStyle = "#d9dcd2";
  gate.ctx.font = "bold 22px sans-serif";
  gate.ctx.textAlign = "center";
  ["P", "R", "N", "D", "3", "2"].forEach((w, i) => gate.ctx.fillText(w, 46, 24 + i * 30));
  gate.ctx.fillStyle = "#000";
  gate.ctx.fillRect(14, 12, 8, 170);
  const plate = kit.mesh(
    quad(
      { x: G.x + 0.035, y: H.top + 0.004, z: G.z - 0.1 },
      { x: G.x - 0.035, y: H.top + 0.004, z: G.z - 0.1 },
      { x: G.x - 0.035, y: H.top + 0.004, z: G.z + 0.1 },
      { x: G.x + 0.035, y: H.top + 0.004, z: G.z + 0.1 },
    ),
    kit.face(gate.texture, 0.15),
    group,
  );
  plate.receiveShadow = true;
  const lever = new THREE.Group();
  lever.position.set(G.x + 0.015, H.top, G.z);
  group.add(lever);
  kit.rod({ x: 0, y: 0, z: 0 }, { x: 0, y: G.lever, z: 0 }, 0.008, steel, lever, 8);
  const knob = kit.mesh(new THREE.SphereGeometry(0.028, 14, 10), black, lever);
  knob.position.y = G.lever;
  knob.scale.set(1, 1.25, 1);
  // The parking brake's lever on the cover's driver's side.
  kit.rod({ x: H.half + 0.03, y: 1.2, z: -0.55 }, { x: H.half + 0.03, y: 1.38, z: -0.35 }, 0.012, steel, group);
  kit.box(0.03, 0.035, 0.12, { x: H.half + 0.03, y: 1.39, z: -0.33 }, rubber, group, 0.012).rotation.x = -0.6;

  // ── THE STEERING WHEEL ON ITS COLUMN ───────────────────────────────
  const WF = wheelFrame();
  const Wh = C.wheel;
  kit.rod({ x: Wh.x, y: C.column.y, z: C.column.z }, WF.hub, 0.03, black, group, 12);
  // The column's shroud and the indicator's stalk.
  kit.rod({ x: Wh.x, y: C.column.y, z: C.column.z }, mix({ x: Wh.x, y: C.column.y, z: C.column.z }, WF.hub, 0.55), 0.05, dark, group, 12);
  const stalkAt = mix({ x: Wh.x, y: C.column.y, z: C.column.z }, WF.hub, 0.6);
  kit.rod(stalkAt, { x: stalkAt.x + 0.16, y: stalkAt.y + 0.01, z: stalkAt.z - 0.02 }, 0.007, black, group, 6);
  const wheel = new THREE.Group();
  wheel.position.set(WF.hub.x, WF.hub.y, WF.hub.z);
  // The wheel's own frame: its face's normal (toward the driver) on its
  // local +y — so it turns about y.
  wheel.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(WF.axis.x, WF.axis.y, WF.axis.z).normalize(),
  );
  const turn = new THREE.Group();
  wheel.add(turn);
  group.add(wheel);
  const rim = kit.mesh(new THREE.TorusGeometry(Wh.r, Wh.grip, 10, 48), rubber, turn);
  rim.rotation.x = Math.PI / 2;
  // Three spokes, to either side and the broad one down (the wheel's
  // local −z is the rim's foot), and the horn's pad.
  for (const a of [0, Math.PI, Math.PI / 2]) {
    const sp = kit.box(Wh.r - 0.04, 0.012, a === Math.PI / 2 ? 0.06 : 0.035, { x: 0, y: -0.015, z: 0 }, black, turn, 0.005);
    sp.rotation.y = a;
    sp.position.set(Math.cos(a) * (Wh.r / 2), -0.015, -Math.sin(a) * (Wh.r / 2));
  }
  kit.mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.04, 20), black, turn).position.y = -0.005;

  // ── THE PEDALS ─────────────────────────────────────────────────────
  const P = C.pedals;
  const pedal = (x: number, w: number, h: number): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(x, P.y + 0.16, P.z + 0.04);
    group.add(g);
    kit.rod({ x: 0, y: 0, z: 0 }, { x: 0, y: -0.14, z: -0.04 }, 0.008, steel, g, 6);
    const pad = kit.box(w, h, 0.016, { x: 0, y: -0.15, z: -0.045 }, rubber, g, 0.006);
    pad.rotation.x = -0.45;
    return g;
  };
  const gas = pedal(P.gas, 0.06, 0.14);
  const brake = pedal(P.brake, 0.1, 0.07);

  // ── THE SEATS ──────────────────────────────────────────────────────
  const St = C.seat;
  for (const x of [St.x, C.mate]) {
    kit.box(St.width * 0.8, St.top - 0.08 - I.floor, St.depth * 0.7, { x, y: (St.top - 0.08 + I.floor) / 2, z: St.z }, dark, group, 0.02);
    kit.box(St.width, 0.1, St.depth, { x, y: St.top - 0.05, z: St.z }, canvasSeat, group, 0.04);
    const back = new THREE.Group();
    back.position.set(x, St.top - 0.02, St.z - St.depth / 2 + 0.03);
    back.rotation.x = -St.lean;
    group.add(back);
    kit.box(St.width, St.tall, 0.1, { x: 0, y: St.tall / 2, z: -0.05 }, canvasSeat, back, 0.04);
    for (const s of [-1, 1])
      kit.box(0.06, St.tall * 0.7, 0.1, { x: s * (St.width / 2 - 0.02), y: St.tall * 0.4, z: 0.0 }, canvasSeat, back, 0.03);
    kit.box(0.26, 0.17, 0.08, { x: 0, y: St.tall + 0.13, z: -0.06 }, canvasSeat, back, 0.03);
    for (const s of [-1, 1]) kit.rod({ x: s * 0.08, y: St.tall, z: -0.06 }, { x: s * 0.08, y: St.tall + 0.06, z: -0.06 }, 0.008, steel, back, 6);
  }

  // ── THE REST ───────────────────────────────────────────────────────
  // The fire extinguisher clipped by the mate's door, a grab handle.
  const ext = { x: -I.half + 0.09, y: I.floor + 0.2, z: -0.05 };
  kit.mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.34, 16), red, group).position.set(ext.x, ext.y, ext.z);
  kit.mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.06, 10), black, group).position.set(ext.x, ext.y + 0.2, ext.z);
  kit.rod({ x: ext.x - 0.02, y: ext.y + 0.23, z: ext.z }, { x: ext.x - 0.02, y: ext.y + 0.23, z: ext.z + 0.09 }, 0.007, black, group, 5);
  for (const dy of [-0.1, 0.1]) kit.box(0.04, 0.025, 0.13, { x: ext.x, y: ext.y + dy, z: ext.z }, steel, group, 0.006);
  kit.rod({ x: -I.half + 0.04, y: 1.97, z: 0.12 }, { x: -I.half + 0.04, y: 1.75, z: 0.3 }, 0.014, black, group, 8);

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
    "carrier_driver",
  );
  group.add(driver.group);
  const rest: V3 = { x: St.x + 0.2, y: I.floor + 0.03, z: 0.1 };
  driver.pose(handsOnWheel(0).left, handsOnWheel(0).right, [rest, { x: P.gas, y: P.y, z: P.z }], false);

  let since = Infinity;
  return {
    group,
    update(r, t, dt, shown, own) {
      group.visible = shown;
      if (!shown) {
        since = Infinity;
        return;
      }
      const b = r.body;
      const pose = cabPose(r, b.speed);
      turn.rotation.y = -pose.wheel;
      gas.rotation.x = pose.gas * 0.3;
      brake.rotation.x = pose.brake * 0.35;
      lever.rotation.x = pose.reverse ? 0.35 : -0.12;
      const hands = handsOnWheel(pose.wheel);
      const foot: V3 =
        pose.brake > 0.05
          ? { x: P.brake, y: P.y - pose.brake * P.travel * 0.5, z: P.z - pose.brake * P.travel }
          : { x: P.gas, y: P.y - pose.gas * P.travel * 0.5, z: P.z - pose.gas * P.travel };
      driver.pose(hands.left, hands.right, [rest, foot], own);
      since += dt;
      if (since >= 1 / PAINT_HZ) {
        since = 0;
        const top = ARMOUR.top.carrier;
        paintClusterLive(cluster.ctx, clusterBack, cabGauges(b.speed, r.drive, t, r.dead, top));
        cluster.texture.needsUpdate = true;
      }
    },
    dispose() {
      driver.dispose();
      kit.dispose();
    },
  };
}
