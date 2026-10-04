// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE LIGHTS — the floodlight masts a ski area stands along its runs
// for skiing after dark, and the light they lay on the snow: where every
// mast stands, how tall, how many lamps it carries and where each is aimed
// (`planPisteLights`), how much a lamp sends which way (`intensityOf`), and
// the light on the ground over the whole map baked once (`bakePisteLight`),
// which the snow, the woods, the falling snow and the cloud read
// (`piste-lights.ts`, `haze.ts`'s `pisteLight`). Three-free and DOM-free,
// so the suite holds the layout to the standard it is built to.
//
// RESEARCHED, not guessed — how a lit piste is built:
//   * HOW BRIGHT: the European sports-lighting standard's recreational
//     class for alpine skiing (class III) asks 20 lx on average over the
//     piste and never under 4 lx; a public night piste is laid out for
//     30–50 lx, a training or race slope for 100–300 lx. Measured after a
//     real retrofit to LED: some 2 foot-candles — about 21 lx — at masts of
//     25 ft. So the target here is 30 lx, and the suite holds the class.
//   * HOW FAR APART: about 50 m between masts down a 40 m piste; 150–300 ft
//     (45–90 m) in the North American guides, and never more than about
//     seven times the light point's height.
//   * HOW TALL: the lamps at least 7.6 m over the snow; 8–12 m along a
//     narrow run, 16–20 m beside a broad main piste — the wider the piste,
//     the higher the light point, so the far side is not lit at a graze.
//   * ON ONE SIDE: a lamp on each side aimed across is the ideal, but masts
//     stand on one side wherever it will do — both only past some 70 m of
//     width.
//   * AIMED DOWNHILL: the way the skier goes, or at most square across it,
//     so a skier coming down never looks into a lamp; tipped down at least
//     15° (snow does not settle on the glass). Light goes downhill and out
//     from each mast, to the snow of the piste — past its edge the beam is
//     cut off and the woods go dark.
//   * WHAT LAMP: a 400–600 W LED floodlight, 56 000–84 000 lm, a 60° beam,
//     in place of the 1000–2000 W metal-halide or sodium lamps it replaced;
//     one to four on a mast; NEUTRAL WHITE, 4000–5000 K.
//
// THE MASTS ARE SCENERY, not obstacles: like the edge poles they stand
// past the piste's edge and nothing in the engine knows they are there.

import { trackPointAt, treesNear, type Level, type TrackPoint } from "@engine";

import { clearOfLifts } from "./run-sign-plan.ts";

/** The layout, as the research has it.
 *   * `lux`: the mean the masts are sized for, lx, and the class they are
 *     held to (`classIII`: mean and minimum over the piste).
 *   * `every`: from one mast to the next down the run, m; `first` the first
 *     mast's arc down from the run's head (half the edge poles' 25 m, so
 *     the two never stand side by side).
 *   * `out`: the mast's foot past the piste's edge, m — beyond the edge
 *     poles' 1.5 m.
 *   * `height`: the light point over the snow, m: `base` + `perWidth` × the
 *     piste's width, held to `[min, max]`.
 *   * `bothSides`: a piste wider than this, m, is lit from both edges, the
 *     masts staggered.
 *   * `lumens`: one lamp's flux, lm (a 400 W LED at 140 lm/W), and the most
 *     lamps one mast carries. The masts' flux is the target over the area a
 *     mast serves over `utilisation`, the share of a lamp's light that lands
 *     on the piste.
 *   * `clear`: how close two masts may stand (two runs side by side), m;
 *     how far a trunk keeps from the foot; how far from the finish line and
 *     the start line a mast stands (the arena has its own floods). */
export const PISTE_LIGHT = {
  lux: { target: 30, classIII: { mean: 20, min: 4 } },
  every: 50,
  first: 12.5,
  out: 3.5,
  height: { base: 8, perWidth: 0.15, min: 10, max: 18 },
  bothSides: 70,
  lumens: { lamp: 56_000, most: 3 },
  utilisation: 0.7,
  clear: { mast: 25, tree: 1.6, finish: 40, start: 20 },
} as const;

/** THE BEAM: an ASYMMETRIC sports floodlight's distribution, as a slope
 * is lit with — stated about the NADIR, not about the axis, because that
 * is how the optic is cut: the peak thrown out at the aim's angle from the
 * vertical (`throw`), the light falling off slowly toward the foot of the
 * mast (`under`, rad — half the peak that far nearer the vertical) and CUT
 * OFF sharply above the aim (`over`, rad — half the peak that far above it,
 * nearly nothing twice that), which is what leaves the woods past the far
 * edge dark; across the throw the beam is wide (`across`, rad either side
 * of the aim's bearing to half the peak — some 60–80° of spread down the
 * run). Nothing behind the mast. */
export const BEAM = {
  under: (28 * Math.PI) / 180,
  over: (7 * Math.PI) / 180,
  across: (50 * Math.PI) / 180,
} as const;

/** The light's colour, linear — a 4000 K LED's neutral white: warmer than
 * a headlamp's 5500 K, whiter than the arena's halogen. */
export const PISTE_LIGHT_COLOUR = [1.0, 0.74, 0.5] as const;

/** How much light a lamp thrown out at `aim` rad from the nadir sends at
 * `gamma` rad from the nadir and `bearing` rad off the aim's bearing, as a
 * share of its peak. */
export function beamShare(aim: number, gamma: number, bearing: number): number {
  const b = Math.abs(bearing);
  if (b >= Math.PI / 2) return 0;
  const dg = gamma - aim;
  const vertical =
    dg > 0 ? Math.pow(2, -Math.pow(dg / BEAM.over, 4)) : Math.pow(2, -Math.pow(dg / BEAM.under, 2));
  // Toward the nadir every bearing is the same way down: the spread across
  // narrows to nothing there, so the foot of the mast is one pool.
  const across = Math.pow(2, -Math.pow((b * Math.sin(gamma)) / BEAM.across, 4));
  return vertical * across;
}

/** The solid angle a beam thrown at `aim` rad from the nadir fills, sr:
 * ∫ share dΩ — what a lamp's flux is divided by for its peak intensity.
 * Worked out by whole degrees of throw, each the first time it is asked. */
const SOLID = new Map<number, number>();
function solidAt(deg: number): number {
  const known = SOLID.get(deg);
  if (known !== undefined) return known;
  const aim = (deg * Math.PI) / 180;
  const ng = 120;
  const nb = 90;
  let sum = 0;
  for (let i = 0; i < ng; i++) {
    const g = ((i + 0.5) / ng) * Math.PI;
    let ring = 0;
    for (let j = 0; j < nb; j++) ring += beamShare(aim, g, ((j + 0.5) / nb - 0.5) * Math.PI);
    sum += (ring / nb) * Math.PI * Math.sin(g);
  }
  const solid = sum * (Math.PI / ng);
  SOLID.set(deg, solid);
  return solid;
}

function solidOf(aim: number): number {
  const deg = Math.min(90, Math.max(0, (aim * 180) / Math.PI));
  const i = Math.min(89, Math.floor(deg));
  return solidAt(i) + (solidAt(i + 1) - solidAt(i)) * (deg - i);
}

/** One lamp: its light point (world), the way it is aimed (unit) — as an
 * angle from the nadir (`aim`, rad) and a bearing in plan (`bearing`, rad,
 * 0 = +z, clockwise from above) — its flux, lm, and its peak intensity, cd. */
export type PisteLamp = {
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  aim: number;
  bearing: number;
  lumens: number;
  peak: number;
};

/** One mast: its foot (on the snow), its height to the light point, which
 * side of its run it stands on (+1 the skier's left going down), the way
 * it faces in plan (heading, 0 = +z, clockwise from above: across its run)
 * and the lamps it carries. */
export type PisteMast = {
  x: number;
  y: number;
  z: number;
  height: number;
  side: number;
  heading: number;
  lamps: PisteLamp[];
};

/** How much light lamp `l` sends toward a point `(px, py, pz)`, cd. */
export function intensityOf(l: PisteLamp, px: number, py: number, pz: number): number {
  const ex = px - l.x;
  const ey = py - l.y;
  const ez = pz - l.z;
  const plan = Math.hypot(ex, ez);
  if (plan + Math.abs(ey) < 1e-6) return 0;
  const gamma = Math.atan2(plan, -ey);
  let bearing = Math.atan2(ex, ez) - l.bearing;
  bearing -= 2 * Math.PI * Math.round(bearing / (2 * Math.PI));
  return l.peak * beamShare(l.aim, gamma, bearing);
}

/** The lines a ski area's masts stand along: every run of the area, or the
 * one piste of a map that has none. */
function linesOf(level: Level): { id: string; points: TrackPoint[]; length: number }[] {
  if (level.resort) return level.resort.runs;
  return [{ id: "piste", points: level.track.points, length: level.track.length }];
}

/** The light point's height over the snow beside a piste `width` m wide. */
export function mastHeight(width: number): number {
  const H = PISTE_LIGHT.height;
  return Math.min(H.max, Math.max(H.min, H.base + H.perWidth * width));
}

/** A small FNV hash of a run's id: which side its masts stand on. */
function sideOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 0) % 2 === 0 ? 1 : -1;
}

/**
 * WHERE THE MASTS STAND on `level`: down every run from `first` m every
 * `every` m, `out` m past the edge on the run's own side (both sides,
 * staggered, where it is wider than `bothSides`), each carrying as many
 * lamps as the area it serves needs for `lux.target`, each lamp aimed down
 * the run and across it. A mast that would stand in a lift's line or
 * station, on another run's snow, in a trunk, or close by another mast is
 * nudged down and up the run, and left out where no nudge clears it.
 */
export function planPisteLights(level: Level): PisteMast[] {
  const P = PISTE_LIGHT;
  const masts: PisteMast[] = [];
  const many = linesOf(level).length > 1;
  const near: number[] = [];
  const cps = level.checkpoints;
  const finish = cps.length > 0 ? cps[cps.length - 1] : null;
  // A hash of the masts stood so far, a cell per `clear.mast`.
  const cells = new Map<string, PisteMast[]>();
  const cellKey = (x: number, z: number): string =>
    `${Math.floor(x / P.clear.mast)},${Math.floor(z / P.clear.mast)}`;
  const crowded = (x: number, z: number): boolean => {
    const cx = Math.floor(x / P.clear.mast);
    const cz = Math.floor(z / P.clear.mast);
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        for (const m of cells.get(`${cx + i},${cz + j}`) ?? []) {
          if (Math.hypot(m.x - x, m.z - z) < P.clear.mast) return true;
        }
      }
    }
    return false;
  };
  const clearAt = (x: number, z: number): boolean => {
    if (x < 0 || z < 0 || x > level.size || z > level.size) return false;
    if (many && level.packedAt(x, z) > 0.5) return false;
    if (!clearOfLifts(level, x, z)) return false;
    if (treesNear(level, x, z, P.clear.tree, near).length > 0) return false;
    if (finish && Math.hypot(finish.x - x, finish.z - z) < P.clear.finish) return false;
    if (Math.hypot(level.spawn.x - x, level.spawn.z - z) < P.clear.start) return false;
    return !crowded(x, z);
  };
  const at: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
  const aim: TrackPoint = { x: 0, z: 0, y: 0, s: 0, heading: 0, width: 0 };
  // Nudged along the run, nearest first.
  const NUDGE = [0, 5, -5, 10, -10];

  for (const run of linesOf(level)) {
    const line = { track: { points: run.points, length: run.length } };
    const own = sideOf(run.id);
    for (let s0 = P.first, k = 0; s0 < run.length - 5; s0 += P.every / 2, k++) {
      trackPointAt(line, s0, at);
      const wide = at.width > P.bothSides;
      // Every other half-step is a mast on the run's own side; the ones
      // between stand on the far side where the piste is wide enough.
      const side = k % 2 === 0 ? own : -own;
      if (k % 2 === 1 && !wide) continue;
      let placed: { s: number; x: number; z: number } | null = null;
      for (const ds of NUDGE) {
        const s = s0 + ds;
        if (s < 0 || s > run.length) continue;
        trackPointAt(line, s, at);
        const off = at.width / 2 + P.out;
        const x = at.x + Math.cos(at.heading) * side * off;
        const z = at.z - Math.sin(at.heading) * side * off;
        if (clearAt(x, z)) {
          placed = { s, x, z };
          break;
        }
      }
      if (!placed) continue;
      trackPointAt(line, placed.s, at);
      const width = at.width;
      const height = mastHeight(width);
      const y = level.groundAt(placed.x, placed.z);
      // The area this mast serves: the stretch to the next on its side,
      // the whole width (half of it where both sides are lit).
      const served = P.every * (wide ? width / 2 : width);
      const flux = (P.lux.target * served) / P.utilisation;
      const count = Math.max(1, Math.min(P.lumens.most, Math.round(flux / P.lumens.lamp)));
      const mast: PisteMast = {
        x: placed.x,
        y,
        z: placed.z,
        height,
        side,
        // Facing in across the run: the heading turned toward the centreline.
        heading: at.heading - (side * Math.PI) / 2,
        lamps: [],
      };
      for (let i = 0; i < count; i++) {
        // Lamp by lamp down the stretch the mast serves, each laid across
        // the piste past its centreline (the near side takes the spill).
        const ahead = P.every * ((i + 0.6) / count) * 0.7;
        trackPointAt(line, Math.min(run.length, placed.s + ahead), aim);
        const across = wide ? 0.3 : 0.42;
        const tx = aim.x - Math.cos(aim.heading) * side * aim.width * across;
        const tz = aim.z + Math.sin(aim.heading) * side * aim.width * across;
        const ty = level.groundAt(tx, tz);
        // Side by side on the mast's crossarm, 0.7 m apart.
        const spread = (i - (count - 1) / 2) * 0.7;
        const lx = placed.x + Math.cos(mast.heading) * spread;
        const lz = placed.z - Math.sin(mast.heading) * spread;
        const ly = y + height;
        const ax = tx - lx;
        const ay = ty - ly;
        const az = tz - lz;
        const n = Math.hypot(ax, ay, az);
        const lumens = flux / count;
        const aimAt = Math.atan2(Math.hypot(ax, az), -ay);
        mast.lamps.push({
          x: lx,
          y: ly,
          z: lz,
          dx: ax / n,
          dy: ay / n,
          dz: az / n,
          aim: aimAt,
          bearing: Math.atan2(ax, az),
          lumens,
          peak: lumens / solidOf(aimAt),
        });
      }
      masts.push(mast);
      const key = cellKey(mast.x, mast.z);
      const list = cells.get(key);
      if (list) list.push(mast);
      else cells.set(key, [mast]);
    }
  }
  return masts;
}

/** The light on the ground, baked: a grid of `cols` × `rows` texels `cell`
 * m apart from `(originX, originZ)` (a texel's centre on each grid point),
 * each the VECTOR IRRADIANCE there in lux — Σ I / d² · the unit way back
 * to each lamp — so the light on a surface of normal n is `max(n · v, 0)`
 * and on level snow `v.y`. RGBA, the fourth channel unused. */
export type PisteLightMap = {
  cols: number;
  rows: number;
  cell: number;
  originX: number;
  originZ: number;
  data: Float32Array;
};

/** The bake: its texel, m (a pool from a ten-metre mast is tens of metres
 * across), how far from its mast a lamp is reckoned, m, and how many
 * points the way back to the lamp is tested against the ground at — a
 * crest between them is a shadow. */
export const BAKE = { cell: 4, reach: 90, samples: 6 } as const;

/** The light at `(x, y, z)` from every lamp of `masts`, lux on a surface
 * facing `(nx, ny, nz)` — what the bake stores, asked at one point, for the
 * suite and the labs. The ground is not tested between. */
export function illuminanceAt(
  masts: readonly PisteMast[],
  x: number,
  y: number,
  z: number,
  nx = 0,
  ny = 1,
  nz = 0,
): number {
  let e = 0;
  for (const m of masts) {
    if (Math.hypot(m.x - x, m.z - z) > BAKE.reach) continue;
    for (const l of m.lamps) {
      const lx = l.x - x;
      const ly = l.y - y;
      const lz = l.z - z;
      const d2 = lx * lx + ly * ly + lz * lz;
      const d = Math.sqrt(d2);
      const cos = (lx * nx + ly * ny + lz * nz) / d;
      if (cos > 0) e += (intensityOf(l, x, y, z) / d2) * cos;
    }
  }
  return e;
}

/** THE BAKE over the whole of `level` (`[0, size]` square): every texel
 * within `reach` of a mast takes each of its lamps whose way back is not
 * under the ground. */
export function bakePisteLight(level: Level, masts: readonly PisteMast[]): PisteLightMap {
  const cell = BAKE.cell;
  const cols = Math.ceil(level.size / cell) + 1;
  const rows = cols;
  const data = new Float32Array(cols * rows * 4);
  const reach = Math.ceil(BAKE.reach / cell);
  const ground = new Float32Array(cols * rows).fill(Number.NaN);
  const groundOf = (i: number, j: number): number => {
    const k = j * cols + i;
    let g = ground[k];
    if (Number.isNaN(g)) {
      g = level.groundAt(i * cell, j * cell);
      ground[k] = g;
    }
    return g;
  };
  for (const m of masts) {
    const ci = Math.round(m.x / cell);
    const cj = Math.round(m.z / cell);
    const top = m.y + m.height;
    for (let j = Math.max(0, cj - reach); j <= Math.min(rows - 1, cj + reach); j++) {
      for (let i = Math.max(0, ci - reach); i <= Math.min(cols - 1, ci + reach); i++) {
        const x = i * cell;
        const z = j * cell;
        const plan = Math.hypot(x - m.x, z - m.z);
        if (plan > BAKE.reach) continue;
        const y = groundOf(i, j) + 0.3;
        // The way back to the light point under a crest: in its shadow.
        let shaded = false;
        for (let s = 1; s <= BAKE.samples && !shaded; s++) {
          const t = s / (BAKE.samples + 1);
          const sx = x + (m.x - x) * t;
          const sz = z + (m.z - z) * t;
          if (level.groundAt(sx, sz) > y + (top - y) * t) shaded = true;
        }
        if (shaded) continue;
        const k = (j * cols + i) * 4;
        for (const l of m.lamps) {
          const lx = l.x - x;
          const ly = l.y - y;
          const lz = l.z - z;
          const d2 = lx * lx + ly * ly + lz * lz;
          const e = intensityOf(l, x, y, z) / d2;
          if (e <= 0) continue;
          const d = Math.sqrt(d2);
          data[k] += (e * lx) / d;
          data[k + 1] += (e * ly) / d;
          data[k + 2] += (e * lz) / d;
        }
      }
    }
  }
  return { cols, rows, cell, originX: 0, originZ: 0, data };
}
