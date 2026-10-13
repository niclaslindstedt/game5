// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE'S MOVING PARTS (`bike-build.ts` builds the frame and
// the fork and hands these the nodes they hang on): the swingarm with its
// boxed stays, yoke, dropouts, caliper, derailleur and chain; the coil
// shock and its piggyback; the cranks, the ring, the bash guard and the flat
// pedals; and a wheel — the rim, the knobbly tyre, the hub, the spokes, the
// drilled rotor and, behind, the cassette. In the engine's body frame.
//
// Three only; it reads no state.

import * as THREE from "three";

import { BIKE_LOOK as L, DRIVE, shockAt } from "./bike-look.ts";
import { block, circle, helix, lathe, loft, plate, ring, rod, type V3 } from "./bike-kit.ts";
import type { BikePaint } from "./bike-build.ts";

/** How a part is put on its node in a material (`bike-build.ts`' merge). */
export type Put = (node: THREE.Object3D, mat: BikePaint, g: THREE.BufferGeometry) => void;

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3): V3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const X: V3 = v(1, 0, 0);
const Z: V3 = v(0, 0, 1);

/** The shock's length built (extended), m — `bike-view.ts`' too. */
const SHOCK_REST = shockAt(0).length;

/** Mirror-safe: a geometry scaled by −1 on one axis turned inside out. */
export function flipIf(g: THREE.BufferGeometry, flip: boolean): THREE.BufferGeometry {
  if (!flip) return g;
  const idx = g.index;
  if (idx) {
    const a = idx.array as Uint16Array | Uint32Array;
    for (let i = 0; i < a.length; i += 3) [a[i + 1], a[i + 2]] = [a[i + 2], a[i + 1]];
  }
  g.computeVertexNormals();
  return g;
}

/** THE SWINGARM, origin the main pivot; the rear axle at `axle`. */
export function buildSwingarm(sw: THREE.Object3D, axle: V3, put: Put): void {
  const eye = sub(L.shockRear, L.pivot);
  const drop = 0.072;
  for (const s of [-1, 1]) {
    // The chainstay, boxed, from the pivot's boss to the dropout.
    put(
      sw,
      "frame",
      loft(
        [
          v(s * 0.05, -0.002, 0.012),
          v(s * 0.06, -0.05, -0.14),
          v(s * drop, axle.y + 0.012, axle.z + 0.035),
        ],
        (u) => ({
          w: lerp(0.016, 0.011, u),
          h: lerp(0.038, 0.022, u),
        }),
        { sides: 16, square: 3, side: X },
      ),
    );
    // The seatstay, from the dropout up to the yoke.
    put(
      sw,
      "frame",
      loft(
        [
          v(s * drop, axle.y + 0.03, axle.z + 0.012),
          v(s * 0.064, 0.02, -0.24),
          v(s * 0.047, eye.y - 0.012, eye.z - 0.02),
        ],
        (u) => ({
          w: 0.009,
          h: lerp(0.014, 0.017, u),
        }),
        { sides: 14, square: 2.6, side: X },
      ),
    );
    // The yoke: an arm either side of the seat tube up to the shock's eye.
    put(
      sw,
      "frame",
      loft(
        [v(s * 0.05, 0.0, -0.012), v(s * 0.048, 0.1, -0.034), v(s * 0.046, eye.y, eye.z)],
        (u) => ({ w: 0.008, h: lerp(0.026, 0.017, u) }),
        { sides: 14, square: 3, side: X },
      ),
    );
    // The dropout.
    put(
      sw,
      "frame",
      plate(
        [
          [axle.z + 0.035, axle.y + 0.0],
          [axle.z + 0.01, axle.y + 0.04],
          [axle.z - 0.025, axle.y + 0.015],
          [axle.z - 0.02, axle.y - 0.022],
          [axle.z + 0.015, axle.y - 0.025],
        ],
        0.012,
        { x: s * drop, bevel: 0.003 },
      ),
    );
  }
  // The pivot's boss and the eye's bolt, the bridge behind the seat tube.
  put(sw, "frame", rod(v(-0.06, 0, 0), v(0.06, 0, 0), 0.022, 18));
  put(sw, "black", rod(v(-0.058, eye.y, eye.z), v(0.058, eye.y, eye.z), 0.009, 12));
  put(
    sw,
    "frame",
    loft(
      [v(-0.05, 0.03, -0.07), v(0, 0.035, -0.078), v(0.05, 0.03, -0.07)],
      { w: 0.012, h: 0.012 },
      { sides: 12, side: Z },
    ),
  );
  put(sw, "alloy", rod(v(-0.085, axle.y, axle.z), v(0.085, axle.y, axle.z), 0.0075, 10));

  // The rear caliper on the rotor's side, mounted to the seatstay.
  const rotorX = -DRIVE * 0.055;
  put(sw, "black", block(add(axle, v(rotorX + 0.008, 0.085, 0.035)), 0.032, 0.06, 0.05));
  // The derailleur (the drive side): its body off the hanger, the cage.
  const dx = DRIVE * 0.085;
  put(sw, "black", block(add(axle, v(dx, -0.025, -0.01)), 0.022, 0.05, 0.035));
  put(
    sw,
    "black",
    plate(
      [
        [axle.z + 0.01, axle.y - 0.035],
        [axle.z + 0.035, axle.y - 0.06],
        [axle.z + 0.04, axle.y - 0.1],
        [axle.z + 0.01, axle.y - 0.11],
        [axle.z - 0.01, axle.y - 0.06],
      ],
      0.006,
      { x: DRIVE * 0.06, bevel: 0.0015 },
    ),
  );
  for (const k of [0.045, 0.1]) {
    put(
      sw,
      "black",
      plate(circle(0.016, 14, axle.z + 0.022 + (k - 0.045) * 0.25, axle.y - k), 0.006, {
        x: DRIVE * 0.055,
        bevel: 0.0015,
      }),
    );
  }
  // The chain: the top run ring to cog, the bottom run under the cage.
  const cx = DRIVE * 0.052;
  const ringC = sub(v(cx, 0, 0), L.pivot);
  const chain = (a: V3, b: V3): void =>
    put(
      sw,
      "black",
      loft([a, b], { w: 0.0035, h: 0.006 }, { sides: 6, rings: 1, straight: true, side: X }),
    );
  chain(add(ringC, v(0, 0.073, 0.002)), add(axle, v(cx, 0.042, 0.004)));
  chain(add(ringC, v(0, -0.073, 0.002)), add(axle, v(cx, -0.11, 0.022)));
  chain(add(axle, v(cx, -0.11, 0.022)), add(axle, v(cx, -0.045, 0.024)));
}

/** THE SHOCK, built along +z from its front eye. */
export function buildShock(sh: THREE.Object3D, put: Put): void {
  const S = SHOCK_REST;
  // The eyes, bushings across x.
  for (const z of [0, S]) {
    put(
      sh,
      "black",
      lathe(
        [
          [0.001, -0.016],
          [0.012, -0.016],
          [0.013, -0.012],
          [0.013, 0.012],
          [0.012, 0.016],
          [0.001, 0.016],
        ],
        16,
      ).translate(0, 0, z),
    );
  }
  // The body, its piggyback, the shaft and the coil between its seats.
  put(
    sh,
    "black",
    lathe(
      [
        [0.001, 0.0],
        [0.016, 0.0],
        [0.02, 0.018],
        [0.02, 0.105],
        [0.025, 0.11],
        [0.025, 0.125],
        [0.012, 0.13],
        [0.001, 0.13],
      ],
      20,
    ).rotateY(-Math.PI / 2),
  );
  put(sh, "gloss", rod(v(0, 0.036, 0.025), v(0, 0.036, 0.115), 0.016, 16));
  put(sh, "black", rod(v(0, 0.02, 0.03), v(0, 0.034, 0.04), 0.008, 10));
  put(sh, "chrome", rod(v(0, 0, 0.12), v(0, 0, S - 0.012), 0.0075, 12));
  put(sh, "black", rod(v(0, 0, S - 0.035), v(0, 0, S - 0.008), 0.016, 16));
  put(sh, "black", rod(v(0, 0, 0.03), v(0, 0, 0.036), 0.037, 20));
  put(sh, "black", rod(v(0, 0, S - 0.042), v(0, 0, S - 0.035), 0.037, 20));
  put(sh, "coil", helix(0.031, 0.0052, 0.04, S - 0.042, 6.5));
}

/** THE CRANKS, the chainring and the pedals, origin the bottom bracket. */
export function buildCranks(
  c: THREE.Object3D,
  put: Put,
  node: (name: string, parent: THREE.Object3D, at: V3) => THREE.Group,
): [THREE.Group, THREE.Group] {
  put(c, "black", rod(v(-0.072, 0, 0), v(0.072, 0, 0), 0.012, 14));
  put(c, "black", ring(0.04, L.ring, 0.004, { x: DRIVE * 0.054, teeth: 34, tooth: 0.0055 }));
  put(
    c,
    "black",
    plate(circle(0.046, 5, 0, 0, 0.3), 0.006, {
      x: DRIVE * 0.058,
      bevel: 0.0015,
      holes: [circle(0.018, 12).reverse()],
    }),
  );
  const pedals: THREE.Group[] = [];
  for (const i of [0, 1]) {
    const s = i ? 1 : -1;
    const dir = i ? -1 : 1;
    const len = L.crank;
    const arm: [number, number][] = [
      [0, -0.024],
      [len * 0.5, -0.016],
      [len, -0.014],
      [len + 0.016, 0],
      [len, 0.014],
      [len * 0.5, 0.016],
      [0, 0.024],
      [-0.024, 0],
    ].map(([z, y]) => [z * dir, y] as [number, number]);
    put(c, "black", plate(arm, 0.016, { x: s * 0.074, bevel: 0.005 }));
    const pedal = node(i ? "bike_pedal_r" : "bike_pedal_l", c, v(s * L.q, 0, dir * len));
    // The spindle and the platform, concave, pinned top and bottom.
    put(pedal, "alloy", rod(v(-s * (L.q - 0.08), 0, 0), v(-s * 0.04, 0, 0), 0.007, 10));
    const P = L.pedal;
    put(
      pedal,
      "black",
      plate(
        [
          [-P.length / 2, -P.thick / 2],
          [P.length / 2, -P.thick / 2],
          [P.length / 2, P.thick / 2],
          [0, P.thick / 2 - 0.003],
          [-P.length / 2, P.thick / 2],
        ],
        P.width,
        { bevel: 0.004 },
      ),
    );
    for (const y of [1, -1]) {
      for (let k = 0; k < 10; k++) {
        const px = (((k % 5) - 2) / 2) * (P.width / 2 - 0.008);
        const pz = (k < 5 ? 1 : -1) * (P.length / 2 - 0.007);
        put(
          pedal,
          "alloy",
          rod(v(px, (y * P.thick) / 2, pz), v(px, y * (P.thick / 2 + 0.004), pz), 0.0016, 5),
        );
      }
    }
    pedals.push(pedal);
  }
  return pedals as [THREE.Group, THREE.Group];
}

/** A WHEEL about +x at the node's origin: the rim, the tyre and its knobs,
 * the hub, 32 spokes laced three-cross, the rotor and (on the rear) the
 * cassette. */
export function buildWheel(
  w: THREE.Object3D,
  rim: number,
  radius: number,
  put: Put,
  rear: boolean,
): void {
  // The rim, a box section.
  put(
    w,
    "black",
    lathe(
      [
        [rim - 0.021, -0.011],
        [rim - 0.006, -0.0155],
        [rim + 0.004, -0.0155],
        [rim + 0.007, -0.013],
        [rim + 0.007, 0.013],
        [rim + 0.004, 0.0155],
        [rim - 0.006, 0.0155],
        [rim - 0.021, 0.011],
        [rim - 0.021, -0.011],
      ],
      72,
    ),
  );
  // The carcass: an ellipse off the bead to the tread, knobs standing on it.
  const knob = 0.0048;
  const rs = (radius - knob - rim) / 2;
  const rc = rim + rs;
  const xs = 0.031;
  const prof: [number, number][] = [];
  for (let i = 0; i <= 28; i++) {
    const t = lerp(-Math.PI, Math.PI, i / 28);
    prof.push([rc + Math.cos(t) * rs, Math.sin(t) * xs]);
  }
  put(w, "rubber", lathe(prof, 96));
  const rows = 84;
  const knobAt = (theta: number, x0: number, sw: number, sl: number, around: number): void => {
    const r = rc + Math.cos(theta) * rs;
    const x = x0 ?? Math.sin(theta) * xs;
    const n = Math.atan2(Math.sin(theta) / xs, Math.cos(theta) / rs);
    const g = new THREE.BoxGeometry(sw, knob * 2, sl);
    g.rotateZ(-n);
    g.translate(x, r, 0);
    g.rotateX(around);
    put(w, "rubber", g);
  };
  for (let i = 0; i < rows; i++) {
    const a = (i / rows) * Math.PI * 2;
    if (i % 2) knobAt(0, 0, 0.02, 0.01, a);
    else for (const s of [-1, 1]) knobAt(s * 0.34, Math.sin(s * 0.34) * xs, 0.01, 0.011, a);
    for (const s of [-1, 1]) {
      const th = s * (i % 2 ? 1.05 : 0.88);
      knobAt(th, Math.sin(th) * xs, 0.011, 0.013, a + 0.02);
    }
  }
  // The hub: its shell and flanges.
  put(
    w,
    "black",
    lathe(
      [
        [0.001, -0.075],
        [0.012, -0.075],
        [0.016, -0.06],
        [0.03, -0.042],
        [0.03, -0.036],
        [0.02, -0.032],
        [0.019, 0.032],
        [0.03, 0.036],
        [0.03, 0.042],
        [0.016, 0.06],
        [0.012, 0.075],
        [0.001, 0.075],
      ],
      20,
    ),
  );
  // Spokes, three-cross: each from a flange's hole to the rim's, leading or
  // trailing in turn.
  const holes = 16;
  for (let i = 0; i < L.spokes; i++) {
    const side = i % 2 ? 1 : -1;
    const k = Math.floor(i / 2);
    const a = (k / holes) * Math.PI * 2 + (side > 0 ? Math.PI / holes : 0);
    const lead = (k % 2 ? 1 : -1) * ((3 * Math.PI * 2) / holes);
    const b = a + lead;
    const from = v(side * 0.039, Math.cos(a) * 0.027, Math.sin(a) * 0.027);
    const to = v(side * 0.006, Math.cos(b) * (rim - 0.02), Math.sin(b) * (rim - 0.02));
    put(w, "alloy", rod(from, to, 0.0011, 4));
  }
  // The rotor: a drilled braking track on a black carrier.
  const rx = -DRIVE * 0.055;
  const holesR: [number, number][][] = [];
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const r = i % 2 ? 0.083 : 0.09;
    holesR.push(circle(0.0032, 8, Math.cos(a) * r, Math.sin(a) * r).reverse());
  }
  put(w, "alloy", ring(0.074, L.rotor, 0.002, { x: rx, holes: holesR }));
  const spider: [number, number][][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    spider.push(circle(0.014, 10, Math.cos(a) * 0.05, Math.sin(a) * 0.05).reverse());
  }
  put(w, "black", ring(0.022, 0.076, 0.003, { x: rx, holes: spider }));
  if (rear) {
    for (let i = 0; i < 7; i++) {
      const r = lerp(0.048, 0.022, i / 6);
      put(
        w,
        "alloy",
        ring(0.018, r, 0.0018, {
          x: DRIVE * (0.03 + i * 0.0038),
          teeth: Math.round(r * 520),
          tooth: 0.004,
        }),
      );
    }
  }
}
