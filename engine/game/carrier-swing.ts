// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SWING OF A HUNG CARRIER — a chair or a gondola's cabin on its hanger
// under the grip — as a pure function of where on its loop the carrier is
// (`lift-line.ts`'s `carrierAt`), so the clock's every carrier, the one a
// rider sits in (`lift-ride.ts`'s `hold`) and the crowd's agree to the
// figure with nothing stepped or stored.
//
// Two things swing a hanger off the plumb (`docs/lifts.md`):
//
//   * THE GRIP'S SLOWING AND PICK-UP through a terminal: a detachable
//     carrier is slowed onto its unload and taken back up to the rope's
//     speed off its load (`carrierSpeedAt`), and the hanger's foot leans
//     against the change as a pendulum does — `atan(−a / g)`, forward as
//     the grip slows, back as it is taken up;
//   * THE ROPE'S BEND OVER EACH TOWER'S SHEAVES: the grip's way turns over
//     a crest or through a sag, and the hanger is kicked into a swing that
//     dies away on its damping — `lift.kick` rad/s per unit of the slope's
//     change read `lift.bend` m either side, to `lift.kickMost` — the
//     swing a free pendulum makes from that kick, `(r / ω) e^(−ζτ) sin ωτ`,
//     τ the seconds since the tower at the speed it is going. The last
//     `LURCHES` towers are summed; the ones before are long since still.
//
// A drag's T-bar hangs on a spring box, not a hanger: it never swings.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { TUNING } from "./defs/tuning.ts";
import { carrierSpeedAt, ropeAt, type LiftPlan } from "./lift-line.ts";

const K = TUNING.lift;
/** How many towers back a lurch is still summed. */
const LURCHES = 2;
/** The step a speed's change is read over, m. */
const READ = 0.5;

/** HOW FAR A CARRIER `u` m up its line on `side` (0 up, 1 down) HANGS OFF
 * PLUMB, rad — positive with its foot swung forward the way it goes. */
export function carrierSwingAt(plan: LiftPlan, u: number, side: 0 | 1): number {
  if (plan.lift.kind === "drag") return 0;
  const hang = plan.lift.kind === "gondola" ? K.cabinHang : K.chairHang;
  const omega = Math.sqrt(TUNING.g / hang);
  const dir = side === 0 ? 1 : -1;
  const v = carrierSpeedAt(plan, u, side);
  const ahead = carrierSpeedAt(plan, u + dir * READ, side);
  // The grip's slowing or pick-up along its way, m/s².
  const a = (ahead * ahead - v * v) / (2 * READ);
  let swing = Math.atan2(-a, TUNING.g);
  const s = plan.supports;
  let felt = 0;
  for (let n = 1; n < s.length - 1 && felt < LURCHES; n++) {
    // Newest first: walking back from the last tower passed.
    const i = side === 0 ? s.length - 1 - n : n;
    const at = s[i].u;
    const past = dir * (u - at);
    if (past < 0) continue;
    felt++;
    const before = (ropeAt(plan, at) - ropeAt(plan, at - dir * K.bend)) / K.bend;
    const after = (ropeAt(plan, at + dir * K.bend) - ropeAt(plan, at)) / K.bend;
    const kick = clamp(K.kick * (before - after), -K.kickMost, K.kickMost);
    const tau = past / Math.max(0.3, v);
    swing += (kick / omega) * Math.exp((-K.damp * tau) / 2) * Math.sin(omega * tau);
  }
  return clamp(swing, -K.swingMost, K.swingMost);
}
