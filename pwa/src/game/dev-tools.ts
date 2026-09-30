// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEVELOPER'S INSTRUMENTS, as the app drives them — the switches on the
// developer page (`Settings.dev`) turned into what they do every frame:
//
//   FPS and FRAME COST  the smoothed rate (`frame-rate.ts`) and the renderer's
//                       own bill for the last frame beside the engine's steps.
//   PHYSICS             every probe's load, sink and travel, the packed share
//                       (`debug-readout.ts`'s `physicsOf`).
//   TRAIL MAP           the two maps the snow reads, over the corner of the
//                       picture (`trail-overlay.ts`).
//   ENGINE LOG          the engine's `debug` lines switched on
//                       (`setDebugEnabled`) and its last lines on screen.
//   FREE CAMERA         the lens off the ladder and flown by hand
//                       (`free-fly.ts`), over a run, a held run or a replay.
//
// A FACTORY OVER `App.tsx`'s closures, the `app-load.ts` shape: the renderer,
// the canvas and the settings are the app's, built once on mount. Every
// instrument is dark unless the developer page has been let out, so a
// player who never held the title never pays for any of it.

import { setDebugEnabled, type GameMode, type GameState } from "@engine";

import { recentOutput } from "../output-bridge.ts";
import { physicsOf, reproOf, reproQuery, type DebugSnapshot } from "./debug-readout.ts";
import {
  FLY_CODES,
  NO_KEYS,
  flyLens,
  flyLook,
  flyStep,
  type FlyKeys,
  type FlyState,
} from "./free-fly.ts";
import { smoothFps } from "./frame-rate.ts";
import type { DevRenderer, WorldRenderer } from "./renderer-api.ts";
import type { Settings } from "./settings.ts";

/** Lines of the engine's output the overlay keeps on screen. */
const LOG_LINES = 8;

export type DevWorld = {
  renderer: WorldRenderer & DevRenderer;
  canvas: HTMLCanvasElement;
  settings: () => Settings;
  current: () => GameState;
  mode: () => GameMode;
  /** Whether the lens may be flown here — a run, a held run, a replay. */
  flies: () => boolean;
};

export type DevTools = {
  /** Once a frame, after the steps: the frame's ms, its seconds, and what
   * the engine's steps cost. */
  frame: (frameMs: number, dt: number, simMs: number) => void;
  /** What the overlay draws, or null when nothing is switched on. */
  snapshot: () => DebugSnapshot | null;
  /** The REPRO query for the run on screen. */
  repro: () => string;
  dispose: () => void;
};

export function createDevTools(world: DevWorld): DevTools {
  const { renderer, canvas } = world;
  let fps = 0;
  let frameMs = 0;
  let simMs = 0;
  let fly: FlyState | null = null;
  const keys: FlyKeys = { ...NO_KEYS };
  let dragging: { x: number; y: number } | null = null;
  let logging: boolean | null = null;
  const dev = (): Settings["dev"] | null =>
    world.settings().developer ? world.settings().dev : null;

  const onKey = (down: boolean) => (e: KeyboardEvent) => {
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") keys.fast = down;
    for (const [dir, code] of Object.entries(FLY_CODES) as [keyof typeof FLY_CODES, string][]) {
      if (e.code === code) keys[dir] = down;
    }
  };
  const keyDown = onKey(true);
  const keyUp = onKey(false);
  const pointerDown = (e: PointerEvent): void => {
    if (fly && e.target === canvas) dragging = { x: e.clientX, y: e.clientY };
  };
  const pointerMove = (e: PointerEvent): void => {
    if (!fly || !dragging) return;
    flyLook(fly, e.clientX - dragging.x, e.clientY - dragging.y);
    dragging = { x: e.clientX, y: e.clientY };
  };
  const pointerUp = (): void => {
    dragging = null;
  };
  window.addEventListener("keydown", keyDown);
  window.addEventListener("keyup", keyUp);
  window.addEventListener("pointerdown", pointerDown);
  window.addEventListener("pointermove", pointerMove);
  window.addEventListener("pointerup", pointerUp);

  const repro = (): string => reproQuery(reproOf(world.current(), world.mode(), renderer.camera()));

  return {
    frame: (ms, dt, sim) => {
      fps = smoothFps(fps, ms);
      frameMs = ms;
      simMs = sim;
      const on = dev();
      renderer.setTrailOverlay(on?.trails ?? false);
      const log = on?.log ?? false;
      if (log !== logging) {
        logging = log;
        setDebugEnabled(log || import.meta.env.DEV);
      }
      const flying = (on?.freefly ?? false) && world.flies();
      if (flying) {
        fly ??= renderer.lensPose();
        flyStep(fly, keys, Math.min(dt, 0.1));
        renderer.setOverride(flyLens(fly));
      } else if (fly) {
        fly = null;
        renderer.setOverride(null);
      }
    },
    snapshot: () => {
      const on = dev();
      if (!on || !(on.fps || on.cost || on.physics || on.log || on.freefly || on.trails)) {
        return null;
      }
      const state = world.current();
      return {
        fps: on.fps ? fps : null,
        frameMs,
        cost: on.cost ? { ...renderer.cost(), simMs } : null,
        physics: on.physics ? physicsOf(state) : null,
        log: on.log
          ? recentOutput()
              .slice(-LOG_LINES)
              .map((e) => `${(e.at / 1000).toFixed(1)} ${e.level} ${e.message}`)
          : null,
        freefly: fly !== null,
        repro: repro(),
      };
    },
    repro,
    dispose: () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointermove", pointerMove);
      window.removeEventListener("pointerup", pointerUp);
    },
  };
}
