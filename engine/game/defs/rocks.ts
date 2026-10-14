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
   * `sink` m under it; a cell is laid where a corner is bare past `from`.
   * No corner within `clear` m of packed snow or a bike trail is bare:
   * every facet that can hold a point is laid off corners that near it
   * (a jittered cell's corner is under 10 m off any point it holds), so no
   * facet ever stands over a run or a trail, and the surface a body meets
   * there is the map's — as drawn. */
  skin: {
    cell: 4,
    clear: 10,
    cheap: 6,
    jitter: 0.35,
    proud: 0.15,
    rough: 0.3,
    sink: 0.35,
    from: 0.15,
    /** A facet's up share (its normal's y) snow lies whole on, and the
     * one it slides off below — a facet tipped under 30° holds snow, as
     * painted (`rock-shapes.ts`) and as ridden (`rock-ground.ts`). */
    holds: 0.87,
    slides: 0.67,
  },
  /** THE ROCK KIT (`rock-kit.ts`): the wall built of PIECES — slabs,
   * buttress prisms, blocks — and the TALUS under it. Candidates every
   * `step` m in cells of `cell` m (the big blocks every `big` m); a wall
   * piece stands where the wall is bare past `wall`, `density` of the big
   * candidates at the most and `rubble` of the small. The wall is
   * BEDDED: beds `bed` m thick (the least and the most), dipping up to
   * `dip` rad along the strike; a piece is a STEP, turned `terrace` of
   * the way from the face toward the vertical about the strike, its riser
   * `proud` m out of the ground (the least and the most, ribs the most),
   * the back of its tread `bury` m under it and its foot `foot` m; RIBS and
   * GULLIES every `rib` m along the face. The TALUS: below a wall within
   * `reach` m (up the fall line), on ground no steeper than `slope` (m per
   * m) and no gentler than `gentle`, `scree` of the candidates at the
   * most, a block `stone` m across at the wall's foot and up to `toe` m
   * at the reach (sorted by size, the big ones run out furthest), and
   * `buried` of it under the snow (the least and the most). */
  kit: {
    cell: 24,
    big: 6,
    step: 4,
    wall: 0.3,
    density: 1,
    rubble: 0.12,
    bed: [2.4, 4.6] as const,
    dip: 0.38,
    terrace: 0.7,
    proud: [0.7, 2.2] as const,
    bury: 0.25,
    foot: 0.4,
    rib: 34,
    reach: 40,
    slope: 1.12,
    gentle: 0.42,
    scree: 0.34,
    stone: 0.7,
    toe: 3.4,
    buried: [0.35, 0.6] as const,
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
  /** A SNOWMOBILE driven into a wall's bare rock (`sled.ts`, over
   * `rock-ground.ts`' `rockStrike`, read `reach` m past its nose): a step of
   * stone at `strike` m/s, or up a face of it steeper than `climb` rad (40°)
   * as fast, throws its rider — the paddles have nothing to bite and the
   * skis stop on it. (Kept here, not in `SLED`, which the machine's model is
   * stamped off.) */
  sled: { strike: 7, reach: 0.3, climb: 0.7 },
} as const;
