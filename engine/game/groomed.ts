// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROOMED SNOW — what the piste machines' tillers (`groomer.ts`) leave
// behind them, as the physics feels it. A sparse grid of 2 m cells: every
// cell a tiller has passed over is snow milled, pressed and combed, packed
// whatever lay there before, and holds the new snow (`GameState.fresh`)
// there was when it was groomed — so the fall that has come since is all
// that lies on it, where the day's piste is buried under the whole of it.
// Read through `snow.ts`'s `packedSnow`; a run with no machines has no grid
// and reads the map's own packed field, as it always did.

import type { GroomedSnow } from "./groomer-state.ts";

/** The cell's side, m. */
export const GROOM_CELL = 2;
/** Cells a row: far more than any map has, so a key is one number. */
const ROW = 1 << 16;

/** The key of the cell a plan point is in. */
export function groomCellOf(x: number, z: number): number {
  return Math.floor(x / GROOM_CELL) * ROW + Math.floor(z / GROOM_CELL);
}

/** A grid nothing has groomed yet. */
export function freshGroomed(): GroomedSnow {
  return { cells: new Map() };
}

/** THE TILLER PASSED from (ax, az) to (bx, bz), `half` m either side of
 * that line, with `fresh` m of new snow on the run: every cell whose middle
 * it covered is groomed now. */
export function groomSegment(
  g: GroomedSnow,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  half: number,
  fresh: number,
): void {
  const C = GROOM_CELL;
  const x0 = Math.floor((Math.min(ax, bx) - half) / C);
  const x1 = Math.floor((Math.max(ax, bx) + half) / C);
  const z0 = Math.floor((Math.min(az, bz) - half) / C);
  const z1 = Math.floor((Math.max(az, bz) + half) / C);
  const ex = bx - ax;
  const ez = bz - az;
  const ee = ex * ex + ez * ez;
  for (let i = x0; i <= x1; i++) {
    for (let j = z0; j <= z1; j++) {
      const px = (i + 0.5) * C;
      const pz = (j + 0.5) * C;
      const h = ee > 1e-9 ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / ee)) : 0;
      const dx = px - ax - ex * h;
      const dz = pz - az - ez * h;
      if (dx * dx + dz * dz <= half * half) g.cells.set(i * ROW + j, fresh);
    }
  }
}

/** The new snow there was when the cell under (x, z) was groomed, m — or
 * undefined where no tiller has been. */
export function groomedFresh(g: GroomedSnow, x: number, z: number): number | undefined {
  return g.cells.get(groomCellOf(x, z));
}
