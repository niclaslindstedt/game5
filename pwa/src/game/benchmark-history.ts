// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERY RUN THIS MACHINE HAS SCORED — the benchmark's memory, and the sheet
// it is read back as.
//
// A score is worth nothing alone: the tool is for running a race, moving one
// row of OPTIONS ▸ PICTURE and running it again, and by the time the second
// run is set up the first card is gone. So every finished run is kept WHOLE
// — the readings, the costs, the scene and the totals, not just the number —
// because the question the second run raises is always about the first
// one's breakdown, and a history that kept only scores could not answer it.
//
// Above the storage line it is pure (`mergeBenchmarks`, `keptWith`,
// `benchmarkSheet`), so `tests/benchmark_test.ts` reads it on plain Node; a
// stored blob is checked field by field on the way in, the way
// `mergeSettings` checks a settings blob, and anything that is not a run is
// dropped rather than drawn as a line that vanishes.

import type { BenchSample } from "./benchmark-index.ts";
import {
  GPU_NAME_CAP,
  noGpu,
  noMachine,
  noTotals,
  GPU_SLICES,
  type BenchmarkRun,
  type GpuTotals,
  type FramePhases,
  type Machine,
  type ReportRow,
  type RunTotals,
  type SceneShare,
} from "./benchmark-report.ts";

/** Runs kept, newest first. Twenty is several evenings of A-against-B and a
 * few hundred kilobytes at most — well inside any storage quota. */
export const RUNS_KEPT = 20;

/** A finished run as it is kept: the report's whole input, when, and the
 * score it came to. */
export type BenchmarkRecord = BenchmarkRun & {
  /** Epoch ms the run finished. */
  at: number;
  index: number;
};

const num = (value: unknown, min = Number.NEGATIVE_INFINITY): number =>
  typeof value === "number" && Number.isFinite(value) && value >= min ? value : 0;
const count = (value: unknown): number => Math.round(num(value, 0));
const text = (value: unknown, cap = 200): string =>
  typeof value === "string" ? value.slice(0, cap) : "";
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const obj = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

function rows(value: unknown): ReportRow[] {
  return list(value)
    .map(obj)
    .filter((r) => typeof r.label === "string" && typeof r.value === "string")
    .map((r) => ({ label: r.label as string, value: r.value as string }));
}

function totals(value: unknown): RunTotals {
  const t = obj(value);
  const out = noTotals();
  if (count(t.frames) <= 0) return out;
  for (const key of Object.keys(out) as (keyof RunTotals)[]) out[key] = num(t[key], 0);
  out.frames = count(t.frames);
  return out;
}

function gpu(value: unknown): GpuTotals {
  const g = obj(value);
  const out = noGpu();
  if (count(g.frames) <= 0) return out;
  out.frames = count(g.frames);
  out.dropped = count(g.dropped);
  const ms = obj(g.ms);
  for (const { slice } of GPU_SLICES) {
    if (typeof ms[slice] === "number") out.ms[slice] = num(ms[slice], 0);
  }
  for (const [tag, t] of Object.entries(obj(g.tags))) {
    const row = obj(t);
    if (count(row.frames) > 0)
      out.tags[text(tag, 60)] = { frames: count(row.frames), ms: num(row.ms, 0) };
  }
  return out;
}

function machine(value: unknown): Machine {
  const m = obj(value);
  return {
    ...noMachine(),
    cores: count(m.cores),
    clockMs: num(m.clockMs, 0),
    gpu: text(m.gpu, GPU_NAME_CAP),
  };
}

const COST_KEYS = [
  "poseMs",
  "trailMs",
  "worldMs",
  "submitMs",
  "frameMs",
  "calls",
  "triangles",
  "programs",
  "geometries",
  "textures",
  "simMs",
  "gpuMs",
  "wallMs",
] as const satisfies readonly (keyof FramePhases)[];

function cost(value: unknown): FramePhases {
  const c = obj(value);
  const out = {} as FramePhases;
  for (const key of COST_KEYS) out[key] = num(c[key], 0);
  return out;
}

function sample(value: unknown): BenchSample {
  const s = obj(value);
  return { frame: count(s.frame), index: num(s.index, 0), fps: num(s.fps, 0) };
}

function share(value: unknown): SceneShare | null {
  const s = obj(value);
  return typeof s.name === "string"
    ? { name: s.name, objects: count(s.objects), triangles: count(s.triangles) }
    : null;
}

/** One stored row made into a run this build can report, or null. A run
 * needs a time it finished; everything else defaults to an honest zero. */
export function recordOf(value: unknown): BenchmarkRecord | null {
  const r = obj(value);
  if (num(r.at, 1) <= 0) return null;
  return {
    at: num(r.at, 1),
    index: num(r.index, 0),
    map: text(r.map),
    skis: count(r.skis),
    width: count(r.width),
    height: count(r.height),
    pixelRatio: num(r.pixelRatio, 0),
    picture: rows(r.picture),
    plan: rows(r.plan),
    samples: list(r.samples).map(sample),
    costs: list(r.costs).map(cost),
    scene: list(r.scene)
      .map(share)
      .filter((s): s is SceneShare => s !== null),
    totals: totals(r.totals),
    gpu: gpu(r.gpu),
    hidden: list(r.hidden)
      .map((h) => text(h, 20))
      .filter((h) => h !== ""),
    machine: machine(r.machine),
    step: num(r.step, 0),
    frames: count(r.frames),
  };
}

/** The history with `run` added: newest first, `RUNS_KEPT` at most. */
export function keptWith(
  runs: readonly BenchmarkRecord[],
  run?: BenchmarkRecord,
): BenchmarkRecord[] {
  const all = run ? [run, ...runs] : [...runs];
  return all.sort((a, b) => b.at - a.at).slice(0, RUNS_KEPT);
}

/** A stored blob — anything at all — made into the history. */
export function mergeBenchmarks(parsed: unknown): BenchmarkRecord[] {
  const runs: BenchmarkRecord[] = [];
  for (const row of list(parsed)) {
    const kept = recordOf(row);
    if (kept) runs.push(kept);
  }
  return keptWith(runs);
}

/** A picture as a code short enough to sit on a line — the first letter of
 * each row's value, in the menu's order (`hmmm…`), so two lines that differ
 * in one row differ in one letter. */
export function pictureCode(picture: readonly ReportRow[]): string {
  return picture.map((r) => r.value.charAt(0)).join("");
}

/** THE SHEET — every kept run as one line, for BENCHMARK ▸ HISTORY's copy
 * button: when, the score, the rate, the buffer and the picture's code,
 * with the code's key under it. */
export function benchmarkSheet(runs: readonly BenchmarkRecord[]): string {
  if (runs.length === 0) return "No benchmark runs kept on this machine.";
  const out = ["BENCHMARK HISTORY — newest first"];
  for (const r of runs) {
    const when = new Date(r.at).toISOString().slice(0, 16).replace("T", " ");
    const fps = r.step > 0 ? Math.round(r.index / (100 * r.step)) : 0;
    out.push(
      `  ${when}  index ${String(Math.round(r.index)).padStart(4)}  ${String(fps).padStart(4)} fps  ` +
        `${r.width}×${r.height}  ${pictureCode(r.picture)}`,
    );
  }
  const key = runs[0].picture.map((r) => r.label).join(" · ");
  if (key !== "") out.push(`  picture code: ${key}`);
  return out.join("\n");
}

/* ── STORAGE ──────────────────────────────────────────────────────────── */

const KEY = "fall-line.benchmarks.v1";

export function benchmarkRuns(): BenchmarkRecord[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? mergeBenchmarks(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

/** Keep a finished run. A full quota drops the OLDEST until it fits: the
 * run just finished is the one about to be compared against. */
export function rememberBenchmark(run: BenchmarkRecord): BenchmarkRecord[] {
  const kept = keptWith(benchmarkRuns(), run);
  for (let keep = kept.length; keep >= 1; keep--) {
    try {
      localStorage.setItem(KEY, JSON.stringify(kept.slice(0, keep)));
      return kept.slice(0, keep);
    } catch {
      // Over the quota: try with one fewer.
    }
  }
  return kept;
}

export function clearBenchmarks(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: there was nothing to clear.
  }
}
