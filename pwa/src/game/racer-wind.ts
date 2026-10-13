// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR AND THE SWING ON THE MODELLED RACER (`racer-model.ts`), three-free:
// the numbers his bib and suit answer the air with, how free each point of
// them is, the clock they move on and the bib's SWING — the one spring a
// dressed racer carries.
//
// What a race suit really does at speed, off the finish-area and on-course
// footage the model was built from: the suit is printed stretch fabric
// pulled tight, so it never billows — but where it is not stretched (the
// back of the upper arm, the crook of the elbow and the knee, under the
// arms, across the small of the back and the seat) it SHIVERS: fine
// wrinkles race downstream over the lee side, which a gloss print shows as
// light running over him far more than as any shape. The bib is a loose
// tabard open at the sides, tied only at the shoulders: its hem and its
// open sides lift off and stream back and FLAP, and it is thrown about by
// what he does — slapped down onto his chest on a landing, swung out to the
// side round a turn, draped forward off his chest in the tuck.
//
// Everything here moves on the RUN'S CLOCK when the renderer hands it one
// (`setRacerClock`), so a slow replay slows the cloth, a held frame holds
// it and the stepped labs show it; with no run on (the rider card) it falls
// back to the wall clock.

import type { BoneFrame, SkierBone } from "./skier-rig.ts";

type V3 = { x: number; y: number; z: number };

/** THE WIND'S NUMBERS: how the bib and the suit answer the air. */
export const RACER_WIND = {
  /** The airflow, m/s, at which the bib streams fully back. */
  full: 22,
  /** How far its hem streams back at full stream, m, and flaps off the
   * suit along its normal. */
  stream: 0.075,
  flutter: 0.03,
  /** The flap's beat, rad/s, at rest and gained per m/s of air. */
  beat: 9,
  beatPerMs: 0.55,
  /** THE SUIT'S SHIVER: the air, m/s, it starts at and is whole by; its
   * wrinkles' depth, m, their length down the flow, m, and how far they tip
   * the surface's normal (the light running over the gloss) per unit of
   * slope; their beat, rad/s, at rest and per m/s. */
  shiverFrom: 7,
  shiverFull: 30,
  shiver: 0.0032,
  wrinkle: 0.055,
  sheen: 1.6,
  shiverBeat: 26,
  shiverBeatPerMs: 1.4,
  /** How quickly the airflow and the push read off his motion settle, 1/s. */
  settle: 6,
  push: 14,
} as const;

/** THE BIB'S SWING: a damped spring a dressed racer carries, his push on
 * it the bib's lag (Hz, the share of critical damping, the most it
 * strays, m). */
export const RACER_SWING = { hz: 2.1, zeta: 0.22, most: 0.07, g: 9.81 } as const;

// ------------------------------------------------------------------ clock

let clock: { t: number; at: number } | null = null;

/** The run's clock, s, as the renderer draws the run (between two steps):
 * the racer's cloth moves on it while it is handed one. */
export function setRacerClock(t: number, wallMs = Date.now()): void {
  clock = { t, at: wallMs };
}

/** The time the cloth moves at, s: the run's while a run hands it one (in
 * the last half second of wall time), the wall's when none is on. */
export function racerTime(wallMs = Date.now()): number {
  if (clock && wallMs - clock.at < 500) return clock.t;
  return wallMs / 1000;
}

// --------------------------------------------------------------- freedom

const smoothstep = (t: number): number => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a: V3): number => Math.sqrt(dot(a, a));
const tip = (f: BoneFrame): V3 => ({
  x: f.head.x + f.y.x * f.length,
  y: f.head.y + f.y.y * f.length,
  z: f.head.z + f.y.z * f.length,
});

/** HOW FREE A POINT OF THE BIB IS (0 pinned, 1 its loose hem's corner):
 * the bib hangs off his shoulders and lies on his chest and back, so it is
 * held at the top and free toward its hem, freest at its open sides. */
export function bibFreedom(p: V3, chest: BoneFrame, pelvis: BoneFrame): number {
  const top = chest.head.y + chest.y.y * chest.length * 0.75;
  const hem = pelvis.head.y + 0.02;
  const down = smoothstep((top - p.y) / Math.max(0.1, top - hem));
  const across = Math.min(1, Math.abs(p.x) / 0.16);
  return down ** 1.4 * (0.55 + 0.45 * across * across);
}

/** How far `p` is off a bone's line, and how far along it (0..1). */
function offLine(p: V3, f: BoneFrame): { d: number; t: number } {
  const r = sub(p, f.head);
  const t = Math.min(1, Math.max(0, dot(r, f.y) / f.length));
  const foot = {
    x: f.head.x + f.y.x * f.length * t,
    y: f.head.y + f.y.y * f.length * t,
    z: f.head.z + f.y.z * f.length * t,
  };
  return { d: len(sub(p, foot)), t };
}

/** THE SUIT'S SLACK at a point (0 drawn tight, 1 as loose as it lies): what
 * shivers in the air. The arms more than the legs, the crooks of the elbows
 * and the knees, the armpits and the small of the back most; the shins
 * under their guards and the collar least. */
export function suitFreedom(p: V3, frames: Record<SkierBone, BoneFrame>): number {
  const BASE: [SkierBone, number][] = [
    ["chest", 0.2],
    ["pelvis", 0.3],
    ["upperarm_l", 0.6],
    ["upperarm_r", 0.6],
    ["forearm_l", 0.4],
    ["forearm_r", 0.4],
    ["thigh_l", 0.35],
    ["thigh_r", 0.35],
    ["shin_l", 0.06],
    ["shin_r", 0.06],
  ];
  let best = Infinity;
  let base = 0;
  for (const [bone, b] of BASE) {
    const { d } = offLine(p, frames[bone]);
    if (d < best) {
      best = d;
      base = b;
    }
  }
  // The crooks, where the fabric gathers.
  const joints: V3[] = [];
  for (const s of ["l", "r"] as const) {
    joints.push(
      tip(frames[`upperarm_${s}`]),
      tip(frames[`thigh_${s}`]),
      frames[`upperarm_${s}`].head,
    );
  }
  let crook = 0;
  for (const j of joints) {
    const d = len(sub(p, j));
    crook = Math.max(crook, Math.exp(-((d / 0.075) ** 2)));
  }
  // The small of the back: behind the trunk, low.
  const pel = frames.pelvis;
  const r = sub(p, pel.head);
  const behind = -dot(r, frames.chest.z);
  const low = Math.exp(-(((dot(r, frames.chest.y) - 0.12) / 0.09) ** 2));
  const back = behind > 0.05 ? low * 0.75 : 0;
  // Nothing above the collar's foot: the helmet's rim holds it.
  const neck = tip(frames.chest);
  const collar = smoothstep((neck.y - p.y) / 0.06);
  return Math.min(1, Math.max(base, crook * 0.9, back)) * collar;
}

// ----------------------------------------------------------------- swing

/** The bib's spring: its offset, m, and how fast it is moving, in the frame
 * the chest was bound in. */
export type Swing = {
  readonly at: V3;
  /** Push the spring on by `dt` s under the specific force `f` (his
   * acceleration less gravity, m/s², in the chest's bind frame) — the
   * force at rest, standing, `rest`. Steps of 1/120 s. */
  step(f: V3, rest: V3, dt: number): void;
  /** Lay it at rest (a reset, a cut, a restart). */
  settle(): void;
};

export function createSwing(): Swing {
  const at = { x: 0, y: 0, z: 0 };
  const v = { x: 0, y: 0, z: 0 };
  const w = 2 * Math.PI * RACER_SWING.hz;
  const c = 2 * RACER_SWING.zeta * w;
  return {
    at,
    step(f, rest, dt) {
      const n = Math.min(30, Math.max(1, Math.ceil(dt * 120)));
      const h = dt / n;
      for (let i = 0; i < n; i++) {
        for (const k of ["x", "y", "z"] as const) {
          // The cloth keeps on as he changes speed: it is pushed against the
          // change of the force he feels from the force he feels at rest.
          const a = -w * w * at[k] - c * v[k] - (f[k] - rest[k]);
          v[k] += a * h;
          at[k] += v[k] * h;
        }
        const m = len(at);
        if (m > RACER_SWING.most) {
          const k = RACER_SWING.most / m;
          at.x *= k;
          at.y *= k;
          at.z *= k;
          v.x *= 0.5;
          v.y *= 0.5;
          v.z *= 0.5;
        }
      }
    },
    settle() {
      at.x = at.y = at.z = 0;
      v.x = v.y = v.z = 0;
    },
  };
}
