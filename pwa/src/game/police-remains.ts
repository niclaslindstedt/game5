// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY THE POLICE COME FOR, ONE BODY — a dead rider is left lying where
// he died (`gore-view.ts`' remains: his body as last drawn, torn and
// soaked), and a police call (`police-plan.ts`) carries a body away from
// the same place. So while the officers work the scene the remains ARE the
// body (the call's own figure is not drawn beside them), and once the
// recovery starts — they come for him with the bag — the call's figure is
// the body and the remains' figure goes (his blood and what was torn off
// him stay on the snow). Presentation only: `renderer.ts` hands the one
// view's answer to the other every frame.

import { RAGDOLL, type GameState } from "@engine";

import type { Remains } from "./gore-remains.ts";

/** How near a body left lying must be to a call's casualty to be his, m. */
const SAME = 2.5;

/** A police call's casualty this frame: where he lay, and whether its crew
 * have him (the recovery under way: from then the call draws him). */
export type Taken = { x: number; z: number; taken: boolean };

/** Where a dead run left him lying: his hips, else where he stood. */
function lying(run: GameState): { x: number; z: number } {
  const P = run.skier.thrown?.points;
  if (!P) return { x: run.skier.x, z: run.skier.z };
  const a = 3 * RAGDOLL.hipL;
  const b = 3 * RAGDOLL.hipR;
  return { x: (P[a] + P[b]) / 2, z: (P[a + 2] + P[b + 2]) / 2 };
}

/** Where every body left lying lies. */
export const remainsAt = (all: readonly Remains[]): { x: number; z: number }[] =>
  all.map((r) => lying(r.run));

/** Whether a body is left lying at (`x`, `z`). */
export const lyingNear = (spots: readonly { x: number; z: number }[], x: number, z: number) =>
  spots.some((p) => Math.hypot(p.x - x, p.z - z) < SAME);

/** THE REMAINS THE POLICE HAVE TAKEN put out of sight: each body left
 * lying hidden while a call's crew have it. */
export function bagRemains(all: readonly Remains[], calls: readonly Taken[]): void {
  for (const r of all) {
    const at = lying(r.run);
    const gone = calls.some((c) => c.taken && Math.hypot(c.x - at.x, c.z - at.z) < SAME);
    r.body.visible = !gone;
  }
}
