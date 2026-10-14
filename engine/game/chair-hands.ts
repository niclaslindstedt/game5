// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A CHAIR LEFT ONLY BY HAND — the player's own chair ride on a free ride
// (`GameState.chairHands`, asked by the app). Nothing stands him up at the
// top: he sits until he moves.
//
//   * THE SAFETY BAR (`chairBarDown`) is lowered once the chair is clear of
//     its load and raised short of the unload, where the sign asks for it;
//     on the way back down it stays up. While it is down the tuck still
//     skips the ride (`lift-ride.ts`'s `skipUp`).
//   * WITH THE BAR UP, FORWARD (the tuck — W, the gas lever on touch) takes
//     him off: over the unload ramp he stands up and skis down it as ever;
//     anywhere else he JUMPS — shoved off the seat with the chair's way and
//     falling however far there is under him, judged as any fall is
//     (`flight.ts`, `body.ts`). Too early, high over the snow, it kills him.
//     The tuck held since before the bar went up does nothing: it has to be
//     let go and pressed again (`LiftRide.armed`), so a thumb resting on the
//     lever never throws him off. The edge and the leans are left alone —
//     the lens is his to look round with.
//   * UNTOUCHED, HE STAYS ON: round the top wheel and back down the line
//     facing the valley, the bar up (`LiftRide.round`), round the bottom
//     wheel and up again — the lift's own chair, wherever the clock has it.
//
// Pure over the plan and the clock; nothing draws from the stream.

import { smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { carrierRollAt, carrierSwingAt } from "./carrier-swing.ts";
import { TUNING } from "./defs/tuning.ts";
import { carrierAt, carrierGripAt, carrierPlace, type LiftPlan } from "./lift-line.ts";
import { derive } from "./skier.ts";
import type { GameState, LiftRide } from "./state.ts";

const K = TUNING.lift;

/** THE SAFETY BAR'S SWING (`docs/lifts.md`): lowered `down` m past the load
 * line, over the metres between, and raised `up` m short of the unload. */
export const CHAIR_BAR_SWING = { down: [8, 16], up: [34, 26] } as const;

/** HOW FAR DOWN A CHAIR'S SAFETY BAR IS, 0 up … 1 down over the riders'
 * laps, where a carrier is on its loop (`carrierAt`'s spot): down only on
 * the way up, clear of the load and short of the unload; up round the
 * wheels and all the way back down. The engine's jump and the drawn bar
 * (`lifts.ts`) both read it. */
export function chairBarDown(p: LiftPlan, spot: { u: number; side: 0 | 1; turn?: number }): number {
  if (spot.side !== 0 || spot.turn !== undefined) return 0;
  const load = p.look.entry.at;
  const off = p.length - p.look.off;
  const u = spot.u;
  return (
    smoothstep(load + CHAIR_BAR_SWING.down[0], load + CHAIR_BAR_SWING.down[1], u) *
    (1 - smoothstep(off - CHAIR_BAR_SWING.up[0], off - CHAIR_BAR_SWING.up[1], u))
  );
}

/** Whether the player's chair is left only by hand on this run: asked by
 * the app, and never while a bike rides it with him (`bike.ts` stands the
 * pair off at the top). */
export function byHand(run: GameState, ride: LiftRide): boolean {
  return (
    run.chairHands === true &&
    ride.kind === "chair" &&
    ride.phase === "ride" &&
    ride.carrier !== undefined &&
    run.bike?.mode !== "lift"
  );
}

/** Where his chair is on its loop now, and how far down its bar is. */
export function chairNow(
  run: GameState,
  plan: LiftPlan,
  ride: LiftRide,
): { spot: ReturnType<typeof carrierAt>; bar: number } {
  const spot = carrierAt(plan, ride.carrier ?? 0, run.t);
  return { spot, bar: chairBarDown(plan, spot) };
}

/** WHAT THE TUCK ASKS of a rider on a chair left by hand, this step:
 * `off` (stand up or jump), `skip` (the bar down: the old skip), or
 * nothing. Arms on the tuck let go. */
export function chairAsk(ride: LiftRide, tuck: number, bar: number): "off" | "skip" | null {
  const pressed = tuck >= 0.5;
  if (!pressed) ride.armed = true;
  if (bar >= 0.5) return ride.round ? null : "skip";
  return pressed && ride.armed ? "off" : null;
}

/** Whether the chair is over its unload ramp — where forward stands him up
 * rather than throwing him off: on the up side from `stand` m short of the
 * unload to `stand` m short of the wheel. */
export function overRamp(plan: LiftPlan, spot: { u: number; side: 0 | 1; turn?: number }): boolean {
  const off = plan.length - plan.look.off;
  return (
    spot.side === 0 &&
    spot.turn === undefined &&
    spot.u >= off - K.hands.stand &&
    spot.u <= plan.length - K.hands.stand
  );
}

/** CARRIED ROUND ON HIS CHAIR past the unload: over the ramp, round the
 * top wheel, down the line facing the valley, round the bottom wheel and
 * back onto the up rope — sat where the lift's own chair `ride.carrier` is
 * (`carrierPlace`), swung on its hanger, leant out of a wheel's turn, never
 * through the snow. Back on the up rope short of the unload the ride is an
 * ordinary one again (`ride.round` let go); true while it is round. */
export function holdRound(run: GameState, plan: LiftPlan, ride: LiftRide): boolean {
  const c = run.skier;
  const spot = carrierAt(plan, ride.carrier ?? 0, run.t);
  const off = plan.length - plan.look.off;
  if (spot.side === 0 && spot.turn === undefined && spot.u < off - K.hands.stand) {
    delete ride.round;
    ride.u = spot.u;
    return false;
  }
  ride.round = true;
  ride.u = spot.u;
  ride.tower = Math.max(
    1,
    plan.supports.findIndex((q) => q.u > spot.u),
  );
  const place = carrierPlace(plan, spot);
  const swing = spot.turn === undefined ? carrierSwingAt(plan, spot.u, spot.side) : 0;
  const roll = carrierRollAt(plan, spot.turn);
  ride.swing = swing;
  const gy = carrierGripAt(plan, spot.u);
  const sh = Math.sin(place.heading);
  const ch = Math.cos(place.heading);
  // On the seat beside the hanger, outboard of it — right of the way it runs.
  const ahead = K.seat * Math.sin(swing);
  let x = place.x + sh * ahead + ch * K.chairSeat;
  let z = place.z + ch * ahead - sh * K.chairSeat;
  let y = gy - K.seat * Math.cos(swing);
  y = Math.max(y, run.level.groundAt(x, z) + K.sit);
  const dt = TUNING.dt;
  c.vx = (x - c.x) / dt;
  c.vy = (y - c.y) / dt;
  c.vz = (z - c.z) / dt;
  c.x = x;
  c.y = y;
  c.z = z;
  c.q = fromEuler(place.heading, swing, roll);
  c.wx = c.wy = c.wz = 0;
  c.airborne = false;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  derive(c, run.level);
  c.incline = 0;
  return true;
}

/** OFF THE SEAT WITH A SHOVE — the jump out of a chair: on top of the
 * chair's own way (already his, `holdRound` / `hold`), pushed `hands.leap`
 * m/s on along the way he faces and up off it. */
export function shoveOff(run: GameState): void {
  const c = run.skier;
  c.vx += Math.sin(c.heading) * K.hands.leap.ahead;
  c.vz += Math.cos(c.heading) * K.hands.leap.ahead;
  c.vy += K.hands.leap.up;
  c.y += 0.05;
}
