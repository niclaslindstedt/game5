// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SUMMER'S PEOPLE, BUILT — the civilians' figure (`civilian-shapes.ts`)
// dressed for July: the same body, joints and poses, so every move of
// `CIVILIAN_POSES` is a morph target as the winter's is, but cut slimmer
// (no puffed shell, no long coat, no one-piece) and in summer clothes:
//   * SHOES or light hiking boots, ankle-high, low and brown, in place of a
//     ski boot's tall shell;
//   * a SHIRT whose sleeve ends half way down the upper arm, the rest of the
//     arm in its own slot (`SUMMER_SLOT.forearm`) — bare skin for a
//     t-shirt, the shirt's colour for a long sleeve or a rider's jersey —
//     and bare hands;
//   * SHORTS or walking trousers: the thigh in the bottoms' colour to just
//     over the knee, the rest of the leg in a slot of its own
//     (`SUMMER_SLOT.shin`) — bare, the trousers' colour, a rider's pads;
//   * on his head a brimmed SUN HAT, a CAP, his own hair or a rider's
//     FULL-FACE HELMET with its chin bar and peak, and SUNGLASSES;
//   * a DAY PACK on his back and a pair of WALKING POLES in his hands.
// Everything he might wear or hold is in the one mesh and folded away per
// instance (`aPart` / `aKit`), as in winter. Three-dependent; built once a
// body and cut.

import * as THREE from "three";

import { PART, SUMMER_SLOT as SLOT } from "./civilian-dress.ts";
import type { Holding } from "./civilian-moves.ts";
import { box, emitCross, emitProps } from "./civilian-shapes.ts";
import { cross, type CrowdLook, type Posed, type V3 } from "./crowd-rig.ts";
import {
  FULL,
  Figure,
  SHADE,
  bodyFrames,
  cutOf,
  emitTrunk,
  frameOf,
  ring,
  type CrowdLod,
  type Frame,
} from "./crowd-shapes.ts";
import type { Shape } from "./tree-mesh.ts";

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const mix = (a: V3, b: V3, t: number): V3 => add(mul(a, 1 - t), mul(b, t));

/** The summer kit's own colours, painted into the mesh. */
const PAINT = {
  shoe: new THREE.Color(0x5e4632),
  sole: new THREE.Color(0x2b2622),
  lace: new THREE.Color(0x8a6a48),
  shades: new THREE.Color(0x121417),
  pole: new THREE.Color(0x8f979f),
  grip: new THREE.Color(0x1b1d21),
  visor: new THREE.Color(0x2a2e34),
  lens: new THREE.Color(0xd08a2c),
} as const;

/** How far down the upper arm a shirt's sleeve reaches, and down the thigh
 * the bottoms' own colour reaches (a pair of shorts' hem, just over the
 * knee), as shares of the bone. */
const SLEEVE = 0.5;
const HEM = 0.85;

/** A body in summer clothes: no puffed shell over it, no long coat, no
 * one-piece. */
function summerLook(look: CrowdLook): CrowdLook {
  return { ...look, girth: look.girth * 0.9, shoulder: look.shoulder * 0.96, coat: 0, suit: false };
}

/** THE SHOES: an ankle-high boot or a shoe, its sole a third of a metre
 * at most and its toe low — set flat on the floor as the winter's boot is. */
function emitShoes(fig: Figure, P: Posed, look: CrowdLook, lod: CrowdLod, hips: Frame): void {
  const k = look.height / 1.8;
  fig.slot(SLOT.own);
  for (const [ankle, sk] of [
    [P.ankleL, P.skiL],
    [P.ankleR, P.skiR],
  ] as const) {
    let f = norm(sub(sk.tip, sk.tail));
    let r = norm(sub(sk.side, sk.mid));
    let n = norm(cross(f, r));
    let sole = add(sk.mid, mul(n, 0.008 * k));
    const knee = ankle === P.ankleL ? P.kneeL : P.kneeR;
    const shinUp = norm(sub(knee, ankle));
    const down = Math.max(0, Math.min(1, (0.4 * k - ankle[1]) / (0.1 * k)));
    const flat = down * Math.max(0, Math.min(1, (shinUp[1] - 0.55) / 0.2));
    if (flat > 0) {
      const level = norm([f[0], 0, f[2]]);
      f = norm(mix(f, level, flat));
      n = norm(mix(n, [0, 1, 0], flat));
      r = norm(cross(n, f));
      const below: V3 = [ankle[0] + level[0] * 0.03 * k, 0.008 * k, ankle[2] + level[2] * 0.03 * k];
      sole = mix(sole, below, flat);
    }
    const at = (along: number, upBy: number): V3 =>
      add(add(sole, mul(f, along * k)), mul(n, upBy * k));
    if (lod === "far") {
      fig.limb(ankle, at(0.08, 0.03), hips.r, 0.045 * k, 0.05 * k, 3, PAINT.shoe);
      continue;
    }
    // The sole, the upper over the foot, the toe, the collar round the ankle.
    box(fig, at(-0.09, 0.012), at(0.19, 0.012), r, n, 0.1 * k, 0.024 * k, PAINT.sole);
    box(fig, at(-0.08, 0.055), at(0.08, 0.055), r, n, 0.092 * k, 0.07 * k, PAINT.shoe);
    box(fig, at(0.07, 0.04), at(0.18, 0.04), r, n, 0.088 * k, 0.045 * k, PAINT.shoe);
    box(fig, at(0.03, 0.085), at(0.11, 0.07), r, n, 0.04 * k, 0.012 * k, PAINT.lace);
    fig.limb(
      at(-0.02, 0.07),
      add(ankle, mul(shinUp, 0.035 * k)),
      r,
      0.05 * k,
      0.047 * k,
      4,
      PAINT.shoe,
    );
  }
}

/** THE LEGS: the bottoms' colour to the hem, the lower leg in its own slot
 * (bare, trousered or padded). */
function emitLegs(fig: Figure, P: Posed, look: CrowdLook, lod: CrowdLod, hips: Frame): void {
  const sides = cutOf(lod).limb;
  const k = look.height / 1.8;
  for (const [hip, knee, ankle] of [
    [P.hipL, P.kneeL, P.ankleL],
    [P.hipR, P.kneeR, P.ankleR],
  ] as const) {
    const hem = mix(hip, knee, HEM);
    fig.slot(SLOT.pants);
    fig.limb(hip, hem, hips.r, 0.078 * k, 0.066 * k, sides, FULL);
    fig.slot(SLOT.shin);
    fig.limb(hem, knee, hips.r, 0.056 * k, 0.052 * k, sides, FULL);
    fig.limb(knee, ankle, hips.r, 0.05 * k, 0.04 * k, sides, SHADE);
  }
}

/** THE ARMS: the sleeve to half way down the upper arm, the rest in the
 * forearm's slot, the hands bare. */
function emitArms(fig: Figure, P: Posed, look: CrowdLook, lod: CrowdLod, chest: Frame): void {
  const sides = cutOf(lod).limb - 1;
  const k = look.height / 1.8;
  for (const [shoulder, elbow, hand] of [
    [P.shoulderL, P.elbowL, P.handL],
    [P.shoulderR, P.elbowR, P.handR],
  ] as const) {
    if (lod === "far") {
      fig.slot(SLOT.jacket);
      fig.limb(shoulder, hand, chest.r, 0.048 * k, 0.036 * k, 3, FULL);
      continue;
    }
    const cuff = mix(shoulder, elbow, SLEEVE);
    fig.slot(SLOT.jacket);
    fig.limb(shoulder, cuff, chest.r, 0.054 * k, 0.05 * k, sides, FULL);
    fig.slot(SLOT.forearm);
    fig.limb(cuff, elbow, chest.r, 0.04 * k, 0.037 * k, sides, FULL);
    fig.limb(elbow, hand, chest.r, 0.036 * k, 0.03 * k, sides, SHADE);
    fig.slot(SLOT.skin);
    const into = norm(sub(hand, elbow));
    fig.limb(
      sub(hand, mul(into, 0.015)),
      add(hand, mul(into, 0.05)),
      chest.r,
      0.033 * k,
      0.03 * k,
      3,
      FULL,
      true,
    );
  }
}

/** THE HEAD: the face and a body's long hair, then the heads an instance
 * picks from — a sun hat, a cap, his own hair, a rider's full-face helmet —
 * and the sunglasses. */
function emitHead(fig: Figure, P: Posed, look: CrowdLook, lod: CrowdLod, chest: Frame): void {
  const cut = cutOf(lod);
  const r = look.head;
  const H = look.height;
  const head = frameOf(chest.r, sub(P.head, P.neck));
  const at = (u: number, f = 0, x = 0): V3 =>
    add(add(add(P.head, mul(head.u, u * r)), mul(head.f, f * r)), mul(head.r, x * r));
  const HS = cut.head;
  fig.part(PART.body);
  fig.slot(SLOT.skin);
  fig.limb(add(P.neck, mul(chest.u, 0.01 * H)), at(-0.7), chest.r, r * 0.42, r * 0.42, 4, FULL);
  fig.loft(
    [
      ring(at(-0.95), head, r * 0.55, r * 0.6, HS),
      ring(at(-0.2), head, r * 0.92, r, HS),
      ring(at(0.35), head, r * 0.95, r, HS),
      ring(at(0.8, -0.05), head, r * 0.6, r * 0.66, HS),
    ],
    [at(-0.95), at(-0.2), at(0.35), at(0.8, -0.05)],
    () => [SLOT.skin, FULL],
    at(1.0, -0.08),
  );
  if (look.hair && cut.small) {
    fig.slot(SLOT.hair);
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
  // HIS OWN HAIR, a cap of it over the skull and down the back.
  const hair = (): void => {
    fig.loft(
      [
        ring(at(-0.3, -0.25), head, r * 0.98, r * 1.0, HS),
        ring(at(0.4, -0.12), head, r * 1.02, r * 1.06, HS),
        ring(at(0.88, -0.1), head, r * 0.66, r * 0.72, HS),
      ],
      [at(-0.3, -0.25), at(0.4, -0.12), at(0.88, -0.1)],
      () => [SLOT.hair, FULL],
      at(1.06, -0.12),
    );
  };
  fig.part(PART.hair);
  hair();
  // THE SUN HAT: a crown over the hair and a brim all round, drooping.
  fig.part(PART.sunhat);
  fig.loft(
    [
      ring(at(0.3, -0.05), head, r * 1.08, r * 1.12, HS),
      ring(at(0.85, -0.06), head, r * 0.98, r * 1.02, HS),
      ring(at(1.2, -0.06), head, r * 0.7, r * 0.74, HS),
    ],
    [at(0.3, -0.05), at(0.85, -0.06), at(1.2, -0.06)],
    (band) => [SLOT.head, band === 0 ? SHADE : FULL],
    at(1.32, -0.06),
  );
  {
    const inner = ring(at(0.32, -0.05), head, r * 1.08, r * 1.12, HS * 2);
    const outer = ring(at(0.12, -0.05), head, r * 1.95, r * 2.0, HS * 2);
    fig.slot(SLOT.head);
    for (let i = 0; i < inner.length; i++) {
      const j = (i + 1) % inner.length;
      fig.s.quad(inner[i], inner[j], outer[j], outer[i], SHADE, head.u);
    }
  }
  // THE CAP: a close crown and a peak out over the eyes.
  fig.part(PART.cap);
  fig.loft(
    [
      ring(at(0.3, -0.05), head, r * 1.05, r * 1.09, HS),
      ring(at(0.75, -0.08), head, r * 0.86, r * 0.9, HS),
    ],
    [at(0.3, -0.05), at(0.75, -0.08)],
    () => [SLOT.head, FULL],
    at(1.08, -0.1),
  );
  fig.slot(SLOT.head);
  box(fig, at(0.36, 0.85), at(0.3, 1.8), head.r, head.u, r * 1.3, r * 0.06, SHADE);
  // THE FULL-FACE HELMET: a shell over the whole head, a chin bar before
  // the mouth, a peak, goggles at the eyes.
  fig.part(PART.fullface);
  fig.loft(
    [
      ring(at(-1.05, -0.05), head, r * 1.12, r * 1.25, HS),
      ring(at(-0.2, -0.08), head, r * 1.26, r * 1.36, HS),
      ring(at(0.55, -0.1), head, r * 1.18, r * 1.28, HS),
      ring(at(1.08, -0.12), head, r * 0.72, r * 0.8, HS),
    ],
    [at(-1.05, -0.05), at(-0.2, -0.08), at(0.55, -0.1), at(1.08, -0.12)],
    (band) => [SLOT.head, band % 2 ? SHADE : FULL],
    at(1.3, -0.14),
  );
  fig.slot(SLOT.head);
  box(fig, at(-0.75, 1.15), at(-0.75, 1.32), head.r, head.u, r * 1.4, r * 0.5, FULL);
  box(fig, at(0.85, 1.0), at(0.95, 1.75), head.r, head.u, r * 1.5, r * 0.08, SHADE);
  if (cut.small) {
    fig.slot(SLOT.own);
    box(fig, at(0.22, 1.18), at(0.22, 1.3), head.r, head.u, r * 1.5, r * 0.4, PAINT.lens);
  }
  // SUNGLASSES over the eyes.
  if (cut.small) {
    fig.part(PART.glasses);
    fig.slot(SLOT.own);
    box(fig, at(0.2, 0.9), at(0.2, 0.98), head.r, head.u, r * 1.25, r * 0.26, PAINT.shades);
  }
  fig.part(PART.body);
}

/** THE DAY PACK on his back, in the accent's colour. */
function emitPack(fig: Figure, P: Posed, look: CrowdLook, chest: Frame): void {
  const k = look.height / 1.8;
  fig.part(PART.pack);
  fig.slot(SLOT.accent);
  const back = sub(mix(P.waist, P.neck, 0.48), mul(chest.f, look.girth + 0.065 * k));
  box(
    fig,
    sub(back, mul(chest.u, 0.2 * k)),
    add(back, mul(chest.u, 0.19 * k)),
    chest.r,
    chest.f,
    0.29 * k,
    0.13 * k,
    FULL,
  );
  fig.part(PART.body);
}

/** THE WALKING POLES, one from each hand down to the ground beside it. */
function emitPoles(fig: Figure, P: Posed, look: CrowdLook, chest: Frame): void {
  const k = look.height / 1.8;
  fig.part(PART.poles);
  fig.slot(SLOT.own);
  for (const [hand, side] of [
    [P.handL, -1],
    [P.handR, 1],
  ] as const) {
    const shaft = norm(add(add([0, -1, 0], mul(chest.f, 0.1)), mul(chest.r, side * 0.07)));
    const down = Math.max(0.3, hand[1] / Math.max(0.3, -shaft[1]));
    const foot = add(hand, mul(shaft, down));
    fig.limb(sub(hand, mul(shaft, 0.06 * k)), foot, chest.r, 0.011, 0.008, 3, PAINT.pole);
    fig.limb(
      sub(hand, mul(shaft, 0.07 * k)),
      add(hand, mul(shaft, 0.06 * k)),
      chest.r,
      0.018,
      0.018,
      3,
      PAINT.grip,
    );
  }
  fig.part(PART.body);
}

/** ONE POSE OF A SUMMER CIVILIAN: the same calls in the same order for
 * every pose. */
export function emitSummer(
  fig: Figure,
  P: Posed,
  winterLook: CrowdLook,
  lod: CrowdLod,
  holding: Holding,
): void {
  const look = summerLook(winterLook);
  const { hips, chest } = bodyFrames(P);
  fig.part(PART.body);
  emitShoes(fig, P, look, lod, hips);
  emitLegs(fig, P, look, lod, hips);
  emitTrunk(fig, P, look, lod, hips, chest, SLOT.jacket);
  emitArms(fig, P, look, lod, chest);
  emitHead(fig, P, look, lod, chest);
  if (lod !== "far") {
    emitCross(fig, P, look, chest);
    emitPack(fig, P, look, chest);
  }
  emitProps(fig, P, look, lod, chest, holding, true);
  if (cutOf(lod).small) emitPoles(fig, P, look, chest);
}

/** A PICNIC BLANKET on the grass, checked in `check` and white, in the
 * blanket's frame (x right, z the way it faces). */
export function summerBlanket(s: Shape, o: V3, heading: number, check: THREE.Color): void {
  const c = Math.cos(heading);
  const sn = Math.sin(heading);
  const at = (x: number, z: number): V3 => [
    o[0] + x * c + z * sn,
    o[1] + 0.02,
    o[2] - x * sn + z * c,
  ];
  const white = new THREE.Color(0xf1ede2);
  const W = 0.9;
  const D = 0.75;
  const nx = 4;
  const nz = 3;
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const x0 = -W + (2 * W * i) / nx;
      const x1 = -W + (2 * W * (i + 1)) / nx;
      const z0 = -D + (2 * D * j) / nz;
      const z1 = -D + (2 * D * (j + 1)) / nz;
      s.quad(
        at(x0, z0),
        at(x1, z0),
        at(x1, z1),
        at(x0, z1),
        (i + j) % 2 ? white : check,
        [0, 1, 0],
      );
    }
  }
}
