// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK ON THE DROPS — the numbers the crags are stood by (`rocks.ts`):
// where an outcrop may stand on a wall too steep to ski, how big and how
// many blocks, how a cliff's face is broken, and how much of a block a
// skier meets. The drawing (`pwa/src/game/rock-shapes.ts`) builds every
// block to the same layout (`rockBlock`), never to numbers of its own.
//
// WHAT A REAL CRAG IN WINTER IS (the reference this is built to): COARSE,
// BROKEN rock — blocks and slabs about as wide as they are tall, packed
// together in OUTCROPS, longer along the bedding (the STRIKE: along a
// cliff's edge, along a wall's contour) and tipped a little out of the
// face (the DIP), snow on every facet that faces up enough to hold it.

export const ROCKS = {
  /** THE WALLS. The lattice an outcrop may stand on, m (one jittered point
   * a cell), the slope (m per m) the wall starts at — 1.3 is 52°, steeper
   * than anything skied — and the one it is whole at. */
  cell: 5,
  wall: 1.3,
  whole: 1.7,
  /** At a whole wall, the chance a cell carries an outcrop. */
  density: 0.5,
  /** The most packed share an outcrop stands on. */
  packed: 0.02,
  /** No block within this of a trunk, m. */
  trunk: 3,
  /** A wall's biggest block, m, from just steep enough to whole. */
  low: 0.6,
  high: 2.2,
  /** Blocks a knot, the least and the most. */
  fewest: 2,
  most: 3,
  /** THE CLIFFS. Blocks across the face every `pitch` m, in rows at these
   * shares of the way from the lip down to the foot; the tallest a share
   * of the drop, its tip kept `lip` m under the edge. */
  pitch: 3.2,
  rows: [0.3, 0.62] as const,
  tall: [0.22, 0.42] as const,
  lip: 0.35,
  /** A cliff's knot's blocks, the least and the most. */
  cliffFewest: 2,
  cliffMost: 3,
  /** The dip out of plumb, rad: the least and the most (walls), and a
   * cliff's blocks — further out, so they jut from the wall. */
  dip: [0.25, 0.6] as const,
  cliffDip: [0.5, 0.85] as const,
  /** THE BLOCKS. The share of a knot's standing blocks that are SLABS
   * (run out along the strike, this much longer), and how deep a block's
   * foot is sunk: `sink` m and `sinkShare` of its height. */
  slabs: 0.3,
  slab: 1.5,
  sink: 0.2,
  sinkShare: 0.18,
  /** WHAT A SKIER MEETS: each standing block as a column (`Upright`) of
   * this share of its foot's mean half-width — a block's corners and its
   * tapering top are more than he would ever strike — never wider than
   * `widest` m (a cliff's big blocks are struck on their near flank, and a
   * wider column would stand out over the landing), and none lower than
   * `least` m over the snow, which he rides over. */
  meet: 0.75,
  widest: 1.2,
  least: 0.5,
} as const;
