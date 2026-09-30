// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEED'S CHART AS NUMBERS — what the start card draws over the baked
// ground of a map (`seed-preview.tsx`), and the one mapping between a point
// on that chart and a point on the snow, both ways, so a spot tapped on the
// chart is the spot the free ride starts at. DOM-free and three-free: the
// worker cuts the schematic here without a document, and the suite reads it
// (`tests/free_ride_card_test.ts`).
//
// THE CHART IS NORTH-UP. The engine's +z is north and +x east (the framework's `core/solar`
// puts the noon sun at heading π, due −z), so the chart's x is the world's x
// and its y is the world's z turned upside down — a map, not a mirror. The
// ground is the minimap's own bake (`minimap-bake.ts`, whose rows run along
// +z), so the plate flips it once, in `seed-preview.tsx`, and nothing else
// ever needs to know.
//
// WHAT IS ON IT is what a free skier reads a map for: the loop, the grid,
// and EVERY KICKER — the crests shaped to throw a skis, on the track and off
// it — which is what he is out there hunting.

import type { GeneratedLevel, Level } from "@engine";

/** The chart's own square user space. */
export const CHART_VIEW = 100;

/** How many pixels across the ground is baked at for the chart: the plate
 * is a couple of hundred CSS pixels on a card, and a 1.6 km map at 256 is a
 * pixel every six metres — the woods as a texture and the hills as light. */
export const CHART_PX = 256;

/** A kicker on the chart: where its lip is, which way it throws, and
 * whether it is on the piste (`K…`) or out on the mountain (`X…`). */
export type ChartKicker = { id: string; x: number; y: number; angle: number; onTrack: boolean };

/** Everything drawn over the ground, in chart units. */
export type SeedSchematic = {
  /** The map's side, m — what a chart point is scaled back by. */
  size: number;
  /** The piste's centreline as one OPEN SVG path, the start line to the
   * finish. */
  track: string;
  kickers: ChartKicker[];
  /** The start line's first slot: where a ride starts when no spot is
   * picked, and the heading it faces, rad. */
  grid: { x: number; y: number; angle: number };
};

/** How many of the piste's 2 m points go into the drawn line: every
 * eighth is a point every sixteen metres, finer than any bend on a chart a
 * couple of hundred pixels across. */
const TRACK_STRIDE = 8;

/** A world plan point on the chart. */
export function toChart(size: number, x: number, z: number): [number, number] {
  return [(x / size) * CHART_VIEW, CHART_VIEW - (z / size) * CHART_VIEW];
}

/** A chart point on the snow: the inverse of {@link toChart}, held on the
 * map. */
export function fromChart(size: number, cx: number, cy: number): { x: number; z: number } {
  const u = Math.min(1, Math.max(0, cx / CHART_VIEW));
  const v = Math.min(1, Math.max(0, cy / CHART_VIEW));
  return { x: u * size, z: (1 - v) * size };
}

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

/** THE SCHEMATIC of a map, cut once per seed (in the worker). A heading is
 * clockwise from north, which on a north-up chart is clockwise on screen —
 * so it goes into an SVG `rotate` as it is. */
export function seedSchematic(
  level: Pick<GeneratedLevel, "size" | "track" | "kickers" | "grid">,
): SeedSchematic {
  const size = level.size;
  const kickers = level.kickers.map((k) => {
    const [x, y] = toChart(size, k.x, k.z);
    return { id: k.id, x, y, angle: k.heading, onTrack: k.onTrack };
  });
  const g = level.grid[0];
  const [gx, gy] = toChart(size, g.x, g.z);
  return { size, track: trackPath(level), kickers, grid: { x: gx, y: gy, angle: g.heading } };
}

/** Degrees, for an SVG `rotate`. */
export const degrees = (rad: number): number => (rad * 180) / Math.PI;
