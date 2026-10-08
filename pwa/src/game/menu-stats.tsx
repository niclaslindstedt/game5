// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STATISTICS CARD — the life of a skier on this device, reached from the
// front door's STATISTICS tile. The numbers are `stats.ts`'s; every word is
// `strings-stats.ts`'s; the layout is here.
//
// READ TOP DOWN, BIGGEST FIRST. Four headline tiles say the whole of it in
// four numbers — how many runs, how long on the snow, how far, how much
// mountain come down — each with one line that puts it in proportion. Under
// them the PERSONAL BESTS, each named with the run that set it; then the
// counted things in small groups (racing, the air, the hard knocks, the
// machines and the lodge), each a grid of figures; then two bar lists (time
// by mode, distance by skis) and the last runs, newest first. A group with
// nothing in it is left out rather than shown as a wall of zeroes.
//
// THE BARS ARE ONE COLOUR AND LABELLED: each bar's name and value are
// written beside it, so nothing is read off a colour or a length alone.
//
// CLEARING THE BOOK takes two presses, the way the gallery's delete does: a
// number lost is a number nobody can ski back.

import type { ComponentChildren } from "preact";
import { useState } from "preact/hooks";

import { skisById, type DeathCause, type GameMode, type SkiId } from "@engine";

import { MenuBody, MenuHead } from "./menu-knobs.tsx";
import {
  averageSpeed,
  seedsByRecent,
  trickOf,
  tricksByCount,
  causesByCount,
  modesByTime,
  skisByDistance,
  type Best,
  type StatsBook,
} from "./stats.ts";
import { STRINGS, comboLine } from "./strings.ts";

const skiName = (id: SkiId): string => {
  try {
    return skisById(id).name;
  } catch {
    return id;
  }
};

export function StatsPage({
  book,
  onBack,
  onReset,
}: {
  book: StatsBook;
  onBack: () => void;
  onReset: () => void;
}) {
  const [arming, setArming] = useState(false);
  const s = book.sums;
  const empty = book.runs === 0;
  return (
    <div class="menu-card menu-card-stats">
      <MenuHead back={onBack} backLabel={STRINGS.menuBack} title={STRINGS.statsTitle} />
      <MenuBody class="stats-body">
        {empty ? (
          <div class="stats-empty">{STRINGS.statsEmpty}</div>
        ) : (
          <>
            <div class="menu-sub stats-sub">{STRINGS.statsSince(book.runs, book.since)}</div>
            <div class="stats-heroes">
              <Hero
                label={STRINGS.statsRuns}
                value={STRINGS.statsCount(book.runs)}
                line={STRINGS.statsRunsLine(book.finished)}
              />
              <Hero
                label={STRINGS.statsTime}
                value={STRINGS.statsTimeValue(s.time)}
                line={STRINGS.statsTimeLine(averageSpeed(book) * 3.6)}
              />
              <Hero
                label={STRINGS.statsDistance}
                value={STRINGS.statsDistanceValue(s.distance)}
                line={STRINGS.statsDistanceLine(s.distance)}
              />
              <Hero
                label={STRINGS.statsVertical}
                value={STRINGS.statsVerticalValue(s.vertical)}
                line={STRINGS.statsVerticalLine(s.vertical)}
              />
            </div>

            <Section title={STRINGS.statsBests}>
              <div class="stats-bests">
                <BestRow
                  label={STRINGS.statsTop}
                  best={book.bests.top}
                  value={STRINGS.statsTopValue}
                />
                <BestRow
                  label={STRINGS.statsLongest}
                  best={book.bests.longest}
                  value={STRINGS.statsLongestValue}
                />
                <BestRow
                  label={STRINGS.statsLanding}
                  best={book.bests.landing}
                  value={STRINGS.statsLandingValue}
                />
                <BestRow
                  label={STRINGS.statsCombo}
                  best={book.bests.combo}
                  value={STRINGS.statsComboValue}
                />
                <BestRow
                  label={STRINGS.statsScore}
                  best={book.bests.score}
                  value={STRINGS.statsScoreValue}
                />
                <BestRow
                  label={STRINGS.statsPeak}
                  best={book.bests.peak}
                  value={STRINGS.statsPeakValue}
                />
                <BestRow
                  label={STRINGS.statsMostBones}
                  best={book.bests.bones}
                  value={STRINGS.statsMostBonesValue}
                />
                <BestRow
                  label={STRINGS.statsIss}
                  best={book.bests.iss}
                  value={STRINGS.statsIssValue}
                />
              </div>
            </Section>

            <div class="stats-groups">
              <Figures
                title={STRINGS.statsRacing}
                rows={[
                  [STRINGS.statsWins, book.wins, STRINGS.statsCount(book.wins)],
                  [STRINGS.statsPodiums, book.podiums, STRINGS.statsCount(book.podiums)],
                  [STRINGS.statsGates, s.gates, STRINGS.statsCount(s.gates)],
                  [
                    STRINGS.statsAccuracy,
                    s.gates + s.missed,
                    STRINGS.statsAccuracyValue(s.gates, s.missed),
                  ],
                  [STRINGS.statsOuts, book.outs, STRINGS.statsCount(book.outs)],
                ]}
              />
              <Figures
                title={STRINGS.statsAir}
                rows={[
                  [STRINGS.statsAirTime, s.air, STRINGS.statsAirTimeValue(s.air)],
                  [STRINGS.statsJumps, s.jumps, STRINGS.statsCount(s.jumps)],
                  [STRINGS.statsPoints, s.points, STRINGS.statsCount(s.points)],
                ]}
              />
              <Figures
                title={STRINGS.statsKnocks}
                rows={[
                  [STRINGS.statsWipeouts, s.wipeouts, STRINGS.statsCount(s.wipeouts)],
                  [STRINGS.statsTrees, s.trees, STRINGS.statsCount(s.trees)],
                  [STRINGS.statsSaves, s.saves, STRINGS.statsCount(s.saves)],
                  [STRINGS.statsInjuries, s.injuries, STRINGS.statsCount(s.injuries)],
                  [STRINGS.statsBones, s.bones, STRINGS.statsCount(s.bones)],
                  [STRINGS.statsDeaths, s.deaths, STRINGS.statsCount(s.deaths)],
                ]}
              />
              <Figures
                sparse
                title={STRINGS.statsMountain}
                rows={[
                  [STRINGS.statsLifts, s.lifts, STRINGS.statsCount(s.lifts)],
                  [STRINGS.statsHeli, s.heli, STRINGS.statsMinutes(s.heli)],
                  [STRINGS.statsPara, s.para, STRINGS.statsMinutes(s.para)],
                  [STRINGS.statsSled, s.sled, STRINGS.statsReach(s.sled)],
                  [STRINGS.statsGroomer, s.groomer, STRINGS.statsMinutes(s.groomer)],
                  [STRINGS.statsBumps, s.bumps, STRINGS.statsCount(s.bumps)],
                  [STRINGS.statsBeers, s.beers, STRINGS.statsCount(s.beers)],
                  [STRINGS.statsMauled, s.mauled, STRINGS.statsCount(s.mauled)],
                ]}
              />
            </div>

            <div class="stats-groups">
              <Bars
                title={STRINGS.statsCauses}
                rows={causesByCount(book).map(([cause, n]) => ({
                  key: cause,
                  label: STRINGS.statsCause(cause),
                  value: n,
                  text: STRINGS.statsCount(n),
                }))}
              />
              <Bars
                title={STRINGS.statsKilled}
                rows={(Object.entries(book.killed) as [DeathCause, number][])
                  .sort((x, y) => y[1] - x[1])
                  .map(([cause, n]) => ({
                    key: cause,
                    label: STRINGS.statsDeath(cause),
                    value: n,
                    text: STRINGS.statsCount(n),
                  }))}
              />
              <Bars
                title={STRINGS.statsModes}
                rows={modesByTime(book).map(([mode, row]) => ({
                  key: mode,
                  label: STRINGS.statsMode(mode),
                  value: row.time,
                  text: STRINGS.statsMinutes(row.time),
                }))}
              />
              <Bars
                title={STRINGS.statsSkis}
                rows={skisByDistance(book).map(([id, row]) => ({
                  key: id,
                  label: skiName(id).toUpperCase(),
                  value: row.distance,
                  text: STRINGS.statsReach(row.distance),
                }))}
              />
            </div>

            <MapBook book={book} />

            <Section title={STRINGS.statsRecent}>
              <ol class="stats-recent">
                {book.recent.map((run) => (
                  <li key={run.at} class="stats-run">
                    <span class="stats-run-mode">{STRINGS.statsMode(run.mode)}</span>
                    <span class="stats-run-where">
                      {STRINGS.statsWhen(run.at)} · SEED {run.seed} ·{" "}
                      {skiName(run.skis).toUpperCase()}
                    </span>
                    <span class="stats-run-top">{STRINGS.statsTopValue(run.top)}</span>
                    <span class="stats-run-result">
                      {STRINGS.statsResult({
                        finished: run.finished,
                        out: run.out,
                        place: run.place,
                        time: run.time_,
                        distance: run.distance,
                        points: run.points,
                      })}
                    </span>
                  </li>
                ))}
              </ol>
            </Section>

            <div class="stats-foot">
              <button
                type="button"
                class={`gallery-btn gallery-btn-quiet${arming ? " gallery-btn-arm" : ""}`}
                onClick={() => {
                  if (!arming) {
                    setArming(true);
                    return;
                  }
                  setArming(false);
                  onReset();
                }}
                onBlur={() => setArming(false)}
              >
                {arming ? STRINGS.statsResetArm : STRINGS.statsReset}
              </button>
            </div>
          </>
        )}
      </MenuBody>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ComponentChildren }) {
  return (
    <section class="stats-section">
      <h3 class="stats-heading">{title}</h3>
      {children}
    </section>
  );
}

function Hero({ label, value, line }: { label: string; value: string; line: string }) {
  return (
    <div class="stats-hero">
      <span class="stats-hero-label">{label}</span>
      <span class="stats-hero-value">{value}</span>
      <span class="stats-hero-line">{line}</span>
    </div>
  );
}

function BestRow({
  label,
  best,
  value,
}: {
  label: string;
  best: Best | null;
  value: (v: number) => string;
}) {
  return (
    <div class="stats-best">
      <span class="stats-best-label">{label}</span>
      <span class="stats-best-value">{best ? value(best.value) : STRINGS.statsNone}</span>
      <span class="stats-best-where">
        {best ? STRINGS.statsWhere(best.mode, best.seed, skiName(best.skis)) : ""}
      </span>
    </div>
  );
}

/** A trick key as the judges call it: `backflip2` a DOUBLE BACKFLIP. */
const trickName = (key: string): string => {
  const t = trickOf(key);
  return t ? comboLine([{ kind: t.kind, spins: t.spins, flight: 1 }]) : key.toUpperCase();
};

/** THE TRICKS AND THE MAPS: a stepper picks ALL MAPS or one map, and under
 * it the tricks landed there — and, on ALL MAPS, a line per map; on one
 * map, its own bests and its best time in every mode it was raced in. The
 * stepper is the gallery's (`data-nav-steps`), so the keys walk it too. */
function MapBook({ book }: { book: StatsBook }) {
  const maps = seedsByRecent(book);
  const [at, setAt] = useState(0);
  if (maps.length === 0) return null;
  const pick = Math.min(at, maps.length);
  const map = pick === 0 ? null : maps[pick - 1];
  const step = (by: number): void => setAt((pick + by + maps.length + 1) % (maps.length + 1));
  const tricks = tricksByCount(map ? map.tricks : book.tricks);
  return (
    <Section title={STRINGS.statsMaps}>
      <div class="stats-picker" data-nav-steps>
        <button
          type="button"
          class="gallery-step"
          data-nav-step="left"
          aria-label={STRINGS.statsMapPrev}
          onClick={() => step(-1)}
        >
          ‹
        </button>
        <span class="stats-picker-value">
          {map ? STRINGS.statsSeed(map.seed) : STRINGS.statsAllMaps}
        </span>
        <button
          type="button"
          class="gallery-step"
          data-nav-step="right"
          aria-label={STRINGS.statsMapNext}
          onClick={() => step(1)}
        >
          ›
        </button>
      </div>
      <div class="stats-groups">
        {map ? (
          <dl class="stats-figures">
            <div class="stats-figure">
              <dt>{STRINGS.statsRuns}</dt>
              <dd>{STRINGS.statsCount(map.runs)}</dd>
            </div>
            <div class="stats-figure">
              <dt>{STRINGS.statsTop}</dt>
              <dd>{STRINGS.statsTopValue(map.top)}</dd>
            </div>
            <div class="stats-figure">
              <dt>{STRINGS.statsDistance}</dt>
              <dd>{STRINGS.statsReach(map.distance)}</dd>
            </div>
            {map.score > 0 && (
              <div class="stats-figure">
                <dt>{STRINGS.statsScore}</dt>
                <dd>{STRINGS.statsScoreValue(map.score)}</dd>
              </div>
            )}
            {(Object.entries(map.times) as [GameMode, number][]).map(([mode, time]) => (
              <div key={mode} class="stats-figure">
                <dt>{STRINGS.statsBestTime(mode)}</dt>
                <dd>{STRINGS.statsBestTimeValue(time)}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <ul class="stats-maps">
            {maps.map((row, n) => (
              <li key={row.seed}>
                <button type="button" class="stats-map" onClick={() => setAt(n + 1)}>
                  <span class="stats-map-seed">{STRINGS.statsSeed(row.seed)}</span>
                  <span class="stats-map-line">{STRINGS.statsMapRow(row.runs, row.top * 3.6)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {tricks.length === 0 ? (
          <div class="stats-quiet">{STRINGS.statsTricksNone}</div>
        ) : (
          <Bars
            title={STRINGS.statsTricks}
            rows={tricks.map(([key, n]) => ({
              key,
              label: trickName(key),
              value: n,
              text: STRINGS.statsCount(n),
            }))}
          />
        )}
      </div>
    </Section>
  );
}

/** A group of counted figures — left out whole when every one is nothing,
 * and, `sparse`, showing only the figures that are something. */
function Figures({
  title,
  rows: all,
  sparse,
}: {
  title: string;
  rows: [string, number, string][];
  sparse?: boolean;
}) {
  const rows = sparse ? all.filter(([, n]) => n > 0) : all;
  if (rows.every(([, n]) => n <= 0)) return null;
  return (
    <Section title={title}>
      <dl class="stats-figures">
        {rows.map(([label, , text]) => (
          <div key={label} class="stats-figure">
            <dt>{label}</dt>
            <dd>{text}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

/** A labelled bar list, longest first, the longest the full width. */
function Bars({
  title,
  rows,
}: {
  title: string;
  rows: { key: string; label: string; value: number; text: string }[];
}) {
  if (rows.length === 0) return null;
  const most = Math.max(...rows.map((r) => r.value), 1e-9);
  return (
    <Section title={title}>
      <ul class="stats-bars">
        {rows.map((r) => (
          <li key={r.key} class="stats-bar" title={`${r.label}: ${r.text}`}>
            <span class="stats-bar-label">{r.label}</span>
            <span class="stats-bar-value">{r.text}</span>
            <span class="stats-bar-track">
              <span
                class="stats-bar-fill"
                style={{ width: `${Math.max(2, (r.value / most) * 100)}%` }}
              />
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}
