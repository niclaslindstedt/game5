// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A SMASH LEAVES ON THE SOLID — a body met a trunk, a boulder, steel
// or a crag's bare rock past what holds it together (`GORE.smash`), and
// what hit it was crushed there (`GoreState.smears`). Presentation only:
// the engine keeps where each point met the solid, the face's way out and
// the upright's axis and radius; the paste is dealt here off the map's
// seed and the smear's own place, so a replay lays it again the same.
//
// ONE PASTE A SMEAR, pressed onto the solid's face and wrapped round a
// trunk's curve: a blot of blood a hand or two across where the point met
// it, ragged at its rim, thick and lumpy in its middle, and runs of it
// down the bark under it — and in it what the point was: the brain's grey
// pink folds and the skull's shards, the chest's meat, lung and the ribs'
// ends, the belly's bowel and liver and its yellow fat, a limb's muscle
// and splinters of its bone. Each is flattened as it met the face. The
// pieces of him crushed off are thrown from it too (`gore-view.ts`); the
// paste is what stays on the wood.

import * as THREE from "three";
import type { Smear } from "@engine";
import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";

import {
  GORE_COLOURS,
  lumpy,
  merge,
  noise,
  organGeometry,
  shardGeometry,
  type GoreColour,
  type OrganKind,
} from "./gore-shapes.ts";

/** The paste's measures, m: the blot's radius by what was crushed, how far
 * the runs reach down under it at the most, and how thick its middle is. */
export const SMEAR = {
  radius: { brain: 0.24, chest: 0.26, belly: 0.28, limb: 0.17 },
  runs: 0.9,
  thick: 0.018,
} as const;

/** What is pressed into each kind of paste: its lumps, how many of each. */
const IN_IT: Record<Smear["what"], [OrganKind | "bone", number][]> = {
  brain: [
    ["brain", 11],
    ["skull", 4],
    ["eye", 1],
  ],
  chest: [
    ["gobbet", 6],
    ["lung", 2],
    ["bone", 4],
  ],
  belly: [
    ["gobbet", 5],
    ["liver", 1],
    ["kidney", 1],
    ["bone", 1],
  ],
  limb: [
    ["gobbet", 6],
    ["bone", 3],
  ],
};

/** The paste's own tint mixed through the blood: the brain's, the fat's. */
const TINT: Record<Smear["what"], GoreColour> = {
  brain: "brain",
  chest: "muscle",
  belly: "bowel",
  limb: "muscle",
};

const c = (k: GoreColour) => new THREE.Color().setHex(GORE_COLOURS[k]);

/** Where (u across, v up, w out of the face) lies on the solid: round a
 * trunk of radius `r` whose face at u = 0 is the origin and whose way out
 * is +z, or on a flat face (`r` 0). */
function wrap(u: number, v: number, w: number, r: number, out: THREE.Vector3): THREE.Vector3 {
  if (r <= 0) return out.set(u, v, w);
  const a = u / r;
  return out.set(Math.sin(a) * (r + w), v, Math.cos(a) * (r + w) - r);
}

/** The blot's reach at the bearing `a` round its middle, a share of its
 * radius: lobed and ragged. */
function rim(a: number, seed: number): number {
  return 0.72 + 0.5 * lumpy(Math.cos(a) * 2.2 + seed, Math.sin(a) * 2.2, seed * 0.37);
}

/** THE PASTE of one smear, in its own frame (the face's way out +z, up +y,
 * the solid's radius `r`), coloured a vertex. */
export function smearGeometry(
  what: Smear["what"],
  r: number,
  seed: number,
  rng: Rng,
): THREE.BufferGeometry {
  const Rv = SMEAR.radius[what];
  // Round a trunk no wider than its face: past that the bark turns away.
  const Ru = r > 0 ? Math.min(Rv, r * 1.1) : Rv;
  const pos: number[] = [];
  const col: number[] = [];
  const blood = c("blood");
  const clot = c("clot");
  const tint = c(TINT[what]);
  const p = new THREE.Vector3();
  const vertex = (u: number, v: number, w: number, k: number) => {
    wrap(u, v, w, r, p);
    pos.push(p.x, p.y, p.z);
    const t = lumpy(u * 22, v * 22 + seed, 3.1);
    const base = blood.clone().lerp(clot, 0.2 + 0.6 * noise(u * 90, v * 90, seed));
    const out = k > 0.4 && t > 0.5 ? base.lerp(tint, Math.min(1, (t - 0.5) * 2.2 * k)) : base;
    col.push(out.r, out.g, out.b);
  };
  // THE BLOT: rings out to its ragged rim, thick and lumpy in its middle.
  const K = 6;
  const S = 30;
  const ring = (k: number, j: number) => {
    const a = (j / S) * Math.PI * 2;
    const e = rim(a, seed) * (k / K);
    const u = Math.cos(a) * Ru * e;
    const v = Math.sin(a) * Rv * e;
    const mid = 1 - k / K;
    const w = 0.01 + SMEAR.thick * mid * (0.4 + lumpy(u * 40 + seed, v * 40, seed * 0.5));
    return { u, v, w, k: mid };
  };
  for (let k = 0; k < K; k++) {
    for (let j = 0; j < S; j++) {
      const a = ring(k, j);
      const b = ring(k + 1, j);
      const d = ring(k + 1, j + 1);
      const e = ring(k, j + 1);
      for (const q of k === 0 ? [a, b, d] : [a, b, d, a, d, e]) vertex(q.u, q.v, q.w, q.k);
    }
  }
  // THE RUNS down the bark under it: a streak each, thinning, a bead at its end.
  const runs = 2 + Math.floor(rng.next() * 4);
  for (let n = 0; n < runs; n++) {
    const x = rng.range(-Ru * 0.6, Ru * 0.6);
    const top = -Rv * 0.45;
    const length = rng.range(0.15, SMEAR.runs);
    const width = rng.range(0.012, 0.03);
    const M = 10;
    const at = (m: number) => {
      const f = m / M;
      const half = width * (1 - 0.55 * f) * (m === M ? 1.4 : 1);
      return { v: top - length * f, half };
    };
    for (let m = 0; m < M; m++) {
      const a = at(m);
      const b = at(m + 1);
      const w = 0.009;
      const q = [
        { u: x - a.half, v: a.v },
        { u: x + a.half, v: a.v },
        { u: x + b.half, v: b.v },
        { u: x - b.half, v: b.v },
      ];
      for (const i of [0, 1, 2, 0, 2, 3]) vertex(q[i].u, q[i].v, w, 0);
    }
  }
  const paste = new THREE.BufferGeometry();
  paste.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  paste.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  const parts = [paste];
  // WHAT WAS CRUSHED, pressed into it: each lump flattened against the face.
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  for (const [kind, count] of IN_IT[what]) {
    for (let n = 0; n < count; n++) {
      const g =
        kind === "bone"
          ? shardGeometry(rng.range(0.04, 0.09), 0.012, seed + n)
          : organGeometry(kind, seed + n * 3.3);
      const a = rng.range(0, Math.PI * 2);
      const d = 0.6 * Math.sqrt(rng.next());
      const u = Math.cos(a) * d * Ru;
      const v = Math.sin(a) * d * Rv;
      const s = kind === "liver" ? 0.6 : kind === "lung" ? 0.7 : rng.range(0.7, 1.15);
      wrap(u, v, SMEAR.thick * 0.8, r, p);
      q.setFromEuler(e.set(rng.range(-0.5, 0.5), r > 0 ? u / r : 0, rng.range(0, Math.PI * 2)));
      // Flattened along the face's way out, before it is turned onto the face.
      m.compose(p, q, new THREE.Vector3(s, s, s * 0.45));
      g.applyMatrix4(m);
      parts.push(g.index ? g.toNonIndexed() : g);
    }
  }
  return merge(parts);
}

export type Smears = {
  group: THREE.Group;
  /** The engine's smears laid as they come. */
  update(smears: readonly Smear[]): void;
  /** The pastes laid so far, handed over (a body left lying keeps them). */
  take(): THREE.Mesh[];
  clear(): void;
};

/** The pastes of a run, in `flesh` — dealt off `seed` — on the ground
 * `groundAt` gives where a smear is on the crag's rock. */
export function createSmears(
  flesh: THREE.Material,
  seed: number,
  groundAt: (x: number, z: number) => number,
): Smears {
  const group = new THREE.Group();
  group.name = "gore-smears";
  let laid: THREE.Mesh[] = [];
  let seen = 0;
  const out = new THREE.Vector3();
  const up = new THREE.Vector3();
  const side = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  return {
    group,
    update(smears) {
      // A new run's list starts again from none.
      if (smears.length < seen) seen = 0;
      for (; seen < smears.length; seen++) {
        const s = smears[seen];
        const own = seed ^ Math.round(s.x * 97 + s.z * 31 + s.t * 1000);
        const rng = createRng(own >>> 0);
        const geo = smearGeometry(s.what, s.r, (own % 997) / 9.7, rng);
        const mesh = new THREE.Mesh(geo, flesh);
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
        out.set(s.nx, s.ny, s.nz).normalize();
        // On an upright, laid on its face square to its axis; on rock, on the slope.
        up.set(0, 1, 0).addScaledVector(out, -out.y).normalize();
        if (up.lengthSq() < 1e-6) up.set(0, 0, 1);
        side.crossVectors(up, out).normalize();
        basis.makeBasis(side, up, out);
        mesh.quaternion.setFromRotationMatrix(basis);
        // On the solid's face where it met it: out from the axis by its radius.
        // On the crag's rock, on the ground under the point; on a flat wall,
        // a body point's breadth back from where the point was held.
        if (s.r > 0) mesh.position.set(s.cx + s.nx * s.r, s.y, s.cz + s.nz * s.r);
        else if (s.ny > 0.5) mesh.position.set(s.x, groundAt(s.x, s.z), s.z);
        else mesh.position.set(s.x - s.nx * 0.1, s.y, s.z - s.nz * 0.1);
        group.add(mesh);
        laid.push(mesh);
      }
    },
    take() {
      const all = laid;
      for (const m of all) group.remove(m);
      laid = [];
      return all;
    },
    clear() {
      for (const m of laid) {
        group.remove(m);
        m.geometry.dispose();
      }
      laid = [];
      seen = 0;
    },
  };
}
