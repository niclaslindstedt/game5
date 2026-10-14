// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE SNOW BUDGET: where the weighed spray's kilograms came out of the snow
// (`spray-mass-pool.ts`), handed to the deformable snow (`deform-snow.ts`)
// so the hole a skier leaves is made of exactly the snow he threw. Every
// kilogram the emitter throws (an edge's cut, shove and lip, the tips' bow
// wave, a landing's ring, a body's burst) and every kilogram it pushes into
// a berm is filed here as a TAKE: the strip or the disc it left, the volume
// that weighs at the snow's density there, and which way the berm was
// shoved. The field digs that volume out and heaps the berm, and tallies
// the kilograms it dug for the thrown snow — so its `thrown()` and the
// spray's kilograms are one number by construction.
//
// Three-free and DOM-free; a recorder of plain numbers, off unless the
// renderer asks for one skier's (the player's) takes.

/** ONE TAKE: snow out of a strip a→b (`half` m either side of it) or, with
 * `ring`, a disc of radius `half` round a. */
export type SnowTake = {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  half: number;
  ring: boolean;
  /** Which way across the strip the edge slid (the berm goes ahead), a unit
   * vector on the snow; 0, 0 for none. */
  dirX: number;
  dirZ: number;
  /** Kilograms thrown into the air, and the volume they dug, m³. */
  kg: number;
  dug: number;
  /** The berm: kilograms shoved ahead (never thrown), and the volume they
   * dug out of the strip and stand at in the heap, m³. */
  bermKg: number;
  berm: number;
};

const TAKES_MOST = 32;

/** The recorder: `skier` whose emits are filed (null: none); a body's
 * burst is filed whenever the recorder is on, being at a point. */
export const SNOW_TAKES = {
  skier: null as object | null,
  on: false,
  list: Array.from({ length: TAKES_MOST }, (): SnowTake => blankTake()),
  n: 0,
  /** Every kilogram filed since the last `drainTakes`, thrown and shoved. */
  kg: 0,
  bermKg: 0,
};

function blankTake(): SnowTake {
  return {
    ax: 0,
    az: 0,
    bx: 0,
    bz: 0,
    half: 0,
    ring: false,
    dirX: 0,
    dirZ: 0,
    kg: 0,
    dug: 0,
    bermKg: 0,
    berm: 0,
  };
}

/** Start (or stop, `skier` null) filing one skier's takes. */
export function recordTakes(skier: object | null): void {
  SNOW_TAKES.skier = skier;
  SNOW_TAKES.on = skier !== null;
  SNOW_TAKES.n = 0;
  SNOW_TAKES.kg = 0;
  SNOW_TAKES.bermKg = 0;
}

/** File a take (kilograms at their densities, kg/m³); a full list drops it. */
export function fileTake(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  half: number,
  ring: boolean,
  dirX: number,
  dirZ: number,
  kg: number,
  rho: number,
  bermKg = 0,
  bermRho = rho,
): void {
  if (!SNOW_TAKES.on || (kg <= 0 && bermKg <= 0)) return;
  if (SNOW_TAKES.n >= TAKES_MOST) return;
  const t = SNOW_TAKES.list[SNOW_TAKES.n++];
  t.ax = ax;
  t.az = az;
  t.bx = bx;
  t.bz = bz;
  t.half = half;
  t.ring = ring;
  t.dirX = dirX;
  t.dirZ = dirZ;
  t.kg = kg;
  t.dug = kg / Math.max(40, rho);
  t.bermKg = bermKg;
  t.berm = bermKg / Math.max(40, bermRho);
  SNOW_TAKES.kg += kg;
  SNOW_TAKES.bermKg += bermKg;
}

/** The takes filed since the last drain, and the list emptied after `take`. */
export function drainTakes(take: (takes: readonly SnowTake[], n: number) => void): void {
  take(SNOW_TAKES.list, SNOW_TAKES.n);
  SNOW_TAKES.n = 0;
  SNOW_TAKES.kg = 0;
  SNOW_TAKES.bermKg = 0;
}
