// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RACER CUT TO HIS BUILD: the modelled racer (`racer-model.ts`) is made
// once, at the medium build's measure, and the DRESS card's WEIGHT row
// reshapes him as it reshapes the code's dress (`dress-body.ts`' `builtTo`):
// a heavier skier broader everywhere, his limbs taking less of it than his
// trunk, a solid one deeper in the chest, a heavy one carrying a stomach out
// over his belt; a light one slighter. His skin is read in the pose he was
// bound in, so every point is moved off the bone it lies round — out from the
// trunk's chord by the trunk's own share at its level and side, out from a
// limb's line by the limb's — and a hard part over a limb (a shin guard, an
// arm's pad) is moved as the cloth under it is, so its gap holds. The head,
// the hands and the feet keep their size.

import * as THREE from "three";

import { bindPose } from "./dress-loft.ts";
import { BODY_MEASURES, builtTo, trunkAt, type BuildShape } from "./dress-body.ts";

/** A limb's line in the bind pose and how thick the body is round it, m:
 * a point further out than that (a pad, a guard) is moved by that much. */
type Line = { a: THREE.Vector3; b: THREE.Vector3; flesh: number };

/** How soft the hand-over between two bones' moves is, m. */
const SOFT = 0.035;

const v3 = (p: { x: number; y: number; z: number }): THREE.Vector3 =>
  new THREE.Vector3(p.x, p.y, p.z);

/** The parts a build reshapes: the suit and what lies on it. The helmet,
 * the gloves and the feet are the same size on every build. */
export const BUILT_PARTS: ReadonlySet<string> = new Set([
  "suit",
  "bib",
  "shin_guard",
  "guard_edge",
  "guard_strap",
  "arm_guard",
]);

/** The racer's geometry `g` (positions in the bind pose's body frame) cut
 * to `build`; the medium build hands back `g` itself. */
export function builtRacer(g: THREE.BufferGeometry, build: BuildShape): THREE.BufferGeometry {
  if (build.girth === 1 && build.belly === 0 && build.chest === 0) return g;
  const f = bindPose().frames;
  const base = BODY_MEASURES.man;
  const built = builtTo(base, build);
  const limb = 1 + (build.girth - 1) * 0.7;
  const top = (n: keyof typeof f): THREE.Vector3 =>
    v3(f[n].head).addScaledVector(v3(f[n].y), f[n].length);
  const lines: Record<string, Line & { k: number }> = {};
  for (const s of ["l", "r"] as const) {
    lines[`thigh_${s}`] = {
      a: v3(f[`thigh_${s}`].head),
      b: top(`thigh_${s}`),
      flesh: base.thigh,
      k: limb,
    };
    lines[`shin_${s}`] = {
      a: v3(f[`shin_${s}`].head),
      b: top(`shin_${s}`),
      flesh: base.calf,
      k: limb,
    };
    lines[`upper_${s}`] = {
      a: v3(f[`upperarm_${s}`].head),
      b: top(`upperarm_${s}`),
      flesh: base.biceps,
      k: limb * (1 + build.chest),
    };
    lines[`fore_${s}`] = {
      a: v3(f[`forearm_${s}`].head),
      b: top(`forearm_${s}`),
      flesh: base.forearm,
      k: limb,
    };
  }
  // THE TRUNK'S CHORD: the hips to the neck's base, the chest's own facing.
  const hips = v3(f.pelvis.head);
  const neck = top("chest");
  const up = neck.clone().sub(hips);
  const span = up.length();
  up.normalize();
  const ahead = v3(f.chest.z).addScaledVector(up, -v3(f.chest.z).dot(up)).normalize();
  const side = new THREE.Vector3().crossVectors(up, ahead).normalize();
  const shoulder = (v3(f.upperarm_l.head).distanceTo(v3(f.upperarm_r.head)) / 2) * 0.9;

  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const out = pos.clone();
  const p = new THREE.Vector3();
  const r = new THREE.Vector3();
  const move = new THREE.Vector3();
  const sum = new THREE.Vector3();
  const moves: { d: number; m: THREE.Vector3 }[] = [];
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    moves.length = 0;
    // Round each limb.
    for (const L of Object.values(lines)) {
      const ab = L.b.clone().sub(L.a);
      const t = Math.min(1, Math.max(0, p.clone().sub(L.a).dot(ab) / ab.lengthSq()));
      r.copy(p).sub(L.a.clone().addScaledVector(ab, t));
      const d = r.length();
      move.copy(r).multiplyScalar(d > 1e-6 ? ((L.k - 1) * Math.min(d, L.flesh)) / d : 0);
      moves.push({ d, m: move.clone() });
    }
    // Round the trunk: its level up the chord, its side, its front or back.
    const rel = p.clone().sub(hips);
    const level = rel.dot(up) / span;
    const t = Math.min(1, Math.max(0, level));
    r.copy(rel).addScaledVector(up, -t * span);
    const across = r.dot(side);
    const fore = r.dot(ahead);
    const was = trunkAt(base, t);
    const now = trunkAt(built, t);
    // Past the shoulders' joints the arm's own move holds.
    const kx = now.w / was.w;
    const kz = fore >= 0 ? now.f / was.f : now.b / was.b;
    const cap = (k: number, flesh: number, x: number): number =>
      Math.sign(x) * (k - 1) * Math.min(Math.abs(x), flesh);
    move
      .copy(side)
      .multiplyScalar(cap(kx, Math.min(was.w, shoulder), across))
      .addScaledVector(ahead, cap(kz, fore >= 0 ? was.f : was.b, fore));
    const beyond = Math.max(0, level - 1) * span + Math.max(0, -level) * span;
    moves.push({ d: Math.hypot(r.length() * 0.6, beyond), m: move.clone() });
    // The nearest bone's move, handed softly to the next.
    const least = Math.min(...moves.map((m) => m.d));
    let total = 0;
    sum.set(0, 0, 0);
    for (const m of moves) {
      const w = Math.exp(-(m.d - least) / SOFT);
      sum.addScaledVector(m.m, w);
      total += w;
    }
    // The head, the hands and the feet are not moved: past the limbs' ends
    // and over the neck the move fades out.
    const headward = THREE.MathUtils.smoothstep(level, 1.02, 1.12);
    sum.multiplyScalar((1 - headward) / total);
    out.setXYZ(i, p.x + sum.x, p.y + sum.y, p.z + sum.z);
  }
  const made = g.clone();
  // The normals are kept: the build swells him a few per cent at most, and
  // the model's own normals hold its creases and its hard parts' edges.
  made.setAttribute("position", out);
  return made;
}
