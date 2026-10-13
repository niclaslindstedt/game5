// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR ON A THROWN BODY (`ragdoll.ts`): the drag of a body tumbling
// through still air on its drag area (`crash.body.drag`) — so a body flung
// off anything fast slows, and one falling from high comes to its terminal
// speed rather than falling ever faster. Pure.

import { hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { TUNING } from "./defs/tuning.ts";

const dt = TUNING.dt;
/** ½ρ·Cd·A, kg/m. */
const HALF_RHO_CDA = 0.5 * TUNING.airDensity * TUNING.crash.body.drag;

/** ONE STEP OF THE AIR'S DRAG on a Verlet body (`P` the points, `L` where
 * they were a step ago, `mass` each point's, `total` their sum): the
 * quadratic slowing of its centre of mass's way, taken off every point
 * alike so it turns the body none, and integrated exactly over the step
 * (v ← v / (1 + k·|v|·dt)) so no speed overshoots. */
export function airDrag(P: number[], L: number[], mass: readonly number[], total: number): void {
  let x = 0;
  let y = 0;
  let z = 0;
  for (let i = 0; i < mass.length; i++) {
    const j = 3 * i;
    x += mass[i] * (P[j] - L[j]);
    y += mass[i] * (P[j + 1] - L[j + 1]);
    z += mass[i] * (P[j + 2] - L[j + 2]);
  }
  x /= total;
  y /= total;
  z /= total;
  const speed = hypot3(x, y, z) / dt;
  const lose = 1 - 1 / (1 + (HALF_RHO_CDA / total) * speed * dt);
  if (lose <= 0) return;
  for (let i = 0; i < mass.length; i++) {
    const j = 3 * i;
    L[j] += x * lose;
    L[j + 1] += y * lose;
    L[j + 2] += z * lose;
  }
}
