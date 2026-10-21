// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE'S PILOT (`plane-cockpit.ts` seats him) — the man sat at a
// machine's controls (`seated-figure.ts`) dressed as a pilot — a dark
// flight jacket, grey trousers, his headset over his ears — sat in the
// left seat and posed every frame onto the controls: his left hand round
// the stick's grip, his right on the power lever, his feet on the pedals.
// The joints are written in the cockpit's frame (`plane-cockpit-plan.ts`)
// and the figure is emitted there, so it hangs in the cockpit's mirrored
// room like the rest of it.

import type { HazeUniforms } from "./haze.ts";
import { PLANE_COCKPIT } from "./plane-cockpit-plan.ts";
import { createSeatedFigure, type SeatedFigure } from "./seated-figure.ts";

/** His kit, as eight indices into the people's palette: a navy jacket,
 * grey trousers, a black head, the skis' slot unused, a dark accent, the
 * skin, brown hair, the jacket again for the vest. */
const KIT = [10, 18, 25, 33, 6, 40, 45, 10];

export type CockpitPilot = SeatedFigure;

export function createCockpitPilot(haze: HazeUniforms): CockpitPilot {
  const C = PLANE_COCKPIT;
  const Pi = C.pilot;
  return createSeatedFigure(
    haze,
    {
      x: -C.seat.x,
      left: -1,
      eye: C.eye,
      shoulder: Pi.shoulder,
      hip: Pi.hip,
      upperArm: Pi.upperArm,
      forearm: Pi.forearm,
      thigh: Pi.thigh,
      shin: Pi.shin,
    },
    KIT,
    "cockpit_pilot",
  );
}
