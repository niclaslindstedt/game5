// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PICTURE SWEEP — every PICTURE row priced in ONE long run, by turning
// its stops on and off at random and reading what each did to the frame.
//
// The price list `make bench ARGS="--costs"` takes lowers one row at a time
// against the top picture, in separate page loads, and spends an hour doing
// it. The sweep is the designed experiment instead: the race is drawn in
// BLOCKS of a few dozen frames, every block under a picture dealt at random
// — every row at a stop of its own, each row's stops dealt equally often
// and shuffled apart from every other row's — and a least-squares fit over
// the blocks' frame times reads back each stop's cost over its row's
// cheapest. Because every row moves in every block, every block measures
// every row; because the deal is random, nothing the race does at a moment
// (the woods, the kicker, the field strung out) and nothing the machine
// does over the hour (warming up, throttling) lines up with any one stop.
// What the fit cannot shake off it is asked to explain: a slow drift in
// time and the place in the race loop are terms of their own.
//
// What a stop's figure MEANS: what moving that row from its cheapest stop to
// this one adds to the frame, ms, AVERAGED over every picture the other rows
// were dealt — a main effect. Where rows interact (RESOLUTION's pixels make
// every pixel-bound row dearer) the figure is the cost in the middle of the
// ladder, not at its top; that is what the fit in `picture-fit.ts` adds up,
// so it is the figure it wants.
//
// DOM-free and three-free: the run that collects blocks is `benchmark.ts`;
// `scripts/benchmark.mjs --sweep` and `tests/picture_sweep_test.ts` read
// this on plain Node.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";

import type { BenchSceneId } from "./bench-scenes.ts";
import { FLOOR_MS, PICTURE_PRICES, type PriceList, type StopPrice } from "./picture-fit.ts";
import {
  PICTURE_LADDERS,
  PICTURE_ROWS,
  type PictureRow,
  type VideoSettings,
} from "./settings-video.ts";

/** A picture as the sweep deals it: every row at a stop. */
export type SweepPicture = { [R in PictureRow]: VideoSettings[R] };

/** THE SWEEP'S SHAPE. */
export type SweepPlan = {
  /** Pictures dealt: the more, the tighter every figure (the standard
   * error goes as one over the square root). 240 puts each RESOLUTION stop
   * under 40 blocks. */
  blocks: number;
  /** Frames drawn under each. */
  blockFrames: number;
  /** ...of which the first are let go untimed: a moved row rebuilds what it
   * draws (the ground, the trail maps, the shadow map, a shader), and the
   * frames that pay for that are the change's, not the stop's. */
  settle: number;
  /** Frames of race before it is stood up again at the start: the plan's
   * own stretch (the start, the woods, the kicker), so a long sweep goes on
   * drawing the scene the benchmark was chosen for rather than a finish
   * area. */
  loopFrames: number;
  /** Bins the place in the race loop is cut into for the fit. */
  phaseBins: number;
  /** Seed of the deal — the same seed deals the same pictures. */
  seed: number;
};

export const SWEEP: SweepPlan = {
  blocks: 240,
  blockFrames: 40,
  settle: 12,
  loopFrames: 1800,
  phaseBins: 6,
  seed: 5,
};

/** The fewest pictures a sweep is run with: past the fit's terms, with room
 * for the noise to be read. */
export const SWEEP_LEAST = 60;

/** THE DEAL: `blocks` pictures, each row's ladder repeated to the length and
 * shuffled on its own, so every stop is dealt equally often (to within one)
 * and no two rows move together. */
export function dealSweep(blocks: number, seed: number = SWEEP.seed): SweepPicture[] {
  const rng = createRng(seed);
  const columns = {} as Record<PictureRow, string[]>;
  for (const row of PICTURE_ROWS) {
    const ladder = PICTURE_LADDERS[row] as readonly string[];
    const column: string[] = [];
    // Each pass round the ladder starts at a random stop, so the stops a
    // short sweep leaves one short are not always the dear ones.
    const offset = rng.int(0, ladder.length - 1);
    for (let i = 0; i < blocks; i++) column.push(ladder[(i + offset) % ladder.length]);
    for (let i = column.length - 1; i > 0; i--) {
      const j = rng.int(0, i);
      [column[i], column[j]] = [column[j], column[i]];
    }
    columns[row] = column;
  }
  const out: SweepPicture[] = [];
  for (let b = 0; b < blocks; b++) {
    const picture = {} as Record<PictureRow, string>;
    for (const row of PICTURE_ROWS) picture[row] = columns[row][b];
    out.push(picture as SweepPicture);
  }
  return out;
}

/** One block as it was drawn and timed. */
export type SweepBlock = {
  picture: SweepPicture;
  /** The median of the timed frames, ms: the whole frame end to end (what
   * the probe times), and the processor's half of it (the engine's step and
   * the renderer's CPU work). */
  wall: number;
  cpu: number;
  /** Frames timed. */
  frames: number;
  /** When it was drawn, s from the green. */
  at: number;
  /** Where in the race loop, 0 at the start to 1 at the plan's end. */
  loop: number;
};

/** A median, ms; NaN of nothing. */
export function medianOf(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** One stop's reading: ms over its row's cheapest, and its standard error. */
export type StopFit = { ms: number; se: number };

/** THE FIT over one measure. */
export type SweepFit = {
  /** Blocks fitted, and the ones dropped as outliers (a hitch on the
   * machine, a garbage collection landing in one block). */
  blocks: number;
  dropped: number;
  /** The frame with every row at its cheapest, ms — averaged over the time
   * and the place in the race — and with every row at its top. */
  floorMs: number;
  topMs: number;
  /** What the fit leaves unexplained, ms a block (one standard deviation),
   * and the share of the blocks' spread it explains. */
  residualMs: number;
  r2: number;
  /** Every row's every stop over its cheapest (which reads 0). */
  rows: { [R in PictureRow]: Record<string, StopFit> };
};

/** Solve the symmetric positive system `a` and return its inverse — p is a
 * few dozen, so plain Gauss–Jordan with pivoting is enough. A singular
 * column (a stop never dealt) is held at zero rather than thrown. */
function invert(a: number[][]): number[][] {
  const n = a.length;
  const m = a.map((row, i) => [...row, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let pivot = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(m[r][c]) > Math.abs(m[pivot][c])) pivot = r;
    [m[c], m[pivot]] = [m[pivot], m[c]];
    const p = m[c][c];
    if (Math.abs(p) < 1e-12) {
      for (let j = 0; j < 2 * n; j++) m[c][j] = 0;
      continue;
    }
    for (let j = 0; j < 2 * n; j++) m[c][j] /= p;
    for (let r = 0; r < n; r++) {
      if (r === c || m[r][c] === 0) continue;
      const f = m[r][c];
      for (let j = 0; j < 2 * n; j++) m[r][j] -= f * m[c][j];
    }
  }
  return m.map((row) => row.slice(n));
}

type Column = { row: PictureRow; stop: string } | { nuisance: string };

/** The design: an intercept, a dummy for every stop over its row's
 * cheapest, the time (and its square) and the place in the race loop. */
function design(
  blocks: readonly SweepBlock[],
  phaseBins: number,
): { columns: Column[]; x: number[][] } {
  const columns: Column[] = [{ nuisance: "intercept" }];
  for (const row of PICTURE_ROWS) {
    for (const stop of (PICTURE_LADDERS[row] as readonly string[]).slice(1)) {
      columns.push({ row, stop });
    }
  }
  columns.push({ nuisance: "time" }, { nuisance: "time²" });
  for (let b = 1; b < phaseBins; b++) columns.push({ nuisance: `loop ${b}` });
  const first = Math.min(...blocks.map((b) => b.at));
  const last = Math.max(...blocks.map((b) => b.at));
  const span = Math.max(1e-6, last - first);
  const x = blocks.map((block) => {
    const t = ((block.at - first) / span) * 2 - 1;
    const bin = Math.min(phaseBins - 1, Math.floor(block.loop * phaseBins));
    return columns.map((c) => {
      if ("row" in c) return block.picture[c.row] === c.stop ? 1 : 0;
      if (c.nuisance === "intercept") return 1;
      if (c.nuisance === "time") return t;
      if (c.nuisance === "time²") return t * t - 1 / 3;
      return c.nuisance === `loop ${bin}` ? 1 : 0;
    });
  });
  return { columns, x };
}

function leastSquares(x: number[][], y: number[]): { beta: number[]; inv: number[][] } {
  const p = x[0].length;
  const xtx = Array.from({ length: p }, () => new Array<number>(p).fill(0));
  const xty = new Array<number>(p).fill(0);
  for (let i = 0; i < x.length; i++) {
    const xi = x[i];
    for (let a = 0; a < p; a++) {
      if (xi[a] === 0) continue;
      xty[a] += xi[a] * y[i];
      for (let b = 0; b < p; b++) xtx[a][b] += xi[a] * xi[b];
    }
  }
  const inv = invert(xtx);
  const beta = inv.map((row) => row.reduce((s, v, j) => s + v * xty[j], 0));
  return { beta, inv };
}

/** THE FIT: ordinary least squares over the blocks, once; the blocks whose
 * residual is past four robust standard deviations (a hitch, not the
 * picture) let go; and again over the rest. */
export function fitSweep(
  blocks: readonly SweepBlock[],
  measure: "wall" | "cpu" = "wall",
  phaseBins: number = SWEEP.phaseBins,
): SweepFit {
  const usable = blocks.filter((b) => Number.isFinite(b[measure]) && b.frames > 0);
  let kept = usable;
  let fit = fitOnce(kept, measure, phaseBins);
  const spread = 1.4826 * medianOf(fit.residuals.map(Math.abs));
  if (spread > 0) {
    const next = kept.filter((_, i) => Math.abs(fit.residuals[i]) <= 4 * spread);
    if (next.length < kept.length && next.length > fit.columns.length) {
      kept = next;
      fit = fitOnce(kept, measure, phaseBins);
    }
  }
  const { columns, beta, inv, residuals, x } = fit;
  const n = kept.length;
  const dof = Math.max(1, n - columns.length);
  const sse = residuals.reduce((s, r) => s + r * r, 0);
  const sigma2 = sse / dof;
  const ys = kept.map((b) => b[measure]);
  const mean = ys.reduce((s, v) => s + v, 0) / Math.max(1, n);
  const sst = ys.reduce((s, v) => s + (v - mean) * (v - mean), 0);
  // The floor is the frame with no stop over its cheapest, the nuisance
  // terms at their average over the run.
  let floorMs = 0;
  for (let c = 0; c < columns.length; c++) {
    if ("row" in columns[c]) continue;
    const avg = x.reduce((s, row) => s + row[c], 0) / Math.max(1, n);
    floorMs += beta[c] * avg;
  }
  const rows = {} as SweepFit["rows"];
  let topMs = floorMs;
  for (const row of PICTURE_ROWS) {
    const ladder = PICTURE_LADDERS[row] as readonly string[];
    const stops: Record<string, StopFit> = { [ladder[0]]: { ms: 0, se: 0 } };
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      if (!("row" in col) || col.row !== row) continue;
      stops[col.stop] = { ms: beta[c], se: Math.sqrt(Math.max(0, sigma2 * inv[c][c])) };
    }
    topMs += stops[ladder[ladder.length - 1]].ms;
    rows[row] = stops;
  }
  return {
    blocks: n,
    dropped: usable.length - n,
    floorMs,
    topMs,
    residualMs: Math.sqrt(sigma2),
    r2: sst > 0 ? 1 - sse / sst : 0,
    rows,
  };
}

function fitOnce(
  blocks: readonly SweepBlock[],
  measure: "wall" | "cpu",
  phaseBins: number,
): { columns: Column[]; x: number[][]; beta: number[]; inv: number[][]; residuals: number[] } {
  const { columns, x } = design(blocks, phaseBins);
  const y = blocks.map((b) => b[measure]);
  const { beta, inv } = leastSquares(x, y);
  const residuals = x.map((row, i) => y[i] - row.reduce((s, v, j) => s + v * beta[j], 0));
  return { columns, x, beta, inv, residuals };
}

/** What one sweep reports: the plan, both fits, and the blocks themselves. */
export type SweepResult = {
  plan: SweepPlan;
  /** The buffer drawn into, device pixels, and the view. */
  width: number;
  height: number;
  view: BenchSceneId;
  wall: SweepFit;
  cpu: SweepFit;
  blocks: SweepBlock[];
};

/** A cost table in `PICTURE_PRICES`' shape: ms over each row's cheapest. */
export type SweepCosts = { [R in PictureRow]: Record<string, number> };

/** THE COSTS FOR `picture-fit.ts`: each stop at the DEAREST view's figure
 * (a picture has to hold on its worst view, as `--costs` prices it),
 * levelled so no stop is priced under the one below it and none under 0
 * (that is the noise, not a stop paying for itself), to the hundredth. */
export function sweepCosts(results: readonly SweepResult[]): {
  floorMs: number;
  costs: SweepCosts;
} {
  const costs = {} as SweepCosts;
  for (const row of PICTURE_ROWS) {
    const ladder = PICTURE_LADDERS[row] as readonly string[];
    let last = 0;
    costs[row] = {};
    for (const stop of ladder) {
      const dearest = Math.max(0, ...results.map((r) => r.wall.rows[row][stop]?.ms ?? 0));
      last = Math.max(last, dearest);
      costs[row][stop] = Math.round(last * 100) / 100;
    }
  }
  const floors = results.map((r) => r.wall.floorMs).filter(Number.isFinite);
  const floorMs = floors.length > 0 ? Math.round(Math.min(...floors) * 100) / 100 : FLOOR_MS;
  return { floorMs, costs };
}

/** The price list with the sweep's costs laid in and the benefits kept —
 * what `fitPicture` would read if the costs were pasted. */
export function sweptPrices(costs: SweepCosts, prices: PriceList = PICTURE_PRICES): PriceList {
  const out = {} as Record<PictureRow, Record<string, StopPrice>>;
  for (const row of PICTURE_ROWS) {
    const was = prices[row] as Record<string, StopPrice>;
    out[row] = {};
    for (const [stop, price] of Object.entries(was)) {
      out[row][stop] = { cost: costs[row][stop] ?? price.cost, benefit: price.benefit };
    }
  }
  return out as unknown as PriceList;
}

const fixed = (v: number, d = 2): string => (Number.isFinite(v) ? v.toFixed(d) : "—");

/** THE REPORT'S SECTION: the fit per stop beside today's price, then the
 * whole result as one JSON line between markers, for an agent to read back
 * (`readSweep`). */
export function sweepLines(result: SweepResult): string[] {
  const { wall, cpu, plan } = result;
  const out = [
    "",
    `PICTURE SWEEP — ${wall.blocks} random pictures of ${plan.blockFrames} frames ` +
      `(${plan.settle} let settle), the ${result.view}'s view, ${result.width}×${result.height}`,
    `  every row at its cheapest ${fixed(wall.floorMs)} ms · every row at its top ` +
      `${fixed(wall.topMs)} ms · ±${fixed(wall.residualMs)} ms a block unexplained · ` +
      `r² ${fixed(wall.r2)}${wall.dropped > 0 ? ` · ${wall.dropped} blocks dropped` : ""}`,
    "  ms over each row's cheapest stop — the frame end to end (± one standard error),",
    "  the processor's share of it, and PICTURE_PRICES' cost today",
    `  ${"row".padEnd(11)} ${"stop".padEnd(7)} ${"wall".padStart(7)} ${"±".padStart(6)} ` +
      `${"cpu".padStart(7)} ${"price".padStart(7)}`,
  ];
  for (const row of PICTURE_ROWS) {
    const ladder = PICTURE_LADDERS[row] as readonly string[];
    for (const stop of ladder.slice(1)) {
      const w = wall.rows[row][stop];
      const c = cpu.rows[row][stop];
      const today = (PICTURE_PRICES[row] as Record<string, StopPrice>)[stop]?.cost;
      out.push(
        `  ${row.padEnd(11)} ${stop.padEnd(7)} ${fixed(w.ms).padStart(7)} ` +
          `${fixed(w.se).padStart(6)} ${fixed(c.ms).padStart(7)} ${fixed(today).padStart(7)}`,
      );
    }
  }
  out.push(SWEEP_OPEN, JSON.stringify(result), SWEEP_CLOSE);
  return out;
}

export const SWEEP_OPEN = "PICTURE SWEEP JSON >>>";
export const SWEEP_CLOSE = "<<< PICTURE SWEEP JSON";

/** Every sweep a report carries (a pasted device report, a lab's file),
 * read back off its markers. */
export function readSweeps(text: string): SweepResult[] {
  const out: SweepResult[] = [];
  let from = 0;
  for (;;) {
    const open = text.indexOf(SWEEP_OPEN, from);
    if (open < 0) break;
    const close = text.indexOf(SWEEP_CLOSE, open);
    if (close < 0) break;
    try {
      out.push(JSON.parse(text.slice(open + SWEEP_OPEN.length, close)) as SweepResult);
    } catch {
      // A report cut short in the paste leaves what came before it.
    }
    from = close + SWEEP_CLOSE.length;
  }
  return out;
}

/** THE TABLE TO PASTE: `FLOOR_MS` and every row's costs as
 * `PICTURE_PRICES` spells them, beside today's. */
export function sweepTable(results: readonly SweepResult[]): string {
  const { floorMs, costs } = sweepCosts(results);
  const views = results.map((r) => `${r.view} ${r.width}×${r.height}`).join(", ");
  const out = [
    `COSTS FOR picture-fit.ts off the sweep (${views}), ms over each row's cheapest stop`,
    `  FLOOR_MS = ${floorMs.toFixed(2)}   (today ${FLOOR_MS.toFixed(2)})`,
  ];
  for (const row of PICTURE_ROWS) {
    const ladder = PICTURE_LADDERS[row] as readonly string[];
    const today = PICTURE_PRICES[row] as Record<string, StopPrice>;
    const cells = ladder.map(
      (stop) => `${stop} ${costs[row][stop].toFixed(2)} (${today[stop].cost.toFixed(2)})`,
    );
    out.push(`  ${row.padEnd(11)} ${cells.join("  ")}`);
  }
  return out.join("\n");
}
