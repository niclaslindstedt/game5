// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORLD LAB'S MARK VIEWS (`make world ARGS=--views=gate,hut,finish`):
// the course's marks (`mark-shapes.ts`, placed by `gates.ts`) as a skier
// meets them, close enough to judge a facet by.
//
//   * gate — the panel gate on the skier's right at the middle gate of the
//     course, from a few metres up the piste and to its side;
//   * hut — the start hut off the start gate's left edge, from down the
//     piste on the far side, its window to the lens;
//   * finish — the arch over the finish line, from up the last straight.

import type { Level } from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { ARCH, archPlan } from "../game/start-arch.ts";

export type MarkViewName = "gate" | "hut" | "finish";

export function markView(
  level: Level,
  name: MarkViewName,
): { pose: LensPose; note: string } | null {
  const cps = level.checkpoints;
  if (cps.length < 3) return null;
  const k = name === "gate" ? Math.floor(cps.length / 2) : name === "hut" ? 0 : cps.length - 1;
  const cp = cps[k];
  const fx = Math.sin(cp.heading);
  const fz = Math.cos(cp.heading);
  // The skier's right: forward turned clockwise a quarter.
  const rx = fz;
  const rz = -fx;
  const half = cp.width / 2 + 1;
  const at = (x: number, z: number, up: number) => ({ x, y: level.groundAt(x, z) + up, z });
  if (name === "gate") {
    const gx = cp.x + rx * half;
    const gz = cp.z + rz * half;
    return {
      pose: {
        eye: at(gx - fx * 3.5 - rx * 1.6, gz - fz * 3.5 - rz * 1.6, 1.6),
        target: at(gx, gz, 1.1),
        fov: 50,
        roll: 0,
      },
      note: `the ${cp.colour} panel gate at gate ${k}`,
    };
  }
  if (name === "hut") {
    // Where `gates.ts` stands it: off the line's left edge, a little down.
    const hx = cp.x - rx * (half + 2.5) + fx * 1.5;
    const hz = cp.z - rz * (half + 2.5) + fz * 1.5;
    return {
      pose: {
        eye: at(hx + fx * 7 + rx * 5, hz + fz * 7 + rz * 5, 1.8),
        target: at(hx, hz, 1.3),
        fov: 55,
        roll: 0,
      },
      note: "the start hut and the wand",
    };
  }
  const a = archPlan(level, cp);
  return {
    pose: {
      eye: at(cp.x - fx * 32 + rx * 3, cp.z - fz * 32 + rz * 3, 2.2),
      target: { x: cp.x, y: a.top - ARCH.top * 0.6, z: cp.z },
      fov: 50,
      roll: 0,
    },
    note: "the finish arch from up the last straight",
  };
}
