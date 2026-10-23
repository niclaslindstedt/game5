// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DEVELOPER PAGE: out of the way of a player who never found it (hold
// the front door's title for seven seconds — `DEV_HOLD_MS`), and blunt for
// one who did. It is what makes performance work on a real phone possible:
// the phone has no console, and every figure a fix needs is on this page or
// behind it.
//
// THE ROWS ARE INSTRUMENTS, never a change to the game: the frame rate, the
// frame's cost, the physics' readouts, the trail maps, the engine's debug
// lines and the free camera (`dev-tools.ts` drives each one). They are the
// KNOBS OPTIONS is built from (`menu-knobs.tsx`), because a row picked here
// and a row picked there have to be the same kind of row. The one row that
// is not an instrument is RENDERER, the way back to the old WebGL renderer
// for a device whose picture draws wrong on WebGPU (`gpu-backend.ts`).
//
// THE PRESSES UNDER THEM each leave the page: BENCHMARK takes the canvas and
// times a pinned race on it (`bench-run.ts`), its HISTORY is every run this
// machine has scored (`menu-bench.tsx`), and COPY REPRO LINK puts the race on screen on the
// clipboard as a URL the app reads back (`debug-readout.ts`). LOCK is the
// way back out — for somebody who opened the door by accident.

import { useState } from "preact/hooks";
import { RACE } from "@engine";

import { copyText } from "../lib/copy-text.ts";
import type { BenchKind } from "./bench-run.ts";
import { benchmarkRuns } from "./benchmark-history.ts";
import { BENCHMARK, benchmarkSeconds } from "./benchmark-plan.ts";
import { useReceipt } from "./copy-receipt.ts";
import type { BenchSceneId } from "./bench-scenes.ts";
import { BenchCostsPage, BenchHistoryPage } from "./menu-bench.tsx";
import {
  Caption,
  KnobGroup,
  MenuBody,
  MenuHead,
  ON_OFF,
  StepRow,
  onOff,
  type Hint,
} from "./menu-knobs.tsx";
import { DEV_SWITCHES, freshSettings, type DevSettings, type Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";
import type { DevPage } from "./url-params.ts";

const RENDERER_STOPS = (["auto", "webgpu-gl", "webgl"] as const).map((id) => ({
  id,
  label: STRINGS.devRendererStops[id],
}));

function DeveloperPage({
  settings,
  repro,
  onSettings,
  onBack,
  onPage,
  onBenchmark,
}: {
  settings: Settings;
  repro: () => string;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
  onPage: (page: DevPage) => void;
  onBenchmark: (kind: BenchKind) => void;
}) {
  const [hint, setHint] = useState<Hint | null>(null);
  const [said, say] = useReceipt();
  const dev = settings.dev;
  return (
    <div class="menu-card menu-card-options" onPointerLeave={() => setHint(null)}>
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.devTitle} />
      <MenuBody>
        <KnobGroup title={STRINGS.devInstruments} glyph="gauge">
          {DEV_SWITCHES.map((key: keyof DevSettings) => (
            <StepRow
              key={key}
              label={STRINGS.devRow[key]}
              hint={STRINGS.devRowHint[key]}
              stops={ON_OFF}
              value={onOff(dev[key])}
              onPick={(id) => onSettings({ ...settings, dev: { ...dev, [key]: id === "on" } })}
              onHint={setHint}
            />
          ))}
          {/* THE WAY BACK for a picture that draws wrong (`gpu-backend.ts`):
            read as the game opens, so it takes hold on the next visit. */}
          <StepRow
            label={STRINGS.devRenderer}
            hint={STRINGS.devRendererHint(globalThis.__SH_BACKEND__ ?? "…")}
            stops={RENDERER_STOPS}
            value={settings.renderer}
            extra={STRINGS.devRendererWebgpu}
            onPick={(id) => onSettings({ ...settings, renderer: id })}
            onHint={setHint}
          />
        </KnobGroup>
        {/* THE STOPWATCH, under the rows rather than among them: not a setting
          but a press that takes the canvas for half a minute. */}
        <button type="button" class="menu-item menu-item-dev" onClick={() => onBenchmark("score")}>
          {STRINGS.benchTitle}
          <span class="menu-item-sub">
            {STRINGS.benchRowHint(benchmarkSeconds(), BENCHMARK.seed, RACE.rivals + 1)}
          </span>
        </button>
        {/* The same race with each part of the picture left out a frame in
          turn: what a part costs on a machine with no GPU timer. */}
        <button type="button" class="menu-item menu-item-dev" onClick={() => onBenchmark("parts")}>
          {STRINGS.benchPartsTitle}
          <span class="menu-item-sub">{STRINGS.benchPartsHint}</span>
        </button>
        {/* Every PICTURE row's stops dealt at random for a few minutes and
          priced off the lot (`picture-sweep.ts`): the report's JSON is what
          PRESET ▸ AUTO's price list is re-set from. */}
        <button type="button" class="menu-item menu-item-dev" onClick={() => onPage("benchCosts")}>
          {STRINGS.benchCostsTitle}
          <span class="menu-item-sub">{STRINGS.benchCostsHint}</span>
        </button>
        <button
          type="button"
          class="menu-item menu-item-dev"
          onClick={() => onPage("benchHistory")}
        >
          {STRINGS.benchHistoryTitle}
          <span class="menu-item-sub">{STRINGS.benchHistoryRowHint(benchmarkRuns().length)}</span>
        </button>
        <button
          type="button"
          class="opt-reset"
          onClick={() => say(copyText(`${location.origin}${location.pathname}${repro()}`))}
        >
          {said ?? STRINGS.devRepro}
        </button>
        {/* The way back out, last and quiet: a page of tools must not put its
          own trapdoor where a thumb reaching for a row lands. */}
        <button
          type="button"
          class="opt-reset opt-reset-quiet"
          onClick={() => {
            onSettings({ ...settings, developer: false, dev: freshSettings().dev });
            onBack();
          }}
        >
          {STRINGS.devLock}
        </button>
      </MenuBody>
      <Caption hint={hint} fallback={STRINGS.devCaption} />
    </div>
  );
}

/** Whichever developer page is up. */
export function DevPages({
  page,
  settings,
  repro,
  onSettings,
  onPage,
  onBack,
  onBenchmark,
}: {
  page: DevPage;
  settings: Settings;
  repro: () => string;
  onSettings: (settings: Settings) => void;
  onPage: (page: DevPage) => void;
  /** Out to the front door. */
  onBack: () => void;
  onBenchmark: (kind: BenchKind, scenes?: readonly BenchSceneId[]) => void;
}) {
  if (page === "benchCosts") {
    return (
      <BenchCostsPage
        onBack={() => onPage("dev")}
        onRun={(scenes) => onBenchmark("costs", scenes)}
      />
    );
  }
  if (page === "benchHistory") {
    return <BenchHistoryPage onBack={() => onPage("dev")} onRun={() => onBenchmark("score")} />;
  }
  return (
    <DeveloperPage
      settings={settings}
      repro={repro}
      onSettings={onSettings}
      onBack={onBack}
      onPage={onPage}
      onBenchmark={onBenchmark}
    />
  );
}
