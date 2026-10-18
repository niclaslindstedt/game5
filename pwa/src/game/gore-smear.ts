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
import type { Level, Smear } from "@engine";
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
import { LOOSE } from "./trail-stamp.ts";

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

/** THE MIDDLE'S BLOOD ON THE SNOW: what a body crushed open met square on
 * flings on past the solid — a blot at its foot, then a spray thinning
 * out along his way, each blot laid as the blood would reach it. `at` is
 * where it burst and `way` his way then (m/s, world); every blot's place,
 * radius, m, and the run clock it lands at. */
export function middleSpray(
  at: { x: number; z: number },
  way: { x: number; z: number },
  t: number,
  rng: Rng,
  solid?: { x: number; z: number; r: number },
): { x: number; z: number; r: number; t: number }[] {
  const s = Math.hypot(way.x, way.z) || 1;
  const ux = way.x / s;
  const uz = way.z / s;
  const out: { x: number; z: number; r: number; t: number }[] = [];
  // The blot at the solid's foot, poured out of him as he slid down it.
  for (let k = 0; k < 9; k++) {
    const a = rng.range(0, Math.PI * 2);
    const d = rng.range(0, 0.5);
    out.push({
      x: at.x + Math.cos(a) * d - ux * 0.3,
      z: at.z + Math.sin(a) * d - uz * 0.3,
      r: rng.range(0.5, 1),
      t: t + rng.range(0.1, 0.6),
    });
  }
  // The spray along his way, thinning and widening with distance.
  const reach = Math.min(16, s * 0.5);
  for (let k = 0; k < 140; k++) {
    const d = reach * rng.next() ** 0.7;
    let side = (rng.next() - 0.5) * (0.4 + d * 0.25);
    // Past a solid's side, never through it: its lee is clear of the spray.
    if (solid) {
      const off = (at.x - solid.x) * uz - (at.z - solid.z) * ux;
      const lee = solid.r + 0.1;
      if (Math.abs(side + off) < lee)
        side = Math.sign(side + off || 1) * (lee + Math.abs(side + off)) - off;
    }
    out.push({
      x: at.x + ux * d + uz * side,
      z: at.z + uz * d - ux * side,
      r: rng.range(0.1, 0.5) * (1 - (0.6 * d) / reach),
      t: t + d / (s * 0.45),
    });
  }
  return out;
}

export type Smears = {
  group: THREE.Group;
  /** The engine's smears laid as they come, and the middle's blots due by
   * the run clock `t`. */
  update(smears: readonly Smear[], t: number): void;
  /** The middle crushed: its blood flung on along `way` from `at`. */
  fling(
    at: { x: number; z: number },
    way: { x: number; z: number },
    t: number,
    solid?: { x: number; z: number; r: number } | null,
  ): void;
  /** The pastes laid so far, handed over (a body left lying keeps them). */
  take(): THREE.Mesh[];
  clear(): void;
};

/** The pastes of a run on `level`, in `flesh` — dealt off `seed` — and the
 * middle's blots laid by `splat`, `lift` m up: over the loose cover the
 * terrain draws on unpacked snow (`trail-stamp.ts`'s `LOOSE`), which the
 * blood lands on rather than under. */
export function createSmears(
  level: Level,
  flesh: THREE.Material,
  seed: number,
  splat: (x: number, z: number, r: number, shade: number, turn: number, lift: number) => void,
): Smears {
  const groundAt = (x: number, z: number) => level.groundAt(x, z);
  const group = new THREE.Group();
  group.name = "gore-smears";
  let laid: THREE.Mesh[] = [];
  let seen = 0;
  let due: { x: number; z: number; r: number; t: number }[] = [];
  const rng = createRng(seed >>> 0);
  const out = new THREE.Vector3();
  const up = new THREE.Vector3();
  const side = new THREE.Vector3();
  const basis = new THREE.Matrix4();
  return {
    group,
    fling(at, way, t, solid) {
      due.push(...middleSpray(at, way, t, rng, solid ?? undefined));
    },
    update(smears, t) {
      due = due.filter((b) => {
        if (b.t > t) return true;
        splat(b.x, b.z, b.r, 1, rng.range(0, 6.28), 0.012 + LOOSE * (1 - level.packedAt(b.x, b.z)));
        return false;
      });
      // A new run's list starts again from none.
      if (smears.length < seen) seen = 0;
      for (; seen < smears.length; seen++) {
        const s = smears[seen];
        const own = seed ^ Math.round(s.x * 97 + s.z * 31 + s.t * 1000);
        const geo = smearGeometry(s.what, s.r, (own % 997) / 9.7, createRng(own >>> 0));
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
      due = [];
    },
  };
}
