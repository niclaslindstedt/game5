// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREERIDE BIKE AS DRAWN (`bike-variant.ts`'s freeride look) — the
// big-mountain freerider's bike, built in code off the same engine geometry
// as the trail look (`bike-look.ts`) and hung on the same NODES
// (`BIKE_NODES`), so it is posed by the same hand (`poseBike`) and every
// hook — the grips, the pedals, the saddle, the lift's hook — is where the
// rider and the lifts already look for it.
//
// What makes it a freerider's, after the class's photographs (no make or
// model kept, only its shape): a mixed set of wheels (a 29″ front, a 27.5″
// rear) on wide DOWNHILL RIMS and big-blocked 2.5″ tyres; a long-travel
// SINGLE-CROWN fork (room for the bars to spin) on a tall steerer with a
// stack of spacers and a short stem; a beefy alloy front triangle — a deep
// oval down tube, a curved top tube with a gusset under the head, a short
// seat tube with its post slammed — a boxed swingarm with a forged YOKE
// driving a COIL shock with a bright spring; a chain guide with a bash
// guard under the ring, a short-cage derailleur, four-piston brakes on
// 220 mm rotors, wide flat pedals with pins, a wide riser bar on lock-on
// grips. Smooth-shaded tubes over the trail look's faceted ones.
//
// Three-dependent; built once a ride (`bike-view.ts`'s `createBikeView`).

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BIKE_BB } from "@engine";

import {
  BAR_MIDDLE,
  BIKE_LOOK as L,
  CROWN_BOTTOM,
  CROWN_TOP,
  DRIVE,
  GRIPS,
  HEAD_BOTTOM,
  HEAD_TOP,
  REAR_REST,
  STEER_AT,
  STEER_AXIS,
  frontAxle,
  shockAt,
  type V3,
} from "./bike-look.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { BikeNodes } from "./bike-view.ts";

/** THE FREERIDE BIKE'S OWN NUMBERS, m, over the shared geometry: the tyres'
 * section and knobs, the rims' depth, the fork's legs, the frame's tubes,
 * the rotors, the pedals. */
export const FREERIDE_LOOK = {
  tyre: 0.066,
  rim: { depth: 0.026, width: 0.034 },
  knobRows: 34,
  spokes: 32,
  /** The rotors (220 front, 203 rear) and their carriers' arms. */
  rotorF: 0.11,
  rotorR: 0.1015,
  /** A single-crown fork's legs: the stanchions (38 mm), the lowers. */
  stanchion: 0.019,
  lower: 0.026,
  forkHalf: 0.068,
  /** The front triangle: the down tube's oval (wide, deep), the top tube,
   * the seat tube; the swingarm's box. */
  down: { w: 0.036, h: 0.048 },
  top: { w: 0.026, h: 0.032 },
  seat: 0.021,
  stay: { w: 0.018, h: 0.03 },
  /** The flat pedals: platform, pins along each long edge. */
  pedal: { length: 0.11, width: 0.105, thick: 0.016, pins: 5 },
};

const F = FREERIDE_LOOK;

/** THE PAINT, after the class's showroom: deep metallic teal over a black
 * swingarm, an orange coil and orange accents, gold stanchions on black
 * lowers, white decals. */
export const FREERIDE_PAINT = {
  frame: 0x0e6e78,
  arm: 0x16181b,
  accent: 0xff6a13,
  decal: 0xeef0ea,
  stanchion: 0xc9a65a,
  alloy: 0xa9afb5,
  rubber: 0x1a1a1b,
  tread: 0x232324,
  black: 0x111214,
  gum: 0x8a5a2e,
};

const tv = (p: V3): THREE.Vector3 => new THREE.Vector3(p.x, p.y, p.z);
const vv = (x: number, y: number, z: number): V3 => ({ x, y, z });
const rel = (p: V3, o: V3): V3 => vv(p.x - o.x, p.y - o.y, p.z - o.z);
const lerp = (a: V3, b: V3, k: number): V3 =>
  vv(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, a.z + (b.z - a.z) * k);

type Mat = keyof typeof FREERIDE_PAINT | "stanchionGloss" | "chrome";

/** THE FREERIDE BIKE, its geometry merged a node and a material at a time. */
export function buildFreerideBike(haze: HazeUniforms): {
  root: THREE.Group;
  nodes: BikeNodes;
  dispose(): void;
} {
  const P = FREERIDE_PAINT;
  const mats: THREE.Material[] = [];
  const paint = (p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), haze, "bike");
    mats.push(m);
    return m;
  };
  const M: Record<Mat, THREE.MeshStandardMaterial> = {
    frame: paint({ color: P.frame, roughness: 0.28, metalness: 0.55 }),
    arm: paint({ color: P.arm, roughness: 0.5, metalness: 0.3 }),
    accent: paint({ color: P.accent, roughness: 0.4, metalness: 0.1 }),
    decal: paint({ color: P.decal, roughness: 0.45 }),
    stanchion: paint({ color: P.stanchion, roughness: 0.25, metalness: 0.85 }),
    stanchionGloss: paint({ color: P.stanchion, roughness: 0.18, metalness: 0.9 }),
    alloy: paint({ color: P.alloy, roughness: 0.32, metalness: 0.85 }),
    chrome: paint({ color: 0xd8dcdf, roughness: 0.15, metalness: 0.95 }),
    rubber: paint({ color: P.rubber, roughness: 0.92 }),
    tread: paint({ color: P.tread, roughness: 0.96, flatShading: true }),
    black: paint({ color: P.black, roughness: 0.55, metalness: 0.25 }),
    gum: paint({ color: P.gum, roughness: 0.9 }),
  };
  const geos: THREE.BufferGeometry[] = [];
  const parts = new Map<THREE.Object3D, Map<Mat, THREE.BufferGeometry[]>>();
  const put = (node: THREE.Object3D, mat: Mat, g: THREE.BufferGeometry): void => {
    let byMat = parts.get(node);
    if (!byMat) parts.set(node, (byMat = new Map()));
    const list = byMat.get(mat) ?? [];
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    list.push(flat);
    byMat.set(mat, list);
  };
  const basis = new THREE.Matrix4();
  const X = new THREE.Vector3(1, 0, 0);
  /** A tube from `a` to `b` whose section is an oval `w` wide (across the
   * bike, along x where it can be) and `h` deep, tapering to `taper` of
   * itself at `b`. */
  const oval = (
    node: THREE.Object3D,
    mat: Mat,
    a: V3,
    b: V3,
    w: number,
    h = w,
    taper = 1,
    sides = 12,
  ): void => {
    const A = tv(a);
    const d = tv(b).sub(A);
    const length = d.length();
    if (length < 1e-4) return;
    const dir = d.clone().normalize();
    // Across: the bike's x where the tube is not along it, else its z.
    const ref = Math.abs(dir.x) > 0.9 ? new THREE.Vector3(0, 0, 1) : X;
    const side = ref
      .clone()
      .sub(dir.clone().multiplyScalar(ref.dot(dir)))
      .normalize();
    const third = new THREE.Vector3().crossVectors(side, dir);
    const g = new THREE.CylinderGeometry(taper, 1, length, sides, 1);
    g.scale(w, 1, h);
    g.translate(0, length / 2, 0);
    basis.makeBasis(side, dir, third).setPosition(A);
    g.applyMatrix4(basis);
    put(node, mat, g);
  };
  const tube = (node: THREE.Object3D, mat: Mat, a: V3, b: V3, r: number, sides = 10): void =>
    oval(node, mat, a, b, r, r, 1, sides);
  /** A tube along a path, its ends joined with a ball so a bend reads
   * round. */
  const bent = (node: THREE.Object3D, mat: Mat, path: V3[], w: number, h = w): void => {
    for (let i = 0; i + 1 < path.length; i++) oval(node, mat, path[i], path[i + 1], w, h);
    for (let i = 1; i + 1 < path.length; i++) ball(node, mat, path[i], Math.min(w, h));
  };
  const ball = (node: THREE.Object3D, mat: Mat, at: V3, r: number): void => {
    const g = new THREE.SphereGeometry(r, 10, 7);
    g.translate(at.x, at.y, at.z);
    put(node, mat, g);
  };
  const box = (
    node: THREE.Object3D,
    mat: Mat,
    at: V3,
    w: number,
    h: number,
    l: number,
    rx = 0,
  ): void => {
    const g = new THREE.BoxGeometry(w, h, l);
    if (rx) g.rotateX(rx);
    g.translate(at.x, at.y, at.z);
    put(node, mat, g);
  };
  /** A disc or ring about the x axis at `x`, `inner` > 0 a ring. */
  const disc = (
    node: THREE.Object3D,
    mat: Mat,
    x: number,
    r: number,
    t: number,
    n = 24,
    inner = 0,
  ): void => {
    let g: THREE.BufferGeometry;
    if (inner > 0) {
      const shape = new THREE.Shape().absarc(0, 0, r, 0, Math.PI * 2, false);
      shape.holes.push(new THREE.Path().absarc(0, 0, inner, 0, Math.PI * 2, true));
      g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: n });
      g.translate(0, 0, -t / 2);
      g.rotateY(Math.PI / 2);
    } else {
      g = new THREE.CylinderGeometry(r, r, t, n, 1);
      g.rotateZ(Math.PI / 2);
    }
    g.translate(x, 0, 0);
    put(node, mat, g);
  };
  const node = (name: string, parent: THREE.Object3D, at: V3): THREE.Group => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(at.x, at.y, at.z);
    parent.add(g);
    return g;
  };
  const O: V3 = vv(0, 0, 0);

  const root = new THREE.Group();
  root.name = "bike-freeride";
  const frame = node("bike_frame", root, BIKE_BB);

  // ── THE FRONT TRIANGLE ────────────────────────────────────────────────
  const axisUp = STEER_AXIS;
  const onAxis = (p: V3, k: number): V3 =>
    vv(p.x + axisUp.x * k, p.y + axisUp.y * k, p.z + axisUp.z * k);
  // The head tube, tapered, with its bearing cups proud at each end.
  oval(frame, "frame", onAxis(HEAD_BOTTOM, -0.006), onAxis(HEAD_TOP, 0.004), 0.034, 0.034, 0.86);
  tube(frame, "black", onAxis(HEAD_TOP, 0), onAxis(HEAD_TOP, 0.012), 0.032);
  tube(frame, "black", onAxis(HEAD_BOTTOM, -0.014), onAxis(HEAD_BOTTOM, -0.004), 0.037);
  // The bottom bracket's shell and the junction's forging round it.
  tube(frame, "frame", vv(-0.05, 0, 0), vv(0.05, 0, 0), 0.026, 14);
  // The down tube: a deep oval from under the head to the shell, flattened
  // into the junction.
  const downTop = vv(0, HEAD_BOTTOM.y + 0.03, HEAD_BOTTOM.z - 0.02);
  const downEnd = vv(0, 0.055, 0.07);
  oval(frame, "frame", downEnd, downTop, F.down.w, F.down.h, 0.82);
  oval(frame, "frame", vv(0, 0.01, 0.02), downEnd, F.down.w, F.down.h * 1.2);
  // Its decal: a long stripe and an accent slash down its flank, each side.
  for (const s of [-1, 1]) {
    const a = lerp(downEnd, downTop, 0.18);
    const b = lerp(downEnd, downTop, 0.78);
    const off = vv(s * (F.down.w - 0.002), 0, 0);
    oval(
      frame,
      "decal",
      vv(a.x + off.x, a.y, a.z),
      vv(b.x + off.x, b.y, b.z),
      0.004,
      0.02,
      0.85,
      4,
    );
    const c = lerp(downEnd, downTop, 0.82);
    const e = lerp(downEnd, downTop, 0.9);
    oval(frame, "accent", vv(off.x, c.y, c.z), vv(off.x, e.y, e.z), 0.004, 0.024, 1, 4);
  }
  // The top tube: curved down from the head to the seat tube's top, a
  // gusset plate under the head.
  const topStart = vv(0, HEAD_TOP.y - 0.03, HEAD_TOP.z - 0.015);
  const seatJoin = vv(0, 0.39, -0.155);
  const topPath = [
    topStart,
    lerp(topStart, seatJoin, 0.35),
    vv(0, lerp(topStart, seatJoin, 0.7).y + 0.012, lerp(topStart, seatJoin, 0.7).z),
    seatJoin,
  ];
  topPath[1] = vv(0, topPath[1].y + 0.02, topPath[1].z);
  bent(frame, "frame", topPath, F.top.w, F.top.h);
  box(
    frame,
    "frame",
    lerp(downTop, topStart, 0.5),
    0.018,
    0.05,
    0.1,
    -Math.atan2(topStart.y - downTop.y, 0.05),
  );
  oval(frame, "frame", lerp(topStart, downTop, 0.1), lerp(downTop, downEnd, 0.12), 0.012, 0.03);
  // The seat tube, short, from the shell to the top tube and the post
  // slammed into it, the saddle low over the rear tyre.
  tube(frame, "frame", vv(0, 0.02, -0.025), L.seatTop, F.seat);
  tube(frame, "black", L.seatTop, lerp(L.seatTop, L.saddle.at, 0.75), 0.0155);
  tube(frame, "alloy", lerp(L.seatTop, L.saddle.at, 0.75), L.saddle.at, 0.0148);
  // The saddle: a slim shell, nose to tail, its padding a little proud.
  const sa = L.saddle.at;
  const saddle = [
    vv(0, sa.y + 0.024, sa.z + 0.13),
    vv(0, sa.y + 0.03, sa.z + 0.04),
    vv(0, sa.y + 0.032, sa.z - 0.06),
    vv(0, sa.y + 0.03, sa.z - 0.115),
  ];
  for (let i = 0; i + 1 < saddle.length; i++) {
    const w = [0.022, 0.04, 0.066, 0.068][i + 1];
    oval(
      frame,
      "black",
      saddle[i],
      saddle[i + 1],
      [0.022, 0.034, 0.06][i],
      0.016,
      w / [0.022, 0.034, 0.06][i],
      10,
    );
  }
  box(frame, "accent", vv(0, sa.y + 0.04, sa.z - 0.11), 0.11, 0.008, 0.015);
  // The shock's mount off the down tube, and the main pivot's lugs.
  oval(frame, "frame", L.shockFront, lerp(downEnd, downTop, 0.55), 0.02, 0.03);
  tube(
    frame,
    "alloy",
    vv(-0.035, L.shockFront.y, L.shockFront.z),
    vv(0.035, L.shockFront.y, L.shockFront.z),
    0.009,
    8,
  );
  for (const s of [-1, 1]) {
    oval(frame, "frame", vv(s * 0.04, L.pivot.y, L.pivot.z), vv(s * 0.03, 0.03, 0.02), 0.012, 0.03);
  }
  tube(frame, "alloy", vv(-0.06, L.pivot.y, L.pivot.z), vv(0.06, L.pivot.y, L.pivot.z), 0.012, 10);
  // THE CHAIN GUIDE: the upper guide over the ring and the taco under it.
  const ringX = DRIVE * 0.052;
  box(frame, "black", vv(ringX, 0.07, -0.02), 0.024, 0.03, 0.04);
  const taco = [];
  for (let k = 0; k <= 7; k++) {
    const a = -0.3 + (k / 7) * 1.9;
    taco.push(vv(ringX, -Math.sin(a) * (L.ring + 0.022), Math.cos(a) * (L.ring + 0.022)));
  }
  bent(frame, "black", taco, 0.012, 0.02);
  box(frame, "black", vv(ringX + DRIVE * -0.012, 0.0, 0.035), 0.012, 0.05, 0.05);

  // ── THE STEERED SIDE: the crown, the stanchions, the steerer, the stem
  // and its spacers, the bar, the grips, the levers ─────────────────────
  const bars = node("bike_bars", frame, STEER_AT);
  const axleRest = frontAxle(0, 0);
  const footOf = (x: number): V3 => rel(vv(x, axleRest.y, axleRest.z), STEER_AT);
  const crown = rel(CROWN_BOTTOM, STEER_AT);
  // Where the crown meets each stanchion: the line from the axle up the
  // axis, at the crown's height along it.
  const legTop = (x: number): V3 => {
    const foot = footOf(x);
    const k = (crown.y - foot.y) / axisUp.y;
    return vv(x, foot.y + axisUp.y * k, foot.z + axisUp.z * k);
  };
  const stanchionLength = 0.6;
  for (const s of [-1, 1]) {
    const top = legTop(s * F.forkHalf);
    const bottom = vv(
      top.x,
      top.y - axisUp.y * stanchionLength,
      top.z - axisUp.z * stanchionLength,
    );
    tube(bars, "stanchionGloss", bottom, top, F.stanchion, 14);
  }
  // The crown: a forged bridge from leg to leg round the steerer.
  const lt = legTop(-F.forkHalf);
  const rt = legTop(F.forkHalf);
  bent(
    bars,
    "black",
    [
      vv(lt.x - 0.02, lt.y, lt.z),
      vv(0, crown.y + 0.012, (crown.z + lt.z) / 2),
      vv(rt.x + 0.02, rt.y, rt.z),
    ],
    0.024,
    0.03,
  );
  tube(bars, "black", crown, legTop(0), 0.03, 10);
  // The steerer up through the head tube, the spacers stacked over it and
  // the stem's clamp, the stem forward to the bar.
  const topCup = rel(HEAD_TOP, STEER_AT);
  const crownTop = rel(CROWN_TOP, STEER_AT);
  const stemAt = vv(0, crownTop.y + axisUp.y * 0.015, crownTop.z + axisUp.z * 0.015);
  for (let k = 0; k < 3; k++) {
    const a = onAxis(topCup, 0.013 + k * 0.011);
    tube(bars, k === 1 ? "accent" : "black", a, onAxis(a, 0.009), 0.0175, 12);
  }
  tube(bars, "black", onAxis(stemAt, -0.02), onAxis(stemAt, 0.03), 0.021, 12);
  ball(bars, "black", onAxis(stemAt, 0.031), 0.012);
  const bar = rel(BAR_MIDDLE, STEER_AT);
  oval(bars, "black", stemAt, bar, 0.022, 0.03);
  oval(
    bars,
    "alloy",
    vv(0, bar.y + 0.004, bar.z),
    vv(0, stemAt.y + 0.02, stemAt.z + 0.01),
    0.012,
    0.006,
    1,
    6,
  );
  // The riser bar: clamped in the middle, swept up and back to the grips.
  const [gl, gr] = GRIPS.map((g) => rel(g, STEER_AT));
  for (const g of [gl, gr]) {
    const s = Math.sign(g.x);
    const inner = vv(s * 0.07, bar.y, bar.z);
    const rise = vv(s * 0.15, g.y, g.z + 0.012);
    const end = vv(g.x + (s * L.grip) / 2 + s * 0.004, g.y, g.z);
    bent(bars, "black", [inner, rise, end], 0.011);
    // The lock-on grip between its collars.
    const gin = vv(g.x - (s * L.grip) / 2, g.y, g.z);
    const gout = vv(g.x + (s * L.grip) / 2, g.y, g.z);
    tube(bars, "rubber", gin, gout, 0.0165, 12);
    for (const c of [gin, gout])
      tube(
        bars,
        "accent",
        vv(c.x - s * 0.005, c.y, c.z),
        vv(c.x + s * 0.005, c.y, c.z),
        0.0175,
        12,
      );
    // The brake's master cylinder and its lever.
    const mc = vv(g.x - s * 0.085, g.y + 0.008, g.z + 0.004);
    oval(
      bars,
      "black",
      vv(mc.x - s * 0.02, mc.y, mc.z),
      vv(mc.x + s * 0.02, mc.y, mc.z),
      0.012,
      0.014,
      0.8,
      8,
    );
    bent(
      bars,
      "alloy",
      [
        vv(mc.x + s * 0.005, mc.y - 0.004, mc.z + 0.018),
        vv(g.x + s * 0.01, g.y - 0.006, g.z + 0.05),
        vv(g.x + s * 0.035, g.y - 0.012, g.z + 0.052),
      ],
      0.0055,
    );
  }
  tube(bars, "black", vv(-0.07, bar.y, bar.z), vv(0.07, bar.y, bar.z), 0.0165, 12);
  // The front brake's hose, from the lever down to the caliper.
  const hoseFoot = vv(F.forkHalf + 0.03, footOf(0).y + 0.12, footOf(0).z - 0.06);
  bent(
    bars,
    "black",
    [
      vv(gr.x - 0.1, gr.y, gr.z + 0.02),
      vv(0.07, bar.y + 0.05, bar.z + 0.06),
      vv(0.1, crown.y - 0.04, crown.z + 0.03),
      hoseFoot,
    ],
    0.0035,
  );

  // ── THE FORK'S LOWERS and the front wheel ─────────────────────────────
  const fork = node("bike_fork", bars, O);
  const lowerLength = 0.42;
  for (const s of [-1, 1]) {
    const foot = footOf(s * F.forkHalf);
    const top = vv(foot.x, foot.y + axisUp.y * lowerLength, foot.z + axisUp.z * lowerLength);
    oval(fork, "black", vv(foot.x, foot.y - 0.02, foot.z + 0.004), top, F.lower, F.lower, 0.9, 14);
    tube(
      fork,
      "black",
      vv(top.x, top.y - 0.004, top.z),
      vv(top.x, top.y + 0.012 * axisUp.y, top.z + 0.012 * axisUp.z),
      F.lower * 1.05,
      14,
    );
    // The lowers' decal, on the outer face.
    const a = lerp(foot, top, 0.35);
    const b = lerp(foot, top, 0.8);
    oval(
      fork,
      "decal",
      vv(s * (F.forkHalf + F.lower - 0.002), a.y, a.z),
      vv(s * (F.forkHalf + F.lower - 0.002), b.y, b.z),
      0.003,
      0.014,
      1,
      4,
    );
    // The axle's pinch at the dropout.
    tube(
      fork,
      "alloy",
      vv(s * (F.forkHalf - 0.02), foot.y, foot.z),
      vv(s * (F.forkHalf + 0.03), foot.y, foot.z),
      0.012,
      8,
    );
  }
  // The arch over the tyre, at the front (a single-crown's).
  const archL = lerp(footOf(-F.forkHalf), legTop(-F.forkHalf), 0.42);
  const archR = lerp(footOf(F.forkHalf), legTop(F.forkHalf), 0.42);
  bent(
    fork,
    "black",
    [
      vv(-F.forkHalf, archL.y, archL.z + 0.02),
      vv(0, archL.y + 0.05, archL.z + 0.045),
      vv(F.forkHalf, archR.y, archR.z + 0.02),
    ],
    0.016,
    0.022,
  );
  // The caliper on the brake side's lower, behind the leg.
  const cal = vv(F.forkHalf + 0.012, footOf(0).y + 0.07, footOf(0).z - 0.06);
  box(fork, "black", cal, 0.03, 0.09, 0.045, 0.6);
  box(fork, "accent", vv(cal.x + 0.016, cal.y, cal.z), 0.002, 0.05, 0.022, 0.6);
  const wheelF = node("bike_wheel_f", fork, rel(axleRest, STEER_AT));
  wheel(wheelF, L.rimF, F.rotorF);

  // ── THE SWINGARM, its yoke, and the rear wheel ────────────────────────
  const swing = node("bike_swingarm", frame, L.pivot);
  const axle = rel(REAR_REST, L.pivot);
  const rocker = rel(L.shockRear, L.pivot);
  const S = F.stay;
  for (const s of [-1, 1]) {
    const x = s * 0.062;
    // The chainstays: a boxed arm from the pivot's yoke back to the axle.
    oval(swing, "arm", vv(s * 0.045, 0, 0.0), vv(x, axle.y + 0.01, axle.z + 0.03), S.w, S.h, 0.75);
    // The seat stays: from the dropout up to the yoke.
    oval(
      swing,
      "arm",
      vv(x, axle.y + 0.012, axle.z + 0.01),
      vv(s * 0.04, rocker.y - 0.01, rocker.z - 0.05),
      S.w * 0.85,
      S.h * 0.8,
      0.9,
    );
    // The dropout plate and the axle's end.
    box(swing, "arm", vv(x, axle.y, axle.z + 0.012), 0.012, 0.05, 0.06);
    tube(swing, "alloy", vv(s * 0.066, axle.y, axle.z), vv(s * 0.078, axle.y, axle.z), 0.013, 8);
  }
  // A brace across the stays behind the seat tube, and the forged yoke up
  // to the shock's rear eye.
  tube(
    swing,
    "arm",
    vv(-0.05, axle.y * 0.45 + 0.02, axle.z * 0.38),
    vv(0.05, axle.y * 0.45 + 0.02, axle.z * 0.38),
    0.012,
    8,
  );
  for (const s of [-1, 1]) {
    oval(
      swing,
      "arm",
      vv(s * 0.03, 0.01, -0.01),
      vv(s * 0.022, rocker.y, rocker.z - 0.005),
      0.012,
      0.034,
      0.7,
    );
    oval(
      swing,
      "arm",
      vv(s * 0.04, rocker.y - 0.012, rocker.z - 0.05),
      vv(s * 0.022, rocker.y, rocker.z),
      0.01,
      0.026,
    );
  }
  tube(swing, "alloy", vv(-0.03, rocker.y, rocker.z), vv(0.03, rocker.y, rocker.z), 0.008, 8);
  // The chainstay's protector on the drive side.
  oval(
    swing,
    "black",
    vv(DRIVE * 0.064, 0.012, -0.03),
    vv(DRIVE * 0.066, axle.y + 0.02, axle.z + 0.12),
    0.006,
    S.h * 1.05,
    0.8,
    6,
  );
  // The chain: the top run from the ring's top to the cassette, the bottom
  // run back under through the derailleur.
  const ringRel = rel(vv(DRIVE * 0.052, 0, 0), L.pivot);
  tube(
    swing,
    "black",
    vv(ringRel.x, ringRel.y + L.ring, ringRel.z),
    vv(ringRel.x - DRIVE * 0.004, axle.y + L.cog, axle.z),
    0.0045,
    5,
  );
  const mech = vv(DRIVE * 0.078, axle.y - 0.085, axle.z + 0.01);
  tube(
    swing,
    "black",
    vv(ringRel.x, ringRel.y - L.ring, ringRel.z),
    vv(mech.x, mech.y - 0.03, mech.z + 0.02),
    0.0045,
    5,
  );
  // The derailleur: its body off the hanger and the short cage hanging.
  box(swing, "black", vv(DRIVE * 0.078, axle.y - 0.03, axle.z - 0.01), 0.018, 0.05, 0.04);
  box(swing, "accent", vv(DRIVE * 0.088, axle.y - 0.03, axle.z - 0.01), 0.002, 0.02, 0.02);
  box(swing, "black", mech, 0.014, 0.075, 0.03);
  // The rear brake's caliper, on the stay above the axle on the brake side.
  box(swing, "black", vv(0.072, axle.y + 0.06, axle.z + 0.07), 0.026, 0.07, 0.04, -0.9);
  const wheelR = node("bike_wheel_r", swing, axle);
  wheel(wheelR, L.rimR, F.rotorR);
  // The cassette, a stack of cogs in a cone on the drive side.
  for (let k = 0; k < 7; k++) {
    disc(wheelR, "chrome", DRIVE * (0.03 + k * 0.004), L.cog * (1.7 - k * 0.15), 0.0018, 18);
  }

  // ── THE SHOCK, along +z from its front eye: a piggyback body, the
  // shaft, an orange coil between its seats ──────────────────────────────
  const shock = node("bike_shock", frame, L.shockFront);
  const SL = shockAt(0).length;
  tube(shock, "black", vv(-0.012, 0, 0), vv(0.012, 0, 0), 0.012, 10);
  tube(shock, "alloy", vv(0, 0, 0.006), vv(0, 0, SL * 0.56), 0.019, 14);
  tube(shock, "black", vv(0, 0.036, 0.012), vv(0, 0.036, SL * 0.44), 0.016, 12);
  tube(shock, "accent", vv(0, 0.036, SL * 0.44), vv(0, 0.036, SL * 0.46), 0.0165, 12);
  oval(shock, "black", vv(0, 0.01, 0.012), vv(0, 0.03, 0.02), 0.01, 0.012);
  tube(shock, "chrome", vv(0, 0, SL * 0.5), vv(0, 0, SL - 0.01), 0.0075, 10);
  tube(shock, "black", vv(0, 0, SL - 0.015), vv(0, 0, SL), 0.014, 10);
  tube(shock, "black", vv(-0.012, 0, SL), vv(0.012, 0, SL), 0.011, 10);
  disc(shock, "black", 0, 0.034, 0.006, 16);
  // The coil: a helix, its turns a tube wound round the body.
  const turns = 8;
  const helix: V3[] = [];
  const from = SL * 0.16;
  const to = SL * 0.9;
  for (let k = 0; k <= turns * 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    helix.push(
      vv(Math.cos(a) * 0.031, Math.sin(a) * 0.031, from + ((to - from) * k) / (turns * 10)),
    );
  }
  for (let i = 0; i + 1 < helix.length; i++)
    tube(shock, "accent", helix[i], helix[i + 1], 0.0055, 6);
  for (const z of [from - 0.004, to + 0.004]) {
    const g = new THREE.TorusGeometry(0.031, 0.006, 6, 18);
    g.translate(0, 0, z);
    put(shock, "black", g);
  }

  // ── THE CRANKS, the ring and the pedals ───────────────────────────────
  const cranks = node("bike_cranks", frame, O);
  disc(cranks, "black", DRIVE * 0.052, L.ring, 0.0045, 32, L.ring - 0.012);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + 0.4;
    tube(
      cranks,
      "black",
      vv(DRIVE * 0.052, 0, 0),
      vv(DRIVE * 0.052, Math.sin(a) * (L.ring - 0.01), Math.cos(a) * (L.ring - 0.01)),
      0.006,
      5,
    );
  }
  // The teeth: a toothed ring proud of the disc.
  const teeth = 34;
  for (let k = 0; k < teeth; k++) {
    const a = (k / teeth) * Math.PI * 2;
    box(
      cranks,
      "black",
      vv(DRIVE * 0.052, Math.sin(a) * (L.ring + 0.004), Math.cos(a) * (L.ring + 0.004)),
      0.004,
      0.006,
      0.004,
    );
  }
  tube(cranks, "black", vv(-0.07, 0, 0), vv(0.07, 0, 0), 0.012, 10);
  const pedals: THREE.Group[] = [];
  for (const i of [0, 1]) {
    const s = i ? 1 : -1;
    const dir = i ? -1 : 1;
    const end: V3 = vv(s * 0.072, 0, dir * L.crank);
    oval(cranks, "black", vv(s * 0.064, 0, 0), end, 0.011, 0.022, 0.75, 10);
    oval(
      cranks,
      "alloy",
      vv(s * 0.072, 0, dir * 0.02),
      vv(s * 0.074, 0, dir * (L.crank - 0.02)),
      0.004,
      0.008,
      1,
      6,
    );
    // The crank boot at its end.
    tube(cranks, "black", vv(s * 0.07, 0, end.z), vv(s * 0.08, 0, end.z), 0.016, 10);
    const pedal = node(i ? "bike_pedal_r" : "bike_pedal_l", cranks, vv(s * L.q, 0, end.z));
    flatPedal(pedal, s);
    pedals.push(pedal);
  }

  /** A FLAT PEDAL: a wide alloy platform on its spindle, concave, its pins
   * proud of both faces along the long edges. */
  function flatPedal(at: THREE.Object3D, s: number): void {
    const p = F.pedal;
    tube(at, "chrome", vv(-s * (L.q - 0.08), 0, 0), vv(s * 0.02, 0, 0), 0.0055, 6);
    // The body's frame: the two long rails and the two ends.
    for (const z of [-1, 1]) {
      box(at, "black", vv(0, 0, (z * (p.length - 0.012)) / 2), p.width, p.thick, 0.012);
    }
    for (const x of [-1, 1]) {
      box(at, "black", vv((x * (p.width - 0.01)) / 2, 0, 0), 0.01, p.thick, p.length);
    }
    box(at, "black", vv(0, 0, 0), 0.03, p.thick * 0.9, p.length * 0.9);
    // The pins.
    for (let k = 0; k < p.pins; k++) {
      const x = -p.width / 2 + 0.008 + (k * (p.width - 0.016)) / (p.pins - 1);
      for (const z of [-1, 1]) {
        for (const y of [-1, 1]) {
          box(
            at,
            "chrome",
            vv(x, (y * (p.thick + 0.005)) / 2, (z * (p.length - 0.012)) / 2),
            0.004,
            0.005,
            0.004,
          );
        }
      }
    }
  }

  /** A WHEEL about +x at the node's origin: the hub and its flanges, the
   * spokes laced two-cross, a deep rim with its decal, a big-blocked tyre
   * and the brake's rotor on its carrier on the brake side (+x). */
  function wheel(at: THREE.Object3D, rim: number, rotor: number): void {
    const R = rim + F.tyre * 0.55;
    // The tyre's carcass: a fat torus, flattened a little at its crown.
    const carcass = new THREE.TorusGeometry(R, F.tyre * 0.55, 10, 48);
    carcass.scale(1, 1, 0.92);
    carcass.rotateY(Math.PI / 2);
    put(at, "rubber", carcass);
    // The knobs: a ramped pair down the middle every row, a big shoulder
    // block each side every row, transition knobs every other.
    const N = F.knobRows;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2;
      const add = (x: number, w: number, h: number, l: number, lift: number, lean = 0): void => {
        const k = new THREE.BoxGeometry(w, h, l);
        if (lean) k.rotateZ(lean);
        k.translate(x, R + lift, 0);
        k.rotateX(a);
        put(at, "tread", k);
      };
      const off = i % 2 ? 0.012 : -0.012;
      add(off, 0.018, 0.012, 0.016, F.tyre * 0.5);
      add(-off, 0.012, 0.011, 0.012, F.tyre * 0.48);
      for (const s of [-1, 1]) {
        add(s * F.tyre * 0.48, 0.016, 0.014, 0.02, F.tyre * 0.3, s * 0.8);
        if (i % 2 === 0) add(s * F.tyre * 0.3, 0.012, 0.011, 0.014, F.tyre * 0.43, s * 0.4);
      }
    }
    // The rim: two walls and its bed, a decal band round its outer face.
    const rimIn = rim - F.rim.depth;
    for (const s of [-1, 1]) {
      disc(at, "black", s * (F.rim.width / 2), rim, 0.004, 48, rimIn);
    }
    const bed = new THREE.CylinderGeometry(rim - 0.003, rim - 0.003, F.rim.width, 48, 1, true);
    bed.rotateZ(Math.PI / 2);
    put(at, "black", bed);
    const inner = new THREE.CylinderGeometry(rimIn, rimIn, F.rim.width * 0.85, 48, 1, true);
    inner.rotateZ(Math.PI / 2);
    put(at, "black", inner);
    for (const s of [-1, 1]) {
      for (let k = 0; k < 2; k++) {
        const a0 = k * Math.PI + 0.3;
        const arc = new THREE.RingGeometry(rim - 0.018, rim - 0.008, 10, 1, a0, 0.9);
        arc.rotateY((s * Math.PI) / 2);
        arc.translate(s * (F.rim.width / 2 + 0.0025), 0, 0);
        put(at, "decal", arc);
      }
    }
    // The hub, its flanges, and the spokes from them to the rim, two-cross.
    tube(at, "black", vv(-0.07, 0, 0), vv(0.07, 0, 0), F.rim.width * 0.6, 12);
    tube(at, "black", vv(-0.035, 0, 0), vv(0.035, 0, 0), 0.03, 14);
    for (const s of [-1, 1]) disc(at, "black", s * 0.036, 0.034, 0.004, 16);
    const n = F.spokes;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = i % 2 ? 1 : -1;
      const lead = i % 4 < 2 ? 1 : -1;
      const hubA = a - lead * ((2 * Math.PI * 2) / n) * 0.9;
      tube(
        at,
        "alloy",
        vv(s * 0.036, Math.cos(hubA) * 0.03, Math.sin(hubA) * 0.03),
        vv(s * 0.006, Math.cos(a) * (rimIn + 0.002), Math.sin(a) * (rimIn + 0.002)),
        0.0012,
        3,
      );
    }
    // The rotor: its braking ring cut with slots, its carrier's arms.
    const rx = 0.05;
    disc(at, "chrome", rx, rotor, 0.002, 40, rotor - 0.018);
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      bent(
        at,
        "black",
        [
          vv(rx, Math.cos(a) * 0.026, Math.sin(a) * 0.026),
          vv(rx, Math.cos(a + 0.35) * (rotor * 0.55), Math.sin(a + 0.35) * (rotor * 0.55)),
          vv(rx, Math.cos(a + 0.45) * (rotor - 0.016), Math.sin(a + 0.45) * (rotor - 0.016)),
        ],
        0.0035,
        0.003,
      );
    }
    disc(at, "black", rx, 0.03, 0.006, 12);
  }

  // Each node's parts merged a material at a time.
  for (const [n, byMat] of parts) {
    for (const [mat, list] of byMat) {
      const g = mergeGeometries(list, false);
      for (const l of list) l.dispose();
      if (!g) continue;
      geos.push(g);
      const mesh = new THREE.Mesh(g, M[mat]);
      mesh.castShadow = true;
      n.add(mesh);
    }
  }
  return {
    root,
    nodes: {
      frame,
      bars,
      fork,
      wheelF,
      swingarm: swing,
      wheelR,
      shock,
      cranks,
      pedalL: pedals[0],
      pedalR: pedals[1],
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
