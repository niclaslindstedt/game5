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
   * (the FOREST row's cheap picture `cheap` m), jittered `jitter` of a cell
   * in plan; a bare corner stands `proud` m over the ground plus up to
   * `rough` m by how bare it is, a corner where the snow holds is tucked
   * `sink` m under it; a cell is laid where a corner is bare past `from`. */
  skin: {
    cell: 4,
    cheap: 6,
    jitter: 0.35,
    proud: 0.15,
    rough: 0.75,
    sink: 0.35,
    from: 0.15,
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
  lip: 0.35,
  /** WHAT A SKIER MEETS of a cliff's wall: a column inside the face no
   * wider than `widest` m, none lower than `least` m. */
  widest: 1.2,
  least: 0.5,
} as const;
