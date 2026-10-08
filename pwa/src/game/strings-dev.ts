// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE DEVELOPER PAGE — the page, its overlay and the benchmark
// — a block of the one strings table (`strings.ts`, §39.1),
// stated next door and spread into `STRINGS` under the same names, the
// `strings-gallery.ts` pattern.

import type { DevSettings } from "./settings.ts";

export const DEV_STRINGS = {
  devTitle: "DEVELOPER",
  devInstruments: "INSTRUMENTS",
  /** The page's rows, by switch. */
  devRow: {
    fps: "FRAME RATE",
    cost: "FRAME COST",
    physics: "PHYSICS",
    trails: "TRAIL MAP",
    log: "ENGINE LOG",
    freefly: "FREE CAMERA",
  } satisfies Record<keyof DevSettings, string>,
  devRowHint: {
    fps: "The frames a second arriving, smoothed, in the corner of the picture.",
    cost: "What the last frame cost: the engine's steps, the draw cut into its stretches, the draw calls and triangles.",
    physics:
      "Every probe's load, sink and travel, and the share of the skier's weight on packed snow.",
    trails:
      "The two maps the snow reads its furrows off, drawn over the corner: depth warm, berm blue.",
    log: "The engine's debug lines switched on, and its last few on screen.",
    freefly:
      "The camera off the skier: I K fly, J L slide, U O sink and climb, shift is faster, drag to look.",
  } satisfies Record<keyof DevSettings, string>,
  devCaption: "Instruments over the picture. None of them changes the game.",
  devRepro: "COPY REPRO LINK",
  devReproLabel: "REPRO",
  devLock: "LOCK THE DEVELOPER PAGE",
  devCopied: "COPIED",
  devCopyFailed: "COULD NOT COPY",
  devFps: (fps: number, ms: string): string => `${fps} FPS · ${ms} MS`,
  devCostLine: (calls: number, triangles: number): string =>
    `${calls} draws · ${Math.round(triangles / 1000)}k triangles`,
  devAir: "AIR",
  devProbe: "probe",
  devLogEmpty: "(the engine has said nothing yet)",
  devFlyKeys: "FREE CAMERA · I K J L U O · SHIFT faster · drag to look",

  /* ── THE BENCHMARK (menu-bench.tsx) ───────────────────────────────── */
  benchTitle: "BENCHMARK",
  benchRowHint: (seconds: number, seed: number, skiers: number): string =>
    `${Math.round(seconds)} s of seed ${seed}, ${skiers} skiers, drawn as fast as this machine can`,
  benchMap: (seed: number): string => `SEED ${seed} · THE WOODS AND A KICKER`,
  benchIndexUnit: (fps: number, w: number, h: number): string => `INDEX · ${fps} FPS · ${w}×${h}`,
  benchAxis: (top: number, topFps: number): string => `0–${top} index · 0–${topFps} fps`,
  benchProgress: (frames: number, of: number): string =>
    `${Math.round((frames / Math.max(1, of)) * 100)}%`,
  benchDone: (seconds: number): string => `DONE IN ${seconds.toFixed(1)} S`,
  benchCopy: "COPY DEBUG REPORT",
  benchAgain: "RUN AGAIN",
  benchLeave: "BACK",
  benchStop: "STOP",
  benchHistoryTitle: "BENCHMARK HISTORY",
  benchHistoryRowHint: (runs: number): string =>
    runs === 0 ? "no runs kept yet" : `${runs} run${runs === 1 ? "" : "s"} kept on this machine`,
  benchHistoryLine: (runs: number): string =>
    runs === 0
      ? "No runs kept yet. A finished benchmark is kept here, newest first."
      : "Newest first. Press a run to copy its whole report.",
  benchHistoryCopyOne: "Copy this run's report",
  benchHistoryCopy: "COPY THE SHEET",
  benchHistoryClear: "FORGET EVERY RUN",
  /** The loading card's last phase before a benchmark: the lights. */
  loadLights: "Counting the lights",
};
