// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE STAGE IS FREE: the part of the rider and gear cards' stage the
// card's covers leave, which the skier is framed in. DOM-free, so the suite
// reads it.

import type { FreeRect } from "./gear-stage.ts";

/** The share of the stage a cover must span to count as a band across it
 * (a head, a sheet at the foot) rather than a panel down one side. */
const BAND = 0.6;

/** WHERE THE PICTURE IS FREE: the stage less the covers over it — a panel
 * down one side takes its side, a band across the top or foot its height. */
export function freeOf(
  stage: { left: number; top: number; width: number; height: number },
  covers: readonly { left: number; top: number; width: number; height: number }[],
): FreeRect {
  let x0 = 0;
  let x1 = stage.width;
  let y0 = 0;
  let y1 = stage.height;
  for (const c of covers) {
    if (c.width <= 0 || c.height <= 0) continue;
    const l = c.left - stage.left;
    const t = c.top - stage.top;
    const r = l + c.width;
    const b = t + c.height;
    if (c.width >= BAND * stage.width) {
      if (t + c.height / 2 < stage.height / 2) y0 = Math.max(y0, b);
      else y1 = Math.min(y1, t);
    } else if (l + c.width / 2 > stage.width / 2) x1 = Math.min(x1, l);
    else x0 = Math.max(x0, r);
  }
  const w = Math.max(stage.width * 0.25, x1 - x0);
  const h = Math.max(stage.height * 0.25, y1 - y0);
  return {
    x: Math.min(x0, stage.width - w) / stage.width,
    y: Math.min(y0, stage.height - h) / stage.height,
    w: w / stage.width,
    h: h / stage.height,
  };
}
