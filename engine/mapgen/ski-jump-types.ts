// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI JUMPING HILL AS A MAP PUBLISHES IT (R43, `ski-jump.ts`) — stated
// beside `types.ts`, which re-exports it, so that file stays under its cap.

import type { Level } from "./types.ts";

/** A SKI JUMPING HILL (R43) as it was built over a map: its own `track`,
 * every place down it m of plan along its line (the tower's deck at 0).
 * The hill's elements and the norm behind them are `ski-jump.ts`'s
 * (`skiJumpProfile`). */
export interface SkiJumpHill {
  /** The map it was built over, before any course. */
  base: Level;
  /** The hill of the norm it was built to. */
  hill: "large" | "normal";
  /** K's distance and the hill size, m of distance. */
  w: number;
  hs: number;
  /** The start gate's (the top gate's) and the finish line's (the fall
   * line's) places, m of plan, and the vertical between them, m. */
  from: number;
  to: number;
  vertical: number;
  /** The in-run's straight's top, the curve's top, the table's start, the
   * EDGE, P, K, L, U and the out-run's end, m of plan. */
  straight: number;
  curve: number;
  table: number;
  edge: number;
  p: number;
  k: number;
  l: number;
  u: number;
  outrun: number;
  /** The table's angle at the edge, rad (down positive), and the edge's
   * height over the knoll's foot under it, m. */
  takeOff: number;
  lip: number;
  /** The START GATES, the lowest (number 1) first: where each stands, m of
   * plan, its height, m, and its distance from the edge along the in-run,
   * m — and the DESIGN GATE (an index), the lowest whose jumper reaches the
   * edge at the design `speed`, m/s, in calm air. */
  gates: readonly { number: number; x: number; y: number; e: number }[];
  design: number;
  speed: number;
  /** The scoring numbers: the metre value (points a metre), the gate
   * factor (points a metre of in-run) and the wind factors (points per m/s
   * of head and of tail wind). */
  metre: number;
  gateFactor: number;
  headFactor: number;
  tailFactor: number;
  /** The hill's width, m. */
  width: number;
  /** The hill's height `d` m of plan along its line, m — the analytic
   * surface. */
  yAt: (d: number) => number;
  /** The DISTANCE a landing `d` m of plan along the line is credited, m,
   * unrounded: along the landing profile from the knoll's foot, scaled so
   * K reads `w`. */
  distanceAt: (d: number) => number;
}
