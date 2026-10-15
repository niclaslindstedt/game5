// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ROCK ON THE DROPS — the numbers the rock is laid by (`rocks.ts`,
// `cliff-wall.ts`): where the ground is a wall too steep to hold snow, how
// a cliff's face is clad, how proud and how broken the rock stands, and
// how much of a cliff's wall a skier meets. The drawing
// (`pwa/src/game/rock-shapes.ts`) builds to the same layout, never to
// numbers of its own.
//
// WHAT A REAL CRAG IN WINTER IS (the reference this is built to): the
// whole steep face is COARSE, BROKEN rock — big flat planes at odd angles,
// buttresses and ledges — from where the slope turns too steep for snow
// to where it eases again, the snow lying on the ledges and the top, never
// a rounded snow slope with a few stones poking out of it.

export const ROCKS = {
  /** THE WALLS. The slope (m per m) a wall starts at — 1.15 is 49°,
   * past where the snow shader has turned the ground to rock and steeper
   * than anything skied — and the one it is whole at; the most packed
   * share rock lies on. */
  wall: 1.15,
  whole: 1.5,
  packed: 0.02,
  /** A wall's rock SKIN (drawn, `buildSkin`): a corner every `cell` m
   * (the middle distance's cut `cheap` m), jittered `jitter` of a cell
   * in plan; a bare corner stands `proud` m over the ground plus up to
   * `rough` m by how bare it is, a corner where the snow holds is tucked
   * `sink` m under it, the ledges of its beds (`strata`) on top of that;
   * a cell is laid where a corner is bare past `from`.
   * No corner within `clear` m of packed snow or a bike trail is bare:
   * every facet that can hold a point is laid off corners that near it
   * (a jittered cell's corner is under 1.84 cells — 22 m — off any point it holds), so no
   * facet ever stands over a run or a trail, and the surface a body meets
   * there is the map's — as drawn. */
  skin: {
    cell: 12,
    clear: 23,
    cheap: 16,
    jitter: 0.3,
    proud: 0.15,
    rough: 0.75,
    sink: 0.35,
    from: 0.15,
    /** A facet's up share (its normal's y) snow lies whole on, and the
     * one it slides off below — a facet tipped under 30° holds snow, as
     * painted (`rock-shapes.ts`) and as ridden (`rock-ground.ts`). */
    holds: 0.87,
    slides: 0.67,
  },
  /** THE CLIFFS: a rocky cliff's face clad whole (`cliff-wall.ts`). Its
   * corners every `pitch` m across, out past the full-height edge `ends`
   * of the generator's blend back into the country; rows at the lip, at
   * these shares of the way down the face and at the foot; a corner
   * pushed `out` m (the least and the most) out of the face, a column of
   * corners a BUTTRESS stood up to `buttress` m further out, and never
   * under `proud` m over the ground below it; the lip's corners up to
   * `crown` m proud and out; the skin tucked `behind` m back from the lip
   * and `foot` m past the face, both `sink` m under the snow; where the
   * face stands under `least` m the skin is buried with it; and each row
   * wobbles up and down the face by `wobble` of it. A wall's column's top
   * is kept `lip` m under the edge. */
  face: {
    pitch: 2.6,
    ends: 0.8,
    rows: [0.3, 0.55, 0.8] as const,
    out: [0.2, 0.8] as const,
    buttress: 0.9,
    proud: 0.3,
    crown: 0.35,
    behind: 1.2,
    foot: 0.6,
    sink: 0.25,
    least: 0.8,
    wobble: 0.12,
  },
  /** A WALL'S BEDS (`strata.ts`): the rock is LAYERED. One dip plane the
   * whole massif over, dealt off the map's seed — tipped `dip` rad (the
   * least and the most) toward a heading of its own — and folded `fold` m
   * over `foldOver` m, so a bed's trace runs across a wall and on into the
   * next one as a real band does. The beds are `bed` m thick on the mean;
   * they come in PACKETS — the thickness swelling and thinning `swell` of
   * a bed either way over `packet` beds, so a run of thin beds stands
   * between thick ones — and each bed's foot is dealt `vary` of a bed
   * either way on top of that (the three together keep every bed over a
   * tenth of one thick, so the beds never cross: `bedOf` reads them in
   * order). Each weathers back into a RISER (`riser` of the bed, the least
   * and the most, near vertical and bare) over a TREAD that lies `depth`
   * of the way flat (the least and the most: a deep ledge holds snow, a
   * shallow one sheds it), never standing more than `most` m proud of the
   * ground. Two JOINT SETS cut across the beds every `joints` m (along and
   * across the dip), warped `jointWarp` of a spacing: each block they cut
   * shifts its beds up to `jog` of a bed and stands its ledges `block`
   * deeper or shallower. Far out the beds are drawn `every` few at once, a
   * band of them a ledge (`coarse`). A tread holds snow up to `tread` of
   * the sky further over than a facet as steep.
   *
   * THE RIBS (`ribs`): a face is furrowed down its fall line into
   * BUTTRESSES and the GULLIES between them, `across` m from one to the
   * next and running `along` m down it — a buttress stands up to `relief`
   * m prouder, a gully's floor is smoothed (its ledges `smooth` of the way
   * gone), cut `cut` of the relief back and, in its floor (the rib under
   * `-floor`, all of it by `-1`), holds snow `snow` of the sky further
   * over than a facet as steep: the face's rhythm of bare ribs and narrow
   * white chutes. */
  strata: {
    dip: [0.07, 0.38] as const,
    fold: 7,
    foldOver: 240,
    bed: 11,
    swell: 0.8,
    packet: 5,
    vary: 0.2,
    riser: [0.22, 0.45] as const,
    depth: [0.4, 0.92] as const,
    most: 3.2,
    joints: [13, 24] as const,
    jointWarp: 0.3,
    jog: 0.45,
    block: 0.5,
    coarse: 4,
    tread: 0.26,
    ribs: { across: 30, along: 110, relief: 2.4, smooth: 0.7, cut: 0.45, floor: 0.35, snow: 0.28 },
  },
  lip: 0.35,
  /** WHAT A SKIER MEETS of a cliff's wall: a column inside the face no
   * wider than `widest` m, none lower than `least` m. */
  widest: 1.2,
  least: 0.5,
  /** A SNOWMOBILE driven into a wall's bare rock (`sled.ts`, over
   * `rock-ground.ts`' `rockStrike`, read `reach` m past its nose): a step of
   * stone at `strike` m/s, or up a face of it steeper than `climb` rad (40°)
   * as fast, throws its rider — the paddles have nothing to bite and the
   * skis stop on it. (Kept here, not in `SLED`, which the machine's model is
   * stamped off.) */
  sled: { strike: 7, reach: 0.3, climb: 0.7 },
} as const;
