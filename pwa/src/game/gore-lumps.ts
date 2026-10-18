// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT WAS THROWN OUT OF HIM, AS DRAWN — the organs, the gobbets, the
// pieces of skull and the bones (`gore-view.ts` throws them, `gore-gibs.ts`
// flies each as a lump). A hit at speed throws dozens, and a mesh each was
// two draws each (the picture and the sun's map) for as long as they lay
// there. So every lump of one shape in flight is an instance of one mesh,
// in blocks of `BLOCK` (a block more when one fills), sent only when one of
// its lumps has moved; and a lump that has lain still `SETTLE` s is BAKED
// where it lies into one mesh with every other that has — two draws for
// all of them, however many shapes — and leaves its block.

import * as THREE from "three";

import { stepLump, type GibGround, type Lump } from "./gore-gibs.ts";

/** How many lumps of one shape a block holds. */
const BLOCK = 24;
/** How far a lump moves, m, or turns, rad / 10, before it is drawn again:
 * a millimetre, under a pixel wherever it is seen from. */
const STILL = 1e-3;
/** A lump slower than this, m/s, and turning slower than `REST_SPIN`
 * rad/s lies still: the snow under one holds it creeping a centimetre or
 * two a second. How long it must, s, before it is baked. */
const REST_SPEED = 0.05;
const REST_SPIN = 0.5;
const SETTLE = 1;
/** The least time between two bakes, s: each rebuilds the baked mesh. */
const BAKE_EVERY = 0.5;

export type Lumps = {
  group: THREE.Group;
  /** Throw a lump of shape `geo` (shared, never disposed here) on its
   * flight, drawn `scale` times its shape. */
  add(geo: THREE.BufferGeometry, lump: Lump, scale?: number): void;
  /** Every lump flown `dt` s on and placed where it is. */
  update(ground: GibGround, dt: number): void;
  /** How many have been thrown. */
  count(): number;
  /** Every lump gone. */
  clear(): void;
  dispose(): void;
};

/** A block's mesh, its lumps, each one's size, where each was last drawn
 * (x, y, z, turn) and how long each has lain still, s. */
type Block = {
  mesh: THREE.InstancedMesh;
  lumps: Lump[];
  size: number[];
  drawn: Float32Array;
  rest: number[];
};

const m = new THREE.Matrix4();
const p = new THREE.Vector3();
const q = new THREE.Quaternion();
const s = new THREE.Vector3(1, 1, 1);
const axis = new THREE.Vector3();
const nm = new THREE.Matrix3();

/** `parts` (a shape and where it lies, or none for one already in the
 * world) as one geometry: positions, normals and colours, indexed. */
function merged(parts: { geo: THREE.BufferGeometry; at: THREE.Matrix4 | null }[]) {
  let verts = 0;
  let ids = 0;
  for (const { geo } of parts) {
    verts += geo.getAttribute("position").count;
    ids += geo.index ? geo.index.count : geo.getAttribute("position").count;
  }
  const pos = new Float32Array(verts * 3);
  const nor = new Float32Array(verts * 3);
  const col = new Float32Array(verts * 3).fill(1);
  const index = new Uint32Array(ids);
  let at = 0;
  let k = 0;
  for (const { geo, at: M } of parts) {
    const P = geo.getAttribute("position");
    const N = geo.getAttribute("normal");
    const C = geo.getAttribute("color");
    if (M) nm.getNormalMatrix(M);
    for (let i = 0; i < P.count; i++) {
      p.fromBufferAttribute(P, i);
      if (M) p.applyMatrix4(M);
      p.toArray(pos, 3 * (at + i));
      if (N) {
        p.fromBufferAttribute(N, i);
        if (M) p.applyMatrix3(nm).normalize();
        p.toArray(nor, 3 * (at + i));
      }
      if (C) {
        col[3 * (at + i)] = C.getX(i);
        col[3 * (at + i) + 1] = C.getY(i);
        col[3 * (at + i) + 2] = C.getZ(i);
      }
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) index[k++] = at + geo.index.getX(i);
    else for (let i = 0; i < P.count; i++) index[k++] = at + i;
    at += P.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

export function createLumps(material: THREE.Material): Lumps {
  const group = new THREE.Group();
  group.name = "gore-lumps";
  const blocks = new Map<THREE.BufferGeometry, Block[]>();
  let thrown = 0;
  /** Every lump that lay still, in the world; and the time since the last bake. */
  let baked: THREE.Mesh | null = null;
  let since = 0;

  const blockFor = (geo: THREE.BufferGeometry): Block => {
    let list = blocks.get(geo);
    if (!list) blocks.set(geo, (list = []));
    const last = list[list.length - 1];
    if (last && last.lumps.length < BLOCK) return last;
    const mesh = new THREE.InstancedMesh(geo, material, BLOCK);
    mesh.count = 0;
    mesh.castShadow = true;
    // Strewn round the body and beyond it; a block is never off the screen for long.
    mesh.frustumCulled = false;
    group.add(mesh);
    const block = { mesh, lumps: [], size: [], drawn: new Float32Array(BLOCK * 4), rest: [] };
    list.push(block);
    return block;
  };

  const place = (block: Block, i: number): void => {
    const o = block.lumps[i];
    const d = block.drawn;
    d[4 * i] = o.p.x;
    d[4 * i + 1] = o.p.y;
    d[4 * i + 2] = o.p.z;
    d[4 * i + 3] = o.turn;
    p.set(o.p.x, o.p.y, o.p.z);
    q.setFromAxisAngle(axis.set(o.axis.x, o.axis.y, o.axis.z), o.turn);
    m.compose(p, q, s.setScalar(block.size[i]));
    block.mesh.setMatrixAt(i, m);
  };

  const drop = (block: Block): void => {
    group.remove(block.mesh);
    block.mesh.dispose();
  };

  /** Every lump that has lain still `SETTLE` s baked into the one mesh and
   * taken out of its block; a block left empty let go. */
  const bake = (): void => {
    const parts: { geo: THREE.BufferGeometry; at: THREE.Matrix4 | null }[] = [];
    if (baked) parts.push({ geo: baked.geometry, at: null });
    for (const [geo, list] of blocks) {
      for (const block of list) {
        const keep: number[] = [];
        block.lumps.forEach((_, i) => {
          if (block.rest[i] < SETTLE) return void keep.push(i);
          parts.push({ geo, at: block.mesh.getMatrixAt(i, new THREE.Matrix4()) });
        });
        if (keep.length === block.lumps.length) continue;
        block.lumps = keep.map((i) => block.lumps[i]);
        block.size = keep.map((i) => block.size[i]);
        block.rest = keep.map((i) => block.rest[i]);
        block.lumps.forEach((_, i) => place(block, i));
        block.mesh.count = block.lumps.length;
        block.mesh.instanceMatrix.needsUpdate = true;
      }
      const left = list.filter((b) => b.lumps.length > 0);
      for (const b of list) if (b.lumps.length === 0) drop(b);
      if (left.length) blocks.set(geo, left);
      else blocks.delete(geo);
    }
    const geo = merged(parts);
    if (baked) {
      baked.geometry.dispose();
      baked.geometry = geo;
    } else {
      baked = new THREE.Mesh(geo, material);
      baked.castShadow = true;
      baked.frustumCulled = false;
      group.add(baked);
    }
  };

  return {
    group,
    add(geo, lump, scale = 1) {
      const block = blockFor(geo);
      block.lumps.push(lump);
      block.size.push(scale);
      block.rest.push(0);
      block.mesh.count = block.lumps.length;
      place(block, block.lumps.length - 1);
      block.mesh.instanceMatrix.needsUpdate = true;
      thrown++;
    },
    update(ground, dt) {
      let settled = false;
      for (const list of blocks.values()) {
        for (const block of list) {
          let moved = false;
          const d = block.drawn;
          block.lumps.forEach((o, i) => {
            stepLump(o, ground, dt);
            const k = 4 * i;
            const far =
              Math.abs(o.p.x - d[k]) + Math.abs(o.p.y - d[k + 1]) + Math.abs(o.p.z - d[k + 2]);
            // Judged on a real frame's step only: a still one (a twin, a pause) tells nothing.
            if (dt >= 1e-3) {
              const step = Math.hypot(o.p.x - o.l.x, o.p.y - o.l.y, o.p.z - o.l.z);
              block.rest[i] = step < REST_SPEED * dt && o.spin < REST_SPIN ? block.rest[i] + dt : 0;
            }
            settled ||= block.rest[i] >= SETTLE;
            if (far < STILL && Math.abs(o.turn - d[k + 3]) < 10 * STILL) return;
            place(block, i);
            moved = true;
          });
          if (moved) block.mesh.instanceMatrix.needsUpdate = true;
        }
      }
      since += dt;
      if (settled && since >= BAKE_EVERY) {
        bake();
        since = 0;
      }
    },
    count: () => thrown,
    clear() {
      for (const list of blocks.values()) for (const block of list) drop(block);
      blocks.clear();
      if (baked) {
        group.remove(baked);
        baked.geometry.dispose();
        baked = null;
      }
      since = 0;
      thrown = 0;
    },
    dispose() {
      this.clear();
    },
  };
}

/** THE PRIMER: one draw of each kind a hit adds — a lump, a plain piece of
 * flesh (a stump, the opened trunk, a gut) and the skin of a piece torn off
 * (`piece`) — standing in the view while the renderer compiles the world
 * behind its loading card, so no program is linked the moment he is torn
 * apart. Each draws one triangle with no area. Hidden after, and never
 * disposed while the view lives: a material let go takes its program. */
export function gorePrimer(
  flesh: THREE.Material,
  piece: THREE.Object3D,
): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  group.name = "gore-primer";
  const geo = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "color"])
    geo.setAttribute(name, new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  const lump = new THREE.InstancedMesh(geo, flesh, 1);
  lump.setMatrixAt(0, new THREE.Matrix4());
  const plain = new THREE.Mesh(geo, flesh);
  for (const o of [lump, plain]) {
    o.castShadow = true;
    o.frustumCulled = false;
    group.add(o);
  }
  group.add(piece);
  return {
    group,
    dispose() {
      lump.dispose();
      geo.dispose();
    },
  };
}
