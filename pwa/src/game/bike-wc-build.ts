// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD CUP DOWNHILL BIKE, BUILT (`bike-wc-look.ts` its lines) — a
// factory race bike in code, smooth and detailed where the placeholder
// (`bike-view.ts`'s own) is faceted and plain: the carbon front triangle
// swept through its tubes and painted in the team's livery, the forked
// lower seat tube the shock stands in, the rear triangle on its two links,
// the coil shock with its piggyback and its spring worked between its
// seats, the dual-crown fork with gold stanchions, its lowers and arch,
// the fender over the front tyre, the knobbly tyres on their lathed
// casings, the spoked wheels, the rotors and four-piston calipers, the
// cassette, the derailleur and the chain running from the ring to the
// cog as the triangle moves, the chain guide and its bash plate, the
// cranks and the pinned flat pedals, the direct-mount stem, the riser bar,
// the grips, the levers (pulled as the brakes are) and the race's number
// plate.
//
// It is hung on the same NODES as the placeholder (`BIKE_NODES`) and posed
// off the same `BikePose`, so the rider, the lens and the lift hold it the
// same way; the rear triangle (the `swingarm` node) is placed on the
// engine's own axle path by the four-bar (`wcRear`), and its two links,
// the shock's top and the chain are nodes of their own posed with it.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BIKE_BB, type BikePose } from "@engine";

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
  type V3,
} from "./bike-look.ts";
import type { BikeNodes } from "./bike-view.ts";
import { BIKE_NODES } from "./bike-view.ts";
import {
  WC_FRAME as WF,
  WC_LIVERY as C,
  WC_PARTS,
  WC_PARTS as P,
  WC_PINS,
  WC_SHOCK_REST,
  wcRear,
} from "./bike-wc-look.ts";
import { aroundX, block, latheX, plain, plateTexture, ringX, rod, sweep } from "./bike-wc-parts.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3): V3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const scl = (a: V3, k: number): V3 => v(a.x * k, a.y * k, a.z * k);
const lerp = (a: V3, b: V3, t: number): V3 => add(a, scl(sub(b, a), t));
const zy = (p: { z: number; y: number }, x = 0): V3 => v(x, p.y, p.z);
const O: V3 = v(0, 0, 0);
/** The non-drive side, as an x sign: the brakes' side. */
const BRAKE = -DRIVE;

/** The materials a part is made of — every one a vertex-coloured,
 * haze-wrapped standard material, so each node's parts of one material
 * draw at once. */
const MATS = {
  paint: { roughness: 0.28, metalness: 0.15 },
  carbon: { roughness: 0.45, metalness: 0.1 },
  rubber: { roughness: 0.92, metalness: 0 },
  alloy: { roughness: 0.3, metalness: 0.85 },
  gold: { roughness: 0.22, metalness: 0.9 },
  chrome: { roughness: 0.15, metalness: 1 },
} as const;
type Mat = keyof typeof MATS;

/** The extra nodes the race bike is posed by beside `BIKE_NODES`. */
export type WcNodes = BikeNodes & {
  lowerLink: THREE.Object3D;
  upperLink: THREE.Object3D;
  shockTop: THREE.Object3D;
  coil: THREE.Object3D;
  chain: THREE.Object3D[];
  levers: THREE.Object3D[];
};

export type WcBike = {
  root: THREE.Group;
  nodes: WcNodes;
  pose(p: BikePose): void;
  dispose(): void;
};

/** THE RACE BIKE built, its nodes named as `BIKE_NODES`. */
export function buildWorldCup(haze: HazeUniforms): WcBike {
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];
  const M = {} as Record<Mat, THREE.Material>;
  for (const k of Object.keys(MATS) as Mat[]) {
    const m = hazeMaterial(
      new THREE.MeshStandardMaterial({ vertexColors: true, ...MATS[k] }),
      haze,
      "bike",
    );
    mats.push(m);
    M[k] = m;
  }
  const parts = new Map<THREE.Object3D, Map<Mat, THREE.BufferGeometry[]>>();
  const put = (node: THREE.Object3D, mat: Mat, ...gs: THREE.BufferGeometry[]): void => {
    let byMat = parts.get(node);
    if (!byMat) parts.set(node, (byMat = new Map()));
    const list = byMat.get(mat) ?? [];
    list.push(...gs);
    byMat.set(mat, list);
  };
  const node = (name: string, parent: THREE.Object3D, at: V3): THREE.Group => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(at.x, at.y, at.z);
    parent.add(g);
    return g;
  };

  const root = new THREE.Group();
  root.name = "bike-worldcup";
  const frame = node(BIKE_NODES.frame, root, BIKE_BB);

  // ── THE FRONT TRIANGLE ────────────────────────────────────────────────
  // The head tube, tapered (1.5″ at the foot), with the head badge's
  // accent at its front.
  put(
    frame,
    "paint",
    sweep({
      points: [add(HEAD_BOTTOM, scl(STEER_AXIS, -0.012)), add(HEAD_TOP, scl(STEER_AXIS, 0.008))],
      section: (u) => ({ w: 0.031 - 0.005 * u, h: 0.033 - 0.006 * u }),
      rings: 4,
      sides: 18,
      up: v(0, 0, 1),
      colour: (u, a) =>
        Math.abs(a - Math.PI / 2) < 0.6 && u > 0.25 && u < 0.75 ? C.accent : C.frame,
      caps: true,
    }),
  );
  // The top tube: off the head tube's top, falling and narrowing to the
  // seat tube's bend, a white stripe along its top.
  const topFrom = add(HEAD_TOP, v(0, -0.025, -0.012));
  put(
    frame,
    "paint",
    sweep({
      points: [topFrom, v(0, 0.56, 0.22), v(0, 0.49, 0.0), WF.topJoin],
      section: (u) => ({ w: 0.021 - 0.003 * u, h: 0.03 - 0.006 * u, square: 2.6 }),
      sides: 16,
      colour: (u, a) =>
        Math.abs(a - Math.PI / 2) < 0.35 && u > 0.1 && u < 0.85 ? C.graphic : C.frame,
    }),
  );
  // The down tube: deep and flat-sided, swept from the head tube's foot
  // to the shell, the team's accent band and a white panel on its flanks.
  const downFrom = add(HEAD_BOTTOM, v(0, 0.025, -0.01));
  put(
    frame,
    "paint",
    sweep({
      points: [downFrom, v(0, 0.42, 0.4), WF.downBelly, v(0, 0.14, 0.15), v(0, 0.035, 0.045)],
      section: (u) => ({ w: 0.028 + 0.004 * u, h: 0.042 - 0.006 * u, square: 3 }),
      rings: 32,
      sides: 18,
      colour: (u, a) => {
        const flank = Math.abs(Math.cos(a)) > 0.7;
        if (u > 0.22 && u < 0.3) return C.accent;
        if (flank && u > 0.32 && u < 0.62) return C.graphic;
        return C.frame;
      },
    }),
  );
  // The bottom bracket's shell (73 mm, its cups) and the chainstays' and
  // shock's bosses round it.
  put(frame, "paint", rod(v(-0.042, 0, 0), v(0.042, 0, 0), 0.026, 18, C.frame));
  put(frame, "alloy", rod(v(-0.048, 0, 0), v(-0.042, 0, 0), 0.023, 14, 0x2b2c30));
  put(frame, "alloy", rod(v(0.042, 0, 0), v(0.048, 0, 0), 0.023, 14, 0x2b2c30));
  // THE LOWER SEAT TUBE, forked either side of the shock from the shell to
  // the rocker's pivot, bridged over the shock's foot.
  const C2 = zy(WC_PINS.upperFrame);
  for (const s of [-1, 1]) {
    put(
      frame,
      "paint",
      sweep({
        points: [v(s * 0.03, 0.02, -0.015), v(s * 0.042, 0.13, -0.03), v(s * 0.04, C2.y, C2.z)],
        section: () => ({ w: 0.009, h: 0.022, square: 3 }),
        sides: 12,
        rings: 12,
        up: v(0, 0, 1),
        colour: () => C.frame,
      }),
    );
    // The rocker's pivot boss and the lower link's.
    put(frame, "paint", rod(v(s * 0.03, C2.y, C2.z), v(s * 0.05, C2.y, C2.z), 0.02, 14, C.frame));
    const A = zy(WC_PINS.lowerFrame);
    put(frame, "paint", rod(v(s * 0.028, A.y, A.z), v(s * 0.05, A.y, A.z), 0.018, 14, C.frame));
  }
  // The shock's tab over the shell, between the forks.
  const F = zy(WC_PINS.shockFrame);
  put(frame, "paint", block(v(0, F.y - 0.03, F.z), v(0.05, 0.07, 0.04), C.frame));
  put(frame, "alloy", rod(v(-0.026, F.y, F.z), v(0.026, F.y, F.z), 0.007, 8, 0x8a8f96));
  // THE UPPER SEAT TUBE: from the rocker's pivot up and back past the top
  // tube's join to the clamp, the short post and the saddle slammed.
  put(
    frame,
    "paint",
    sweep({
      points: [add(C2, v(0, -0.02, 0.01)), v(0, 0.34, -0.06), WF.topJoin, WF.seatClamp],
      section: (u) => ({ w: 0.024 - 0.004 * u, h: 0.026 - 0.004 * u }),
      sides: 16,
      colour: (u) => (u > 0.86 ? C.accent : C.frame),
      caps: true,
    }),
  );
  const post = add(WF.seatClamp, v(0, 0.05, -0.04));
  put(frame, "carbon", rod(WF.seatClamp, post, 0.0158, 12, C.carbon));
  // The saddle: a low, flat race saddle, its nose down a touch.
  const seat = new THREE.SphereGeometry(1, 14, 8);
  seat.scale(0.068, 0.022, 0.135);
  seat.rotateX(-0.08);
  seat.translate(post.x, post.y + 0.03, post.z - 0.04);
  put(frame, "carbon", plain(seat, 0x16171a));
  put(frame, "carbon", block(add(post, v(0, 0.012, -0.02)), v(0.02, 0.012, 0.09), 0x2a2b2e));
  // THE CHAIN GUIDE: the upper roller's backplate over the ring and the
  // bash guard under it.
  const ringX0 = DRIVE * 0.052;
  put(
    frame,
    "carbon",
    sweep({
      points: [v(ringX0 - DRIVE * 0.008, 0.06, -0.05), v(ringX0 - DRIVE * 0.008, 0.086, 0.0)],
      section: () => ({ w: 0.004, h: 0.012 }),
      rings: 4,
      sides: 6,
      colour: () => 0x1b1c1f,
    }),
  );
  const bash = [] as V3[];
  for (let i = 0; i <= 8; i++) {
    const a = -Math.PI * 0.15 - (i / 8) * Math.PI * 0.7;
    bash.push(v(ringX0 + DRIVE * 0.006, Math.sin(a) * 0.088, Math.cos(a) * 0.088));
  }
  put(
    frame,
    "carbon",
    sweep({
      points: bash,
      section: () => ({ w: 0.004, h: 0.012 }),
      sides: 6,
      colour: () => 0x1b1c1f,
    }),
  );
  // The rear brake's hose, under the down tube to the shell.
  put(
    frame,
    "rubber",
    sweep({
      points: [
        add(HEAD_BOTTOM, v(BRAKE * 0.03, 0.06, 0.02)),
        v(BRAKE * 0.034, 0.36, 0.36),
        v(BRAKE * 0.036, 0.12, 0.13),
        v(BRAKE * 0.04, 0.02, 0.0),
        v(BRAKE * 0.06, 0.08, -0.08),
      ],
      section: () => ({ w: 0.0028, h: 0.0028 }),
      sides: 5,
      colour: () => 0x101010,
    }),
  );

  // ── THE STEERED SIDE ──────────────────────────────────────────────────
  const bars = node(BIKE_NODES.bars, frame, STEER_AT);
  const rel = (p: V3): V3 => sub(p, STEER_AT);
  const axleRest = frontAxle(0, 0);
  const legs = [-1, 1].map((s) => s * L.forkHalf);
  const footOf = (x: number): V3 => rel(v(x, axleRest.y, axleRest.z));
  const upLeg = (x: number, k: number): V3 => add(footOf(x), scl(STEER_AXIS, k));
  /** How far up a leg from its foot the steer axis's point `p` is level. */
  const kAt = (p: V3): number => (rel(p).y - footOf(0).y) / STEER_AXIS.y;
  // The stanchions: gold, through both crowns.
  for (const x of legs) {
    put(bars, "gold", rod(upLeg(x, 0.36), upLeg(x, kAt(CROWN_TOP) + 0.02), 0.0185, 16, C.gold));
  }
  // The crowns: a forged bottom crown under the head tube and a slimmer top
  // crown over it, each from the steerer out round both stanchions.
  for (const [c, deep] of [
    [CROWN_TOP, 0.022],
    [CROWN_BOTTOM, 0.034],
  ] as [V3, number][]) {
    const k = kAt(c);
    const mid = upLeg(0, k);
    const steer = rel(c);
    put(
      bars,
      "alloy",
      sweep({
        points: [
          upLeg(legs[0] - 0.026, k),
          add(lerp(mid, steer, 0.6), v(0, 0, 0)),
          upLeg(legs[1] + 0.026, k),
        ],
        section: () => ({ w: 0.024, h: deep / 2, square: 3 }),
        rings: 12,
        sides: 10,
        up: STEER_AXIS,
        colour: () => 0x18191c,
        caps: true,
      }),
    );
    for (const x of legs) {
      put(bars, "alloy", rod(upLeg(x, k - deep / 2), upLeg(x, k + deep / 2), 0.026, 14, 0x18191c));
    }
  }
  // The steerer through the head tube.
  put(bars, "alloy", rod(rel(CROWN_BOTTOM), rel(CROWN_TOP), 0.0145, 10, 0x18191c));
  // THE DIRECT-MOUNT STEM on the top crown and the riser bar in it.
  const bar = rel(BAR_MIDDLE);
  const stemFoot = rel(add(CROWN_TOP, scl(STEER_AXIS, 0.012)));
  put(
    bars,
    "alloy",
    block(lerp(stemFoot, bar, 0.5), v(0.07, 0.03, 0.06), 0x1a1b1e, v(-0.25, 0, 0)),
  );
  put(bars, "alloy", rod(add(bar, v(-0.035, 0, 0)), add(bar, v(0.035, 0, 0)), 0.021, 14, 0x1a1b1e));
  const [gl, gr] = GRIPS.map(rel);
  for (const g of [gl, gr]) {
    const s = Math.sign(g.x);
    const inner = add(g, v(-s * (L.grip / 2), 0, 0));
    const outer = add(g, v(s * (L.grip / 2), 0, 0));
    // The bar: out of the clamp, up its rise and back through its sweep.
    put(
      bars,
      "alloy",
      sweep({
        points: [
          add(bar, v(s * 0.02, 0, 0)),
          add(bar, v(s * 0.1, 0.004, 0)),
          add(inner, v(-s * 0.06, -0.002, 0.012)),
          inner,
        ],
        section: () => ({ w: 0.0125, h: 0.0125 }),
        rings: 12,
        sides: 10,
        up: v(0, 0, 1),
        colour: () => 0x1a1b1e,
      }),
    );
    // The grip, its lock-on collar in the accent, the bar's end plug.
    put(bars, "rubber", rod(inner, outer, 0.0165, 14, 0x1d1e20));
    put(bars, "alloy", rod(add(inner, v(-s * 0.012, 0, 0)), inner, 0.0175, 12, C.anodised));
    put(bars, "alloy", rod(outer, add(outer, v(s * 0.004, 0, 0)), 0.0168, 12, C.anodised));
    // The brake's master cylinder and its reservoir, clamped inboard.
    const mc = add(inner, v(-s * 0.03, 0.006, 0.006));
    put(
      bars,
      "alloy",
      rod(add(mc, v(-s * 0.012, 0, 0)), add(mc, v(s * 0.012, 0, 0)), 0.018, 12, 0x202125),
    );
    put(bars, "alloy", block(add(mc, v(0, 0.016, -0.006)), v(0.03, 0.016, 0.026), 0x202125));
    // A hose off it, looped down to the crown.
    put(
      bars,
      "rubber",
      sweep({
        points: [
          add(mc, v(0, -0.006, 0.014)),
          add(mc, v(-s * 0.04, -0.06, 0.08)),
          add(rel(CROWN_TOP), v(s * 0.05, 0, 0.04)),
          add(rel(CROWN_BOTTOM), v(s * 0.04, -0.02, 0.03)),
        ],
        section: () => ({ w: 0.0028, h: 0.0028 }),
        sides: 5,
        colour: () => 0x101010,
      }),
    );
  }
  // The shifter, under the bar on the drive side.
  put(
    bars,
    "alloy",
    block(
      add(DRIVE < 0 ? gl : gr, v(-DRIVE * 0.045, -0.02, 0.005)),
      v(0.025, 0.018, 0.03),
      0x202125,
    ),
  );
  // THE BRAKE LEVERS, each on a pivot of its own (pulled as `pose.front`
  // and `pose.rear` say): the blade reaching out over the grip.
  const levers: THREE.Group[] = [];
  for (const g of [gl, gr]) {
    const s = Math.sign(g.x);
    const pivot = add(g, v(-s * (L.grip / 2 + 0.022), -0.004, 0.022));
    const lever = node(`bike_lever_${s < 0 ? "l" : "r"}`, bars, pivot);
    put(
      lever,
      "alloy",
      sweep({
        points: [
          O,
          v(s * 0.03, -0.004, 0.012),
          v(s * 0.07, -0.012, 0.016),
          v(s * 0.095, -0.02, 0.01),
        ],
        section: () => ({ w: 0.004, h: 0.007, square: 3 }),
        rings: 10,
        sides: 6,
        colour: () => 0x26272b,
      }),
    );
    levers.push(lever);
  }
  // THE NUMBER PLATE, cable-tied to the bar in front of the stem.
  const tex = plateTexture(P.number, C.accent);
  if (tex) texs.push(tex);
  const plateMat = hazeMaterial(
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, side: THREE.DoubleSide }),
    haze,
    "bike",
  );
  mats.push(plateMat);
  const plateGeo = new THREE.PlaneGeometry(P.plate.width, P.plate.height);
  const plate = new THREE.Mesh(plateGeo, plateMat);
  plate.position.set(bar.x, bar.y - 0.04, bar.z + 0.06);
  plate.rotation.x = -0.35;
  plate.castShadow = true;
  bars.add(plate);

  // ── THE FORK'S LOWERS, the arch, the fender and the front wheel ───────
  const fork = node(BIKE_NODES.fork, bars, O);
  for (const x of legs) {
    put(
      fork,
      "paint",
      sweep({
        points: [upLeg(x, -0.025), upLeg(x, 0.2), upLeg(x, 0.42)],
        section: (u) => ({ w: 0.024 + 0.002 * u, h: 0.025 + 0.002 * u }),
        rings: 10,
        sides: 16,
        up: v(0, 0, 1),
        colour: (u) => (u > 0.45 && u < 0.62 ? C.accent : 0x16171a),
        caps: true,
      }),
    );
    // The seal's wiper at the lower's top, and the axle's pinch lug.
    put(fork, "rubber", rod(upLeg(x, 0.415), upLeg(x, 0.432), 0.021, 14, 0x0e0e0f));
    put(
      fork,
      "alloy",
      block(
        add(upLeg(x, -0.005), v(Math.sign(x) * 0.012, 0, -0.018)),
        v(0.012, 0.04, 0.03),
        0x16171a,
      ),
    );
  }
  // The arch, bridging the legs behind the tyre.
  const archK = 0.34;
  put(
    fork,
    "paint",
    sweep({
      points: [
        add(upLeg(legs[0], archK), v(0, 0, -0.02)),
        add(upLeg(0, archK + 0.05), v(0, 0, -0.045)),
        add(upLeg(legs[1], archK), v(0, 0, -0.02)),
      ],
      section: () => ({ w: 0.014, h: 0.012, square: 3 }),
      rings: 12,
      sides: 10,
      up: STEER_AXIS,
      colour: () => 0x16171a,
    }),
  );
  // The thru-axle.
  put(fork, "alloy", rod(footOf(legs[0] - 0.02), footOf(legs[1] + 0.02), 0.01, 10, 0x2a2b2f));
  // The front fender: a short plastic guard over the tyre, off the arch.
  const fender: V3[] = [];
  const fr = L.rimF + L.tyre + 0.03;
  for (let i = 0; i <= 10; i++) {
    const a = 0.25 + (i / 10) * 1.25;
    fender.push(add(footOf(0), v(0, Math.sin(a) * fr, Math.cos(a) * fr * (i > 5 ? 1 : 1))));
  }
  put(
    fork,
    "carbon",
    sweep({
      points: fender,
      section: (u) => ({ w: 0.036 + 0.008 * u, h: 0.003 }),
      sides: 8,
      up: v(0, 0, 0),
      colour: (u) => (u > 0.4 && u < 0.6 ? C.accent : 0x141416),
    }),
  );
  // The front caliper on its post mount behind the non-drive leg.
  const calF = calliperAt(P.rotorF, 2.35);
  put(
    fork,
    "alloy",
    block(add(footOf(BRAKE * 0.058), calF.at), v(0.03, 0.045, 0.06), 0x1d1e21, v(calF.turn, 0, 0)),
  );
  const wheelF = node(BIKE_NODES.wheelF, fork, footOf(0));
  wheel(wheelF, L.rimF, P.rotorF, true);

  // ── THE REAR TRIANGLE on its links ────────────────────────────────────
  const AX0 = v(0, REAR_REST.y, REAR_REST.z);
  const swing = node(BIKE_NODES.swingarm, frame, AX0);
  const tri = (p: V3): V3 => sub(p, AX0);
  const B0 = zy(WC_PINS.lowerPin);
  const D0 = zy(WC_PINS.upperPin);
  for (const s of [-1, 1]) {
    const drive = s === DRIVE;
    const out = WF.dropout;
    // The chainstay: from the dropout forward and up to the lower pin's
    // yoke, the drive side's kinked up over the ring.
    put(
      swing,
      "paint",
      sweep({
        points: [
          v(s * out, 0.012, 0.02),
          v(s * 0.07, drive ? 0.085 : 0.06, 0.16),
          v(s * 0.055, B0.y - AX0.y - 0.035, B0.z - AX0.z - 0.08),
          v(s * 0.034, B0.y - AX0.y, B0.z - AX0.z),
        ],
        section: (u) => ({ w: 0.011 + 0.004 * u, h: 0.016 + 0.01 * u, square: 2.6 }),
        rings: 18,
        sides: 12,
        colour: (u) => (u < 0.14 ? C.accent : C.frame),
      }),
    );
    // The seatstay: from the dropout up to the upper pin.
    put(
      swing,
      "paint",
      sweep({
        points: [
          v(s * out, 0.018, -0.005),
          v(s * 0.068, 0.17, 0.1),
          v(s * 0.036, D0.y - AX0.y, D0.z - AX0.z),
        ],
        section: (u) => ({ w: 0.01 + 0.003 * u, h: 0.014 + 0.006 * u, square: 2.6 }),
        rings: 16,
        sides: 12,
        colour: (u) => (u > 0.5 && u < 0.62 ? C.graphic : C.frame),
      }),
    );
    // The dropout plate and the pins' bosses.
    put(swing, "paint", block(v(s * out, 0.008, 0.002), v(0.008, 0.05, 0.05), C.frame));
    put(
      swing,
      "alloy",
      rod(tri(v(s * 0.024, B0.y, B0.z)), tri(v(s * 0.046, B0.y, B0.z)), 0.012, 10, 0x8a8f96),
    );
    put(
      swing,
      "alloy",
      rod(tri(v(s * 0.024, D0.y, D0.z)), tri(v(s * 0.046, D0.y, D0.z)), 0.011, 10, 0x8a8f96),
    );
  }
  // The yoke across the chainstays and the bridge across the seatstays.
  put(
    swing,
    "paint",
    rod(
      tri(v(-0.04, B0.y - 0.02, B0.z - 0.05)),
      tri(v(0.04, B0.y - 0.02, B0.z - 0.05)),
      0.016,
      12,
      C.frame,
    ),
  );
  put(
    swing,
    "paint",
    rod(
      tri(v(-0.045, D0.y - 0.05, D0.z - 0.04)),
      tri(v(0.045, D0.y - 0.05, D0.z - 0.04)),
      0.012,
      12,
      C.frame,
    ),
  );
  // The thru-axle, the derailleur's hanger and its cage with the jockeys.
  put(swing, "alloy", rod(v(-0.09, 0, 0), v(0.09, 0, 0), 0.0095, 10, 0x2a2b2f));
  const der = v(DRIVE * 0.09, -0.06, 0.005);
  put(
    swing,
    "alloy",
    block(add(der, v(0, 0.03, -0.005)), v(0.016, 0.05, 0.03), 0x1d1e21, v(0.3, 0, 0)),
  );
  put(swing, "alloy", block(add(der, v(0, -0.02, 0.01)), v(0.006, 0.075, 0.03), 0x26272b));
  for (const y of [0, -0.055]) {
    put(
      swing,
      "alloy",
      rod(add(der, v(-0.006, y, 0.01)), add(der, v(0.006, y, 0.01)), 0.012, 12, 0x3a3c40),
    );
  }
  // The rear caliper on the non-drive chainstay.
  const calR = calliperAt(P.rotorR, 0.9);
  put(
    swing,
    "alloy",
    block(add(v(BRAKE * 0.06, 0, 0), calR.at), v(0.03, 0.045, 0.06), 0x1d1e21, v(calR.turn, 0, 0)),
  );
  const wheelR = node(BIKE_NODES.wheelR, swing, O);
  wheel(wheelR, L.rimR, P.rotorR, false);
  // The cassette: seven close cogs on the drive side.
  P.cogs.forEach((r, i) => {
    put(
      wheelR,
      "alloy",
      ringX(DRIVE * (0.032 + i * 0.0042), 0.017, r, 0.0018, 28, i % 2 ? 0x7d8288 : 0x9aa0a6),
    );
  });

  // ── THE LINKS ─────────────────────────────────────────────────────────
  const A = zy(WC_PINS.lowerFrame);
  const lowerLink = node("bike_link_lower", frame, A);
  for (const s of [-1, 1]) {
    put(
      lowerLink,
      "paint",
      sweep({
        points: [v(s * 0.04, 0, 0), v(s * 0.04, B0.y - A.y, B0.z - A.z)],
        section: () => ({ w: 0.005, h: 0.017, square: 3 }),
        rings: 2,
        sides: 10,
        up: v(1, 0, 0),
        colour: () => C.accent,
        caps: true,
      }),
    );
  }
  const Cp = zy(WC_PINS.upperFrame);
  const upperLink = node("bike_link_upper", frame, Cp);
  const E0 = zy(WC_PINS.shockLink);
  for (const s of [-1, 1]) {
    // The rocker: a plate from its pivot back to the seatstays' pin and
    // forward to the shock's top eye.
    put(
      upperLink,
      "paint",
      sweep({
        points: [
          v(s * 0.032, D0.y - Cp.y, D0.z - Cp.z),
          v(s * 0.036, 0.012, 0.0),
          v(s * 0.032, E0.y - Cp.y, E0.z - Cp.z),
        ],
        section: () => ({ w: 0.006, h: 0.02, square: 3 }),
        rings: 12,
        sides: 10,
        up: v(1, 0, 0),
        colour: () => C.frame,
        caps: true,
      }),
    );
  }
  put(
    upperLink,
    "alloy",
    rod(
      v(-0.034, E0.y - Cp.y, E0.z - Cp.z),
      v(0.034, E0.y - Cp.y, E0.z - Cp.z),
      0.006,
      8,
      0x8a8f96,
    ),
  );

  // ── THE SHOCK, built up +z from its frame eye ─────────────────────────
  const shock = node(BIKE_NODES.shock, frame, F);
  // The bottom eye, the chromed shaft and its spring seat.
  put(shock, "alloy", rod(v(-0.012, 0, 0), v(0.012, 0, 0), 0.011, 10, 0x2a2b2f));
  put(shock, "chrome", rod(O, v(0, 0, 0.13), 0.0064, 10, 0xdadde0));
  put(shock, "alloy", rod(v(0, 0, 0.022), v(0, 0, 0.03), 0.034, 18, 0x1d1e21));
  // The body, the reservoir beside it and the top eye: carried by the top.
  const shockTop = node("bike_shock_top", shock, v(0, 0, WC_SHOCK_REST));
  const body = 0.12;
  put(shockTop, "alloy", rod(v(0, 0, -body), v(0, 0, -0.012), 0.0175, 16, 0x1d1e21));
  put(shockTop, "alloy", rod(v(0, 0, -body - 0.008), v(0, 0, -body + 0.002), 0.034, 18, 0x1d1e21));
  put(
    shockTop,
    "alloy",
    rod(v(BRAKE * 0.03, 0.006, -0.1), v(BRAKE * 0.03, 0.006, -0.02), 0.014, 14, C.anodised),
  );
  put(shockTop, "alloy", block(v(BRAKE * 0.016, 0.006, -0.018), v(0.034, 0.02, 0.022), 0x1d1e21));
  put(shockTop, "alloy", rod(v(-0.012, 0, 0), v(0.012, 0, 0), 0.011, 10, 0x2a2b2f));
  // The coil: a helix between the seats, laid down a unit's length and
  // stretched to the seats' gap.
  const coil = node("bike_shock_coil", shock, v(0, 0, 0.03));
  const helix: V3[] = [];
  const turns = 7.5;
  for (let i = 0; i <= turns * 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    helix.push(v(Math.cos(a) * 0.027, Math.sin(a) * 0.027, i / (turns * 14)));
  }
  put(
    coil,
    "paint",
    sweep({
      points: helix,
      section: () => ({ w: 0.0042, h: 0.0042 }),
      rings: 210,
      sides: 6,
      up: v(0, 0, 1),
      colour: () => C.spring,
    }),
  );

  // ── THE CRANKS, the ring and the pedals ───────────────────────────────
  const cranks = node(BIKE_NODES.cranks, frame, O);
  put(cranks, "alloy", ringX(ringX0, 0.04, P.ring - 0.004, 0.004, 36, 0x1b1c1f));
  const tooth = block(v(ringX0, P.ring - 0.001, 0), v(0.0035, 0.007, 0.006), 0x1b1c1f);
  put(cranks, "alloy", ...aroundX(tooth, 36));
  put(cranks, "alloy", rod(v(-0.06, 0, 0), v(0.06, 0, 0), 0.012, 10, 0x2a2b2f));
  const pedals: THREE.Group[] = [];
  for (const i of [0, 1]) {
    const s = i ? 1 : -1;
    const dir = i ? -1 : 1;
    const end = v(s * 0.074, 0, dir * L.crank);
    put(
      cranks,
      "alloy",
      sweep({
        points: [v(s * 0.062, 0, 0), v(s * 0.07, 0, dir * L.crank * 0.5), end],
        section: (u) => ({ w: 0.008, h: 0.017 - 0.005 * u, square: 3 }),
        rings: 6,
        sides: 10,
        up: v(0, 1, 0),
        colour: () => 0x1b1c1f,
        caps: true,
      }),
    );
    const pedal = node(i ? BIKE_NODES.pedalR : BIKE_NODES.pedalL, cranks, v(s * L.q, 0, end.z));
    put(pedal, "alloy", rod(v(-s * (L.q - 0.078), 0, 0), O, 0.007, 8, 0x8a8f96));
    // A thin, wide platform, concave, its pins standing out of it.
    put(pedal, "alloy", block(O, v(L.pedal.width, L.pedal.thick * 0.7, L.pedal.length), 0x1d1e21));
    put(
      pedal,
      "alloy",
      block(v(0, 0, 0), v(L.pedal.width * 0.6, L.pedal.thick, L.pedal.length * 0.15), C.anodised),
    );
    for (const px of [-0.04, 0.04]) {
      for (const pz of [-0.045, -0.015, 0.015, 0.045]) {
        put(pedal, "chrome", rod(v(px, -0.012, pz), v(px, 0.012, pz), 0.0022, 5, 0xbfc3c7));
      }
    }
    pedals.push(pedal);
  }

  // ── THE CHAIN: three strands, laid each pose from the ring to the cog ─
  const chain: THREE.Mesh[] = [];
  const strand = rod(v(0, 0, 0), v(0, 1, 0), 0.0035, 6, 0x4b4d52);
  const chainGeo = strand;
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(chainGeo, M.alloy);
    m.castShadow = true;
    frame.add(m);
    chain.push(m);
  }

  /** A wheel about +x at its node: the rim, the spokes laced two-cross,
   * the hub, the rotor and the knobbly tyre. */
  function wheel(at: THREE.Object3D, rim: number, rotor: number, front: boolean): void {
    const tyre = L.tyre;
    // The casing's section from bead to bead, a flattened round with
    // square shoulders: a downhill tyre's 2.5″.
    const casing: [number, number][] = [];
    for (let i = 0; i <= 16; i++) {
      const a = -Math.PI / 2 + (i / 16) * Math.PI;
      const x = Math.sin(a) * 0.032;
      const r = rim + 0.004 + Math.cos(a) ** 0.7 * (tyre - 0.004);
      casing.push([r, x]);
    }
    put(at, "rubber", latheX(casing, 48, 0x1c1c1d));
    // The knobs: a row of paired centre blocks, ramped ones beside them
    // and tall, angled shoulder blocks — the class's open tread.
    const knobs = front ? 40 : 44;
    const base = rim + tyre - 0.002;
    const knobGeo: THREE.BufferGeometry[] = [];
    for (let i = 0; i < knobs; i++) {
      const a = (i / knobs) * Math.PI * 2;
      const set: THREE.BufferGeometry[] = [];
      if (i % 2 === 0) {
        set.push(block(v(-0.009, base + 0.004, 0), v(0.012, 0.008, 0.01), 0x1c1c1d));
        set.push(block(v(0.009, base + 0.004, 0), v(0.012, 0.008, 0.01), 0x1c1c1d));
      } else {
        set.push(block(v(0, base + 0.004, 0), v(0.016, 0.008, 0.009), 0x1c1c1d));
        set.push(
          block(v(-0.022, base - 0.002, 0.004), v(0.008, 0.008, 0.012), 0x1c1c1d, v(0, 0, -0.5)),
        );
        set.push(
          block(v(0.022, base - 0.002, 0.004), v(0.008, 0.008, 0.012), 0x1c1c1d, v(0, 0, 0.5)),
        );
      }
      set.push(block(v(-0.031, base - 0.014, 0), v(0.008, 0.011, 0.013), 0x1c1c1d, v(0, 0, -1.05)));
      set.push(block(v(0.031, base - 0.014, 0), v(0.008, 0.011, 0.013), 0x1c1c1d, v(0, 0, 1.05)));
      for (const g of set) {
        g.rotateX(a);
        knobGeo.push(g);
      }
    }
    put(at, "rubber", ...knobGeo);
    // The rim: a wide, deep alloy hoop, a white decal on each side.
    put(
      at,
      "alloy",
      latheX(
        [
          [rim - 0.022, -0.012],
          [rim - 0.006, -0.016],
          [rim + 0.004, -0.017],
          [rim + 0.004, 0.017],
          [rim - 0.006, 0.016],
          [rim - 0.022, 0.012],
          [rim - 0.022, -0.012],
        ],
        48,
        0x18191b,
      ),
    );
    for (const s of [-1, 1]) {
      put(at, "paint", ringX(s * 0.0165, rim - 0.016, rim - 0.008, 0.0008, 48, C.graphic));
    }
    // The hub: its shell and flanges, the end caps in the accent.
    put(
      at,
      "alloy",
      latheX(
        [
          [0.012, -0.075],
          [0.02, -0.07],
          [0.028, -0.044],
          [0.03, -0.04],
          [0.02, -0.036],
          [0.018, 0],
          [0.02, 0.036],
          [0.03, 0.04],
          [0.028, 0.044],
          [0.02, 0.07],
          [0.012, 0.075],
        ],
        20,
        C.anodised,
      ),
    );
    // The spokes: 32, laced two-cross off both flanges.
    const spokes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < L.spokes; i++) {
      const s = i % 2 ? 1 : -1;
      const a = (i / L.spokes) * Math.PI * 2;
      const lead = ((i >> 1) % 2 ? 1 : -1) * ((2 * Math.PI * 2) / L.spokes);
      const from = v(s * 0.04, Math.cos(a) * 0.027, Math.sin(a) * 0.027);
      const to = v(s * 0.008, Math.cos(a + lead) * (rim - 0.02), Math.sin(a + lead) * (rim - 0.02));
      spokes.push(rod(from, to, 0.001, 4, 0x3a3c40));
    }
    put(at, "chrome", ...spokes);
    // The rotor and its spider, on the brake side.
    const rx = BRAKE * 0.05;
    put(at, "chrome", ringX(rx, rotor - 0.017, rotor, 0.0019, 40, 0xb7bcc1));
    const arm = rod(v(rx, 0.02, 0), v(rx, rotor - 0.014, 0.01), 0.004, 4, 0x2a2b2f);
    put(at, "alloy", ...aroundX(arm, 6));
  }

  /** Where a caliper sits on its rotor at angle `a` about the axle (0
   * forward, π/2 up), and its turn there. */
  function calliperAt(rotor: number, a: number): { at: V3; turn: number } {
    return {
      at: v(0, Math.sin(a) * (rotor - 0.008), Math.cos(a) * (rotor - 0.008)),
      turn: -a + Math.PI / 2,
    };
  }

  // Each node's parts merged a material at a time.
  const geos: THREE.BufferGeometry[] = [chainGeo];
  for (const [n, byMat] of parts) {
    for (const [mat, list] of byMat) {
      const g = mergeGeometries(list, false);
      for (const l of list) l.dispose();
      if (!g) continue;
      geos.push(g);
      const mesh = new THREE.Mesh(g, M[mat]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      n.add(mesh);
    }
  }

  const nodes: WcNodes = {
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
    lowerLink,
    upperLink,
    shockTop,
    coil,
    chain,
    levers,
  };
  return {
    root,
    nodes,
    pose: (p) => poseWorldCup(nodes, p),
    dispose() {
      for (const g of geos) g.dispose();
      plateGeo.dispose();
      for (const m of mats) m.dispose();
      for (const t of texs) t.dispose();
    },
  };
}

const axisSteer = new THREE.Vector3(STEER_AXIS.x, STEER_AXIS.y, STEER_AXIS.z);
const zAxis = new THREE.Vector3(0, 0, 1);
const yAxis = new THREE.Vector3(0, 1, 0);
const aim = new THREE.Vector3();
const q = new THREE.Quaternion();
const ringPt = new THREE.Vector3();
const cogPt = new THREE.Vector3();
const AX0 = { z: REAR_REST.z, y: REAR_REST.y };

/** A point of the rear triangle (stated at rest, from the bottom bracket)
 * where the triangle stands at `rear`. */
function onTriangle(p: { z: number; y: number }, turn: number, axle: { z: number; y: number }) {
  // three's rotation.x by `turn`: y' = y cos − z sin, z' = y sin + z cos.
  const dy = p.y - AX0.y;
  const dz = p.z - AX0.z;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  return { y: axle.y + dy * c - dz * s, z: axle.z + dy * s + dz * c };
}

/** POSE the race bike's nodes off the engine's `pose`. */
export function poseWorldCup(n: WcNodes, pose: BikePose): void {
  n.bars.quaternion.setFromAxisAngle(axisSteer, pose.steer);
  n.fork.position.set(STEER_AXIS.x * pose.fork, STEER_AXIS.y * pose.fork, STEER_AXIS.z * pose.fork);
  n.wheelF.rotation.set(pose.frontSpin, 0, 0);
  const r = wcRear(pose.shock);
  n.swingarm.position.set(0, r.axle.y, r.axle.z);
  n.swingarm.rotation.set(r.turn, 0, 0);
  n.wheelR.rotation.set(pose.rearSpin, 0, 0);
  n.lowerLink.rotation.set(r.lowerTurn, 0, 0);
  n.upperLink.rotation.set(r.upperTurn, 0, 0);
  // The shock aimed from its frame eye at the rocker's eye; its top slid
  // to the eyes' length, the coil stretched between its seats.
  const F = WC_PINS.shockFrame;
  aim.set(0, r.shockTop.y - F.y, r.shockTop.z - F.z).normalize();
  n.shock.quaternion.copy(q.setFromUnitVectors(zAxis, aim));
  n.shockTop.position.set(0, 0, r.shockLength);
  n.coil.scale.set(1, 1, Math.max(0.01, r.shockLength - 0.12 - 0.03));
  n.cranks.rotation.set(pose.crank, 0, 0);
  n.pedalL.rotation.set(-pose.crank, 0, 0);
  n.pedalR.rotation.set(-pose.crank, 0, 0);
  // The brakes' levers drawn back toward the grips as they are pulled.
  const pulls = DRIVE < 0 ? [pose.rear, pose.front] : [pose.front, pose.rear];
  n.levers.forEach((l, i) => l.rotation.set(0, (i ? -1 : 1) * 0.3 * pulls[i], 0));
  // THE CHAIN: the ring's top and foot to the cog's (top) and the lower
  // jockey's, on the drive side.
  const x = DRIVE * 0.052;
  const cog = onTriangle(AX0, r.turn, r.axle);
  const jockey = onTriangle({ y: AX0.y - 0.115, z: AX0.z + 0.015 }, r.turn, r.axle);
  lay(n.chain[0], ringPt.set(x, WC_PARTS.ring, 0), cogPt.set(x, cog.y + COG, cog.z));
  lay(n.chain[1], ringPt.set(x, -WC_PARTS.ring, 0), cogPt.set(x, jockey.y, jockey.z));
  const up = onTriangle({ y: AX0.y - 0.06, z: AX0.z + 0.015 }, r.turn, r.axle);
  lay(n.chain[2], ringPt.set(x, jockey.y, jockey.z), cogPt.set(x, up.y, up.z));
}

/** The cog the chain runs on (the cassette's middle), m. */
const COG = WC_PARTS.cogs[3];

/** A unit strand (0 to 1 up its y) laid from `a` to `b`. */
function lay(m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3): void {
  m.position.copy(a);
  aim.copy(b).sub(a);
  const len = aim.length();
  m.quaternion.copy(q.setFromUnitVectors(yAxis, aim.normalize()));
  m.scale.set(1, len, 1);
}
