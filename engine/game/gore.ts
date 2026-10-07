// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MORTAL WOUNDS — what a run that asked for them (`GameState.gore`,
// the INJURIES switch's) does with a blow past what a body survives. Every
// other run never reaches this file, so nothing here moves a digest.
//
// IT READS WHAT `body.ts` HAS JUST JUDGED: this step's blunt dose on every
// part (`doseOn`), the injuries he carries and their severity score — no
// blow is measured twice. Past the far end of a part's ladder (`GORE`):
//   - A PIECE TORN OFF — the head at the neck, an arm at the shoulder or
//     the forearm at the elbow, a leg at the hip or the shin at the knee.
//     The engine keeps where it tore and how it was going (`TornPiece`);
//     the drawing flies it, and the body it left goes on whole underneath —
//     the ragdoll's points are the physics', the figure only hides the
//     limb (`gore-view.ts`);
//   - THE SKULL CRUSHED, THE TRUNK OPENED (the chest stove in, the belly
//     burst);
//   - RUN THROUGH: a point of the body thrown down onto a tree's top or a
//     thin post's, held there (`Thrown.pin`) and slid on down it, the rest
//     of him hanging off it;
//   - MORTAL: any of those, an injury of AIS 5, a severity score of 50, a
//     body engulfed in a wreck's fire (the airway burnt) or the grimbear's
//     catch. A mortal wound is never stood back up (`holdsHim`): he dies —
//     at once of the head, the skull, the spike through the trunk or the
//     chest opened; of the rest when the blood that kills is gone or he has
//     lain still a moment — and the run is the app's to end.
// THE HEART beats on through it (`GoreState.beats`, `.rate`, `.pulse`):
// what pumps the blood out of an artery in spurts, and stops at death.
//
// Nothing here draws from `state.rng`: a piece's dose is spread off a hash
// of the map and the piece.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { hash2 } from "@niclaslindstedt/oss-game-framework/core/noise";
import { GORE, INSTANT } from "./defs/gore.ts";
import { TUNING } from "./defs/tuning.ts";
import { doseOn, severityOf } from "./body.ts";
import { throwRider } from "./crash.ts";
import { RAGDOLL } from "./ragdoll.ts";
import { solidsNear, solidsOf } from "./posts.ts";
import {
  GORE_OPEN,
  GORE_PIECES,
  type DeathCause,
  type GoreOpen,
  type GorePiece,
  type GoreState,
} from "./gore-state.ts";
import type { BodyPart } from "./defs/anatomy.ts";
import type { GameEvent, GameState, Thrown } from "./state.ts";

const dt = TUNING.dt;
const R = RAGDOLL;
const SALT = 0x90e5a17;

/** What tears each piece off: the part whose dose does it, its dose's row
 * in `GORE.sever`, the ragdoll point it tears at (−1: between the
 * shoulders) and the points it takes with it. */
const TEAR: Record<
  GorePiece,
  { part: BodyPart; row: keyof typeof GORE.sever; at: number; takes: number[] }
> = {
  head: { part: "neck", row: "head", at: -1, takes: [R.head] },
  armL: { part: "armL", row: "arm", at: R.shoulderL, takes: [R.elbowL, R.handL] },
  armR: { part: "armR", row: "arm", at: R.shoulderR, takes: [R.elbowR, R.handR] },
  forearmL: { part: "handL", row: "forearm", at: R.elbowL, takes: [R.handL] },
  forearmR: { part: "handR", row: "forearm", at: R.elbowR, takes: [R.handR] },
  legL: { part: "thighL", row: "leg", at: R.hipL, takes: [R.kneeL, R.footL] },
  legR: { part: "thighR", row: "leg", at: R.hipR, takes: [R.kneeR, R.footR] },
  shinL: { part: "kneeL", row: "shin", at: R.kneeL, takes: [R.footL] },
  shinR: { part: "kneeR", row: "shin", at: R.kneeR, takes: [R.footR] },
  lower: {
    part: "abdomen",
    row: "waist",
    at: -2,
    takes: [R.hipL, R.hipR, R.kneeL, R.kneeR, R.footL, R.footR],
  },
};

/** A piece that takes another with it: a whole arm the forearm, a leg the
 * shin. */
const WITH: Partial<Record<GorePiece, GorePiece>> = {
  armL: "forearmL",
  armR: "forearmR",
  legL: "shinL",
  legR: "shinR",
};

/** Torn in two, the legs go with the hips. */
const LOWER = ["legL", "legR", "shinL", "shinR", "lower"] as const;

const bit = (piece: GorePiece): number => 1 << GORE_PIECES.indexOf(piece);

/** The dose that tears `piece` off on this map: its row, spread off a hash. */
function tearDose(state: GameState, piece: GorePiece): number {
  const u = hash2(GORE_PIECES.indexOf(piece), state.seed | 0, SALT);
  return GORE.sever[TEAR[piece].row] * (1 + GORE.spread * (2 * u - 1));
}

/** Whether a mortal wound holds him where he lies: never stood back up,
 * by a press or by the reset — the run is the app's to end. */
export function holdsHim(state: GameState): boolean {
  return (state.gore?.mortal ?? -1) >= 0;
}

/** Whether he is dead. */
export function isDead(state: GameState): boolean {
  return (state.gore?.dead ?? -1) >= 0;
}

/** A point of the ragdoll, the middle of the shoulders (−1) or the waist
 * (−2). */
function pointOf(b: Thrown, i: number): { x: number; y: number; z: number } {
  const P = b.points;
  if (i === -2) return hipsOf(b);
  if (i >= 0) return { x: P[3 * i], y: P[3 * i + 1], z: P[3 * i + 2] };
  const l = 3 * R.shoulderL;
  const r = 3 * R.shoulderR;
  return { x: (P[l] + P[r]) / 2, y: (P[l + 1] + P[r + 1]) / 2, z: (P[l + 2] + P[r + 2]) / 2 };
}

/** The velocity of the points `takes`, averaged, m/s. */
function velocityOf(b: Thrown, takes: readonly number[]): { x: number; y: number; z: number } {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const i of takes) {
    x += (b.points[3 * i] - b.last[3 * i]) / dt;
    y += (b.points[3 * i + 1] - b.last[3 * i + 1]) / dt;
    z += (b.points[3 * i + 2] - b.last[3 * i + 2]) / dt;
  }
  const n = takes.length;
  return { x: x / n, y: y / n, z: z / n };
}

/** THE STEP'S WOUNDS, after `stepBody` has judged its blows — the
 * player's own, on a run that asked for them. */
export function stepGore(state: GameState, events: GameEvent[]): void {
  const g = state.gore;
  if (!g) return;
  pending = null;
  if (g.dead < 0) {
    wound(state, g, events);
    impale(state, g, events);
    mortality(state, g, events);
  } else if (state.skier.thrown?.pin) slide(state, g, state.skier.thrown);
  heart(state, g);
}

/** The pieces torn off, the skull, the trunk opened. */
function wound(state: GameState, g: GoreState, events: GameEvent[]): void {
  const tear: GorePiece[] = [];
  for (const piece of GORE_PIECES) {
    if (g.lost & bit(piece)) continue;
    if (doseOn(TEAR[piece].part) >= tearDose(state, piece)) tear.push(piece);
  }
  let crush = doseOn("head") >= GORE.crush && !(g.lost & bit("head")) && g.crushed < 0;
  // The head comes off or is crushed, never both.
  if (tear.includes("head")) crush = false;
  const open: GoreOpen[] = [];
  for (let k = 0; k < GORE_OPEN.length; k++) {
    const part = GORE_OPEN[k];
    if (!(g.open & (1 << k)) && doseOn(part) >= GORE.open[part]) open.push(part);
  }
  // THE GRIMBEAR'S CATCH: the body torn in two in his arms.
  const off0 = state.skier.thrown;
  if (off0?.cause === "maul" && g.mortal < 0 && !(g.lost & bit("lower"))) tear.push("lower");
  if (!tear.length && !crush && !open.length) return;
  // Torn apart on his skis, he is off them now.
  const c = state.skier;
  const off = off0 ?? throwRider(state, "tree", { x: c.vx, y: c.vy, z: c.vz }, events);
  for (const piece of tear) {
    const with_ = WITH[piece];
    // A whole limb gone takes the lower half with it; the lower half
    // already gone leaves the upper to tear on its own.
    g.lost |= bit(piece) | (with_ ? bit(with_) : 0);
    if (piece === "lower") for (const p of LOWER) g.lost |= bit(p);
    const T = TEAR[piece];
    const at = pointOf(off, T.at);
    const v = velocityOf(off, T.takes);
    g.torn.push({ piece, t: state.t, ...at, vx: v.x, vy: v.y, vz: v.z });
    events.push({ kind: "gore", t: state.t, what: "torn", piece, ...at });
    mortalBy(
      state,
      g,
      piece === "head"
        ? "head"
        : piece !== "lower"
          ? "bled"
          : off.cause === "maul"
            ? "maul"
            : "torn",
    );
  }
  if (crush) {
    g.crushed = state.t;
    events.push({ kind: "gore", t: state.t, what: "crush", ...pointOf(off, R.head) });
    mortalBy(state, g, "crush");
  }
  for (const part of open) {
    g.open |= 1 << GORE_OPEN.indexOf(part);
    const at = part === "chest" ? pointOf(off, -1) : hipsOf(off);
    events.push({ kind: "gore", t: state.t, what: "open", piece: part, ...at });
    mortalBy(state, g, part === "chest" ? "opened" : "bled");
  }
}

function hipsOf(b: Thrown): { x: number; y: number; z: number } {
  const l = pointOf(b, R.hipL);
  const r = pointOf(b, R.hipR);
  const s = pointOf(b, -1);
  return {
    x: (l.x + r.x) * 0.35 + s.x * 0.3,
    y: (l.y + r.y) * 0.35 + s.y * 0.3,
    z: (l.z + r.z) * 0.35 + s.z * 0.3,
  };
}

/** The cause a death would be, kept at its worst: an instant one over one
 * that waits. */
let pending: DeathCause | null = null;
function mortalBy(state: GameState, g: GoreState, cause: DeathCause): void {
  if (g.mortal < 0) g.mortal = state.t;
  if (g.cause === null || (INSTANT.includes(cause) && !INSTANT.includes(g.cause))) {
    g.cause = cause;
  }
  if (INSTANT.includes(cause)) pending = cause;
}

const near: number[] = [];

/** RUN THROUGH: a body thrown down onto a spike's tip. */
function impale(state: GameState, g: GoreState, events: GameEvent[]): void {
  const b = state.skier.thrown;
  if (!b || g.impaled) return;
  const I = GORE.impale;
  const level = state.level;
  const P = b.points;
  solidsNear(level, b.x, b.z, 3, near);
  if (!near.length) return;
  const solids = solidsOf(level);
  const trees = level.trees.length;
  for (let i = 0; i < R.count; i++) {
    const j = 3 * i;
    // The step's own way down: `last` is where the point was a step ago.
    const vy = (P[j + 1] - b.last[j + 1]) / dt;
    if (vy > -I.speed) continue;
    for (const k of near) {
      const s = solids[k];
      const tree = k < trees;
      if (!tree && (s.stuff !== "steel" || s.radius > I.post)) continue;
      const top = s.y + s.height;
      // Come down onto the tip this step — from over it, inside its reach
      // where he was (the trunk under it has since pushed him aside).
      const L = b.last;
      const dy = P[j + 1] - top;
      if (L[j + 1] - top < -I.below || dy > I.above || dy < -I.below) continue;
      if (hypot(L[j] - s.x, L[j + 2] - s.z) > I.reach) continue;
      g.impaled = {
        x: s.x,
        y: top,
        z: s.z,
        radius: tree ? Math.min(0.06, s.radius) : s.radius,
        stuff: tree ? "tree" : "post",
        point: i,
        sunk: Math.max(0, -dy),
        t: state.t,
      };
      b.pin = { point: i, x: s.x, y: top - g.impaled.sunk, z: s.z };
      events.push({ kind: "gore", t: state.t, what: "impaled", x: s.x, y: top, z: s.z });
      // Through the trunk or the head, at once; a limb, slowly.
      mortalBy(state, g, i <= R.head ? "impaled" : "bled");
      return;
    }
  }
}

/** On the spike, slid on down it under his weight until it holds him. */
function slide(_state: GameState, g: GoreState, b: Thrown): void {
  const at = g.impaled;
  if (!at || !b.pin) return;
  const I = GORE.impale;
  at.sunk = Math.min(I.sink, at.sunk + dt * Math.max(0.15, 2.2 * (1 - at.sunk / I.sink)));
  b.pin.y = at.y - at.sunk;
}

/** Mortal, and dead. */
function mortality(state: GameState, g: GoreState, events: GameEvent[]): void {
  const body = state.skier.body;
  if (g.mortal < 0) {
    if (body.injuries.some((h) => h.ais >= GORE.mortalAis)) mortalBy(state, g, "trauma");
    else if (severityOf(body) >= GORE.mortalIss) mortalBy(state, g, "trauma");
    else if (body.injuries.some((h) => h.kind === "airwayBurn")) mortalBy(state, g, "fire");
    else if (state.skier.thrown?.cause === "maul") mortalBy(state, g, "maul");
  }
  if (g.mortal < 0) return;
  // Mortally hurt on his skis, he goes down.
  const c = state.skier;
  const b = c.thrown ?? throwRider(state, "landing", { x: c.vx, y: c.vy, z: c.vz }, events);
  if (b.pin) slide(state, g, b);
  const bled = g.blood >= GORE.blood.volume * GORE.blood.fatal;
  const lain = b.still >= GORE.still;
  const now =
    pending !== null || bled || state.t - g.mortal >= GORE.last || (lain && state.t > g.mortal);
  const cause = pending ?? (bled ? "bled" : (g.cause ?? "trauma"));
  pending = null;
  if (!now) return;
  g.dead = state.t;
  g.cause = cause;
  events.push({ kind: "death", t: state.t, cause });
}

/** The litres a second every wound bleeds at the full pressure. */
function flowOf(g: GoreState): number {
  const F = GORE.blood.flow;
  let q = 0;
  for (const piece of GORE_PIECES) {
    if (!(g.lost & bit(piece))) continue;
    // A forearm gone inside a whole arm gone bleeds as the arm.
    if ((piece === "forearmL" && g.lost & bit("armL")) || (piece === "forearmR" && g.lost & bit("armR")))
      continue;
    if ((piece === "shinL" && g.lost & bit("legL")) || (piece === "shinR" && g.lost & bit("legR")))
      continue;
    // Torn in two, the legs' own arteries went with the hips.
    if (g.lost & bit("lower") && piece !== "lower" && (LOWER as readonly string[]).includes(piece))
      continue;
    q += F[TEAR[piece].row];
  }
  for (let k = 0; k < GORE_OPEN.length; k++) if (g.open & (1 << k)) q += F[GORE_OPEN[k]];
  if (g.impaled) q += F.impaled;
  if (g.crushed >= 0) q += F.crush;
  return q;
}

/** THE HEART: racing as the blood goes, pumping it out in spurts, and
 * stopped at death — the wounds then only drain. */
function heart(state: GameState, g: GoreState): void {
  const q = flowOf(g);
  if (q <= 0 && g.mortal < 0) return;
  const V = GORE.blood.volume;
  const lost = Math.min(1, g.blood / (V * GORE.blood.fatal));
  const H = GORE.heart;
  // Dead, the heart beats on a few seconds — the agonal beats, slowing and
  // weakening — and then stops.
  const after = g.dead < 0 ? 0 : (state.t - g.dead) / H.agonal;
  if (after < 1) {
    g.rate = (H.first + (H.shock - H.first) * lost) * (1 - 0.6 * after);
    g.beats += (g.rate / 60) * dt;
    // A beat's pulse: the spurt on the systole, a third of a beat long.
    const phase = g.beats % 1;
    g.pulse = phase < 0.34 ? Math.sin((Math.PI * phase) / 0.34) ** 2 : 0;
    // The pressure falls as the blood goes, and as the heart fails.
    const pressure = Math.max(0.15, 1 - 0.8 * lost) * (1 - 0.75 * after);
    g.flow = q * pressure * (0.35 + 1.3 * g.pulse);
  } else {
    g.rate = 0;
    g.pulse = 0;
    const since = state.t - g.dead - H.agonal;
    g.flow = q * GORE.blood.drain * 0.5 ** (since / GORE.blood.halve);
  }
  g.blood = Math.min(V, g.blood + g.flow * dt);
}
