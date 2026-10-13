// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE AS DRAWN (`bike.ts`) — a PLACEHOLDER built in code off
// the class's shape (`bike-look.ts`), faceted and plain, hung on the
// engine's body and posed off its readings every frame (`bikePose`): the
// WHEELS turned about their axles, the BARS and the fork's crowns turned
// about the steer axis, the FORK's lowers slid up its stanchions, the
// SWINGARM swung about the main pivot and the SHOCK shortened between its
// eyes, the CRANKS turned with the pedals held level. A modelled bike plugs
// into the same NODES (`BIKE_NODES`, each with its origin on its pivot) and
// is posed by the same hand (`poseBike`).
//
// Off the rider it lies where the engine lays it, rolls with him on a lift —
// hung by its front wheel off the back of his chair (`LIFT_HOOK`), carried
// in a cabin out of sight — and stands beside him in the lift's queue.
//
// Presentation only: it reads `GameState.bike` and writes nothing back.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BIKE, BIKE_BB, bikePose, type BikePose, type BikeState, type GameState } from "@engine";

import {
  BAR_MIDDLE,
  BIKE_LOOK as L,
  CROWN_BOTTOM,
  CROWN_TOP,
  DRIVE,
  GRIPS,
  HEAD_BOTTOM,
  HEAD_TOP,
  LIFT_HOOK,
  REAR_REST,
  STEER_AT,
  STEER_AXIS,
  frontAxle,
  shockAt,
  swingAt,
  type V3,
} from "./bike-look.ts";
import { bikeLook } from "./bike-looks.ts";
import { buildWorldCup } from "./bike-wc-build.ts";
import { glow } from "./glow-sprite.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createTrack, observe, sample, type Pose } from "./interp.ts";

/** THE NODES a drawn bike is posed by — the code's groups here, a model's
 * named nodes later. Every origin is its pivot, in the body frame from the
 * bottom bracket (x the engine's right, y up, z forward, metres):
 *   frame     rigid, origin the bottom bracket;
 *   bars      the steered side (crowns, stanchions, stem, bar, grips),
 *             origin `STEER_AT` on the steer axis, turned about `STEER_AXIS`;
 *   fork      the lowers, the bars' child, slid up `STEER_AXIS` by the
 *             fork's travel used;
 *   wheelF    the fork's child at the extended front axle, turned about +x;
 *   swingarm  origin the main pivot, turned about +x (`swingAt`);
 *   wheelR    the swingarm's child at the extended rear axle, about +x;
 *   shock     origin its front eye, its +z aimed at its rear eye and
 *             stretched along it to the eyes' length;
 *   cranks    origin the bottom bracket, turned about +x by the cranks'
 *             angle; pedalL / pedalR its children at the arms' ends,
 *             turned back so the platforms stay level. */
export const BIKE_NODES = {
  frame: "bike_frame",
  bars: "bike_bars",
  fork: "bike_fork",
  wheelF: "bike_wheel_f",
  swingarm: "bike_swingarm",
  wheelR: "bike_wheel_r",
  shock: "bike_shock",
  cranks: "bike_cranks",
  pedalL: "bike_pedal_l",
  pedalR: "bike_pedal_r",
} as const;

export type BikeNodes = Record<keyof typeof BIKE_NODES, THREE.Object3D>;

/** How near the parked bike a walker is for its halo to call him, m. */
const LIGHT_UP = 30;
/** The shock's length built (extended), m. */
const SHOCK_REST = shockAt(0).length;

const tv = (p: V3): THREE.Vector3 => new THREE.Vector3(p.x, p.y, p.z);

/** The code's bike, its geometry merged a node and a material at a time. */
function buildBike(haze: HazeUniforms): {
  root: THREE.Group;
  nodes: BikeNodes;
  dispose(): void;
} {
  const mats: THREE.Material[] = [];
  const paint = (p: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const m = hazeMaterial(
      new THREE.MeshStandardMaterial({ flatShading: true, ...p }),
      haze,
      "bike",
    );
    mats.push(m);
    return m;
  };
  const M = {
    frame: paint({ color: 0xd8571c, roughness: 0.42, metalness: 0.3 }),
    black: paint({ color: 0x141517, roughness: 0.6, metalness: 0.2 }),
    rubber: paint({ color: 0x1b1b1c, roughness: 0.95 }),
    alloy: paint({ color: 0x9da3a8, roughness: 0.35, metalness: 0.8 }),
    gold: paint({ color: 0xc2a462, roughness: 0.3, metalness: 0.85 }),
    spring: paint({ color: 0xe6c31b, roughness: 0.4, metalness: 0.3 }),
  };
  type Mat = keyof typeof M;
  const geos: THREE.BufferGeometry[] = [];
  const parts = new Map<THREE.Object3D, Map<Mat, THREE.BufferGeometry[]>>();
  const put = (node: THREE.Object3D, mat: Mat, g: THREE.BufferGeometry): void => {
    let byMat = parts.get(node);
    if (!byMat) parts.set(node, (byMat = new Map()));
    const list = byMat.get(mat) ?? [];
    list.push(g.index ? g.toNonIndexed() : g);
    byMat.set(mat, list);
  };
  const UP = new THREE.Vector3(0, 1, 0);
  /** A round tube from `a` to `b` (in `node`'s frame). */
  const tube = (node: THREE.Object3D, mat: Mat, a: V3, b: V3, r: number, sides = 7): void => {
    const A = tv(a);
    const d = tv(b).sub(A);
    const len = d.length();
    if (len < 1e-4) return;
    const g = new THREE.CylinderGeometry(r, r, len, sides, 1);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, d.clone().normalize()));
    g.translate(A.x + d.x / 2, A.y + d.y / 2, A.z + d.z / 2);
    put(node, mat, g);
  };
  const box = (node: THREE.Object3D, mat: Mat, at: V3, w: number, h: number, l: number): void => {
    const g = new THREE.BoxGeometry(w, h, l);
    g.translate(at.x, at.y, at.z);
    put(node, mat, g);
  };
  /** A disc or ring about the x axis at `x`. */
  const disc = (node: THREE.Object3D, mat: Mat, x: number, r: number, t: number, n = 18): void => {
    const g = new THREE.CylinderGeometry(r, r, t, n, 1);
    g.rotateZ(Math.PI / 2);
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
  const rel = (p: V3, o: V3): V3 => ({ x: p.x - o.x, y: p.y - o.y, z: p.z - o.z });
  const O: V3 = { x: 0, y: 0, z: 0 };

  const root = new THREE.Group();
  root.name = "bike-code";
  // The body frame from the bike's centre of mass: the bottom bracket.
  const frame = node(BIKE_NODES.frame, root, BIKE_BB);

  // ── THE FRAME ─────────────────────────────────────────────────────────
  const T = L.tube;
  tube(frame, "frame", HEAD_BOTTOM, HEAD_TOP, 0.028, 8);
  const topEnd: V3 = { x: 0, y: 0.38, z: -0.16 };
  tube(frame, "frame", { x: 0, y: HEAD_TOP.y - 0.025, z: HEAD_TOP.z - 0.01 }, topEnd, T.top);
  tube(
    frame,
    "frame",
    { x: 0, y: HEAD_BOTTOM.y + 0.02, z: HEAD_BOTTOM.z },
    { x: 0, y: 0.06, z: 0.05 },
    T.down,
  );
  tube(frame, "frame", { x: 0, y: 0.03, z: -0.02 }, L.seatTop, T.seat);
  // The shock's tab off the down tube, the bottom bracket's shell.
  tube(frame, "frame", L.shockFront, { x: 0, y: 0.36, z: 0.31 }, 0.014);
  tube(frame, "black", { x: -0.045, y: 0, z: 0 }, { x: 0.045, y: 0, z: 0 }, 0.024, 8);
  // The post and the saddle, slammed.
  tube(frame, "black", L.seatTop, L.saddle.at, 0.015);
  box(
    frame,
    "black",
    { ...L.saddle.at, y: L.saddle.at.y + 0.02 },
    L.saddle.width,
    0.035,
    L.saddle.length,
  );
  // The chain guide over the ring.
  box(frame, "black", { x: DRIVE * 0.045, y: 0.02, z: 0.06 }, 0.012, 0.06, 0.07);

  // ── THE STEERED SIDE: crowns, stanchions, stem, bar and grips ─────────
  const bars = node(BIKE_NODES.bars, frame, STEER_AT);
  const legs = [-1, 1].map((s) => ({ x: s * L.forkHalf, y: 0, z: 0 }));
  const axleRest = frontAxle(0, 0);
  // The stanchions stand on the line from the axle up the steer axis.
  const footOf = (s: V3): V3 => rel({ x: s.x, y: axleRest.y, z: axleRest.z }, STEER_AT);
  for (const s of legs) {
    const foot = footOf(s);
    const top: V3 = {
      x: foot.x,
      y: foot.y + STEER_AXIS.y * (L.lower.length + L.stanchion.length - 0.1),
      z: foot.z + STEER_AXIS.z * (L.lower.length + L.stanchion.length - 0.1),
    };
    const from: V3 = {
      x: foot.x,
      y: foot.y + STEER_AXIS.y * (L.lower.length - 0.05),
      z: foot.z + STEER_AXIS.z * (L.lower.length - 0.05),
    };
    tube(bars, "gold", from, top, L.stanchion.r, 8);
  }
  for (const c of [CROWN_TOP, CROWN_BOTTOM]) {
    const at = rel(c, STEER_AT);
    const ahead = footOf({ x: 0, y: 0, z: 0 });
    // Each crown from the steerer forward to the stanchions' line.
    const k = (at.y - ahead.y) / STEER_AXIS.y;
    const leg = { x: 0, y: ahead.y + STEER_AXIS.y * k, z: ahead.z + STEER_AXIS.z * k };
    tube(
      bars,
      "black",
      { x: -L.forkHalf - 0.02, y: leg.y, z: leg.z },
      { x: L.forkHalf + 0.02, y: leg.y, z: leg.z },
      0.022,
      6,
    );
    tube(bars, "black", at, leg, 0.02, 6);
  }
  const bar = rel(BAR_MIDDLE, STEER_AT);
  tube(bars, "black", rel(CROWN_TOP, STEER_AT), bar, 0.02, 6);
  const [gl, gr] = GRIPS.map((g) => rel(g, STEER_AT));
  const ends = [gl, gr].map((g) => ({ x: g.x + Math.sign(g.x) * (L.grip / 2), y: g.y, z: g.z }));
  tube(bars, "black", ends[0], { ...bar, x: -0.06 }, 0.0115, 6);
  tube(bars, "black", { ...bar, x: -0.06 }, { ...bar, x: 0.06 }, 0.016, 6);
  tube(bars, "black", { ...bar, x: 0.06 }, ends[1], 0.0115, 6);
  for (const g of [gl, gr]) {
    const s = Math.sign(g.x);
    tube(
      bars,
      "rubber",
      { ...g, x: g.x - (s * L.grip) / 2 },
      { ...g, x: g.x + (s * L.grip) / 2 },
      0.017,
      7,
    );
    // The brake lever, reaching forward under the bar.
    tube(
      bars,
      "alloy",
      { ...g, x: g.x - s * 0.06, z: g.z + 0.01 },
      { ...g, x: g.x + s * 0.02, y: g.y - 0.02, z: g.z + 0.07 },
      0.006,
      4,
    );
  }

  // ── THE FORK'S LOWERS and the front wheel ─────────────────────────────
  const fork = node(BIKE_NODES.fork, bars, O);
  for (const s of legs) {
    const foot = footOf(s);
    const top = {
      x: foot.x,
      y: foot.y + STEER_AXIS.y * L.lower.length,
      z: foot.z + STEER_AXIS.z * L.lower.length,
    };
    tube(fork, "black", { ...foot, y: foot.y - 0.02 }, top, L.lower.r, 8);
  }
  tube(
    fork,
    "black",
    { ...footOf(legs[0]), y: footOf(legs[0]).y + 0.25 },
    { ...footOf(legs[1]), y: footOf(legs[1]).y + 0.25 },
    0.012,
    5,
  );
  const wheelF = node(BIKE_NODES.wheelF, fork, rel(axleRest, STEER_AT));
  wheel(wheelF, L.rimF);
  box(
    fork,
    "black",
    { x: L.forkHalf + 0.012, y: footOf(legs[1]).y + 0.03, z: footOf(legs[1]).z - 0.08 },
    0.03,
    0.08,
    0.04,
  );

  // ── THE SWINGARM and the rear wheel ───────────────────────────────────
  const swing = node(BIKE_NODES.swingarm, frame, L.pivot);
  const axle = rel(REAR_REST, L.pivot);
  const rocker = rel(L.shockRear, L.pivot);
  for (const s of [-1, 1]) {
    const x = s * 0.06;
    tube(swing, "frame", { x: s * 0.04, y: 0, z: 0 }, { x, y: axle.y, z: axle.z }, T.stay + 0.004);
    tube(
      swing,
      "frame",
      { x, y: axle.y, z: axle.z },
      { x: s * 0.03, y: rocker.y, z: rocker.z - 0.02 },
      T.stay,
    );
  }
  tube(swing, "frame", { x: 0, y: 0, z: 0 }, rocker, 0.02);
  tube(
    swing,
    "black",
    { x: -0.05, y: rocker.y, z: rocker.z - 0.02 },
    { x: 0.05, y: rocker.y, z: rocker.z - 0.02 },
    0.012,
    5,
  );
  // The chain from the ring to the cog, and the derailleur.
  const ring = rel({ x: DRIVE * 0.055, y: 0, z: 0 }, L.pivot);
  for (const s of [1, -1]) {
    tube(
      swing,
      "black",
      { x: ring.x, y: ring.y + s * L.ring, z: ring.z },
      { x: ring.x, y: axle.y + s * L.cog, z: axle.z },
      0.005,
      4,
    );
  }
  box(swing, "black", { x: DRIVE * 0.07, y: axle.y - 0.07, z: axle.z + 0.01 }, 0.02, 0.09, 0.05);
  const wheelR = node(BIKE_NODES.wheelR, swing, axle);
  wheel(wheelR, L.rimR);
  disc(wheelR, "alloy", DRIVE * 0.055, L.cog, 0.02, 12);

  // ── THE SHOCK, built along +z from its front eye ──────────────────────
  const shock = node(BIKE_NODES.shock, frame, L.shockFront);
  const S = SHOCK_REST;
  tube(shock, "black", { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: S * 0.55 }, L.shock.body, 8);
  tube(shock, "black", { x: 0, y: 0.035, z: 0.02 }, { x: 0, y: 0.035, z: S * 0.35 }, 0.016, 6);
  tube(shock, "alloy", { x: 0, y: 0, z: S * 0.5 }, { x: 0, y: 0, z: S }, 0.008, 6);
  // The coil, as stacked rings between its two seats.
  const coils = 7;
  for (let i = 0; i <= coils; i++) {
    const g = new THREE.TorusGeometry(L.shock.coil, 0.0045, 4, 10);
    g.translate(0, 0, S * (0.2 + (0.72 * i) / coils));
    put(shock, "spring", g);
  }

  // ── THE CRANKS, the ring and the pedals ───────────────────────────────
  const cranks = node(BIKE_NODES.cranks, frame, O);
  const ringDisc = new THREE.CylinderGeometry(L.ring, L.ring, 0.006, 16, 1);
  ringDisc.rotateZ(Math.PI / 2);
  ringDisc.translate(DRIVE * 0.055, 0, 0);
  put(cranks, "black", ringDisc);
  const pedals: THREE.Group[] = [];
  for (const i of [0, 1]) {
    const s = i ? 1 : -1;
    const dir = i ? -1 : 1;
    const end: V3 = { x: s * 0.075, y: 0, z: dir * L.crank };
    tube(cranks, "black", { x: s * 0.06, y: 0, z: 0 }, end, 0.012, 5);
    const pedal = node(i ? BIKE_NODES.pedalR : BIKE_NODES.pedalL, cranks, {
      x: s * L.q,
      y: 0,
      z: end.z,
    });
    tube(pedal, "alloy", { x: -s * (L.q - 0.075), y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.006, 4);
    box(pedal, "black", { x: 0, y: 0, z: 0 }, L.pedal.width, L.pedal.thick, L.pedal.length);
    pedals.push(pedal);
  }

  /** A wheel about +x at the node's origin: hub, spokes, rim, a knobbly
   * tyre and the brake's rotor on the non-drive side. */
  function wheel(at: THREE.Object3D, rim: number): void {
    const tyreR = rim + L.tyre / 2;
    const t = new THREE.TorusGeometry(tyreR, L.tyre / 2, 6, 28);
    t.rotateY(Math.PI / 2);
    put(at, "rubber", t);
    const r = new THREE.TorusGeometry(rim - 0.006, 0.012, 4, 28);
    r.rotateY(Math.PI / 2);
    put(at, "black", r);
    for (let i = 0; i < L.knobs; i++) {
      const a = (i / L.knobs) * Math.PI * 2;
      const k = new THREE.BoxGeometry(i % 2 ? 0.05 : 0.03, 0.012, 0.02);
      k.translate(i % 2 ? 0 : i % 4 === 0 ? 0.022 : -0.022, rim + L.tyre + 0.002, 0);
      k.rotateX(a);
      put(at, "rubber", k);
    }
    tube(at, "alloy", { x: -0.06, y: 0, z: 0 }, { x: 0.06, y: 0, z: 0 }, L.hub, 8);
    for (let i = 0; i < L.spokes; i++) {
      const a = (i / L.spokes) * Math.PI * 2;
      const s = i % 2 ? 1 : -1;
      tube(
        at,
        "alloy",
        { x: s * 0.04, y: 0, z: 0 },
        { x: s * 0.008, y: Math.cos(a) * (rim - 0.01), z: Math.sin(a) * (rim - 0.01) },
        0.0016,
        3,
      );
    }
    disc(at, "alloy", -DRIVE * 0.055, L.rotor, 0.003, 20);
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

const turn = new THREE.Quaternion();
const axisSteer = new THREE.Vector3(STEER_AXIS.x, STEER_AXIS.y, STEER_AXIS.z);
const zAxis = new THREE.Vector3(0, 0, 1);
const aim = new THREE.Vector3();

/** POSE a drawn bike's nodes off the engine's `pose` — the code's or a
 * model's alike. */
export function poseBike(n: BikeNodes, pose: BikePose): void {
  n.bars.quaternion.setFromAxisAngle(axisSteer, pose.steer);
  n.fork.position.set(STEER_AXIS.x * pose.fork, STEER_AXIS.y * pose.fork, STEER_AXIS.z * pose.fork);
  n.wheelF.rotation.set(pose.frontSpin, 0, 0);
  n.swingarm.rotation.set(swingAt(pose.shock), 0, 0);
  n.wheelR.rotation.set(pose.rearSpin, 0, 0);
  const s = shockAt(pose.shock);
  aim.set(0, s.rear.y - s.front.y, s.rear.z - s.front.z).normalize();
  n.shock.quaternion.copy(turn.setFromUnitVectors(zAxis, aim));
  n.shock.scale.set(1, 1, s.length / SHOCK_REST);
  n.cranks.rotation.set(pose.crank, 0, 0);
  n.pedalL.rotation.set(-pose.crank, 0, 0);
  n.pedalR.rotation.set(-pose.crank, 0, 0);
}

export type BikeView = {
  group: THREE.Group;
  /** Draw the bike at the state's last step, eased from the step before by
   * `alpha`; `player` is where the rider is drawn (the halo's call). */
  update(state: GameState, alpha: number, dt: number, player: { x: number; z: number }): void;
  /** The bike as drawn this frame, its centre of mass and attitude. */
  drawn(): { x: number; y: number; z: number; q: THREE.Quaternion } | null;
  /** The nodes posed — a lab's, and a model's plug. */
  nodes: BikeNodes;
  ready: Promise<void>;
  dispose(): void;
};

/** The bike this visit draws (`bike-looks.ts`), with the hand that poses
 * it: the placeholder posed by `poseBike`, a replacement by its own. */
function buildFor(haze: HazeUniforms): {
  root: THREE.Group;
  nodes: BikeNodes;
  pose(p: BikePose): void;
  dispose(): void;
} {
  if (bikeLook() === "worldcup") return buildWorldCup(haze);
  const b = buildBike(haze);
  return { ...b, pose: (p) => poseBike(b.nodes, p) };
}

/** THE BIKE ON A LIFT, as drawn: hung by its front wheel off the back of
 * his chair (the hook `HANG` behind and under his seat), nose up, swinging
 * with the chair; inside a gondola's cabin, out of sight; stood beside him
 * on its wheels in the queue. */
const HANG = { back: 0.55, down: 0.05, pitch: 1.35 };

export function createBikeView(haze: HazeUniforms): BikeView {
  const group = new THREE.Group();
  group.name = "downhill-bike";
  const built = buildFor(haze);
  group.add(built.root);
  const call = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glow(),
      color: 0x7fe0ff,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  call.scale.set(2.2, 2.2, 1);
  call.position.set(0, 1.1, 0);
  call.renderOrder = 9;
  group.add(call);

  const track = createTrack();
  const at: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const q = new THREE.Quaternion();
  const off = new THREE.Vector3();
  const hook = new THREE.Vector3();
  let shown: { x: number; y: number; z: number; q: THREE.Quaternion } | null = null;
  let clock = 0;
  const hangTurn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -HANG.pitch);

  return {
    group,
    nodes: built.nodes,
    ready: Promise.resolve(),
    update(state, alpha, dt, player) {
      const b: BikeState | undefined = state.bike;
      group.visible = !!b;
      if (!b) return;
      clock += dt;
      observe(track, b, state.tick);
      sample(track, alpha, at);
      q.set(at.q.x, at.q.y, at.q.z, at.q.w);
      let x = at.x;
      let y = at.y;
      let z = at.z;
      const ride = b.mode === "lift" ? state.skier.lift : null;
      if (ride && ride.phase === "ride") {
        if (ride.kind === "gondola") {
          group.visible = false;
          return;
        }
        // HUNG off the carrier: the front tyre's top on the hook behind his
        // seat, the bike swung nose up under it.
        q.multiply(hangTurn);
        hook
          .set(0, -HANG.down, -HANG.back)
          .applyQuaternion(turn.set(at.q.x, at.q.y, at.q.z, at.q.w));
        off
          .set(LIFT_HOOK.x + BIKE_BB.x, LIFT_HOOK.y + BIKE_BB.y, LIFT_HOOK.z + BIKE_BB.z)
          .applyQuaternion(q);
        x += hook.x - off.x;
        y += hook.y - off.y;
        z += hook.z - off.z;
      } else if (b.mode === "lift") {
        // In the queue, stood on its wheels at his side.
        off.set(0.6, 0, 0.1).applyQuaternion(q);
        x += off.x;
        z += off.z;
        y = state.level.groundAt(x, z) + 0.355 + BIKE.com.y;
        const h = Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.z * q.z));
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), h);
      }
      built.root.position.set(x, y, z);
      built.root.quaternion.copy(q);
      shown = { x, y, z, q };
      built.pose(bikePose(b));
      // THE CALL while it lies waiting near him on foot.
      const near = Math.hypot(player.x - b.x, player.z - b.z);
      const waiting = !!b.afoot && !b.onIt && near < LIGHT_UP && near > BIKE.board.reach;
      call.visible = waiting;
      call.position.set(b.x, b.y + 1, b.z);
      (call.material as THREE.SpriteMaterial).opacity = 0.35 + 0.35 * Math.sin(clock * 4);
    },
    drawn: () => shown,
    dispose() {
      built.dispose();
      call.material.dispose();
    },
  };
}
