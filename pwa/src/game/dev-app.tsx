// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEVELOPER PAGE'S HALF OF THE APP — the instruments (`dev-tools.ts`), the
// benchmark (`bench-run.ts`) and what both put on screen, wired to `App.tsx`
// through one hook and one attach call so the app's own file carries a few
// lines of it rather than a screenful.
//
// The hook holds the two pieces of render state — the benchmark's status (a
// non-null status IS the `bench` surface's card) and the overlay's snapshot
// — and `attach` is called once from the app's mount effect with the
// closures a benchmark and the instruments need. What it hands back is the
// rig the frame loop drives: `frame` after the steps, `tick` on the HUD's
// tick, and the two benchmark presses.

import { useRef, useState } from "preact/hooks";
import type { GameMode, GameState } from "@engine";

import type { LoadPlan } from "./app-load.ts";
import { createBenchRun } from "./bench-run.ts";
import type { GpuMode, Hideable } from "./benchmark-report.ts";
import type { BenchmarkStatus } from "./benchmark.ts";
import { DebugOverlay } from "./debug-hud.tsx";
import type { DebugSnapshot } from "./debug-readout.ts";
import { createDevTools } from "./dev-tools.ts";
import { BenchmarkCard } from "./menu-bench.tsx";
import type { DevRenderer, WorldRenderer } from "./renderer-api.ts";
import type { Settings } from "./settings.ts";
import type { VideoSettings } from "./settings-video.ts";
import { hudOver, type Shell } from "./shell.ts";

export type DevAppWorld = {
  renderer: WorldRenderer & DevRenderer;
  canvas: HTMLCanvasElement;
  settings: () => Settings;
  current: () => GameState;
  mode: () => GameMode;
  setMode: (mode: GameMode) => void;
  /** Put a load up (`createLoader`). */
  begin: (plan: LoadPlan) => void;
  shell: () => Shell;
  setShell: (shell: Shell) => void;
  /** Hush the beds while the benchmark has the canvas. */
  silence: () => void;
  /** Back onto the developer page, over the front door. */
  toDevPage: () => void;
  video: () => VideoSettings;
  /** `?bench=1`: run the benchmark the moment the app is up. */
  benchNow: boolean;
  /** The benchmark's GPU timer and A/B hide, off the URL. */
  benchGpu: GpuMode;
  benchHide: readonly Hideable[];
  benchAb: boolean;
  benchFrames: number | null;
  benchVista: boolean;
};

export type DevRig = {
  /** Once a frame, after the steps. */
  frame: (frameMs: number, dt: number, simMs: number) => void;
  /** On the HUD's tick: the overlay's snapshot refreshed. */
  tick: () => void;
  startBench: () => void;
  leaveBench: () => void;
  repro: () => string;
  dispose: () => void;
};

export type DevApp = {
  bench: BenchmarkStatus | null;
  debug: DebugSnapshot | null;
  rig: { current: DevRig | null };
  attach: (world: DevAppWorld) => DevRig;
};

export function useDevApp(): DevApp {
  const [bench, setBench] = useState<BenchmarkStatus | null>(null);
  const [debug, setDebug] = useState<DebugSnapshot | null>(null);
  const rig = useRef<DevRig | null>(null);
  const attach = (world: DevAppWorld): DevRig => {
    const tools = createDevTools({
      renderer: world.renderer,
      canvas: world.canvas,
      settings: world.settings,
      current: world.current,
      mode: world.mode,
      flies: () => hudOver(world.shell()),
    });
    const benchRun = createBenchRun({
      renderer: world.renderer,
      current: world.current,
      begin: world.begin,
      setMode: world.setMode,
      lift: () => world.setShell("bench"),
      silence: world.silence,
      setStatus: setBench,
      video: world.video,
      gpu: world.benchGpu,
      hide: world.benchHide,
      ab: world.benchAb,
      frames: world.benchFrames,
      vista: world.benchVista,
    });
    /** From the press to the way out — the load under the card included. */
    let benching = false;
    const made: DevRig = {
      // Dark for the whole benchmark, load and warm-up included: an
      // instrument switched back on mid-run would be timed with it.
      frame: (frameMs, dt, simMs) => {
        if (!benching) tools.frame(frameMs, dt, simMs);
      },
      tick: () => {
        // A load given up on (the loading card's way back) ends it too.
        if (benching && world.shell() === "menu") benching = false;
        setDebug(benching ? null : tools.snapshot());
      },
      startBench: () => {
        benching = true;
        benchRun.start();
      },
      leaveBench: () => {
        benching = false;
        benchRun.stop();
        world.setShell("menu");
        world.toDevPage();
      },
      repro: tools.repro,
      dispose: () => {
        benchRun.stop();
        tools.dispose();
      },
    };
    rig.current = made;
    if (world.benchNow) made.startBench();
    return made;
  };
  return { bench, debug, rig, attach };
}

/** What the developer half draws over everything: the overlay, and the card
 * over a benchmark. */
export function DevLayer({
  dev,
  shell,
  video,
}: {
  dev: DevApp;
  shell: Shell;
  video: VideoSettings;
}) {
  return (
    <>
      {dev.debug && shell !== "bench" && <DebugOverlay snap={dev.debug} />}
      {shell === "bench" && dev.bench && (
        <BenchmarkCard
          status={dev.bench}
          video={video}
          onAgain={() => dev.rig.current?.startBench()}
          onLeave={() => dev.rig.current?.leaveBench()}
        />
      )}
    </>
  );
}
