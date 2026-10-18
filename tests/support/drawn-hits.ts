// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SKIED INTO WHAT IS DRAWN: a skier sent at one of a kind of the drawing's
// solids (`drawnKinds`, `pwa/src/game/drawn-solids.ts`) — whether he meets
// it. Shared by the suites that hold the drawing solid.

import {
  createGame,
  placeRun,
  solidsOf,
  step,
  type GameMode,
  type Level,
  type Upright,
} from "@engine";

import { drawnKinds } from "../../pwa/src/game/drawn-solids.ts";
import { holdInput } from "../../pwa/src/game/hold-input.ts";

/** How near (x, z) passes the segment from a to b in plan, m. */
function offLine(x: number, z: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(x - ax - dx * k, z - az - dz * k);
}

/** Where a skier was sent from and the post he met. */
export type Meeting = { x: number; z: number; heading: number; post: Upright };

/** Whether a skier sent at one of `kind` meets it (`meeting`). */
export function meets(level: Level, kind: string, mode?: GameMode): boolean {
  return meeting(level, kind, mode) !== null;
}

/** SKIED AT ONE OF `kind`: a skier at 8 m/s sent straight at each of its
 * first posts (those `pick` keeps) from up the slope round it, along a way
 * nothing else stands in — where he was sent from when a `hit` on one of
 * that kind's posts comes of it, null when none does. */
export function meeting(
  level: Level,
  kind: string,
  mode?: GameMode,
  pick: (u: Upright) => boolean = () => true,
): Meeting | null {
  const list = drawnKinds(level).get(kind) ?? [];
  // The engine keeps its own copy: a post is known by where it stands.
  const kin = new Set(list.map((u) => `${u.x},${u.z}`));
  const all = solidsOf(level);
  for (const t of list.filter((u) => u.height > 1.2 && pick(u)).slice(0, 12)) {
    const back = 3.5 + t.radius;
    const at = (a: number) => ({ x: t.x + Math.sin(a) * back, z: t.z + Math.cos(a) * back });
    const ways = Array.from({ length: 8 }, (_, k) => (k / 8) * Math.PI * 2);
    const high = (a: number) => level.groundAt(at(a).x, at(a).z);
    ways.sort((p, q) => high(q) - high(p));
    for (const a of ways) {
      const { x, z } = at(a);
      const g = level.groundAt(x, z);
      const clear = (u: Upright) =>
        kin.has(`${u.x},${u.z}`) ||
        u.y > g + 2 ||
        u.y + u.height < g ||
        offLine(u.x, u.z, x, z, t.x, t.z) > u.radius + 0.7;
      if (!all.every(clear)) continue;
      const s = createGame({ seed: level.seed, level, mode });
      placeRun(s, { x, z, heading: a + Math.PI, speed: 8 });
      for (let i = 0; i < 150; i++) {
        step(s, holdInput(s, 29, a + Math.PI));
        if (s.events.some((e) => e.kind === "hit" && kin.has(`${e.x},${e.z}`)))
          return { x, z, heading: a + Math.PI, post: t };
      }
      break;
    }
  }
  return null;
}
