// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE as the run holds it (`avalanche.ts`) — types of their own so
// `state.ts` can carry them without importing the step that moves them.

import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";

/** One flow parcel's slots in `Slide.cells` (a stride of `CELL` numbers):
 * where it is (plan, m), its velocity (plan, m/s), its flow height (m),
 * the volume of slab it carries (m³), whether it still runs (1) or has
 * come to rest (0), and where across the slab it broke from, −1 (the right
 * flank) … 1 (the left) — what fans it out. */
export const CELL = { x: 0, z: 1, vx: 2, vz: 3, h: 4, vol: 5, run: 6, side: 7, stride: 8 } as const;

/** WHERE A SLAB BROKE: the crown's middle (plan, m), the fall line it ran
 * down (a unit plan vector, downhill), how far each flank lies from the
 * crown's middle across it (m, the left one along (fz, −fx)), how far
 * down the fall line its stauchwall lies (m) and its thickness (m). What
 * a bed remembers so the same slope does not slide twice, and what the
 * renderer draws the crown, the flanks and the bed surface from. */
export type SlabFrame = {
  x: number;
  y: number;
  z: number;
  fx: number;
  fz: number;
  left: number;
  right: number;
  length: number;
  depth: number;
};

/** ONE AVALANCHE: the slab it broke from, and its flow — `count` parcels in
 * `cells` — running or come to rest as debris. `id` counts the run's
 * avalanches from 1; `t` is the seconds since it released; `moving` how
 * many parcels still run; `front` the fastest parcel's speed now and
 * `top` the fastest any reached, m/s; `runout` how far down the fall line
 * from the crown the furthest parcel has gone, m; `volume` the slab's
 * volume, m³. `involved` is whether the skier was on the slab or came
 * near the flow, `caught` whether it took him, `escaped` whether he got
 * clear of it; `away` the seconds an involved skier has been clear of
 * every running parcel. */
export type Slide = {
  id: number;
  slab: SlabFrame;
  t: number;
  count: number;
  cells: Float64Array;
  moving: number;
  front: number;
  top: number;
  runout: number;
  volume: number;
  running: boolean;
  involved: boolean;
  caught: boolean;
  escaped: boolean;
  away: number;
  /** THE DEBRIS LYING, as the running parcels meet it: the first parcel
   * at rest in each bucket of the plan (`AVALANCHE.pile.bucket` m square,
   * keyed by `bucketKey`), and each parcel's next in its bucket (−1 the
   * last). */
  heap: Map<number, number>;
  next: Int32Array;
};

/** THE SKIER THE FLOW TOOK: `carried` while it runs with him, `buried`
 * once it has put him down under `depth` m of debris (his head under),
 * `lost` once his air has run out. `t` is the seconds in this phase, `air`
 * the seconds of the run he can live buried (dealt off the survival
 * curve, compressed by `AVALANCHE.timeScale`), `clear` the seconds since
 * the parcel carrying him (`parcel`, its index in `Slide.cells`) came to
 * rest; `x`, `z` where he lies. */
export type AvalancheVictim = {
  slide: number;
  parcel: number;
  phase: "carried" | "buried" | "lost";
  t: number;
  depth: number;
  air: number;
  clear: number;
  x: number;
  z: number;
};

/** THE AVALANCHES of a free ride that asked for them. `rng` is their own
 * stream; `load` the run's slab load now, 0..1 (the day, the new snow and
 * the dial); `travel` the metres crossed since the hazard was last
 * probed; `quiet` the seconds before another slab may go; `slide` the
 * avalanche running or the last one's debris; `beds` the slabs already
 * released (the newest last); `victim` the skier it took, if it did;
 * `count` how many have released. */
export type AvalancheState = {
  rng: Rng;
  load: number;
  travel: number;
  quiet: number;
  slide: Slide | null;
  beds: SlabFrame[];
  victim: AvalancheVictim | null;
  count: number;
};

/** THE AVALANCHE'S EVENT (`avalanche.ts`): a slab broke (`release`), the
 * flow took the skier (`caught`), put him down under the debris
 * (`buried`, at `depth` m) or let him up with his head out (`surfaced`),
 * he got away from it (`escaped`), the flow came to rest (`stopped`), his
 * air ran out (`lost`), or he was taken out of it (`freed`, a reset).
 * `id` names the avalanche; `size` its slab's volume, m³; where it
 * happened, plan m. */
export type AvalancheEvent = {
  kind: "avalanche";
  t: number;
  phase: "release" | "caught" | "buried" | "surfaced" | "escaped" | "stopped" | "lost" | "freed";
  id: number;
  x: number;
  z: number;
  size: number;
  depth: number;
};
