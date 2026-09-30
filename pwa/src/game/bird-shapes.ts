// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BIRDS, BUILT — one flat-shaded, vertex-coloured geometry a species out
// of the roster's own numbers (`bird-defs.ts`), and the material that flies
// it. The look is here: `BIRD_STYLES` is the paint, and the proportions come
// from the row, so a swan is built long-necked because the roster says so.
//
// SEEN FROM BELOW is the design constraint. A chase camera on the snow looks
// UP at a bird against a winter sky, so what reads is the UNDERSIDE and the
// SILHOUETTE: every wing is two surfaces, a mantle on top and a belly colour
// beneath, and the neck, the tail and the WING — a raven's wedge-tailed
// cross, a grouse's short round paddle, an eagle's long fingered plank —
// are the things still legible when the bird is four pixels.
//
// THE WINGS MOVE IN THE VERTEX SHADER. A rigid bird is a paper dart and a
// group of meshes per bird is three draw calls a bird; so the wing carries
// its own hinges: every wing vertex knows it is a wing (`aWing`), and per
// instance the shader is told the FLAP (the shoulder's angle off level) and
// the FOLD (0 open, 1 closed along the flank). Both are read off `birdPose`;
// the graft rides in beside the haze's (`hazeMaterial`), so a bird fades
// into the same air as the wood behind it. One draw call a species.

import * as THREE from "three";

import { Builder, type P } from "../lib/lowpoly.ts";
import type { BirdId, BirdSpec } from "./bird-defs.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";

/** How a species is PAINTED — every colour a bird has. */
export type BirdStyle = {
  /** The mantle: the back and the top of the wing. */
  readonly back: number;
  /** The underside: the belly and the underwing. */
  readonly belly: number;
  /** The wingtip — the outer hand, both faces. */
  readonly tip: number;
  readonly head: number;
  readonly bill: number;
  /** The tail, when it is not the mantle's colour. */
  readonly tail?: number;
};

export const BIRD_STYLES: Readonly<Record<BirdId, BirdStyle>> = {
  // Black all over, with a sheen the flat shading gives it for free.
  raven: { back: 0x16181b, belly: 0x1c1f23, tip: 0x0e1012, head: 0x16181b, bill: 0x121314 },
  // White for the winter, all of it — except the tail, whose outer feathers
  // stay black, and which is the one thing a flushed covey shows.
  ptarmigan: {
    back: 0xf3f4f2,
    belly: 0xf7f8f6,
    tip: 0xeceeea,
    head: 0xf3f4f2,
    bill: 0x202020,
    tail: 0x17181a,
  },
  // The blackcock: glossy blue-black, white wing bars and the lyre tail's
  // white undertail.
  blackgrouse: {
    back: 0x1a1d24,
    belly: 0x15171c,
    tip: 0x2a2c30,
    head: 0x1c2028,
    bill: 0x202020,
    tail: 0xe8e8ea,
  },
  // The cock: slate-black, a brown wing, a pale bill.
  capercaillie: {
    back: 0x2d3034,
    belly: 0x1d1f22,
    tip: 0x5a4632,
    head: 0x24272b,
    bill: 0xd9d2b8,
    tail: 0x1a1b1d,
  },
  // Glossy black, the yellow bill and the red legs the flat shading has no
  // feet to show.
  chough: { back: 0x121417, belly: 0x1a1d21, tip: 0x0c0e10, head: 0x121417, bill: 0xe8c23a },
  // Chocolate brown flecked white, black wings, the white undertail.
  nutcracker: {
    back: 0x4a3a30,
    belly: 0x6a5648,
    tip: 0x1c1a18,
    head: 0x3e302a,
    bill: 0x2a2826,
    tail: 0xe6e2da,
  },
  // Soft grey, a pale face and a dark nape.
  jay: { back: 0x6f7378, belly: 0xc9ccce, tip: 0x4a4d52, head: 0xe6e8ea, bill: 0x2a2826 },
  // The cock's brick red with the dark wings of a finch.
  crossbill: { back: 0xb8453a, belly: 0xc65d4c, tip: 0x3a302c, head: 0xb8453a, bill: 0x3a3530 },
  // White below and across the wing, black at the tips and on the back.
  bunting: { back: 0x3a3632, belly: 0xf4f4f2, tip: 0x121314, head: 0xeeeae2, bill: 0x2a2826 },
  // Black all over, the red cap, the pale bill.
  woodpecker: { back: 0x131416, belly: 0x17181a, tip: 0x0e0f10, head: 0xc0282a, bill: 0xcfc6a8 },
  // Grey, barred, the great pale disc of a face and the yellow eyes.
  owl: { back: 0x8a8680, belly: 0xb4b0a8, tip: 0x5e5a54, head: 0xa8a49c, bill: 0xd8c24a },
  // Dark brown, darker below, the gold nape that names it.
  eagle: {
    back: 0x4b3627,
    belly: 0x3e2e22,
    tip: 0x241c16,
    head: 0xa8854a,
    bill: 0x3a3a38,
    tail: 0x3a2d22,
  },
  // The one bird lighter than the sky, with the yellow on its bill.
  swan: { back: 0xf1f3f2, belly: 0xf1f3f2, tip: 0xe4e7e6, head: 0xf1f3f2, bill: 0xe8c93a },
  // Grey-brown, paler beneath, the orange band on a dark bill.
  goose: { back: 0x5e564a, belly: 0x9d9486, tip: 0x3a3530, head: 0x4a4238, bill: 0xe0912f },
};

/** How far back the ARM sweeps at the shoulder and the HAND at the wrist
 * when a wing is fully folded, rad. */
const ARM_FOLD = 1.2;
const HAND_FOLD = 0.95;

/** The gap between a wing's two faces, m — enough that they never fight for
 * the same pixels. */
const WING_SKIN = 0.006;

/** Where along the half-span the wing's vertex columns stand, as shares;
 * the wrist is added between them, so the fold has a column to hinge on. */
const STATIONS = [0.03, 0.3, 0.62, 0.84, 1];

/** Where the wingtip's colour begins, as a share of the half-span. */
const TIP_FROM = 0.78;

/** The wing's plan: the leading and trailing edge z at a share `s` of the
 * half-span, off the row's chord, taper and sweep. */
function wingEdges(spec: BirdSpec, s: number): { lead: number; trail: number } {
  const half = spec.span / 2;
  const c0 = spec.span * spec.wing.chord;
  const chord = c0 * (1 - (1 - spec.wing.taper) * s);
  const lead = c0 * 0.45 - spec.wing.sweep * half * Math.pow(s, 1.5);
  return { lead, trail: lead - chord };
}

/** One wing's two faces, right side (x > 0); the caller mirrors it. */
function wing(b: Builder, spec: BirdSpec, style: BirdStyle): void {
  const half = spec.span / 2;
  const stations = [...STATIONS, spec.wing.wrist].sort((a, c) => a - c);
  const at = (s: number, y: number): [P, P] => {
    const e = wingEdges(spec, s);
    return [
      [s * half, y, e.lead],
      [s * half, y, e.trail],
    ];
  };
  for (let i = 0; i + 1 < stations.length; i++) {
    const s0 = stations[i];
    const s1 = stations[i + 1];
    const dark = s1 > TIP_FROM + 1e-6;
    const top = dark ? style.tip : style.back;
    const under = dark ? style.tip : style.belly;
    const [l0, t0] = at(s0, WING_SKIN / 2);
    const [l1, t1] = at(s1, WING_SKIN / 2);
    if (s1 >= 1) b.tri(l0, l1, t0, top);
    else b.quad(l0, l1, t1, t0, top);
    const [bl0, bt0] = at(s0, -WING_SKIN / 2);
    const [bl1, bt1] = at(s1, -WING_SKIN / 2);
    if (s1 >= 1) b.tri(bl0, bt0, bl1, under);
    else b.quad(bl0, bt0, bt1, bl1, under);
  }
}

/** The body: a spindle about the shoulders, the neck and head out front,
 * the bill, and the tail fan behind. */
function body(b: Builder, spec: BirdSpec, style: BirdStyle): void {
  const L = spec.length;
  const neck = spec.neck * L;
  const back = (1 - spec.neck) * L;
  const r = L * 0.12;
  const zs = [-back * 0.62, -back * 0.3, 0.05 * L, 0.24 * L];
  const rs = [0.35, 0.85, 1, 0.72];
  const SIDES = 6;
  const rings: P[][] = zs.map((z, k) =>
    Array.from({ length: SIDES }, (_, s) => {
      const a = (s / SIDES) * Math.PI * 2;
      return [Math.cos(a) * r * rs[k], Math.sin(a) * r * rs[k] * 0.95, z] as P;
    }),
  );
  for (let k = 0; k + 1 < rings.length; k++) {
    for (let s = 0; s < SIDES; s++) {
      const s1 = (s + 1) % SIDES;
      const up = Math.sin(((s + 0.5) / SIDES) * Math.PI * 2);
      b.quad(
        rings[k][s],
        rings[k][s1],
        rings[k + 1][s1],
        rings[k + 1][s],
        up > 0 ? style.back : style.belly,
      );
    }
  }
  b.cap(rings[0], style.tail ?? style.back, true);
  b.cap(rings[rings.length - 1], style.back, false);
  const headZ = neck - L * 0.07;
  const headR = r * 0.6;
  b.tube([0, r * 0.25, 0.2 * L], [0, r * 0.45, headZ - headR * 0.6], r * 0.42, style.head, 5);
  const head: P[][] = [];
  for (const [dz, rr] of [
    [-headR, 0.4],
    [-headR * 0.3, 1],
    [headR * 0.5, 0.8],
  ] as const) {
    head.push(
      Array.from({ length: 5 }, (_, s) => {
        const a = (s / 5) * Math.PI * 2;
        return [Math.cos(a) * headR * rr, r * 0.45 + Math.sin(a) * headR * rr, headZ + dz] as P;
      }),
    );
  }
  b.loft(head, Array<number>(5).fill(style.head), true);
  b.cap(head[head.length - 1], style.head, false);
  b.cap(head[0], style.head, true);
  b.tube([0, r * 0.4, headZ + headR * 0.4], [0, r * 0.3, neck], headR * 0.38, style.bill, 4);
  const root = -back * 0.62;
  const tail = style.tail ?? style.back;
  const tw = spec.span * 0.07;
  b.quad(
    [-r * 0.3, 0.003, root],
    [r * 0.3, 0.003, root],
    [tw, 0.003, -back],
    [-tw, 0.003, -back],
    tail,
  );
  b.quad(
    [-r * 0.3, -0.003, root],
    [-tw, -0.003, -back],
    [tw, -0.003, -back],
    [r * 0.3, -0.003, root],
    style.tail ?? style.belly,
  );
}

/**
 * One bird of a species, in metres, shoulders at the origin, bill toward
 * +z: the body, and both wings LEVEL — the shader flaps and folds them per
 * instance. Carries `aWing` (1 on a wing vertex) for the graft to read.
 */
export function buildBird(spec: BirdSpec, style: BirdStyle): THREE.BufferGeometry {
  const bodyB = new Builder();
  body(bodyB, spec, style);
  const wingB = new Builder();
  wing(wingB, spec, style);
  const main = bodyB.arrays();
  const w = wingB.arrays();
  const nBody = main.position.length / 3;
  const nWing = w.position.length / 3;
  const n = nBody + nWing * 2;
  const positions = new Float32Array(n * 3);
  const colours = new Float32Array(n * 3);
  const wingFlag = new Float32Array(n);
  positions.set(main.position);
  colours.set(main.color);
  positions.set(w.position, nBody * 3);
  colours.set(w.color, nBody * 3);
  wingFlag.fill(1, nBody);
  // The left wing: the right one mirrored in x, and rewound so each face
  // still points the way it did.
  const left = nBody + nWing;
  for (let i = 0; i < nWing; i += 3) {
    for (let k = 0; k < 3; k++) {
      const from = i + (2 - k);
      const to = left + i + k;
      positions[to * 3] = -w.position[from * 3];
      positions[to * 3 + 1] = w.position[from * 3 + 1];
      positions[to * 3 + 2] = w.position[from * 3 + 2];
      colours[to * 3] = w.color[from * 3];
      colours[to * 3 + 1] = w.color[from * 3 + 1];
      colours[to * 3 + 2] = w.color[from * 3 + 2];
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(colours, 3));
  out.setAttribute("aWing", new THREE.Float32BufferAttribute(wingFlag, 1));
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

/**
 * The species' material: Lambert, flat, vertex-coloured, in the haze, with
 * the wing hinges grafted into its vertex shader. The species' own wrist is
 * a UNIFORM, so every species' material grafts the same source and three
 * links ONE program for the whole roster rather than one per species.
 * A modelled bird (`bird-models.ts`) takes the same material, lit smooth.
 */
export function birdMaterial(
  spec: BirdSpec,
  haze: HazeUniforms,
  flat = true,
): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    // The code's bird is a pile of facets; a modelled one carries its
    // own normals and is lit smooth.
    flatShading: flat,
    // The tail and the wings are sheets, and a folded wing turns its faces
    // every way; a face that is never culled is a face that is never a hole.
    side: THREE.DoubleSide,
  });
  const num = (v: number): string => v.toFixed(4);
  const wrist = (spec.span / 2) * spec.wing.wrist;
  return hazeMaterial(material, haze, "bird", (shader) => {
    shader.uniforms.uWrist = { value: wrist };
    shader.vertexShader = `uniform float uWrist;
attribute float aWing;
attribute float aFlap;
attribute float aFold;
${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
\tif (aWing > 0.5) {
\t\tfloat side = position.x < 0.0 ? -1.0 : 1.0;
\t\tfloat x = abs(position.x);
\t\tfloat y = position.y;
\t\tfloat z = position.z;
\t\tfloat hand = x - uWrist;
\t\tif (hand > 0.0) {
\t\t\tfloat a = aFold * ${num(HAND_FOLD)};
\t\t\tfloat c = cos(a);
\t\t\tfloat s = sin(a);
\t\t\tx = uWrist + hand * c + z * s;
\t\t\tz = -hand * s + z * c;
\t\t}
\t\tfloat b = aFold * ${num(ARM_FOLD)};
\t\tfloat cb = cos(b);
\t\tfloat sb = sin(b);
\t\tfloat ax = x * cb + z * sb;
\t\tfloat az = -x * sb + z * cb;
\t\tfloat cf = cos(aFlap);
\t\tfloat sf = sin(aFlap);
\t\ttransformed = vec3(side * (ax * cf - y * sf), ax * sf + y * cf, az);
\t}`,
    );
  });
}
