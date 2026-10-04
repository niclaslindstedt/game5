// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STATIONS' PIECES AS BUILT — every piece `station-plan.ts` sets down,
// built in boxes like the rest of the lifts and coloured per vertex, ONE
// INSTANCED DRAW A KIND for the whole resort: the terminal hoods, the
// operators' booths, the wind masts, the patrol hut, the map board, the load
// lines, the stations' doors and canopies, the drag huts, and the corrals'
// rope lines on their poles.

import * as THREE from "three";

import type { Part, PartKind, StationLayout } from "./station-plan.ts";

/** The paints, sRGB. */
export const STATION_PAINT = {
  steel: 0x9aa2a9,
  dark: 0x2a2e33,
  hood: 0xe8e9ea,
  stripe: 0xb5262c,
  glass: 0x2b3a4a,
  walls: 0x8a7a68,
  timber: 0x6b4a2e,
  roof: 0x2f3338,
  load: 0x2f6fd6,
  pole: 0xe8c23a,
  rope: 0x1d1f22,
  patrol: 0xc22a26,
  white: 0xf4f4f2,
  board: 0x3f7d3a,
} as const;
const P = STATION_PAINT;

export type Piece = { geo: THREE.BufferGeometry; colour: number };

/** A box `w × h × d` centred at (x, y, z), in one paint. */
export function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  colour: number,
): Piece {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(x, y, z);
  return { geo, colour };
}

/** Several pieces as ONE geometry, each in its own paint as a vertex
 * colour — one draw for a cabin, not one per pane. */
export function merged(pieces: Piece[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (const { geo, colour } of pieces) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    c.set(colour);
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      col.push(c.r, c.g, c.b);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return out;
}

/** Each piece in its own frame: its foot at the origin (a hood or a canopy
 * at its underside), +z the way it faces, a hood's, a canopy's and a load
 * line's width along x at 1 for the instance to scale. */
const BUILD: Readonly<Record<PartKind, () => THREE.BufferGeometry>> = {
  // A detachable terminal's hood: a long rounded cover over the wheel and
  // the rails, a red band along its flank.
  hood: () =>
    merged([
      box(1, 1.3, 10, 0, 0.65, 0, P.hood),
      box(0.8, 0.35, 9.4, 0, 1.47, 0, P.hood),
      box(1.01, 0.22, 10.02, 0, 0.45, 0, P.stripe),
    ]),
  // The operator's booth: a timber base, glass all round above it, a door
  // on its back, the roof overhanging, the radio mast. Its timber flanks
  // stand a couple of centimetres proud of the glass, never flush with it:
  // two faces in one plane flicker as the depth buffer picks between them.
  booth: () =>
    merged([
      box(2.4, 1.05, 2.4, 0, 0.52, 0, P.timber),
      box(2.42, 1.15, 2.42, 0, 1.6, 0, P.glass),
      box(0.16, 1.15, 2.46, -1.17, 1.6, 0, P.timber),
      box(0.16, 1.15, 2.46, 1.17, 1.6, 0, P.timber),
      box(0.9, 2.0, 0.06, 0.5, 1.0, -1.22, P.dark),
      box(3.0, 0.28, 3.0, 0, 2.32, 0, P.roof),
      box(0.05, 1.4, 0.05, 1.0, 3.1, -1.0, P.dark),
    ]),
  // The wind mast: a slender column, the cups on their arm and the vane.
  mast: () =>
    merged([
      box(0.16, 9, 0.16, 0, 4.5, 0, P.steel),
      box(0.9, 0.05, 0.05, 0, 9.05, 0, P.dark),
      box(0.14, 0.1, 0.14, 0.45, 9.12, 0, P.white),
      box(0.14, 0.1, 0.14, -0.45, 9.12, 0, P.white),
      box(0.05, 0.05, 0.9, 0, 8.7, -0.3, P.dark),
      box(0.03, 0.3, 0.3, 0, 8.7, -0.75, P.stripe),
    ]),
  // The patrol's hut: red walls, a white cross on both flanks, a dark roof
  // and a rescue sled stood against its front.
  patrol: () =>
    merged([
      box(4, 2.6, 3, 0, 1.3, 0, P.patrol),
      box(4.6, 0.3, 3.6, 0, 2.75, 0, P.roof),
      box(0.04, 1.0, 0.3, 2.02, 1.5, 0, P.white),
      box(0.04, 0.3, 1.0, 2.02, 1.5, 0, P.white),
      box(0.04, 1.0, 0.3, -2.02, 1.5, 0, P.white),
      box(0.04, 0.3, 1.0, -2.02, 1.5, 0, P.white),
      box(1.1, 2.0, 0.06, -0.8, 1.0, 1.52, P.dark),
      box(0.7, 1.8, 0.2, 1.2, 0.9, 1.7, P.stripe),
    ]),
  // The piste map board at the head of the dispersal area: two posts and a
  // panel of the mountain, its runs as bands of their colours.
  board: () =>
    merged([
      box(0.12, 2.6, 0.12, -1.15, 1.3, 0, P.timber),
      box(0.12, 2.6, 0.12, 1.15, 1.3, 0, P.timber),
      box(2.4, 1.5, 0.08, 0, 1.85, 0.08, P.white),
      box(2.1, 0.25, 0.02, 0, 2.3, 0.13, P.board),
      box(0.12, 0.9, 0.02, -0.6, 1.7, 0.13, P.load),
      box(0.12, 0.9, 0.02, 0, 1.7, 0.13, P.stripe),
      box(0.12, 0.9, 0.02, 0.6, 1.7, 0.13, P.dark),
      box(2.6, 0.12, 0.3, 0, 2.66, 0.05, P.roof),
    ]),
  // The load line: a blue board laid across the lane, flush with the snow.
  load: () => merged([box(1, 0.04, 0.35, 0, 0.02, 0, P.load)]),
  // A station's door: the dark doorway and its frame, standing proud of
  // the house's face.
  door: () =>
    merged([
      box(3.0, 2.6, 0.08, 0, 1.3, 0.05, P.dark),
      box(3.4, 0.25, 0.14, 0, 2.72, 0.06, P.stripe),
      box(0.2, 2.6, 0.14, -1.6, 1.3, 0.06, P.steel),
      box(0.2, 2.6, 0.14, 1.6, 1.3, 0.06, P.steel),
    ]),
  // A gondola station's canopy over its platform and wheel.
  canopy: () =>
    merged([box(1, 0.35, 12, 0, 0.18, 0, P.roof), box(1.01, 0.5, 0.3, 0, 0.1, 6, P.stripe)]),
  // A drag's operator hut.
  hut: () =>
    merged([
      box(2.2, 2.2, 2.2, 0, 1.1, 0, P.timber),
      box(1.4, 0.7, 0.04, 0, 1.5, 1.11, P.glass),
      box(2.7, 0.25, 2.7, 0, 2.3, 0, P.roof),
    ]),
};

/** A hood, a canopy and a load line are scaled across to their width. */
const WIDE: ReadonlySet<PartKind> = new Set(["hood", "canopy", "load"]);

/** A fence's poles: every so far along it, m, and how tall; the rope's
 * height. */
const POLE_EVERY = 2.2;
const POLE = 1.25;
const ROPE_AT = 0.95;

/** Every station's pieces and fences as instanced meshes, added to
 * `group`; the geometries and meshes made are pushed for disposal. */
export function buildStations(
  layout: StationLayout,
  groundAt: (x: number, z: number) => number,
  painted: THREE.Material,
  group: THREE.Group,
  geos: THREE.BufferGeometry[],
  meshes: THREE.InstancedMesh[],
): void {
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3();
  const size = new THREE.Vector3();
  const add = (
    geo: THREE.BufferGeometry,
    placed: { p: THREE.Vector3; yaw: number; s: THREE.Vector3 }[],
    shadow = true,
  ) => {
    geos.push(geo);
    if (placed.length === 0) return;
    const mesh = new THREE.InstancedMesh(geo, painted, placed.length);
    placed.forEach((o, i) =>
      mesh.setMatrixAt(i, m4.compose(o.p, q.setFromAxisAngle(up, o.yaw), o.s)),
    );
    mesh.instanceMatrix.needsUpdate = true;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
    group.add(mesh);
  };
  const byKind = new Map<PartKind, Part[]>();
  for (const part of layout.parts) {
    const list = byKind.get(part.kind) ?? [];
    list.push(part);
    byKind.set(part.kind, list);
  }
  for (const [kind, list] of byKind) {
    add(
      BUILD[kind](),
      list.map((p) => ({
        p: at.clone().set(p.x, p.y, p.z),
        yaw: p.yaw,
        s: size.clone().set(WIDE.has(kind) ? p.size : 1, 1, 1),
      })),
      kind !== "load",
    );
  }
  // THE FENCES: a rope stretched between each pair of poles, every pole on
  // the snow under it.
  const poles: { p: THREE.Vector3; yaw: number; s: THREE.Vector3 }[] = [];
  const spans: { p: THREE.Vector3; yaw: number; s: THREE.Vector3 }[] = [];
  for (const f of layout.fences) {
    const dx = f.b.x - f.a.x;
    const dz = f.b.z - f.a.z;
    const len = Math.hypot(dx, dz);
    const n = Math.max(1, Math.round(len / POLE_EVERY));
    const yaw = Math.atan2(dx, dz) - Math.PI / 2;
    for (let i = 0; i <= n; i++) {
      const x = f.a.x + (dx * i) / n;
      const z = f.a.z + (dz * i) / n;
      poles.push({
        p: new THREE.Vector3(x, groundAt(x, z), z),
        yaw,
        s: new THREE.Vector3(1, 1, 1),
      });
      if (i === n) continue;
      const mx = f.a.x + (dx * (i + 0.5)) / n;
      const mz = f.a.z + (dz * (i + 0.5)) / n;
      spans.push({
        p: new THREE.Vector3(mx, groundAt(mx, mz), mz),
        yaw,
        s: new THREE.Vector3(len / n, 1, 1),
      });
    }
  }
  add(merged([box(0.05, POLE, 0.05, 0, POLE / 2, 0, P.pole)]), poles, false);
  add(merged([box(1, 0.035, 0.035, 0, ROPE_AT, 0, P.rope)]), spans, false);
}
