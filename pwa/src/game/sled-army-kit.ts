// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S SNOWMOBILE KIT — what turns the free ride's machine into the
// army's (`SledLivery` "army", `army-sled.ts`): drawn over the model's own
// parts, in the TRACE'S frame (`sled-look.ts`: z forward from the tunnel's
// end, y up from the snow under the belt), by every drawer of a machine —
// the army's own (`army-sled-view.ts`) and one the player has stolen
// (`sled-view.ts`, `sled-livery.ts`' fleet).
//
// WHAT AN ARMY'S OVER-SNOW SLED LOOKS LIKE (`docs/army.md` has the
// research): a long-track utility machine, two up — a long seat with a
// pillion and grab handles — and a tubular cargo rack over the tunnel's
// end carrying the crew's kit, a fuel can and a radio's whip antenna;
// painted a flat olive drab, and in snow theatres given white panels or
// daubed with a temporary white over the green, broken blotches that
// cross the panels as a brush would (as the army's helicopter is). Its
// lamps are kept; a blackout lamp sits low on the nose. No markings but
// a low-visibility number.

import * as THREE from "three";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { SLED_LOOK } from "./sled-look.ts";

type P = readonly [number, number];

/** THE KIT's colours, sRGB: the olive the model's paint is tinted to
 * (`LIVERIES.army`), the white daubed over it, the seat's and the rack's
 * black, the canvas of the packs, the fuel can's darker green. */
export const ARMY_SLED_COLOURS = {
  olive: 0x5a6340,
  white: 0xe7e9e6,
  black: 0x1b1c1a,
  canvas: 0xd9dcd6,
  can: 0x3c4428,
  number: 0x6f7568,
} as const;

/** THE KIT'S PLACES in the trace's frame, m: the pillion's pad behind the
 * driver's seat (from, to along z, its top, its width), the grab handles
 * either side of it, the rack over the tunnel's end (from, to, its height,
 * its width), the fuel can and the pack on it, and the whip antenna. */
export const ARMY_SLED_KIT = {
  pillion: { from: 0.66, to: 1.18, top: 0.9, width: 0.4 },
  grab: { z: 0.78, y: 0.97, out: 0.24 },
  rack: { from: 0.04, to: 0.64, y: 0.86, width: 0.46, rail: 0.016 },
  can: { z: 0.22, x: -0.1, size: [0.17, 0.32, 0.26] as const },
  pack: { z: 0.42, x: 0.08, size: [0.32, 0.22, 0.3] as const },
  whip: { z: 0.08, x: 0.2, height: 1.6 },
  /** THE WHITE DAUBED ON, as blotches in the side's (z, y): each its
   * middle and its radius, m — on the hood's side and the tunnel's. */
  hood: [
    [2.05, 0.62, 0.17],
    [2.5, 0.78, 0.13],
    [1.8, 0.42, 0.12],
    [2.62, 0.5, 0.09],
  ] as readonly (readonly [number, number, number])[],
  tunnel: [
    [0.45, 0.6, 0.09],
    [1.1, 0.46, 0.1],
    [0.8, 0.56, 0.06],
  ] as readonly (readonly [number, number, number])[],
} as const;

/** Whether (z, y) lies inside the closed outline `poly`. */
function inside(poly: readonly P[], z: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [zi, yi] = poly[i];
    const [zj, yj] = poly[j];
    if (yi > y !== yj > y && z < ((zj - zi) * (y - yi)) / (yj - yi) + zi) hit = !hit;
  }
  return hit;
}

/** ONE BLOTCH on a side, as a fan: a ragged circle round (z, y), every
 * rim point pulled in until it lies inside `poly`, laid at `x(z)` out of
 * the side `s` (+1 the right, the trace's +x). */
function blotch(
  out: number[],
  poly: readonly P[],
  [cz, cy, r]: readonly [number, number, number],
  x: (z: number) => number,
  s: number,
  seed: number,
): void {
  const N = 14;
  const rim: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    // A brush's rag: a few lobes, the same on every machine.
    const k = r * (0.75 + 0.18 * Math.sin(3 * a + seed) + 0.1 * Math.cos(5 * a + 2 * seed));
    let z = cz + Math.cos(a) * k * 1.4;
    let y = cy + Math.sin(a) * k;
    for (let t = 0; t < 8 && !inside(poly, z, y); t++) {
      z = cz + (z - cz) * 0.8;
      y = cy + (y - cy) * 0.8;
    }
    rim.push([z, y]);
  }
  for (let i = 0; i < N; i++) {
    const [z0, y0] = rim[i];
    const [z1, y1] = rim[(i + 1) % N];
    // Wound to face out of side `s`.
    const tri = [
      [cz, cy],
      [z0, y0],
      [z1, y1],
    ];
    if (s < 0) tri.reverse();
    for (const [z, y] of tri) out.push(s * x(z), y, z);
  }
}

/** The hood's side's distance out from the middle at `z` (it narrows to
 * the nose), and the tunnel's, m — just proud of the panel. */
const hoodSide = (z: number): number => {
  const k = Math.min(1, Math.max(0, (z - 1.7) / (2.9 - 1.7)));
  return (SLED_LOOK.hoodWidth / 2) * (1 - k) + (SLED_LOOK.noseWidth / 2) * k + 0.05;
};
const tunnelSide = (): number => SLED_LOOK.tunnelWidth / 2 + 0.02;

/** The tunnel's side as a closed outline in (z, y): its top edge back to
 * front, its bottom front to back. */
function tunnelOutline(): P[] {
  return [...SLED_LOOK.tunnelTop, ...[...SLED_LOOK.tunnelBottom].reverse()] as P[];
}

export type ArmySledKit = {
  /** In the trace's frame: hang it beside the model. */
  group: THREE.Group;
  dispose(): void;
};

/** The kit's materials, shared by every kit one drawer builds. */
export type ArmyKitMaterials = {
  white: THREE.MeshStandardMaterial;
  black: THREE.MeshStandardMaterial;
  canvas: THREE.MeshStandardMaterial;
  can: THREE.MeshStandardMaterial;
  all: THREE.Material[];
};

export function armyKitMaterials(haze: HazeUniforms): ArmyKitMaterials {
  const C = ARMY_SLED_COLOURS;
  const mat = (colour: number, rough: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    hazeMaterial(
      new THREE.MeshStandardMaterial({ color: colour, roughness: rough, ...extra }),
      haze,
      "sled-kit",
    );
  const white = mat(C.white, 0.9, { polygonOffset: true, polygonOffsetFactor: -2 });
  const black = mat(C.black, 0.7, { metalness: 0.2 });
  const canvas = mat(C.canvas, 0.95);
  const can = mat(C.can, 0.6, { metalness: 0.3 });
  return { white, black, canvas, can, all: [white, black, canvas, can] };
}

/** THE ARMY'S KIT on one machine, in `mats`. */
export function armySledKit(mats: ArmyKitMaterials): ArmySledKit {
  const K = ARMY_SLED_KIT;
  const group = new THREE.Group();
  group.name = "army-sled-kit";
  const geometries: THREE.BufferGeometry[] = [];
  const box = (
    m: THREE.Material,
    w: number,
    h: number,
    l: number,
    x: number,
    y: number,
    z: number,
  ): THREE.Mesh => {
    const g = new THREE.BoxGeometry(w, h, l);
    geometries.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    group.add(mesh);
    return mesh;
  };
  // THE WHITE DAUBED OVER THE OLIVE, both sides of the hood and the tunnel.
  const daub: number[] = [];
  const hood = SLED_LOOK.hood as readonly P[];
  const tunnel = tunnelOutline();
  for (const s of [-1, 1]) {
    K.hood.forEach((b, i) => blotch(daub, hood, b, hoodSide, s, i + (s > 0 ? 0 : 3)));
    K.tunnel.forEach((b, i) => blotch(daub, tunnel, b, tunnelSide, s, i + 7));
  }
  const patches = new THREE.BufferGeometry();
  patches.setAttribute("position", new THREE.Float32BufferAttribute(daub, 3));
  patches.computeVertexNormals();
  geometries.push(patches);
  group.add(new THREE.Mesh(patches, mats.white));
  // A white panel over the hood's top, the machine's winter cover.
  box(mats.white, SLED_LOOK.hoodWidth * 0.62, 0.012, 0.4, 0, 1.05, 2.12).rotation.x = -0.3;
  // THE PILLION: a pad behind the driver's seat, a grab handle each side.
  const P = K.pillion;
  box(mats.black, P.width, 0.1, P.to - P.from, 0, P.top - 0.05, (P.from + P.to) / 2);
  for (const s of [-1, 1]) {
    box(mats.black, 0.03, 0.03, 0.22, s * K.grab.out, K.grab.y, K.grab.z);
    box(mats.black, 0.025, 0.12, 0.025, s * K.grab.out, K.grab.y - 0.07, K.grab.z - 0.1);
  }
  // THE RACK over the tunnel's end: two side rails, a cross rail at each
  // end and its posts down to the tunnel.
  const R = K.rack;
  const len = R.to - R.from;
  for (const s of [-1, 1]) {
    box(mats.black, R.rail, R.rail, len, (s * R.width) / 2, R.y, R.from + len / 2);
    box(mats.black, R.rail, 0.16, R.rail, (s * R.width) / 2, R.y - 0.08, R.from + 0.05);
    box(mats.black, R.rail, 0.16, R.rail, (s * R.width) / 2, R.y - 0.08, R.to - 0.05);
  }
  for (const z of [R.from, R.to]) box(mats.black, R.width, R.rail, R.rail, 0, R.y, z);
  // ...and on it, a fuel can and a white-covered pack.
  const c = K.can;
  box(mats.can, c.size[0], c.size[1], c.size[2], c.x, R.y + c.size[1] / 2, c.z);
  const p = K.pack;
  box(mats.canvas, p.size[0], p.size[1], p.size[2], p.x, R.y + p.size[1] / 2, p.z);
  // THE RADIO'S WHIP, off the rack's corner.
  const W = K.whip;
  const rod = new THREE.CylinderGeometry(0.004, 0.009, W.height, 5);
  geometries.push(rod);
  const whip = new THREE.Mesh(rod, mats.black);
  whip.position.set(W.x, R.y + W.height / 2, W.z);
  whip.rotation.x = -0.12;
  group.add(whip);
  return {
    group,
    dispose() {
      for (const g of geometries) g.dispose();
    },
  };
}
