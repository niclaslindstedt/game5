// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE ARMY'S HELICOPTER PUTS ITS MEN DOWN — a landing zone near the
// man it hunts, read off the map alone (`army-ground.ts` asks it; the
// flight in `army.ts` flies it).
//
// A helicopter is set down on ground that leans no more than its flight
// manual allows — a few degrees, `ARMY_GROUND.land.slope` over the disc's
// circle (the free ride's own helipad search, `heli-pad.ts`' `leanOver`)
// — with the disc and a margin clear of every trunk, post, wall and rock
// (`solidsNear`), every lift's line and bottom station, the tunnels and
// the water (`clearAt`). Of the places that will do in the ring round him
// (`near` to `far` m) it takes the one nearest `prefer` m off him, AHEAD
// of him where he is moving — where he is going, so the section is put
// down in his way rather than behind him — and not below him, where the
// men would have to climb back up to him. Where nothing in the ring will
// do (a forest, a steep face) it looks for a place clear of trunks round a
// man's drop (`rope.clear`) under a hover the rope reaches: the men come
// down a FAST ROPE.
//
// Pure: a function of the map and where he is, drawing from no stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { ARMY_HELI } from "./defs/army-heli.ts";
import { ARMY_GROUND } from "./defs/army-ground.ts";
import { clearAt, leanOver } from "./heli-pad.ts";
import { solidsNear } from "./posts.ts";
import { ropeHover } from "./army.ts";
import type { GameState } from "./state.ts";

/** A place to put men down: the spot on the snow (m), the heading the
 * machine is set down facing (rad), and whether it is a fast rope's. */
export type LandSpot = { x: number; y: number; z: number; heading: number; rope: boolean };

/** The longest fast rope, m: the hover over the snow it reaches. */
const ROPE_REACH = 22;
const near: number[] = [];

/** A PLACE TO PUT MEN DOWN round (`cx`, `cz`), him moving at (`vx`,
 * `vz`) m/s and stood at height `cy` — outside every circle of `avoid`
 * (another machine's spot, his own machine). Null where neither a landing
 * nor a rope will do. */
export function landingSpot(
  state: GameState,
  cx: number,
  cy: number,
  cz: number,
  vx: number,
  vz: number,
  avoid: readonly { x: number; z: number; r: number }[],
  ring: { near: number; far: number; prefer: number } = ARMY_GROUND.land,
): LandSpot | null {
  const L = { ...ARMY_GROUND.land, ...ring };
  const level = state.level;
  const room = ARMY_HELI.rotor.radius + L.room;
  const edge = room + 40;
  const size = level.size;
  const run = hypot(vx, vz);
  const ux = run > 3 ? vx / run : 0;
  const uz = run > 3 ? vz / run : 0;
  const cost = (x: number, z: number, y: number): number => {
    const d = hypot(x - cx, z - cz);
    const ahead = d > 1 ? ((x - cx) * ux + (z - cz) * uz) / d : 0;
    return Math.abs(d - L.prefer) - L.ahead * ahead + 2 * Math.max(0, cy - 15 - y);
  };
  let best: { x: number; z: number; y: number; c: number } | null = null;
  let rope: { x: number; z: number; y: number; c: number } | null = null;
  const ok = (x: number, z: number): boolean => {
    if (x < edge || z < edge || x > size - edge || z > size - edge) return false;
    const d = hypot(x - cx, z - cz);
    if (d < L.near || d > L.far) return false;
    return !avoid.some((a) => hypot(a.x - x, a.z - z) < a.r);
  };
  for (let dz = -L.far; dz <= L.far; dz += L.grid) {
    for (let dx = -L.far; dx <= L.far; dx += L.grid) {
      const x = cx + dx;
      const z = cz + dz;
      if (!ok(x, z)) continue;
      const y = level.groundAt(x, z);
      const c = cost(x, z, y);
      if (best && c >= best.c) continue;
      if (leanOver(level, x, z, room) <= L.slope && clearAt(level, x, z, room)) {
        if (solidsNear(level, x, z, room, near).length === 0) {
          best = { x, z, y, c };
          continue;
        }
      }
      // A rope's: clear round a man's drop, under a hover the rope reaches.
      if (rope && c >= rope.c) continue;
      if (solidsNear(level, x, z, ARMY_GROUND.rope.clear, near).length > 0) continue;
      if (ropeHover(state, x, z, y) - y > ROPE_REACH) continue;
      rope = { x, z, y, c };
    }
  }
  const at = best ?? rope;
  if (!at) return null;
  return {
    x: at.x,
    y: at.y,
    z: at.z,
    // Set down side on to him: a door each way, the one toward him first.
    heading: Math.atan2(cx - at.x, cz - at.z) + Math.PI / 2,
    rope: !best,
  };
}
