// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A REAL TURN THROWS, FRAME BY FRAME — the spray as it was MEASURED off
// photographs and video stills of real riders, and the one measure the
// snow-reference lab (`make snow-ref`) reads the game's own spray and cloud
// by, so the two can be laid over each other at the same moment of the same
// manoeuvre (three-free and DOM-free: the suite reads it,
// `tests/spray_film_test.ts`).
//
// HOW THE NUMBERS WERE READ. Every reference is a manoeuvre filmed or
// photographed side-on or three-quarter on, the rider's own height (a
// skier stood about 1.75 m, crouched in a turn about 1.3 m) the ruler laid
// on the frame: the plume's TOP is where its 90th percentile of snow
// stands over the snow under the boots, its REACH how far from the boots
// its 90th percentile has gone along the snow, its AREA the snow a lens
// sees against the rider's own side-on silhouette (about 0.75 m²). Video
// stills give those at known times after the edge was set; a photograph
// gives one moment, placed in its manoeuvre by what the rider's body and
// speed say. A row with a single photograph has its HEIGHT and REACH off
// that moment and its course in time reckoned round it (the rise, the
// stall and the fall of a fan of chips thrown at the turn's speed): the
// reckoning is ours and said so in its row. What each row was read off is
// said beside it — as a kind of shot, never a source's name, and nothing
// is copied: the numbers are ours.
//
// The STOPS and the CARVE are the groomer's (a skied-on piste with a skin
// of loose snow a centimetre or two deep over the hard pack); the POWDER
// TURN is shin- to knee-deep settled snow. What each says, in short:
//   * a carve on the groomer throws almost nothing: a thin ribbon off the
//     tail, ankle- to shin-high, gone within a metre;
//   * a ski hockey stop throws a low fast fan of chips AHEAD of the skis —
//     knee high, two metres and more out — with a thin ice-dust haze
//     over it that is gone a second after the skis stop;
//   * a board's stop throws more and higher: one long edge, the whole rider's
//     weight on it — waist to chest high, three metres out; heelside the
//     fan in front of him, toeside behind his back and a little lower;
//   * a powder turn throws a WALL up off the outside of the arc — shoulder
//     to head high — that stalls, swells and HANGS as a curtain along the
//     line for two to four seconds, its edges hairy with grains, its foot
//     carrying clumps a fist across, and leaves debris lying on the snow.

/** The manoeuvres the references were read for — the snow-reference lab's
 * shared scenes ride the same. */
export type FilmMove = "carve" | "stop" | "boardHeel" | "boardToe" | "powder";

export const FILM_MOVES: readonly FilmMove[] = ["carve", "stop", "boardHeel", "boardToe", "powder"];

/** One measured moment: `t` s after the manoeuvre began, the plume's `top`
 * and `reach`, m, and its `area` against the rider's silhouette. */
export type FilmFrame = { t: number; top: number; reach: number; area: number };

export type FilmReference = {
  /** What the row is, in a few words. */
  title: string;
  /** The snow it was ridden on. */
  snow: "groomed" | "powder";
  /** The speed the manoeuvre was begun at, km/h. */
  kmh: number;
  /** The measured moments, in time order. */
  frames: readonly FilmFrame[];
  /** The clumps thrown, m across: the largest commonly seen. */
  clump: number;
  /** How long the fine cloud hangs after the edge stops throwing, s. */
  linger: number;
  /** What it was read off, as kinds of shot. */
  read: string;
};

/** A side-on rider's silhouette, m² — the ruler `area` is in. */
export const SILHOUETTE = 0.75;

/** THE REFERENCES. */
export const FILM: Record<FilmMove, FilmReference> = {
  carve: {
    title: "carve on the groomer",
    snow: "groomed",
    kmh: 45,
    frames: [
      { t: 0.6, top: 0.22, reach: 0.8, area: 0.06 },
      { t: 1.0, top: 0.25, reach: 0.9, area: 0.08 },
      { t: 1.4, top: 0.25, reach: 0.9, area: 0.08 },
      { t: 1.8, top: 0.22, reach: 0.8, area: 0.06 },
    ],
    clump: 0.03,
    linger: 0.4,
    read: "two still photographs of carving skiers at full angulation, one on a loose skin throwing a thin sheet to the knee (the upper bound — a hard groomer throws less); the course in time reckoned",
  },
  stop: {
    title: "ski hockey stop on the groomer",
    snow: "groomed",
    kmh: 45,
    frames: [
      { t: 0.4, top: 0.25, reach: 0.8, area: 0.2 },
      { t: 0.8, top: 0.5, reach: 1.6, area: 0.55 },
      { t: 1.2, top: 0.6, reach: 2.2, area: 0.7 },
      { t: 1.6, top: 0.55, reach: 2.4, area: 0.5 },
      { t: 2.0, top: 0.4, reach: 2.3, area: 0.25 },
    ],
    clump: 0.05,
    linger: 0.9,
    read: "a still photograph of a skier skidding to a stop on a skied-up groomer under an overcast, the spray a low diffuse fan to the knee off the skis' downhill side, set at its peak; the rise and the fall round it reckoned",
  },
  boardHeel: {
    title: "board heelside stop on the groomer",
    snow: "groomed",
    kmh: 40,
    frames: [
      { t: 0.4, top: 0.4, reach: 1.1, area: 0.35 },
      { t: 0.8, top: 0.9, reach: 2.2, area: 1.1 },
      { t: 1.2, top: 1.15, reach: 3.0, area: 1.5 },
      { t: 1.6, top: 1.0, reach: 3.2, area: 1.1 },
      { t: 2.0, top: 0.65, reach: 2.9, area: 0.45 },
    ],
    clump: 0.07,
    linger: 1.1,
    read: "still photographs of heelside slashes, the plume a crest to about the shoulder in looser snow with its top edge curling over, scaled down for the groomer's thinner skin; the course in time reckoned",
  },
  boardToe: {
    title: "board toeside stop on the groomer",
    snow: "groomed",
    kmh: 40,
    frames: [
      { t: 0.4, top: 0.35, reach: 1.0, area: 0.3 },
      { t: 0.8, top: 0.8, reach: 2.0, area: 0.95 },
      { t: 1.2, top: 1.0, reach: 2.7, area: 1.25 },
      { t: 1.6, top: 0.85, reach: 2.9, area: 0.9 },
      { t: 2.0, top: 0.55, reach: 2.6, area: 0.4 },
    ],
    clump: 0.07,
    linger: 1.0,
    read: "the heelside row turned round: the fan thrown behind the rider's back and a little lower, as toeside slashes in the same photographs show",
  },
  powder: {
    title: "turn in settled powder",
    snow: "powder",
    kmh: 35,
    frames: [
      { t: 0.6, top: 0.9, reach: 1.6, area: 1.4 },
      { t: 1.2, top: 1.45, reach: 3.0, area: 3.0 },
      { t: 1.8, top: 1.7, reach: 4.6, area: 3.6 },
      { t: 2.4, top: 1.75, reach: 6.0, area: 3.2 },
    ],
    clump: 0.15,
    linger: 3,
    read: "still photographs of powder turns on skis and boards — front-on into an overcast, side-on under a high sun, backlit into a low one — and a still of a rider engulfed in deep powder; the long hanging curtain behind an overcast turn, the wall at a board's tail, the debris lying in front of a backlit slash",
  },
};

/** The reference's moment at `t` s, the frames between interpolated and
 * held at either end. */
export function filmAt(move: FilmMove, t: number): FilmFrame {
  const f = FILM[move].frames;
  if (t <= f[0].t) return { ...f[0], t };
  for (let i = 1; i < f.length; i++) {
    if (t <= f[i].t) {
      const k = (t - f[i - 1].t) / (f[i].t - f[i - 1].t);
      const mix = (a: number, b: number) => a + (b - a) * k;
      return {
        t,
        top: mix(f[i - 1].top, f[i].top),
        reach: mix(f[i - 1].reach, f[i].reach),
        area: mix(f[i - 1].area, f[i].area),
      };
    }
  }
  return { ...f[f.length - 1], t };
}

/** One drawn particle as the measure reads it: where, its RADIUS, m, and
 * its opacity. */
export type PlumeBit = { x: number; y: number; z: number; r: number; a: number };

/** What the measure saw: the reference's three numbers off the game's own
 * snow in the air, and the throw's mean way along the snow (a unit vector,
 * for drawing the reference envelope the way the game threw). */
export type Plume = FilmFrame & { bits: number; wayX: number; wayZ: number };

/** The size of the coverage grid's cell, m. */
const CELL = 0.1;

/** A weighted percentile of `v` by `w`. */
function percentile(v: number[], w: number[], q: number): number {
  if (!v.length) return 0;
  const idx = v.map((_, i) => i).sort((a, b) => v[a] - v[b]);
  let total = 0;
  for (const x of w) total += x;
  let run = 0;
  for (const i of idx) {
    run += w[i];
    if (run >= q * total) return v[i];
  }
  return v[idx[idx.length - 1]];
}

/**
 * MEASURE THE SNOW IN THE AIR as the references were read: from the boots
 * at (`bx`, `bz`), every bit weighted by what a lens sees of it (its
 * opacity times its disc); the TOP the 90th percentile of the bits' tops
 * over the snow under each, the REACH the 90th percentile of their distance
 * along the snow, and the AREA the snow covering a vertical plane facing
 * `view` (a unit vector on the snow from the lens toward the rider), every
 * cell of a 10 cm grid covered by one less the product of what each bit
 * lets through, against the rider's silhouette. Bits fainter than a few
 * per cent are not counted: the eye does not see them.
 */
export function plumeOf(
  bits: readonly PlumeBit[],
  groundAt: (x: number, z: number) => number,
  bx: number,
  bz: number,
  view: { x: number; z: number },
  t = 0,
): Plume {
  const tops: number[] = [];
  const far: number[] = [];
  const w: number[] = [];
  const cover = new Map<number, number>();
  // Across the plane facing the lens: its right.
  const ux = view.z;
  const uz = -view.x;
  let wx = 0;
  let wz = 0;
  let n = 0;
  for (const b of bits) {
    if (b.a < 0.03 || b.r <= 0) continue;
    const dx = b.x - bx;
    const dz = b.z - bz;
    const over = b.y - groundAt(b.x, b.z);
    if (over < -0.5) continue;
    const seen = b.a * b.r * b.r;
    tops.push(Math.max(0, over + b.r));
    far.push(Math.hypot(dx, dz));
    w.push(seen);
    wx += dx * seen;
    wz += dz * seen;
    n++;
    // The bit's disc on the plane, cell by cell.
    const u = dx * ux + dz * uz;
    const r = Math.max(b.r, CELL / 2);
    const lo = Math.floor((u - r) / CELL);
    const hi = Math.floor((u + r) / CELL);
    const vlo = Math.floor((over - r) / CELL);
    const vhi = Math.floor((over + r) / CELL);
    for (let i = lo; i <= hi; i++) {
      for (let j = Math.max(0, vlo); j <= vhi; j++) {
        const cu = (i + 0.5) * CELL - u;
        const cv = (j + 0.5) * CELL - over;
        if (cu * cu + cv * cv > r * r) continue;
        // A bit smaller than a cell covers its share of it.
        const pass = 1 - Math.min(1, b.a * Math.min(1, (b.r * b.r) / ((CELL * CELL) / 4)));
        const key = i * 4096 + j;
        cover.set(key, (cover.get(key) ?? 1) * pass);
      }
    }
  }
  let area = 0;
  for (const pass of cover.values()) area += (1 - pass) * CELL * CELL;
  const way = Math.hypot(wx, wz) || 1;
  return {
    t,
    top: percentile(tops, w, 0.9),
    reach: percentile(far, w, 0.9),
    area: area / SILHOUETTE,
    bits: n,
    wayX: wx / way,
    wayZ: wz / way,
  };
}

/** How far one number is off its reference, as the log of their ratio —
 * twice as much and half as much are as wrong — with a floor under each so
 * nothing against nothing is right and a trace against nothing is not
 * ruinous. */
function off(game: number, ref: number, floor: number): number {
  return Math.abs(Math.log((game + floor) / (ref + floor)));
}

/** THE SCORE of one measured moment against its reference, 0..100: 100 the
 * film exactly, about 50 every number a factor of two off. */
export function frameScore(plume: FilmFrame, ref: FilmFrame): number {
  const err =
    (off(plume.top, ref.top, 0.05) +
      off(plume.reach, ref.reach, 0.1) +
      off(plume.area, ref.area, 0.05)) /
    3;
  return 100 * Math.exp(-err);
}
