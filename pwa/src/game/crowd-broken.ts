// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// AN AMATEUR RUN INTO AND LEFT LYING (`engine/game/person-hit.ts`), POSED —
// with the INJURIES switch on, the body the player struck lies hurt or
// broken rather than as a fall left it. Three-free, so the suite reads it.
//
// What a body broken by blunt force looks like, restated from the trauma
// and forensic literature in our own words:
//   - a broken THIGH lies SHORTENED and turned OUT: the thigh's big muscles
//     pull the two ends past each other and the foot rolls over onto its
//     outside edge, so the leg lies shorter than the other with its toes
//     pointing away from the body;
//   - a broken SHIN or FOREARM lies bent where no joint is, the part
//     below the break swung off the line of the bone;
//   - a broken NECK lets the head lie at an angle the neck never turns to;
//   - a chest stove in or a pelvis crushed leaves the trunk FLATTER than a
//     living one lies (`flatOf`, drawn by `crowd-view.ts` as the mesh
//     squashed toward the snow under him) — and most blunt trauma bleeds
//     INSIDE: little on the snow unless the skin is torn, so the blood
//     (`crowd-gore.ts`) is a mouth and nose bleeding at a hurt man and a
//     torn body only at a crushed one.
//
// The physics' ragdoll is the reference man's and knows no breaks; here
// each break is a turn of the part below it about its joint, about the
// snow's up (so the part stays on the snow it lies on) and, for the turned
// out foot, about the shin. The breaks are dealt by a hash of the amateur,
// so he lies broken the same every frame and in every replay. A man hurt
// but alive (`injured`) has one leg broken and stirs: one hand drawn to
// his chest and away again, his head lifting off the snow now and then.

import {
  struckPerson,
  type Amateur,
  type FootDown,
  type GameState,
  type StruckPerson,
} from "@engine";

import type { Posed, V3 } from "./crowd-rig.ts";

/** How each break is turned, rad at the full of it. */
export const BROKEN = {
  /** The shin off the knee, either way across the snow. */
  shin: 1.5,
  /** The thigh broken: the knee swung in, the leg drawn up short (a share
   * of the thigh's length) and the foot turned out about the shin. */
  thigh: 0.45,
  short: 0.22,
  footOut: 1.35,
  /** The forearm off the elbow and the arm off the shoulder. */
  forearm: 2.1,
  arm: 1.1,
  /** The head off the neck. */
  neck: 1.15,
  /** Seconds after the blow the breaks have come to their full, s. */
  onset: 0.2,
  /** How much flatter a crushed trunk lies, a share of its thickness. */
  flat: 0.42,
  /** A hurt man stirring: how far his hand comes up, rad, his head lifts,
   * m, and how fast, rad/s. */
  stir: { arm: 0.9, head: 0.07, rate: 0.7 },
} as const;

/** How a struck amateur is hurt, as the view draws it. */
export type Hurt = {
  /** Killed, or hurt past getting up. */
  dead: boolean;
  /** How crushed, 0..1 (`Amateur.crush`). */
  crush: number;
  /** His own number: the breaks are dealt off it. */
  seed: number;
  /** Seconds since he was struck: a hurt man stirs on it. */
  since: number;
  /** Whether his trunk has come down on the snow yet: his skis lie off
   * his boots from then. */
  down: boolean;
};

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** A hash of the amateur and a break's number to 0..1. */
export function brokenHash(seed: number, k: number): number {
  const s = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
const sign = (seed: number, k: number): number => (brokenHash(seed, k) < 0.5 ? -1 : 1);

/** `q` turned by `angle` about the unit `axis` through `pivot` (Rodrigues). */
function turn(q: V3, pivot: V3, axis: V3, angle: number): V3 {
  const v = sub(q, pivot);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const d = axis[0] * v[0] + axis[1] * v[1] + axis[2] * v[2];
  const x = cross(axis, v);
  return add(pivot, [
    v[0] * c + x[0] * s + axis[0] * d * (1 - c),
    v[1] * c + x[1] * s + axis[1] * d * (1 - c),
    v[2] * c + x[2] * s + axis[2] * d * (1 - c),
  ]);
}

type Joint = Exclude<keyof Posed, "skiL" | "skiR">;
const UP: V3 = [0, 1, 0];

/** Every point named (and each ski named, whole) turned about `pivot`. */
function turnPart(
  p: Posed,
  pivot: V3,
  axis: V3,
  angle: number,
  joints: readonly Joint[],
  skis: readonly ("skiL" | "skiR")[] = [],
): void {
  if (Math.abs(angle) < 1e-5) return;
  for (const j of joints) p[j] = turn(p[j], pivot, axis, angle);
  for (const k of skis) {
    const s = p[k];
    p[k] = {
      mid: turn(s.mid, pivot, axis, angle),
      tip: turn(s.tip, pivot, axis, angle),
      tail: turn(s.tail, pivot, axis, angle),
      side: turn(s.side, pivot, axis, angle),
    };
  }
}

/** The way across the bone from `a` to `b` that lifts it off the snow: a
 * turn about it raises the bone's far end. */
function liftAxis(a: V3, b: V3): V3 | null {
  const bone = sub(b, a);
  const x = cross(bone, UP);
  const l = len(x);
  return l < 1e-6 ? null : mul(x, 1 / l);
}

const LEGS = {
  L: { hip: "hipL", knee: "kneeL", ankle: "ankleL", ski: "skiL" },
  R: { hip: "hipR", knee: "kneeR", ankle: "ankleR", ski: "skiR" },
} as const;
const ARMS = {
  L: { shoulder: "shoulderL", elbow: "elbowL", hand: "handL", basket: "basketL" },
  R: { shoulder: "shoulderR", elbow: "elbowR", hand: "handR", basket: "basketR" },
} as const;

/** THE BINDINGS LET GO: a blow that breaks a leg is far past what any
 * binding holds, so his skis lie off his boots — flat on the snow at his
 * lowest joint's height, each a step from its foot at a way of its own —
 * never stood up out of the snow on a leg flung over. */
function releaseSkis(p: Posed, seed: number): void {
  let floor = Infinity;
  for (const k of ["pelvis", "neck", "head", "ankleL", "ankleR", "kneeL", "kneeR"] as const)
    floor = Math.min(floor, p[k][1]);
  for (const [ski, ankle, k] of [
    ["skiL", "ankleL", 20],
    ["skiR", "ankleR", 30],
  ] as const) {
    const s = p[ski];
    const half = len(sub(s.tip, s.mid));
    const back = len(sub(s.tail, s.mid));
    const wide = len(sub(s.side, s.mid));
    const way = brokenHash(seed, k) * Math.PI * 2;
    const off = brokenHash(seed, k + 1) * Math.PI * 2;
    const far = 0.25 + 0.6 * brokenHash(seed, k + 2);
    const f: V3 = [Math.sin(way), 0, Math.cos(way)];
    const r: V3 = [Math.cos(way), 0, -Math.sin(way)];
    const mid: V3 = [p[ankle][0] + Math.sin(off) * far, floor, p[ankle][2] + Math.cos(off) * far];
    p[ski] = {
      mid,
      tip: add(mid, mul(f, half)),
      tail: add(mid, mul(f, -back)),
      side: add(mid, mul(r, wide)),
    };
  }
}

/** How broken he is drawn, 0..1: a dead man at least half, more the more
 * he was crushed; a hurt one a little (one leg). */
export function brokenOf(h: Pick<Hurt, "dead" | "crush">): number {
  return h.dead ? 0.5 + 0.5 * Math.min(1, h.crush * 1.5) : 0.25;
}

/** How flat his trunk lies, a share of his thickness (1 whole). */
export function flatOf(h: Pick<Hurt, "dead" | "crush">): number {
  return h.dead ? 1 - BROKEN.flat * Math.min(1, h.crush) : 1;
}

/**
 * THE BODY BROKEN: the lying pose `p` (in place) with the breaks `h` deals
 * — a shin off its knee and a thigh broken short with its foot turned out,
 * both forearms off their elbows and an arm off its shoulder, the head off
 * the neck — each by `brokenOf` of its full turn. A hurt man has one leg
 * broken and stirs. Returns `p`.
 */
export function breakPose(p: Posed, h: Hurt): Posed {
  broken(p, h);
  if (h.down) releaseSkis(p, h.seed);
  return p;
}

function broken(p: Posed, h: Hurt): void {
  // Broken through the blow's first moments, never in a frame.
  const b = brokenOf(h) * Math.min(1, Math.max(0, h.since / BROKEN.onset));
  const s = h.seed;
  const first = brokenHash(s, 1) < 0.5 ? "L" : "R";
  const other = first === "L" ? "R" : "L";
  // THE LEGS: the first leg's shin swung off its knee across the snow.
  {
    const g = LEGS[first];
    turnPart(
      p,
      p[g.knee],
      UP,
      sign(s, 2) * BROKEN.shin * b * (0.7 + 0.3 * brokenHash(s, 3)),
      [g.ankle],
      [g.ski],
    );
  }
  if (h.dead) {
    // The other thigh broken: drawn up short, the knee in, the foot out.
    const g = LEGS[other];
    const thigh = sub(p[g.knee], p[g.hip]);
    const short = mul(thigh, -BROKEN.short * b);
    for (const j of [g.knee, g.ankle] as const) p[j] = add(p[j], short);
    const s2 = p[g.ski];
    p[g.ski] = {
      mid: add(s2.mid, short),
      tip: add(s2.tip, short),
      tail: add(s2.tail, short),
      side: add(s2.side, short),
    };
    turnPart(p, p[g.hip], UP, sign(s, 4) * BROKEN.thigh * b, [g.knee, g.ankle], [g.ski]);
    const shin = sub(p[g.knee], p[g.ankle]);
    const sl = len(shin);
    if (sl > 1e-6) {
      const out = other === "L" ? -1 : 1;
      turnPart(p, p[g.ankle], mul(shin, 1 / sl), out * BROKEN.footOut * b, [], [g.ski]);
    }
    // THE ARMS: both forearms off their elbows, one arm off its shoulder.
    for (const [side, k] of [
      ["L", 5],
      ["R", 6],
    ] as const) {
      const a = ARMS[side];
      turnPart(
        p,
        p[a.elbow],
        UP,
        sign(s, k) * BROKEN.forearm * b * (0.6 + 0.4 * brokenHash(s, k + 10)),
        [a.hand, a.basket],
      );
    }
    const arm = ARMS[brokenHash(s, 7) < 0.5 ? "L" : "R"];
    turnPart(p, p[arm.shoulder], UP, sign(s, 8) * BROKEN.arm * b, [
      arm.elbow,
      arm.hand,
      arm.basket,
    ]);
    // THE NECK: the head lolled off it.
    turnPart(p, p.neck, UP, sign(s, 9) * BROKEN.neck * b, ["head"]);
    return;
  }
  // ALIVE: one hand drawn up to his chest and away again, the head lifting.
  const w = 0.5 - 0.5 * Math.cos(h.since * BROKEN.stir.rate + brokenHash(s, 11) * 6.28);
  const a = ARMS[brokenHash(s, 12) < 0.5 ? "L" : "R"];
  const axis = liftAxis(p[a.shoulder], p[a.elbow]);
  if (axis) turnPart(p, p[a.shoulder], axis, BROKEN.stir.arm * w, [a.elbow, a.hand, a.basket]);
  const lift = BROKEN.stir.head * Math.max(0, Math.sin(h.since * BROKEN.stir.rate * 0.6 + 1));
  p.head = add(p.head, [0, lift, 0]);
}

/** How a struck amateur is hurt, as drawn — or undefined: whole, or a run
 * without its injuries (where nobody is hurt). */
export function hurtOf(state: GameState, a: Amateur): Hurt | undefined {
  if (!state.gore || (!a.dead && !a.injured)) return undefined;
  const hit = struckPerson(state, a.id);
  if (!hit) return undefined;
  return {
    dead: !!a.dead,
    crush: a.crush ?? 0,
    seed: a.id + 1,
    since: state.t - hit.t,
    down: (a.thrown?.down ?? -1) >= 0,
  };
}

/** How a person on foot the engine struck (`engine/game/foot.ts`) is
 * hurt, as drawn — the amateur's breaks on his own number. */
export function footHurtOf(state: GameState, d: FootDown): Hurt | undefined {
  if (!state.gore || (!d.dead && !d.injured)) return undefined;
  return {
    dead: d.dead,
    crush: d.crush,
    seed: FOOT_SEED + d.key,
    since: state.t - d.hit.t,
    down: d.thrown.down >= 0,
  };
}

/** Past every amateur's number: a person on foot's breaks are his own. */
const FOOT_SEED = 104729;

/** How much of his clothes and skin a struck amateur's blood covers, 0..1
 * (a hurt man's face first, `crowdMaterial`). */
export function bloodOf(h: Hurt | undefined): number {
  if (!h) return 0;
  const run = Math.min(1, h.since / 3);
  return h.dead ? (0.25 + 0.45 * Math.min(1, h.crush * 1.4)) * (0.4 + 0.6 * run) : 0.16 * run;
}

/** A body crushed past this (`Amateur.crush`) is torn open by the blow. */
export const CRUSHED = 0.45;

/** HOW MUCH A STRUCK BODY BLEEDS onto the snow, L in all, and over how long
 * it runs out, s (a share `1 − e^(−t/τ)` of it by `t` after the blow): a
 * hurt man's face a cupful; a dead one's body more the more it was crushed
 * — the most an adult's open wounds shed before the heart stops, a litre
 * or two. */
export function bleedOf(h: Pick<StruckPerson, "killed" | "crush">): {
  litres: number;
  tau: number;
} {
  return h.killed ? { litres: 0.35 + 2.2 * h.crush, tau: 22 } : { litres: 0.12, tau: 35 };
}

/** The litres run out between `t0` and `t1` s after the blow. */
export function bledBetween(
  h: Pick<StruckPerson, "killed" | "crush">,
  t0: number,
  t1: number,
): number {
  const { litres, tau } = bleedOf(h);
  const at = (t: number) => litres * (1 - Math.exp(-Math.max(0, t) / tau));
  return Math.max(0, at(t1) - at(t0));
}
