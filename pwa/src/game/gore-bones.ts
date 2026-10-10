// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN OPEN FRACTURE, AS DRAWN — a long bone broken through and its end out
// through the skin, built in code off what a broken shaft really is:
//
//   * A SHAFT the bone's own width (a humerus about 22 mm across at its
//     middle, a radius 15, an ulna 14, a femur 29, a tibia 24 — never a
//     spike), a tube of cortical bone round the medullary canal, the cortex
//     about a fifth of the width thick on each side. It stands out of the
//     limb a few centimetres, leaning out of it along the limb: the
//     proximal fragment's end driven out through the skin, the way an open
//     fracture of a shaft comes out (inside to out).
//   * THE BREAK across it OBLIQUE — the cortex parted on a slant across the
//     shaft, its long side the point that pierced the skin — and its edge
//     SERRATED, not cut: the cortex's broken face is a jagged rim of teeth.
//     A WEDGE fracture knocks a butterfly fragment out beside it, a
//     SHATTERED one more of them and splinters, and the end more ragged.
//   * THE END OPEN: the cortex's broken face a ring of dense ivory, the
//     canal inside it dark with marrow and blood, flecked yellow with fat.
//   * THE BONE ITSELF ivory with a pink cast where its sheath is torn off,
//     wet with blood thickest at the skin and in streaks up the shaft.
//   * THE WOUND it came through: a tear in the skin longer along the limb
//     than across it, its lips everted — a ring of dark muscle at the bone,
//     a ragged rim of yellow fat, the torn skin and the clot round it,
//     laid over the limb's curve.
//
// The skin's measure at the break is read off the outfit's own cloth in
// its bind pose (`limbRadius`), so the wound lies on the sleeve, not inside
// it or floating over it.

import * as THREE from "three";
import { BONES, FRACTURE_GRADE } from "@engine";
import { lumpy, merge, noise, painted } from "./gore-shapes.ts";
import { bindPose } from "./dress-loft.ts";
import { BREAK, type ArmBreak } from "./skier-broken.ts";
import type { BoneFrame, SkierBone } from "./skier-rig.ts";
import type { V3 } from "./skier-pose.ts";

/** One long bone that can stand out through the skin. `r` its shaft's
 * radius, m; `out` how far its end stands out of the skin along it, m;
 * `face` where round the limb it comes out, as a way in the standing
 * skier's own axes (+x his right, +y up, +z ahead) — turned with the limb
 * as it is posed; `at` the share of the skin's bone the break is at where
 * no arm's break says. */
export type OpenBone = {
  on: SkierBone;
  r: number;
  out: number;
  face: V3;
  at: number;
};

const mirror = (o: OpenBone, on: SkierBone): OpenBone => ({
  ...o,
  on,
  face: { x: -o.face.x, y: o.face.y, z: o.face.z },
});
// Where each comes out (the left's; the right's mirrored): the humerus out
// of the upper arm's outside and back, the radius out of the forearm's
// thumb side and back and the ulna out of its back toward the little
// finger, where both lie under the skin and face up off a pole held ahead
// (the faces underneath, toward the knees in a crouch, are buried); the femur out of the thigh's front and outside, the
// tibia out of the shin's front and inside, the face it has no muscle on.
const HUMERUS: OpenBone = {
  on: "upperarm_l",
  r: 0.012,
  out: 0.07,
  face: { x: -1, y: 0, z: -0.5 },
  at: 0.5,
};
const RADIUS: OpenBone = {
  on: "forearm_l",
  r: 0.008,
  out: 0.05,
  face: { x: -0.3, y: 1, z: 0 },
  at: 0.5,
};
const ULNA: OpenBone = {
  on: "forearm_l",
  r: 0.007,
  out: 0.04,
  face: { x: 0.6, y: 1, z: 0 },
  at: 0.45,
};
const FEMUR: OpenBone = {
  on: "thigh_l",
  r: 0.0145,
  out: 0.085,
  face: { x: -0.6, y: 0, z: 1 },
  at: 0.5,
};
const TIBIA: OpenBone = {
  on: "shin_l",
  r: 0.012,
  out: 0.075,
  face: { x: 0.45, y: 0, z: 1 },
  at: 0.6,
};

/** The long bones, at an adult's mid-shaft measure. */
export const OPEN_BONES: Partial<Record<(typeof BONES)[number], OpenBone>> = {
  humerusL: HUMERUS,
  humerusR: mirror(HUMERUS, "upperarm_r"),
  radiusL: RADIUS,
  radiusR: mirror(RADIUS, "forearm_r"),
  ulnaL: ULNA,
  ulnaR: mirror(ULNA, "forearm_r"),
  femurL: FEMUR,
  femurR: mirror(FEMUR, "thigh_r"),
  tibiaL: TIBIA,
  tibiaR: mirror(TIBIA, "shin_r"),
};

/** How far off the limb's line the end comes out, rad. */
const TILT = 0.8;

/** The colours, sRGB as read off photographs of fresh bone and its wound. */
const C = {
  bone: 0xd8c39e,
  sheath: 0xd7a596,
  cortex: 0xeadcc0,
  marrow: 0x6c130d,
  fat: 0xcfa24c,
  blood: 0x6e0605,
  clot: 0x330303,
  muscle: 0x861a14,
  yellow: 0xd9c47e,
  skin: 0xb85a48,
};
const col = (h: number) => new THREE.Color().setHex(h);
const mix = (a: THREE.Color, b: THREE.Color, t: number): THREE.Color =>
  a.clone().lerp(b, Math.max(0, Math.min(1, t)));
const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A grid of `rows + 1` rings of `around` points each, closed round. */
function rings(pts: (i: number, j: number) => THREE.Vector3, rows: number, around: number) {
  const pos: number[] = [];
  const quad = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3) =>
    pos.push(
      a.x,
      a.y,
      a.z,
      c.x,
      c.y,
      c.z,
      b.x,
      b.y,
      b.z,
      b.x,
      b.y,
      b.z,
      c.x,
      c.y,
      c.z,
      d.x,
      d.y,
      d.z,
    );
  for (let i = 0; i < rows; i++)
    for (let j = 0; j < around; j++) {
      const k = (j + 1) % around;
      quad(pts(i, j), pts(i, k), pts(i + 1, j), pts(i + 1, k));
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** The shape asked of `openBreakGeometry`. */
export type OpenBreakShape = {
  r: number;
  out: number;
  /** The skin's radius round the bone's line at the break, m. */
  limb: number;
  grade: number;
  seed: number;
};

/** AN OPEN FRACTURE: the wound at the origin on the skin, +y the skin's
 * outward normal, +z along the limb the way the bone's end points; the
 * shaft runs in from under the skin to stand `out` m out of it. */
export function openBreakGeometry(o: OpenBreakShape): THREE.BufferGeometry {
  const { r, out, limb, grade, seed } = o;
  const parts: THREE.BufferGeometry[] = [];
  const bone = col(C.bone);
  const sheath = col(C.sheath);
  const cortex = col(C.cortex);
  const marrow = col(C.marrow);
  const fat = col(C.fat);
  const blood = col(C.blood);
  const clot = col(C.clot);
  // The shaft is built along +y in its own frame, then leant over by TILT.
  const lean = new THREE.Matrix4().makeRotationX(Math.PI / 2 - TILT);
  const inside = limb / Math.sin(TILT) + r;
  const around = 24;
  const rows = 9;
  const shattered = grade >= FRACTURE_GRADE.shatter;
  const drop = r * (grade >= FRACTURE_GRADE.wedge ? 2.8 : 2.2);
  const toothH = r * (shattered ? 0.55 : 0.3);
  const spin = noise(seed, 1, 2) * Math.PI * 2;
  // The section a little out of round, as a shaft is.
  const rad = (a: number) => r * (1 + 0.07 * Math.cos(2 * a + seed) + 0.03 * Math.cos(3 * a));
  // The break: a slant down from its point, the rim serrated into teeth.
  const cut = (j: number) => {
    const a = (j / around) * Math.PI * 2;
    const slant = 0.5 - 0.5 * Math.cos(a - spin);
    const tooth = (j % 2 ? 0.15 : 1) * (0.4 + 0.6 * noise(seed, j, 5));
    return out - drop * slant - toothH * tooth - r * 0.6 * lumpy(Math.cos(a) * 2 + seed, 0, 1);
  };
  const tops = Array.from({ length: around }, (_, j) => cut(j));
  // THE SHAFT.
  const shaft = rings(
    (i, j) => {
      const a = (j / around) * Math.PI * 2;
      const y = -inside + ((tops[j] + inside) * i) / rows;
      const rr = rad(a);
      return new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
    },
    rows,
    around,
  );
  parts.push(
    painted(shaft, (p) => {
      const a = Math.atan2(p.z, p.x);
      // Wet at the skin and in streaks up it; the sheath's pink low down.
      const wet = 1 - smooth(0, out * 0.7, p.y);
      const streak = smooth(0.45, 0.7, lumpy(Math.cos(a) * 3 + seed, Math.sin(a) * 3, p.y * 70));
      const tip = smooth(-r * 0.6, 0, p.y - out + drop + r);
      const base = mix(
        mix(bone, sheath, 0.5 * wet + 0.2 * lumpy(a * 2, p.y * 90, seed)),
        cortex,
        0.2 * tip,
      );
      return mix(base, blood, Math.max(wet * 0.95, streak * 0.75, p.y < 0 ? 1 : 0));
    }).applyMatrix4(lean),
  );
  // THE BROKEN FACE: the cortex's ring, from the rim of teeth in to the canal.
  const ri = 0.55;
  const face = rings(
    (i, j) => {
      const a = (j / around) * Math.PI * 2;
      const rr = rad(a) * (i ? ri : 1);
      const y = tops[j] - (i ? r * 0.15 + r * 0.25 * noise(seed, j, 9) : 0);
      return new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
    },
    1,
    around,
  );
  parts.push(
    painted(face, (p) => {
      const inner = Math.hypot(p.x, p.z) < r * 0.75;
      const fleck = lumpy(p.x * 900 + seed, p.z * 900, 3);
      return inner ? mix(cortex, blood, 0.5 + 0.3 * fleck) : mix(cortex, blood, 0.35 * fleck);
    }).applyMatrix4(lean),
  );
  // THE CANAL down into the marrow, and its floor of marrow and clot.
  const depth = r * 1.1;
  const canal = rings(
    (i, j) => {
      const a = (j / around) * Math.PI * 2;
      const rr = rad(a) * ri;
      const top = tops[j] - r * 0.15 - r * 0.25 * noise(seed, j, 9);
      const y = i ? Math.min(...tops) - depth : top;
      return new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr);
    },
    1,
    around,
  );
  parts.push(
    painted(canal, (p) =>
      mix(marrow, fat, smooth(0.62, 0.8, lumpy(p.x * 700 + seed, p.y * 700, p.z * 700))),
    ).applyMatrix4(lean),
  );
  const floor = new THREE.CircleGeometry(r * ri * 1.02, 12).toNonIndexed();
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, Math.min(...tops) - depth, 0);
  parts.push(
    painted(floor, (p) =>
      mix(mix(marrow, clot, 0.5), fat, smooth(0.6, 0.75, lumpy(p.x * 900 + seed, p.z * 900, 2))),
    ).applyMatrix4(lean),
  );
  // THE FRAGMENTS a wedge knocks out of the shaft, and a shattered one's
  // splinters: curved plates of the cortex, out of the wound beside it.
  const pieces = grade >= FRACTURE_GRADE.wedge ? (shattered ? 4 : 1) : 0;
  for (let k = 0; k < pieces; k++) {
    const len = r * (k === 0 ? 4 : 2 + 1.5 * noise(seed, k, 3));
    const wide = (k === 0 ? 1.4 : 0.8) * (0.8 + 0.4 * noise(seed, k, 4));
    const plate = rings(
      (i, j) => {
        // A triangle of shell: wide at its foot, to a point at its top.
        const v = i / 3;
        const a = (j / 3 - 0.5) * wide * (1 - v * 0.9);
        return new THREE.Vector3(Math.cos(a) * r, v * len, Math.sin(a) * r);
      },
      3,
      4,
    );
    // `rings` closes round; a plate is open — the closing quad is a sliver.
    const at = spin + Math.PI * (0.7 + 0.6 * noise(seed, k, 6)) + k * 1.9;
    const m = new THREE.Matrix4()
      .makeRotationY(-at)
      .multiply(new THREE.Matrix4().makeRotationZ(-0.35 - 0.45 * noise(seed, k, 7)))
      .setPosition(
        Math.cos(at) * r * 0.4,
        out * (0.05 + 0.25 * noise(seed, k, 8)),
        Math.sin(at) * r * 0.4,
      );
    parts.push(
      painted(plate, (p) => mix(bone, blood, 0.85 - smooth(0, len, p.y) * 0.7))
        .applyMatrix4(m)
        .applyMatrix4(lean),
    );
  }
  // THE WOUND: a tear longer along the limb than across it, its lips
  // everted, laid over the limb's curve — dark at the bone, the muscle's
  // red, a thin ragged line of fat, the torn skin and the blood round it.
  const hole = { x: r * 1.1, z: (r * 1.1) / Math.sin(TILT) };
  const steps = [0, 0.15, 0.36, 0.46, 0.72, 1.05];
  const lips = [-0.7, 0.2, 0.3, 0.3, 0.12, 0];
  const ring = [C.clot, C.muscle, C.muscle, C.yellow, C.skin, C.blood].map(col);
  // How far out each ring is torn at `a`: ragged, the outer rings most.
  const tear = (a: number, i: number) =>
    0.5 +
    0.9 * lumpy(Math.cos(a) * 2.5 + seed, Math.sin(a) * 2.5, 0.3) +
    0.25 * (i / steps.length) * noise(seed, Math.round((a / (Math.PI * 2)) * around), i);
  const wound = rings(
    (i, j) => {
      const a = (j / around) * Math.PI * 2;
      const s = 1 + steps[i] * tear(a, i);
      const x = Math.cos(a) * hole.x * s;
      const z = Math.sin(a) * hole.z * s * (1 + 0.1 * i);
      const curve = limb - Math.sqrt(Math.max(0, limb * limb - x * x));
      return new THREE.Vector3(x, lips[i] * r - curve, z);
    },
    steps.length - 1,
    around,
  );
  // Each vertex its ring's colour, the rings told apart by where they lie.
  const wp = wound.getAttribute("position");
  const wc = new Float32Array(wp.count * 3);
  for (let v = 0; v < wp.count; v++) {
    const x = wp.getX(v);
    const z = wp.getZ(v);
    const a = Math.atan2(z / hole.z, x / hole.x);
    const e = Math.hypot(x / hole.x, z / hole.z);
    let i = 0;
    let best = Infinity;
    steps.forEach((st, k) => {
      const d = Math.abs(e - (1 + st * tear(a, k)) * (1 + 0.1 * k * Math.abs(Math.sin(a))));
      if (d < best) [best, i] = [d, k];
    });
    // The fat shows in lobules, not a band: elsewhere its ring is muscle.
    const lobe = lumpy(x * 500 + seed, z * 500, 4);
    const base = i === 3 && lobe < 0.5 ? ring[2] : ring[i];
    const c = mix(base, col(C.clot), 0.35 * lumpy(x * 400 + seed, z * 400, 1));
    wc.set([c.r, c.g, c.b], v * 3);
  }
  wound.setAttribute("color", new THREE.Float32BufferAttribute(wc, 3));
  wound.computeVertexNormals();
  parts.push(wound);
  return merge(parts);
}

/** Where along its skin's bone the break is, m from its head: an arm's
 * where its break is (`BREAK`), never past the bone's own end. */
export function breakAlong(bone: string, f: BoneFrame, arm: ArmBreak | null): number {
  const o = OPEN_BONES[bone as (typeof BONES)[number]]!;
  if (bone.startsWith("humerus")) return Math.min(f.length, BREAK.upper);
  if (bone.startsWith("radius"))
    return Math.min(f.length, arm === "wrist" ? BREAK.wrist : BREAK.fore);
  if (bone.startsWith("ulna")) return Math.min(f.length, BREAK.fore * 0.9);
  return f.length * o.at;
}

const faces = new Map<OpenBone, { x: number; z: number }>();

/** The skin's way out round the limb at the bone's `face`: the face as it
 * lies across the limb's bone `f` in the bind pose, carried by the pose. */
export function faceOf(o: OpenBone, f: BoneFrame): V3 {
  let k = faces.get(o);
  if (!k) {
    const b = bindPose().frames[o.on];
    const n = o.face;
    k = {
      x: n.x * b.x.x + n.y * b.x.y + n.z * b.x.z,
      z: n.x * b.z.x + n.y * b.z.y + n.z * b.z.z,
    };
    const l = Math.hypot(k.x, k.z) || 1;
    k = { x: k.x / l, z: k.z / l };
    faces.set(o, k);
  }
  return {
    x: f.x.x * k.x + f.z.x * k.z,
    y: f.x.y * k.x + f.z.y * k.z,
    z: f.x.z * k.x + f.z.z * k.z,
  };
}

/** THE LIMB'S RADIUS round the bone's line at `along` m down `f` toward
 * `n`: the furthest the outfit's cloth `pos` (bind pose) stands out that
 * way, within a narrow cone of it. */
export function limbRadius(pos: ArrayLike<number>, f: BoneFrame, along: number, n: V3): number {
  const cx = f.head.x + f.y.x * along;
  const cy = f.head.y + f.y.y * along;
  const cz = f.head.z + f.y.z * along;
  let best = 0;
  for (let i = 0; i + 2 < pos.length; i += 3) {
    const dx = pos[i] - cx;
    const dy = pos[i + 1] - cy;
    const dz = pos[i + 2] - cz;
    const a = dx * f.y.x + dy * f.y.y + dz * f.y.z;
    if (Math.abs(a) > 0.02) continue;
    const rx = dx - f.y.x * a;
    const ry = dy - f.y.y * a;
    const rz = dz - f.y.z * a;
    const rl = Math.hypot(rx, ry, rz);
    if (rl > 0.2 || rl < 1e-4) continue;
    if ((rx * n.x + ry * n.y + rz * n.z) / rl < 0.9) continue;
    best = Math.max(best, rl);
  }
  return best || 0.06;
}

/** Lay `mesh` on the limb: the wound on its skin `limb` m out at the
 * break, its +y the skin's normal and its +z down the limb. */
export function placeBreak(
  mesh: THREE.Object3D,
  o: OpenBone,
  f: BoneFrame,
  along: number,
  limb: number,
): void {
  const n = faceOf(o, f);
  const y = new THREE.Vector3(n.x, n.y, n.z).normalize();
  const z = new THREE.Vector3(f.y.x, f.y.y, f.y.z);
  z.addScaledVector(y, -z.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  mesh.position.set(
    f.head.x + f.y.x * along + n.x * limb,
    f.head.y + f.y.y * along + n.y * limb,
    f.head.z + f.y.z * along + n.z * limb,
  );
}

const limbs = new WeakMap<THREE.BufferGeometry, Map<string, number>>();

/** The skin's radius at `bone`'s break on the outfit `cloth` (bind pose),
 * m — read once an outfit. */
export function limbAt(cloth: THREE.BufferGeometry, bone: string): number {
  let m = limbs.get(cloth);
  if (!m) limbs.set(cloth, (m = new Map()));
  let r = m.get(bone);
  if (r === undefined) {
    const o = OPEN_BONES[bone as (typeof BONES)[number]]!;
    const f = bindPose().frames[o.on];
    const along = breakAlong(bone, f, null);
    r = limbRadius(cloth.getAttribute("position").array, f, along, faceOf(o, f));
    m.set(bone, r);
  }
  return r;
}

/** Which long bones stand out of him, each with its grade: every long bone
 * broken through, but a forearm's ulna only where its radius is not. */
export function openBreaksOf(
  grades: readonly number[],
  lost: { has(b: SkierBone): boolean },
): Map<string, number> {
  const out = new Map<string, number>();
  BONES.forEach((bone, k) => {
    const o = OPEN_BONES[bone];
    if (!o || grades[k] < FRACTURE_GRADE.simple || lost.has(o.on)) return;
    if (bone.startsWith("ulna")) {
      const radius = BONES.indexOf(bone.replace("ulna", "radius") as (typeof BONES)[number]);
      if (grades[radius] >= FRACTURE_GRADE.simple) return;
    }
    out.set(bone, grades[k]);
  });
  return out;
}
