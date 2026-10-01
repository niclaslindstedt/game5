// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BENCHMARK'S CARDS: the one over a run being timed, and the history of
// every run this machine has scored.
//
// THE CARD OVER THE RUN is small and to one side, because the race under it
// IS the measurement and a card that hid it would be asking to be trusted.
// It carries the score as it converges, the two lines (`benchmark-index.ts`:
// the run so far, and each reading's own frame), and — once the run is done
// — the presses that matter: COPY DEBUG REPORT (`benchmark-report.ts`, the
// text somebody optimising the game pastes into an issue), RUN AGAIN, and
// the way out. It is redrawn on a reading, never per frame
// (`SAMPLE_EVERY`), so it costs the run almost nothing.
//
// THE HISTORY is the comparison the tool exists for: every run newest first,
// each line a press that copies THAT run's full report, and the whole sheet
// as one copy (`benchmark-history.ts`).

import { useState } from "preact/hooks";

import { copyText } from "../lib/copy-text.ts";
import { benchmarkMap } from "./bench-run.ts";
import {
  benchmarkRuns,
  benchmarkSheet,
  clearBenchmarks,
  pictureCode,
} from "./benchmark-history.ts";
import { benchPlot } from "./benchmark-index.ts";
import { BENCHMARK } from "./benchmark-plan.ts";
import { benchmarkReport, pictureRows } from "./benchmark-report.ts";
import type { BenchmarkStatus } from "./benchmark.ts";
import { useReceipt } from "./copy-receipt.ts";
import { MenuBody, MenuHead } from "./menu-knobs.tsx";
import type { VideoSettings } from "./settings-video.ts";
import { STRINGS } from "./strings.ts";

/** A line through the unit box, in the SVG's 100 × 50 viewBox. */
function line(points: readonly { x: number; y: number }[]): string {
  return points.map((p) => `${(p.x * 100).toFixed(2)},${(p.y * 50).toFixed(2)}`).join(" ");
}

export function BenchmarkCard({
  status,
  video,
  onAgain,
  onLeave,
}: {
  status: BenchmarkStatus;
  /** OPTIONS ▸ PICTURE as the run was drawn under, for the report. */
  video: VideoSettings;
  onAgain: () => void;
  onLeave: () => void;
}) {
  const [said, say] = useReceipt();
  const plot = benchPlot(status.samples, status.planned, BENCHMARK.step);
  const done = status.phase === "done";
  const report = (): string =>
    benchmarkReport({
      map: benchmarkMap(),
      skis: status.skis,
      width: status.width,
      height: status.height,
      pixelRatio: devicePixelRatio,
      picture: pictureRows(video),
      plan: status.plan,
      samples: status.samples,
      costs: status.costs,
      scene: status.scene,
      totals: status.totals,
      gpu: status.gpu,
      hidden: status.hidden,
      machine: status.machine,
      step: BENCHMARK.step,
      frames: status.planned,
    });
  if (done) window.__SH_BENCH__ = report();
  return (
    <div class="bench-card" data-bench={status.phase}>
      <div class="bench-head">
        <span class="bench-title">{STRINGS.benchTitle}</span>
        <span class="bench-sub">{benchmarkMap()}</span>
      </div>
      <div class="bench-score">
        <span class="bench-index">{Math.round(plot.index)}</span>
        <span class="bench-unit">
          {STRINGS.benchIndexUnit(Math.round(plot.fps), status.width, status.height)}
        </span>
      </div>
      <svg class="bench-graph" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden="true">
        {plot.real !== null && (
          <line class="bench-real" x1="0" x2="100" y1={plot.real * 50} y2={plot.real * 50} />
        )}
        <polyline class="bench-rate" points={line(plot.rate)} />
        <polyline class="bench-line" points={line(plot.points)} />
      </svg>
      <div class="bench-axis">
        <span>{STRINGS.benchAxis(plot.top, Math.round(plot.topFps))}</span>
        <span>
          {done
            ? STRINGS.benchDone(status.seconds)
            : STRINGS.benchProgress(status.frames, status.planned)}
        </span>
      </div>
      {done && (
        <div class="bench-presses">
          <button
            type="button"
            class="menu-item menu-item-start"
            onClick={() => say(copyText(report()))}
          >
            {said ?? STRINGS.benchCopy}
          </button>
          <button type="button" class="menu-item" onClick={onAgain}>
            {STRINGS.benchAgain}
          </button>
        </div>
      )}
      <button type="button" class="menu-item menu-item-leave" data-nav-back onClick={onLeave}>
        {done ? STRINGS.benchLeave : STRINGS.benchStop}
      </button>
    </div>
  );
}

export function BenchHistoryPage({ onBack, onRun }: { onBack: () => void; onRun: () => void }) {
  const [runs, setRuns] = useState(benchmarkRuns);
  const [said, say] = useReceipt();
  return (
    <div class="menu-card menu-card-options">
      <MenuHead back={onBack} backLabel={STRINGS.devTitle} title={STRINGS.benchHistoryTitle} />
      <MenuBody>
        <div class="dev-line">{STRINGS.benchHistoryLine(runs.length)}</div>
        <div class="bench-runs">
          {runs.map((run) => (
            <button
              key={run.at}
              type="button"
              class="bench-run"
              title={STRINGS.benchHistoryCopyOne}
              onClick={() => say(copyText(benchmarkReport(run)))}
            >
              <b>{Math.round(run.index)}</b>
              <span>{new Date(run.at).toLocaleString()}</span>
              <span>
                {run.width}×{run.height} · {pictureCode(run.picture)}
              </span>
            </button>
          ))}
        </div>
        <button type="button" class="menu-item menu-item-dev" onClick={onRun}>
          {STRINGS.benchTitle}
        </button>
        {runs.length > 0 && (
          <button
            type="button"
            class="opt-reset"
            onClick={() => say(copyText(benchmarkSheet(runs)))}
          >
            {said ?? STRINGS.benchHistoryCopy}
          </button>
        )}
        {runs.length > 0 && (
          <button
            type="button"
            class="opt-reset opt-reset-quiet"
            onClick={() => {
              clearBenchmarks();
              setRuns([]);
            }}
          >
            {STRINGS.benchHistoryClear}
          </button>
        )}
      </MenuBody>
    </div>
  );
}

declare global {
  interface Window {
    /** THE LAST FINISHED BENCHMARK'S REPORT, for a lab driving the built
     * site (`?bench=1`) to read without a clipboard. Read-only. */
    __SH_BENCH__?: string;
  }
}
