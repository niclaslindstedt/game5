// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW DEEP A RIDER STANDS IN THE DRAWN SNOW: the furrow the trail map cuts
// is deeper than the physics' own sink under the boots, so the figure is
// let down into it — none with the trails off (`cut`); a board floats on
// its own (`boardRideSink`). On bare rock (`bare-rock.ts`) no furrow is cut
// and no loose cover lies to stand in, so he is lifted onto the drawn
// ground instead. Three-free; the renderer eases toward it.

import type { Level, SkierState } from "@engine";

import type { BareRock } from "./bare-rock.ts";
import { boardRideSink } from "./board-input.ts";
import { drawnDepth, LOOSE, type SnowSampler } from "./trail-stamp.ts";

export function rideSink(
  skier: SkierState,
  level: Pick<Level, "groundAt" | "packedAt">,
  depth: number,
  cut: boolean,
  snowAt?: SnowSampler,
  bare?: BareRock | null,
): number {
  if (skier.spec.board) return boardRideSink(skier, level, depth, cut, snowAt);
  if (!cut) return 0;
  let sum = 0;
  let lift = 0;
  let n = 0;
  for (const c of skier.contacts) {
    if (c.station !== "mid" || !c.touching) continue;
    const packed = level.packedAt(c.x, c.z);
    const rock = bare ? bare(c.x, c.z) : 0;
    // The drawn surface under the probe is the loose cover over the ground
    // less the furrow; the physics has it at the ground less its own sink.
    const under = c.sink + LOOSE * (1 - packed);
    sum += (1 - rock) * (drawnDepth(c, packed, 1, depth, snowAt?.(c.x, c.z)) - under);
    lift += rock * under;
    n++;
  }
  return n > 0 ? Math.max(-0.1, Math.min(0.2, (sum / n) * 0.85)) - lift / n : 0;
}
