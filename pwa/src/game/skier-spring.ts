// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY ON ITS LEGS, kept by the view between frames (it is the
// picture's, not the physics'): the spring the figure's mass rides on its
// legs, and the moments a pose eases through rather than jumps — into the
// air and out of it, a jump loaded and sprung. Stepped with the frame's
// `dt` (`skis-body.ts`); `skier-pose.ts` reads it. Three-free.

/** THE BODY ON ITS LEGS — the secondary motion a skier's own mass has on
 * top of the skis, kept by the view (it is the picture's, not the
 * physics'): a spring-damper in the pair's vertical, kicked by every change
 * in the pair's own climb, so a landing that stops the skis dead leaves the
 * body still coming down — the knees fold and spring back — and the chatter
 * of a hard piste is a jiggle. */
export type SkierSpring = {
  /** The fold, m (positive sunk), and its rate, m/s. */
  bump: number;
  rate: number;
  /** The pair's climb at the last frame, m/s, or NaN before the first. */
  lastVy: number;
  /** How far into the AIR his body is, 0 on the snow to 1 in flight —
   * eased, so leaving the snow and meeting it again are motions, not a
   * pose swapped in a frame. */
  air: number;
  /** A JUMP's load as his body holds it, 0..1: it follows the engine's
   * load down into the crouch and, sprung, lets go of it over the pop
   * rather than in the step the engine zeroes it. */
  load: number;
  /** His own clock, s — what a skier standing still breathes and shifts
   * his weight by, started at his own offset so a start line of four does
   * not breathe in step. */
  clock: number;
};

/** The body's natural frequency on its legs, rad/s (about 2.3 Hz), its
 * damping ratio, the share of the pair's change of climb the body is
 * kicked by (the legs soak up the rest before the knees move), and the most
 * they fold or extend, m. */
const LEGS = { omega: 14.5, zeta: 0.42, kick: 0.5, fold: 0.22, extend: 0.05 };
/** How fast the body goes into the air and comes back to the snow, and
 * how fast a load is taken and let go, 1/s (exponential rates: a fifth of
 * a second to most of the way into the air, a tenth to let go of a jump —
 * the time a skier's extension takes). */
const EASE = { up: 9, down: 14, take: 18, release: 16 };

export function createSkierSpring(offset = 0): SkierSpring {
  return { bump: 0, rate: 0, lastVy: Number.NaN, air: 0, load: 0, clock: offset };
}

/** Advance the body on its legs by `dt` s for a pair climbing at `vy` m/s
 * (the engine's own), in the air or not, a jump loaded `load` of the way
 * (0..1; the engine's `jumpLoad` over a full one). */
export function stepSkierSpring(
  s: SkierSpring,
  vy: number,
  airborne: boolean,
  dt: number,
  load = 0,
): void {
  if (!(dt > 0)) return;
  s.clock += dt;
  const toward = (from: number, to: number, rate: number) =>
    to + (from - to) * Math.exp(-rate * dt);
  s.air = toward(s.air, airborne ? 1 : 0, airborne ? EASE.up : EASE.down);
  const held = airborne ? 0 : Math.max(0, Math.min(1, load));
  s.load = toward(s.load, held, held > s.load ? EASE.take : EASE.release);
  if (!Number.isNaN(s.lastVy)) {
    // The pair's change of climb since the last frame is a kick the body
    // does not share: it keeps going the way it was.
    s.rate += (vy - s.lastVy) * LEGS.kick * (airborne ? 0 : 1);
  }
  s.lastVy = vy;
  const n = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const acc = -LEGS.omega * LEGS.omega * s.bump - 2 * LEGS.zeta * LEGS.omega * s.rate;
    s.rate += acc * h;
    s.bump += s.rate * h;
  }
  if (s.bump > LEGS.fold) {
    s.bump = LEGS.fold;
    s.rate = Math.min(0, s.rate);
  } else if (s.bump < -LEGS.extend) {
    s.bump = -LEGS.extend;
    s.rate = Math.max(0, s.rate);
  }
}
