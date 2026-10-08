// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DEAD RIDER LEFT WHERE HE LIES — the body the next rider skis past
// (`gore-view.ts`'s `leave`). Presentation only: nothing of it is the
// engine's, which has stood a new rider up at the top and forgotten him.
//
// The body is drawn as a STATUE of the last frame he was drawn in: every
// mesh under his model's root that was in the picture — his dressed skin
// cut where he lost pieces and soaked where he bled, the stumps and the
// opened trunk laid on it, the skis lying where they slid, his poles —
// baked to plain geometry in the world. The skins are skinned on the GPU
// (`skier-dress.ts`, `posed-merge.ts`), so each is skinned here once on the
// processor off the same bone matrices the last frame drew it with; a part
// switched off every layer (the merged draw's posing tree) or hidden is
// left out, as the picture left it out.

import * as THREE from "three";

type Wrap = <M extends THREE.Material>(m: M, name: string) => M;

const p = new THREE.Vector3();
const n = new THREE.Vector3();
const acc = new THREE.Vector3();
const accN = new THREE.Vector3();
const t = new THREE.Vector3();
const bone = new THREE.Matrix4();
const normalOf = new THREE.Matrix3();
const world = new THREE.Matrix4();
const worldN = new THREE.Matrix3();

/** One mesh's geometry as drawn this frame, in the world less `origin`. */
function bakeGeometry(mesh: THREE.Mesh, origin: THREE.Vector3): THREE.BufferGeometry {
  const src = mesh.geometry;
  const pos = src.getAttribute("position");
  const nor = src.getAttribute("normal") as THREE.BufferAttribute | undefined;
  const out = new THREE.BufferGeometry();
  const P = new Float32Array(pos.count * 3);
  const N = nor ? new Float32Array(pos.count * 3) : null;
  world.copy(mesh.matrixWorld);
  worldN.getNormalMatrix(world);
  const skinned = (mesh as THREE.SkinnedMesh).isSkinnedMesh ? (mesh as THREE.SkinnedMesh) : null;
  const si = skinned?.geometry.getAttribute("skinIndex");
  const sw = skinned?.geometry.getAttribute("skinWeight");
  const mats = skinned?.skeleton.boneMatrices;
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    if (nor) n.fromBufferAttribute(nor, i);
    if (skinned && si && sw && mats) {
      // What the vertex shader does: into the bind's frame, through every
      // bone it is weighted to, back out of the bind.
      p.applyMatrix4(skinned.bindMatrix);
      if (nor) n.transformDirection(skinned.bindMatrix);
      acc.set(0, 0, 0);
      accN.set(0, 0, 0);
      for (let k = 0; k < 4; k++) {
        const w = sw.getComponent(i, k);
        if (w === 0) continue;
        bone.fromArray(mats, si.getComponent(i, k) * 16);
        acc.addScaledVector(t.copy(p).applyMatrix4(bone), w);
        if (nor) {
          normalOf.getNormalMatrix(bone);
          accN.addScaledVector(t.copy(n).applyMatrix3(normalOf), w);
        }
      }
      p.copy(acc).applyMatrix4(skinned.bindMatrixInverse);
      if (nor) n.copy(accN).transformDirection(skinned.bindMatrixInverse);
    }
    p.applyMatrix4(world).sub(origin);
    P[3 * i] = p.x;
    P[3 * i + 1] = p.y;
    P[3 * i + 2] = p.z;
    if (N) {
      n.applyMatrix3(worldN).normalize();
      N[3 * i] = n.x;
      N[3 * i + 1] = n.y;
      N[3 * i + 2] = n.z;
    }
  }
  out.setAttribute("position", new THREE.BufferAttribute(P, 3));
  if (N) out.setAttribute("normal", new THREE.BufferAttribute(N, 3));
  for (const name of ["color", "uv"]) {
    const a = src.getAttribute(name);
    if (a) out.setAttribute(name, (a as THREE.BufferAttribute).clone());
  }
  if (src.index) out.setIndex(src.index.clone());
  for (const g of src.groups) out.addGroup(g.start, g.count, g.materialIndex);
  out.computeBoundingSphere();
  return out;
}

/** Whether `o` and every parent above it is in the picture. */
function drawn(o: THREE.Object3D): boolean {
  for (let q: THREE.Object3D | null = o; q; q = q.parent) {
    if (!q.visible || q.layers.mask === 0) return false;
  }
  return true;
}

/** THE STATUE: every opaque mesh drawn under `root` this frame, baked where
 * it stands, as one group of plain meshes in the world. */
export function bakeFigure(root: THREE.Object3D, wrap: Wrap): THREE.Group {
  root.updateWorldMatrix(true, true);
  const group = new THREE.Group();
  group.name = "remains";
  const origin = new THREE.Vector3().setFromMatrixPosition(root.matrixWorld);
  group.position.copy(origin);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || (o as THREE.InstancedMesh).isInstancedMesh || !drawn(o)) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    // A glow or a lens is light, not a body: the lamp goes out with him.
    if (list.some((m) => m.transparent)) return;
    const mats = list.map((m) => wrap(m.clone(), `remains-${m.name || mesh.name || "part"}`));
    const baked = new THREE.Mesh(bakeGeometry(mesh, origin), mats.length === 1 ? mats[0] : mats);
    baked.castShadow = true;
    baked.receiveShadow = mesh.receiveShadow;
    group.add(baked);
  });
  return group;
}

/** Everything a statue owns. */
export function disposeFigure(group: THREE.Group): void {
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.geometry.dispose();
    for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) m.dispose();
  });
}
