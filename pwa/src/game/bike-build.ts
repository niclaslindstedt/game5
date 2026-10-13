// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE, MATCHED TO ITS PHOTOGRAPHS — the class's bike built in
// code on the bench (`bike-kit.ts`), smooth-shaded, every part at the place
// `bike-look.ts` gives it and on the nodes `bike-view.ts` poses
// (`BIKE_NODES`), so it is a drop-in for the placeholder. Built and judged
// side by side with photographs of a current single-pivot downhill bike in
// profile, three-quarter and head on (`make bike-studio`), the photographs
// studied and never kept:
//
//   the FRAME  a hydroformed alloy front triangle, the down tube squared and
//              deepest at the head, the top tube falling to a short seat
//              tube, a gusset under the head, the main pivot over the
//              chainring and the shock's tab off the down tube; matte stone
//              grey with a black guard under the down tube;
//   the SWINGARM boxed chainstays, slim seatstays and a YOKE that climbs
//              either side of the seat tube to the shock's rear eye;
//   the SHOCK  a coil over a body with a piggyback reservoir;
//   the FORK   a dual-crown fork: two bowed crowns, gold stanchions, black
//              lowers with their seal heads, a direct-mount stem, a wide
//              riser bar with grips, levers and master cylinders;
//   the WHEELS black rims laced three-cross, knobbly tyres (a row of centre
//              knobs and two of shoulder knobs), drilled rotors, four-piston
//              calipers and a seven-cog cassette;
//   the DRIVE  forged cranks, one chainring under its guide and bash guard,
//              a short-cage derailleur, the chain, flat pedals with pins.
//
// Three only; it reads no state.

import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { BIKE, BIKE_BB } from "@engine";

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
} from "./bike-look.ts";
import { block, circle, lathe, loft, plate, rod, type V3 } from "./bike-kit.ts";
import type { BikeNodes } from "./bike-view.ts";
import {
  buildCranks,
  buildShock,
  buildSwingarm,
  buildWheel,
  flipIf,
  type Put,
} from "./bike-parts.ts";

/** THE FINISH, as photographed: a matte stone-grey frame, black anodised
 * parts, gloss black lowers, gold stanchions, an orange coil. */
export const BIKE_PAINT = {
  frame: { color: 0x8c887d, roughness: 0.55, metalness: 0.25 },
  guard: { color: 0x1d1e20, roughness: 0.8, metalness: 0.05 },
  black: { color: 0x17181a, roughness: 0.45, metalness: 0.45 },
  gloss: { color: 0x101113, roughness: 0.25, metalness: 0.3 },
  gold: { color: 0xc48f38, roughness: 0.22, metalness: 0.9 },
  chrome: { color: 0xd6d9dc, roughness: 0.15, metalness: 1 },
  alloy: { color: 0xa9adb1, roughness: 0.35, metalness: 0.85 },
  rubber: { color: 0x1c1c1d, roughness: 0.92, metalness: 0 },
  coil: { color: 0xe2621b, roughness: 0.4, metalness: 0.35 },
  decal: { color: 0xe9e6dc, roughness: 0.5, metalness: 0.1 },
} satisfies Record<string, THREE.MeshStandardMaterialParameters>;

export type BikePaint = keyof typeof BIKE_PAINT;

const v = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3): V3 => v(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: V3, k: number): V3 => v(a.x * k, a.y * k, a.z * k);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const A = STEER_AXIS;
const X: V3 = v(1, 0, 0);
const Z: V3 = v(0, 0, 1);

/** BUILD the photographed bike, each material made by `paint` (the game's
 * haze-wrapped one, or a lab's plain one). */
export function buildPhotoBike(
  paint: (p: THREE.MeshStandardMaterialParameters) => THREE.Material,
): {
  root: THREE.Group;
  nodes: BikeNodes;
  dispose(): void;
} {
  const mats = new Map<BikePaint, THREE.Material>();
  const matOf = (k: BikePaint): THREE.Material => {
    let m = mats.get(k);
    if (!m) mats.set(k, (m = paint({ ...BIKE_PAINT[k] })));
    return m;
  };
  const parts = new Map<THREE.Object3D, Map<BikePaint, THREE.BufferGeometry[]>>();
  /** Lay `g` on `node` in `mat`: positions and normals only, unindexed, so
   * every part merges into one draw a node and a material. */
  const put = (node: THREE.Object3D, mat: BikePaint, g: THREE.BufferGeometry): void => {
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    for (const name of Object.keys(flat.attributes)) {
      if (name !== "position" && name !== "normal") flat.deleteAttribute(name);
    }
    let byMat = parts.get(node);
    if (!byMat) parts.set(node, (byMat = new Map()));
    const list = byMat.get(mat) ?? [];
    list.push(flat);
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
  root.name = "bike-photo";
  const frame = node("bike_frame", root, BIKE_BB);
  buildFrame(frame, put);

  // ── THE STEERED SIDE and the fork's lowers ────────────────────────────
  const bars = node("bike_bars", frame, STEER_AT);
  const fork = node("bike_fork", bars, v(0, 0, 0));
  const axleF = sub(frontAxle(0, 0), STEER_AT);
  buildFork(bars, fork, axleF, put);
  const wheelF = node("bike_wheel_f", fork, axleF);
  buildWheel(wheelF, L.rimF, BIKE.front.radius, put, false);

  // ── THE SWINGARM, the rear wheel and the shock ────────────────────────
  const swing = node("bike_swingarm", frame, L.pivot);
  const axleR = sub(REAR_REST, L.pivot);
  buildSwingarm(swing, axleR, put);
  const wheelR = node("bike_wheel_r", swing, axleR);
  buildWheel(wheelR, L.rimR, BIKE.rear.radius, put, true);
  const shock = node("bike_shock", frame, L.shockFront);
  buildShock(shock, put);

  // ── THE CRANKS and the pedals ─────────────────────────────────────────
  const cranks = node("bike_cranks", frame, v(0, 0, 0));
  const pedals = buildCranks(cranks, put, node);

  const geos: THREE.BufferGeometry[] = [];
  for (const [n, byMat] of parts) {
    for (const [mat, list] of byMat) {
      const g = mergeGeometries(list, false);
      for (const l of list) l.dispose();
      if (!g) continue;
      geos.push(g);
      const mesh = new THREE.Mesh(g, matOf(mat));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
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
      for (const m of mats.values()) m.dispose();
    },
  };
}

/** A point on the seat tube's line at height `y` over the bottom bracket. */
const SEAT_FROM = v(0, 0.03, -0.02);
const SEAT_DIR = (() => {
  const d = sub(v(0, 0.48, -0.185), SEAT_FROM);
  return mul(d, 1 / Math.hypot(d.y, d.z));
})();
const seatAt = (y: number): V3 => add(SEAT_FROM, mul(SEAT_DIR, (y - SEAT_FROM.y) / SEAT_DIR.y));

/** THE FRONT TRIANGLE, origin the bottom bracket. */
function buildFrame(f: THREE.Object3D, put: Put): void {
  // The head tube, tapered (wider at the lower cup), its cups.
  const htLo = sub(HEAD_BOTTOM, mul(A, 0.012));
  const htHi = add(HEAD_TOP, mul(A, 0.006));
  put(
    f,
    "frame",
    loft([htLo, htHi], (u) => ({ w: lerp(0.034, 0.029, u), h: lerp(0.034, 0.029, u) }), {
      sides: 20,
      rings: 4,
      straight: true,
    }),
  );
  for (const [p, r] of [
    [htLo, 0.036],
    [htHi, 0.031],
  ] as const) {
    put(
      f,
      "black",
      loft(
        [sub(p, mul(A, 0.006)), add(p, mul(A, 0.006))],
        { w: r, h: r },
        { sides: 20, rings: 1, straight: true },
      ),
    );
  }

  // The down tube: deepest at the head, squared, easing round to the shell.
  const down = [
    v(0, 0.556, 0.5),
    v(0, 0.44, 0.405),
    v(0, 0.3, 0.27),
    v(0, 0.15, 0.135),
    v(0, 0.045, 0.045),
  ];
  const downSec = (u: number) => ({ w: lerp(0.031, 0.033, u), h: lerp(0.044, 0.032, u) });
  put(f, "frame", loft(down, downSec, { sides: 18, square: 2.8 }));
  // Its guard, on the lower half underneath.
  put(
    f,
    "guard",
    loft(
      [v(0, 0.3, 0.262), v(0, 0.2, 0.172), v(0, 0.1, 0.085)].map((p) =>
        add(p, v(0, -0.006, 0.004)),
      ),
      { w: 0.035, h: 0.034 },
      { sides: 18, square: 2.8 },
    ),
  );
  // The top tube, falling to the seat tube.
  const topEnd = seatAt(0.43);
  put(
    f,
    "frame",
    loft(
      [v(0, 0.612, 0.452), v(0, 0.565, 0.29), v(0, 0.5, 0.08), topEnd],
      (u) => ({ w: 0.022, h: lerp(0.03, 0.022, u) }),
      {
        sides: 16,
        square: 2.4,
      },
    ),
  );
  // The gusset under the head.
  put(
    f,
    "frame",
    plate(
      [
        [0.5, 0.59],
        [0.425, 0.6],
        [0.4, 0.555],
        [0.45, 0.48],
        [0.5, 0.52],
      ],
      0.018,
      { bevel: 0.005 },
    ),
  );

  // The seat tube, the post and the saddle.
  put(
    f,
    "frame",
    loft(
      [SEAT_FROM, seatAt(0.445)],
      { w: 0.021, h: 0.024 },
      { sides: 16, rings: 3, straight: true, square: 2.2 },
    ),
  );
  put(
    f,
    "black",
    loft(
      [seatAt(0.43), seatAt(0.455)],
      { w: 0.025, h: 0.025 },
      { sides: 16, rings: 1, straight: true },
    ),
  );
  put(f, "black", rod(seatAt(0.44), seatAt(0.505), 0.0158, 14));
  put(f, "black", block(add(seatAt(0.51), v(0, 0, -0.005)), 0.03, 0.014, 0.05));
  put(
    f,
    "rubber",
    loft(
      [
        v(0, 0.548, -0.375),
        v(0, 0.54, -0.3),
        v(0, 0.533, -0.22),
        v(0, 0.53, -0.155),
        v(0, 0.535, -0.12),
      ],
      (u) => ({
        w: u < 0.35 ? lerp(0.07, 0.06, u / 0.35) : lerp(0.06, 0.018, (u - 0.35) / 0.65),
        h: lerp(0.019, 0.013, u),
      }),
      { sides: 18, square: 2.6, side: X },
    ),
  );
  for (const s of [-1, 1]) {
    put(
      f,
      "black",
      loft(
        [v(s * 0.02, 0.52, -0.33), v(s * 0.022, 0.508, -0.2), v(s * 0.015, 0.52, -0.15)],
        { w: 0.0035, h: 0.0035 },
        { sides: 6 },
      ),
    );
  }

  // The bottom bracket's shell and the lug that carries the main pivot.
  put(
    f,
    "frame",
    lathe(
      [
        [0.001, -0.046],
        [0.022, -0.046],
        [0.024, -0.042],
        [0.024, 0.042],
        [0.022, 0.046],
        [0.001, 0.046],
      ],
      20,
    ),
  );
  put(
    f,
    "frame",
    plate(
      [
        [0.06, 0.02],
        [0.045, 0.085],
        [0.015, 0.13],
        [-0.045, 0.125],
        [-0.06, 0.06],
        [-0.04, -0.015],
        [0.0, -0.035],
      ],
      0.068,
      { bevel: 0.01 },
    ),
  );
  const pv = L.pivot;
  put(
    f,
    "black",
    lathe(
      [
        [0.001, -0.06],
        [0.019, -0.06],
        [0.019, 0.06],
        [0.001, 0.06],
      ],
      16,
    ).translate(0, pv.y, pv.z),
  );
  // The shock's tab off the down tube to its front eye.
  const eye = L.shockFront;
  for (const s of [-1, 1]) {
    put(
      f,
      "frame",
      plate(
        [
          [eye.z + 0.022, eye.y + 0.012],
          [eye.z - 0.02, eye.y + 0.015],
          [eye.z - 0.035, eye.y - 0.06],
          [eye.z + 0.06, eye.y - 0.01],
        ],
        0.008,
        { x: s * 0.022, bevel: 0.002 },
      ),
    );
  }
  // The chain guide over the ring and the bash guard under it.
  const gx = DRIVE * 0.062;
  put(
    f,
    "black",
    plate(
      [
        [-0.03, 0.085],
        [0.035, 0.085],
        [0.05, 0.065],
        [-0.005, 0.07],
        [-0.04, 0.07],
      ],
      0.022,
      { x: gx, bevel: 0.004 },
    ),
  );
  const bash: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const a = lerp(-2.7, -0.35, i / 16);
    bash.push([Math.cos(a) * 0.085, Math.sin(a) * 0.085]);
  }
  for (let i = 16; i >= 0; i--) {
    const a = lerp(-2.7, -0.35, i / 16);
    bash.push([Math.cos(a) * 0.066, Math.sin(a) * 0.066]);
  }
  put(f, "black", plate(bash, 0.006, { x: DRIVE * 0.07, bevel: 0.0015 }));
  put(
    f,
    "black",
    plate(circle(0.05, 20), 0.004, {
      x: DRIVE * 0.05,
      bevel: 0.001,
      holes: [circle(0.026, 16).reverse()],
    }),
  );

  // The rear brake's hose and the derailleur's cable, along the down tube.
  put(
    f,
    "black",
    loft(
      [
        v(0.03, 0.54, 0.5),
        v(0.034, 0.42, 0.4),
        v(0.03, 0.2, 0.19),
        v(0.035, 0.07, 0.03),
        v(0.04, 0.05, -0.04),
      ],
      { w: 0.0028, h: 0.0028 },
      { sides: 6 },
    ),
  );
  put(
    f,
    "black",
    loft(
      [
        v(-0.03, 0.54, 0.5),
        v(-0.034, 0.42, 0.4),
        v(-0.03, 0.2, 0.19),
        v(-0.035, 0.07, 0.03),
        v(-0.04, 0.05, -0.04),
      ],
      { w: 0.0024, h: 0.0024 },
      { sides: 6 },
    ),
  );
}

/** THE FORK: the crowns, stanchions, steerer, stem, bar and controls on
 * `bars` (origin `STEER_AT`), the lowers on `fork`. */
function buildFork(bars: THREE.Object3D, fork: THREE.Object3D, axle: V3, put: Put): void {
  /** A leg's line: `t` m up the steer axis from the axle. */
  const leg = (s: number, t: number): V3 => add(v(s * L.forkHalf, axle.y, axle.z), mul(A, t));
  /** How far up a leg a crown at `c` (from the bottom bracket) stands. */
  const legAt = (c: V3): number => (c.y - STEER_AT.y - axle.y) / A.y;
  const tTop = legAt(CROWN_TOP);
  const tBot = legAt(CROWN_BOTTOM);
  const rel = (p: V3): V3 => sub(p, STEER_AT);

  // The stanchions, from inside the lowers to just over the top crown.
  for (const s of [-1, 1]) {
    put(bars, "gold", rod(leg(s, 0.3), leg(s, tTop + 0.022), L.stanchion.r, 20));
    put(bars, "black", rod(leg(s, tTop + 0.018), leg(s, tTop + 0.03), L.stanchion.r * 0.92, 16));
  }
  // The crowns, bowed back round the steerer.
  for (const [c, t, depth, thick] of [
    [CROWN_TOP, tTop, 0.022, 0.013],
    [CROWN_BOTTOM, tBot, 0.03, 0.017],
  ] as const) {
    const mid = rel(c);
    const pts = [-1, -0.55, 0, 0.55, 1].map((k) => {
      const l = leg(Math.sign(k) || 1, t);
      const at =
        Math.abs(k) === 1
          ? l
          : k === 0
            ? mid
            : v(k * L.forkHalf * 0.9, lerp(mid.y, l.y, 0.6), lerp(mid.z, l.z, 0.6));
      return { ...at, x: k * (L.forkHalf + 0.024) };
    });
    put(
      bars,
      "black",
      loft(pts, (u) => ({ w: thick, h: depth * (1 - 0.25 * Math.sin(u * Math.PI)) }), {
        sides: 16,
        square: 3.2,
        side: A,
      }),
    );
    // The clamps round each stanchion and the steerer.
    for (const s of [-1, 1]) {
      put(
        bars,
        "black",
        rod(
          sub(leg(s, t), mul(A, thick)),
          add(leg(s, t), mul(A, thick)),
          L.stanchion.r + 0.006,
          18,
        ),
      );
    }
    put(bars, "black", rod(sub(mid, mul(A, thick)), add(mid, mul(A, thick)), 0.026, 18));
  }
  // The steerer between them.
  put(bars, "black", rod(rel(CROWN_BOTTOM), rel(CROWN_TOP), 0.019, 14));

  // The direct-mount stem and the bar's clamp.
  const bm = rel(BAR_MIDDLE);
  const top = rel(CROWN_TOP);
  for (const s of [-1, 1]) {
    put(
      bars,
      "black",
      plate(
        [
          [top.z - 0.03, top.y + 0.012],
          [top.z + 0.02, top.y + 0.012],
          [bm.z + 0.022, bm.y - 0.008],
          [bm.z + 0.012, bm.y + 0.02],
          [bm.z - 0.022, bm.y + 0.015],
          [top.z - 0.035, top.y + 0.03],
        ],
        0.012,
        { x: s * 0.022, bevel: 0.003 },
      ),
    );
  }
  put(
    bars,
    "black",
    lathe(
      [
        [0.001, -0.032],
        [0.021, -0.032],
        [0.023, -0.025],
        [0.023, 0.025],
        [0.021, 0.032],
        [0.001, 0.032],
      ],
      20,
    ).translate(0, bm.y, bm.z),
  );

  // The bar: a riser, wide, swept back at its ends.
  const g = GRIPS.map(rel);
  const half = L.barWidth / 2;
  const barPts = [
    v(-half, g[0].y, g[0].z),
    v(-0.27, g[0].y - 0.002, g[0].z + 0.006),
    v(-0.16, bm.y + 0.006, bm.z + 0.003),
    v(-0.075, bm.y, bm.z),
    v(0.075, bm.y, bm.z),
    v(0.16, bm.y + 0.006, bm.z + 0.003),
    v(0.27, g[1].y - 0.002, g[1].z + 0.006),
    v(half, g[1].y, g[1].z),
  ];
  put(
    bars,
    "black",
    loft(
      barPts,
      (u) => {
        const r =
          Math.abs(u - 0.5) < 0.09
            ? 0.0159
            : Math.abs(u - 0.5) < 0.2
              ? lerp(0.0159, 0.0111, (Math.abs(u - 0.5) - 0.09) / 0.11)
              : 0.0111;
        return { w: r, h: r };
      },
      { sides: 14, rings: 60 },
    ),
  );

  // The grips, their lock rings, the levers, the master cylinders.
  for (const [i, s] of [
    [0, -1],
    [1, 1],
  ] as const) {
    const c = g[i];
    const inner = c.x - (s * L.grip) / 2;
    const prof: [number, number][] = [
      [0.001, 0],
      [0.019, 0],
      [0.019, 0.008],
      [0.0165, 0.01],
    ];
    for (let k = 1; k < 12; k++) prof.push([k % 2 ? 0.0172 : 0.0162, 0.01 + (k * 0.11) / 12]);
    prof.push([0.0175, 0.122], [0.019, 0.124], [0.019, 0.13], [0.001, 0.13]);
    const grip = lathe(prof, 18);
    if (s < 0) grip.scale(-1, 1, 1);
    put(bars, "rubber", flipIf(grip, s < 0).translate(inner, c.y, c.z));
    put(
      bars,
      "black",
      rod(v(inner - s * 0.004, c.y, c.z), v(inner + s * 0.004, c.y, c.z), 0.0195, 16),
    );
    put(
      bars,
      "black",
      rod(
        v(c.x + (s * L.grip) / 2 - s * 0.003, c.y, c.z),
        v(c.x + (s * L.grip) / 2 + s * 0.002, c.y, c.z),
        0.0195,
        16,
      ),
    );
    // The master cylinder clamp and body, its reservoir and the lever.
    const mx = inner - s * 0.03;
    put(bars, "black", rod(v(mx - 0.012, c.y, c.z), v(mx + 0.012, c.y, c.z), 0.016, 14));
    put(bars, "black", block(v(mx, c.y + 0.012, c.z + 0.032), 0.026, 0.026, 0.05));
    put(bars, "black", block(v(mx - s * 0.004, c.y + 0.03, c.z + 0.024), 0.022, 0.012, 0.036));
    put(
      bars,
      "alloy",
      loft(
        [
          v(mx + s * 0.004, c.y + 0.004, c.z + 0.055),
          v(mx + s * 0.04, c.y - 0.008, c.z + 0.062),
          v(mx + s * 0.085, c.y - 0.022, c.z + 0.05),
        ],
        (u) => ({ w: lerp(0.006, 0.004, u), h: lerp(0.008, 0.007, u) }),
        { sides: 10, square: 2.6, side: Z },
      ),
    );
    // The hose, down and forward round the crowns.
    put(
      bars,
      "black",
      loft(
        [
          v(mx, c.y + 0.004, c.z + 0.06),
          v(mx * 0.6, c.y - 0.02, c.z + 0.13),
          v(s * 0.06, top.y - 0.06, top.z + 0.11),
          leg(s, tBot - 0.06),
        ],
        { w: 0.0028, h: 0.0028 },
        { sides: 6 },
      ),
    );
  }

  // The lowers, their seal heads and dropouts, and the fender.
  const lowTop = 0.37;
  for (const s of [-1, 1]) {
    put(
      fork,
      "gloss",
      loft(
        [leg(s, -0.022), leg(s, 0.04), leg(s, lowTop - 0.02)],
        (u) => {
          const r = u < 0.15 ? lerp(0.021, L.lower.r, u / 0.15) : L.lower.r;
          return { w: r, h: r * 1.04 };
        },
        { sides: 20 },
      ),
    );
    put(fork, "black", rod(leg(s, lowTop - 0.025), leg(s, lowTop + 0.006), L.lower.r + 0.002, 20));
    put(
      fork,
      "rubber",
      rod(leg(s, lowTop + 0.006), leg(s, lowTop + 0.016), L.stanchion.r + 0.004, 18),
    );
    // The dropout and its axle pinch.
    put(
      fork,
      "gloss",
      plate(circle(0.026, 18, axle.z, axle.y), 0.024, { x: s * L.forkHalf, bevel: 0.006 }),
    );
    put(
      fork,
      "alloy",
      rod(
        v(s * (L.forkHalf + 0.012), axle.y, axle.z),
        v(s * (L.forkHalf + 0.02), axle.y, axle.z),
        0.012,
        12,
      ),
    );
  }
  // The front caliper behind the rotor's leg (the body frame's +x).
  const rotorX = -DRIVE * 0.055;
  put(fork, "black", block(add(axle, v(rotorX + 0.008, 0.06, -0.06)), 0.032, 0.05, 0.065));
  put(fork, "black", block(add(axle, v(rotorX + 0.014, 0.04, -0.02)), 0.014, 0.05, 0.06));
  // A short fender over the tyre, off the lowers' arch.
  const fender: V3[] = [];
  for (let i = 0; i <= 8; i++) {
    const a = lerp(1.0, 2.05, i / 8);
    const r = BIKE.front.radius + 0.014;
    fender.push(add(axle, v(0, Math.sin(a) * r, Math.cos(a) * r)));
  }
  put(
    fork,
    "gloss",
    loft(fender, (u) => ({ w: lerp(0.036, 0.046, u), h: 0.003 }), { sides: 12, square: 4 }),
  );
}
