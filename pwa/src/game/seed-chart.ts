// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEED'S CHART AS NUMBERS — what the start card draws over the baked
// ground of a map (`seed-preview.tsx`), and the one mapping between a point
// on that chart and a point on the snow, both ways, so a spot tapped on the
// chart is the spot the free ride starts at. DOM-free and three-free: the
// worker cuts the schematic here without a document, and the suite reads it
// (`tests/free_ride_card_test.ts`).
//
// THE CHART IS SUMMIT-UP, as a piste map hangs. The world's +z is the fall
// line (the summit ridge at low z, the valley floor at high z), so the chart
// is the plan seen by a skier standing in the valley looking up the face:
// the chart's y is the world's z (down the page is down the mountain) and
// its x is the world's x turned round (the viewer faces −z, so world +x is
// on his LEFT) — the plan turned half a turn, a map and not a mirror, and
// the same left and right the panorama (`panorama.ts`) is painted in. The
// ground is the minimap's own bake (`minimap-bake.ts`, whose rows run along
// +z), so the plate turns its columns round once, in `seed-preview.tsx`, and
// nothing else ever needs to know.
//
// WHAT IS ON IT is what a free skier reads a map for: the piste, the start
// line, and EVERY KICKER — the crests shaped to throw a skis, on the track and off
// it — which is what he is out there hunting; and EVERY HOUSE (`cabinsOf`:
// the huts, cabins, chalets and sheds beside the runs, and the afterski
// lodges), so a seed is chosen knowing where on the mountain there is a
// roof to ski to.

import type { Cabin, CabinKind, GeneratedLevel, Level } from "@engine";

/** The chart's own square user space. */
export const CHART_VIEW = 100;

/** How many pixels across the ground is baked at for the chart: the plate
 * is a couple of hundred CSS pixels on a card, and a 1.6 km map at 256 is a
 * pixel every six metres — the woods as a texture and the hills as light. */
export const CHART_PX = 256;

/** A kicker on the chart: where its lip is, which way it throws (as an SVG
 * rotation, `chartAngle`), and
 * whether it is on the piste (`K…`) or out on the mountain (`X…`). */
export type ChartKicker = { id: string; x: number; y: number; angle: number; onTrack: boolean };

/** A house on the chart: where it stands and what kind it is (an afterski
 * lodge is marked apart from the rest). */
export type ChartHouse = { id: string; x: number; y: number; kind: CabinKind };

/** What a house is read off: `cabinsOf`'s row, or any point with a kind. */
export type HouseSpot = Pick<Cabin, "id" | "kind" | "x" | "z">;

/** Everything drawn over the ground, in chart units. */
export type SeedSchematic = {
  /** The map's side, m — what a chart point is scaled back by. */
  size: number;
  /** The piste's centreline as one OPEN SVG path, the start line to the
   * finish. */
  track: string;
  kickers: ChartKicker[];
  /** Every house on the map (`cabinsOf`). */
  houses: ChartHouse[];
  /** The start line's first slot: where a ride starts when no spot is
   * picked, and the way it faces as an SVG rotation (`chartAngle`), rad. */
  grid: { x: number; y: number; angle: number };
};

/** How many of the piste's 2 m points go into the drawn line: every
 * eighth is a point every sixteen metres, finer than any bend on a chart a
 * couple of hundred pixels across. */
const TRACK_STRIDE = 8;

/** A world plan point on the chart. */
export function toChart(size: number, x: number, z: number): [number, number] {
  return [CHART_VIEW - (x / size) * CHART_VIEW, (z / size) * CHART_VIEW];
}

/** A chart point on the snow: the inverse of {@link toChart}, held on the
 * map. */
export function fromChart(size: number, cx: number, cy: number): { x: number; z: number } {
  const u = Math.min(1, Math.max(0, cx / CHART_VIEW));
  const v = Math.min(1, Math.max(0, cy / CHART_VIEW));
  return { x: (1 - u) * size, z: v * size };
}

/** The light the chart's ground is shaded by: from its upper left — over
 * the summit's left shoulder, world +x and −z — and forty-odd degrees up,
 * the cartographer's convention. A light from the foot of the page turns
 * every ridge into a gully to the eye. */
export const CHART_LIGHT: readonly [number, number, number] = [0.55, 0.9, -0.55];

const f = (n: number): string => n.toFixed(1);

/** The piste as an open path — the last point always in it, so the line
 * reaches the finish whatever the stride. */
export function trackPath(level: Pick<Level, "size" | "track">): string {
  const pts = level.track.points;
  const parts: string[] = [];
  for (let i = 0; i < pts.length; i += TRACK_STRIDE) {
    const [x, y] = toChart(level.size, pts[i].x, pts[i].z);
    parts.push(`${parts.length === 0 ? "M" : "L"}${f(x)} ${f(y)}`);
  }
  if (pts.length > 1 && (pts.length - 1) % TRACK_STRIDE !== 0) {
    const [x, y] = toChart(level.size, pts[pts.length - 1].x, pts[pts.length - 1].z);
    parts.push(`L${f(x)} ${f(y)}`);
  }
  return parts.join(" ");
}

/** A heading (clockwise from above, 0 along +z) as the SVG `rotate` of a
 * mark drawn pointing up the chart: +z is DOWN the chart, so a heading is
 * turned half a turn — and, the chart being the plan turned rather than
 * mirrored, still clockwise. */
export const chartAngle = (heading: number): number => heading + Math.PI;

/** THE SCHEMATIC of a map, cut once per seed (in the worker); `houses` is
 * the map's `cabinsOf`, handed in because it asks for the whole map. */
export function seedSchematic(
  level: Pick<GeneratedLevel, "size" | "track" | "kickers" | "grid">,
  houses: readonly HouseSpot[] = [],
): SeedSchematic {
  const size = level.size;
  const kickers = level.kickers.map((k) => {
    const [x, y] = toChart(size, k.x, k.z);
    return { id: k.id, x, y, angle: chartAngle(k.heading), onTrack: k.onTrack };
  });
  const g = level.grid[0];
  const [gx, gy] = toChart(size, g.x, g.z);
  return {
    size,
    track: trackPath(level),
    kickers,
    houses: houses.map((h) => {
      const [x, y] = toChart(size, h.x, h.z);
      return { id: h.id, x, y, kind: h.kind };
    }),
    grid: { x: gx, y: gy, angle: chartAngle(g.heading) },
  };
}

/** Degrees, for an SVG `rotate`. */
export const degrees = (rad: number): number => (rad * 180) / Math.PI;
