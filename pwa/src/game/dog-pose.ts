// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A DOG'S SKELETON IN EVERY POSE IT IS DRAWN BETWEEN — stood, the four
// keys of its walk and of its trot, sat, squatted to poop, a hind leg
// lifted either side, squatted to pee, its nose down sniffing, and its tail
// wagged either way — read off its kind's measures (`dog-defs.ts`). The
// dog is built once at each (`dog-shapes.ts`) and drawn at the WEIGHTS
// `dogDials` reads off its pose at a moment (`dog-walk-pose.ts`'s
// `dogAt`), the civilians' way: a gait is its keys blended by where in its
// stride the dog is, a stop a whole-body target eased in and out, the wag
// a tail-only target added over everything.
//
// HOW A DOG STANDS AND GOES (`docs/civilians.md`): the body a loft of
// rings from the chest to the buttock, deep at the chest and tucked up at
// the loin; the fore leg straight under the shoulder with the elbow behind
// it, the hind leg angled with the stifle forward and the hock behind; the
// WALK a four-beat lateral sequence (a hind foot, the fore on its side, the
// other hind, the other fore), each foot on the ground some three fifths of
// a stride; the TROT the diagonal pairs together, less than half the stride
// each; in the SQUAT to poop the hind feet are brought forward and set
// wide, the hind legs folded, the back hunched and the tail raised clear;
// sat, the haunch is on the ground and the fore legs straight; lifting a
// leg, a male swings one hind leg out and up and leans from it.
//
// Three-free and DOM-free, so the suite reads it
// (`tests/dog_figure_test.ts`). The frame is the dog's: x right, y up, z
// the way it faces, the ground under its middle at 0.

import { DOG_GAIT, DOG_SPECS, type DogKind, type DogSpec } from "./dog-defs.ts";
import type { DogPose } from "./dog-walk-pose.ts";

export type V3 = [number, number, number];

/** The poses a dog is built at besides the stance, in the order its morph
 * targets and weights go in. */
export const DOG_POSES = [
  "walk0",
  "walk1",
  "walk2",
  "walk3",
  "trot0",
  "trot1",
  "trot2",
  "trot3",
  "sit",
  "poop",
  "markL",
  "markR",
  "pee",
  "sniff",
  "wagL",
  "wagR",
] as const;
export type DogTarget = (typeof DOG_POSES)[number];

/** A ring of the body: its centre, the way its "up" points (square to the
 * spine), its half height and half width. */
export type Ring = { c: V3; up: V3; hh: number; hw: number };

/** A leg from its top (the shoulder, the hip) through its middle joint
 * (the elbow, the stifle) and its low joint (the wrist, the hock) to the
 * paw. */
export type Leg = { top: V3; mid: V3; low: V3; paw: V3 };

/** A dog's skeleton: the body's rings front to back, the neck from its
 * base to the poll, the head's frame (where the back of the skull is, the
 * way the head points, its up and its right), the four legs (left fore,
 * right fore, left hind, right hind) and the tail from its root. */
export type DogSkel = {
  rings: Ring[];
  neck: [V3, V3];
  head: { at: V3; dir: V3; up: V3; side: V3 };
  legs: [Leg, Leg, Leg, Leg];
  tail: V3[];
};

// --- the little vector algebra ---------------------------------------------

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const norm = (a: V3): V3 => mul(a, 1 / (len(a) || 1));
const lerp = (a: V3, b: V3, f: number): V3 => add(a, mul(sub(b, a), f));
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** `p` turned nose-up by `a` about the x axis through `o`. */
function pitch(p: V3, o: V3, a: number): V3 {
  const y = p[1] - o[1];
  const z = p[2] - o[2];
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [p[0], o[1] + y * c + z * s, o[2] + z * c - y * s];
}

/** The middle joint of a limb of `a` over `b` from `top` to `low`, bent
 * toward `hint`. */
function bend(top: V3, low: V3, a: number, b: number, hint: V3): V3 {
  const span = sub(low, top);
  const d = Math.max(Math.abs(a - b) + 1e-4, Math.min(a + b - 1e-4, len(span)));
  const dir = norm(span);
  const along = (a * a - b * b + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, a * a - along * along));
  const off = norm(sub(hint, mul(dir, dot(hint, dir))));
  return add(add(top, mul(dir, along)), mul(off, h));
}

// --- the body at rest --------------------------------------------------------

/** Where along the body each ring stands (0 the point of the chest, 1 the
 * buttock), and its top, its underline (as shares of the chest's depth
 * over the elbow) and its width (as a share of the widest). */
const RING_AT = [0, 0.12, 0.3, 0.5, 0.7, 0.88, 1];
const RING_TOP = [0.82, 0.97, 1.0, 0.97, 0.97, 0.96, 0.85];
const RING_UNDER = [0.3, 0.05, 0.0, 0.08, 0.24, 0.3, 0.45];
const RING_WIDE = [0.7, 0.95, 1, 0.9, 0.85, 0.92, 0.6];

/** The rest body of a kind: each ring's centre (z), top and underline. */
function restBody(spec: DogSpec): { z: number; top: number; low: number; hw: number }[] {
  const H = spec.height;
  const L = spec.length;
  const yB = H * spec.leg;
  const D = H * spec.chest;
  return RING_AT.map((u, k) => ({
    z: L * (0.5 - u),
    top: H * RING_TOP[k],
    low: yB + D * RING_UNDER[k],
    hw: ((H * spec.width) / 2) * RING_WIDE[k],
  }));
}

/** How a pose lays the body: the front pitched nose-up by `front` about
 * the shoulder, the back half a further `rear` about the middle, the
 * middle arched up by `arch` (a share of the height), and the whole shifted
 * by `shift` (m). */
type Lay = { front: number; rear: number; arch: number; shift: V3 };

/** The body's laying applied to a rest point (or, `dir`, to a direction
 * on its back half). */
function layer(spec: DogSpec, lay: Lay): (p: V3, dir?: boolean) => V3 {
  const L = spec.length;
  const H = spec.height;
  const body = restBody(spec);
  const shoulder: V3 = [0, body[1].low + 0.45 * (body[1].top - body[1].low), body[1].z];
  const mid: V3 = [0, H * 0.75, 0];
  const front = (p: V3): V3 => add(pitch(p, shoulder, lay.front), lay.shift);
  return (p: V3, dir = false): V3 => {
    if (dir) {
      // A direction on the back half (the tail's).
      const o: V3 = [0, 0, 0];
      return norm(pitch(pitch(p, o, lay.rear), o, lay.front));
    }
    const wf = smooth(-0.12 * L, 0.12 * L, p[2]);
    const f = front(p);
    const r = front(pitch(p, mid, lay.rear));
    const out = lerp(r, f, wf);
    out[1] += lay.arch * H * Math.exp(-((p[2] / (0.28 * L)) ** 2));
    return out;
  };
}

/** The lowest the back half reaches under a laying, m. */
function lowestRear(spec: DogSpec, lay: Lay): number {
  const at = layer(spec, lay);
  let low = Infinity;
  for (const r of restBody(spec).slice(4)) {
    low = Math.min(low, at([0, r.low, r.z])[1], at([0, r.top, r.z])[1]);
  }
  return low;
}

/** The pitch (`key`: the rear's further one, or the whole body's about the
 * shoulder) that puts the back half's lowest point at `y`, by halving. */
function rearTo(spec: DogSpec, lay: Lay, y: number, key: "rear" | "front" = "rear"): number {
  let lo = -0.3;
  let hi = 1.5;
  for (let i = 0; i < 30; i++) {
    const m = (lo + hi) / 2;
    if (lowestRear(spec, { ...lay, [key]: m }) > y) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

// --- a pose ------------------------------------------------------------------

/** What a pose asks of the legs, the head and the tail past the body. */
type Ask = {
  lay: Lay;
  /** Each paw, as the leg's rest paw plus this (m), or as a place of its
   * own under its top when `under`. */
  paws: [V3, V3, V3, V3];
  /** The hind legs' hocks on the ground (sat) or up on the toes (squat). */
  hock: "stand" | "flat" | "toes";
  /** A lifted hind leg: which (−1 left, 1 right, 0 none). */
  lift: number;
  /** The neck's pitch past its carriage, and the head's, rad; the head's
   * yaw. */
  neck: number;
  nod: number;
  turn: number;
  /** The tail's angle past its carriage (rad, up positive) and its wag
   * (rad, to the right positive). */
  tailUp: number;
  wag: number;
  /** The tail's root held at least this far up off the level (rad), the
   * body's tilt or no — held clear in a squat. */
  tailHeld?: number;
  /** The nose brought down to this height (m) instead, sniffing. */
  nose?: number;
};

const ZERO: V3 = [0, 0, 0];
const STILL: Ask = {
  lay: { front: 0, rear: 0, arch: 0, shift: ZERO },
  paws: [ZERO, ZERO, ZERO, ZERO],
  hock: "stand",
  lift: 0,
  neck: 0,
  nod: 0,
  turn: 0,
  tailUp: 0,
  wag: 0,
};

/** A foot's place in its cycle at `phase` (0..1), on the ground `duty` of
 * it: how far forward of its rest (as a share of the stride) and how high
 * (as a share of its lift). */
function footAt(phase: number, duty: number): { z: number; y: number } {
  const p = phase - Math.floor(phase);
  if (p < duty) return { z: duty * (0.5 - p / duty), y: 0 };
  const q = (p - duty) / (1 - duty);
  return { z: duty * (-0.5 + q), y: Math.sin(Math.PI * q) };
}

/** THE GAIT'S KEY at `u` of a stride: the walk's lateral sequence or the
 * trot's diagonal pairs. */
function gaitAsk(spec: DogSpec, u: number, trot: boolean): Ask {
  const H = spec.height;
  const stride = H * (trot ? DOG_GAIT.trotStride : DOG_GAIT.walkStride);
  const duty = trot ? 0.45 : 0.62;
  const lift = H * (trot ? 0.16 : 0.12);
  // Left fore, right fore, left hind, right hind.
  const phases = trot ? [0, 0.5, 0.5, 0] : [0.25, 0.75, 0, 0.5];
  const paws = phases.map((ph) => {
    const f = footAt(u - ph, duty);
    return [0, f.y * lift, f.z * stride] as V3;
  }) as Ask["paws"];
  const bob = H * (trot ? 0.015 : 0.01) * Math.cos(4 * Math.PI * u);
  return {
    ...STILL,
    lay: { front: 0, rear: 0, arch: 0, shift: [0, bob, 0] },
    paws,
    neck: trot ? -0.08 : 0,
  };
}

/** WHAT EACH TARGET ASKS of a kind. */
function askOf(spec: DogSpec, target: DogTarget | "stand"): Ask {
  const H = spec.height;
  switch (target) {
    case "stand":
      return STILL;
    case "walk0":
    case "walk1":
    case "walk2":
    case "walk3":
      return gaitAsk(spec, Number(target[4]) / 4, false);
    case "trot0":
    case "trot1":
    case "trot2":
    case "trot3":
      return gaitAsk(spec, Number(target[4]) / 4, true);
    case "sit": {
      // The haunch on the ground, the fore legs straight: the whole body
      // pitched up about the shoulder till its back end sits.
      const lay: Lay = { front: 0, rear: 0, arch: 0, shift: [0, H * 0.03, 0] };
      const a = rearTo(spec, lay, H * 0.07, "front");
      return {
        ...STILL,
        lay: { ...lay, front: a, rear: 0 },
        hock: "flat",
        neck: 0.15 - a * 0.6,
        nod: -0.1,
        tailUp: -0.9,
      };
    }
    case "poop": {
      // THE SQUAT: the back hunched, the hind end let down over hind feet
      // brought forward and set wide, the hocks off the snow, the tail up.
      const lay: Lay = { front: 0.04, rear: 0, arch: 0.13, shift: [0, -H * 0.02, -H * 0.04] };
      const rear = rearTo(spec, lay, H * (spec.leg < 0.4 ? 0.16 : 0.32));
      return {
        ...STILL,
        lay: { ...lay, rear },
        hock: "toes",
        neck: -0.1,
        nod: 0.05,
        turn: 0.25,
        tailUp: 1.1,
        tailHeld: 0.5,
      };
    }
    case "pee": {
      // A female's squat: lower and flatter-backed, the tail out level.
      const lay: Lay = { front: 0.05, rear: 0, arch: 0.01, shift: [0, -H * 0.02, -H * 0.02] };
      const rear = rearTo(spec, lay, H * (spec.leg < 0.4 ? 0.08 : 0.12));
      return { ...STILL, lay: { ...lay, rear }, hock: "toes", tailUp: 0.6, tailHeld: 0.1 };
    }
    case "markL":
    case "markR": {
      // A hind leg swung out and up at whatever is to that side, the dog
      // leaning off it.
      const side = target === "markR" ? 1 : -1;
      return {
        ...STILL,
        lay: { front: 0, rear: 0.04, arch: 0, shift: [-side * H * 0.05, -H * 0.01, 0] },
        lift: side,
        tailUp: 0.25,
        turn: -side * 0.15,
      };
    }
    case "sniff":
      return {
        ...STILL,
        lay: { front: -0.1, rear: 0.12, arch: 0.01, shift: [0, -H * 0.03, 0] },
        nose: H * 0.06,
        nod: -0.55,
        tailUp: 0.2,
      };
    case "wagL":
    case "wagR":
      return { ...STILL, wag: (target === "wagR" ? 1 : -1) * 0.65 };
  }
}

/**
 * THE SKELETON OF A KIND AT A TARGET (or the stance): the body laid, the
 * legs bent to their paws, the neck and head carried, the tail out.
 */
export function dogSkel(kind: DogKind, target: DogTarget | "stand"): DogSkel {
  const spec = DOG_SPECS[kind];
  const ask = askOf(spec, target);
  const H = spec.height;
  const L = spec.length;
  const at = layer(spec, ask.lay);
  const body = restBody(spec);
  const rings: Ring[] = body.map((r) => {
    const c = at([0, (r.top + r.low) / 2, r.z]);
    const above = at([0, r.top, r.z]);
    return { c, up: norm(sub(above, c)), hh: (r.top - r.low) / 2, hw: r.hw };
  });

  // THE LEGS. Their tops on the body, their paws under them at rest.
  const fore = body[1];
  const hind = body[5];
  const foreTop = (s: number): V3 => [
    s * fore.hw * 0.6,
    fore.low + 0.45 * (fore.top - fore.low),
    fore.z,
  ];
  const hindTop = (s: number): V3 => [
    s * hind.hw * 0.62,
    hind.low + 0.6 * (hind.top - hind.low),
    hind.z,
  ];
  const foreLen = foreTop(1)[1];
  const hindLen = hindTop(1)[1];
  const pastern = 0.15 * foreLen;
  const hock = 0.3 * hindLen;
  const legs = ([-1, 1, -1, 1] as const).map((s, i) => {
    const front = i < 2;
    const restTop = front ? foreTop(s) : hindTop(s);
    const top = at(restTop);
    const restPaw: V3 = front
      ? [s * fore.hw * 0.5, 0, fore.z + 0.02 * H]
      : [s * hind.hw * 0.52, 0, hind.z - 0.05 * H];
    let paw = add(restPaw, ask.paws[i]);
    let low: V3;
    const up = front ? pastern : hock;
    const seg = front ? (foreLen - pastern) * 0.52 : (hindLen - hock) * 0.56;
    if (front) {
      // Under its shoulder wherever the body is laid.
      if (target === "sit" || target === "poop" || target === "pee" || target === "sniff") {
        paw = [restPaw[0], 0, top[2] + 0.03 * H];
      }
      low = add(paw, [0, up, -0.02 * H]);
      const mid = bend(top, low, seg, seg, [0, 0, -1]);
      return { top, mid, low, paw };
    }
    if (ask.hock === "flat") {
      // Sat: the hind foot forward under the haunch, the hock on the snow.
      paw = [s * hind.hw * 0.75, 0, top[2] + 0.45 * (at(foreTop(s))[2] - top[2])];
      low = add(paw, [0, 0.03 * H, -up]);
    } else if (ask.hock === "toes") {
      // Squatted: the hind feet forward of the hips and wide.
      paw = [s * hind.hw * 1.15, 0, top[2] + 0.18 * L];
      low = add(paw, [0, up * 0.75, -up * 0.62]);
    } else if (ask.lift === s) {
      // Lifted out to the side and up.
      paw = [s * (hind.hw + 0.38 * H), 0.42 * H, top[2] - 0.05 * H];
      low = add(paw, [-s * up * 0.7, up * 0.3, -up * 0.5]);
    } else {
      low = add(paw, [0, up, -0.12 * up]);
    }
    const mid = bend(top, low, seg, seg * 1.05, [0, 0, 1]);
    return { top, mid, low, paw };
  }) as DogSkel["legs"];

  // THE NECK, from the top of the chest up at its carriage.
  const b0 = body[0];
  const base = at([0, b0.low + 0.68 * (b0.top - b0.low), b0.z - 0.02 * H]);
  const frontPitch = ask.lay.front;
  const neckAt = (extra: number): V3 => {
    const a = 0.35 + spec.carriage * 0.9 + frontPitch + extra;
    return add(base, [0, spec.neck * Math.sin(a), spec.neck * Math.cos(a)]);
  };
  // The head's way: pitched (nose down negative), turned.
  const headDir = (nod: number): V3 => {
    const b = -0.3 + nod;
    return [Math.cos(b) * Math.sin(ask.turn), Math.sin(b), Math.cos(b) * Math.cos(ask.turn)];
  };
  let neckExtra = ask.neck;
  if (ask.nose !== undefined) {
    // Brought down till the nose is at the snow, by halving.
    let lo = -2.2;
    let hi = 0.3;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      const nose = add(neckAt(m), mul(headDir(ask.nod), spec.head * 0.92))[1];
      if (nose > ask.nose) hi = m;
      else lo = m;
    }
    neckExtra = (lo + hi) / 2;
  }
  const poll = neckAt(neckExtra);
  const dir = norm(headDir(ask.nod));
  const side = norm(cross([0, 1, 0], dir));
  const right: V3 = [-side[0], -side[1], -side[2]];
  const headUp = norm(cross(dir, right));
  const head = { at: sub(poll, mul(dir, spec.head * 0.08)), dir, up: headUp, side: right };

  // THE TAIL, out of the croup at its carriage, curling along its length.
  const b6 = body[6];
  const root = at([0, b6.top - 0.06 * H, b6.z]);
  const tail: V3[] = [root];
  const bodyDir = at([0, 0, -1], true);
  const bodyTilt = Math.atan2(bodyDir[1], -bodyDir[2]);
  const n = 4;
  for (let k = 0; k < n; k++) {
    const held = Math.max(spec.carried + ask.tailUp + bodyTilt, ask.tailHeld ?? -Infinity);
    const alpha = held + spec.curl * (k / (n - 1)) * 0.9;
    const psi = ask.wag * ((k + 1) / n);
    const step: V3 = [
      Math.cos(alpha) * Math.sin(psi),
      Math.sin(alpha),
      -Math.cos(alpha) * Math.cos(psi),
    ];
    const next = add(tail[k], mul(step, spec.tail / n));
    // Never through the snow: a sat dog's tail lies along it.
    next[1] = Math.max(next[1], 0.025 * H);
    tail.push(next);
  }
  return { rings, neck: [base, poll], head, legs, tail };
}

/** Where the lead clips on, in the dog's frame: the collar's ring at the
 * back of the neck. */
export function collarOf(s: DogSkel): V3 {
  return lerp(s.neck[0], s.neck[1], 0.4);
}

const ease = (u: number): number => smooth(0, 1, u);

/** A cycle of `keys` at `u` of the way round, `w` of the weight. */
function cycle(out: Float32Array, at: number, u: number, w: number): void {
  const x = (u - Math.floor(u)) * 4;
  const k = Math.floor(x) % 4;
  const f = x - Math.floor(x);
  out[at + k] += (1 - f) * w;
  out[at + ((k + 1) % 4)] += f * w;
}

const AT = Object.fromEntries(DOG_POSES.map((p, i) => [p, i])) as Record<DogTarget, number>;

/**
 * THE WEIGHTS a dog is drawn at, one a target in `DOG_POSES`' order, into
 * `out`: its gait off its stride, a stop eased in and out, and the tail
 * wagged on the run's clock `t` (its own phase off `id`) — hardest stood
 * about, never in the squat or with a leg up.
 */
export function dogDials(p: DogPose, t: number, id: number, out: Float32Array): void {
  out.fill(0);
  const u = p.span > 0 ? Math.max(0, p.clock) : 0;
  // In over a while and out over the stop's end.
  const inOut = (rise: number, fall: number): number =>
    ease(u / rise) * (p.span > 0 ? 1 - ease((u - (p.span - fall)) / fall) : 1);
  let wag = 0.6;
  switch (p.act) {
    case "walk": {
      // Faded in from a stand as it gets going.
      const go = smooth(0.05, 0.45, p.speed);
      cycle(out, AT.walk0, p.stride, go * (1 - p.trot));
      cycle(out, AT.trot0, p.stride, go * p.trot);
      wag = 0.45;
      break;
    }
    case "sit":
      out[AT.sit] += inOut(0.6, 0.4);
      wag = 0.35;
      break;
    case "poop":
      out[AT.poop] += inOut(0.9, 0.7);
      wag = 0;
      break;
    case "pee":
      out[AT.pee] += inOut(0.6, 0.5);
      wag = 0;
      break;
    case "mark":
      out[p.lift > 0 ? AT.markR : AT.markL] += inOut(0.5, 0.45);
      wag = 0.1;
      break;
    case "sniff":
      out[AT.sniff] += inOut(0.5, 0.5);
      wag = 0.75;
      break;
    default:
      wag = 0.8;
  }
  const s = Math.sin(2 * Math.PI * DOG_GAIT.wag.rate * t + id * 1.7) * wag;
  out[AT.wagR] += Math.max(0, s);
  out[AT.wagL] += Math.max(0, -s);
}

/**
 * A LEAD HUNG from the hand to the collar: `n` points along it, sagging as
 * deep as its slack lets it (a shallow arc of span d and depth f is about
 * d + 8f²/3d long — a lead `length` m over a span d sags √(3d·slack/8)),
 * straight where the dog has it taut, and never through the snow at
 * `floor`. Into `out` (refilled), in whatever frame the two ends are.
 */
export function leadCurve(
  hand: V3,
  collar: V3,
  length: number,
  floor: number,
  n: number,
  out: V3[] = [],
): V3[] {
  const d = len(sub(collar, hand));
  const slack = Math.max(0, length - d);
  const sag = Math.min(length * 0.45, Math.sqrt((3 * d * slack) / 8));
  out.length = n;
  for (let k = 0; k < n; k++) {
    const f = k / (n - 1);
    const p = (out[k] ??= [0, 0, 0]);
    p[0] = hand[0] + (collar[0] - hand[0]) * f;
    p[2] = hand[2] + (collar[2] - hand[2]) * f;
    p[1] = Math.max(floor + 0.012, hand[1] + (collar[1] - hand[1]) * f - 4 * sag * f * (1 - f));
  }
  return out;
}
