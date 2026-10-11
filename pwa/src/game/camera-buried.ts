// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LENS UNDER THE SNOW (`avalanche-rescue.ts`): while the player lies
// buried, the picture is HIS — dark and close, the HUD's veil over it
// (`hud-beacon.tsx`'s `BuriedVeil`) and only the air clock to read — until
// the patrol's shovels reach him. Then the lens PULLS UP OUT OF THE SNOW:
// from just over the debris above his head it rises and backs off uphill
// as the hole goes down, looking into it at him and at the two digging in
// from below, the veil lifting with it. Three-free, so the suite reads it;
// `machines.ts` hands it to the renderer ahead of the ladder.

import type { AvalancheState, GameState } from "@engine";
import { clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";

import type { LensPose } from "./camera-rigs.ts";

/** The lens's numbers, m and degrees: how high over the snow it starts and
 * ends, how far uphill of him it backs off, and its field of view. */
export const BURIED_LENS = { from: 0.25, to: 3.2, back: [0.6, 3.4], fov: 62 } as const;

const smooth = (x: number): number => {
  const c = clamp(x, 0, 1);
  return c * c * (3 - 2 * c);
};

/** How far the shovels have dug down to the player, 0..1. */
export function dugToHim(a: AvalancheState): number {
  for (const b of a.burials) {
    if (b.who === "player" && b.phase === "buried")
      return b.depth > 0 ? clamp(b.dug / b.depth, 0, 1) : 0;
  }
  return 0;
}

/** Whether the player is under the snow (buried, or lost and not yet taken
 * back). */
export function buriedNow(state: GameState): boolean {
  const v = state.avalanche?.victim;
  return !!v && v.phase !== "carried" && !!state.skier.thrown;
}

/**
 * THE LENS while he lies buried, written into `out`, or null when he is
 * not. `surface` is the drawn snow's height at a point (the debris, the
 * hole). The share the patrol has dug down to him (`dugToHim`) is how
 * far it has come up out of the snow.
 */
export function buriedLens(
  state: GameState,
  surface: (x: number, z: number) => number,
  out: LensPose,
): LensPose | null {
  if (!buriedNow(state)) return null;
  const a = state.avalanche!;
  const v = a.victim!;
  const level = state.level;
  const reach = smooth(dugToHim(a) / 0.85);
  // Up the fall line from him: the patrol digs in from below.
  const n = { x: 0, y: 1, z: 0 };
  level.normalAt(v.x, v.z, n);
  const fl = hypot(n.x, n.z);
  const fx = fl > 1e-6 ? n.x / fl : 0;
  const fz = fl > 1e-6 ? n.z / fl : 1;
  const back = BURIED_LENS.back[0] + (BURIED_LENS.back[1] - BURIED_LENS.back[0]) * reach;
  const ex = v.x - fx * back;
  const ez = v.z - fz * back;
  const rise = BURIED_LENS.from + (BURIED_LENS.to - BURIED_LENS.from) * reach;
  out.eye.x = ex;
  out.eye.y = Math.max(surface(ex, ez), level.groundAt(ex, ez)) + rise;
  out.eye.z = ez;
  // Looking down into the hole at him, and on past him toward the diggers
  // as it opens.
  out.target.x = v.x + fx * 1.2 * reach;
  out.target.y = level.groundAt(v.x, v.z) + 0.3;
  out.target.z = v.z + fz * 1.2 * reach;
  out.fov = BURIED_LENS.fov;
  out.roll = 0;
  return out;
}
