// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED RIDER ON THE DOWNHILL BIKE (`make blender KIND=rider`,
// `models/rider.glb`): a downhill rider's kit — a full-face helmet with its
// peak and goggles, a loose jersey, baggy shorts over knee and shin pads,
// socks, flat shoes and gloves round the grips — skinned in Blender on the
// SKIER'S OWN BONES in the rig's bind pose. So it is not posed by a second
// hand: its skin is bound here on the dressed figure's own skeleton
// (`Dressed.skeleton`) and moves with every pose the figure is laid in —
// the attack stance on the bike (`skier-bike.ts`), the walk beside it, a
// fall — while the outfit's cloth is hidden.
//
// Two draws, as the dressed figure's: the CLOTH and the HARD goods, every
// vertex carrying its material's colour.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { Dressed } from "./skier-dress.ts";
import { riderModelUrl } from "./skier-models.ts";
import { SKIER_BONES } from "./skier-rig.ts";

type Wrap = <M extends THREE.Material>(m: M, name: string) => M;

/** The model's materials drawn with a shine of their own; every other is
 * cloth (or skin, or rubber — matt alike). */
const HARD = new Set(["helmet", "trim", "peak", "lens", "strap", "pad", "sole"]);

/** The rider's two geometries in the bind pose, their skin indices the
 * dressed skeleton's (`SKIER_BONES`). */
export type RiderGeometry = { cloth: THREE.BufferGeometry; hard: THREE.BufferGeometry };

let loading: Promise<RiderGeometry | null> | null = null;
let loaded: RiderGeometry | null = null;

/** The rider already fetched, or `null` while he is not — so a figure
 * built after the fetch is dressed in the frame it first asks. */
export function bikeRiderNow(): RiderGeometry | null {
  return loaded;
}

/** Fetch and cut the rider once; `null` where the build packs none
 * (`VITE_MODEL_BIKE=0`) or it will not load. */
export function loadBikeRider(): Promise<RiderGeometry | null> {
  if (loading) return loading;
  const url = riderModelUrl();
  loading = url
    ? new GLTFLoader()
        .loadAsync(url)
        .then((gltf) => (loaded = riderGeometry(gltf.scene)))
        .catch(() => null)
    : Promise.resolve(null);
  return loading;
}

/** The skinned primitives of `scene` gathered into the two geometries,
 * their joints renumbered onto `SKIER_BONES` by name (a joint the game has
 * no bone for — the armature's root — onto the pelvis). */
export function riderGeometry(scene: THREE.Object3D): RiderGeometry | null {
  const parts: { hard: boolean; geo: THREE.BufferGeometry }[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse((o) => {
    if (!(o instanceof THREE.SkinnedMesh)) return;
    const map = o.skeleton.bones.map((b) => {
      const i = (SKIER_BONES as readonly string[]).indexOf(b.name);
      return i < 0 ? 0 : i;
    });
    const m = o.material as THREE.MeshStandardMaterial;
    const g = o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const n = g.attributes.position!.count;
    const idx = g.attributes.skinIndex!;
    const joints = new Uint16Array(n * 4);
    for (let v = 0; v < n; v++)
      for (let k = 0; k < 4; k++) joints[v * 4 + k] = map[idx.getComponent(v, k)] ?? 0;
    const colour = new Float32Array(n * 3);
    for (let v = 0; v < n; v++) colour.set([m.color.r, m.color.g, m.color.b], v * 3);
    const out = new THREE.BufferGeometry();
    out.setAttribute("position", g.attributes.position!);
    out.setAttribute("normal", g.attributes.normal!);
    out.setAttribute("color", new THREE.BufferAttribute(colour, 3));
    out.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(joints, 4));
    out.setAttribute("skinWeight", g.attributes.skinWeight!);
    if (g.index) out.setIndex(g.index);
    parts.push({ hard: HARD.has(m.name), geo: out.index ? out.toNonIndexed() : out });
  });
  if (!parts.length) return null;
  const join = (hard: boolean): THREE.BufferGeometry => {
    const list = parts.filter((p) => p.hard === hard).map((p) => p.geo);
    const merged = list.length ? mergeAll(list) : new THREE.BufferGeometry();
    for (const g of list) g.dispose();
    return merged;
  };
  return { cloth: join(false), hard: join(true) };
}

/** Plain geometries of the same attributes appended end to end (the
 * joints as integers, everything else as floats). */
function mergeAll(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  for (const name of ["position", "normal", "color", "skinIndex", "skinWeight"]) {
    const size = list[0]!.attributes[name]!.itemSize;
    const count = list.reduce((s, g) => s + g.attributes[name]!.count, 0);
    const arr =
      name === "skinIndex" ? new Uint16Array(count * size) : new Float32Array(count * size);
    let at = 0;
    for (const g of list) {
      const a = g.attributes[name] as THREE.BufferAttribute;
      for (let v = 0; v < a.count; v++)
        for (let k = 0; k < size; k++) arr[at++] = a.getComponent(v, k);
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

/** THE RIDER'S SKIN BOUND ON `dressed`'s skeleton, in its group, hidden
 * until shown: the two meshes. */
export function dressBikeRider(
  geo: RiderGeometry,
  dressed: Dressed,
  wrap: Wrap,
): THREE.SkinnedMesh[] {
  const mats = [
    wrap(
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.8,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
      "rider-cloth",
    ),
    wrap(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.1 }),
      "rider-hard",
    ),
  ];
  return [geo.cloth, geo.hard].map((g, i) => {
    const m = new THREE.SkinnedMesh(g, mats[i]);
    m.name = i === 0 ? "rider-cloth" : "rider-hard";
    m.bind(dressed.skeleton, new THREE.Matrix4());
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.visible = false;
    dressed.group.add(m);
    return m;
  });
}
