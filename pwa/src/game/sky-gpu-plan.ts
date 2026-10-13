// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GPU SKY, DECIDED — what the MEDIUM and HIGH skies draw, stated once
// and three-free so the suite reads it (`tests/sky_gpu_test.ts`). The
// passes themselves are `sky-gpu.ts`; the model they run is
// `sky-gpu-glsl.ts`, Hillaire's (2020) — the same one `atmosphere-model.ts`
// states in TypeScript and the LOW sky reads baked (`sky-table.ts`).
//
// THREE SKIES, ONE MODEL. LOW draws the dome off the baked table's ten by
// nine grid; MEDIUM and HIGH render the same physics on the GPU into a
// SKY-VIEW table of their own on the very same parametrisation (the
// azimuth from the sun packed toward it, u = √(az/π); the view's elevation
// packed toward the horizon, v = √(el/(π/2)) — the non-linear horizon
// mapping Hillaire's sky-view uses, which puts most rows where Earth's
// shadow, the Belt of Venus and the glow stand) — so `skyColour(dir)` reads
// either the same way and a tier changes the DETAIL, never the colours:
// the same exposure, the same press of the dome about its mean, the same
// night floor, the same lid over it. The light on the snow is the table's
// at every tier.
//
// AERIAL PERSPECTIVE. The haze's DENSITY is the game's (`SkyLook.haze`,
// tuned for a winter mountain's air and closed by the weather), not the
// model's clean air; what the GPU tiers add is its PHYSICS:
//
//   * MEDIUM — the haze's colour is the sky-view's own horizon ring on the
//     surface's bearing (what `hazeColour` reads), and its extinction is
//     the model's per channel (`hazeTint`): the molecules' share of it
//     takes the blue first, the aerosol's is grey.
//   * HIGH — that, and a FROXEL VOLUME (Hillaire's aerial-perspective
//     volume): 32 × 32 cells across the screen by 32 slices of distance out
//     to `FROXELS.depth`, packed side by side into one 2D atlas, each the
//     share of the air's light along the ray to it that the SUN gives
//     (`aerialShade`) — the air in a ridge's shadow lit only by the sky,
//     bluer and darker, so every ridge looking into a low sun stands
//     against brighter air behind it and the far ranges read in layers,
//     never as one olive wash.
//
// Both reach any distance a world material asks: the froxels run to a
// hundred kilometres (`FROXELS.depth` — the far ranges part 5b draws round
// the map read them the same way) and past that the shade is the last
// slice's.

/** One sky tier's GPU work. `lut` null is the baked table (LOW). */
export type SkyTierLook = {
  /** The sky-view table's texels, azimuth × elevation. */
  lut: readonly [number, number] | null;
  /** Steps a sky-view texel marches. */
  steps: number;
  /** Whether the aerial-perspective volume is built (HIGH). */
  froxels: boolean;
  /** Whether the haze's extinction is the model's per channel. */
  tint: boolean;
};

/** THE THREE SKIES. MEDIUM is Hillaire's mobile set-up (a 96 × 50 table,
 * eight steps): on the quadratic spacing the march packs toward the lens,
 * eight steps keep every cell within about 7 % of the 80-step march's
 * light — within 3.5 % once the dome is pressed about its mean
 * (`tests/sky_gpu_test.ts` holds it). HIGH is his desktop's
 * (192 × 108, 30 steps: within half a per cent). */
export const SKY_TIER_LOOK = {
  low: { lut: null, steps: 0, froxels: false, tint: false },
  medium: { lut: [96, 50], steps: 8, froxels: false, tint: true },
  high: { lut: [192, 108], steps: 30, froxels: true, tint: true },
} as const satisfies Record<"low" | "medium" | "high", SkyTierLook>;

/** The tables built once (the air never changes under a run): the
 * transmittance's and the multiple scattering's, as `atmosphere-model.ts`. */
export const SKY_TABLES = {
  trans: { width: 256, height: 64, steps: 40 },
  ms: { size: 32, steps: 20, dirs: 8 },
} as const;

/** The sky-view table is drawn again only when what it shows has moved:
 * the sun by `elevation` rad (the table's own step), the exposure or the
 * dome's mean by `share` of themselves, the night or the veil by `share`. */
export const SKY_REDRAW = { elevation: 2e-4, share: 0.004 } as const;

/** THE AERIAL-PERSPECTIVE VOLUME (HIGH): cells across and up the screen,
 * slices of distance, how far the last slice stands, m, the steps a cell
 * marches to its slice and the steps toward the sun each of those takes
 * through the map's ground (the shadow of a ridge on the air). */
export const FROXELS = {
  size: 32,
  slices: 32,
  depth: 100_000,
  steps: 14,
  light: 6,
  /** The farthest the march toward the sun looks for a ridge, m. */
  reach: 3000,
} as const;

/** How far out slice `k` (0..slices − 1) stands, m: cubed, so the slices
 * crowd the near kilometres where the mountain's shadows are — 3 m, then
 * 25 m, 3 km by the tenth, 12.5 km by the sixteenth, 100 km at the last. */
export function froxelDepth(k: number): number {
  return FROXELS.depth * Math.pow((k + 1) / FROXELS.slices, 3);
}

/** The slice coordinate (fractional) a point `d` m out falls on: −1 at
 * the lens. */
export function froxelSlice(d: number): number {
  return FROXELS.slices * Math.cbrt(Math.max(0, d) / FROXELS.depth) - 1;
}

/** The atlas: the slices side by side, each `size` texels wide. */
export const FROXEL_ATLAS = {
  width: FROXELS.size * FROXELS.slices,
  height: FROXELS.size,
} as const;

export type Rgb = [number, number, number];

/** The molecules' scattering at the sea, 1/m (`atmosphere-model.ts`'s
 * EARTH, restated per metre), their scale height, m, and the aerosol's
 * extinction and scale height. */
const AIR = {
  rayleigh: [5.802e-6, 13.558e-6, 33.1e-6] as Rgb,
  rayleighHeight: 8000,
  mie: 4.4e-6,
  mieHeight: 1200,
};

/**
 * THE HAZE'S EXTINCTION PER CHANNEL, relative to its luminance-weighted
 * whole: the clean air's own (the molecules' Rayleigh, blue first, and the
 * aerosol's grey) at the lens's `altitude`, m, and the rest of the game's
 * `haze` (1/m — a winter valley's damp air, a fall, a fog) grey. 1 in every
 * channel would be LOW's grey haze; a clear day's comes to about
 * (0.95, 1.0, 1.12), a fog's to grey.
 */
export function hazeTint(haze: number, altitude: number, out: Rgb = [1, 1, 1]): Rgb {
  if (!(haze > 0)) {
    out[0] = out[1] = out[2] = 1;
    return out;
  }
  const dr = Math.exp(-Math.max(altitude, 0) / AIR.rayleighHeight);
  const dm = Math.exp(-Math.max(altitude, 0) / AIR.mieHeight);
  const clean: Rgb = [0, 0, 0];
  for (let c = 0; c < 3; c++) clean[c] = AIR.rayleigh[c] * dr + AIR.mie * dm;
  const cleanLum = 0.2126 * clean[0] + 0.7152 * clean[1] + 0.0722 * clean[2];
  const grey = Math.max(0, haze - cleanLum);
  const total = grey + cleanLum;
  for (let c = 0; c < 3; c++) out[c] = (clean[c] + grey) / total;
  return out;
}
