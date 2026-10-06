// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LANDING ABSORBED — the block of `TUNING` that answers to `absorb.ts`:
// what a skier's legs and trunk do in the moment the snow takes him back.
// It lives beside `tuning.ts` and is folded in as `TUNING.landing.absorb`,
// which is how the whole repo spells it.

/** From the air until `for` s after the touchdown the legs let go `soften`
 * of their rate, bend `deeper` more of their travel before the stop and
 * come back up with `1 + rebound` times their damping — a knee sinks under
 * a landing and does not spring him back off the snow — and the trunk damps
 * its pitch and roll rates at `steady` N·m·s per rad/s (on the reference
 * pair, scaled by each one's inertia) against the slap of a ski meeting the
 * snow end first; and on the snow his pitch and roll turn no faster than
 * `rate` rad/s (the leading end coming down to the slope under it, `follow`)
 * and his yaw no faster than `yaw` — the skis pivot to the slope and the way
 * under him, the body follows. */
export const LANDING_ABSORB = {
  for: 0.5,
  soften: 0.45,
  deeper: 0.3,
  rebound: 4,
  steady: 400,
  rate: 1.2,
  follow: 5,
  yaw: 1.5,
};
