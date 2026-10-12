// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW DEEP A RIDER STANDS IN THE DRAWN SNOW: the furrow the trail map cuts
// is deeper than the physics' own sink under the boots, so the figure is
// let down into it — none with the trails off (`cut`); a board floats on
// its own (`boardRideSink`). Three-free; the renderer eases toward it.

import type { Level, SkierState } from "@engine";

import { boardRideSink } from "./board-input.ts";
import { drawnDepth, LOOSE, type SnowSampler } from "./trail-stamp.ts";

export function rideSink(
  skier: SkierState,
  level: Pick<Level, "groundAt" | "packedAt">,
  depth: number,
  cut: boolean,
  snowAt?: SnowSampler,
): number {
  if (skier.spec.board) return boardRideSink(skier, level, depth, cut, snowAt);
  if (!cut) return 0;
  let sum = 0;
  let n = 0;
  for (const c of skier.contacts) {
    if (c.station !== "mid" || !c.touching) continue;
    const packed = level.packedAt(c.x, c.z);
    // The drawn surface under the probe is the loose cover over the ground
    // less the furrow; the physics has it at the ground less its own sink.
    sum += drawnDepth(c, packed, 1, depth, snowAt?.(c.x, c.z)) - c.sink - LOOSE * (1 - packed);
    n++;
  }
  return n > 0 ? Math.max(-0.1, Math.min(0.2, (sum / n) * 0.85)) : 0;
}
