// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A STATIC MODEL, READ: what every glTF made on the Blender lab's static
// shelf (`scripts/blender/static.py` — the trees, the birds, the animals,
// the course's marks) is once three has parsed it. Each carries no colour
// of its own: its meshes are PARTS (named as the builder named them —
// `v3`, `wing`, `leg_lf`, `arch`), every primitive of a part a ROLE (its
// material's name, all the paint it has), every vertex three numbers of
// TONE (a shade, a blend, a spare the kind gives a meaning to) and its
// position and normal in the game's own metres — the exporter's turn of
// Blender's z up is the game's y up, and the builders point their asset's
// nose down Blender -y, which is the game's +z, so nothing here turns
// anything. The root node's extras are the numbers the kind's loader
// needs (a tree's reference size, an animal's hip, an arch's reach).
//
// Every kind's loader (`tree-models.ts`, `bird-models.ts`,
// `beast-models.ts`, `gate-models.ts`) reads its file through this and
// dresses the parts itself; `Assembly` is the one way a dressed part
// becomes a `BufferGeometry`, so a vertex's colour is `first` blended to
// `second` by its tone's G and darkened by its R in every kind alike.

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/** One primitive of a part, in the game's metres: three numbers of tone a
 * vertex. */
export type ModelPart = {
  role: string;
  position: Float32Array;
  normal: Float32Array;
  tone: Float32Array;
  index: Uint32Array;
};

/** A file's parts by name, and the root's extras. */
export type StaticModel = { parts: Map<string, ModelPart[]>; extras: Record<string, number> };

/** The parts of a parsed scene whose node names `keep` says yes to, and
 * the root's extras (the numbers on the node the builder tagged
 * `frame`). */
export function readStaticModel(
  gltf: Pick<GLTF, "scene">,
  keep: (name: string) => boolean,
): StaticModel {
  const parts = new Map<string, ModelPart[]>();
  let extras: Record<string, number> = {};
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse((o) => {
    if (typeof o.userData.frame === "string" && Object.keys(extras).length === 0) {
      extras = Object.fromEntries(
        Object.entries(o.userData).filter(
          (kv): kv is [string, number] => typeof kv[1] === "number",
        ),
      );
    }
    if (!keep(o.name)) return;
    const meshes: THREE.Mesh[] = [];
    if (o instanceof THREE.Mesh) meshes.push(o);
    else o.traverse((c) => c instanceof THREE.Mesh && meshes.push(c));
    const own: ModelPart[] = [];
    for (const m of meshes) {
      const g = m.geometry as THREE.BufferGeometry;
      const pos = g.getAttribute("position");
      const nrm = g.getAttribute("normal");
      const tone = g.getAttribute("color");
      if (!pos || !nrm || !tone || !g.index) continue;
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      const n = pos.count;
      const position = new Float32Array(n * 3);
      const normal = new Float32Array(n * 3);
      const tones = new Float32Array(n * 3);
      const turn = new THREE.Matrix3().getNormalMatrix(m.matrixWorld);
      const v = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        v.fromBufferAttribute(pos, i)
          .applyMatrix4(m.matrixWorld)
          .toArray(position, i * 3);
        v.fromBufferAttribute(nrm, i)
          .applyMatrix3(turn)
          .normalize()
          .toArray(normal, i * 3);
        tones[i * 3] = tone.getX(i);
        tones[i * 3 + 1] = tone.getY(i);
        tones[i * 3 + 2] = tone.getZ(i);
      }
      own.push({
        role: mat.name,
        position,
        normal,
        tone: tones,
        index: Uint32Array.from(g.index.array),
      });
    }
    parts.set(o.name, own);
  });
  return { parts, extras };
}

/** Fetch every `keys` file (`at(key)` its URL; the committed models are
 * meshopt-packed — `scripts/lib/glb-pack.mjs`) into `into`, once; resolves
 * when all are in or given up on — a file that fails to load leaves its
 * kind to the code. */
export function fetchStaticModels<K>(
  keys: readonly K[],
  at: (key: K) => string,
  keep: (name: string) => boolean,
  into: Map<K, StaticModel>,
): Promise<void> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return Promise.all(
    keys.map((key) =>
      loader.loadAsync(at(key)).then(
        (g) => void into.set(key, readStaticModel(g, keep)),
        () => undefined,
      ),
    ),
  ).then(() => undefined);
}

/**
 * DRESSED PARTS BECOMING ONE GEOMETRY: every vertex's colour is its
 * role's `first` blended to `second` by its tone's G and darkened by its
 * R; `place` (optional) moves a position and its normal on the way in (an
 * arch stretched to its line); `tags` are per-vertex scalar attributes a
 * shader reads (a wing's flag, a leg's phase), each part's given whole.
 */
export class Assembly {
  private readonly pos: number[] = [];
  private readonly nrm: number[] = [];
  private readonly col: number[] = [];
  private readonly idx: number[] = [];
  private readonly tags = new Map<string, number[]>();
  private readonly c = new THREE.Color();

  constructor(private readonly place?: (p: THREE.Vector3, n: THREE.Vector3) => void) {}

  add(
    part: ModelPart,
    first: THREE.Color,
    second: THREE.Color = first,
    tags: Record<string, number> = {},
    keepTriangle?: (a: number, b: number, c: number) => boolean,
  ): void {
    const base = this.pos.length / 3;
    const { position: at, normal: nr, tone } = part;
    const n = at.length / 3;
    const p = new THREE.Vector3();
    const q = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      p.fromArray(at, i * 3);
      q.fromArray(nr, i * 3);
      this.place?.(p, q);
      this.pos.push(p.x, p.y, p.z);
      this.nrm.push(q.x, q.y, q.z);
      this.c
        .copy(first)
        .lerp(second, tone[i * 3 + 1])
        .multiplyScalar(tone[i * 3]);
      this.col.push(this.c.r, this.c.g, this.c.b);
    }
    for (const [name, value] of Object.entries(tags)) {
      let arr = this.tags.get(name);
      if (!arr) this.tags.set(name, (arr = Array<number>(base).fill(0)));
      for (let i = 0; i < n; i++) arr.push(value);
    }
    for (const [name, arr] of this.tags) {
      if (!(name in tags)) for (let i = 0; i < n; i++) arr.push(0);
    }
    const ix = part.index;
    for (let t = 0; t + 2 < ix.length; t += 3) {
      if (keepTriangle && !keepTriangle(ix[t], ix[t + 1], ix[t + 2])) continue;
      this.idx.push(base + ix[t], base + ix[t + 1], base + ix[t + 2]);
    }
  }

  /** How many vertices are in so far. */
  get vertexCount(): number {
    return this.pos.length / 3;
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    for (const [name, arr] of this.tags) {
      g.setAttribute(name, new THREE.Float32BufferAttribute(arr, 1));
    }
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}
