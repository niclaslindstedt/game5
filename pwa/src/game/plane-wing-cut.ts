// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A WING TORN OFF, AS DRAWN — the airframe's wings cut out of it once, so a
// side the engine has torn off (`PlaneState.wings`, `engine/game/plane-wings.ts`)
// is put away while the plane flies on, and drawn instead as a LOOSE PIECE
// where the engine flies it down and slides it to rest (`TornWing`).
//
// Every mesh under the airframe (the Blender model's or the stand-in's) has
// its wing triangles moved into a child of its own, a side each, by the same
// line the wreck cuts its wing pieces along (`plane-shatter.ts`'s `TEAR`:
// outboard of the struts' feet and above the wing's underside) — a child, so
// an aileron or a flap cut this way still turns on its hinge. The loose piece
// shares those geometries, placed off the wing's middle (`wingMiddle`), which
// is the point the engine flies. Each child is marked (`userData.wingCut`, its
// side) so the wreck leaves a side already torn off out of its pieces.

import * as THREE from "three";
import { PLANE, wingMiddle, type PlaneState, type TornWing } from "@engine";

import { TEAR } from "./plane-shatter.ts";

const ROOT_X = PLANE.struts.foot.x;

/** Which wing a triangle centred at `c` (airframe frame) is on: 0 the left
 * (the engine's +x), 1 the right, or −1 none. */
export function wingSideOf(c: { x: number; y: number }): -1 | 0 | 1 {
  if (Math.abs(c.x) <= ROOT_X || c.y <= TEAR.wing) return -1;
  return c.x > 0 ? 0 : 1;
}

export type WingCut = {
  /** The loose pieces, world frame: added to the scene beside the airframe. */
  debris: THREE.Group;
  /** One frame: the torn sides put away on the airframe and their loose
   * pieces placed where the engine has them — or, `keep`ing them, where they
   * last lay once the ride is begun again beside a wreck still drawn. */
  pose(p: PlaneState, keep?: boolean): void;
  dispose(): void;
};

/** The triangles `tris` (each the index of its first corner in draw order)
 * of `g` as a geometry of their own, unindexed, every attribute carried and
 * the material groups kept. */
function subset(g: THREE.BufferGeometry, tris: number[], mats: number[]): THREE.BufferGeometry {
  const index = g.getIndex();
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(g.attributes)) {
    const src = g.getAttribute(name) as THREE.BufferAttribute;
    const n = src.itemSize;
    const arr = new (src.array.constructor as Float32ArrayConstructor)(tris.length * 3 * n);
    let k = 0;
    for (const t of tris) {
      for (let c = 0; c < 3; c++) {
        const v = index ? index.getX(t + c) : t + c;
        for (let j = 0; j < n; j++) arr[k++] = src.getComponent(v, j);
      }
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, n, src.normalized));
  }
  let start = 0;
  for (let i = 1; i <= mats.length; i++) {
    if (i === mats.length || mats[i] !== mats[start]) {
      out.addGroup(start * 3, (i - start) * 3, mats[start]);
      start = i;
    }
  }
  return out;
}

/** Cut the wings out of every mesh under `root`, read in the frame of
 * `frame` (the engine's body frame), at rest. */
export function cutWings(root: THREE.Object3D, frame: THREE.Object3D): WingCut {
  frame.updateMatrixWorld(true);
  const toFrame = new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const cuts: [THREE.Mesh[], THREE.Mesh[]] = [[], []];
  const debris = new THREE.Group();
  debris.name = "plane-torn-wings";
  const loose: [THREE.Object3D, THREE.Object3D] = [new THREE.Object3D(), new THREE.Object3D()];
  const geometries: THREE.BufferGeometry[] = [];
  const meshes: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !(o instanceof THREE.SkinnedMesh)) meshes.push(o);
  });
  for (const o of meshes) {
    const g = o.geometry as THREE.BufferGeometry;
    const pos = g.getAttribute("position");
    if (!pos) continue;
    const index = g.getIndex();
    m.multiplyMatrices(toFrame, o.matrixWorld);
    const groups = g.groups.length
      ? g.groups
      : [{ start: 0, count: index ? index.count : pos.count, materialIndex: 0 }];
    const tris: [number[], number[], number[]] = [[], [], []];
    const mats: [number[], number[], number[]] = [[], [], []];
    for (const grp of groups) {
      for (let i = grp.start; i + 2 < grp.start + grp.count; i += 3) {
        a.fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(m);
        b.fromBufferAttribute(pos, index ? index.getX(i + 1) : i + 1).applyMatrix4(m);
        c.fromBufferAttribute(pos, index ? index.getX(i + 2) : i + 2).applyMatrix4(m);
        const side = wingSideOf({ x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 });
        const k: 0 | 1 | 2 = side === -1 ? 2 : side;
        tris[k].push(i);
        mats[k].push(grp.materialIndex ?? 0);
      }
    }
    if (!tris[0].length && !tris[1].length) continue;
    const rest = subset(g, tris[2], mats[2]);
    o.geometry = rest;
    geometries.push(rest);
    for (const side of [0, 1] as const) {
      if (!tris[side].length) continue;
      const part = subset(g, tris[side], mats[side]);
      geometries.push(part);
      // On the airframe: a child, so it turns with its node.
      const on = new THREE.Mesh(part, o.material);
      on.castShadow = true;
      on.userData.wingCut = side;
      o.add(on);
      cuts[side].push(on);
      // The loose piece: the same triangles off the wing's middle.
      const mid = wingMiddle(side);
      const off = new THREE.Mesh(part, o.material);
      off.castShadow = true;
      off.matrixAutoUpdate = false;
      off.matrix.makeTranslation(-mid.x, -mid.y, -mid.z).multiply(m);
      loose[side].add(off);
    }
    g.dispose();
  }
  for (const l of loose) {
    l.visible = false;
    debris.add(l);
  }
  const last: [TornWing | null, TornWing | null] = [null, null];
  return {
    debris,
    pose(p, keep = false) {
      for (const side of [0, 1] as const) {
        const own = p.wings?.[side]?.torn ?? null;
        for (const on of cuts[side]) on.visible = !own;
        const t = own ?? (keep ? last[side] : null);
        last[side] = t;
        const l = loose[side];
        l.visible = !!t;
        if (!t) continue;
        l.position.set(t.x, t.y, t.z);
        l.quaternion.set(t.q.x, t.q.y, t.q.z, t.q.w);
      }
    },
    dispose() {
      for (const g of geometries) g.dispose();
      debris.removeFromParent();
    },
  };
}
