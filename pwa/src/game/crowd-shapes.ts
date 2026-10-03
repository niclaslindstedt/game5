// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CROWD, BUILT — every amateur's figure PROCEDURALLY, on the trees' and
// the animals' bench (`tree-mesh.ts`): chunky, faceted, low-poly, one
// geometry a BODY (`CROWD_LOOKS`: a man, a woman, a teenager, a child, an
// older man and woman, a freerider with a pack, a retro one-piece) at three
// cuts (`CrowdLod`: NEAR, MID and FAR, the far one under a hundred
// triangles), each carrying the player's own poses as MORPH TARGETS
// (`crowd-rig.ts`), so one draw call holds every one of that body at that
// cut doing whatever he is doing.
//
// LESS THAN THE PLAYER, ON PURPOSE. The player is a modelled figure in cloth
// with folds; an amateur is a few hundred triangles seen from forty metres,
// and what reads from there is the silhouette and the colour: a helmet or a
// hat with a pompom, a ponytail out of the back of a helmet, a pack, a long
// coat, a belly, a child's big head on a short body, two skis and two
// poles. Each face is one flat colour, and most of them are the KIT's
// (`DRESS_SLOT`): a vertex says which part of the outfit it is (`aSlot`)
// and the instance says what that outfit is (`aDress`, `aDress2`: indices
// into `CROWD_PALETTE`), picked in the vertex shader — so eight bodies in a
// few dozen colours are hundreds of different people at no cost.
//
// A LIMB is never built round its own direction alone — a ring's start
// would flip as a thigh swung past level, and a blended leg would twist —
// but round the body's own RIGHT, read off the pose's hips or shoulders.

import * as THREE from "three";
import type { CrowdBody } from "@engine";

import { CROWD_PALETTE, DRESS_SLOT } from "./crowd-dress.ts";
import {
  CROWD_LOOKS,
  crowdTargets,
  cross,
  type CrowdLook,
  type Posed,
  type V3,
} from "./crowd-rig.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { Shape } from "./tree-mesh.ts";

export type CrowdLod = "near" | "mid" | "far";
export const CROWD_LODS: readonly CrowdLod[] = ["near", "mid", "far"];

/** How round each part is at each cut: the torso's sides, a limb's, the
 * head's — and whether the cut carries the small things (the poles, the
 * goggles, the hair, the pompom, the tips of the skis). */
const CUT: Readonly<
  Record<CrowdLod, { torso: number; limb: number; head: number; small: boolean; poles: boolean }>
> = {
  near: { torso: 6, limb: 5, head: 6, small: true, poles: true },
  mid: { torso: 4, limb: 4, head: 5, small: true, poles: true },
  far: { torso: 4, limb: 3, head: 4, small: false, poles: false },
};

/** The kit's own colours, painted into the mesh: boots, gloves, goggles'
 * lens, poles. */
const BOOT = new THREE.Color(0x24272d);
const GLOVE = new THREE.Color(0x1d1f24);
const LENS = new THREE.Color(0xd08a2c);
const POLE = new THREE.Color(0x9ea6ae);
/** A dressed face's shade: the multiplier its slot's colour is drawn at —
 * the facets a shade apart so a jacket still reads as a body. */
const FULL = new THREE.Color(1, 1, 1);
const SHADE = new THREE.Color(0.86, 0.86, 0.86);

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: V3): V3 => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const mix = (a: V3, b: V3, t: number): V3 => add(mul(a, 1 - t), mul(b, t));

/** A body's frame at a point: its right, its up and its forward. */
type Frame = { r: V3; u: V3; f: V3 };

function frameOf(right: V3, up: V3): Frame {
  const u = norm(up);
  const r = norm(sub(right, mul(u, dot(right, u))));
  return { r, u, f: cross(r, u) };
}

/** A ring of `sides` round `c` in the plane of `fr.r` and `fr.f`, its radii
 * `rx` across and `rz` front to back. */
function ring(c: V3, fr: Frame, rx: number, rz: number, sides: number): V3[] {
  return Array.from({ length: sides }, (_, k) => {
    const a = (k / sides) * Math.PI * 2 + Math.PI / sides;
    return add(c, add(mul(fr.r, Math.cos(a) * rx), mul(fr.f, Math.sin(a) * rz)));
  });
}

class Figure {
  readonly s = new Shape(0, { marks: { aSlot: 1 }, stems: false });
  constructor() {
    this.s.facet = 0.55;
  }
  slot(k: number): void {
    this.s.mark("aSlot", k);
  }
  /** A tube from `a` to `b`, its rings started off `ref` (a body's right),
   * radii `ra` to `rb`, closed at `b` when `cap`. */
  limb(
    a: V3,
    b: V3,
    ref: V3,
    ra: number,
    rb: number,
    sides: number,
    c: THREE.Color,
    cap = false,
  ): void {
    const w = norm(sub(b, a));
    let u = sub(ref, mul(w, dot(ref, w)));
    if (Math.hypot(u[0], u[1], u[2]) < 1e-4) u = cross(w, [0, 0, 1]);
    u = norm(u);
    const v = cross(w, u);
    const at = (c0: V3, r: number, k: number): { p: V3; n: V3 } => {
      const t = (k / sides) * Math.PI * 2;
      const n = add(mul(u, Math.cos(t)), mul(v, Math.sin(t)));
      return { p: add(c0, mul(n, r)), n };
    };
    for (let k = 0; k < sides; k++) {
      const a0 = at(a, ra, k);
      const a1 = at(a, ra, k + 1);
      const b0 = at(b, rb, k);
      const b1 = at(b, rb, k + 1);
      this.s.push(a0.p, c, a0.n);
      this.s.push(b1.p, c, b1.n);
      this.s.push(a1.p, c, a1.n);
      this.s.push(a0.p, c, a0.n);
      this.s.push(b0.p, c, b0.n);
      this.s.push(b1.p, c, b1.n);
    }
    if (cap) {
      const tip = add(b, mul(w, rb * 0.6));
      for (let k = 0; k < sides; k++) {
        const p0 = at(b, rb, k).p;
        const p1 = at(b, rb, k + 1).p;
        this.s.tri(p0, p1, tip, c, w);
      }
    }
  }
  /** A loft through rings, banded by `paint(band)` → [slot, shade]; closed
   * at the top to `top`. */
  loft(
    rings: V3[][],
    centres: V3[],
    paint: (k: number) => [number, THREE.Color],
    top: V3 | null,
  ): void {
    for (let k = 0; k + 1 < rings.length; k++) {
      const [slot, c] = paint(k);
      this.slot(slot);
      const a = rings[k];
      const b = rings[k + 1];
      for (let i = 0; i < a.length; i++) {
        const j = (i + 1) % a.length;
        const na = (p: V3): V3 => sub(p, centres[k]);
        const nb = (p: V3): V3 => sub(p, centres[k + 1]);
        this.s.push(a[i], c, na(a[i]));
        this.s.push(b[j], c, nb(b[j]));
        this.s.push(a[j], c, na(a[j]));
        this.s.push(a[i], c, na(a[i]));
        this.s.push(b[i], c, nb(b[i]));
        this.s.push(b[j], c, nb(b[j]));
      }
    }
    if (top) {
      const last = rings[rings.length - 1];
      const [slot, c] = paint(rings.length - 1);
      this.slot(slot);
      for (let i = 0; i < last.length; i++) {
        this.s.tri(
          last[i],
          last[(i + 1) % last.length],
          top,
          c,
          sub(top, centres[centres.length - 1]),
        );
      }
    }
  }
  /** A ski: its top in the skis' colour, its edges a shade under, and its
   * tip turned up — a quad a part, two triangles on the far cut. */
  ski(sk: { tail: V3; tip: V3; mid: V3; side: V3 }, lod: CrowdLod): void {
    const f = norm(sub(sk.tip, sk.tail));
    const r = sub(sk.side, sk.mid);
    const n = norm(cross(f, norm(r)));
    const lift = mul(n, 0.02);
    const tl = add(sub(sk.tail, r), lift);
    const tr = add(add(sk.tail, r), lift);
    const pl = add(sub(sk.tip, r), lift);
    const pr = add(add(sk.tip, r), lift);
    this.slot(DRESS_SLOT.skis);
    this.s.quad(tl, tr, pr, pl, FULL, n);
    if (lod === "far") return;
    const curl = add(mul(f, 0.1), mul(n, 0.07));
    this.s.quad(pl, pr, add(pr, curl), add(pl, curl), FULL, norm(sub(n, f)));
    if (lod !== "near") return;
    const down = mul(n, -0.03);
    this.s.quad(add(tl, down), tl, pl, add(pl, down), SHADE, norm(mul(r, -1)));
    this.s.quad(tr, add(tr, down), add(pr, down), pr, SHADE, norm(r));
  }
}

/** Build one pose of a body at a cut. The same calls in the same order
 * for every pose: what differs is where the joints are. */
function emit(fig: Figure, P: Posed, look: CrowdLook, lod: CrowdLod): void {
  const cut = CUT[lod];
  const H = look.height;
  const k = H / 1.8;
  const hips = frameOf(sub(P.hipR, P.hipL), sub(P.neck, P.pelvis));
  const chest = frameOf(sub(P.shoulderR, P.shoulderL), sub(P.neck, P.waist));
  const own = DRESS_SLOT.own;

  // ── The skis and the boots ─────────────────────────────────────────────
  fig.ski(P.skiL, lod);
  fig.ski(P.skiR, lod);
  fig.slot(own);
  for (const [ankle, sk] of lod === "far"
    ? []
    : ([
        [P.ankleL, P.skiL],
        [P.ankleR, P.skiR],
      ] as const)) {
    const toe = add(sk.mid, mul(norm(sub(sk.tip, sk.tail)), 0.06));
    fig.limb(
      ankle,
      add(toe, mul(norm(sub(ankle, toe)), 0.03)),
      hips.r,
      0.06 * k,
      0.07 * k,
      4,
      BOOT,
    );
  }

  // ── The legs ───────────────────────────────────────────────────────────
  // One-piece or coat, the thighs are whatever the suit is.
  fig.slot(DRESS_SLOT.pants);
  for (const [hip, knee, ankle] of [
    [P.hipL, P.kneeL, P.ankleL],
    [P.hipR, P.kneeR, P.ankleR],
  ] as const) {
    fig.limb(hip, knee, hips.r, 0.078 * k, 0.062 * k, cut.limb, FULL);
    fig.limb(knee, ankle, hips.r, 0.062 * k, 0.058 * k, cut.limb, SHADE);
  }

  // ── The trunk: keyed rings from the seat to the collar ────────────────
  const up = hips.u;
  const coat = look.coat ?? 0;
  const seat = sub(P.pelvis, mul(up, 0.04 * H + coat));
  const hem = add(P.pelvis, mul(up, 0.05 * H - coat * 0.3));
  const belly = mix(P.pelvis, P.waist, 0.8);
  const ribs = mix(P.waist, P.neck, 0.55);
  const shoulders = mix(P.shoulderL, P.shoulderR, 0.5);
  const collar = add(P.neck, mul(chest.u, 0.02 * H));
  const S = cut.torso;
  const keyed: [V3, Frame, number, number][] =
    lod === "far"
      ? [
          [seat, hips, look.hip + 0.02, look.girth * 0.95],
          [belly, hips, (look.hip + look.shoulder) / 2 + look.belly, look.girth + look.belly],
          [shoulders, chest, look.shoulder + 0.02, look.girth * 0.85],
          [collar, chest, 0.07 * k, 0.065 * k],
        ]
      : [
          [seat, hips, look.hip + 0.02, look.girth * 0.95],
          [hem, hips, look.hip + 0.03 + look.belly * 0.6, look.girth + look.belly * 0.6],
          [belly, hips, (look.hip + look.shoulder) / 2 + look.belly, look.girth + look.belly * 1.2],
          [ribs, chest, look.shoulder * 0.92, look.girth * 1.05],
          [shoulders, chest, look.shoulder + 0.02, look.girth * 0.85],
          [collar, chest, 0.07 * k, 0.065 * k],
        ];
  const rings = keyed.map(([c, fr, rx, rz]) => ring(c, fr, rx, rz, S));
  const last = keyed.length - 2;
  const lower = look.suit || coat > 0 ? DRESS_SLOT.jacket : DRESS_SLOT.pants;
  fig.loft(
    rings,
    keyed.map(([c]) => c),
    (band) =>
      band === 0
        ? [lower, SHADE]
        : band >= last
          ? [DRESS_SLOT.accent, FULL]
          : [DRESS_SLOT.jacket, band % 2 ? FULL : SHADE],
    add(P.neck, mul(chest.u, 0.05 * H)),
  );
  // A pack on the back of the freerider.
  if (look.pack) {
    const back = sub(mix(P.waist, P.neck, 0.5), mul(chest.f, look.girth + 0.07));
    fig.slot(DRESS_SLOT.accent);
    fig.limb(
      sub(back, mul(chest.u, 0.2)),
      add(back, mul(chest.u, 0.2)),
      chest.r,
      0.14,
      0.12,
      4,
      SHADE,
      true,
    );
  }

  // ── The arms, the gloves and the poles ────────────────────────────────
  for (const [shoulder, elbow, hand, basket] of [
    [P.shoulderL, P.elbowL, P.handL, P.basketL],
    [P.shoulderR, P.elbowR, P.handR, P.basketR],
  ] as const) {
    fig.slot(DRESS_SLOT.jacket);
    if (lod === "far") {
      fig.limb(shoulder, hand, chest.r, 0.05 * k, 0.04 * k, 3, FULL);
    } else {
      fig.limb(shoulder, elbow, chest.r, 0.056 * k, 0.046 * k, cut.limb - 1, FULL);
      fig.limb(elbow, hand, chest.r, 0.046 * k, 0.04 * k, cut.limb - 1, SHADE);
    }
    if (lod === "far") continue;
    fig.slot(own);
    const into = norm(sub(hand, elbow));
    fig.limb(
      sub(hand, mul(into, 0.02)),
      add(hand, mul(into, 0.05)),
      chest.r,
      0.045 * k,
      0.04 * k,
      3,
      GLOVE,
      true,
    );
    if (look.poles && cut.poles) fig.limb(hand, basket, chest.r, 0.011, 0.008, 3, POLE);
  }

  // ── The head, and what is on it ───────────────────────────────────────
  const r = look.head;
  const head = frameOf(chest.r, sub(P.head, P.neck));
  const at = (u: number, f = 0): V3 => add(add(P.head, mul(head.u, u * r)), mul(head.f, f * r));
  const HS = cut.head;
  fig.loft(
    [
      ring(at(-0.95), head, r * 0.55, r * 0.6, HS),
      ring(at(-0.2), head, r * 0.92, r, HS),
      ring(at(0.35), head, r * 0.95, r, HS),
    ],
    [at(-0.95), at(-0.2), at(0.35)],
    () => [DRESS_SLOT.skin, FULL],
    null,
  );
  const hatBand =
    look.hat === "helmet"
      ? [0.05, 1.12, 1.18]
      : look.hat === "cap"
        ? [0.15, 1.06, 1.08]
        : [0.12, 1.07, 1.1];
  fig.loft(
    [
      ring(at(hatBand[0], -0.06), head, r * hatBand[1], r * hatBand[2], HS),
      ring(at(0.75, -0.08), head, r * 0.82, r * 0.88, HS),
    ],
    [at(hatBand[0], -0.06), at(0.75, -0.08)],
    (band) => [DRESS_SLOT.head, band === 0 ? SHADE : FULL],
    at(look.hat === "helmet" ? 1.12 : 1.05, -0.1),
  );
  if (!cut.small) return;
  // The goggles on a helmet, sunglasses under a hat.
  fig.slot(own);
  const gw = look.hat === "helmet" || look.hat === "beanie" ? 0.62 : 0.5;
  const gh = look.hat === "helmet" ? 0.24 : 0.14;
  const gc = at(look.hat === "helmet" ? -0.12 : -0.18, 1.02);
  fig.s.quad(
    add(add(gc, mul(head.r, -gw * r)), mul(head.u, -gh * r)),
    add(add(gc, mul(head.r, gw * r)), mul(head.u, -gh * r)),
    add(add(gc, mul(head.r, gw * r)), mul(head.u, gh * r)),
    add(add(gc, mul(head.r, -gw * r)), mul(head.u, gh * r)),
    LENS,
    head.f,
  );
  if (look.hat === "pompom") {
    fig.slot(DRESS_SLOT.accent);
    fig.limb(at(1.0, -0.1), at(1.42, -0.12), head.r, r * 0.3, r * 0.12, 4, FULL, true);
  }
  if (look.hat === "cap") {
    fig.slot(DRESS_SLOT.head);
    const w = mul(head.r, r * 0.7);
    fig.s.quad(
      sub(at(0.2, 0.9), w),
      add(at(0.2, 0.9), w),
      add(at(0.1, 1.5), w),
      sub(at(0.1, 1.5), w),
      SHADE,
      head.u,
    );
  }
  if (look.hair) {
    fig.slot(DRESS_SLOT.hair);
    const long = look.hair === "ponytail";
    fig.limb(
      at(0.05, -0.85),
      at(long ? -1.2 : -0.75, long ? -1.35 : -1.05),
      head.r,
      r * (long ? 0.28 : 0.55),
      r * (long ? 0.1 : 0.4),
      4,
      FULL,
      true,
    );
  }
}

const built = new Map<string, THREE.BufferGeometry>();

/** ONE BODY AT ONE CUT, standing, with every pose of `CROWD_POSES` as a
 * relative morph target (positions and normals), and `aSlot` on every
 * vertex. Built once a session and shared; the caller adds the instance
 * attributes to a clone. */
export function buildCrowdFigure(body: CrowdBody, lod: CrowdLod): THREE.BufferGeometry {
  const key = `${body}:${lod}`;
  const cached = built.get(key);
  if (cached) return cached;
  const look = CROWD_LOOKS[body];
  const shapes = crowdTargets(look).map((pose) => {
    const fig = new Figure();
    emit(fig, pose, look, lod);
    return fig.s.geometry();
  });
  const base = shapes[0];
  const bp = base.getAttribute("position").array as Float32Array;
  const bn = base.getAttribute("normal").array as Float32Array;
  const delta = (g: THREE.BufferGeometry, name: "position" | "normal", from: Float32Array) => {
    const a = g.getAttribute(name).array as Float32Array;
    if (a.length !== from.length) throw new Error(`crowd ${key}: a pose changed the mesh`);
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] - from[i];
    return new THREE.Float32BufferAttribute(out, 3);
  };
  base.morphAttributes.position = shapes.slice(1).map((g) => delta(g, "position", bp));
  base.morphAttributes.normal = shapes.slice(1).map((g) => delta(g, "normal", bn));
  base.morphTargetsRelative = true;
  for (const g of shapes.slice(1)) g.dispose();
  // Every pose's reach, so the instance is never culled out of its own lean.
  base.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, look.height / 2, 0),
    look.height * 1.4,
  );
  built.set(key, base);
  return base;
}

/** How many triangles a body's cut is. */
export function crowdTriangles(body: CrowdBody, lod: CrowdLod): number {
  return buildCrowdFigure(body, lod).getAttribute("position").count / 3;
}

/** THE CROWD'S MATERIAL: Lambert, vertex-coloured, in the haze, every
 * dressed vertex painted in the vertex shader from the instance's outfit.
 * One program for the whole crowd. */
export function crowdMaterial(haze: HazeUniforms): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const palette = { value: CROWD_PALETTE.map((hex) => new THREE.Color(hex)) };
  return hazeMaterial(material, haze, "crowd", (shader) => {
    shader.uniforms.uCrowdPalette = palette;
    shader.vertexShader = `attribute float aSlot;
attribute vec4 aDress;
attribute vec4 aDress2;
uniform vec3 uCrowdPalette[${CROWD_PALETTE.length}];
${shader.vertexShader}`.replace(
      "#include <color_vertex>",
      `#include <color_vertex>
#ifdef USE_COLOR
\tif (aSlot > 0.5) {
\t\tfloat k = aSlot < 1.5 ? aDress.x : aSlot < 2.5 ? aDress.y : aSlot < 3.5 ? aDress.z
\t\t\t: aSlot < 4.5 ? aDress.w : aSlot < 5.5 ? aDress2.x : aSlot < 6.5 ? aDress2.y : aDress2.z;
\t\tvColor.rgb = uCrowdPalette[int(k + 0.5)] * color.rgb;
\t}
#endif`,
    );
  });
}
