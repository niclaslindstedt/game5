// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKY TABLE'S LAYOUT — what the bake (`scripts/sky-table.mjs`) writes
// and the game (`sky-atmosphere.ts`) reads, stated once. Three-free and
// import-free, so the bake runs it in plain Node.
//
// Rows by the lens's ALTITUDE over the sea (outer) and the sun's ELEVATION
// (inner); each row a grid of the sky's radiance by the view's azimuth from
// the sun and its elevation, then (after every grid) the sun's
// transmittance a row, then (in a list of its own) the sky's irradiance as
// 27 harmonics a row.

/** The sun's elevations a row is baked at, degrees: a degree apart from
 * nautical twilight up through sunrise, wider as it climbs. */
export const SKY_ELEVATIONS = [
  -20, -18, -16, -14, -12, -11, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8,
  10, 12, 14, 17, 20, 24, 28, 33, 40, 50, 60, 75, 90,
];

/** The lens's altitudes over the sea a row is baked at, m. */
export const SKY_ALTITUDES = [0, 3000];

/** The grid: azimuths from the sun (u = √(az/π), so finest toward the sun's
 * glow) and view elevations (v = √(el/(π/2)), finest at the horizon, where
 * Earth's shadow and the Belt of Venus stand). */
export const SKY_VIEW_AZ = 10;
export const SKY_VIEW_EL = 9;

/** The view direction of grid cell (`i` azimuth, `j` elevation) in the
 * sun's frame (the sun toward +z), y up. */
export function viewDirection(i: number, j: number): { x: number; y: number; z: number } {
  const u = i / (SKY_VIEW_AZ - 1);
  const v = j / (SKY_VIEW_EL - 1);
  const az = u * u * Math.PI;
  const el = v * v * (Math.PI / 2);
  const c = Math.cos(el);
  return { x: Math.sin(az) * c, y: Math.sin(el), z: Math.cos(az) * c };
}

/** A radiance's 16-bit code: (log₂ x + 48) thousandths, 0 for nothing. */
export function encodeRadiance(x: number): number {
  if (!(x > 0)) return 0;
  return Math.max(1, Math.min(65535, Math.round((Math.log2(x) + 48) * 1000)));
}

export function decodeRadiance(code: number): number {
  return code === 0 ? 0 : Math.pow(2, code / 1000 - 48);
}

/** How many numbers a row's grid holds. */
export const SKY_GRID = SKY_VIEW_AZ * SKY_VIEW_EL * 3;
