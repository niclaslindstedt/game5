// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOWNHILL BIKE AS THE HUD READS IT (`bike.ts`) — DOM-free, so the
// suite reads it. Ridden: the trail he rides by the name on its head's
// sign and its grade, how far is left of it, and how many times he has
// come off it this ride. Off it on his feet: the way back to it, and stood
// beside it, that the machine press puts him on.

import {
  bikeTrailAt,
  bikeTrailById,
  bikeWithin,
  type BikeState,
  type GameState,
  type TrailGrade,
} from "@engine";

import { bikeTrailName } from "./bike-sign-plan.ts";

export type HudBike =
  | {
      kind: "ridden";
      /** The trail's name off its sign, its grade, the metres left of it
       * (null off its tread), and the falls this ride. */
      trail: string | null;
      grade: TrailGrade | null;
      toGo: number | null;
      falls: number;
    }
  | { kind: "waiting"; away: number; near: boolean };

/** How near his lying bike the HUD points him at it, m. */
const BIKE_CALL = 60;

/** THE FALLS a ride has had: counted as its bike first lies thrown (a
 * restart deals a fresh bike, and with it a fresh count). */
const falls = new WeakMap<BikeState, { n: number; was: boolean }>();

function fallsOf(b: BikeState): number {
  const f = falls.get(b) ?? { n: 0, was: false };
  if (b.thrown && !f.was) f.n++;
  f.was = b.thrown;
  falls.set(b, f);
  return f.n;
}

/** The downhill bike's readout for the player at this step, or null. */
export function bikeOf(state: GameState): HudBike | null {
  const b = state.bike;
  if (!b) return null;
  const n = fallsOf(b);
  const c = state.skier;
  if (b.onIt) {
    const trail = b.trail ? bikeTrailById(state.level, b.trail) : null;
    const hit = trail ? bikeTrailAt(state.level, b.x, b.z) : null;
    const on = hit && trail && hit.trail.id === trail.id ? hit : null;
    return {
      kind: "ridden",
      trail: trail ? bikeTrailName(state.level, trail.id) : null,
      grade: trail?.grade ?? null,
      toGo: on && trail ? Math.max(0, trail.length - on.s) : null,
      falls: n,
    };
  }
  if (!b.afoot || c.thrown || c.lift) return null;
  const away = Math.hypot(b.x - c.x, b.z - c.z);
  return away < BIKE_CALL ? { kind: "waiting", away, near: bikeWithin(state) } : null;
}
