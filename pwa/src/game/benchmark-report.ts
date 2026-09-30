// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BENCHMARK'S REPORT — a run written down, in text somebody can paste.
//
// The card shows a score and two lines, which is what a skier needs to know
// whether their machine is coping. This is for whoever is going to make the
// game faster, who needs to know WHAT THE FRAME WAS DOING: "it is slow" and
// "it is submitting four hundred draw calls, three hundred of them woods" are
// different bug reports. So the report carries, in the order it is read:
//
//   THE CONDITIONS — the map, the field, the buffer, and every row of
//   OPTIONS ▸ PICTURE. Without them two runs cannot be compared, and
//   comparing two runs is the whole use of the tool.
//
//   WHERE THE FRAME WENT — the frame cut into its phases and meaned over the
//   whole run: the engine stepping four whole runs, the renderer's slices,
//   the fence on the GPU, and the gap between frames.
//
//   WHAT A FRAME DRAWS, and WHAT WAS STANDING THERE — the counters, and the
//   scene on the last frame by subsystem (`scene-tally.ts`): where to look.
//
//   THE RUN — every reading: the score so far, the rate of that frame and
//   what it cost, which is where a thermal sag is told from a heavier scene.
//
// EVERY TIME IN THE BREAKDOWN IS A RUN TOTAL divided by its frames. Browsers
// clamp `performance.now()` — a millisecond in some — so one frame's 0.3 ms
// pass reads as 0 or 1 and never as itself; summed over eighteen hundred
// frames the rounding averages out. A COUNTER is exact on the frame it was
// read, so the middle reading is its right summary.
//
// `FrameCost` IS STATED HERE rather than in `renderer.ts`: this module and the
// history are DOM-free and the root suite reads them, and a type imported
// from the renderer would drag three.js into a suite on plain Node.

import { fpsOfIndex, type BenchSample } from "./benchmark-index.ts";
import type { VideoSettings } from "./settings-video.ts";

/** What one frame cost the RENDERER, off its own counters. The `Ms` slices
 * are the frame's stretches in the order it does them; `frameMs` is the
 * whole of `draw`. */
export type FrameCost = {
  /** Every skier sampled and posed, the trail stamps gathered, the spray
   * emitted and the lens flown, ms. */
  poseMs: number;
  /** The stamps rasterised into the trail maps the snow reads, ms. */
  trailMs: number;
  /** The world brought up to the lens: the ground's clipmap re-centred, the
   * sky's look and the lights, the woods culled, the checkpoints, the lamps,
   * the spray and the falling snow flown, ms. */
  worldMs: number;
  /** `gl.render` — SUBMISSION, not drawing: the card is still working when
   * it returns, which is what the fence (`gpuMs`) is for. */
  submitMs: number;
  /** The whole of `draw`, ms of processor time. */
  frameMs: number;
  /** Draw calls and triangles in the frame, the shadow pass's included. */
  calls: number;
  triangles: number;
  /** Compiled programs, and the geometries and textures resident — what the
   * map is HOLDING, which is what a memory problem looks like. */
  programs: number;
  geometries: number;
  textures: number;
};

/** A renderer that has drawn nothing yet. */
export function noCost(): FrameCost {
  return {
    poseMs: 0,
    trailMs: 0,
    worldMs: 0,
    submitMs: 0,
    frameMs: 0,
    calls: 0,
    triangles: 0,
    programs: 0,
    geometries: 0,
    textures: 0,
  };
}

/** WHAT THE LOOP AROUND THE RENDERER SPENT on the same frame — a separate
 * type because it has a separate author (`benchmark.ts`'s pump). */
export type FrameTiming = {
  /** The ENGINE's steps, ms: `step()` over the player and every rival, each
   * ridden by the bot. No draw call in it, and no row of OPTIONS moves it. */
  simMs: number;
  /** The fence, ms: one pixel read back out of the buffer, which cannot be
   * answered until every draw behind it has landed (`renderer.drain`). The
   * only look at the GPU a browser reliably gives — and an OVERSTATEMENT of
   * what the game pays, since a frame with no fence overlaps its card's work
   * with the next frame's. */
  gpuMs: number;
  /** THE FRAME'S WHOLE PERIOD, ms: from the end of the frame before to the
   * end of this one, so a run's periods tile its elapsed time exactly and
   * their mean is the rate the machine scored. */
  wallMs: number;
};

/** One reading's whole account. */
export type FramePhases = FrameCost & FrameTiming;

/** EVERY FRAME'S PHASES SUMMED over the run, ms; divide by `frames`. */
export type RunTotals = {
  frames: number;
  sim: number;
  render: number;
  pose: number;
  trail: number;
  world: number;
  submit: number;
  gpu: number;
  /** The gap BETWEEN frames: the pump's hop, the compositor, the card
   * redrawn on a reading. */
  between: number;
  wall: number;
};

export function noTotals(): RunTotals {
  return {
    frames: 0,
    sim: 0,
    render: 0,
    pose: 0,
    trail: 0,
    world: 0,
    submit: 0,
    gpu: 0,
    between: 0,
    wall: 0,
  };
}

/** A slice of the GPU's frame (`gpu-timer.ts`): a render pass, or under
 * SPLIT one subsystem's draw calls inside the scene's pass. */
export type GpuSlice =
  | "trail"
  | "hero"
  | "shadow"
  | "scene"
  | "sky"
  | "terrain"
  | "forest"
  | "field"
  | "checkpoints"
  | "cloud"
  | "spray"
  | "snowfall"
  | "wildlife"
  | "grade"
  | "overlay";

/** Every slice in the order a frame draws them, and what each is. */
export const GPU_SLICES: readonly { slice: GpuSlice; what: string }[] = [
  { slice: "trail", what: "the stamps and the new snow into the trail maps" },
  { slice: "hero", what: "the skiers' own shadow maps (SHADOWS HIGH)" },
  { slice: "shadow", what: "the sun's shadow map: the casters drawn from the key light" },
  { slice: "scene", what: "the picture's own pass (under SPLIT, what no subsystem claimed)" },
  { slice: "sky", what: "the dome: the sky, its cloud, the stars" },
  { slice: "terrain", what: "the ground: the snow shader over the clipmap" },
  { slice: "forest", what: "the woods, both bands" },
  { slice: "field", what: "the skis and their skiers, the ghost" },
  { slice: "checkpoints", what: "the poles, the flags, the arch" },
  { slice: "cloud", what: "the snow cloud off every skis" },
  { slice: "spray", what: "the roost, the ski spray, the puffs" },
  { slice: "snowfall", what: "the falling snow and the spindrift" },
  { slice: "wildlife", what: "the birds and the animals" },
  { slice: "grade", what: "the region's grade over the whole frame" },
  { slice: "overlay", what: "the developer page's trail-map corner" },
];

/** WHAT THE GPU SPENT, summed over every WHOLE frame its timer answered
 * for (`gpu-timer.ts`), ms per slice; divide by `frames`. */
export type GpuTotals = {
  /** Frames whose every query was answered. */
  frames: number;
  /** Frames thrown away: the driver's clock jumped, or it never answered. */
  dropped: number;
  ms: Partial<Record<GpuSlice, number>>;
  /** THE INTERLEAVED A/B (`?ab=1`): the card's whole frame, summed by what
   * the frame was drawn without ("" the whole picture). */
  tags: Record<string, { frames: number; ms: number }>;
};

/** How much the GPU's timer cuts a frame into (`gpu-timer.ts`): OFF, each
 * render PASS, or the scene's pass SPLIT by subsystem as well. */
export type GpuMode = "off" | "passes" | "split";
export const GPU_MODES: readonly GpuMode[] = ["off", "passes", "split"];

/** What an A/B run may be drawn WITHOUT (`?hide=`): a subsystem's objects,
 * or a pass the frame skips (its map left as it stood). */
export type Hideable =
  | "sky"
  | "terrain"
  | "forest"
  | "field"
  | "checkpoints"
  | "cloud"
  | "spray"
  | "snowfall"
  | "wildlife"
  | "shadow"
  | "hero"
  | "trail";
export const HIDEABLE: readonly Hideable[] = [
  "sky",
  "terrain",
  "forest",
  "field",
  "checkpoints",
  "cloud",
  "spray",
  "snowfall",
  "wildlife",
  "shadow",
  "hero",
  "trail",
];

export function noGpu(): GpuTotals {
  return { frames: 0, dropped: 0, ms: {}, tags: {} };
}

/** WHAT THE MACHINE IS, as much as a browser will say. */
export type Machine = {
  /** Logical cores, or 0 where the browser withholds it. */
  cores: number;
  /** The finest step `performance.now()` resolves here, ms — the error bar
   * on every single-frame time in the report. */
  clockMs: number;
  /** What the driver calls itself, or "" where the browser withholds it. */
  gpu: string;
};

/** How much of a driver name is kept, characters: the part that names the
 * hardware is at the END of an ANGLE string, so it is not cut short. */
export const GPU_NAME_CAP = 128;

export function noMachine(): Machine {
  return { cores: 0, clockMs: 0, gpu: "" };
}

/** One subsystem's share of the scene. */
export type SceneShare = {
  /** The named group it hangs under — `terrain`, `forest`, `field`… */
  name: string;
  /** Objects that would be drawn. */
  objects: number;
  triangles: number;
};

/** One row of what a run was ridden under, as label and value. */
export type ReportRow = { label: string; value: string };

/** OPTIONS ▸ PICTURE as report rows, in the settings' own order. */
export function pictureRows(video: VideoSettings): ReportRow[] {
  return Object.entries(video).map(([label, value]) => ({
    label,
    value: typeof value === "boolean" ? (value ? "on" : "off") : String(value),
  }));
}

/** A run, ready to paste. */
export type BenchmarkRun = {
  /** The map as the card words it. */
  map: string;
  /** Skis on the snow, the player's included. */
  skis: number;
  width: number;
  height: number;
  pixelRatio: number;
  /** OPTIONS ▸ PICTURE as it stood — the rows the run did NOT pin. */
  picture: ReportRow[];
  /** The rows it DID pin (`plannedRows`). */
  plan: ReportRow[];
  samples: readonly BenchSample[];
  costs: readonly FramePhases[];
  scene: readonly SceneShare[];
  totals: RunTotals;
  /** The GPU's own timer, where the context has one (`gpu-timer.ts`). */
  gpu: GpuTotals;
  /** The subsystems the run was drawn WITHOUT (`?hide=`): an A/B reading,
   * never a score to compare with a whole picture's. */
  hidden: readonly string[];
  machine: Machine;
  /** Seconds of game each frame advanced, and the run's length in frames. */
  step: number;
  frames: number;
};

/** Thousands separated by a thin space, read at a glance. */
export function big(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

/** The middle reading: one stalled frame is one reading, not a skewed mean. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const half = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
}

/** A right-aligned column. */
export function pad(text: string, width: number): string {
  return text.length >= width ? text : " ".repeat(width - text.length) + text;
}

const PHASE_NAME = 10;

/** One phase as a line: its mean, its share of the wall, and what it is. */
function phase(name: string, total: number, totals: RunTotals, what: string): string {
  const mean = total / totals.frames;
  const share = (total / totals.wall) * 100;
  return (
    `  ${name.padEnd(PHASE_NAME)} ${pad(Math.max(0, mean).toFixed(2), 6)} ms ` +
    `${pad(`${Math.round(Math.max(0, share))}%`, 4)}   ${what}`
  );
}

/** WHERE THE FRAME WENT. `rest` and `unbilled` are DERIVED rather than timed,
 * and clamped at zero: a residue of the clock's rounding is never printed as
 * a negative stretch of frame. */
function whereTheFrameWent(totals: RunTotals, step: number): string[] {
  if (totals.frames <= 0 || totals.wall <= 0) return [];
  const rest = Math.max(
    0,
    totals.render - totals.pose - totals.trail - totals.world - totals.submit,
  );
  const unbilled = Math.max(
    0,
    totals.wall - totals.sim - totals.render - totals.gpu - totals.between,
  );
  const mean = totals.wall / totals.frames;
  return [
    "",
    `WHERE THE FRAME WENT, MEANED OVER ${totals.frames} FRAMES`,
    phase("sim", totals.sim, totals, "the whole field stepped at 120 Hz — no draw calls in it"),
    phase("render", totals.render, totals, "the processor's half of the draw, split below"),
    phase("  pose", totals.pose, totals, "the skiers posed, the stamps, the spray, the lens"),
    phase("  trail", totals.trail, totals, "the stamps rasterised into the trail maps"),
    phase(
      "  world",
      totals.world,
      totals,
      "the ground, the sky, the woods, the lamps, the snowfall",
    ),
    phase("  submit", totals.submit, totals, "gl.render — the picture handed to the card"),
    phase("  rest", rest, totals, "what the four above did not account for"),
    phase("gpu", totals.gpu, totals, "the fence — a ceiling on the card, and the tool's own tax"),
    phase("between", totals.between, totals, "the pump's hop, the compositor, the card redrawn"),
    phase("unbilled", unbilled, totals, "a collection mid-frame, and the clock's rounding"),
    `  ${"─".repeat(PHASE_NAME + 10)}`,
    `  ${"wall".padEnd(PHASE_NAME)} ${pad(mean.toFixed(2), 6)} ms         ` +
      `the frame, end to end — ${Math.round(1000 / mean)} fps, ` +
      `index ${Math.round(step * 1000 * (100 / mean))}`,
  ];
}

const SLICE_NAME = 12;

/** WHERE THE GPU WENT: each slice's mean, its share of the card's frame,
 * and what it is. The shares are of the TIMED sum — the card's own frame,
 * never the wall. */
function whereTheGpuWent(gpu: GpuTotals): string[] {
  if (gpu.frames <= 0) return [];
  const sum = Object.values(gpu.ms).reduce((a, b) => a + (b ?? 0), 0);
  const out = [
    "",
    `WHERE THE GPU WENT, TIMER QUERIES OVER ${gpu.frames} FRAMES` +
      (gpu.dropped > 0 ? ` (${gpu.dropped} dropped)` : ""),
  ];
  for (const { slice, what } of GPU_SLICES) {
    const ms = gpu.ms[slice];
    if (ms === undefined) continue;
    const mean = ms / gpu.frames;
    const share = sum > 0 ? (ms / sum) * 100 : 0;
    out.push(
      `  ${slice.padEnd(SLICE_NAME)} ${pad(mean.toFixed(3), 7)} ms ` +
        `${pad(`${Math.round(share)}%`, 4)}   ${what}`,
    );
  }
  out.push(`  ${"─".repeat(SLICE_NAME + 11)}`);
  out.push(
    `  ${"card".padEnd(SLICE_NAME)} ${pad((sum / gpu.frames).toFixed(3), 7)} ms` +
      "         every slice summed",
  );
  const whole = gpu.tags[""];
  const others = Object.entries(gpu.tags).filter(([tag]) => tag !== "");
  if (whole && whole.frames > 0 && others.length > 0) {
    const base = whole.ms / whole.frames;
    out.push("");
    out.push("A/B, INTERLEAVED FRAME BY FRAME — the card's frame drawn WITHOUT each");
    out.push(`  ${"without".padEnd(SLICE_NAME)} ${pad("card", 7)}    ${pad("Δ", 7)}  frames`);
    out.push(
      `  ${"(nothing)".padEnd(SLICE_NAME)} ${pad(base.toFixed(3), 7)} ms ${pad("", 7)}  ${whole.frames}`,
    );
    for (const [tag, t] of others) {
      if (t.frames <= 0) continue;
      const mean = t.ms / t.frames;
      out.push(
        `  ${tag.padEnd(SLICE_NAME)} ${pad(mean.toFixed(3), 7)} ms ` +
          `${pad((mean - base).toFixed(3), 7)}  ${t.frames}`,
      );
    }
  }
  return out;
}

/** THE REPORT — the text COPY DEBUG REPORT puts on the clipboard. */
export function benchmarkReport(run: BenchmarkRun): string {
  const { samples, costs, scene, totals, machine, step, frames } = run;
  const last = samples.length > 0 ? samples[samples.length - 1] : null;
  const index = last?.index ?? 0;
  const out: string[] = [];
  out.push(
    `BENCHMARK — ${run.map} · ${run.skis} skis · ` +
      `${run.width}×${run.height} @ ${run.pixelRatio}x`,
  );
  out.push(
    `INDEX ${Math.round(index)} · ${Math.round(fpsOfIndex(index, step))} fps average · ` +
      `${samples.length} readings over ${frames} frames`,
  );
  const bits = [
    machine.cores > 0 ? `${machine.cores} cores` : "",
    machine.clockMs > 0 ? `${machine.clockMs.toFixed(2)} ms clock` : "",
    machine.gpu,
  ].filter((bit) => bit !== "");
  if (bits.length > 0) out.push(`MACHINE ${bits.join(" · ")}`);
  out.push("");
  out.push(`PICTURE ${run.picture.map((r) => `${r.label} ${r.value}`).join(" · ")}`);
  out.push(`PINNED  ${run.plan.map((r) => `${r.label} ${r.value}`).join(" · ")}`);
  if (run.hidden.length > 0) out.push(`HIDDEN  ${run.hidden.join(" · ")} — an A/B reading`);
  out.push(...whereTheFrameWent(totals, step));
  out.push(...whereTheGpuWent(run.gpu));

  if (costs.length > 0) {
    const held = costs[costs.length - 1];
    out.push("");
    out.push("PER FRAME, MEDIAN OVER THE READINGS");
    out.push(`  draw calls   ${big(median(costs.map((c) => c.calls)))}`);
    out.push(`  triangles    ${big(median(costs.map((c) => c.triangles)))}`);
    out.push(`  programs     ${big(held.programs)}`);
    out.push(`  geometries   ${big(held.geometries)}`);
    out.push(`  textures     ${big(held.textures)}`);
  }

  if (scene.length > 0) {
    out.push("");
    out.push("WHAT WAS STANDING THERE, LAST FRAME");
    out.push(`  ${pad("objects", 9)} ${pad("triangles", 12)}  where`);
    for (const share of [...scene].sort((a, b) => b.triangles - a.triangles)) {
      out.push(`  ${pad(big(share.objects), 9)} ${pad(big(share.triangles), 12)}  ${share.name}`);
    }
  }

  out.push("");
  out.push("THE RUN, READING BY READING");
  out.push(
    `  ${pad("at", 5)} ${pad("frame", 6)} ${pad("index", 6)} ${pad("fps", 5)} ` +
      `${pad("draws", 6)} ${pad("triangles", 11)} ${pad("sim", 6)} ${pad("render", 6)} ` +
      `${pad("gpu", 6)} ${pad("wall", 6)}`,
  );
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const c = costs[i];
    const at = frames > 0 ? `${Math.round((s.frame / frames) * 100)}%` : "";
    const ms = (v: number | undefined): string => (v === undefined ? "" : v.toFixed(1));
    out.push(
      `  ${pad(at, 5)} ${pad(String(s.frame), 6)} ${pad(String(Math.round(s.index)), 6)} ` +
        `${pad(String(Math.round(s.fps)), 5)} ${pad(c ? big(c.calls) : "", 6)} ` +
        `${pad(c ? big(c.triangles) : "", 11)} ${pad(ms(c?.simMs), 6)} ` +
        `${pad(ms(c?.frameMs), 6)} ${pad(ms(c?.gpuMs), 6)} ${pad(ms(c?.wallMs), 6)}`,
    );
  }
  return out.join("\n");
}
