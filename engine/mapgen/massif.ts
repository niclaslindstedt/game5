// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R25 — THE RESORT'S MOUNTAIN: one massif a whole ski area is laid out on.
//
// The mountain before the resorts (`terrain.ts`, R2) is one fall line's
// profile spread across a face a kilometre wide: every metre of it falls
// as steeply as every other, so a green and a black are cut into the same
// slope and only the line differs. A real ski area is not shaped like that,
// and the piste map of any of them says how it IS shaped:
//
//   * THE SUMMIT RIDGE IS NOT LEVEL. It rises to a PEAK somewhere along it
//     and falls away to a lower SHOULDER on the other side; the lifts reach
//     both, and the runs off the peak are the steep ones.
//   * THE FACE IS STEEPEST UNDER THE PEAK. A sector of the face either side
//     of it falls on a steep profile (the black and red faces, the
//     headwalls), and the face under the shoulder on a rounded, gentler one
//     (the blues and the long greens).
//   * THERE IS A BENCH. Part-way down most mountains the fall eases across
//     a shelf before the lower slopes — where the first stage of the lifts
//     tops out, the mid-station stands and half the pistes on the mountain
//     meet. It is strongest under the mid-station and fades out across the
//     face.
//   * THE LOWER SLOPES RUN OUT GENTLY to the valley floor, where the
//     village and the nursery slopes are.
//
// So the height is `ridge(x) · P(x, u)`: the ridge's share of the vertical
// at that x (one at the peak, the shoulder's share on the far side), times
// a profile blended across x between four tables — steep and gentle, each
// with and without the bench — every one of which falls from one at the
// summit ridge to nothing on the valley floor, so any blend of them does
// too and the ground never climbs down the fall line under the folds. Over
// it lie the folds R3 lays on any mountain (the hills, the spurs and
// gullies, the rollers, the bowls, the crests, the side ridges), the
// headwalls weighted to the steep sector.
//
// Everything here is a pure function of the plan, like `terrain.ts`, and is
// baked once onto the same grid, row by row as `bakeCountry` bakes it.

import { smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  createHeightfield,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { sampleNoise } from "@niclaslindstedt/oss-game-framework/core/noise";
import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { UNGRADED } from "./grades.ts";
import { scaleBand, scaleCount, type Region } from "./regions.ts";
import { TREE_LINE_MASSIF, RESORT_RULES as RR } from "./resort-rules.ts";
import { LEVEL_RULES as R, inBand, type Band } from "./rules.ts";
import {
  countryFields,
  descentAt,
  fbm,
  flankAcross,
  flankOpen,
  ridged,
  type Bowl,
  type CountryFields,
  type Headwall,
  type TerrainPlan,
} from "./terrain.ts";

/** One profile's shape down the fall line (`terrain.ts`'s, plus a bench). */
type Shape = {
  readonly shoulder: number;
  readonly shoulderRun: number;
  readonly ease: number;
  readonly runout: number;
};

/** What the massif adds to a plan: where the peak, the shoulder and the
 * bench are, and the tables the profile is blended from. */
export type Massif = {
  /** Which hand the peak stands on: +1 east of the middle, −1 west. */
  readonly side: number;
  /** The peak's x, its spread along the ridge (a bell's sigma), m. */
  readonly peakX: number;
  readonly peakSpread: number;
  /** The shoulder's x and the ridge's share of the vertical there. */
  readonly shoulderX: number;
  readonly shoulderShare: number;
  /** The steep sector: a bell round the peak, its sigma, m. */
  readonly steepSpread: number;
  /** The bench: how far down the descent it lies (u), its half-width in
   * u, how much of the fall it takes out at its middle, and where across
   * the face it is strongest (the mid-station's x) and how far that
   * reaches (sigma, m). */
  readonly benchU: number;
  readonly benchWidth: number;
  readonly benchDepth: number;
  readonly benchX: number;
  readonly benchSpread: number;
  /** The village's x on the valley floor. */
  readonly villageX: number;
  /** The profile tables: [gentle, steep] × [no bench, bench]. */
  readonly tables: readonly [Float64Array, Float64Array, Float64Array, Float64Array];
  /** A slow noise along the ridge, so a ridge is not two bells. */
  readonly ridgeSeed: number;
  /** How much wider than the rule book's square the massif's is: the
   * ridge's slow noise is stretched with it. */
  readonly wide: number;
};

const SAMPLES = 1024;

/** A smooth bell, one at 0 falling toward nothing. */
const bell = (d: number, sigma: number): number => Math.exp(-0.5 * (d / sigma) ** 2);

/** The grade's shape at `u`, with the bench taken out of it. */
function shapeAt(
  P: Shape,
  u: number,
  bench: { u: number; w: number; depth: number } | null,
): number {
  const shoulder = P.shoulder + (1 - P.shoulder) * smoothstep(0, P.shoulderRun, u);
  const ease = Math.max(0, 1 - u) ** P.ease;
  let g = shoulder * (ease * (1 - P.runout) + P.runout);
  if (bench) {
    const d = (u - bench.u) / bench.w;
    if (Math.abs(d) < 1) g *= 1 - bench.depth * Math.cos((d * Math.PI) / 2) ** 2;
  }
  return g;
}

/** The share of the drop still below `u`, 1 at the ridge and 0 at the
 * floor, off the shape integrated by the trapezium. */
function tabulate(P: Shape, bench: { u: number; w: number; depth: number } | null): Float64Array {
  const n = SAMPLES;
  const table = new Float64Array(n + 1);
  let sum = 0;
  for (let i = n - 1; i >= 0; i--) {
    sum += (shapeAt(P, i / n, bench) + shapeAt(P, (i + 1) / n, bench)) / 2 / n;
    table[i] = sum;
  }
  for (let i = 0; i <= n; i++) table[i] /= sum;
  return table;
}

function sample(table: Float64Array, u: number): number {
  if (u <= 0) return 1;
  if (u >= 1) return 0;
  const t = u * SAMPLES;
  const i = Math.floor(t);
  return table[i] + (table[i + 1] - table[i]) * (t - i);
}

/** R25 — deal the resort's mountain off the attempt's stream, in `region`
 * (R21): the vertical, the peak and the shoulder, the bench, the village,
 * and the folds R3 lays over it. */
export function planMassif(rng: Rng, region: Region): TerrainPlan {
  const M = RR.massif;
  // R1 — a resort's square is wider than the rule book's, so its tall
  // mountain falls as far over each metre down the face as a mountain of
  // the rule book's height does over its own.
  const size = M.size;
  const F = R.face;
  const K = region.relief;
  // Every country's mountain stands the massif's own vertical over a floor
  // near the sea, whatever the region's multiple.
  const cx = size / 2;
  const summitZ = size * R.mountain.summit;
  const baseZ = size * R.mountain.base;
  const vertical = inBand(rng, M.vertical);
  // Everything across the face is stretched with the square, so the ridge
  // falls from the peak to the shoulder over as far as it rises.
  const wide = size / R.world.size;
  const across = (band: Band): Band => scaleBand(band, wide);
  const side = rng.chance(0.5) ? 1 : -1;
  const peakX = cx + side * inBand(rng, across(M.peak.across));
  const peakSpread = inBand(rng, across(M.peak.spread));
  const shoulderX = cx - side * inBand(rng, across(M.shoulder.across));
  const shoulderShare = inBand(rng, M.shoulder.share);
  const steepSpread = inBand(rng, across(M.sector));
  const benchU = inBand(rng, M.bench.at);
  const benchWidth = inBand(rng, M.bench.width);
  const benchDepth = inBand(rng, M.bench.depth);
  const villageX = cx - side * inBand(rng, across(M.village.across));
  const benchX = villageX + (peakX - villageX) * inBand(rng, M.bench.toward);
  const benchSpread = inBand(rng, across(M.bench.spread));
  const flankBand = { inner: M.flank.inner * wide, outer: M.flank.outer * wide };
  const Q = M.relief;
  const flank = inBand(rng, scaleBand(R.mountain.flank.height, K.flank * Q.flank));
  const hills = inBand(rng, scaleBand(F.hills.amplitude, K.hills * Q.hills));
  const ridges = inBand(rng, scaleBand(F.ridges.amplitude, K.ridges * M.ridges * Q.ridges));
  const bowls: Bowl[] = [];
  const nBowls = scaleCount(F.bowls.count, K.bowls.count);
  const bowlCount = rng.int(nBowls.min, nBowls.max);
  for (let i = 0; i < bowlCount; i++) {
    const u = inBand(rng, F.bowls.at);
    const off = rng.range(-1, 1) * (flankBand.inner - 200);
    bowls.push({
      x: cx + off,
      z: summitZ + (baseZ - summitZ) * u,
      r: inBand(rng, scaleBand(F.bowls.radius, K.bowls.radius)),
      depth: inBand(rng, scaleBand(F.bowls.depth, K.bowls.depth * Q.bowls)),
    });
  }
  const headwalls: Headwall[] = [];
  const nWalls = scaleCount(F.headwalls.count, K.headwalls.count);
  const wallCount = rng.int(nWalls.min, nWalls.max);
  for (let i = 0; i < wallCount; i++) {
    const u = inBand(rng, M.headwalls.at);
    headwalls.push({
      z: summitZ + (baseZ - summitZ) * u,
      drop: inBand(rng, scaleBand(F.headwalls.drop, K.headwalls.drop * Q.headwalls)),
      run: inBand(rng, F.headwalls.run),
      x: peakX + rng.range(-1, 1) * M.headwalls.across * wide,
      spread: inBand(rng, across(M.headwalls.spread)),
    });
  }
  const dealtBase = inBand(rng, region.altitude.base);
  const dealtLine = inBand(rng, region.altitude.treeLine);
  const seed = (): number => rng.int(1, 0x7ffffff0);
  const seeds = {
    warp: seed(),
    flank: seed(),
    hills: seed(),
    ridges: seed(),
    rollers: seed(),
    crests: seed(),
    headwalls: seed(),
  };
  const bench = { u: benchU, w: benchWidth, depth: benchDepth };
  const massif: Massif = {
    side,
    peakX,
    peakSpread,
    shoulderX,
    shoulderShare,
    steepSpread,
    benchU,
    benchWidth,
    benchDepth,
    benchX,
    benchSpread,
    villageX,
    tables: [
      tabulate(M.gentleProfile, null),
      tabulate(M.steepProfile, null),
      tabulate(M.gentleProfile, bench),
      tabulate(M.steepProfile, bench),
    ],
    ridgeSeed: seed(),
    wide,
  };
  // R21 — the tree line. The floor is a few metres over the sea
  // (`massif.sea`, the lowest ground's — the published altitude is set off
  // the built ground, `seaLevelOf`) and the line stands the same SHARE of
  // the mountain over it as the region's bands give a mountain of the
  // region's own height (`TREE_LINE_MASSIF`), so a country is as wooded
  // over its floor whatever the massif's vertical.
  const sea = inBand(rng, M.sea);
  const above = dealtLine - dealtBase;
  const altitude = sea;
  const regionVertical =
    ((TREE_LINE_MASSIF.vertical.min + TREE_LINE_MASSIF.vertical.max) / 2) * K.vertical;
  const treeLine = altitude + (above * vertical) / regionVertical;
  return {
    vertical,
    altitude,
    treeLine,
    size,
    fold: Q.scale,
    sea,
    summitZ,
    baseZ,
    flank,
    crests: R.mountain.crests * K.crests,
    hills,
    ridges,
    rollers: F.rollers.amplitude * K.rollers * Q.rollers,
    bowls,
    headwalls,
    profile: massif.tables[0],
    region,
    grade: UNGRADED,
    massif,
    flankBand,
    seeds,
  };
}

/** The massif of a plan, or a thrown error: everything below is only ever
 * asked of a resort's plan. */
function massifOf(plan: TerrainPlan): Massif {
  if (!plan.massif) throw new Error("not a resort's mountain");
  return plan.massif;
}

/** R25 — the summit ridge's share of the vertical at `x`: one at the peak,
 * the shoulder's share on the far side, a little noise along it. */
export function ridgeShare(plan: TerrainPlan, x: number): number {
  const m = massifOf(plan);
  const peak = bell(x - m.peakX, m.peakSpread);
  // The shoulder is a rise of its own, so the ridge past it falls again.
  const shoulder = bell(x - m.shoulderX, m.peakSpread * 1.3);
  const base = RR.massif.ridgeFloor;
  const share = Math.max(base + (m.shoulderShare - base) * shoulder, base) * (1 - peak) + peak;
  const wander = (sampleNoise2(m.ridgeSeed, x / m.wide) - 0.5) * RR.massif.ridgeWander;
  return Math.min(1, Math.max(base, share + wander * (1 - peak)));
}

/** R25 — how much of the steep profile the face at `x` falls on, 0..1. */
export function steepShare(plan: TerrainPlan, x: number): number {
  const m = massifOf(plan);
  return bell(x - m.peakX, m.steepSpread);
}

/** R25 — how strong the bench is at `x`, 0..1. */
export function benchShare(plan: TerrainPlan, x: number): number {
  const m = massifOf(plan);
  return RR.massif.bench.floor + (1 - RR.massif.bench.floor) * bell(x - m.benchX, m.benchSpread);
}

/** The profile's share of the ridge's height still to fall at (`x`, `u`). */
export function massifProfile(plan: TerrainPlan, x: number, u: number): number {
  return profileOf(massifOf(plan), steepShare(plan, x), benchShare(plan, x), u);
}

function profileOf(m: Massif, st: number, bn: number, u: number): number {
  const [g, s, gb, sb] = m.tables;
  const plain = sample(g, u) * (1 - st) + sample(s, u) * st;
  const benched = sample(gb, u) * (1 - st) + sample(sb, u) * st;
  return plain * (1 - bn) + benched * bn;
}

/** A 1-D noise along the ridge, 0..1, wavelength `RR.massif.ridgeScale`. */
function sampleNoise2(seed: number, x: number): number {
  const L = RR.massif.ridgeScale;
  const i = Math.floor(x / L);
  const t = x / L - i;
  const h = (k: number): number => {
    let v = (k * 374761393 + seed * 668265263) | 0;
    v = Math.imul(v ^ (v >>> 13), 1274126177);
    return ((v ^ (v >>> 16)) >>> 0) / 4294967296;
  };
  const w = t * t * (3 - 2 * t);
  return h(i) + (h(i + 1) - h(i)) * w;
}

/** R25, R3 — the untouched massif's height at a plan point, m. The folds
 * are `terrain.ts`'s own arithmetic, restated here rather than shared so
 * that the mountain before the resorts keeps every bit of its own. */
export function massifAt(plan: TerrainPlan, f: CountryFields, x: number, z: number): number {
  return heightAt(
    plan,
    f,
    x,
    massifRow(plan, z),
    ridgeShare(plan, x),
    steepShare(plan, x),
    benchShare(plan, x),
  );
}

/** Everything `heightAt` reads off `z` alone — the descent, the four
 * profiles at it, the fade of the folds and the crests, the side ridges'
 * opening — so a bake reads them once a row. Each is the very expression
 * the height was written with, so a row read once is the row read every
 * time, bit for bit. */
type MassifRow = {
  z: number;
  /** The four profile tables at the row's descent (`profileOf`). */
  g: number;
  s: number;
  gb: number;
  sb: number;
  /** Behind the summit ridge, and how far it falls away there. */
  behind: boolean;
  back: number;
  /** The folds' fade on the valley floor. */
  floor: number;
  /** The crests' fade down the face. */
  ridge: number;
  /** How open the side ridges are at this descent (`flankOpen`). */
  open: number;
};

function massifRow(plan: TerrainPlan, z: number): MassifRow {
  const M = R.mountain;
  const F = R.face;
  const u = descentAt(plan, z);
  const [g, s, gb, sb] = massifOf(plan).tables;
  const crest = z - plan.summitZ;
  return {
    z,
    g: sample(g, u),
    s: sample(s, u),
    gb: sample(gb, u),
    sb: sample(sb, u),
    behind: z < plan.summitZ,
    back: (plan.summitZ - z) * M.back,
    floor: 1 - (1 - F.hills.floor * RR.massif.floorRelief) * smoothstep(0.88, 1.02, u),
    ridge: crest < 0 ? 1 : 1 - smoothstep(0, M.crestSpread, crest),
    open: flankOpen(plan, z),
  };
}

/** `massifAt` with the three shares across x already read — they depend on
 * x alone, so a bake reads them once a column — and what depends on z
 * alone read once a row (`massifRow`). `walls` holds each headwall's drop
 * at x from `wallsAt` on, when a bake has read them. */
function heightAt(
  plan: TerrainPlan,
  f: CountryFields,
  x: number,
  row: MassifRow,
  share: number,
  st: number,
  bn: number,
  walls: ArrayLike<number> | null = null,
  wallsAt = 0,
): number {
  const F = R.face;
  const z = row.z;
  let drops = 0;
  for (let i = 0; i < plan.headwalls.length; i++) {
    drops += walls ? walls[wallsAt + i] : wallDrop(plan.headwalls[i], x, st);
  }
  const plain = row.g * (1 - st) + row.s * st;
  const benched = row.gb * (1 - st) + row.sb * st;
  let h = (plan.vertical * share - drops) * (plain * (1 - bn) + benched * bn);
  for (let i = 0; i < plan.headwalls.length; i++) {
    const w = plan.headwalls[i];
    const drop = walls ? walls[wallsAt + i] : wallDrop(w, x, st);
    const dz = z - w.z;
    if (dz < -w.run) {
      h += drop;
      continue;
    }
    if (dz > w.run) continue;
    const wander = (sampleNoise(f.headwalls[i], x, 0) * 2 - 1) * F.headwalls.wander;
    h += drop * (1 - smoothstep(-w.run / 2, w.run / 2, dz + wander));
  }
  if (row.behind) h -= row.back;
  const wx = x + (sampleNoise(f.warpX, x, z) * 2 - 1) * 70;
  const wz = z + (sampleNoise(f.warpZ, x, z) * 2 - 1) * 70;
  const flank = flankAcross(plan, sampleNoise(f.flank, x, z), x, row.open);
  // The folds, quieter on the valley floor where the village stands, and
  // the spurs and gullies strongest on the steep sector.
  const floor = row.floor;
  h += fbm(f.hills, wx, wz) * plan.hills * floor;
  const folds = RR.massif.gentleFolds + (1 - RR.massif.gentleFolds) * st;
  h +=
    (ridged(f.ridges, wx, wz / F.ridges.stretch) - 0.5) * plan.ridges * folds * (1 - flank) * floor;
  if (plan.rollers > 0) {
    const rx = wx * 0.8 + wz * 0.6;
    const rz = wz * 0.8 - wx * 0.6;
    h += (ridged(f.rollers, rx, rz) - 0.5) * plan.rollers * floor;
  }
  for (const b of plan.bowls) {
    const d2 = ((x - b.x) ** 2 + (z - b.z) ** 2) / (b.r * b.r);
    if (d2 < 1) h -= b.depth * (1 - d2) * (1 - d2);
  }
  const ridge = row.ridge;
  if (flank > 0 || ridge > 0) {
    const rx = wx * 0.866 - wz * 0.5;
    const rz = wx * 0.5 + wz * 0.866;
    const crests =
      plan.crests * (ridged(f.crests, rx, rz) * 0.75 + ridged(f.crestsFine, rz, rx) * 0.25);
    h += plan.flank * flank * Math.sqrt(flank) + crests * Math.max(flank, ridge);
  }
  return h;
}

/** How much of a headwall's drop the face at `x` takes: the steep
 * sector's share, faded across the wall's own reach. */
function wallDrop(w: Headwall, x: number, st: number): number {
  const across = w.x === undefined ? 1 : bell(x - w.x, w.spread ?? 300);
  return w.drop * st * across;
}

/** Bake the massif onto the map's grid (R1), row by row — the order the
 * noise fields' kept squares pay off in — with what depends on x alone
 * read once a column and what depends on z alone once a row. */
export function bakeMassif(plan: TerrainPlan): Heightfield {
  const cell = R.world.cell;
  const n = Math.round(plan.size / cell) + 1;
  const share = new Float64Array(n);
  const st = new Float64Array(n);
  const bn = new Float64Array(n);
  const k = plan.headwalls.length;
  const walls = new Float64Array(n * k);
  for (let c = 0; c < n; c++) {
    const x = c * cell;
    share[c] = ridgeShare(plan, x);
    st[c] = steepShare(plan, x);
    bn[c] = benchShare(plan, x);
    for (let i = 0; i < k; i++) walls[c * k + i] = wallDrop(plan.headwalls[i], x, st[c]);
  }
  const field = createHeightfield(0, 0, cell, n, n);
  const d = field.data;
  const fields = countryFields(plan);
  for (let r = 0; r < n; r++) {
    const row = massifRow(plan, r * cell);
    for (let c = 0; c < n; c++) {
      d[r * n + c] = heightAt(plan, fields, c * cell, row, share[c], st[c], bn[c], walls, c * k);
    }
  }
  return field;
}

/** The untouched massif's height at the summit ridge's crest line at `x`,
 * the profile's own (no folds): what a lift top is stood under. */
export function ridgeHeight(plan: TerrainPlan, x: number): number {
  return plan.vertical * ridgeShare(plan, x);
}
