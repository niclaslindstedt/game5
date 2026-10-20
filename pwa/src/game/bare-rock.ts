// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE GROUND IS DRAWN AS BARE ROCK — the share of it `snow-glsl.ts`'s
// `snowRock` paints a face too steep to hold snow with (the region's
// `rock`: none under its `from` slope, whole at its `to`, none on packed
// snow), restated off the map for what is laid ON the snow. Rock takes no
// furrow and throws no spray: a ski skied across it leaves nothing, where
// it used to leave the trail's grey troughs on the stone.
//
// Presentation only, like the shader it restates: the physics' snow is
// its own (`engine/game/snow.ts`). Three-free and DOM-free.

import { regionOf, type Level } from "@engine";

import { regionLookOf } from "./region-look.ts";
import { sloughOf, TRAIL, type Stamp } from "./trail-stamp.ts";

/** How much of the ground at (x, z) is drawn as bare rock, 0..1. */
export type BareRock = (x: number, z: number) => number;

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** The drawn rock of `level`, or null where its region lays none. */
export function bareRockOf(
  level: Pick<Level, "normalAt" | "packedAt" | "region">,
): BareRock | null {
  const rock = regionLookOf(regionOf(level).id).rock;
  if (!rock) return null;
  const n = { x: 0, y: 1, z: 0 };
  return (x, z) => {
    level.normalAt(x, z, n);
    const slope = Math.hypot(n.x, n.z) / Math.max(1e-3, n.y);
    const packed = Math.min(1, Math.max(0, level.packedAt(x, z)));
    return smooth(rock.from, rock.to, slope) * (1 - packed);
  };
}

/** Under this share of snow a stamp is dropped rather than pressed. */
const NONE = 0.02;

/** THE STAMPS FROM `from` ON, laid on the snow alone: each pressed by the
 * share of the ground under its ends that is snow, and dropped where
 * there is next to none. */
export function offRock(stamps: Stamp[], bare: BareRock | null, from = 0): void {
  if (!bare) return;
  let w = from;
  for (let k = from; k < stamps.length; k++) {
    const s = stamps[k];
    const snow = 1 - Math.max(bare(s.ax, s.az), bare(s.bx, s.bz));
    if (snow <= NONE) continue;
    if (snow < 1) {
      s.depth *= snow;
      s.berm *= snow;
      if (s.slough !== undefined) s.slough = sloughOf(s.half, s.depth, s.wall ?? TRAIL.wall);
    }
    stamps[w++] = s;
  }
  stamps.length = w;
}
