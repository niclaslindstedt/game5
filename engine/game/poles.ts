// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE POLES — the one push a skier has that is not gravity. Out of the
// start gate, across the flat at the bottom of a run-out, and out of the
// powder he has stopped in, a skier plants his poles and pushes; at speed
// they are tucked under his arms and push nothing. What the snow makes of
// the push is the grip's (`skier.ts` applies it along the skis); this
// module owns what a plant is worth.
//
// THE PUSH is a plant a second (`poles.cadence`), each held half of it, so
// it is a pulse at a crawl and reads as one under the boots: the full
// `polePush` of the spec under `poles.speed` m/s of way, fading to nothing
// by `poles.fade`, and half of it in powder, where the baskets sink. It is
// asked for with the TUCK — the same thumb, the same key: a skier at rest
// holding it is skating off, and one at speed is folded into the wind.
//
// A drive that is one-way and only ever gentle: nothing here can push a
// skier faster than a jog, and nothing here brakes him.

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { SkiSpec } from "./defs/skis.ts";
import { TUNING } from "./defs/tuning.ts";

const P = TUNING.poles;

/** The plants' pulse at run clock `t`, 0..1: on for the first half of each
 * `cadence` second, off for the rest. */
export function plantPulse(t: number): number {
  const phase = (t * P.cadence) % 1;
  return phase < 0.5 ? 1 : 0;
}

/** The force the poles push with along the skis, N, at `way` m/s with the
 * tuck (the push) at `tuck` 0..1 on snow `packed` 0..1, at run clock `t`.
 * Zero at speed, zero with the tuck let go. */
export function poleForce(
  spec: SkiSpec,
  way: number,
  tuck: number,
  packed: number,
  t: number,
): number {
  if (tuck <= 0.01) return 0;
  const reach = 1 - clamp((Math.abs(way) - P.speed) / (P.fade - P.speed), 0, 1);
  if (reach <= 0) return 0;
  const snow = packed + (1 - packed) * P.powderShare;
  return spec.polePush * tuck * reach * snow * plantPulse(t);
}
