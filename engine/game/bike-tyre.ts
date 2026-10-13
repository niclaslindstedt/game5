// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A KNOBBLY ON DIRT (`bike-body.ts`): what one tyre's contact patch holds,
// along the wheel and across it. The side force is the CAMBER's — the lean
// alone pushes the patch toward the side leaned — trimmed by the SLIP angle,
// which winds up over the tyre's relaxation length rather than at once. Along
// the wheel, the brake holds the patch still up to its torque, the pedals
// push it, the carcass rolls against the ground's resistance. Both share ONE
// GRIP BUDGET (the friction ellipse at the ground's peak μ): a brake asking
// more than it locks the wheel and the patch slides on the ground's sliding μ
// against its whole slip; a side force asking more falls off the peak toward
// the sliding grip — the front's washout, the rear's drift. Numbers are
// `BIKE.tyre`'s and the ground's (`SURFACES`).

import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { BIKE } from "./defs/bike.ts";
import type { BikeWheel } from "./bike-state.ts";

const T = BIKE.tyre;

/** What a tyre is asked on one substep. */
export type TyreAsk = {
  /** The load on the patch, N; its velocity along the wheel and across it
   * (right of the wheel positive), m/s; the wheel's camber, rad (leaned
   * right positive). */
  load: number;
  along: number;
  across: number;
  camber: number;
  /** The ground: peak and sliding μ, rolling resistance Crr. */
  grip: number;
  slide: number;
  roll: number;
  /** The brake's most force at the patch, N (its torque over the radius),
   * and the pedals' push, N (forward positive). */
  brake: number;
  drive: number;
};

/** What the patch gives back, N: along the wheel (forward positive) and
 * across it (right positive). */
export type TyreForce = { along: number; across: number };

/** ONE PATCH ON ONE SUBSTEP of `h` s: the force it puts on the bike, and the
 * wheel's slip, overload, lock and spin moved on. */
export function tyreForce(w: BikeWheel, ask: TyreAsk, h: number, out: TyreForce): TyreForce {
  const N = ask.load;
  const v = ask.along;
  const peak = ask.grip * N;
  const slide = ask.slide * N;
  // THE SLIP ANGLE winds toward the patch's own over the relaxation length,
  // read at a crawl as if at `crawl` m/s so a standing wheel holds.
  const pace = Math.max(Math.abs(v), T.crawl);
  const aim = Math.atan2(-ask.across, pace);
  w.slip += clamp((h * pace) / T.relax, 0, 1) * (aim - w.slip);
  w.slip = clamp(w.slip, -T.most, T.most);

  // ALONG: the rolling resistance, the brake holding the patch up to its
  // force (still under `creep` m/s of creep), and the pedals.
  const rr = -ask.roll * N * Math.tanh(v / T.creep);
  const hold = -clamp(v / T.creep, -1, 1) * ask.brake;
  let along = rr + hold + ask.drive;

  // A LOCKED WHEEL slides on its whole slip until the brake lets go of what
  // the sliding grip can stop it with.
  if (w.locked && (ask.brake < slide * 0.9 || Math.abs(v) < T.creep)) w.locked = false;
  if (!w.locked && Math.abs(hold) >= peak && ask.brake > peak && Math.abs(v) > T.creep) {
    w.locked = true;
  }
  w.spinning = ask.drive > peak;
  if (w.locked) {
    const sv = hypot(v, ask.across);
    const f = sv > 1e-6 ? (slide * Math.tanh(sv / T.creep)) / sv : 0;
    out.along = -v * f;
    out.across = -ask.across * f;
    w.over = 2;
    return out;
  }
  if (w.spinning) along = rr + Math.sign(ask.drive) * slide;
  along = clamp(along, -peak, peak);

  // ACROSS: the camber's thrust and the slip's, inside what the budget
  // leaves after the force along.
  const want = N * (T.camber * ask.camber + T.cornering * w.slip);
  const room = Math.sqrt(Math.max(0, peak * peak - along * along));
  const roomSlide = Math.sqrt(Math.max(0, slide * slide - along * along));
  let across = want;
  w.over = room > 1 ? Math.abs(want) / room : Math.abs(want) > 1 ? 9 : 0;
  if (Math.abs(want) > room) {
    // Past the peak the patch lets go toward its sliding grip — and the
    // slip stops winding further than the slide.
    const r = w.over;
    across = Math.sign(want) * (roomSlide + (room - roomSlide) * Math.exp(-T.fade * (r - 1)));
    const most = (room * 1.5) / Math.max(1, N * T.cornering);
    w.slip = clamp(w.slip, -most - 0.05, most + 0.05);
  }
  out.along = along;
  out.across = across;
  return out;
}
