// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The seam between the app shell and the three.js world: everything App.tsx
// may ask of the renderer, and nothing else. The shell owns WHEN a frame is
// drawn and WHICH state it shows; the renderer owns how it looks, and never
// writes a `GameState`.
import type { GameState, SkiId } from "@engine";

import type { FrameCost, GpuMode, GpuTotals, Hideable, SceneShare } from "./benchmark-report.ts";
import type { LensPose } from "./camera-rigs.ts";
import type { ReplayShot } from "./replay-shots.ts";
import type { VideoSettings } from "./settings-video.ts";

/** The camera ladder, nearest first. */
export type CameraRung = "tips" | "helmet" | "chase" | "far" | "high" | "orbit";

export interface WorldRenderer {
  /** Build (or rebuild, for a new level) everything that depends on the map.
   * Heavy: the loading card calls it behind a frame so the card can paint. */
  load(state: GameState): Promise<void>;
  /** Draw one frame of `state`. `alpha` is the accumulator's leftover share of
   * a step (0..1) for interpolation; `dt` is wall seconds since the last frame. */
  draw(state: GameState, alpha: number, dt: number): void;
  /** Which camera a RUN is seen through; menus use "orbit". */
  setCamera(rung: CameraRung): void;
  camera(): CameraRung;
  /** The canvas's box in CSS px and the device's pixel ratio; the RESOLUTION
   * row's share is the renderer's to apply on top. */
  resize(width: number, height: number, pixelRatio: number): void;
  /** The picture (OPTIONS ▸ PICTURE), applied at once — all but ANTIALIAS,
   * which a canvas takes only when it is made. */
  setVideo(video: VideoSettings): void;
  /** THE GHOST (`ghost-run.ts`): another run on the same map, drawn
   * see-through and leaving no trail — or null for none. */
  setGhost(ghost: GameState | null): void;
  /** The player's topsheets (`Settings.topsheets`): the pair in slot 0 is
   * dressed in the one its id picks, rebuilt when that changes; the field
   * keeps its start-line slots' colours. */
  dress(topsheets: Partial<Record<SkiId, number>>): void;
  /** THE BROADCAST (`camera-tv.ts`): the moment a replay is cut to, framed
   * from a lens planted beside it — or null for the camera ladder. Only a
   * replay ever sets one (`replay-run.ts`). */
  setShot(shot: ReplayShot | null): void;
  /** THE DEATH CAM (`camera-death.ts`): whether it may take the lens when
   * the player is thrown — only while the player rides, never under a card
   * or over a replay. */
  setDeathCam(on: boolean): void;
  /** The time rate the death cam asks the run to be stepped at, 0..1 — 1
   * whenever it is idle or not let in. What it returns is what the next
   * `draw`'s `dt` is taken to have been slowed by. */
  timeRate(): number;
  /** Wait for the GPU to finish everything asked of it, and say how long
   * that took, ms — what the first-visit probe times a frame with. */
  drain(): number;
  dispose(): void;
}

/** What the DEVELOPER page and the BENCHMARK may also ask — instruments, not
 * the game's own drawing (`menu-dev.tsx`, `benchmark.ts`). */
export interface DevRenderer {
  /** What the last frame cost, off the renderer's own counters — one object
   * rewritten every frame; a reading copies it. */
  cost(): FrameCost;
  /** The scene walked and bucketed by subsystem (`scene-tally.ts`) — a walk
   * of the whole graph, so never from a frame being timed. */
  sceneTally(): SceneShare[];
  /** The drawing buffer, device pixels. */
  bufferSize(): { w: number; h: number };
  /** THE GPU'S TIMER (`gpu-timer.ts`): cut every frame from here on at
   * `mode`, OFF to stop; it starts from nothing each time it is set. */
  setGpuTimer(mode: GpuMode): void;
  /** Every whole frame timed since the timer was set or `resetGpu`. */
  gpuTotals(): GpuTotals;
  resetGpu(): void;
  /** Draw WITHOUT these subsystems — an A/B reading — or [] for all; the
   * GPU timer files the frames under `tag` ("" the picture as reported). */
  setHidden(names: readonly Hideable[], tag?: string): void;
  /** Draw the trail maps over the corner of the picture, or stop. */
  setTrailOverlay(on: boolean): void;
  /** Stand the lens at a fixed place instead of the ladder — the FREE
   * CAMERA's, or a lab's view; null hands it back. */
  setOverride(view: LensPose | null): void;
  /** Where the lens stands and which way it looks, so the free camera takes
   * off from the frame on screen. */
  lensPose(): { x: number; y: number; z: number; yaw: number; pitch: number };
}
