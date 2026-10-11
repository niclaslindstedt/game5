// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TAKE-OFF HAND (`plane.ts`'s controls, the player's plane only) — what
// makes "full power and pull" fly off the strip. Flown on its physics alone
// a tailwheel single is hard to get off the snow on a keyboard: held back
// from the start it sits in the three-point attitude, close to its stall,
// lifts off AT the stall, over-rotates, and the torque drops a wing into the
// snow; held forward it noses over onto its propeller; let alone, the
// torque and the slipstream swing it off the strip. A flying school's hands
// on the controls beside the pilot's stop each of these and nothing else:
//   - near the snow the stick is eased FORWARD before the wing's angle
//     reaches its buffet (on the roll that raises the tail once the air
//     bites, as a pilot does; just off the snow it holds the climb under the
//     stall);
//   - on the snow the push is let off, and the stick eased back, before the
//     nose goes under the level (no nose-over);
//   - with the pedals let go on the roll the heading they left is HELD on
//     the rudder and the tail ski against the swing;
//   - with the stick not over, near the snow, the wings are held LEVEL.
// Off the snow it fades out by `TAKEOFF_HAND.high` m, so everything the
// physics flies in the air — a loop, a roll, a spin — is the player's own.
// Scaled by the run's `Assist` (OPTIONS' "how much the skis help"): off,
// the plane is flown raw. The numbers are `defs/plane-wings.ts`'s.
//
// Pure over the state; draws nothing from the stream.

import { angleDiff, clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import { TAKEOFF_HAND } from "./defs/plane-wings.ts";
import { PLANE } from "./defs/plane.ts";
import type { GameState } from "./state.ts";
import type { PlaneControls, PlaneState } from "./plane-state.ts";

const H = TAKEOFF_HAND;

/** The snow's own lean under the plane along its heading, rad (nose-up
 * positive): the pitch the nose-over guard is read off. */
function slopeUnder(run: GameState, p: PlaneState): number {
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const back = -PLANE.gear.tail.z;
  const g = run.level.groundAt;
  return Math.atan2(g(p.x, p.z) - g(p.x - fx * back, p.z - fz * back), back);
}

/** THE PLAYER'S CONTROLS `c` with the take-off hand's help this step, in
 * place. */
export function takeoffHand(run: GameState, p: PlaneState, c: PlaneControls): void {
  const near = p.grounded ? 1 : clamp((H.high - p.agl) / (H.high - H.low), 0, 1);
  // The heading the pedals left, followed while they are pressed.
  if (!p.grounded || Math.abs(c.yaw) > 0.05) p.hold = p.heading;
  const guard = p.grounded ? 1 : clamp((H.guardHigh - p.agl) / (H.guardHigh - H.high), 0, 1);
  if (guard <= 0) return;
  const assist = run.assist ?? { yaw: 1, air: 1 };
  const help = near * clamp(assist.air, 0, 1);
  const guardHelp = guard * clamp(assist.air, 0, 1);
  const pitchRate = -p.wx;
  // THE STALL GUARD: the stick eased forward of the buffet.
  if (guardHelp > 0 && (!p.grounded || p.airspeed > H.guardSpeed)) {
    const most = H.aoa + H.flaps * p.surfaces.flaps;
    const ahead = p.aoa + H.lead * pitchRate;
    if (ahead > most) {
      const push = clamp(H.guard * (ahead - most), 0, 1);
      c.pitch += (Math.max(c.pitch, push) - c.pitch) * guardHelp;
    }
  }
  // THE NOSE-OVER GUARD: the push let off as the nose nears the level,
  // and the stick eased back under it — on the snow off its lean, and a hop
  // off a bump the last few metres over it off the horizon, so a stick held
  // forward never flies it back into the snow. The three-point attitude and
  // a climb sit well over it: a stick held back is never touched here.
  const skim = p.grounded ? help : help * clamp(1 - p.agl / H.low, 0, 1);
  if (skim > 0) {
    const up = p.pitch - (p.grounded ? slopeUnder(run, p) : 0);
    if (up < H.floor + H.ease && c.pitch > 0) {
      c.pitch *= 1 - skim * clamp((H.floor + H.ease - up) / H.ease, 0, 1);
    }
    if (up < H.floor) c.pitch = Math.min(c.pitch, -H.back * (H.floor - up) * skim);
  }
  // THE HEADING HELD on the roll with the pedals let go.
  const yawHelp = (p.grounded ? 1 : 0) * clamp(assist.yaw, 0, 1);
  if (yawHelp > 0) {
    const free = 1 - clamp(Math.abs(c.yaw) / 0.3, 0, 1);
    const want = clamp(
      H.yaw * angleDiff(p.heading, p.hold) - H.yawRate * p.wy,
      -H.yawMost,
      H.yawMost,
    );
    c.yaw += want * free * yawHelp;
  }
  // THE WINGS HELD LEVEL near the snow, the stick not over.
  if (help > 0) {
    const free = 1 - clamp(Math.abs(c.roll) / 0.3, 0, 1);
    const want = clamp(H.roll * angleDiff(p.roll, 0) - H.rollRate * -p.wz, -H.rollMost, H.rollMost);
    c.roll += want * free * help;
  }
}
