// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ANIMALS, BUILT — one flat-shaded, vertex-coloured quadruped a species,
// sized off the roster's row (`beast-defs.ts`) and shaped and painted off
// `BEAST_STYLES` here, and the material that walks it.
//
// SEEN ACROSS THE SNOW at chase range is the design constraint: what reads
// is the SILHOUETTE against white — the hare's long ears and its tucked
// shape, the fox's brush, the reindeer's antlers and pale neck, the moose's
// hump and long face over its pale legs, the lynx's tufts and stub tail,
// the squirrel's tail curled up over its back, the roe's white rump, the
// wolf's long legs and straight-carried tail, the musk ox's skirt of hair
// and the horns hooked down its face, the chamois's little hooked horns —
// and the colour, which on a winter hill is mostly dark against light (and,
// on the one white animal, the black tips of its ears).
//
// THE LEGS MOVE IN THE VERTEX SHADER, the birds' wings' trick: each leg's
// vertices carry which leg they are (`aLeg`, its phase in the gait) and
// where its hip is (`aHip`), and the neck and head carry `aHead`; per
// instance the shader is told the GAIT (where in its cycle the animal is),
// the STRIDE (how hard it is going) and the GRAZE (how far the head is
// down), all read off `beastPose`. One draw call a species, whatever the
// herd is doing.

import * as THREE from "three";

import { Builder, type P } from "../lib/lowpoly.ts";
import type { BeastId, BeastSpec, Gait } from "./beast-defs.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";

/** How a species is shaped past its length and height, and painted. */
export type BeastStyle = {
  readonly coat: number;
  readonly belly: number;
  readonly legs: number;
  readonly head: number;
  /** The ears' colour (or their tips'), the tail's, and anything on the
   * head that is not the head — antlers. */
  readonly ears: number;
  readonly tail: number;
  readonly antlers?: number;
  /** HORNS and their colour: a musk ox's BOSS (hooked down the face and up
   * at the tips) or a chamois's HOOKS (straight up, crooked back). */
  readonly horns?: { readonly color: number; readonly form: "boss" | "hooks" };
  /** The tail's thickness as a share of the body's half-depth (a squirrel's
   * and a fox's brush are thick), and the colour of its last fifth — the
   * fox's white tip, the wolf's black one. */
  readonly tailThick?: number;
  readonly tailTip?: number;
  /** The body's width as a share of the height, how thick a leg is as a
   * share of the height, how long the neck is as a share of the length and
   * how high it carries the head (0 level, 1 straight up), the head's own
   * length as a share of the length, the ears' length as a share of the
   * height, and the tail's length as a share of the length and its droop
   * (0 straight out behind, 1 straight down). */
  readonly width: number;
  readonly leg: number;
  readonly neck: number;
  readonly carriage: number;
  readonly headLength: number;
  readonly ear: number;
  readonly tailLength: number;
  readonly droop: number;
  /** How far down the body hangs between the legs, as a share of the
   * height: a hare is nearly all body, a moose is legs. */
  readonly depth: number;
  /** A shoulder hump, as a share of the height — the moose's. */
  readonly hump?: number;
};

export const BEAST_STYLES: Readonly<Record<BeastId, BeastStyle>> = {
  // White, with the black ear tips a winter hare keeps.
  hare: {
    coat: 0xeef1f2,
    belly: 0xf6f7f8,
    legs: 0xe8ebec,
    head: 0xeef1f2,
    ears: 0x1a1a1c,
    tail: 0xf8f9f9,
    width: 0.62,
    leg: 0.17,
    neck: 0.12,
    carriage: 0.55,
    headLength: 0.24,
    ear: 0.62,
    tailLength: 0.08,
    droop: 0.2,
    depth: 0.7,
  },
  // Rust on the snow, white bib, black stockings, the white-tipped brush.
  fox: {
    coat: 0xc2622a,
    belly: 0xf0ebe0,
    legs: 0x2a1e18,
    head: 0xc86a30,
    ears: 0x2a1e18,
    tail: 0xb85a26,
    width: 0.42,
    leg: 0.12,
    neck: 0.16,
    carriage: 0.35,
    headLength: 0.3,
    ear: 0.25,
    tailLength: 0.62,
    droop: 0.25,
    depth: 0.52,
    tailThick: 0.26,
    tailTip: 0xf4f2ee,
  },
  // Grey-brown with the pale neck and the antlers the cows keep all winter.
  reindeer: {
    coat: 0x6e5f50,
    belly: 0xcfc8b8,
    legs: 0x54483c,
    head: 0x5a4c40,
    ears: 0x5a4c40,
    tail: 0xe0dace,
    antlers: 0x9c8a6e,
    width: 0.45,
    leg: 0.1,
    neck: 0.3,
    carriage: 0.55,
    headLength: 0.26,
    ear: 0.12,
    tailLength: 0.08,
    droop: 0.7,
    depth: 0.46,
  },
  // Near-black, the hump, the long heavy face, the pale grey stockings.
  moose: {
    coat: 0x2b211b,
    belly: 0x241c17,
    legs: 0xa09584,
    head: 0x33271f,
    ears: 0x2b211b,
    tail: 0x2b211b,
    width: 0.3,
    leg: 0.09,
    neck: 0.22,
    carriage: 0.45,
    headLength: 0.3,
    ear: 0.12,
    tailLength: 0.04,
    droop: 0.8,
    depth: 0.42,
    hump: 0.12,
  },
  // Grey-buff, pale beneath, black ear tufts and a black-tipped stub.
  lynx: {
    coat: 0xa89478,
    belly: 0xe6ddcc,
    legs: 0x9c8a70,
    head: 0xb09c80,
    ears: 0x1a1818,
    tail: 0x1e1a18,
    width: 0.4,
    leg: 0.15,
    neck: 0.14,
    carriage: 0.35,
    headLength: 0.22,
    ear: 0.2,
    tailLength: 0.16,
    droop: 0.55,
    depth: 0.5,
  },
  // Rust-red, a pale belly, ear tufts, and the tail curled up over its back.
  squirrel: {
    coat: 0x9a4a26,
    belly: 0xefe6d8,
    legs: 0x8a4222,
    head: 0x9a4a26,
    ears: 0x7a3a1e,
    tail: 0xa6532c,
    width: 0.6,
    leg: 0.2,
    neck: 0.1,
    carriage: 0.6,
    headLength: 0.28,
    ear: 0.45,
    tailLength: 0.7,
    droop: -0.75,
    depth: 0.72,
    tailThick: 0.42,
  },
  // White on white, the dark nose and eyes; a thicker, shorter fox.
  arcticfox: {
    coat: 0xf1f3f4,
    belly: 0xf8f9f9,
    legs: 0xe6e9ea,
    head: 0xf1f3f4,
    ears: 0xe2e6e8,
    tail: 0xeef0f1,
    width: 0.5,
    leg: 0.13,
    neck: 0.14,
    carriage: 0.35,
    headLength: 0.24,
    ear: 0.16,
    tailLength: 0.5,
    droop: 0.3,
    depth: 0.58,
    tailThick: 0.3,
  },
  // Grey-brown in winter, pale beneath, and the white rump patch.
  roedeer: {
    coat: 0x6c5a4a,
    belly: 0xb4a898,
    legs: 0x5e4e40,
    head: 0x6a584a,
    ears: 0x5a4a3c,
    tail: 0xf4f0ea,
    width: 0.4,
    leg: 0.09,
    neck: 0.32,
    carriage: 0.65,
    headLength: 0.22,
    ear: 0.18,
    tailLength: 0.06,
    droop: 0.6,
    depth: 0.42,
    tailThick: 0.8,
  },
  // Dark brown in its winter coat, the pale face, the black hooks.
  chamois: {
    coat: 0x3a2e26,
    belly: 0x2e241e,
    legs: 0x2a221c,
    head: 0xd8ccb8,
    ears: 0x3a2e26,
    tail: 0x2a221c,
    horns: { color: 0x141210, form: "hooks" },
    width: 0.42,
    leg: 0.1,
    neck: 0.28,
    carriage: 0.6,
    headLength: 0.2,
    ear: 0.14,
    tailLength: 0.06,
    droop: 0.8,
    depth: 0.5,
  },
  // Near-black and shaggy, the skirt of hair to the snow, the pale saddle
  // and the horns hooked down the face.
  // Dark brown, low and heavy, with the pale band down its flank.
  ibex: {
    coat: 0x3a2e26,
    belly: 0x2e241e,
    legs: 0x2a221c,
    head: 0xd8ccb8,
    ears: 0x3a2e26,
    tail: 0x2a221c,
    horns: { color: 0x141210, form: "hooks" },
    width: 0.42,
    leg: 0.1,
    neck: 0.28,
    carriage: 0.6,
    headLength: 0.2,
    ear: 0.14,
    tailLength: 0.06,
    droop: 0.8,
    depth: 0.5,
  },
  elk: {
    coat: 0x6e5f50,
    belly: 0xcfc8b8,
    legs: 0x54483c,
    head: 0x5a4c40,
    ears: 0x5a4c40,
    tail: 0xe0dace,
    antlers: 0x9c8a6e,
    width: 0.45,
    leg: 0.1,
    neck: 0.3,
    carriage: 0.55,
    headLength: 0.26,
    ear: 0.12,
    tailLength: 0.08,
    droop: 0.7,
    depth: 0.46,
  },
  coyote: {
    coat: 0xc2622a,
    belly: 0xf0ebe0,
    legs: 0x2a1e18,
    head: 0xc86a30,
    ears: 0x2a1e18,
    tail: 0xb85a26,
    width: 0.42,
    leg: 0.12,
    neck: 0.16,
    carriage: 0.35,
    headLength: 0.3,
    ear: 0.25,
    tailLength: 0.62,
    droop: 0.25,
    depth: 0.52,
    tailThick: 0.26,
    tailTip: 0xf4f2ee,
  },
  sika: {
    coat: 0x6c5a4a,
    belly: 0xb4a898,
    legs: 0x5e4e40,
    head: 0x6a584a,
    ears: 0x5a4a3c,
    tail: 0xf4f0ea,
    width: 0.4,
    leg: 0.09,
    neck: 0.32,
    carriage: 0.65,
    headLength: 0.22,
    ear: 0.18,
    tailLength: 0.06,
    droop: 0.6,
    depth: 0.42,
    tailThick: 0.8,
  },
  wolverine: {
    coat: 0x2e2218,
    belly: 0x8c6a44,
    legs: 0x221a14,
    head: 0x3a2c22,
    ears: 0x2e2218,
    tail: 0x2e2218,
    width: 0.62,
    leg: 0.17,
    neck: 0.12,
    carriage: 0.3,
    headLength: 0.2,
    ear: 0.1,
    tailLength: 0.22,
    droop: 0.4,
    depth: 0.6,
    tailThick: 0.35,
  },
  // Grizzled grey, pale beneath, long in the leg, the tail carried low and
  // black at the tip.
  wolf: {
    coat: 0x80786c,
    belly: 0xd8d0c2,
    legs: 0x9a9284,
    head: 0x8a8274,
    ears: 0x5a5248,
    tail: 0x7a7266,
    width: 0.38,
    leg: 0.1,
    neck: 0.2,
    carriage: 0.3,
    headLength: 0.26,
    ear: 0.14,
    tailLength: 0.4,
    droop: 0.55,
    depth: 0.45,
    tailThick: 0.25,
    tailTip: 0x1e1c1a,
  },
};

/** Each leg's place in the gait cycle, as a share of it — left fore, right
 * fore, left hind, right hind. A walk is the four-beat, a trot the
 * diagonal pairs, a bound the pairs of fore and hind. */
export const LEG_PHASE: Readonly<Record<Gait, readonly [number, number, number, number]>> = {
  walk: [0.25, 0.75, 0, 0.5],
  trot: [0, 0.5, 0.5, 0],
  bound: [0, 0.06, 0.5, 0.56],
};

/** How far a leg swings off plumb at a full stride, rad. */
export const LEG_SWING: Readonly<Record<Gait, number>> = { walk: 0.42, trot: 0.55, bound: 0.95 };

/** How far the head goes down at a full graze, rad. */
const GRAZE_ANGLE = 1.05;

type Tags = { leg: number[]; hip: number[]; head: number[] };

/** Tag every vertex emitted since `from` as one part. */
function tag(b: Builder, tags: Tags, from: number, leg: number, hip: number, head: number): void {
  for (let i = from; i < b.vertexCount; i++) {
    tags.leg[i] = leg;
    tags.hip[i] = hip;
    tags.head[i] = head;
  }
}

/**
 * One animal of a species, in metres, standing on y = 0 with its nose
 * toward +z, legs plumb and head up. Carries `aLeg` (0, or 1 + the leg's
 * phase share), `aHip` and `aHead` for the graft to read.
 */
export function buildBeast(
  spec: BeastSpec,
  style: BeastStyle,
): { geometry: THREE.BufferGeometry; pivot: { y: number; z: number } } {
  const b = new Builder();
  const tags: Tags = { leg: [], hip: [], head: [] };
  const L = spec.length;
  const H = spec.height;
  const depth = style.depth * H;
  const bodyY = H - depth / 2;
  const ry = depth / 2;
  const rx = (style.width * H) / 2;
  const hump = (style.hump ?? 0) * H;

  // ── The body: rings along z from the rump to the chest ────────────────
  const SIDES = 8;
  const stations: readonly [number, number, number][] = [
    // z share, radius share, rise (m)
    [-0.5, 0.45, 0],
    [-0.36, 0.95, 0],
    [0.05, 1, hump * 0.3],
    [0.3, 0.95, hump],
    [0.46, 0.55, hump * 0.5],
  ];
  const start = b.vertexCount;
  const rings: P[][] = stations.map(([zs, rs, rise]) =>
    Array.from({ length: SIDES }, (_, s) => {
      const a = (s / SIDES) * Math.PI * 2;
      return [Math.cos(a) * rx * rs, bodyY + rise + Math.sin(a) * ry * rs, zs * L] as P;
    }),
  );
  const paint = Array.from({ length: SIDES }, (_, s) =>
    Math.sin(((s + 0.5) / SIDES) * Math.PI * 2) > -0.3 ? style.coat : style.belly,
  );
  b.loft(rings, paint, true);
  b.cap(rings[0], style.coat, true);
  b.cap(rings[rings.length - 1], style.coat, false);
  tag(b, tags, start, 0, 0, 0);

  // ── The legs: plumb tubes, hip to snow ────────────────────────────────
  const phase = LEG_PHASE[spec.gait];
  const legR = style.leg * H * 0.5;
  const hipY = bodyY;
  const legs: readonly [number, number][] = [
    [-1, 0.36],
    [1, 0.36],
    [-1, -0.38],
    [1, -0.38],
  ];
  legs.forEach(([side, zs], k) => {
    const from = b.vertexCount;
    const x = side * rx * 0.55;
    const z = zs * L;
    // A hind leg is thicker at the top; a hare's is long and folded, which
    // at this size reads as a thick short one.
    const top = k >= 2 ? legR * 1.5 : legR * 1.15;
    b.tube([x, hipY, z], [x, 0.02, z], top, style.legs, 5, legR * 0.8);
    tag(b, tags, from, 1 + phase[k], hipY, 0);
  });

  // ── The neck and head, about the pivot at the withers ─────────────────
  const pivot = { y: bodyY + ry * 0.4 + hump * 0.5, z: L * 0.4 };
  const neckLen = style.neck * L;
  const lift = style.carriage;
  const headBase: P = [
    0,
    pivot.y + neckLen * lift,
    pivot.z + neckLen * Math.sqrt(Math.max(0, 1 - lift * lift)),
  ];
  const fromHead = b.vertexCount;
  b.tube(
    [0, pivot.y - ry * 0.3, pivot.z - L * 0.04],
    headBase,
    ry * 0.55,
    style.coat,
    6,
    ry * 0.42,
  );
  const hl = style.headLength * L;
  const hr = ry * 0.52;
  b.tube(headBase, [0, headBase[1] - hl * 0.3, headBase[2] + hl], hr, style.head, 6, hr * 0.55);
  // The ears, up and back off the crown.
  const earLen = style.ear * H;
  for (const side of [-1, 1]) {
    const root: P = [side * hr * 0.6, headBase[1] + hr * 0.6, headBase[2] + hl * 0.1];
    const tip: P = [side * hr * 1.1, root[1] + earLen, root[2] - earLen * 0.35];
    const mid: P = [(root[0] + tip[0]) / 2, (root[1] + tip[1]) / 2, (root[2] + tip[2]) / 2];
    b.tube(root, mid, hr * 0.3, style.head, 4, hr * 0.25);
    b.tube(mid, tip, hr * 0.25, style.ears, 4, hr * 0.06);
  }
  // Antlers: a beam up and back off each side of the crown, tines forward.
  if (style.antlers) {
    const a = style.antlers;
    const beam = H * 0.55;
    for (const side of [-1, 1]) {
      const root: P = [side * hr * 0.5, headBase[1] + hr * 0.8, headBase[2]];
      const bend: P = [side * beam * 0.45, root[1] + beam * 0.55, root[2] - beam * 0.25];
      const top: P = [side * beam * 0.35, root[1] + beam, root[2] + beam * 0.05];
      b.tube(root, bend, hr * 0.14, a, 4, hr * 0.12);
      b.tube(bend, top, hr * 0.12, a, 4, hr * 0.05);
      b.tube(
        bend,
        [side * beam * 0.55, bend[1] + beam * 0.2, bend[2] + beam * 0.3],
        hr * 0.08,
        a,
        3,
        hr * 0.03,
      );
      b.tube(
        root,
        [side * hr * 0.6, root[1] + beam * 0.2, root[2] + beam * 0.3],
        hr * 0.08,
        a,
        3,
        hr * 0.03,
      );
    }
  }
  // Horns: a musk ox's boss, down the side of the face and up at the tips;
  // a chamois's hooks, straight up and crooked back.
  if (style.horns) {
    const h = style.horns.color;
    for (const side of [-1, 1]) {
      const root: P = [side * hr * 0.35, headBase[1] + hr * 0.75, headBase[2] - hl * 0.02];
      if (style.horns.form === "boss") {
        const out: P = [side * hr * 1.35, root[1] - hr * 0.2, root[2] + hl * 0.05];
        const down: P = [side * hr * 1.45, root[1] - hr * 1.2, root[2] + hl * 0.2];
        const tip: P = [side * hr * 1.7, root[1] - hr * 0.9, root[2] + hl * 0.45];
        b.tube(root, out, hr * 0.32, h, 5, hr * 0.26);
        b.tube(out, down, hr * 0.26, h, 5, hr * 0.16);
        b.tube(down, tip, hr * 0.16, h, 4, hr * 0.04);
      } else {
        const up: P = [side * hr * 0.4, root[1] + hr * 1.3, root[2] + hl * 0.05];
        const tip: P = [side * hr * 0.42, up[1] + hr * 0.1, up[2] - hl * 0.3];
        b.tube(root, up, hr * 0.14, h, 4, hr * 0.1);
        b.tube(up, tip, hr * 0.1, h, 4, hr * 0.02);
      }
    }
  }
  tag(b, tags, fromHead, 0, 0, 1);

  // ── The tail ──────────────────────────────────────────────────────────
  const fromTail = b.vertexCount;
  const tl = style.tailLength * L;
  if (tl > 0.01) {
    const root: P = [0, bodyY + ry * 0.5, -L * 0.5];
    const d = style.droop;
    const tip: P = [0, root[1] - tl * d, root[2] - tl * Math.sqrt(Math.max(0, 1 - d * d))];
    const thick = style.tailThick ?? 0.22;
    b.tube(root, tip, ry * thick, style.tail, 5, ry * (style.tailThick ? thick * 0.8 : 0.12));
    // A brush ending in a colour of its own: the fox's white, the wolf's black.
    if (style.tailTip !== undefined) {
      const end: P = [
        0,
        tip[1] - tl * d * 0.25,
        tip[2] - tl * Math.sqrt(Math.max(0, 1 - d * d)) * 0.25,
      ];
      b.tube(tip, end, ry * thick * 0.8, style.tailTip, 5, ry * 0.05);
    }
  }
  tag(b, tags, fromTail, 0, 0, 0);

  const geometry = b.geometry();
  geometry.setAttribute("aLeg", new THREE.Float32BufferAttribute(tags.leg, 1));
  geometry.setAttribute("aHip", new THREE.Float32BufferAttribute(tags.hip, 1));
  geometry.setAttribute("aHead", new THREE.Float32BufferAttribute(tags.head, 1));
  geometry.computeBoundingSphere();
  return { geometry, pivot };
}

/**
 * The species' material: Lambert, flat, vertex-coloured, in the haze, with
 * the legs' swing and the head's graze grafted into its vertex shader. The
 * species' own numbers are UNIFORMS (`gaitGraft`), so the whole roster
 * shares one program.
 */
export function beastMaterial(
  spec: BeastSpec,
  pivot: { y: number; z: number },
  haze: HazeUniforms,
  flat = true,
): THREE.MeshLambertMaterial {
  // The code's animal is a pile of facets; a modelled one
  // (`beast-models.ts`) carries its own normals and is lit smooth.
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: flat });
  return hazeMaterial(material, haze, "beast", gaitGraft(spec, pivot));
}

/** The shadow's material: the same graft over three's depth pass, so the
 * shadow on the snow walks with the legs that cast it. */
export function beastDepthMaterial(
  spec: BeastSpec,
  pivot: { y: number; z: number },
): THREE.MeshDepthMaterial {
  const material = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  const graft = gaitGraft(spec, pivot);
  material.onBeforeCompile = (shader) => graft(shader);
  material.customProgramCacheKey = (): string => "beast-depth";
  return material;
}

/** The legs' swing and the head's graze, as a vertex-shader graft. The
 * species' numbers go in as uniforms rather than literals: the source is
 * then the same for every species, and three links it once. */
function gaitGraft(
  spec: BeastSpec,
  pivot: { y: number; z: number },
): (shader: { vertexShader: string; uniforms: Record<string, THREE.IUniform> }) => void {
  const gait = {
    uLegSwing: { value: LEG_SWING[spec.gait] },
    uLegLift: { value: spec.height * 0.12 },
    uLegReach: { value: spec.height },
    uHeadPivot: { value: new THREE.Vector2(pivot.y, pivot.z) },
  };
  return (shader) => {
    Object.assign(shader.uniforms, gait);
    shader.vertexShader = `uniform float uLegSwing;
uniform float uLegLift;
uniform float uLegReach;
uniform vec2 uHeadPivot;
attribute float aLeg;
attribute float aHip;
attribute float aHead;
attribute float aGait;
attribute float aStride;
attribute float aGraze;
${shader.vertexShader}`.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
\tif (aLeg > 0.5) {
\t\tfloat ph = aGait + (aLeg - 1.0) * 6.2831853;
\t\tfloat swing = sin(ph) * aStride * uLegSwing;
\t\tfloat dy = transformed.y - aHip;
\t\tfloat lift = max(0.0, cos(ph)) * aStride * uLegLift * clamp(-dy / uLegReach, 0.0, 1.0);
\t\ttransformed.y = aHip + dy * cos(swing) + lift;
\t\ttransformed.z += dy * sin(swing);
\t}
\tif (aHead > 0.5) {
\t\tfloat g = aGraze * ${GRAZE_ANGLE.toFixed(4)};
\t\tfloat hy = transformed.y - uHeadPivot.x;
\t\tfloat hz = transformed.z - uHeadPivot.y;
\t\ttransformed.y = uHeadPivot.x + hy * cos(g) - hz * sin(g);
\t\ttransformed.z = uHeadPivot.y + hy * sin(g) + hz * cos(g);
\t}`,
    );
  };
}
