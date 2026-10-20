// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HIS KIT OUT OF THE BAG'S WAY — the skis and the poles a dead rider left
// lying (the parts of `gore-view.ts`' statue of him that are not him) can
// come to rest just where the police lay the bag beside him. Evidence is
// photographed where it lies and only then collected: so once the last
// photograph is taken the photographer kneels where the bag will lie,
// gathers up every piece of kit any of which lies there (a modelled pair is
// one mesh: it is split into its skis, and only the one in the way is
// taken), and carries it aboard at his side as evidence (`police-plan.ts`'
// `kit` times it). What lies clear of the bag stays where it lay, as the
// blood and the pieces of him do. Presentation only, read off the frame
// `police-remains.ts` is handed.

import * as THREE from "three";

import type { Remains } from "./gore-remains.ts";
import type { PolicePlan } from "./police-plan.ts";
import type { CrewPose } from "./rescue-defs.ts";

/** THE KIT GATHERED, this frame: where the bag will lie (its middle and its
 * heading), how far the photographer has got gathering it up (0 … 1), and
 * where he is (`hand`: his feet and his heading; null once he is aboard). */
export type KitFrame = {
  x: number;
  z: number;
  heading: number;
  pick: number;
  hand: { x: number; y: number; z: number; heading: number } | null;
};

/** A police call's kit at its clock `t`, off its plan and the
 * photographer's pose. */
export function kitOf(plan: PolicePlan, photo: CrewPose, t: number): KitFrame {
  const k = plan.kit;
  const pick = Math.max(0, Math.min(1, (t - k.t0) / (k.t1 - k.t0 || 1)));
  return {
    x: k.x,
    z: k.z,
    heading: k.heading,
    pick,
    hand: photo.shown ? { x: photo.x, y: photo.y, z: photo.z, heading: photo.heading } : null,
  };
}

/** Each body's kit in the bag's way. */
const kits = new WeakMap<Remains, Kit[]>();

/** The largest a part of the statue that is not his skin can be and still
 * be on him (a stump, a wound — not a ski or a pole), m: anything larger is
 * his kit. */
export const SMALL = 0.45;

/** How near two pieces' boxes must come to be one piece of kit, m. */
const TOUCH = 0.03;

/** THE BAG'S FOOTPRINT, and the room past it a part of his kit must be
 * clear by to be left lying: half its length and its half-width, m. */
const BAG_HALF = { along: 1.0, across: 0.36, room: 0.2 } as const;

/** One part of his kit in the bag's way: its own group (moved as a whole),
 * and its frame at rest in the statue's frame — its middle and a turn that
 * lays its length along x. */
type Kit = { group: THREE.Group; at: THREE.Vector3; turn: THREE.Quaternion };

const v = new THREE.Vector3();
const far = new THREE.Vector3();
const across = new THREE.Vector3();
const up = new THREE.Vector3(0, 1, 0);
const basis = new THREE.Matrix4();

/** A frame whose x is `length` (unit) and whose y is as near up as it can be. */
function frameAlong(length: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  across.crossVectors(length, up);
  if (across.lengthSq() < 1e-6) across.set(0, 0, 1);
  across.normalize();
  v.crossVectors(across, length).normalize();
  basis.makeBasis(length, v, across);
  return out.setFromRotationMatrix(basis);
}

/** The triangles of `mesh` (as index triples) in clusters: the pieces it
 * is built of (triangles sharing a vertex), and pieces whose boxes touch
 * one cluster — so a ski and its binding are one, and two skis apart are
 * two. */
function clustersOf(g: THREE.BufferGeometry): number[][] {
  const pos = g.getAttribute("position");
  const index = g.index;
  const tris = (index ? index.count : pos.count) / 3;
  const at = (i: number): number => (index ? index.getX(i) : i);
  // The pieces: union-find over the vertices each triangle joins.
  const root = new Int32Array(pos.count).map((_, i) => i);
  const find = (i: number): number => {
    while (root[i] !== i) i = root[i] = root[root[i]];
    return i;
  };
  for (let t = 0; t < tris; t++) {
    const a = find(at(3 * t));
    for (const k of [1, 2]) {
      const b = find(at(3 * t + k));
      if (b !== a) root[b] = a;
    }
  }
  const pieces = new Map<number, { tris: number[]; box: THREE.Box3 }>();
  for (let t = 0; t < tris; t++) {
    const id = find(at(3 * t));
    let p = pieces.get(id);
    if (!p) pieces.set(id, (p = { tris: [], box: new THREE.Box3() }));
    p.tris.push(at(3 * t), at(3 * t + 1), at(3 * t + 2));
    for (const k of [0, 1, 2]) p.box.expandByPoint(v.fromBufferAttribute(pos, at(3 * t + k)));
  }
  // Pieces whose boxes touch, one cluster.
  const list = [...pieces.values()];
  for (const p of list) p.box.expandByScalar(TOUCH);
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < list.length && !merged; i++)
      for (let j = i + 1; j < list.length; j++)
        if (list[i].box.intersectsBox(list[j].box)) {
          list[i].tris.push(...list[j].tris);
          list[i].box.union(list[j].box);
          list.splice(j, 1);
          merged = true;
          break;
        }
  }
  return list.map((p) => p.tris);
}

/** THE STATUE'S KIT IN THE BAG'S WAY: of the parts that are not him (his
 * skis and his poles, a merged pair of skis as one mesh), each piece any
 * point of which lies under where the bag will be laid, split off its mesh
 * into a mesh of its own under a group of its own, and its rest frame. */
function kitOfStatue(r: Remains, k: KitFrame, him: THREE.Object3D): Kit[] {
  const had = kits.get(r);
  if (had) return had;
  const o = r.body.position;
  const f = { x: Math.sin(k.heading), z: Math.cos(k.heading) };
  const under = (p: THREE.Vector3): boolean => {
    const dx = o.x + p.x - k.x;
    const dz = o.z + p.z - k.z;
    const along = dx * f.x + dz * f.z;
    const side = dx * f.z - dz * f.x;
    return (
      Math.abs(along) < BAG_HALF.along + BAG_HALF.room &&
      Math.abs(side) < BAG_HALF.across + BAG_HALF.room
    );
  };
  const out: Kit[] = [];
  for (const child of [...r.body.children]) {
    const mesh = child as THREE.Mesh;
    if (child === him || !mesh.isMesh) continue;
    const sphere = mesh.geometry.boundingSphere;
    if (!sphere || sphere.radius <= SMALL) continue;
    const g = mesh.geometry;
    const pos = g.getAttribute("position");
    const left: number[] = [];
    let took = false;
    for (const tris of clustersOf(g)) {
      if (!tris.some((i) => under(v.fromBufferAttribute(pos, i)))) {
        left.push(...tris);
        continue;
      }
      took = true;
      // Its middle, and its length: the way to its point furthest out.
      const mid = new THREE.Vector3();
      for (const i of tris) mid.add(v.fromBufferAttribute(pos, i));
      mid.divideScalar(tris.length);
      let most = -1;
      for (const i of tris) {
        const d = v.fromBufferAttribute(pos, i).distanceToSquared(mid);
        if (d > most) {
          most = d;
          far.copy(v);
        }
      }
      const piece = new THREE.BufferGeometry();
      for (const [name, a] of Object.entries(g.attributes)) piece.setAttribute(name, a);
      piece.setIndex(tris);
      piece.boundingSphere = new THREE.Sphere(mid.clone(), Math.sqrt(most));
      const part = new THREE.Mesh(piece, mesh.material);
      part.castShadow = mesh.castShadow;
      part.receiveShadow = mesh.receiveShadow;
      const group = new THREE.Group();
      group.name = "remains-kit";
      group.matrixAutoUpdate = false;
      group.add(part);
      r.body.add(group);
      out.push({
        group,
        at: mid,
        turn: frameAlong(far.sub(mid).normalize(), new THREE.Quaternion()),
      });
    }
    // What is left of the mesh where it lay (the rest of the pair: a ski
    // well clear of the bag).
    if (took) g.setIndex(left);
  }
  kits.set(r, out);
  return out;
}

/** The hands' place gathering (low, before him as he kneels) and carrying
 * (at his right side), off his feet, m: up, ahead, to his right. */
const LOW = { up: 0.45, ahead: 0.5, right: 0.05 } as const;
const HIGH = { up: 0.9, ahead: 0.12, right: 0.3 } as const;
/** The kit carried upright, its top leaned forward this far, rad. */
const CARRY_LEAN = 0.3;

const held = new THREE.Vector3();
const heldTurn = new THREE.Quaternion();
const nowTurn = new THREE.Quaternion();
const nowAt = new THREE.Vector3();
const restM = new THREE.Matrix4();
const ONE = new THREE.Vector3(1, 1, 1);
const dir = new THREE.Vector3();

const ease = (u: number): number => {
  const k = Math.max(0, Math.min(1, u));
  return k * k * (3 - 2 * k);
};

/** HIS KIT GATHERED: each part in the bag's way lifted off the snow into the
 * photographer's hands as he kneels, carried at his side as he walks
 * aboard, and out of sight for good once he is in. */
export function gatherKit(r: Remains, k: KitFrame, him: THREE.Object3D): void {
  if (k.pick <= 0) {
    // Not yet gathered (or a replay gone back before it): where it lay.
    for (const part of kits.get(r) ?? []) {
      part.group.visible = true;
      part.group.matrix.identity();
      part.group.matrixWorldNeedsUpdate = true;
    }
    return;
  }
  const all = kitOfStatue(r, k, him);
  // Aboard with him, out of sight — and left so once the call has gone.
  const gone = k.pick >= 1 && !k.hand;
  const o = r.body.position;
  all.forEach((part, i) => {
    part.group.visible = !gone;
    if (gone || !k.hand) return;
    const h = k.hand;
    const f = { x: Math.sin(h.heading), z: Math.cos(h.heading) };
    const right = { x: -f.z, z: f.x };
    // Low to his hands over the first three-quarters of the kneel, then up
    // to his side as he stands.
    const g = ease(k.pick / 0.75);
    const s = ease((k.pick - 0.75) / 0.25);
    const at = (
      p: { up: number; ahead: number; right: number },
      j: number,
    ): [number, number, number] => [
      h.x + f.x * p.ahead + right.x * (p.right + 0.05 * j) - o.x,
      h.y + p.up - o.y,
      h.z + f.z * p.ahead + right.z * (p.right + 0.05 * j) - o.z,
    ];
    const lo = at(LOW, i);
    const hi = at(HIGH, i);
    held.set(lo[0] + (hi[0] - lo[0]) * s, lo[1] + (hi[1] - lo[1]) * s, lo[2] + (hi[2] - lo[2]) * s);
    // Gathered lying across before him, carried upright, leaned forward.
    dir
      .set(
        right.x * (1 - s) + f.x * Math.sin(CARRY_LEAN) * s,
        Math.cos(CARRY_LEAN) * s,
        right.z * (1 - s) + f.z * Math.sin(CARRY_LEAN) * s,
      )
      .normalize();
    frameAlong(dir, heldTurn);
    nowAt.lerpVectors(part.at, held, g);
    nowAt.y += Math.sin(Math.PI * g) * 0.15;
    nowTurn.slerpQuaternions(part.turn, heldTurn, g);
    restM.compose(part.at, part.turn, ONE).invert();
    part.group.matrix.compose(nowAt, nowTurn, ONE).multiply(restM);
    part.group.matrixWorldNeedsUpdate = true;
  });
}
