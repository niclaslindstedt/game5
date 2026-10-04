// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPECTATORS, BUILT AND MOVED — one rough, faceted figure every fan is
// drawn from (two cuts: NEAR and FAR), and the shader that brings each one
// to life.
//
// ROUGH ON PURPOSE. A fan is a few hundred triangles seen past a fence from
// a racer's line, and what reads from there is the silhouette, the colour
// and above all the MOVEMENT: a bank of people turning as one to follow a
// racer down, arms going up, cowbells shaking, flags sweeping, children
// jumping. So the figure is boxes and a faceted head — but it carries
// EVERYTHING a fan might be (every hat, a long coat, a backpack, a scarf,
// a cowbell, a flag, a board, a horn, a phone), each part tagged with the
// toggle that keeps it (`aBone.w`), and the instance's look (`aLook`, dealt
// by `spectator-plan.ts`) folds away whatever he did not bring: a part not
// worn collapses to a point and draws nothing. Every face says which piece
// of his dress it is (`aBone.y`) and the instance says what colour that is
// (`aDress`, `aDress2`, into `FAN_PALETTE`) — so one mesh is thousands of
// different people.
//
// THE ANIMATION IS THE SHADER'S, a pure function of the clock and where the
// racers are (`uFanSkier`, written once a frame), so a bank of five hundred
// costs one draw and no work on the CPU:
//
//   * AT REST a fan fidgets — weight shifted from foot to foot, stamping in
//     the cold, a glance at his neighbour, hands hanging, in pockets, arms
//     folded or a hand on a hip, the odd short clap; a flag held slanted,
//     a board at the chest, a bell given a shake now and then.
//   * A RACER COMING lights him up as he nears (`aMood.x`, how far off a
//     racer reaches this one): he turns to FOLLOW him — the body as far as
//     it turns, the head the rest — leans in, and does his thing: claps
//     over his head, waves both arms, rings his cowbell, sweeps his flag in
//     big arcs (the cloth rippling), jumps with his fists pumping, holds
//     his board up and bounces it, blows his horn, holds his phone out at
//     the racer and tracks him.
//   * THE ARENA never quite settles (`uFanArena`): the music between
//     racers keeps it bouncing and clapping, and a WAVE runs along a
//     grandstand now and then (`uFanWave`), each fan up with his arms high
//     as it reaches him.
//
// The bones are rigid parts: the legs swing at the hips, the trunk leans
// and rolls over the hips, the head turns and nods on the neck, each arm
// raises and swings at the shoulder and bends at the elbow, and whatever
// he holds rides his right hand.

import * as THREE from "three";

import { FAN_PALETTE } from "./spectator-plan.ts";
import { hazeMaterial, PAST_THE_WALL, type HazeUniforms } from "./haze.ts";

/** The figure's measure, m, for a fan of `REF.height`. */
export const REF = {
  height: 1.75,
  hip: 0.92,
  hipX: 0.1,
  shoulder: 1.41,
  shoulderX: 0.235,
  upper: 0.29,
  fore: 0.27,
  neck: 1.5,
};

/** The rigid parts, `aBone.x`. */
const BONE = { body: 0, legL: 1, legR: 2, head: 3, upperL: 4, foreL: 5, upperR: 6, foreR: 7 };
/** Which colour a face takes, `aBone.y`: 0 its own (painted in), then the
 * dress. */
const SLOT = { own: 0, jacket: 1, trousers: 2, hat: 3, accent: 4, skin: 5, s1: 6, s2: 7, s3: 8 };
/** What keeps a part, `aBone.w`: 0 always; 1 a long coat, 2 a pack, 3 a
 * scarf; 10 hair (bare or under a cap), 11 a beanie's shell (a beanie, a
 * bobble hat, the horns), 12 the bobble, 13 a cap, 14 a hood, 15 the
 * horns, 16 any hat; 20 + a style the prop it carries. */
const KEEP = { always: 0, coat: 1, pack: 2, scarf: 3, hair: 10, shell: 11, bobble: 12 };
const KEEP_CAP = 13;
const KEEP_HOOD = 14;
const KEEP_HORNS = 15;
/** Kept under any hat at all: the coarser cuts' one hat. */
const KEEP_ANY_HAT = 16;
const PROP = 20;

/** A FAN'S FLAG, m and rad: the pole's length, its slant off the forearm
 * toward his front, and the cloth. */
const FLAG = { pole: 1.35, slant: 0.8, width: 0.95, height: 0.62 };

export type FanCut = "near" | "mid" | "far";
export const FAN_CUT_NAMES: readonly FanCut[] = ["near", "mid", "far"];

const BOOT = new THREE.Color(0x23262b);
const MITT = new THREE.Color(0x26282d);
const HAIR = new THREE.Color(0x3b2a1e);
const BRASS = new THREE.Color(0xc9a04a);
const ALLOY = new THREE.Color(0xa9b0b6);
const BOARD = new THREE.Color(0xf4f4ef);
const PHONE = new THREE.Color(0x15171a);
const HORN = new THREE.Color(0xd8262f);
const WHITE = new THREE.Color(1, 1, 1);

/** The figure being built: flat arrays, one triangle at a time. */
class Build {
  pos: number[] = [];
  col: number[] = [];
  bone: number[] = [];
  /** Add `g` (made non-indexed) placed by `m`, as `bone`, coloured `slot`
   * (or `own`), kept by `keep`; `u` per vertex along a flag's cloth. */
  add(
    g: THREE.BufferGeometry,
    m: THREE.Matrix4,
    bone: number,
    slot: number,
    keep: number,
    own: THREE.Color = WHITE,
    u?: (p: THREE.Vector3) => number,
  ): void {
    const flat = g.index ? g.toNonIndexed() : g;
    flat.applyMatrix4(m);
    const p = flat.getAttribute("position");
    const v = new THREE.Vector3();
    const c = slot === SLOT.own ? own : WHITE;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      this.pos.push(v.x, v.y, v.z);
      // Every other facet a shade darker, so a jacket reads as a body even
      // flat-lit.
      const shade = Math.floor(i / 3) % 2 ? 0.9 : 1;
      this.col.push(c.r * shade, c.g * shade, c.b * shade);
      this.bone.push(bone, slot, u ? u(v) : 0, keep);
    }
  }
  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute("aBone", new THREE.Float32BufferAttribute(this.bone, 4));
    g.computeVertexNormals();
    return g;
  }
}

const at = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) =>
  new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
/** A tapered, faceted prism: `sides` round, `r0` at its foot and `r1` at
 * its top, `h` tall, centred — `open` with no caps, for a limb whose ends
 * are hidden in the body, a boot or a mitten. */
const prism = (r0: number, r1: number, h: number, sides: number, open = false) =>
  new THREE.CylinderGeometry(r1, r0, h, sides, 1, open);

const FIGURES = new Map<FanCut, THREE.BufferGeometry>();

/** THE FIGURE at a cut: everything a fan might be, in the reference
 * measure, standing at the origin facing +z. Cached; never disposed.
 *
 *   NEAR  faceted all through, every hat and prop in its own shape;
 *   MID   boxes and four-sided limbs, one hat for every hat, the props
 *         that read from a hundred metres (a flag, a board, a bell, a horn);
 *   FAR   a handful of boxes — trousers, jacket, head, hat, two arms that
 *         still go up — and a flag's cloth. */
export function buildFanFigure(cut: FanCut): THREE.BufferGeometry {
  const hit = FIGURES.get(cut);
  if (hit) return hit;
  const g = cut === "near" ? nearFigure() : cut === "mid" ? midFigure() : farFigure();
  FIGURES.set(cut, g);
  return g;
}

const hand = { x: REF.shoulderX, y: REF.shoulder - REF.upper - REF.fore + 0.02 };
const keepProp = (style: number) => PROP + style;
/** Which way a flag's pole runs off the forearm, in the hanging arm's
 * frame, and where its cloth starts. */
const poleDir = new THREE.Vector3(0, -Math.cos(FLAG.slant), Math.sin(FLAG.slant));
const handAt = new THREE.Vector3(hand.x, hand.y, 0.02);

/** The flag: a pole through the fist, slanted FLAG.slant off the forearm
 * toward his front — so a forearm held level stands it up, and an arm
 * raised over the head carries it up and forward — and the cloth off its
 * far end, flying out to his right in `stripes` stripes. */
function addFlag(b: Build, segs: number, stripes: number, pole: boolean): void {
  const d = poleDir;
  if (pole) {
    const poleAt = handAt.clone().addScaledVector(d, FLAG.pole / 2 - 0.15);
    b.add(
      prism(0.012, 0.012, FLAG.pole, 4, true),
      at(poleAt.x, poleAt.y, poleAt.z, Math.PI - FLAG.slant),
      BONE.foreR,
      SLOT.own,
      keepProp(3),
      ALLOY,
    );
  }
  const tip = handAt.clone().addScaledVector(d, FLAG.pole - 0.17);
  for (let k = 0; k < stripes; k++) {
    const g = new THREE.PlaneGeometry(FLAG.width, FLAG.height / stripes, segs, 1);
    const c = tip.clone().addScaledVector(d, -((k + 0.5) * FLAG.height) / stripes);
    b.add(
      g,
      at(c.x + FLAG.width / 2, c.y, c.z, Math.PI - FLAG.slant),
      BONE.foreR,
      SLOT.s1 + k,
      keepProp(3),
      WHITE,
      (v) => Math.max(0, Math.min(1, (v.x - hand.x) / FLAG.width)),
    );
  }
}

/** The board held over him in both fists, centred on his middle (the
 * right fist is a shoulder's width off it), its stripes through both faces
 * so it reads from in front and behind. */
function addBoard(b: Build, stripes: boolean): void {
  const x = hand.x - REF.shoulderX;
  b.add(box(0.95, 0.5, 0.025), at(x, hand.y - 0.2, 0.06), BONE.foreR, SLOT.own, keepProp(5), BOARD);
  b.add(box(0.97, 0.09, 0.04), at(x, hand.y - 0.38, 0.06), BONE.foreR, SLOT.accent, keepProp(5));
  if (stripes)
    b.add(box(0.7, 0.08, 0.04), at(x, hand.y - 0.17, 0.06), BONE.foreR, SLOT.s1, keepProp(5));
}

function nearFigure(): THREE.BufferGeometry {
  const b = new Build();
  const r = REF;
  const sides = 6;
  // THE LEGS: a tapered trouser leg and a boot each, hanging from the hip.
  for (const [bone, x] of [
    [BONE.legL, -r.hipX],
    [BONE.legR, r.hipX],
  ] as const) {
    b.add(
      prism(0.062, 0.078, r.hip - 0.1, sides, true),
      at(x, (r.hip + 0.1) / 2, 0),
      bone,
      SLOT.trousers,
      KEEP.always,
    );
    b.add(box(0.12, 0.12, 0.27), at(x, 0.06, 0.04), bone, SLOT.own, KEEP.always, BOOT);
  }
  // THE TRUNK: the hips in the trousers, the jacket over the chest, the
  // collar — and what he might wear over or on it.
  b.add(box(0.34, 0.16, 0.22), at(0, r.hip + 0.04, 0), BONE.body, SLOT.trousers, KEEP.always);
  b.add(
    prism(0.2, 0.235, 0.5, 8),
    at(0, 1.22, 0, 0, Math.PI / 8, 0, 1, 1, 0.62),
    BONE.body,
    SLOT.jacket,
    KEEP.always,
  );
  b.add(
    prism(0.24, 0.205, 0.34, 8, true),
    at(0, 0.84, 0, 0, Math.PI / 8, 0, 1, 1, 0.66),
    BONE.body,
    SLOT.jacket,
    KEEP.coat,
  );
  b.add(box(0.3, 0.36, 0.13), at(0, 1.22, -0.2), BONE.body, SLOT.accent, KEEP.pack);
  b.add(
    prism(0.085, 0.075, 0.08, sides, true),
    at(0, r.neck, 0),
    BONE.body,
    SLOT.skin,
    KEEP.always,
  );
  b.add(
    prism(0.12, 0.1, 0.09, sides, true),
    at(0, r.neck - 0.01, 0),
    BONE.body,
    SLOT.accent,
    KEEP.scarf,
  );
  b.add(box(0.07, 0.24, 0.02), at(0.06, 1.32, 0.15), BONE.body, SLOT.accent, KEEP.scarf);
  // THE HEAD, faceted, and every hat.
  b.add(
    new THREE.IcosahedronGeometry(0.115, 0),
    at(0, 1.635, 0.01, 0, 0, 0, 0.92, 1.08, 1),
    BONE.head,
    SLOT.skin,
    KEEP.always,
  );
  b.add(
    prism(0.112, 0.085, 0.07, sides),
    at(0, 1.72, -0.005),
    BONE.head,
    SLOT.own,
    KEEP.hair,
    HAIR,
  );
  b.add(prism(0.122, 0.09, 0.13, sides), at(0, 1.725, 0), BONE.head, SLOT.hat, KEEP.shell);
  b.add(
    new THREE.IcosahedronGeometry(0.05, 0),
    at(0, 1.815, 0),
    BONE.head,
    SLOT.accent,
    KEEP.bobble,
  );
  b.add(box(0.2, 0.025, 0.11), at(0, 1.71, 0.13, -0.15), BONE.head, SLOT.hat, KEEP_CAP);
  b.add(prism(0.12, 0.1, 0.06, sides), at(0, 1.73, -0.005), BONE.head, SLOT.hat, KEEP_CAP);
  for (const s of [-1, 1]) {
    b.add(
      new THREE.ConeGeometry(0.035, 0.17, 5, 1, true),
      at(s * 0.12, 1.79, 0, 0, 0, -s * 0.75),
      BONE.head,
      SLOT.own,
      KEEP_HORNS,
      BOARD,
    );
  }
  b.add(
    prism(0.14, 0.12, 0.3, sides),
    at(0, 1.66, -0.025, 0, 0, 0, 1, 1, 1.05),
    BONE.head,
    SLOT.jacket,
    KEEP_HOOD,
  );
  // THE ARMS, hanging from the shoulders: a sleeve, a forearm, a mitten.
  for (const [upper, fore, s] of [
    [BONE.upperL, BONE.foreL, -1],
    [BONE.upperR, BONE.foreR, 1],
  ] as const) {
    const x = s * r.shoulderX;
    const elbow = r.shoulder - r.upper;
    b.add(
      prism(0.05, 0.062, r.upper, sides, true),
      at(x, r.shoulder - r.upper / 2, 0),
      upper,
      SLOT.jacket,
      KEEP.always,
    );
    b.add(
      prism(0.044, 0.05, r.fore - 0.06, sides, true),
      at(x, elbow - (r.fore - 0.06) / 2, 0),
      fore,
      SLOT.jacket,
      KEEP.always,
    );
    b.add(
      box(0.075, 0.1, 0.075),
      at(x, elbow - r.fore + 0.02, 0.005),
      fore,
      SLOT.own,
      KEEP.always,
      MITT,
    );
  }
  // WHAT HE HOLDS, in the right fist (at the wrist, the forearm hanging):
  // each kept only by the style it belongs to. The cowbell flared below
  // the fist on its strap; the flag; the board; the horn, its bell
  // forward; the phone, a dark slab.
  b.add(
    prism(0.085, 0.05, 0.16, sides),
    at(hand.x, hand.y - 0.12, 0.02),
    BONE.foreR,
    SLOT.own,
    keepProp(2),
    BRASS,
  );
  addFlag(b, 4, 3, true);
  addBoard(b, true);
  b.add(
    new THREE.ConeGeometry(0.06, 0.42, sides, 1, true),
    at(hand.x, hand.y - 0.02, 0.22, -Math.PI / 2, 0, 0),
    BONE.foreR,
    SLOT.own,
    keepProp(6),
    HORN,
  );
  b.add(
    box(0.075, 0.15, 0.012),
    at(hand.x, hand.y - 0.08, 0.05),
    BONE.foreR,
    SLOT.own,
    keepProp(7),
    PHONE,
  );
  return b.geometry();
}

function midFigure(): THREE.BufferGeometry {
  const b = new Build();
  const r = REF;
  for (const [bone, x] of [
    [BONE.legL, -r.hipX],
    [BONE.legR, r.hipX],
  ] as const) {
    b.add(
      prism(0.07, 0.08, r.hip, 4, true),
      at(x, r.hip / 2, 0, 0, Math.PI / 4),
      bone,
      SLOT.trousers,
      KEEP.always,
    );
  }
  b.add(box(0.34, 0.16, 0.22), at(0, r.hip + 0.04, 0), BONE.body, SLOT.trousers, KEEP.always);
  b.add(box(0.44, 0.52, 0.27), at(0, 1.22, 0), BONE.body, SLOT.jacket, KEEP.always);
  b.add(box(0.44, 0.32, 0.29), at(0, 0.84, 0), BONE.body, SLOT.jacket, KEEP.coat);
  b.add(box(0.3, 0.36, 0.13), at(0, 1.22, -0.2), BONE.body, SLOT.accent, KEEP.pack);
  b.add(box(0.22, 0.08, 0.18), at(0, r.neck - 0.01, 0), BONE.body, SLOT.accent, KEEP.scarf);
  b.add(box(0.2, 0.24, 0.21), at(0, 1.635, 0.01), BONE.head, SLOT.skin, KEEP.always);
  b.add(box(0.23, 0.12, 0.24), at(0, 1.735, 0), BONE.head, SLOT.hat, KEEP_ANY_HAT);
  b.add(box(0.08, 0.08, 0.08), at(0, 1.82, 0), BONE.head, SLOT.accent, KEEP.bobble);
  for (const [upper, fore, s] of [
    [BONE.upperL, BONE.foreL, -1],
    [BONE.upperR, BONE.foreR, 1],
  ] as const) {
    const x = s * r.shoulderX;
    const elbow = r.shoulder - r.upper;
    b.add(
      prism(0.055, 0.065, r.upper, 4, true),
      at(x, r.shoulder - r.upper / 2, 0, 0, Math.PI / 4),
      upper,
      SLOT.jacket,
      KEEP.always,
    );
    b.add(
      prism(0.05, 0.055, r.fore, 4),
      at(x, elbow - r.fore / 2, 0, 0, Math.PI / 4),
      fore,
      SLOT.jacket,
      KEEP.always,
    );
  }
  b.add(
    box(0.13, 0.16, 0.13),
    at(hand.x, hand.y - 0.12, 0.02),
    BONE.foreR,
    SLOT.own,
    keepProp(2),
    BRASS,
  );
  addFlag(b, 1, 3, true);
  addBoard(b, false);
  b.add(
    box(0.1, 0.1, 0.4),
    at(hand.x, hand.y - 0.02, 0.22),
    BONE.foreR,
    SLOT.own,
    keepProp(6),
    HORN,
  );
  return b.geometry();
}

function farFigure(): THREE.BufferGeometry {
  const b = new Build();
  const r = REF;
  b.add(
    box(0.32, r.hip + 0.08, 0.2),
    at(0, (r.hip + 0.08) / 2, 0),
    BONE.body,
    SLOT.trousers,
    KEEP.always,
  );
  b.add(box(0.44, 0.56, 0.27), at(0, 1.24, 0), BONE.body, SLOT.jacket, KEEP.always);
  b.add(box(0.21, 0.25, 0.22), at(0, 1.64, 0), BONE.head, SLOT.skin, KEEP.always);
  b.add(box(0.24, 0.12, 0.25), at(0, 1.74, 0), BONE.head, SLOT.hat, KEEP_ANY_HAT);
  // One box an arm, on the upper arm's bone: it swings and goes up whole
  // from the shoulder, the elbow kept straight.
  for (const [upper, s] of [
    [BONE.upperL, -1],
    [BONE.upperR, 1],
  ] as const) {
    b.add(
      box(0.11, r.upper + r.fore, 0.11),
      at(s * r.shoulderX, r.shoulder - (r.upper + r.fore) / 2, 0),
      upper,
      SLOT.jacket,
      KEEP.always,
    );
  }
  addFlag(b, 1, 1, false);
  return b.geometry();
}

/** Triangles in a cut — every part, the folded ones too. */
export function fanTriangles(cut: FanCut): number {
  return buildFanFigure(cut).getAttribute("position").count / 3;
}

/** The GLSL the figure moves by: the bones posed off the instance and the
 * clock, then turned to his heading. Exported for the lab's sheets, which
 * pose a figure the same way. */
const POSE_GLSL = /* glsl */ `
attribute vec4 aBone;
attribute vec4 aLook;
attribute vec4 aAct;
attribute vec4 aMood;
attribute vec4 aDress;
attribute vec4 aDress2;
uniform float uFanTime;
uniform vec4 uFanSkier[4];
uniform float uFanArena;
uniform vec4 uFanWave;
uniform vec3 uFanPalette[${FAN_PALETTE.length}];
vec3 fanP;

mat3 fanRx(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 fanRy(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 fanRz(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
float fanWrap(float a) { return atan(sin(a), cos(a)); }
float fanPulse(float t, float every, float width) { return smoothstep(0.0, 0.15, fract(t / every) * every) * (1.0 - smoothstep(width - 0.15, width, fract(t / every) * every)); }

// Whether a part is kept, by its toggle and the fan's look.
bool fanKept(float keep, float hat, float bits, float style) {
  if (keep < 0.5) return true;
  if (keep < 1.5) return mod(bits, 2.0) > 0.5;
  if (keep < 2.5) return mod(floor(bits / 2.0), 2.0) > 0.5;
  if (keep < 3.5) return mod(floor(bits / 4.0), 2.0) > 0.5;
  if (keep < 10.5) return hat < 0.5 || abs(hat - 3.0) < 0.5;
  if (keep < 11.5) return abs(hat - 1.0) < 0.5 || abs(hat - 2.0) < 0.5 || abs(hat - 5.0) < 0.5;
  if (keep < 12.5) return abs(hat - 2.0) < 0.5;
  if (keep < 13.5) return abs(hat - 3.0) < 0.5;
  if (keep < 14.5) return abs(hat - 4.0) < 0.5;
  if (keep < 15.5) return abs(hat - 5.0) < 0.5;
  if (keep < 16.5) return hat > 0.5;
  return abs(keep - 20.0 - style) < 0.5;
}

// One arm's pose: forward raise, raise out to the side, the elbow's bend.
struct FanArm { float pitch; float wide; float bend; };

FanArm fanArm(float p, float o, float b) { FanArm a; a.pitch = p; a.wide = o; a.bend = b; return a; }
FanArm fanMix(FanArm a, FanArm b, float k) { return fanArm(mix(a.pitch, b.pitch, k), mix(a.wide, b.wide, k), mix(a.bend, b.bend, k)); }

vec3 fanPoseArm(vec3 p, float side, bool fore, FanArm a) {
  vec3 sh = vec3(side * ${REF.shoulderX.toFixed(3)}, ${REF.shoulder.toFixed(3)}, 0.0);
  vec3 q = p - sh;
  if (fore) {
    vec3 el = vec3(0.0, -${REF.upper.toFixed(3)}, 0.0);
    q = fanRx(-a.bend) * (q - el) + el;
  }
  return fanRz(side * a.wide) * (fanRx(-a.pitch) * q) + sh;
}

void fanPose(vec3 pos) {
  float bone = aBone.x;
  float style = aAct.w;
  if (!fanKept(aBone.w, aLook.z, aLook.w, style)) { fanP = vec3(0.0, 1.0, 0.0); return; }
  vec3 home = instanceMatrix[3].xyz;
  float t = uFanTime * (0.85 + 0.3 * aAct.y) + aAct.y * 37.0;

  // HOW LIT UP HE IS, and where the racers are from him.
  float e = 0.0;
  vec2 look = vec2(0.0);
  for (int i = 0; i < 4; i++) {
    vec4 sk = uFanSkier[i];
    if (sk.w <= 0.0) continue;
    vec2 d = sk.xz - home.xz;
    float dist = length(d);
    float ei = (1.0 - smoothstep(aMood.x * 0.22, aMood.x, dist)) * sk.w;
    e = max(e, ei);
    look += d / max(dist, 0.01) * (ei * ei + 1e-4 * ei);
  }
  float lively = 0.55 + 0.45 * aAct.z;
  float arena = aMood.y * uFanArena;
  // The wave along a grandstand, where it has got to.
  float wave = aMood.w * uFanWave.y * exp(-pow((aMood.z - uFanWave.x) / 2.2, 2.0));
  float go = clamp(max(e, arena * (0.35 + 0.4 * aAct.z)), 0.0, 1.0);
  float hot = smoothstep(0.08, 0.7, go);

  // TURNED TO FOLLOW: the body as far as it goes, the head the rest.
  float glance = 0.32 * sin(t * 0.31 + aAct.y * 9.0) * step(0.55, sin(t * 0.17 + aAct.y * 3.0));
  float rel = length(look) > 1e-5 ? fanWrap(atan(look.x, look.y) - aAct.x) : 0.0;
  float follow = smoothstep(0.03, 0.3, e);
  float turnMax = style > 6.5 ? 1.6 : 1.05;
  float bodyTurn = clamp(rel, -turnMax, turnMax) * follow;
  float headTurn = clamp(rel - bodyTurn, -1.0, 1.0) * follow + glance * (1.0 - follow);
  float nod = 0.05 * sin(t * 1.3) * (1.0 - hot) - 0.12 * follow;

  // AT REST: his habit for his hands, his weight from foot to foot, the
  // cold stamped off now and then.
  float habit = fract(aAct.y * 7.13);
  FanArm restL = fanArm(0.06, 0.12, 0.25);
  if (habit > 0.82) restL = fanArm(-0.15, 0.75, 2.1);
  else if (habit > 0.6) restL = fanArm(0.55, -0.3, 1.95);
  else if (habit > 0.35) restL = fanArm(0.3, 0.02, 1.3);
  FanArm restR = restL;
  if (habit > 0.82) restR = fanArm(0.06, 0.12, 0.25);
  float stamp = fanPulse(t + aAct.y * 13.0, 9.0 + 4.0 * aAct.y, 1.6);
  float clapIdle = fanPulse(t + aAct.y * 29.0, 14.0 + 6.0 * aAct.y, 1.4);
  FanArm clapPose = fanArm(1.1, -0.1 + 0.32 * (0.5 + 0.5 * sin(t * 18.0)), 0.75);
  if (style < 0.5) { restL = fanMix(restL, clapPose, clapIdle); restR = fanMix(restR, clapPose, clapIdle); }
  else if (style < 2.5 && style > 1.5) { restR = fanArm(0.05, 0.14, 0.2 + 0.25 * stamp * sin(t * 30.0)); }
  else if (style < 3.5) { restR = fanArm(0.35, 0.18, 1.35); }
  else if (style < 5.5 && style > 4.5) { restL = fanArm(0.12, -0.05, 0.35); restR = restL; }
  float sway = 0.045 * sin(t * 0.8);

  // LIT UP: what each style does, the arms first.
  float beat = t * 6.2832;
  FanArm hotL = restL;
  FanArm hotR = restR;
  float hop = 0.0;
  float lean = 0.1;
  float roll = 0.0;
  if (style < 0.5) {
    // clap, over the head, quickening with the racer
    float c = 0.5 + 0.5 * sin(beat * mix(2.2, 3.4, e));
    hotL = fanArm(2.0, -0.28 + 0.48 * c, 0.55);
    hotR = hotL;
    hop = 0.03 * abs(sin(beat * 1.6));
  } else if (style < 1.5) {
    // wave both arms
    hotL = fanArm(0.3, 2.45 + 0.4 * sin(beat * 1.5), 0.35 + 0.35 * sin(beat * 1.5 + 1.0));
    hotR = fanArm(0.3, 2.45 + 0.4 * sin(beat * 1.5 + 3.1), 0.35 + 0.35 * sin(beat * 1.5 + 4.1));
  } else if (style < 2.5) {
    // the cowbell, shaken hard over the fence; the other fist pumping
    hotR = fanArm(1.75, 0.35, 0.55 + 0.5 * sin(beat * 5.5));
    hotL = fanArm(0.2, 2.3, 0.7 + 0.6 * sin(beat * 2.0));
    hop = 0.025 * abs(sin(beat * 2.75));
  } else if (style < 3.5) {
    // the flag, swept in great arcs over the head
    float sw = sin(beat * 0.85);
    hotR = fanArm(0.25 + 0.35 * cos(beat * 0.85), 2.5 + 0.6 * sw, 0.15);
    hotL = fanArm(1.0, 0.3, 1.2);
    roll = 0.1 * sw;
  } else if (style < 4.5) {
    // jumping on the spot, both fists going
    hop = 0.26 * max(0.0, sin(beat * 1.7));
    hotL = fanArm(0.4, 2.7, 0.5 + 0.6 * sin(beat * 3.4));
    hotR = fanArm(0.4, 2.7, 0.5 + 0.6 * sin(beat * 3.4 + 1.6));
  } else if (style < 5.5) {
    // the board, up over the head and bounced
    hotL = fanArm(2.75, 0.22, 0.45 + 0.15 * sin(beat * 2.0));
    hotR = hotL;
    hop = 0.05 * abs(sin(beat * 2.0));
    roll = 0.08 * sin(beat * 1.0);
  } else if (style < 6.5) {
    // the horn to his lips, the other arm waving
    hotR = fanArm(1.25, 0.12, 2.15);
    hotL = fanArm(0.3, 2.4 + 0.4 * sin(beat * 1.4), 0.4);
    lean = -0.08;
  } else {
    // the phone held out at the racer
    hotR = fanArm(1.5, -0.12, 0.2);
    lean = 0.06;
  }
  // THE WAVE, where it is: up on his toes with both arms high.
  FanArm upArm = fanArm(0.2, 2.95, 0.1);
  // The arms go up WHOLE: the angle blended straight from hanging to high
  // passes through level, and a fan half lit up — the arena between racers
  // — would hold his arms straight out, a scarecrow. So each fan's arms
  // snap across a threshold of his own: a crowd half lit up is half its
  // fans' arms up and the rest down, and the swing between is a moment.
  float th = 0.3 + 0.35 * fract(aAct.y * 3.71);
  float armsHot = smoothstep(th - 0.06, th + 0.06, hot);
  float armsUp = smoothstep(0.3, 0.45, wave);
  FanArm armL = fanMix(fanMix(restL, hotL, armsHot), upArm, armsUp);
  FanArm armR = fanMix(fanMix(restR, hotR, armsHot), upArm, armsUp);
  hop = hop * hot * lively + 0.12 * wave + 0.015 * arena * max(0.0, sin(beat * 2.0));
  lean = lean * hot + 0.03;
  roll = roll * hot + sway * (1.0 - hot);

  // THE LEGS: the stamp, the weight shifted, tucked a little off the ground.
  float legSwing = 0.2 * stamp * sin(t * 9.0) * (1.0 - hot);
  float tuck = smoothstep(0.05, 0.25, hop) * 0.22;

  vec3 p = pos;
  if (bone < 0.5) {
    // the trunk
  } else if (bone < 2.5) {
    float side = bone < 1.5 ? -1.0 : 1.0;
    vec3 hip = vec3(side * ${REF.hipX.toFixed(3)}, ${REF.hip.toFixed(3)}, 0.0);
    p = fanRx(-(side * legSwing + tuck)) * (p - hip) + hip;
  } else if (bone < 3.5) {
    vec3 neck = vec3(0.0, ${REF.neck.toFixed(3)}, 0.0);
    p = fanRy(headTurn) * (fanRx(nod) * (p - neck)) + neck;
  } else if (bone < 5.5) {
    p = fanPoseArm(p, -1.0, bone > 4.5, armL);
  } else {
    // the flag's cloth flies
    if (aBone.z > 0.0) p += vec3(0.0, ${Math.sin(FLAG.slant).toFixed(3)}, ${Math.cos(FLAG.slant).toFixed(3)}) * sin(t * 11.0 - aBone.z * 6.0) * 0.1 * aBone.z * (0.35 + hot);
    p = fanPoseArm(p, 1.0, bone > 6.5, armR);
  }
  if (bone < 0.5 || bone > 2.5) {
    vec3 hips = vec3(0.0, ${REF.hip.toFixed(3)}, 0.0);
    p = fanRz(roll) * (fanRx(lean) * (p - hips)) + hips;
  }
  // HIS SIZE AND HIS HEADING, and the hop.
  float hs = aLook.x;
  float gs = bone > 2.5 && bone < 3.5 ? 1.0 : aLook.y;
  p *= vec3(hs * gs, hs, hs * gs);
  p = fanRy(aAct.x + bodyTurn) * p;
  p.y += hop * hs;
  fanP = p;
}
`;

/** The material every fan is drawn with: the haze's, the dress picked in
 * the vertex shader and the bones posed. `uniforms` are the material's
 * own — the view writes the clock and the racers into them. */
export type FanUniforms = {
  uFanTime: { value: number };
  uFanSkier: { value: THREE.Vector4[] };
  uFanArena: { value: number };
  uFanWave: { value: THREE.Vector4 };
};

export function fanUniforms(): FanUniforms {
  return {
    uFanTime: { value: 0 },
    uFanSkier: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 0, 0)) },
    uFanArena: { value: 0 },
    uFanWave: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
}

export function fanMaterial(haze: HazeUniforms, u: FanUniforms): THREE.MeshLambertMaterial {
  const material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    flatShading: true,
    // A flag's cloth is one sheet, seen from either side.
    side: THREE.DoubleSide,
  });
  const palette = { value: FAN_PALETTE.map((hex) => new THREE.Color(hex)) };
  return hazeMaterial(material, haze, "spectators", (shader) => {
    // A bank past the DISTANCE row's mist would stand in the sky.
    PAST_THE_WALL(shader);
    Object.assign(shader.uniforms, u, { uFanPalette: palette });
    shader.vertexShader = `${POSE_GLSL}\n${shader.vertexShader}`
      .replace("#include <begin_vertex>", "fanPose(position);\nvec3 transformed = fanP;")
      .replace(
        "#include <color_vertex>",
        `#include <color_vertex>
#ifdef USE_COLOR
  if (aBone.y > 0.5) {
    float k = aBone.y < 1.5 ? aDress.x : aBone.y < 2.5 ? aDress.y : aBone.y < 3.5 ? aDress.z
      : aBone.y < 4.5 ? aDress.w : aBone.y < 5.5 ? aDress2.x : aBone.y < 6.5 ? aDress2.y
      : aBone.y < 7.5 ? aDress2.z : aDress2.w;
    vColor.rgb = uFanPalette[int(k + 0.5)] * color.rgb;
  }
#endif`,
      );
  });
}
