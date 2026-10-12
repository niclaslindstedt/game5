// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE FREE RIDE'S WHERE STEPS (`menu-where.tsx`) — a block of
// the one strings table (`strings.ts`, §39.1), spread into `STRINGS` under
// the same names: the world map's head, its rows and its readings. A place
// is named only by its range, area and part (`strings-ranges.ts`, the face
// index) — never a lift, a piste, a lake or a brand.

export const WHERE_STRINGS = {
  /** The world map's title, and the area step's. */
  whereTitle: "WHERE",
  whereAreaTitle: "MOUNTAIN",
  /** The start card's chip back onto the world map. */
  /** The world map being fetched (it is its own small download). */
  whereLoading: "LOADING THE MAP",
  /** The line under the map: the place picked and roughly where it lies. */
  whereAt: (lat: number, lon: number): string =>
    `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? "E" : "W"}`,
  /** How many mountainsides an area has, on its marker's line. */
  whereParts: (n: number): string => (n === 1 ? "ONE MOUNTAIN" : `${n} MOUNTAINS`),
  /** A generated mountain has no place on the globe. */
  whereGenerated: "A MOUNTAIN OF ITS OWN, RAISED OFF ITS NUMBER",
  /** The scale bar's length. */
  whereKm: (km: number): string => `${km} KM`,
  /** How many real pistes an area or a mountainside has. */
  whereSlopes: (n: number): string => (n === 1 ? "ONE SLOPE" : `${n} SLOPES`),
  /** The reading's three figures, each a caption over its value: the drop
   * from the highest piste to the lowest, the steepest hundred metres of
   * any piste and the pistes' mean pitch, as a gradient in per cent. */
  whereDrop: "DROP",
  whereSteepest: "STEEPEST",
  whereMean: "AVERAGE",
  whereMetres: (m: number): string => `${Math.round(m)} M`,
  wherePitch: (g: number | null): string => (g === null ? "—" : `${Math.round(g * 100)}%`),
  /** A figure still being read off the mountain. */
  whereReading: "…",
} as const;
