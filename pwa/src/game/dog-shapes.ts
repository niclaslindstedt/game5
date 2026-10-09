// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOGS, BUILT — every kind PROCEDURALLY, on the trees' bench
// (`tree-mesh.ts`), in the wildlife's chunky, faceted, low-poly look: the
// body a loft of keyed rings from the deep chest to the tucked-up loin
// (`dog-pose.ts`), the neck and the head lofted the same way (a broad
// skull, the stop, the muzzle, a black nose), the ears pricked up as two
// triangles or dropped down by the cheeks as flaps, the legs jointed (the
// fore straight with the elbow behind, the hind angled at the stifle and
// the hock), the tail lofted out of the croup at its kind's carriage — a
// husky's curled up over its back, a shepherd's hanging in its curve, a
// terrier's straight up — a COLLAR round the neck and, on the dogs out in
// one, a DOG COAT over the back from the withers to the loin.
//
// ONE MESH A KIND AND CUT, MANY TARGETS — the civilians' way: built at
// the stance and again at every pose of `DOG_POSES`, the same calls in
// the same order, kept as relative morph targets the view weighs
// (`dogDials`). At two cuts: NEAR, and FAR with fewer sides and no eyes or
// collar, so the hand-over keeps the silhouette.
//
// PAINTED PER DOG: every vertex carries the SLOT it is painted from
// (`aSlot`: the coat's main colour, the under colour, the back — a
// shepherd's saddle — the muzzle, the collar, the dog coat) and per
// instance the shader is handed the dog's six colours packed one a float
// (`aCoat`, `aCoat2`); the nose and the eyes are black on every dog. The
// dog coat (`aPart` 1) is folded away on a dog not out in one.

import * as THREE from "three";

import { DOG_SPECS, type DogKind } from "./dog-defs.ts";
import { DOG_POSES, dogSkel, type DogSkel, type V3 } from "./dog-pose.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { Shape } from "./tree-mesh.ts";

/** A dog's cut: near, and far past `DOG_CUTS.near`. */
export type DogLod = "near" | "far";
export const DOG_LODS: readonly DogLod[] = ["near", "far"];

/** The slots a vertex is painted from (0: its own colour). */
export const DOG_SLOT = { main: 1, under: 2, back: 3, mask: 4, collar: 5, coat: 6 } as const;

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const WHITE = new THREE.Color(1, 1, 1);
const NOSE = new THREE.Color(0x141210);
const EYE = new THREE.Color(0x1c140f);

/** How many sides each part is lofted with at a cut. */
const SIDES = {
  near: { body: 8, neck: 6, head: 6, leg: 5, tail: 5 },
  far: { body: 5, neck: 4, head: 4, leg: 3, tail: 3 },
} as const;

/** A ring of `n` points round `c`, `a` across along `x` and `b` along
 * `y`, the first at the top. */
function ringAt(c: V3, x: V3, y: V3, a: number, b: number, n: number): V3[] {
  const out: V3[] = [];
  for (let j = 0; j < n; j++) {
    const t = (j / n) * Math.PI * 2;
    out.push(add(add(c, mul(x, a * Math.sin(t))), mul(y, b * Math.cos(t))));
  }
  return out;
}

/** The slot the quad between ring corners j and j+1 is painted from, by
 * where round the ring it is: the back's along the top, the under colour
 * along the bottom, the main colour between. */
function sideSlot(j: number, n: number, back: number, under: number, main: number): number {
  const t = ((j + 0.5) / n) * Math.PI * 2;
  const c = Math.cos(t);
  return c > 0.55 ? back : c < -0.45 ? under : main;
}

/** A loft through `rings` round `centres`, each quad painted from the
 * slot `slot(k, j)`. */
function loftSlots(
  s: Shape,
  rings: V3[][],
  centres: V3[],
  slot: (k: number, j: number) => number,
): void {
  for (let k = 0; k + 1 < rings.length; k++) {
    const a = rings[k];
    const b = rings[k + 1];
    for (let j = 0; j < a.length; j++) {
      s.mark("aSlot", slot(k, j));
      const j1 = (j + 1) % a.length;
      const o = (p: V3, c: V3): V3 => sub(p, c);
      s.push(a[j], WHITE, o(a[j], centres[k]));
      s.push(a[j1], WHITE, o(a[j1], centres[k]));
      s.push(b[j1], WHITE, o(b[j1], centres[k + 1]));
      s.push(a[j], WHITE, o(a[j], centres[k]));
      s.push(b[j1], WHITE, o(b[j1], centres[k + 1]));
      s.push(b[j], WHITE, o(b[j], centres[k + 1]));
    }
  }
}

/** A frame square to `axis`: its right (level where it can be) and up. */
function frameAbout(axis: V3): { x: V3; y: V3 } {
  const a = norm(axis);
  const ref: V3 = Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const y = norm(cross(a, ref));
  const x = norm(cross(y, a));
  return { x, y };
}

/** A limb lofted from `a` to `b`, radii `ra` to `rb`. */
function limb(s: Shape, a: V3, b: V3, ra: number, rb: number, n: number, slot: number): void {
  const { x, y } = frameAbout(sub(b, a));
  loftSlots(s, [ringAt(a, x, y, ra, ra, n), ringAt(b, x, y, rb, rb, n)], [a, b], () => slot);
}

/** ONE POSE OF A KIND AT A CUT: the same calls in the same order for every
 * pose. */
function emit(s: Shape, kind: DogKind, lod: DogLod, k: DogSkel): void {
  const spec = DOG_SPECS[kind];
  const n = SIDES[lod];
  const H = spec.height;
  const S = DOG_SLOT;
  s.mark("aPart", 0);

  // THE BODY.
  const X: V3 = [1, 0, 0];
  const bodyRings = k.rings.map((r) => ringAt(r.c, X, r.up, r.hw, r.hh, n.body));
  const centres = k.rings.map((r) => r.c);
  loftSlots(s, bodyRings, centres, (ki, j) =>
    // The chest's front and the belly under the colour; the saddle along
    // the back from the withers to the croup.
    ki === 0
      ? sideSlot(j, n.body, S.main, S.under, S.under)
      : sideSlot(j, n.body, S.back, S.under, S.main),
  );
  s.mark("aSlot", S.under);
  const fwd = norm(sub(centres[0], centres[1]));
  s.cap(bodyRings[0], add(centres[0], mul(fwd, 0.04 * H)), WHITE, fwd, true);
  s.mark("aSlot", S.main);
  const back = norm(sub(centres[6], centres[5]));
  s.cap(bodyRings[6], add(centres[6], mul(back, 0.05 * H)), WHITE, back);

  // THE NECK, from the top of the chest to the poll.
  const [nb, nt] = k.neck;
  const neckR0 = k.rings[1].hw * 0.82;
  const neckR1 = spec.head * 0.3;
  const nf = frameAbout(sub(nt, nb));
  const neckRings = [
    ringAt(nb, nf.x, nf.y, neckR0, neckR0 * 1.05, n.neck),
    ringAt(
      add(nb, mul(sub(nt, nb), 0.5)),
      nf.x,
      nf.y,
      (neckR0 + neckR1) / 2,
      (neckR0 + neckR1) / 1.9,
      n.neck,
    ),
    ringAt(nt, nf.x, nf.y, neckR1, neckR1 * 1.1, n.neck),
  ];
  loftSlots(s, neckRings, [nb, add(nb, mul(sub(nt, nb), 0.5)), nt], (_, j) =>
    sideSlot(j, n.neck, S.back, S.under, S.main),
  );

  // THE COLLAR round the neck, low on it.
  if (lod === "near") {
    const c0 = add(nb, mul(sub(nt, nb), 0.32));
    const c1 = add(nb, mul(sub(nt, nb), 0.32 + Math.min(0.25, 0.03 / len(sub(nt, nb)))));
    const r = (neckR0 * 0.68 + neckR1 * 0.32) * 1.12;
    loftSlots(
      s,
      [ringAt(c0, nf.x, nf.y, r, r * 1.05, n.neck), ringAt(c1, nf.x, nf.y, r, r * 1.05, n.neck)],
      [c0, c1],
      () => S.collar,
    );
  }

  // THE HEAD: the back of the skull, the skull, the stop, the muzzle.
  const hl = spec.head;
  const { at, dir, up, side } = k.head;
  const along = (u: number, drop = 0): V3 => add(add(at, mul(dir, u * hl)), mul(up, -drop * hl));
  const broad = kind === "retriever" ? 1.12 : kind === "husky" || kind === "shepherd" ? 0.95 : 1;
  const stop = 1 - spec.muzzle;
  const headSpec: [number, number, number, number][] = [
    // [along, drop, half width, half height] as shares of the head.
    [0, 0, 0.24 * broad, 0.28],
    [0.28, 0, 0.34 * broad, 0.37],
    [stop, 0.07, 0.26 * broad, 0.27],
    [0.97, 0.14, 0.15, 0.14],
  ];
  const headRings = headSpec.map(([u, d, w, h]) =>
    ringAt(along(u, d), side, up, w * hl, h * hl, n.head),
  );
  const headCentres = headSpec.map(([u, d]) => along(u, d));
  loftSlots(s, headRings, headCentres, (ki, j) =>
    ki >= 2
      ? S.mask
      : ki === 1
        ? sideSlot(j, n.head, S.main, S.mask, S.main)
        : sideSlot(j, n.head, S.back, S.main, S.main),
  );
  s.mark("aSlot", S.main);
  s.cap(headRings[0], along(-0.05), WHITE, mul(dir, -1), true);
  // The nose: the muzzle's end, black.
  s.mark("aSlot", 0);
  s.cap(headRings[3], along(1.03, 0.11), NOSE, dir);
  if (lod === "near") {
    // The eyes, a dark facet either side at the stop.
    for (const sd of [-1, 1]) {
      const e = add(along(stop - 0.04, -0.06), mul(side, sd * 0.25 * broad * hl));
      const a = add(e, mul(up, 0.035 * hl));
      const b = add(e, mul(dir, 0.07 * hl));
      const c = add(e, mul(up, -0.03 * hl));
      s.tri(a, b, c, EYE, mul(side, sd));
    }
  }

  // THE EARS: pricked up off the skull, or dropped down by the cheeks.
  s.mark("aSlot", S.back);
  const el = spec.ear * hl;
  for (const sd of [-1, 1]) {
    const root = add(along(0.24), mul(side, sd * 0.21 * broad * hl));
    const top = add(root, mul(up, 0.3 * hl));
    if (spec.ears === "erect") {
      const tip = add(
        add(top, mul(up, el * 0.95)),
        add(mul(side, sd * el * 0.22), mul(dir, -0.05 * hl)),
      );
      const fore = add(top, mul(dir, 0.13 * hl));
      const aft = add(top, mul(dir, -0.12 * hl));
      s.tri(fore, tip, aft, WHITE, add(mul(dir, 0.6), mul(side, sd * 0.4)));
      s.tri(aft, tip, fore, WHITE, add(mul(dir, -0.6), mul(side, sd * 0.4)));
    } else {
      const outSide = add(top, mul(side, sd * 0.1 * hl));
      const hang = add(outSide, add(mul(up, -el), mul(side, sd * 0.08 * hl)));
      const fore = add(outSide, mul(dir, 0.1 * hl));
      const aft = add(outSide, mul(dir, -0.11 * hl));
      const lowF = add(hang, mul(dir, 0.07 * hl));
      const lowA = add(hang, mul(dir, -0.08 * hl));
      s.quad(aft, fore, lowF, lowA, WHITE, mul(side, sd));
      s.quad(lowA, lowF, fore, aft, WHITE, mul(side, -sd));
    }
  }

  // THE LEGS: the upper part the coat's, from the elbow and stifle down
  // the under colour, a paw on the end.
  for (let i = 0; i < 4; i++) {
    const g = k.legs[i];
    const fore = i < 2;
    const r = H * (fore ? 0.075 : 0.085) * (kind === "dachshund" ? 1.2 : 1);
    limb(s, g.top, g.mid, r * (fore ? 1.25 : 1.6), r, n.leg, S.main);
    limb(s, g.mid, g.low, r * 0.95, r * 0.75, n.leg, S.under);
    limb(s, g.low, g.paw, r * 0.75, r * 0.8, n.leg, S.under);
    // The paw, a little block forward of the foot.
    const toe = add(g.paw, [0, 0, r * 1.6]);
    limb(
      s,
      add(g.paw, [0, r * 0.5, -r * 0.4]),
      add(toe, [0, r * 0.4, 0]),
      r * 0.95,
      r * 0.7,
      n.leg,
      S.under,
    );
  }

  // THE TAIL, its rings thinning to the tip.
  const tail = k.tail;
  const tailRings: V3[][] = [];
  for (let i = 0; i < tail.length; i++) {
    const axis = sub(tail[Math.min(tail.length - 1, i + 1)], tail[Math.max(0, i - 1)]);
    const f = frameAbout(axis);
    const r = spec.bush * H * (1 - (0.75 * i) / (tail.length - 1));
    tailRings.push(ringAt(tail[i], f.x, f.y, r, r, n.tail));
  }
  loftSlots(s, tailRings, tail, (_, j) => sideSlot(j, n.tail, S.back, S.under, S.main));
  s.mark("aSlot", S.main);
  const tipDir = norm(sub(tail[tail.length - 1], tail[tail.length - 2]));
  s.cap(
    tailRings[tail.length - 1],
    add(tail[tail.length - 1], mul(tipDir, spec.bush * H * 0.5)),
    WHITE,
    tipDir,
  );

  // THE DOG COAT over the back, the withers to the loin, down the flanks.
  s.mark("aPart", 1);
  const top = n.body;
  const span = Math.round(top * 0.36);
  const coatRings = k.rings
    .slice(1, 5)
    .map((r) => ringAt(r.c, X, r.up, r.hw * 1.1, r.hh * 1.1, top));
  for (let ki = 0; ki + 1 < coatRings.length; ki++) {
    const a = coatRings[ki];
    const b = coatRings[ki + 1];
    const ca = k.rings[ki + 1].c;
    const cb = k.rings[ki + 2].c;
    for (let jj = -span; jj < span; jj++) {
      const j = (jj + top) % top;
      const j1 = (j + 1) % top;
      s.mark("aSlot", S.coat);
      s.push(a[j], WHITE, sub(a[j], ca));
      s.push(a[j1], WHITE, sub(a[j1], ca));
      s.push(b[j1], WHITE, sub(b[j1], cb));
      s.push(a[j], WHITE, sub(a[j], ca));
      s.push(b[j1], WHITE, sub(b[j1], cb));
      s.push(b[j], WHITE, sub(b[j], cb));
    }
  }
  s.mark("aPart", 0);
}

const built = new Map<string, THREE.BufferGeometry>();

/** The geometry of one pose (the stance, or a target). */
export function dogPoseGeometry(
  kind: DogKind,
  lod: DogLod,
  target: (typeof DOG_POSES)[number] | "stand",
) {
  const s = new Shape(0, { marks: { aSlot: 1, aPart: 1 }, stems: false });
  s.facet = 0.6;
  emit(s, kind, lod, dogSkel(kind, target));
  return s.geometry();
}

/** ONE KIND AT ONE CUT, stood, with every pose of `DOG_POSES` as a
 * relative morph target. Built once a session and shared. */
export function buildDogFigure(kind: DogKind, lod: DogLod): THREE.BufferGeometry {
  const key = `${kind}:${lod}`;
  const had = built.get(key);
  if (had) return had;
  const base = dogPoseGeometry(kind, lod, "stand");
  const bp = base.getAttribute("position").array as Float32Array;
  const bn = base.getAttribute("normal").array as Float32Array;
  const targets = DOG_POSES.map((t) => dogPoseGeometry(kind, lod, t));
  const delta = (g: THREE.BufferGeometry, attr: "position" | "normal", from: Float32Array) => {
    const a = g.getAttribute(attr).array as Float32Array;
    if (a.length !== from.length) throw new Error(`dog ${key}: a pose changed the mesh`);
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] - from[i];
    return new THREE.Float32BufferAttribute(out, 3);
  };
  base.morphAttributes.position = targets.map((g) => delta(g, "position", bp));
  base.morphAttributes.normal = targets.map((g) => delta(g, "normal", bn));
  base.morphTargetsRelative = true;
  for (const g of targets) g.dispose();
  const H = DOG_SPECS[kind].height;
  base.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, H / 2, 0),
    DOG_SPECS[kind].length + H,
  );
  built.set(key, base);
  return base;
}

/** How many triangles a kind's cut is. */
export function dogTriangles(kind: DogKind, lod: DogLod): number {
  return buildDogFigure(kind, lod).getAttribute("position").count / 3;
}

/** An sRGB colour packed into one float the shader unpacks. */
export function packColour(hex: number): number {
  return hex & 0xffffff;
}

/** The slot picker: an sRGB colour unpacked off the instance's packed
 * six, made linear, times the vertex's own. And the dog coat folded away
 * where it is not worn. */
const PAINT_GLSL = `#include <color_vertex>
#ifdef USE_COLOR
\tif (aSlot > 0.5) {
\t\tfloat c = aSlot < 1.5 ? aCoat.x : aSlot < 2.5 ? aCoat.y : aSlot < 3.5 ? aCoat.z
\t\t\t: aSlot < 4.5 ? aCoat.w : aSlot < 5.5 ? aCoat2.x : aCoat2.y;
\t\tvec3 srgb = vec3(floor(c / 65536.0), mod(floor(c / 256.0), 256.0), mod(c, 256.0)) / 255.0;
\t\tvColor.rgb = pow(srgb, vec3(2.2)) * color.rgb;
\t}
#endif`;
const FOLD_GLSL = `#include <morphtarget_vertex>
\tif (aPart > 0.5 && aCoat2.z < 0.5) transformed = vec3(0.0);`;

/** THE DOGS' MATERIAL: Lambert, vertex-coloured, in the haze, each vertex
 * painted from its dog's colours, the dog coat folded where not worn. */
export function dogMaterial(haze: HazeUniforms): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  return hazeMaterial(material, haze, "dogs", (shader) => {
    shader.vertexShader = `attribute float aSlot;
attribute float aPart;
attribute vec4 aCoat;
attribute vec4 aCoat2;
${shader.vertexShader}`
      .replace("#include <color_vertex>", PAINT_GLSL)
      .replace("#include <morphtarget_vertex>", FOLD_GLSL);
  });
}
