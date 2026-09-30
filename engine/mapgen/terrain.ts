// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R2, R3 — THE MOUNTAIN BEFORE ANYBODY SKIS IT: one flank falling from a
// summit ridge along the top edge to a valley floor along the bottom, side
// ridges either hand, and a face folded into spurs and gullies, bowls,
// headwalls and rollers.
//
// Everything here is a pure function of a PLAN (numbers drawn off the
// attempt's stream once) and a plan point, so the search can ask "how high
// is the untouched ground here?" of the same arithmetic the bake writes into
// the grid. The bake runs ONCE per attempt; the piste's grading (track.ts)
// and the kickers (kickers.ts) are then stamped into the grid it made, and
// nothing downstream ever evaluates the noise again.
//
// THE PROFILE is the mountain's shape down the fall line: the grade's SHAPE
// is the rule book's (`mountain.profile` — a shoulder under the ridge, the
// steepest pitch below it, easing to the run-out), integrated once into a
// table and scaled so the whole descent falls the dealt vertical. The
// headwalls are steps taken out of that vertical and put back as short
// bands where the ground drops them all at once, so the summit and the base
// stand where the profile alone would put them. The ground falls toward +z:
// heading 0 is the fall line, which is why a skier's default heading is 0.

import { smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  createHeightfield,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import {
  noiseField,
  sampleNoise,
  valueNoise,
  type NoiseField,
} from "@niclaslindstedt/oss-game-framework/core/noise";
import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { REGIONS, scaleBand, scaleCount, type Region } from "./regions.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";

/** A bowl: a round hollow in the high face (R3). */
export type Bowl = {
  readonly x: number;
  readonly z: number;
  readonly r: number;
  readonly depth: number;
};

/** A headwall: a band across the face where the profile drops `drop` m
 * more over `run` m, centred `z` down the map (R3). */
export type Headwall = {
  readonly z: number;
  readonly drop: number;
  readonly run: number;
};

/** Everything the mountain is drawn from, dealt once per attempt. */
export type TerrainPlan = {
  /** The height from the valley floor to the summit ridge, m (R2). */
  readonly vertical: number;
  /** The valley floor's altitude above the sea and the tree line's, m
   * (R14, R21's bands). */
  readonly altitude: number;
  readonly treeLine: number;
  /** Where the summit ridge's crest runs and where the valley floor
   * begins, m down the map. */
  readonly summitZ: number;
  readonly baseZ: number;
  /** The side ridges' height over the face, m. */
  readonly flank: number;
  /** The summit's ridged crests at full height, m (scaled by R21). */
  readonly crests: number;
  readonly hills: number;
  readonly ridges: number;
  /** The rollers' crest over trough, m (R3). */
  readonly rollers: number;
  readonly bowls: readonly Bowl[];
  readonly headwalls: readonly Headwall[];
  /** The profile's share of the vertical still to fall at `u` (0 at the
   * summit … 1 at the base), sampled every `1 / PROFILE_SAMPLES` of the
   * descent — the headwalls' drops taken out. */
  readonly profile: Float64Array;
  /** The region the mountain is built in (R21), which everything
   * downstream of the plan reads its own multipliers off. */
  readonly region: Region;
  /** Noise seeds, one per layer so the layers do not echo each other. */
  readonly seeds: {
    readonly warp: number;
    readonly flank: number;
    readonly hills: number;
    readonly ridges: number;
    readonly rollers: number;
    readonly crests: number;
    readonly headwalls: number;
  };
};

/** How finely the profile is tabulated over the descent. */
const PROFILE_SAMPLES = 1024;

/** The grade's shape down the fall line, before it is scaled to the
 * vertical (`mountain.profile`): a shoulder under the ridge, the peak, and
 * the ease to the run-out. */
function gradeShape(u: number): number {
  const P = R.mountain.profile;
  const shoulder = P.shoulder + (1 - P.shoulder) * smoothstep(0, P.shoulderRun, u);
  const ease = Math.max(0, 1 - u) ** P.ease;
  return shoulder * (ease * (1 - P.runout) + P.runout);
}

/** The profile table: the share of the drop still below `u`, 1 at the
 * summit and 0 at the base, off the grade shape integrated by the
 * trapezium. */
function tabulateProfile(): Float64Array {
  const n = PROFILE_SAMPLES;
  const table = new Float64Array(n + 1);
  let sum = 0;
  for (let i = n - 1; i >= 0; i--) {
    sum += (gradeShape(i / n) + gradeShape((i + 1) / n)) / 2 / n;
    table[i] = sum;
  }
  for (let i = 0; i <= n; i++) table[i] /= sum;
  return table;
}

/** Deal the mountain's plan off the attempt's stream, in `region` (R21).
 * Every band is the rule's scaled by the region's row — the same band, and
 * so the same draws, in the alpine. */
export function planTerrain(rng: Rng, region: Region = REGIONS.alpine): TerrainPlan {
  const size = R.world.size;
  const M = R.mountain;
  const F = R.face;
  const K = region.relief;
  const seed = (): number => rng.int(1, 0x7ffffff0);
  const summitZ = size * M.summit;
  const baseZ = size * M.base;
  const cx = size / 2;
  // In this order: the stream a map is always dealt.
  const vertical = inBand(rng, scaleBand(M.vertical, K.vertical));
  const flank = inBand(rng, scaleBand(M.flank.height, K.flank));
  const hills = inBand(rng, scaleBand(F.hills.amplitude, K.hills));
  const ridges = inBand(rng, scaleBand(F.ridges.amplitude, K.ridges));
  const bowls: Bowl[] = [];
  const nBowls = scaleCount(F.bowls.count, K.bowls.count);
  const bowlCount = rng.int(nBowls.min, nBowls.max);
  for (let i = 0; i < bowlCount; i++) {
    const u = inBand(rng, F.bowls.at);
    const across = rng.range(-1, 1) * (M.flank.inner - 150);
    bowls.push({
      x: cx + across,
      z: summitZ + (baseZ - summitZ) * u,
      r: inBand(rng, scaleBand(F.bowls.radius, K.bowls.radius)),
      depth: inBand(rng, scaleBand(F.bowls.depth, K.bowls.depth)),
    });
  }
  const headwalls: Headwall[] = [];
  const nWalls = scaleCount(F.headwalls.count, K.headwalls.count);
  const wallCount = rng.int(nWalls.min, nWalls.max);
  for (let i = 0; i < wallCount; i++) {
    const u = inBand(rng, F.headwalls.at);
    headwalls.push({
      z: summitZ + (baseZ - summitZ) * u,
      drop: inBand(rng, scaleBand(F.headwalls.drop, K.headwalls.drop)),
      run: inBand(rng, F.headwalls.run),
    });
  }
  const altitude = inBand(rng, region.altitude.base);
  const treeLine = inBand(rng, region.altitude.treeLine);
  const s = {
    warp: seed(),
    flank: seed(),
    hills: seed(),
    ridges: seed(),
    rollers: seed(),
    crests: seed(),
    headwalls: seed(),
  };
  return {
    vertical,
    altitude,
    treeLine,
    summitZ,
    baseZ,
    flank,
    crests: M.crests * K.crests,
    hills,
    ridges,
    rollers: F.rollers.amplitude * K.rollers,
    bowls,
    headwalls,
    profile: tabulateProfile(),
    region,
    seeds: s,
  };
}

/** Fractal value noise centred on zero, roughly −1..1: the octaves are
 * `fbmFields`' fields, halving in scale and in weight. */
function fbm(fields: readonly NoiseField[], x: number, z: number): number {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (const f of fields) {
    sum += (sampleNoise(f, x, z) * 2 - 1) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

function fbmFields(scale: number, octaves: number, seed: number): NoiseField[] {
  const fields: NoiseField[] = [];
  let s = scale;
  for (let o = 0; o < octaves; o++) {
    fields.push(noiseField(s, seed + o * 7919));
    s *= 0.5;
  }
  return fields;
}

/** Ridged noise, 0..1 with sharp crests at 1, off a `ridgedFields` pair. */
function ridged(f: RidgedFields, x: number, z: number): number {
  const a = 1 - Math.abs(sampleNoise(f.coarse, x, z) * 2 - 1);
  const b = 1 - Math.abs(sampleNoise(f.fine, x, z) * 2 - 1);
  const v = a * a * 0.7 + b * b * 0.3;
  // v^1.25, sharpening the crests, without a pow.
  return v * Math.sqrt(Math.sqrt(v));
}

type RidgedFields = { readonly coarse: NoiseField; readonly fine: NoiseField };

function ridgedFields(scale: number, seed: number): RidgedFields {
  return { coarse: noiseField(scale, seed), fine: noiseField(scale * 0.5, seed + 31) };
}

/** Every noise field the mountain is read off, for one plan. Each keeps the
 * lattice square it last read (`NoiseField`), and a bake reads its grid in
 * order, so nearly every read reuses its field's four corner hashes. */
type CountryFields = {
  readonly warpX: NoiseField;
  readonly warpZ: NoiseField;
  readonly flank: NoiseField;
  readonly hills: readonly NoiseField[];
  readonly ridges: RidgedFields;
  readonly rollers: RidgedFields;
  readonly crests: RidgedFields;
  readonly crestsFine: RidgedFields;
  readonly headwalls: readonly NoiseField[];
};

function countryFields(plan: TerrainPlan): CountryFields {
  const s = plan.seeds;
  return {
    warpX: noiseField(420, s.warp),
    warpZ: noiseField(420, s.warp + 17),
    flank: noiseField(260, s.flank),
    hills: fbmFields(R.face.hills.scale, 4, s.hills),
    ridges: ridgedFields(R.face.ridges.scale, s.ridges),
    rollers: ridgedFields(R.face.rollers.scale, s.rollers),
    crests: ridgedFields(170, s.crests),
    crestsFine: ridgedFields(60, s.crests + 5),
    headwalls: plan.headwalls.map((_, i) => noiseField(160, s.headwalls + i * 101)),
  };
}

/** The share of the way down the descent a point stands, 0 at the summit
 * ridge … 1 at the valley floor (not clamped). */
export function descentAt(plan: TerrainPlan, z: number): number {
  return (z - plan.summitZ) / (plan.baseZ - plan.summitZ);
}

/** R2 — how far up a side ridge a point stands: 0 on the face, 1 at the
 * flank's full height. Read off the warp's noise at (x, z). */
function flankOf(plan: TerrainPlan, noise: number, x: number, z: number): number {
  const F = R.mountain.flank;
  const warp = (noise * 2 - 1) * F.warp;
  const across = Math.abs(x - R.world.size / 2) + warp;
  const open = 1 - smoothstep(F.open.min, F.open.max, descentAt(plan, z));
  return smoothstep(F.inner, F.outer, across) * open;
}

/** R2 — how far up a side ridge a plan point stands, 0..1. */
export function flankAt(plan: TerrainPlan, x: number, z: number): number {
  return flankOf(plan, valueNoise(x, z, 260, plan.seeds.flank), x, z);
}

/** The profile's share of the vertical still to fall at `u`, off the
 * table, 1 above the summit and 0 past the base. */
function profileAt(plan: TerrainPlan, u: number): number {
  if (u <= 0) return 1;
  if (u >= 1) return 0;
  const t = u * PROFILE_SAMPLES;
  const i = Math.floor(t);
  const a = plan.profile[i];
  return a + (plan.profile[i + 1] - a) * (t - i);
}

/** R2, R3 — the untouched mountain's height at a plan point, m, read off
 * the plan's `countryFields`. */
function countryAt(plan: TerrainPlan, f: CountryFields, x: number, z: number): number {
  const M = R.mountain;
  const F = R.face;
  const u = descentAt(plan, z);
  // THE PROFILE, the headwalls' drops taken out of it and put back as
  // bands: each drops all of its own where the ground crosses it, the band
  // wandering up and down the face across x.
  let drops = 0;
  for (const w of plan.headwalls) drops += w.drop;
  let h = (plan.vertical - drops) * profileAt(plan, u);
  for (let i = 0; i < plan.headwalls.length; i++) {
    const w = plan.headwalls[i];
    const dz = z - w.z;
    if (dz < -w.run) {
      h += w.drop;
      continue;
    }
    if (dz > w.run) continue;
    const wander = (sampleNoise(f.headwalls[i], x, 0) * 2 - 1) * F.headwalls.wander;
    h += w.drop * (1 - smoothstep(-w.run / 2, w.run / 2, dz + wander));
  }
  // Behind the ridge the ground falls away toward the map's top edge, so
  // the summit ridge is a crest.
  if (z < plan.summitZ) h -= (plan.summitZ - z) * M.back;
  // A slow domain warp, so the folds are not laid out on the noise's own
  // lattice.
  const wx = x + (sampleNoise(f.warpX, x, z) * 2 - 1) * 70;
  const wz = z + (sampleNoise(f.warpZ, x, z) * 2 - 1) * 70;
  const flank = flankOf(plan, sampleNoise(f.flank, x, z), x, z);
  // THE FACE: the broad rolls, quieter on the valley floor; the spurs and
  // gullies, stretched down the fall line and gone on the flanks; the
  // rollers on a lattice turned off the others'.
  const floor = 1 - (1 - F.hills.floor) * smoothstep(0.9, 1.05, u);
  h += fbm(f.hills, wx, wz) * plan.hills * floor;
  h += (ridged(f.ridges, wx, wz / F.ridges.stretch) - 0.5) * plan.ridges * (1 - flank) * floor;
  if (plan.rollers > 0) {
    const rx = wx * 0.8 + wz * 0.6;
    const rz = wz * 0.8 - wx * 0.6;
    h += (ridged(f.rollers, rx, rz) - 0.5) * plan.rollers * floor;
  }
  for (const b of plan.bowls) {
    const d2 = ((x - b.x) ** 2 + (z - b.z) ** 2) / (b.r * b.r);
    if (d2 < 1) h -= b.depth * (1 - d2) * (1 - d2);
  }
  // THE SIDE RIDGES, with crests of their own; and THE SUMMIT RIDGE's
  // crests, fading down the face over `crestSpread`.
  const crest = z - plan.summitZ;
  const ridge = crest < 0 ? 1 : 1 - smoothstep(0, M.crestSpread, crest);
  if (flank > 0 || ridge > 0) {
    const rx = wx * 0.866 - wz * 0.5;
    const rz = wx * 0.5 + wz * 0.866;
    const crests =
      plan.crests * (ridged(f.crests, rx, rz) * 0.75 + ridged(f.crestsFine, rz, rx) * 0.25);
    h += plan.flank * flank * Math.sqrt(flank) + crests * Math.max(flank, ridge);
  }
  return h;
}

/** Bake the untouched mountain onto the map's grid (R1), row by row — the
 * order the noise fields' kept squares pay off in. */
export function bakeCountry(plan: TerrainPlan): Heightfield {
  const cell = R.world.cell;
  const n = Math.round(R.world.size / cell) + 1;
  const field = createHeightfield(0, 0, cell, n, n);
  const d = field.data;
  const fields = countryFields(plan);
  for (let r = 0; r < n; r++) {
    const z = r * cell;
    for (let c = 0; c < n; c++) d[r * n + c] = countryAt(plan, fields, c * cell, z);
  }
  return field;
}
