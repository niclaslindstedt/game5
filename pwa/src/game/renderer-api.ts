// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The seam between the app shell and the three.js world: everything App.tsx
// may ask of the renderer, and nothing else. The shell owns WHEN a frame is
// drawn and WHICH state it shows; the renderer owns how it looks, and never
// writes a `GameState`.
import type * as THREE from "three";

import type { GameState, SkyOverride } from "@engine";

import type { FrameCost, GpuMode, GpuTotals, Hideable, SceneShare } from "./benchmark-report.ts";
import type { LensPose } from "./camera-rigs.ts";
import type { PickRay } from "./machine-pick.ts";
import type { PlumeBit } from "./spray-film.ts";
import type { Outfit } from "./outfit.ts";
import type { ReplayView } from "./camera-replay.ts";
import type { VideoSettings } from "./settings-video.ts";
import type { XrayLook } from "./xray-shots.ts";
import type { UnderPoint } from "./snow-under.ts";
import type { SnowKind, SnowpackOptions } from "./snowpack.ts";

/** The camera ladder, nearest first. */
export type CameraRung = "tips" | "helmet" | "chase" | "far" | "high" | "orbit";

export interface WorldRenderer {
  /** Build (or rebuild, for a new level) everything that depends on the map.
   * Heavy: the loading card calls it behind a frame so the card can paint. */
  load(state: GameState, cold?: boolean): Promise<void>;
  /** Compile a world built `cold` — `load` with `cold` builds everything but
   * leaves its shaders for here, so the free ride's cards can stand the
   * world up while they are up and the loading card pays only for this. A
   * world not built cold (or another map) is loaded whole. */
  finish(state: GameState): Promise<void>;
  /** Throw the world away, and any load of one in flight. */
  clear(): void;
  /** Draw one frame of `state`. `alpha` is the accumulator's leftover share of
   * a step (0..1) for interpolation; `dt` is wall seconds since the last frame. */
  draw(state: GameState, alpha: number, dt: number): void;
  /** Which camera a RUN is seen through; menus use "orbit". `cut` skips
   * the flown hand-over; `chosen` says the player picked it (a ski jump's
   * broadcast director gives way to his pick until the run begins again);
   * `craft` the rung kept for a machine he rides, if not `rung` too. */
  setCamera(rung: CameraRung, cut?: boolean, chosen?: boolean, craft?: CameraRung): void;
  /** The rung he is seen on now — the machine's while he rides one. */
  camera(): CameraRung;
  /** Whether he rides a machine, so the lens is on its rung (`camera.ts`'s
   * `aboard`). */
  riding(): boolean;
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
   * CSS px over the picture, taken while the lift carries the player — and
   * a MOUSE's (`mouse`) on any run, while its button is held (`holdLook`). */
  lookAround(dx: number, dy: number, mouse?: boolean): void;
  holdLook(on: boolean): void;
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
  /** THE EXIT CUT's pace (`camera-exit.ts`): the run slowed for the leap out
   * of a craft, 1 the run's own — the app multiplies it into its rate. */
  exitPace(): number;
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
  /** The snow in the air the last frame drew — the spray's grains and the
   * cloud's puffs (`plume-probe.ts`) — for the snow eval lab's film score. */
  plumes(): PlumeBit[];
  /** How far under the snow drawn round him the player's skis stand, at
   * each ski's tip, middle and tail, from the lens (`snow-under.ts`) — a
   * second draw of the ground, so never from a frame being timed. */
  skisUnder(): UnderPoint[];
  /** Kilograms of thrown snow the deformable snow has dug this run — the
   * spray's own, one budget (`snow-takes.ts`); 0 with none. */
  snowDug(): number;
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
  lensPose(): { x: number; y: number; z: number; yaw: number; pitch: number; fov: number };
}

export type RendererOptions = {
  /** The picture to open on (`settings-video.ts`); `setVideo` moves it. Its
   * ANTIALIAS row is read here and only here — a canvas's multisampling is
   * fixed when its context is made. */
  video?: VideoSettings;
  /** Keep the last frame in the canvas after it is shown (a lab that reads
   * the pixels back). */
  preserveDrawingBuffer?: boolean;
};

/** What the renderer can say about its own last frame. */
export type FrameInfo = { calls: number; triangles: number; points: number };

/** The seam, plus what a lab, the developer page and the benchmark may also
 * ask. */
export type WorldRendererExt = WorldRenderer &
  DevRenderer & {
    /** Change rung; `cut` skips the flown hand-over; `chosen` whether the
     * player picked it (a ski jump's broadcast gives way to his pick). */
    setCamera(rung: CameraRung, cut?: boolean, chosen?: boolean, craft?: CameraRung): void;
    /** `present` false does everything a frame does — the trails stamped,
     * the spray flown, the lens moved — except draw the picture: how a lab
     * fast-forwards a run without losing the furrows it cut. */
    draw(state: GameState, alpha: number, dt: number, present?: boolean): void;
    info(): FrameInfo;
    /** Ride the map under another sky, or from another hour, without loading
     * it again (`withSky`) — a lab's sheet; null hands it back to the map's. */
    setSky(sky: SkyOverride | null): void;
    /** Resolves once the mountain's shadow under the sky last drawn is. */
    shadeSettled(): Promise<void>;
    /** Lay ONE kind of snow (and one surface age) over the whole map for the
     * picture (`snowpack.ts`, `snow-age.ts`), or null for the map's own. */
    setSnow(kind: SnowKind | null, age?: SnowpackOptions["age"]): void;
    /** The three.js renderer, for a lab that needs to read pixels. */
    readonly gl: THREE.WebGLRenderer;
  };
