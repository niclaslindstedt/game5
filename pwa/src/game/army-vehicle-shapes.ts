// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND WAVES' VEHICLES AS BUILT — the tracked carrier, the truck and
// the tank (`ARMY_VEHICLE`, `army-vehicle.ts`), each built in code off the
// engine's own plan of it (its half length and width, its height, the
// carrier's hitch, the tank's turret ring and muzzle), low-poly and painted
// in its faces' colours: one mesh a part, every vehicle of a kind sharing
// its geometry.
//
// WHAT EACH LOOKS LIKE (`docs/army.md` has the research):
//   * THE TRACKED CARRIER: two short boxy units, each on a pair of wide
//     black rubber band tracks with rounded ends nearly as long as the unit;
//     the front unit a cab with a sloped engine nose, a deep windscreen and
//     side windows, the rear a taller box with small windows and a door in
//     its back; a steered hitch between them. Painted white with broken
//     olive patches left showing (a winter wash over the green).
//   * THE TRUCK: a cab-forward cross-country cargo truck on six big tyres
//     in chains — a flat-fronted cab with a two-pane windscreen, mirrors on
//     arms and a bumper, a long bed under an arched canvas tilt. Olive drab
//     with a white wash daubed over cab and bonnet, the tilt a white cover.
//   * THE TANK: a long low hull on two tracks hidden behind side skirts,
//     the road wheels under them; a steep glacis, a wide flat turret with a
//     wedge front set on the hull's middle, a long smoothbore gun with a
//     thermal sleeve, a commander's cupola and a loader's hatch, a stowage
//     basket on the turret's back. White with large grey and dark-grey
//     disruptive patches across hull and turret.
//
// THE FRAME of every part is the engine's body frame: x right, y up from
// the snow under the vehicle's middle, z forward. The carrier's rear unit
// is its own part, set about the hitch by the drawer; the tank's turret
// turns about its ring (y up at the hull's middle) and its gun about the
// trunnion (`TANK_GUN`).
//
// Presentation only.

import * as THREE from "three";
import { ARMY_VEHICLE, type ArmyVehicleKind } from "@engine";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/** THE PAINT, sRGB: the winter white and its washed-out olive, the greys
 * of a disruptive scheme, the tracks' and tyres' rubber, the glass, the
 * gun's dark steel, the canvas tilt. */
export const VEHICLE_COLOURS = {
  white: 0xdfe2de,
  wash: 0xc9cdc5,
  olive: 0x5b6341,
  grey: 0x8e938f,
  dark: 0x4c514e,
  rubber: 0x232524,
  glass: 0x2f3a40,
  steel: 0x3a3d3b,
  canvas: 0xe4e4dc,
  lamp: 0xf4f0d8,
} as const;

type Paint = keyof typeof VEHICLE_COLOURS;
type V3 = readonly [number, number, number];

/** A camouflage: the base colour and its patches — which, how big (the
 * waves' scale, 1/m) and what share of the surface each covers. */
type Camo = {
  base: Paint;
  patches: { paint: Paint; above: number }[];
  scale: number;
  seed: number;
};

/** THE PATCH at a point of the body, m: the patch's paint, or the base's. */
function patchAt(c: Camo, x: number, y: number, z: number): Paint {
  const k = c.scale;
  const s = c.seed;
  const f =
    Math.sin(k * (1.1 * x + 0.45 * y) + s) * Math.cos(k * (0.8 * z - 0.6 * y) + 1.3 + s) +
    0.55 * Math.sin(k * (1.7 * y - 1.3 * z + 0.6 * x) + 2.2 + s) +
    0.35 * Math.cos(k * (2.3 * x + 1.7 * z - 0.9 * y) + s * 0.7);
  for (const p of c.patches) if (f > p.above) return p.paint;
  return c.base;
}

const colour = new THREE.Color();

/** THE PIECES of one part, gathered, painted and merged at the end. */
class Part {
  readonly list: THREE.BufferGeometry[] = [];
  constructor(private readonly camo: Camo | null) {}

  /** `g` painted `paint`, or — `paint` "camo" — the part's camouflage face
   * by face (each face its own colour, at its middle). */
  add(g: THREE.BufferGeometry, paint: Paint | "camo"): void {
    const flat = g.index ? g.toNonIndexed() : g;
    if (flat !== g) g.dispose();
    flat.deleteAttribute("uv");
    const pos = flat.getAttribute("position");
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i += 3) {
      let p: Paint = paint === "camo" ? (this.camo?.base ?? "white") : paint;
      if (paint === "camo" && this.camo) {
        const x = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3;
        const y = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
        const z = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3;
        p = patchAt(this.camo, x, y, z);
      }
      colour.setHex(VEHICLE_COLOURS[p]);
      for (let k = 0; k < 3; k++) {
        col[(i + k) * 3] = colour.r;
        col[(i + k) * 3 + 1] = colour.g;
        col[(i + k) * 3 + 2] = colour.b;
      }
    }
    flat.setAttribute("color", new THREE.BufferAttribute(col, 3));
    flat.computeVertexNormals();
    this.list.push(flat);
  }

  /** A box `w` × `h` × `l` m (x, y, z) with its middle at `at`, faces cut
   * into pieces of about `cell` m so a camouflage can be painted on it. */
  box(w: number, h: number, l: number, at: V3, paint: Paint | "camo", cell = 0.45): void {
    const n = (d: number) => Math.max(1, Math.round(d / cell));
    const g = new THREE.BoxGeometry(w, h, l, n(w), n(h), n(l));
    g.translate(at[0], at[1], at[2]);
    this.add(g, paint);
  }

  /** A solid between eight corners — the four of its back face (bottom
   * left, bottom right, top right, top left, seen from behind) then the
   * four of its front in the same order — its faces cut into a grid so a
   * camouflage can be painted on it. */
  hexa(c: readonly V3[], paint: Paint | "camo"): void {
    const g = new THREE.BoxGeometry(1, 1, 1, 4, 3, 6);
    const pos = g.getAttribute("position");
    const lerp = (a: V3, b: V3, t: number): V3 => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
    for (let i = 0; i < pos.count; i++) {
      const u = pos.getX(i) + 0.5;
      const v = pos.getY(i) + 0.5;
      const w = pos.getZ(i) + 0.5;
      const back = lerp(lerp(c[0], c[1], u), lerp(c[3], c[2], u), v);
      const front = lerp(lerp(c[4], c[5], u), lerp(c[7], c[6], u), v);
      const p = lerp(back, front, w);
      pos.setXYZ(i, p[0], p[1], p[2]);
    }
    this.add(g, paint);
  }

  /** A cylinder along x (a wheel, an axle), z (a barrel) or y. */
  cyl(
    r: number,
    len: number,
    at: V3,
    axis: "x" | "y" | "z",
    paint: Paint | "camo",
    sides = 12,
    r2 = r,
  ): void {
    const g = new THREE.CylinderGeometry(r2, r, len, sides, 1);
    if (axis === "x") g.rotateZ(Math.PI / 2);
    if (axis === "z") g.rotateX(Math.PI / 2);
    g.translate(at[0], at[1], at[2]);
    this.add(g, paint);
  }

  /** A TRACK RUN: a belt `l` m long, `w` wide and `h` tall with rounded
   * ends, its middle at `at`. */
  track(l: number, w: number, h: number, at: V3, paint: Paint = "rubber"): void {
    const r = h / 2;
    this.box(w, h, l - h, at, paint, 2);
    this.cyl(r, w, [at[0], at[1], at[2] + (l - h) / 2], "x", paint, 10);
    this.cyl(r, w, [at[0], at[1], at[2] - (l - h) / 2], "x", paint, 10);
  }

  geometry(): THREE.BufferGeometry {
    const g = mergeGeometries(this.list, false)!;
    for (const p of this.list) p.dispose();
    return g;
  }
}

const A = ARMY_VEHICLE;

/** THE TANK'S GUN: the trunnion it elevates about (m: up from the snow,
 * forward of the turret ring), and its barrel's length from there and its
 * radius — the muzzle where the engine fires from (`ARMY_VEHICLE.tank`). */
export const TANK_GUN = {
  y: A.tank.ring,
  z: 1.25,
  length: A.tank.muzzle - 1.25,
  radius: 0.1,
} as const;

/** THE CARRIER'S REAR UNIT's middle behind the front's, m (along the front's
 * axis to the hitch, then along its own). */
export const CARRIER_REAR = A.rear;

// ─── the carrier ───────────────────────────────────────────────────────

const CARRIER_CAMO: Camo = {
  base: "white",
  patches: [
    { paint: "olive", above: 1.15 },
    { paint: "wash", above: 0.7 },
  ],
  scale: 1.6,
  seed: 0.4,
};

function carrierFront(): THREE.BufferGeometry {
  const S = A.kinds.carrier;
  const p = new Part(CARRIER_CAMO);
  const L = S.halfLength;
  const W = S.halfWidth;
  // The tracks: one either side, nearly the unit's length.
  for (const s of [-1, 1]) p.track(L * 2 - 0.1, 0.62, 0.62, [s * (W - 0.31), 0.31, 0], "rubber");
  // The hull's tub over the tracks.
  p.box(W * 2 - 0.1, 0.35, L * 2 - 0.3, [0, 0.78, -0.05], "camo");
  // The sloped engine nose, the cab and its roof.
  p.hexa(
    [
      [-W + 0.1, 0.95, 0.4],
      [W - 0.1, 0.95, 0.4],
      [W - 0.15, 1.45, 0.4],
      [-W + 0.15, 1.45, 0.4],
      [-W + 0.15, 0.95, L - 0.05],
      [W - 0.15, 0.95, L - 0.05],
      [W - 0.25, 1.25, L - 0.35],
      [-W + 0.25, 1.25, L - 0.35],
    ],
    "camo",
  );
  p.hexa(
    [
      [-W + 0.08, 0.95, -L + 0.2],
      [W - 0.08, 0.95, -L + 0.2],
      [W - 0.12, 2.25, -L + 0.2],
      [-W + 0.12, 2.25, -L + 0.2],
      [-W + 0.1, 0.95, 0.42],
      [W - 0.1, 0.95, 0.42],
      [W - 0.18, 2.2, 0.05],
      [-W + 0.18, 2.2, 0.05],
    ],
    "camo",
  );
  // The windscreen and the side windows.
  p.hexa(
    [
      [-W + 0.2, 1.5, 0.43],
      [W - 0.2, 1.5, 0.43],
      [W - 0.24, 2.12, 0.08],
      [-W + 0.24, 2.12, 0.08],
      [-W + 0.2, 1.5, 0.46],
      [W - 0.2, 1.5, 0.46],
      [W - 0.24, 2.12, 0.11],
      [-W + 0.24, 2.12, 0.11],
    ],
    "glass",
  );
  for (const s of [-1, 1]) p.box(0.04, 0.42, 0.9, [s * (W - 0.09), 1.78, -0.45], "glass", 2);
  // The headlamps and a roof hatch with its rim.
  for (const s of [-1, 1]) p.box(0.22, 0.12, 0.06, [s * (W - 0.4), 1.18, L - 0.32], "lamp", 2);
  p.cyl(0.36, 0.08, [0, 2.29, -0.6], "y", "dark", 10);
  // The hitch's rams between the units.
  p.box(0.25, 0.25, 0.6, [0, 0.75, -L - 0.15], "dark", 2);
  return p.geometry();
}

function carrierRear(): THREE.BufferGeometry {
  const S = A.kinds.carrier;
  const p = new Part({ ...CARRIER_CAMO, seed: 2.1 });
  const L = A.rear.back;
  const W = S.halfWidth;
  for (const s of [-1, 1]) p.track(L * 2 - 0.15, 0.62, 0.62, [s * (W - 0.31), 0.31, 0], "rubber");
  p.box(W * 2 - 0.1, 0.35, L * 2 - 0.3, [0, 0.78, 0], "camo");
  p.hexa(
    [
      [-W + 0.08, 0.95, -L + 0.1],
      [W - 0.08, 0.95, -L + 0.1],
      [W - 0.14, 2.3, -L + 0.18],
      [-W + 0.14, 2.3, -L + 0.18],
      [-W + 0.08, 0.95, L - 0.15],
      [W - 0.08, 0.95, L - 0.15],
      [W - 0.14, 2.3, L - 0.3],
      [-W + 0.14, 2.3, L - 0.3],
    ],
    "camo",
  );
  for (const s of [-1, 1])
    for (const z of [-0.8, 0.5]) p.box(0.04, 0.32, 0.55, [s * (W - 0.1), 1.9, z], "glass", 2);
  // The rear door and a jerrycan rack beside it.
  p.box(0.8, 1.05, 0.05, [0, 1.45, -L + 0.08], "wash", 0.4);
  p.box(0.4, 0.5, 0.18, [W - 0.45, 1.3, -L + 0.06], "olive", 2);
  // A roof rack with a white-covered load.
  p.box(W * 2 - 0.5, 0.22, L * 1.2, [0, 2.42, 0], "canvas", 0.5);
  return p.geometry();
}

// ─── the truck ─────────────────────────────────────────────────────────

const TRUCK_CAMO: Camo = {
  base: "olive",
  patches: [
    { paint: "white", above: 0.2 },
    { paint: "wash", above: -0.15 },
  ],
  scale: 1.4,
  seed: 1.1,
};

function truck(): THREE.BufferGeometry {
  const S = A.kinds.truck;
  const p = new Part(TRUCK_CAMO);
  const L = S.halfLength;
  const W = S.halfWidth;
  // Six tyres in chains, and the chassis rails over them.
  for (const z of [L - 1.0, -L + 2.45, -L + 1.05])
    for (const s of [-1, 1]) {
      p.cyl(0.6, 0.42, [s * (W - 0.25), 0.6, z], "x", "rubber", 14);
      p.cyl(0.3, 0.44, [s * (W - 0.25), 0.6, z], "x", "dark", 8);
    }
  for (const s of [-1, 1]) p.box(0.18, 0.3, L * 2 - 0.4, [s * 0.55, 1.05, 0], "dark", 2);
  // The cab, flat-fronted, and its windscreen and side windows.
  p.box(W * 2 - 0.1, 1.15, 1.75, [0, 1.45, L - 0.95], "camo");
  p.hexa(
    [
      [-W + 0.05, 2.0, L - 1.8],
      [W - 0.05, 2.0, L - 1.8],
      [W - 0.1, 2.95, L - 1.75],
      [-W + 0.1, 2.95, L - 1.75],
      [-W + 0.05, 2.0, L - 0.08],
      [W - 0.05, 2.0, L - 0.08],
      [W - 0.1, 2.9, L - 0.3],
      [-W + 0.1, 2.9, L - 0.3],
    ],
    "camo",
  );
  for (const s of [-1, 1])
    p.hexa(
      [
        [s > 0 ? 0.05 : -W + 0.2, 2.15, L - 0.08],
        [s > 0 ? W - 0.2 : -0.05, 2.15, L - 0.08],
        [s > 0 ? W - 0.22 : -0.05, 2.8, L - 0.29],
        [s > 0 ? 0.05 : -W + 0.22, 2.8, L - 0.29],
        [s > 0 ? 0.05 : -W + 0.2, 2.15, L - 0.04],
        [s > 0 ? W - 0.2 : -0.05, 2.15, L - 0.04],
        [s > 0 ? W - 0.22 : -0.05, 2.8, L - 0.25],
        [s > 0 ? 0.05 : -W + 0.22, 2.8, L - 0.25],
      ],
      "glass",
    );
  for (const s of [-1, 1]) {
    p.box(0.04, 0.5, 0.75, [s * (W - 0.03), 2.5, L - 1.0], "glass", 2);
    // The mirror on its arm.
    p.box(0.5, 0.05, 0.05, [s * (W + 0.2), 2.45, L - 0.45], "dark", 2);
    p.box(0.06, 0.4, 0.22, [s * (W + 0.42), 2.45, L - 0.45], "dark", 2);
    p.box(0.26, 0.16, 0.06, [s * (W - 0.4), 1.25, L + 0.02], "lamp", 2);
  }
  // The bumper and the grille.
  p.box(W * 2 + 0.05, 0.25, 0.25, [0, 0.95, L + 0.05], "dark", 2);
  p.box(1.2, 0.5, 0.04, [0, 1.6, L + 0.01], "dark", 2);
  // The bed and its arched canvas tilt.
  const bed = L * 2 - 2.0;
  const z0 = -L + bed / 2;
  p.box(W * 2, 0.5, bed, [0, 1.45, z0], "camo");
  p.box(W * 2 - 0.04, 1.15, bed - 0.05, [0, 2.27, z0], "canvas", 0.6);
  const arch = new THREE.CylinderGeometry(
    W - 0.02,
    W - 0.02,
    bed - 0.05,
    12,
    4,
    false,
    -Math.PI / 2,
    Math.PI,
  );
  arch.rotateX(Math.PI / 2);
  arch.scale(1, 0.4, 1);
  arch.translate(0, 2.85, z0);
  p.add(arch, "canvas");
  // The spare wheel behind the cab.
  p.cyl(0.55, 0.38, [0, 2.0, L - 2.05], "z", "rubber", 12);
  return p.geometry();
}

// ─── the tank ──────────────────────────────────────────────────────────

const TANK_CAMO: Camo = {
  base: "white",
  patches: [
    { paint: "dark", above: 1.0 },
    { paint: "grey", above: 0.45 },
  ],
  scale: 0.9,
  seed: 0.2,
};

function tankHull(): THREE.BufferGeometry {
  const S = A.kinds.tank;
  const p = new Part(TANK_CAMO);
  const L = S.halfLength;
  const W = S.halfWidth;
  // The tracks and the road wheels under the skirts.
  for (const s of [-1, 1]) {
    p.track(L * 2 - 0.3, 0.64, 0.95, [s * (W - 0.4), 0.48, -0.05], "rubber");
    for (let i = 0; i < 7; i++)
      p.cyl(0.36, 0.66, [s * (W - 0.4), 0.42, -L + 0.85 + i * 0.97], "x", "dark", 10);
    // The side skirt.
    p.box(0.06, 0.62, L * 2 - 0.6, [s * (W - 0.05), 0.82, 0.05], "camo");
  }
  // The hull: the belly, the glacis and the deck.
  p.hexa(
    [
      [-W + 0.6, 0.35, -L + 0.25],
      [W - 0.6, 0.35, -L + 0.25],
      [W - 0.1, 1.55, -L + 0.05],
      [-W + 0.1, 1.55, -L + 0.05],
      [-W + 0.6, 0.35, L - 0.6],
      [W - 0.6, 0.35, L - 0.6],
      [W - 0.1, 1.55, L - 0.6],
      [-W + 0.1, 1.55, L - 0.6],
    ],
    "camo",
  );
  p.hexa(
    [
      [-W + 0.6, 0.45, L - 0.6],
      [W - 0.6, 0.45, L - 0.6],
      [W - 0.1, 1.55, L - 0.6],
      [-W + 0.1, 1.55, L - 0.6],
      [-W + 0.6, 0.6, L - 0.05],
      [W - 0.6, 0.6, L - 0.05],
      [W - 0.15, 1.15, L + 0.05],
      [-W + 0.15, 1.15, L + 0.05],
    ],
    "camo",
  );
  // The driver's hatch, the headlamps and the exhaust louvres at the back.
  p.box(0.6, 0.06, 0.5, [-0.55, 1.58, L - 0.95], "dark", 2);
  for (const s of [-1, 1]) p.box(0.2, 0.14, 0.12, [s * (W - 0.45), 1.3, L - 0.2], "lamp", 2);
  p.box(W * 1.4, 0.05, 1.0, [0, 1.58, -L + 0.75], "dark", 2);
  return p.geometry();
}

function tankTurret(): THREE.BufferGeometry {
  const p = new Part({ ...TANK_CAMO, seed: 1.7 });
  const top = 2.55;
  const base = 1.6;
  // The wide flat turret with its wedge front.
  p.hexa(
    [
      [-1.6, base, -2.1],
      [1.6, base, -2.1],
      [1.45, top, -2.0],
      [-1.45, top, -2.0],
      [-1.75, base, 0.9],
      [1.75, base, 0.9],
      [1.5, top, 0.85],
      [-1.5, top, 0.85],
    ],
    "camo",
  );
  p.hexa(
    [
      [-1.75, base, 0.9],
      [1.75, base, 0.9],
      [1.5, top, 0.85],
      [-1.5, top, 0.85],
      [-0.45, base + 0.1, 1.55],
      [0.45, base + 0.1, 1.55],
      [0.4, top - 0.12, 1.45],
      [-0.4, top - 0.12, 1.45],
    ],
    "camo",
  );
  // The stowage basket on its back.
  p.box(2.9, 0.45, 0.55, [0, 2.0, -2.35], "olive", 0.5);
  // The commander's cupola and its sight, the loader's hatch and his gun.
  p.cyl(0.42, 0.28, [0.75, top + 0.14, -0.6], "y", "camo", 12);
  p.box(0.3, 0.32, 0.28, [0.75, top + 0.4, -0.2], "dark", 2);
  p.cyl(0.36, 0.06, [-0.75, top + 0.03, -0.6], "y", "dark", 10);
  p.cyl(0.03, 1.0, [-0.75, top + 0.38, -0.2], "z", "steel", 6);
  // The gunner's sight box on the roof.
  p.box(0.45, 0.35, 0.5, [-0.9, top + 0.17, 0.45], "grey", 2);
  return p.geometry();
}

function tankGun(): THREE.BufferGeometry {
  const p = new Part(null);
  const G = TANK_GUN;
  // The mantlet at the trunnion, then the barrel with its sleeve and bore
  // evacuator, out to the muzzle (the part's +z from the trunnion).
  p.box(0.95, 0.6, 0.6, [0, 0, 0.1], "grey", 2);
  p.cyl(G.radius * 1.5, G.length * 0.45, [0, 0, 0.4 + G.length * 0.225], "z", "white", 12);
  p.cyl(G.radius * 1.8, 0.7, [0, 0, 0.4 + G.length * 0.55], "z", "white", 12);
  p.cyl(G.radius, G.length - 0.4, [0, 0, 0.4 + (G.length - 0.4) / 2], "z", "grey", 12);
  p.cyl(G.radius * 1.2, 0.25, [0, 0, G.length - 0.12], "z", "steel", 12);
  return p.geometry();
}

/** A COMMANDER up in his hatch: a white-hooded head and shoulders. */
function commander(): THREE.BufferGeometry {
  const p = new Part(null);
  p.box(0.48, 0.42, 0.32, [0, 0.21, 0], "white", 2);
  p.cyl(0.13, 0.26, [0, 0.55, 0], "y", "canvas", 10, 0.11);
  p.box(0.2, 0.06, 0.04, [0, 0.56, 0.12], "dark", 2);
  return p.geometry();
}

// ─── the shared geometry ───────────────────────────────────────────────

/** Every part's geometry, built once and shared by every vehicle. */
export type VehicleGeometry = {
  carrierFront: THREE.BufferGeometry;
  carrierRear: THREE.BufferGeometry;
  truck: THREE.BufferGeometry;
  tankHull: THREE.BufferGeometry;
  tankTurret: THREE.BufferGeometry;
  tankGun: THREE.BufferGeometry;
  commander: THREE.BufferGeometry;
};

let shared: VehicleGeometry | null = null;

export function vehicleGeometry(): VehicleGeometry {
  shared ??= {
    carrierFront: carrierFront(),
    carrierRear: carrierRear(),
    truck: truck(),
    tankHull: tankHull(),
    tankTurret: tankTurret(),
    tankGun: tankGun(),
    commander: commander(),
  };
  return shared;
}

/** How many triangles a kind is drawn in, every part together. */
export function vehicleTriangles(kind: ArmyVehicleKind): number {
  const g = vehicleGeometry();
  const tris = (b: THREE.BufferGeometry) => b.getAttribute("position").count / 3;
  if (kind === "carrier") return tris(g.carrierFront) + tris(g.carrierRear) + tris(g.commander);
  if (kind === "truck") return tris(g.truck);
  return tris(g.tankHull) + tris(g.tankTurret) + tris(g.tankGun) + tris(g.commander);
}
