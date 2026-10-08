// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CIVILIANS, BUILT — every person on foot about the ski area as one of
// the crowd's eight bodies (`CROWD_LOOKS`) OFF HIS SKIS: no skis and no
// poles, his boots on the snow, built by the crowd's own builder pieces
// (`crowd-shapes.ts`: the legs, the trunk, the arms, the bench they share)
// at its three cuts, carrying every move of `CIVILIAN_POSES` as a MORPH
// TARGET (`civilian-moves.ts`) so one draw call holds every one of that
// body at that cut doing whatever he is doing.
//
// EVERYTHING HE MIGHT WEAR OR HOLD IS IN THE ONE MESH and FOLDED AWAY per
// instance (`aPart` on a vertex, `aKit` on the instance — the spectators'
// trick, `spectator-shapes.ts`): a helmet with its goggles pushed up, a
// beanie, his own hair; skis on his left shoulder, a mug, a beer, a shovel,
// a broom; a snowball; the patrol's white cross. Every prop is built in
// every target where that target's hands and shoulders have it — the cup in
// his right fist, the shovel's shaft from the grip down through the left
// hand, the skis laid on his shoulder — so the blend that moves the arm
// moves what is in it. A folded part's vertices are put at his feet, where
// its triangles are nothing.
//
// Colours are the crowd's slots (`aSlot`, the instance's `aDress` and
// `aDress2` into `CIVILIAN_PALETTE`) with a VEST slot of its own over the
// jacket's middle, the lift crew's and the workers' high-visibility bib.

import * as THREE from "three";
import type { CrowdBody } from "@engine";

import { CIVILIAN_PALETTE, CIVILIAN_SLOT as SLOT, PART } from "./civilian-dress.ts";
import type { CivilianPlan } from "./civilian-plan.ts";
import { CIVILIAN_POSES, keyPosed, moveOf, type Holding } from "./civilian-moves.ts";
import { CROWD_LOOKS, cross, type CrowdLook, type Posed, type V3 } from "./crowd-rig.ts";
import {
  BOOT,
  FULL,
  Figure,
  LENS,
  SHADE,
  bodyFrames,
  cutOf,
  emitArms,
  emitLegs,
  emitTrunk,
  frameOf,
  ring,
  type CrowdLod,
  type Frame,
} from "./crowd-shapes.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { Shape } from "./tree-mesh.ts";

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const mix = (a: V3, b: V3, t: number): V3 => add(mul(a, 1 - t), mul(b, t));
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The props' own colours, painted into the mesh. */
const PAINT = {
  mug: new THREE.Color(0xe9e3d6),
  cocoa: new THREE.Color(0x5b331d),
  beer: new THREE.Color(0xd8951f),
  foam: new THREE.Color(0xf6f1e4),
  wood: new THREE.Color(0x9a7146),
  grip: new THREE.Color(0x1b1d21),
  blade: new THREE.Color(0xc23a22),
  bristle: new THREE.Color(0x7c5a32),
  snow: new THREE.Color(0xf4f7fb),
  binding: new THREE.Color(0x3a3d44),
} as const;

/** A box from `a` to `b`, `w` across along `side` and `h` thick along
 * `up` (each made square to the length), one colour, six faces. */
function box(fig: Figure, a: V3, b: V3, side: V3, up: V3, w: number, h: number, c: THREE.Color) {
  const f = norm(sub(b, a));
  let u = sub(up, mul(f, dot(up, f)));
  if (len(u) < 1e-5) u = sub(side, mul(f, dot(side, f)));
  u = norm(u);
  const r = norm(cross(f, u));
  const corner = (p: V3, i: number, j: number): V3 =>
    add(add(p, mul(r, (i * w) / 2)), mul(u, (j * h) / 2));
  const a00 = corner(a, -1, -1);
  const a10 = corner(a, 1, -1);
  const a11 = corner(a, 1, 1);
  const a01 = corner(a, -1, 1);
  const b00 = corner(b, -1, -1);
  const b10 = corner(b, 1, -1);
  const b11 = corner(b, 1, 1);
  const b01 = corner(b, -1, 1);
  fig.s.quad(a01, a11, b11, b01, c, u);
  fig.s.quad(a00, b00, b10, a10, c, mul(u, -1));
  fig.s.quad(a10, b10, b11, a11, c, r);
  fig.s.quad(a00, a01, b01, b00, c, mul(r, -1));
  fig.s.quad(b00, b01, b11, b10, c, f);
  fig.s.quad(a00, a10, a11, a01, c, mul(f, -1));
}

/** THE BOOTS on the snow: a shell up from the leg's cuff to the foot and
 * the foot's block from heel to toe, square to the shin as a boot holds it. */
function emitBoots(fig: Figure, P: Posed, look: CrowdLook, lod: CrowdLod, hips: Frame): void {
  const k = look.height / 1.8;
  fig.slot(SLOT.own);
  for (const [ankle, sk] of [
    [P.ankleL, P.skiL],
    [P.ankleR, P.skiR],
  ] as const) {
    let f = norm(sub(sk.tip, sk.tail));
    let r = norm(sub(sk.side, sk.mid));
    let n = norm(cross(f, r));
    let sole = add(sk.mid, mul(n, 0.012 * k));
    // A FOOT SET DOWN stands flat on the floor whatever its shin leans: the
    // sole laid level under the cuff, toe the way the boot points. (A leg
    // laid out on the snow keeps its boot square to the shin, heel down.)
    const knee = ankle === P.ankleL ? P.kneeL : P.kneeR;
    const shinUp = norm(sub(knee, ankle));
    const down = Math.max(0, Math.min(1, (0.4 * k - ankle[1]) / (0.1 * k)));
    const flat = down * Math.max(0, Math.min(1, (shinUp[1] - 0.55) / 0.2));
    if (flat > 0) {
      const level = norm([f[0], 0, f[2]]);
      f = norm(mix(f, level, flat));
      n = norm(mix(n, [0, 1, 0], flat));
      r = norm(cross(n, f));
      const below: V3 = [ankle[0] + level[0] * 0.03 * k, 0.012 * k, ankle[2] + level[2] * 0.03 * k];
      sole = mix(sole, below, flat);
    }
    // A SKI BOOT, not a shoe: a sole about a third of a metre long (a
    // mid-size shell's 300–330 mm), barely wider than the shin; a high
    // heel block under the instep and a low toe box; the shell's cuff
    // standing up the shin to the pants' hem, its top strap in a darker
    // band; the sole a darker strip proud of the shell.
    const heel = add(sole, mul(f, -0.11 * k));
    const toe = add(sole, mul(f, 0.205 * k));
    if (lod === "far") {
      fig.limb(
        ankle,
        add(mix(heel, toe, 0.55), mul(n, 0.04 * k)),
        hips.r,
        0.06 * k,
        0.066 * k,
        3,
        BOOT,
      );
      continue;
    }
    const at = (along: number, upBy: number): V3 =>
      add(add(sole, mul(f, along * k)), mul(n, upBy * k));
    // The sole: a thin dark strip from heel to toe.
    box(fig, at(-0.115, 0.011), at(0.21, 0.011), r, n, 0.098 * k, 0.022 * k, PAINT.grip);
    // The heel block, high, under the instep.
    box(fig, at(-0.105, 0.085), at(0.05, 0.085), r, n, 0.094 * k, 0.13 * k, BOOT);
    // The toe box, low, its nose rounded off by a step.
    box(fig, at(0.04, 0.055), at(0.17, 0.055), r, n, 0.09 * k, 0.07 * k, BOOT);
    box(fig, at(0.165, 0.045), at(0.2, 0.045), r, n, 0.078 * k, 0.05 * k, BOOT);
    // The cuff up the shin, wider than the pants' leg at the hem.
    const cuffTop = add(ankle, mul(shinUp, 0.1 * k));
    fig.limb(at(-0.03, 0.14), cuffTop, r, 0.064 * k, 0.066 * k, 4, BOOT);
    fig.limb(
      add(cuffTop, mul(shinUp, -0.035 * k)),
      cuffTop,
      r,
      0.068 * k,
      0.068 * k,
      4,
      PAINT.binding,
    );
  }
}

/** THE HEAD: the face, the hair a body wears out of anything, and the
 * three heads an instance picks from — the helmet (the goggles up on its
 * front), the beanie (a pompom on the ones who wear one), his own hair. */
function emitHead(fig: Figure, P: Posed, look: CrowdLook, lod: CrowdLod, chest: Frame): void {
  const cut = cutOf(lod);
  const r = look.head;
  const H = look.height;
  const head = frameOf(chest.r, sub(P.head, P.neck));
  const at = (u: number, f = 0): V3 => add(add(P.head, mul(head.u, u * r)), mul(head.f, f * r));
  const HS = cut.head;
  fig.part(PART.body);
  // The neck, then the face and the skull.
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
  // THE HELMET, its goggles pushed up on its front.
  fig.part(PART.helmet);
  fig.loft(
    [
      ring(at(0.02, -0.08), head, r * 1.13, r * 1.2, HS),
      ring(at(0.6, -0.1), head, r * 1.0, r * 1.07, HS),
      ring(at(1.0, -0.12), head, r * 0.62, r * 0.68, HS),
    ],
    [at(0.02, -0.08), at(0.6, -0.1), at(1.0, -0.12)],
    (band) => [SLOT.head, band === 0 ? SHADE : FULL],
    at(1.18, -0.14),
  );
  if (cut.small) {
    fig.slot(SLOT.own);
    const gc = at(0.62, 0.92);
    const gw = 0.66;
    const gh = 0.2;
    const tilt = norm(add(head.u, mul(head.f, -0.45)));
    fig.s.quad(
      add(add(gc, mul(head.r, -gw * r)), mul(tilt, -gh * r)),
      add(add(gc, mul(head.r, gw * r)), mul(tilt, -gh * r)),
      add(add(gc, mul(head.r, gw * r)), mul(tilt, gh * r)),
      add(add(gc, mul(head.r, -gw * r)), mul(tilt, gh * r)),
      LENS,
      norm(add(head.f, mul(head.u, 0.5))),
    );
  }
  // THE BEANIE, pulled down to the ears.
  fig.part(PART.beanie);
  fig.loft(
    [
      ring(at(0.12, -0.06), head, r * 1.06, r * 1.1, HS),
      ring(at(0.3, -0.06), head, r * 1.06, r * 1.1, HS),
      ring(at(0.78, -0.08), head, r * 0.8, r * 0.86, HS),
    ],
    [at(0.12, -0.06), at(0.3, -0.06), at(0.78, -0.08)],
    (band) => [SLOT.head, band === 0 ? SHADE : FULL],
    at(1.08, -0.1),
  );
  if (cut.small) {
    fig.slot(SLOT.accent);
    fig.limb(at(1.0, -0.1), at(1.4, -0.12), head.r, r * 0.3, r * 0.12, 4, FULL, true);
  }
  // HIS OWN HAIR, a cap of it over the skull and down the back.
  fig.part(PART.hair);
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
  fig.part(PART.body);
}

/** THE PATROL'S CROSS, white on the red front and back. */
function emitCross(fig: Figure, P: Posed, look: CrowdLook, chest: Frame): void {
  const k = look.height / 1.8;
  fig.part(PART.cross);
  fig.slot(SLOT.accent);
  const mid = mix(P.waist, P.neck, 0.62);
  for (const side of [1, -1]) {
    const c = add(mid, mul(chest.f, side * (look.girth * 1.06 + 0.012)));
    const n = mul(chest.f, side);
    const bar = (w: V3, h: V3): void => {
      fig.s.quad(
        sub(sub(c, w), h),
        add(sub(c, h), w),
        add(add(c, w), h),
        sub(add(c, h), w),
        FULL,
        n,
      );
    };
    bar(mul(chest.r, 0.035 * k), mul(chest.u, 0.11 * k));
    bar(mul(chest.r, 0.11 * k), mul(chest.u, 0.035 * k));
  }
  fig.part(PART.body);
}

/** THE PROPS in his hands and on his shoulder, as this target holds them. */
function emitProps(
  fig: Figure,
  P: Posed,
  look: CrowdLook,
  lod: CrowdLod,
  chest: Frame,
  holding: Holding,
): void {
  const k = look.height / 1.8;
  const small = cutOf(lod).small;
  const world: V3 = [0, 1, 0];
  // SKIS ON THE LEFT SHOULDER: the pair side by side, the bindings behind
  // the shoulder, the tips forward and down, the left hand on them.
  const L = look.ski;
  const along = norm(add(mul(chest.f, 0.96), mul(chest.u, -0.27)));
  const onShoulder = add(add(P.shoulderL, mul(chest.u, 0.075 * k)), mul(chest.r, -0.04 * k));
  // The pair's tops turned up and out to his left, half way to on edge,
  // so the two skis and the gap between them read from behind and above
  // and a topsheet with its binding from the side.
  const lift = norm(add(mul(chest.u, 0.75), mul(chest.r, -0.66)));
  const up = norm(sub(lift, mul(along, dot(lift, along))));
  const across = norm(cross(along, up));
  const W = look.skiWidth;
  // THE PAIR, side by side across the shoulder with a finger's gap between
  // them (the far cut a single plank of the two), each with its tip curled
  // up off its top and its binding — a toe piece and a taller heel piece —
  // a dark block on it behind the shoulder.
  const pair = lod === "far" ? [0] : [-0.5 * W - 0.012, 0.5 * W + 0.012];
  for (const side of pair) {
    const o = mul(across, side);
    const tail = add(add(onShoulder, o), mul(along, -0.42 * L));
    const tip = add(add(onShoulder, o), mul(along, 0.58 * L));
    fig.part(PART.skis);
    fig.slot(SLOT.skis);
    box(fig, tail, tip, across, up, lod === "far" ? 2 * W : W, 0.022, FULL);
    if (lod === "far") continue;
    box(
      fig,
      tip,
      add(add(tip, mul(along, 0.11)), mul(up, 0.07)),
      across,
      up,
      W * 0.92,
      0.018,
      SHADE,
    );
    fig.slot(SLOT.own);
    const on = (at: number, h: number): V3 =>
      add(add(add(onShoulder, o), mul(along, at)), mul(up, 0.011 + h / 2));
    box(
      fig,
      on(-0.2 * L, 0.035),
      on(-0.2 * L + 0.09 * k, 0.035),
      across,
      up,
      W * 0.8,
      0.035,
      PAINT.binding,
    );
    box(
      fig,
      on(-0.2 * L + 0.24 * k, 0.05),
      on(-0.2 * L + 0.33 * k, 0.05),
      across,
      up,
      W * 0.85,
      0.05,
      PAINT.binding,
    );
  }
  // Past the near cuts a cup, a ball or a shaft is under a pixel.
  if (lod === "far") {
    fig.part(PART.body);
    return;
  }
  // THE CUP in the right fist: upright, tipped to his mouth when he drinks.
  const hand = P.handR;
  const axis = norm(add(mul(world, 1 - 0.5 * holding.tip), mul(chest.f, -0.75 * holding.tip)));
  const sides = small ? 6 : 3;
  fig.part(PART.mug);
  fig.slot(SLOT.own);
  const mugFoot = sub(hand, mul(axis, 0.045));
  const mugRim = add(hand, mul(axis, 0.055));
  fig.limb(mugFoot, mugRim, chest.r, 0.042, 0.044, sides, PAINT.mug);
  fig.limb(mugRim, add(mugRim, mul(axis, 0.004)), chest.r, 0.04, 0.01, sides, PAINT.cocoa);
  if (small) {
    const out = norm(sub(chest.r, mul(axis, dot(chest.r, axis))));
    box(
      fig,
      add(hand, mul(out, -0.05)),
      add(hand, mul(out, -0.075)),
      axis,
      axis,
      0.012,
      0.06,
      PAINT.mug,
    );
  }
  fig.part(PART.beer);
  const glassFoot = sub(hand, mul(axis, 0.06));
  const glassTop = add(hand, mul(axis, 0.1));
  fig.limb(glassFoot, glassTop, chest.r, 0.034, 0.042, sides, PAINT.beer);
  fig.limb(
    glassTop,
    add(glassTop, mul(axis, 0.03)),
    chest.r,
    0.043,
    0.036,
    sides,
    PAINT.foam,
    true,
  );
  // A SNOWBALL in the right fist.
  fig.part(PART.snowball);
  fig.limb(
    sub(hand, mul(world, 0.05)),
    add(hand, mul(world, 0.04)),
    chest.r,
    0.05,
    0.03,
    4,
    PAINT.snow,
    true,
  );
  // THE LONG TOOLS: held upright in the right hand at rest, its foot on the
  // snow; worked with both hands, the right on the grip.
  const tool = (length: number): { top: V3; foot: V3; shaft: V3 } => {
    if (holding.tool === "work") {
      const shaft = norm(sub(P.handL, P.handR));
      return {
        top: sub(P.handR, mul(shaft, 0.08)),
        foot: add(P.handR, mul(shaft, length - 0.08)),
        shaft,
      };
    }
    const shaft = norm(add(add(mul(world, -1), mul(chest.f, 0.14)), mul(chest.r, 0.06)));
    const down = Math.max(0.2, hand[1] / Math.max(0.3, -shaft[1]));
    const foot = add(hand, mul(shaft, down));
    return { top: sub(foot, mul(shaft, length)), foot, shaft };
  };
  fig.part(PART.shovel);
  {
    const blade = 0.34;
    const { top, foot, shaft } = tool(1.05 + blade);
    const neck = sub(foot, mul(shaft, blade));
    fig.limb(top, neck, chest.r, 0.016, 0.016, small ? 4 : 3, PAINT.wood);
    if (small)
      box(
        fig,
        sub(top, mul(shaft, 0.02)),
        add(top, mul(shaft, 0.1)),
        chest.r,
        chest.f,
        0.12,
        0.03,
        PAINT.grip,
      );
    const face = norm(sub(chest.f, mul(shaft, dot(chest.f, shaft))));
    box(fig, neck, foot, chest.r, face, 0.34, 0.025, PAINT.blade);
  }
  fig.part(PART.broom);
  {
    const head = 0.1;
    const { top, foot, shaft } = tool(1.3);
    const neck = sub(foot, mul(shaft, head));
    fig.limb(top, neck, chest.r, 0.015, 0.015, small ? 4 : 3, PAINT.wood);
    const face = norm(sub(chest.f, mul(shaft, dot(chest.f, shaft))));
    box(fig, neck, foot, face, chest.r, 0.07, 0.34, PAINT.bristle);
  }
  fig.part(PART.body);
}

/** One pose of a civilian body at a cut: the same calls in the same order
 * for every pose. */
function emit(fig: Figure, P: Posed, look: CrowdLook, lod: CrowdLod, holding: Holding): void {
  const { hips, chest } = bodyFrames(P);
  fig.part(PART.body);
  emitBoots(fig, P, look, lod, hips);
  emitLegs(fig, P, look, lod, hips);
  emitTrunk(fig, P, look, lod, hips, chest, SLOT.vest);
  emitArms(fig, P, look, lod, chest, false);
  emitHead(fig, P, look, lod, chest);
  if (lod !== "far") emitCross(fig, P, look, chest);
  emitProps(fig, P, look, lod, chest, holding);
}

/** The skeleton and the holding of every shape, the stance first. */
export function civilianTargets(body: CrowdBody): { posed: Posed; holding: Holding }[] {
  const look = CROWD_LOOKS[body];
  return (["stand", ...CIVILIAN_POSES] as const).map((t) => {
    const m = moveOf(t);
    return { posed: keyPosed(m.key, look), holding: m.holding };
  });
}

const built = new Map<string, THREE.BufferGeometry>();

/** ONE CIVILIAN BODY AT ONE CUT, stood, with every pose of
 * `CIVILIAN_POSES` as a relative morph target, `aSlot` and `aPart` on
 * every vertex. Built once a session and shared. */
export function buildCivilianFigure(body: CrowdBody, lod: CrowdLod): THREE.BufferGeometry {
  const key = `${body}:${lod}`;
  const cached = built.get(key);
  if (cached) return cached;
  const look = CROWD_LOOKS[body];
  const shapes = civilianTargets(body).map(({ posed, holding }) => {
    const fig = new Figure(true);
    emit(fig, posed, look, lod, holding);
    return fig.s.geometry();
  });
  const base = shapes[0];
  const bp = base.getAttribute("position").array as Float32Array;
  const bn = base.getAttribute("normal").array as Float32Array;
  const delta = (g: THREE.BufferGeometry, name: "position" | "normal", from: Float32Array) => {
    const a = g.getAttribute(name).array as Float32Array;
    if (a.length !== from.length) throw new Error(`civilian ${key}: a pose changed the mesh`);
    const out = new Float32Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = a[i] - from[i];
    return new THREE.Float32BufferAttribute(out, 3);
  };
  base.morphAttributes.position = shapes.slice(1).map((g) => delta(g, "position", bp));
  base.morphAttributes.normal = shapes.slice(1).map((g) => delta(g, "normal", bn));
  base.morphTargetsRelative = true;
  for (const g of shapes.slice(1)) g.dispose();
  base.boundingSphere = new THREE.Sphere(
    new THREE.Vector3(0, look.height / 2, 0),
    look.height * 1.6,
  );
  built.set(key, base);
  return base;
}

/** How many triangles a civilian body's cut is, folded parts and all. */
export function civilianTriangles(body: CrowdBody, lod: CrowdLod): number {
  return buildCivilianFigure(body, lod).getAttribute("position").count / 3;
}

/** The vertex shader's slot picker, the vest's slot the ninth. */
const PAINT_GLSL = `#include <color_vertex>
#ifdef USE_COLOR
\tif (aSlot > 0.5) {
\t\tfloat k = aSlot < 1.5 ? aDress.x : aSlot < 2.5 ? aDress.y : aSlot < 3.5 ? aDress.z
\t\t\t: aSlot < 4.5 ? aDress.w : aSlot < 5.5 ? aDress2.x : aSlot < 6.5 ? aDress2.y
\t\t\t: aSlot < 7.5 ? aDress2.z : aDress2.w;
\t\tvColor.rgb = uCivilianPalette[int(k + 0.5)] * color.rgb;
\t}
#endif`;

/** A part the instance does not show is folded to his feet. */
const FOLD_GLSL = `#include <morphtarget_vertex>
\tif (aPart > 0.5 && abs(aPart - aKit.x) > 0.5 && abs(aPart - aKit.y) > 0.5
\t\t&& abs(aPart - aKit.z) > 0.5 && abs(aPart - aKit.w) > 0.5) transformed = vec3(0.0);`;

const FOLD_ATTRIBUTES = "attribute float aPart;\nattribute vec4 aKit;\n";

/** THE CIVILIANS' MATERIAL: the crowd's (Lambert, vertex-coloured, in the
 * haze, every dressed vertex painted from the instance's outfit) with the
 * parts an instance does not show folded away. */
export function civilianMaterial(haze: HazeUniforms): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const palette = { value: CIVILIAN_PALETTE.map((hex) => new THREE.Color(hex)) };
  return hazeMaterial(material, haze, "civilians", (shader) => {
    shader.uniforms.uCivilianPalette = palette;
    shader.vertexShader = `attribute float aSlot;
attribute vec4 aDress;
attribute vec4 aDress2;
${FOLD_ATTRIBUTES}uniform vec3 uCivilianPalette[${CIVILIAN_PALETTE.length}];
${shader.vertexShader}`
      .replace("#include <color_vertex>", PAINT_GLSL)
      .replace("#include <morphtarget_vertex>", FOLD_GLSL);
  });
}

/** The key light's depth for a civilian: the shared shadow depth with the
 * folded parts folded, so a prop he does not hold casts no shadow. */
export function civilianDepth(depth: THREE.MeshDepthMaterial): THREE.MeshDepthMaterial {
  const shade = depth.onBeforeCompile;
  depth.customProgramCacheKey = (): string => "civilian-shade-depth";
  depth.onBeforeCompile = (shader, renderer) => {
    shade.call(depth, shader, renderer);
    shader.vertexShader = `${FOLD_ATTRIBUTES}${shader.vertexShader}`.replace(
      "#include <morphtarget_vertex>",
      FOLD_GLSL,
    );
  };
  return depth;
}

// ── THE THINGS ON THE SNOW: the deck chairs and the snowmen ─────────────

/** A deck chair as the lounger lies in it (`civilian-moves.ts`' LOUNGE):
 * a wooden frame, the canvas from the foot rest up the seat to the back at
 * 55°, in the chair's frame (x right, z the way it faces). */
function deckchair(s: Shape, o: V3, heading: number, stripe: THREE.Color): void {
  const c = Math.cos(heading);
  const sn = Math.sin(heading);
  const at = (x: number, y: number, z: number): V3 => [
    o[0] + x * c + z * sn,
    o[1] + y,
    o[2] - x * sn + z * c,
  ];
  const wood = new THREE.Color(0x8d6a43);
  const canvas = [stripe, new THREE.Color(0xf1ede2)];
  // The canvas: foot rest, seat, back — strips across, striped.
  const line: [number, number][] = [
    [0.12, 0.62],
    [0.3, 0.2],
    [0.28, -0.2],
    [0.62, -0.45],
    [0.96, -0.72],
  ];
  const w = 0.3;
  for (let i = 0; i + 1 < line.length; i++) {
    const [y0, z0] = line[i];
    const [y1, z1] = line[i + 1];
    for (let j = 0; j < 3; j++) {
      const x0 = -w + (2 * w * j) / 3;
      const x1 = -w + (2 * w * (j + 1)) / 3;
      s.quad(at(x0, y0, z0), at(x1, y0, z0), at(x1, y1, z1), at(x0, y1, z1), canvas[j % 2]);
    }
  }
  // The frame: the rails either side, the legs to the snow.
  for (const x of [-w - 0.02, w + 0.02]) {
    for (let i = 0; i + 1 < line.length; i++) {
      const [y0, z0] = line[i];
      const [y1, z1] = line[i + 1];
      s.tube(at(x, y0, z0), at(x, y1, z1), 0.02, 0.02, 4, wood);
    }
    s.tube(at(x, 0.3, 0.2), at(x, 0, 0.32), 0.02, 0.02, 4, wood);
    s.tube(at(x, 0.62, -0.45), at(x, 0, -0.6), 0.02, 0.02, 4, wood);
    s.tube(at(x, 0.12, 0.62), at(x, 0, 0.66), 0.02, 0.02, 4, wood);
  }
}

/** A snowman: three balls of packed snow, coal eyes and buttons, a carrot,
 * two stick arms, the children's own size. */
function snowman(s: Shape, o: V3, heading: number): void {
  const white = new THREE.Color(0xf2f5f8);
  const coal = new THREE.Color(0x1d1f22);
  const carrot = new THREE.Color(0xe2701f);
  const stick = new THREE.Color(0x5a3f26);
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const ball = (y: number, r: number): void => {
    const rings = 5;
    const sides = 7;
    for (let i = 0; i < rings; i++) {
      const a0 = Math.PI * (i / rings - 0.5);
      const a1 = Math.PI * ((i + 1) / rings - 0.5);
      for (let j = 0; j < sides; j++) {
        const b0 = (j / sides) * Math.PI * 2;
        const b1 = ((j + 1) / sides) * Math.PI * 2;
        const p = (a: number, b: number): V3 => [
          o[0] + Math.cos(a) * Math.sin(b) * r,
          o[1] + y + Math.sin(a) * r,
          o[2] + Math.cos(a) * Math.cos(b) * r,
        ];
        s.quad(p(a0, b0), p(a0, b1), p(a1, b1), p(a1, b0), white);
      }
    }
  };
  ball(0.3, 0.36);
  ball(0.78, 0.26);
  ball(1.12, 0.17);
  const face = (y: number, r: number, side: number): V3 => {
    const a = side * 0.35;
    return [
      o[0] + (fx * Math.cos(a) + fz * Math.sin(a)) * r,
      o[1] + y,
      o[2] + (fz * Math.cos(a) - fx * Math.sin(a)) * r,
    ];
  };
  for (const side of [-1, 1])
    s.tube(face(1.17, 0.15, side), face(1.17, 0.18, side), 0.025, 0.02, 4, coal);
  for (const y of [0.72, 0.84]) s.tube(face(y, 0.24, 0), face(y, 0.27, 0), 0.025, 0.02, 4, coal);
  s.tube(face(1.11, 0.16, 0), face(1.11, 0.33, 0), 0.035, 0.005, 5, carrot);
  for (const side of [-1, 1]) {
    const rx = fz * side;
    const rz = -fx * side;
    s.tube(
      [o[0] + rx * 0.22, o[1] + 0.85, o[2] + rz * 0.22],
      [o[0] + rx * 0.62, o[1] + 1.12, o[2] + rz * 0.62],
      0.018,
      0.01,
      4,
      stick,
    );
  }
}

/** THE PLAN'S PROPS, built into one mesh about `origin` (a deck chair a
 * colour of its own off its place). */
export function buildCivilianProps(plan: CivilianPlan, origin: V3): THREE.BufferGeometry {
  const s = new Shape(0, { stems: false });
  const stripes = [0x2f6db5, 0xd2392c, 0x2f8f4e, 0xe0a52b].map((h) => new THREE.Color(h));
  plan.props.forEach((p, i) => {
    const o: V3 = [p.x - origin[0], p.y - origin[1], p.z - origin[2]];
    if (p.kind === "deckchair") deckchair(s, o, p.heading, stripes[i % stripes.length]);
    else snowman(s, o, p.heading);
  });
  return s.geometry();
}
