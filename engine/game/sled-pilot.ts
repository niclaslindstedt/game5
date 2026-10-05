// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT'S HANDS ON THE SNOWMOBILE — the same four controls the player
// has (the thumb, the brake, the bars, the weight) and nothing more: what a
// link's pre-roll rides, what the labs stage their scenes with, and what
// the player's stand-in does on the boards. It rides to an aim — by default
// UP the mountain, the way a mountain sled is for — the bars toward the
// bearing, the thumb pinned on a climb and eased on the flat to a cruise,
// the weight forward on a steep face to keep the skis down and the nose
// from coming over, and back on the way down — and round the trunks in its
// way, slowing for them.
//
// Pure over the state; draws nothing from the stream.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { solidsNear, solidsOf } from "./posts.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "./state.ts";

/** How far ahead the bot looks for trunks and posts (`posts.ts`), m, and how wide a lane it wants
 * clear of them either side of the machine's centre line, m. */
const LOOK = 24;
const LANE = 2.4;
const near: number[] = [];

/** The bars away from the trunks ahead and how much to slow for them: each
 * trunk in the lane ahead pushes the bars toward its far side, harder the
 * nearer it stands and the more squarely in the way. */
function dodge(run: GameState): { steer: number; slow: number } {
  const s = run.sled!;
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  let steer = 0;
  let slow = 0;
  const solids = solidsOf(run.level);
  for (const i of solidsNear(run.level, s.x, s.z, LOOK, near)) {
    const t = solids[i];
    const dx = t.x - s.x;
    const dz = t.z - s.z;
    const along = dx * fx + dz * fz;
    if (along <= 0) continue;
    // +x of the body is the right: a trunk to the right is a positive side.
    const side = dx * fz - dz * fx;
    const room = LANE + t.radius;
    if (Math.abs(side) >= room) continue;
    const close = 1 - along / LOOK;
    const square = 1 - Math.abs(side) / room;
    const w = close * (0.4 + 0.6 * square);
    steer -= (side >= 0 ? 1 : -1) * w * 2.5;
    slow = Math.max(slow, w);
  }
  return { steer, slow };
}

/** WHERE THE BOT RIDES: to (x, z), at `cruise` m/s at most. */
export type SledAim = { x: number; z: number; cruise?: number };

/** The aim up the mountain from where the sled is: the summit's line of
 * the map, straight up the fall line (−z is uphill). */
function uphill(run: GameState): SledAim {
  const s = run.sled!;
  const top = run.level.mountain?.summit;
  return top ? { x: s.x * 0.7 + top.x * 0.3, z: top.z } : { x: s.x, z: s.z - 400 };
}

/** The bot's controls for this step, riding `run`'s snowmobile to `aim`. */
export function sledPilot(run: GameState, aim: SledAim = uphill(run)): SkierInput {
  const s = run.sled;
  if (!s) return { ...NEUTRAL_INPUT };
  const dx = aim.x - s.x;
  const dz = aim.z - s.z;
  const d = hypot(dx, dz);
  if (d < 6) return { ...NEUTRAL_INPUT, brake: 1 };
  const off = angleDiff(s.heading, Math.atan2(dx, dz));
  const avoid = dodge(run);
  const steer = clamp(off * 1.6 + avoid.steer, -1, 1);
  // How steep it climbs: the snow's rise along the nose.
  const ahead = 4;
  const fx = Math.sin(s.heading);
  const fz = Math.cos(s.heading);
  const rise =
    (run.level.groundAt(s.x + fx * ahead, s.z + fz * ahead) - run.level.groundAt(s.x, s.z)) / ahead;
  const cruise = aim.cruise ?? 14;
  const want = Math.min(cruise, Math.sqrt(Math.max(4, d)) * 2) * (1 - 0.6 * avoid.slow);
  const climb = 1 - 0.7 * avoid.slow;
  const throttle = rise > 0.15 ? climb : clamp((want - s.way) * 0.25 + 0.35, 0, 1);
  const over = avoid.slow > 0.3 ? 2 : 6;
  const brake = s.way > want + over ? clamp((s.way - want - over) * 0.2, 0, 1) : 0;
  const lean = rise > 0.25 ? -0.7 : rise < -0.2 ? 0.4 : 0;
  return { ...NEUTRAL_INPUT, tuck: throttle, brake, steer, lean };
}
