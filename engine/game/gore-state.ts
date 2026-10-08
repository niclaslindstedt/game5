// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PLAYER'S MORTAL WOUNDS as the run holds them (`gore.ts`) — a type of
// its own so `state.ts` can carry them without importing the step that
// deals them.

import type { Injury } from "./state.ts";

/** THE PIECES a body can lose, in the order `GoreState.lost` keeps them a
 * bit each: the head off at the neck, a whole arm off at the shoulder, the
 * forearm off at the elbow, a whole leg off at the hip, the shin off at the
 * knee — the left before the right — and the body TORN IN TWO at the waist,
 * the hips and both legs gone from under the trunk (`lower`). */
export const GORE_PIECES = [
  "head",
  "armL",
  "armR",
  "forearmL",
  "forearmR",
  "legL",
  "legR",
  "shinL",
  "shinR",
  "lower",
] as const;

export type GorePiece = (typeof GORE_PIECES)[number];

/** What the trunk can be OPENED at, a bit each in `GoreState.open`: the
 * chest (the ribs stove in and the lungs and the heart out through them),
 * the abdomen (the bowel and the liver out of the belly). */
export const GORE_OPEN = ["chest", "abdomen"] as const;

export type GoreOpen = (typeof GORE_OPEN)[number];

/** WHAT KILLED HIM: the head torn off, the skull crushed, run through on a
 * spike, the chest or the belly torn open, torn in two, bled out, a body past saving
 * (an injury severity of 50 and more), burned in a wreck's fireball, the
 * grimbear, a piste machine's tracks and tiller run over him, a crashed
 * helicopter's blast. */
export type DeathCause =
  | "head"
  | "crush"
  | "impaled"
  | "opened"
  | "torn"
  | "bled"
  | "trauma"
  | "fire"
  | "maul"
  | "machine"
  | "blast";

/** ONE PIECE TORN OFF: which, when, and where its end at the body was and
 * how it was going at that moment (world frame, m and m/s) — the drawing
 * flies it from there; the engine keeps nothing of it after. */
export type TornPiece = {
  piece: GorePiece;
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
};

/** RUN THROUGH: the spike's tip (world frame, m), its radius, m, what it is
 * (a tree's top or a post's), the ragdoll point it went in at
 * (`RAGDOLL`), how far down the spike that point has slid, m, and when. */
export type Impaled = {
  x: number;
  y: number;
  z: number;
  radius: number;
  stuff: "tree" | "post";
  point: number;
  sunk: number;
  t: number;
};

/** THE PLAYER'S MORTAL WOUNDS. `mortal` is the run clock of the first
 * wound he cannot live through (−1 none) — from then he is never stood back
 * up; `dead` when he died (−1 alive) and `cause` what of. THE HEART:
 * `beats` counts its beats since the first wound that bled (the phase the
 * spray pulses on), at `rate` beats a minute; `blood` is the litres lost,
 * `flow` the litres a second leaving him this step, the beat's pulse in it
 * (`pulse`, 0 … 1 over a beat) — of which `out` leaves him through the
 * skin (the rest bleeds inside him, never seen), and `shed` the litres that
 * have, all told: the blood the snow under him can show. */
export type GoreState = {
  lost: number;
  torn: TornPiece[];
  open: number;
  /** When the skull was crushed (−1: it was not). */
  crushed: number;
  impaled: Impaled | null;
  mortal: number;
  dead: number;
  cause: DeathCause | null;
  /** HURT TOO BADLY TO SKI ON and alive (`rescue.ts`): the run clock he
   * was found so (−1 not), and the injury that keeps him down — from then
   * he is never stood back up either, and the rescue is called. */
  injured: number;
  injury: Injury | null;
  beats: number;
  rate: number;
  blood: number;
  flow: number;
  out: number;
  shed: number;
  pulse: number;
};

/** A body whole, its heart at rest. */
export function freshGore(): GoreState {
  return {
    lost: 0,
    torn: [],
    open: 0,
    crushed: -1,
    impaled: null,
    mortal: -1,
    dead: -1,
    cause: null,
    injured: -1,
    injury: null,
    beats: 0,
    rate: 0,
    blood: 0,
    flow: 0,
    out: 0,
    shed: 0,
    pulse: 0,
  };
}

/** Whether `piece` is gone. */
export function lostPiece(g: GoreState | undefined, piece: GorePiece): boolean {
  return !!g && (g.lost & (1 << GORE_PIECES.indexOf(piece))) !== 0;
}

/** What the wounds put on the run's events: a MORTAL WOUND — a piece torn
 * off, the skull crushed, the trunk opened or the body run through on a
 * spike, and where, world frame, m — DEATH, and of what — and a body
 * HURT TOO BADLY TO SKI ON, by what and where (`rescue.ts`). */
export type GoreEvent =
  | {
      kind: "gore";
      t: number;
      what: "torn" | "crush" | "open" | "impaled";
      piece?: GorePiece | GoreOpen;
      x: number;
      y: number;
      z: number;
    }
  | { kind: "death"; t: number; cause: DeathCause }
  | { kind: "injured"; t: number; injury: Injury; x: number; y: number; z: number };
