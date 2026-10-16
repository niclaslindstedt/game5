// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TWIRL, AS A BODY TURNS ONE — how the skier carries himself through a
// spin the edge has thrown (`strokes.ts`). Three-free, so the suite reads
// it; presentation only — the rotation is the engine's own.
//
// A spin is LED. Park skiers on film wind the shoulders into the spin as
// they leave the lip, and the head goes first: it turns into the spin and
// looks over the leading shoulder for the landing, the hips and the skis
// following round under it. The arms come in to the chest to turn
// quicker (the engine's `spinForm` past one) and are thrown out to check
// it; between, a spinner keeps them compact, the fists near his hips. So
// the lead and the arms are eased on a spring off the throw, and let go of
// over a moment once he is down.

/** The spin as the engine keeps it (`TrickState`). */
export type SpinThrow = {
  /** The angle owed in all, rad, clockwise from above positive; 0 when
   * nothing turns him. */
  readonly spinGoal: number;
  /** The body's shape, as a multiple of the open body's rate. */
  readonly spinForm?: number;
};

/** THE TWIRL as the view carries it between frames. */
export type Twirl = { lead: number; leadRate: number; tight: number; tightRate: number };

/** What the pose is handed: how far into the spin his upper body leads,
 * −1..1 (right positive), and how far his arms are pulled in, 0..1. */
export type TwirlShape = { lead: number; tight: number };

export function createTwirl(): Twirl {
  return { lead: 0, leadRate: 0, tight: 0, tightRate: 0 };
}

/** The engine's arms-in shape (`TUNING.tricks.spinIn`) and how compact a
 * spinner holds himself with the edge let go, 0..1. */
const SPIN_IN = 1.35;
const COMPACT = 0.45;
/** How quickly the lead comes in and lets go, rad/s of a critically
 * damped spring: the shoulders a sixth of a second into it. */
const LEAD_IN = 18;
const LEAD_OUT = 9;
/** ...and the arms. */
const ARMS = 14;

/** What a throw asks of the body: the lead its way and the arms in. */
export function twirlAim(t: SpinThrow | null | undefined): TwirlShape {
  if (!t || t.spinGoal === 0) return { lead: 0, tight: 0 };
  const form = t.spinForm ?? 1;
  const tight = Math.min(1, Math.max(0, COMPACT + ((1 - COMPACT) * (form - 1)) / (SPIN_IN - 1)));
  return { lead: Math.sign(t.spinGoal), tight };
}

function spring(x: number, v: number, aim: number, w: number, dt: number): [number, number] {
  const d = x - aim;
  const e = Math.exp(-w * dt);
  const u = v + w * d;
  return [aim + (d + u * dt) * e, (v - w * u * dt) * e];
}

/** One frame of the twirl, `dt` s, toward what the throw asks. */
export function stepTwirl(s: Twirl, t: SpinThrow | null | undefined, dt: number): void {
  if (dt <= 0) return;
  const aim = twirlAim(t);
  const w = Math.abs(aim.lead) > Math.abs(s.lead) ? LEAD_IN : LEAD_OUT;
  [s.lead, s.leadRate] = spring(s.lead, s.leadRate, aim.lead, w, dt);
  [s.tight, s.tightRate] = spring(s.tight, s.tightRate, aim.tight, ARMS, dt);
  s.lead = Math.max(-1, Math.min(1, s.lead));
  s.tight = Math.max(0, Math.min(1, s.tight));
}

/** The twirl as the pose is handed it, or none once it has let go. */
export function twirlOf(s: Twirl): TwirlShape | undefined {
  return Math.abs(s.lead) > 0.005 || s.tight > 0.005 ? { lead: s.lead, tight: s.tight } : undefined;
}

/** WHAT A TWIRL DOES TO THE BODY at a full lead and arms fully in: the
 * shoulders turned into the spin, rad, the head further, rad, the hips
 * a little after them, m across, and the fists drawn in toward the body's
 * middle (a share of their reach out), up toward the chest, m, and the
 * crouch a spinner folds into. */
export const TWIRL = { twist: 0.5, look: 0.55, hands: 0.55, raise: 0.12, crouch: 0.25 };
