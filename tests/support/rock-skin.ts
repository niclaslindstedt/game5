// A map's rock as the drawing builds it (`pwa/src/game/rock-shapes.ts`),
// every tile that holds rock at one cut — what the suite counts and holds
// to the surface the physics rides.

import { ROCK_FIELD, noRockIn, rockFieldOf, type Level } from "@engine";

import {
  rockMesh,
  startTile,
  stepTile,
  type RockCut,
  type RockMesh,
  type Tone,
} from "../../pwa/src/game/rock-shapes.ts";

/** `level`'s rock at `cut` (and sliding to `next`), into one mesh; only the
 * tiles `keep` says yes to (every one by default). */
export function rockSkinOf(
  level: Level,
  tone: Tone,
  cut: RockCut,
  next: RockCut | null,
  keep: (x0: number, z0: number) => boolean = () => true,
): { mesh: RockMesh; tiles: number; centres: { x: number; z: number }[] } {
  const field = rockFieldOf(level);
  const T = ROCK_FIELD.tile;
  const cols = Math.ceil(level.size / T);
  const mesh = rockMesh();
  let tiles = 0;
  const centres: { x: number; z: number }[] = [];
  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = i * T;
      const z0 = j * T;
      if (noRockIn(field, x0, z0, x0 + T, z0 + T) || !keep(x0, z0)) continue;
      const b = startTile(field, tone, x0, z0, T, cut, next);
      stepTile(b, () => true);
      const m = b.mesh!;
      for (const k of Object.keys(mesh) as (keyof RockMesh)[]) {
        for (const v of m[k]) mesh[k].push(v);
      }
      tiles++;
      centres.push({ x: x0 + T / 2, z: z0 + T / 2 });
    }
  }
  return { mesh, tiles, centres };
}
