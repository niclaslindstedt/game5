// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DRAWN SKIS MOVED WITH THEIR BOOTS after the figure is posed
// (`skis-body.ts`): the steps in a balloon's basket, a pose layer's moves
// of each ski (`SkiSwing` — the skydive's squared skis, the dangle off a
// skid, the ski jumper's V and telemark) and each ski's yaw about its
// binding (`Stand.yaw`, which `ski-gear.ts` and `ski-rig.ts` both turn
// by). Three-free; presentation only.

import type { SkiSwing } from "./skier-dangle.ts";
import type { Stand } from "./ski-stand.ts";

/** HIS STEPS IN A BALLOON'S BASKET (`setBasket`): strides walked, and the
 * pace, 0 stood … 1 a full shuffle. */
export type BasketWalk = { strides: number; pace: number };

/** A stride in the basket: each boot swung this far fore and aft of its
 * place, m, and lifted this far at the swing's top, m, at a full pace — a
 * short shuffle in ski boots on a wicker floor. */
const BASKET_STEP = { swing: 0.17, lift: 0.07 };

/** THE BOOTS STEPPED: each boot of `stand` swung and lifted through the
 * stride, the two half a stride apart. */
export function stepBoots(stand: Stand, walk: BasketWalk): void {
  const pace = Math.max(0, Math.min(1, walk.pace));
  if (pace < 0.01) return;
  for (let i = 0; i < 2; i++) {
    const p = (walk.strides + i * 0.5) * Math.PI * 2;
    stand.fore[i] += BASKET_STEP.swing * pace * Math.sin(p);
    stand.lift[i] += BASKET_STEP.lift * pace * Math.max(0, Math.cos(p));
  }
}

/** Each ski of `stand` moved and turned with its boot (`SkiSwing`), and
 * yawed about its binding by `yaw`, rad (clockwise from above) where a
 * layer opens the pair into a V. */
export function swingStand(
  stand: Stand,
  skis: readonly [SkiSwing, SkiSwing],
  yaw?: readonly [number, number],
): void {
  for (let i = 0; i < 2; i++) {
    stand.out[i] += skis[i].dx;
    stand.lift[i] += skis[i].dy;
    stand.fore[i] += skis[i].dz;
    stand.pitch[i] += skis[i].pitch;
    stand.rock[i] += skis[i].rock;
    if (yaw) stand.yaw[i] += yaw[i];
  }
}
