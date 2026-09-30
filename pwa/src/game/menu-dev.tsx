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
// and a row picked there have to be the same kind of row.
//
// THE PRESSES UNDER THEM each leave the page: BENCHMARK takes the canvas and
// times a pinned race on it (`bench-run.ts`), its HISTORY is every run this
// machine has scored (`menu-bench.tsx`), UNLOCKS sets the campaign's board
// (`menu-unlocks.tsx`), and COPY REPRO LINK puts the race on screen on the
// clipboard as a URL the app reads back (`debug-readout.ts`). LOCK is the
// way back out — for somebody who opened the door by accident.

import { useState } from "preact/hooks";
import { RACE } from "@engine";

import { copyText } from "../lib/copy-text.ts";
import { benchmarkRuns } from "./benchmark-history.ts";
import { BENCHMARK, benchmarkSeconds } from "./benchmark-plan.ts";
import { campaignStanding, type CampaignProgress } from "./campaign.ts";
import { useReceipt } from "./copy-receipt.ts";
import { BenchHistoryPage } from "./menu-bench.tsx";
import { Caption, KnobGroup, MenuHead, ON_OFF, StepRow, onOff, type Hint } from "./menu-knobs.tsx";
import { UnlocksPage } from "./menu-unlocks.tsx";
import { DEV_SWITCHES, freshSettings, type DevSettings, type Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";
import type { DevPage } from "./url-params.ts";

function DeveloperPage({
  settings,
  progress,
  repro,
  onSettings,
  onBack,
  onPage,
  onBenchmark,
}: {
  settings: Settings;
  progress: CampaignProgress;
  repro: () => string;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
  onPage: (page: DevPage) => void;
  onBenchmark: () => void;
}) {
  const [hint, setHint] = useState<Hint | null>(null);
  const [said, say] = useReceipt();
  const dev = settings.dev;
  const standing = campaignStanding(progress);
  return (
    <div class="menu-card menu-card-options" onPointerLeave={() => setHint(null)}>
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.devTitle} />
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
      </KnobGroup>
      <Caption hint={hint} fallback={STRINGS.devCaption} />
      {/* THE STOPWATCH, under the rows rather than among them: not a setting
          but a press that takes the canvas for half a minute. */}
      <button type="button" class="menu-item menu-item-dev" onClick={onBenchmark}>
        {STRINGS.benchTitle}
        <span class="menu-item-sub">
          {STRINGS.benchRowHint(benchmarkSeconds(), BENCHMARK.seed, RACE.rivals + 1)}
        </span>
      </button>
      <button type="button" class="menu-item menu-item-dev" onClick={() => onPage("benchHistory")}>
        {STRINGS.benchHistoryTitle}
        <span class="menu-item-sub">{STRINGS.benchHistoryRowHint(benchmarkRuns().length)}</span>
      </button>
      <button type="button" class="menu-item menu-item-dev" onClick={() => onPage("unlocks")}>
        {STRINGS.unlocksTitle}
        <span class="menu-item-sub">{STRINGS.unlocksRowHint(standing.cleared, standing.of)}</span>
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
    </div>
  );
}

/** Whichever developer page is up. */
export function DevPages({
  page,
  settings,
  progress,
  repro,
  onSettings,
  onProgress,
  onPage,
  onBack,
  onBenchmark,
}: {
  page: DevPage;
  settings: Settings;
  progress: CampaignProgress;
  repro: () => string;
  onSettings: (settings: Settings) => void;
  onProgress: (progress: CampaignProgress) => void;
  onPage: (page: DevPage) => void;
  /** Out to the front door. */
  onBack: () => void;
  onBenchmark: () => void;
}) {
  if (page === "unlocks") {
    return <UnlocksPage progress={progress} onProgress={onProgress} onBack={() => onPage("dev")} />;
  }
  if (page === "benchHistory") {
    return <BenchHistoryPage onBack={() => onPage("dev")} onRun={onBenchmark} />;
  }
  return (
    <DeveloperPage
      settings={settings}
      progress={progress}
      repro={repro}
      onSettings={onSettings}
      onBack={onBack}
      onPage={onPage}
      onBenchmark={onBenchmark}
    />
  );
}
