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
  whereMap: "WORLD MAP",
  /** The world map being fetched (it is its own small download). */
  whereLoading: "LOADING THE MAP",
  /** The PART row's hint on the area step. */
  whereMountainHint:
    "Which mountainside of the ski area to ride: each is a real one of its own, its marker standing where it lies.",
  /** The map's own hint, under a press on it. */
  whereMapHint:
    "Drag to pan, pinch or scroll to zoom, and tap a marker to pick that ski area. The range rows fly the map to it.",
  /** The line under the map: the place picked and roughly where it lies. */
  whereAt: (lat: number, lon: number): string =>
    `${Math.abs(lat).toFixed(1)}° ${lat >= 0 ? "N" : "S"} · ${Math.abs(lon).toFixed(1)}° ${lon >= 0 ? "E" : "W"}`,
  /** How many mountainsides an area has, on its marker's line. */
  whereParts: (n: number): string => (n === 1 ? "ONE MOUNTAIN" : `${n} MOUNTAINS`),
  /** A generated mountain has no place on the globe. */
  whereGenerated: "A MOUNTAIN OF ITS OWN, RAISED OFF ITS NUMBER",
  /** The scale bar's length. */
  whereKm: (km: number): string => `${km} KM`,
  /** The caption under the world step. */
  whereCaption:
    "Pick where to ride: a real ski area on the map, or GENERATED last on the RANGE row — a mountain raised off its number.",
  /** The caption under the area step. */
  whereAreaCaption:
    "Pick which of the ski area's mountainsides to ride; NEXT picks the run and the day.",
} as const;
