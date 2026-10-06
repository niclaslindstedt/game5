// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT IN THE AIR OFF AN AERIALS KICKER (R44) — the jump he declared,
// thrown as a jumper throws it: the in-run and the out-run are the speed
// skier's hold (`speed-ski-steer.ts`, tucked and straight down the site's
// line), and off the lip every flip of the plan is asked at once, a tap of
// the lean back a flip (`aerial-flight.ts` paces the somersault to the
// snow), then each flip's twists tapped on the edge while that flip is
// turning — the twist is done by the end of the flip it is asked in — and
// a tucked flip held tucked, let go as it ends.

import { flipsOf } from "../game/defs/aerial-jumps.ts";
import { TUNING } from "../game/defs/tuning.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "../game/state.ts";

/** The input that flies `state`'s jumper through his declared jump, or null
 * when he is not in the air off an aerials kicker. */
export function aerialsAirInput(state: GameState): SkierInput | null {
  const f = state.aerial;
  const c = state.skier;
  if (!f || !state.level.aerials || !state.rules.aerials || !c.airborne || f.read) return null;
  const want = flipsOf(f.plan) ?? [];
  // A tap is a press and a let-go: every other step.
  const k = Math.round(c.airTime / TUNING.dt);
  const press = k % 2 === 0;
  const input: SkierInput = { ...NEUTRAL_INPUT, tuck: 0 };
  if (f.flips < want.length) {
    input.lean = press ? 1 : 0;
    return input;
  }
  // Which flip the somersault is in.
  const share = f.flips > 0 ? f.total / f.flips : 0;
  const j = share > 0 ? Math.min(want.length - 1, Math.floor(f.phi / share)) : 0;
  const owed = want.slice(0, j + 1).reduce((a, x) => a + x.twists, 0);
  if (f.twists < owed && press) input.steer = 1;
  // A tucked flip held tucked, never past the last flip's end.
  input.trick = want[j]?.tuck === true && f.phi < f.total - 0.4;
  return input;
}
