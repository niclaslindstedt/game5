// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The seam between the app shell and the three.js world: everything App.tsx
// may ask of the renderer, and nothing else. The shell owns WHEN a frame is
// drawn and WHICH state it shows; the renderer owns how it looks, and never
// writes a `GameState`.
import type { GameState } from "@engine";

import type { FrameCost, GpuMode, GpuTotals, Hideable, SceneShare } from "./benchmark-report.ts";
import type { LensPose } from "./camera-rigs.ts";
import type { PickRay } from "./machine-pick.ts";
import type { Outfit } from "./outfit.ts";
import type { ReplayView } from "./camera-replay.ts";
import type { VideoSettings } from "./settings-video.ts";
import type { XrayLook } from "./xray-shots.ts";

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
  /** The ray through a point of the picture, normalized device coordinates
   * (−1..1 right and up) — what a tap on a machine is tested along
   * (`machine-pick.ts`). */
  pickRay(x: number, y: number): PickRay;
  /** The canvas's box in CSS px and the device's pixel ratio; the RESOLUTION
   * row's share is the renderer's to apply on top. */
  resize(width: number, height: number, pixelRatio: number): void;
  /** The picture (OPTIONS ▸ PICTURE), applied at once — all but ANTIALIAS,
   * which a canvas takes only when it is made. */
  setVideo(video: VideoSettings): void;
  /** THE GHOST (`ghost-run.ts`): another run on the same map, drawn
   * see-through and leaving no trail — or null for none. */
  setGhost(ghost: GameState | null): void;
  /** The player's outfit (`Settings.outfit`): the skier in slot 0 wears
   * it, rebuilt when it changes; the field wears its slots' own. */
  dress(outfit: Outfit): void;
  /** THE REPLAY'S LENSES (`camera-replay.ts`): the angle a recording is
   * watched on and the moment the broadcast is cut to — or null for the
   * camera ladder. Only a replay ever sets one (`replay-run.ts`). */
  setReplayCam(view: ReplayView | null): void;
  /** LOOKING ROUND FROM THE LIFT (`lift-gaze.ts`): a drag of `dx`, `dy`
   * CSS px over the picture, taken while the lift carries the player. */
  lookAround(dx: number, dy: number): void;
  /** THE DEATH CAM (`camera-death.ts`): whether it may take the lens when
   * the player is thrown — only while the player rides, never under a card
   * or over a replay. */
  setDeathCam(on: boolean): void;
  /** Every body left lying gone — the run left for the menu. (A run stood
   * up after a death on the same map leaves the dead one lying on its own,
   * `gore-view.ts`'s `leave`.) */
  clearBodies(): void;
  /** THE X-RAY CAM (`xray-shots.ts`): this frame's look — the skeleton drawn
   * inside him and the lens on the bone breaking — or null when it is off. */
  setXray(look: XrayLook | null): void;
  /** THE PACE the next frames are drawn at, game seconds a wall second (1
   * the run's own; under it slow motion — the replay's, the X-ray's, the
   * shred cam's): the `dt` a frame is drawn on is the run's, and what is
   * shot on the wall's clock (the hurt body's lens, the eye on a rotor)
   * reads it back off this. */
  setPace(pace: number): void;
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
