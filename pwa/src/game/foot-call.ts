// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PEOPLE ON FOOT HANDED TO THE ENGINE — the free ride's civilians
// (`civilian-plan.ts`) as the bodies the skier meets (`engine/game/foot.ts`):
// each one's place or route, the share of his role out by the hour and his
// keenness, and the sky clock's rate the hour runs at this visit — exactly
// what `civilianAt` draws him off, so the man met is the man drawn. Handed
// in before the first step (`peopled`) and carried by a replay's recipe
// (`replay.ts`), so a replay meets the same people. DOM-free and three-free.
//
// The village's dog walkers are not handed in: their walks wait at the
// kerbs on the traffic (`dog-walk.ts`) and the village's streets are walked
// with the skis off (`town.ts`), so they stay the app's knock alone.

import { withFoot, type FootCall, type FootPerson, type GameState, type Level } from "@engine";

import { civilianPlanFor, hasCivilians, roleIn } from "./civilian-plan.ts";
import { skyClock } from "./sky-clock.ts";

const calls = new WeakMap<Level, { summer: boolean; rate: number; call: FootCall }>();

/** THE CIVILIANS OF `level` (in midsummer's cast when `summer`) as the
 * engine meets them — keyed by their index in the plan, as the views key
 * their knocks (`civilian-hits.ts`' `peopleOf`). */
export function footCallOf(level: Level, summer: boolean, rate = skyClock()): FootCall {
  const had = calls.get(level);
  if (had && had.summer === summer && had.rate === rate) return had.call;
  const plan = civilianPlanFor(level, summer);
  const people: FootPerson[] = plan.people.map((c, i) => {
    let rx = c.home.x;
    let rz = c.home.z;
    let rr = 0;
    if (c.leg) {
      const xs = c.leg.points.map((p) => p.x);
      const zs = c.leg.points.map((p) => p.z);
      rx = (Math.min(...xs) + Math.max(...xs)) / 2;
      rz = (Math.min(...zs) + Math.max(...zs)) / 2;
      rr = Math.max(...c.leg.points.map((p) => Math.hypot(p.x - rx, p.z - rz)));
    }
    return {
      key: i,
      body: c.body,
      x: c.home.x,
      y: c.home.y,
      z: c.home.z,
      heading: c.home.heading,
      ...(c.leg ? { route: c.leg, offset: c.offset } : {}),
      keen: c.keen,
      hours: roleIn(plan.summer, c.role).hours,
      rx,
      rz,
      rr: rr + 1,
    };
  });
  const call: FootCall = { people, rate };
  calls.set(level, { summer, rate, call });
  return call;
}

/** A RUN WITH ITS PEOPLE ON FOOT handed in: a free ride with the ski
 * area's people on it (`hasCivilians`) that has none yet. Returns it. */
export function peopled(state: GameState): GameState {
  if (state.foot?.call || !hasCivilians(state.rules)) return state;
  return withFoot(state, footCallOf(state.level, state.summer === true));
}
