// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SEED'S CHART — the map a number makes, drawn beside the rows that
// pick it, and the place a free ride starts, picked by pointing at it.
//
// TWO VIEWS OF ONE MAP, a chip on the plate between them. THE PANORAMA,
// first: the mountain painted from out over the valley the way a ski area's
// piste map hangs (`panorama.ts`), every run laid over it in its colour, the
// course this map is raced on cased in white, the lifts, the start and the
// finish. THE PLAN: the ground from above, the summit at the top, the piste
// and every kicker on it — the honest map to hunt a kicker on. Both hang
// summit-up, so a run falls DOWN the plate in either.
//
// A seed is an opaque integer, and a row that offers one without showing
// what it means is not a choice at all: it is a lottery with arrows on it.
// So the whole map goes on the card — the hills hillshaded, the woods, the
// groomed piste, the start line, and every kicker, on the piste and off it — cut
// from the REAL generated map by the same bake the minimap's ground is, so
// the picture and the snow are never two opinions about one seed.
//
// THE CHART IS ALSO A CONTROL. A press on it is where the ride starts
// (`seed-chart.ts`'s `fromChart` is the one mapping back to the snow, and
// the engine's `freeSpawn` holds the point out of the trees and inside the
// edge); until then it starts at the head of the run the RUN row picked,
// where the lift sets the skier down. Wherever it starts is marked with a
// beating pulse (`EntryMark`), the one mark on the plate that moves.
//
// THE WORK IS THE WORKER'S (`seed-preview-worker.ts`), and which map it
// builds when is `seed-maps.ts`'s — the next mountain built before it is
// asked for, the charts kept between visits. What is left here is the DOM,
// and the rules about how the picture behaves while the worker is busy,
// which are game3's:
//
//   - THE LAST PICTURE STAYS UP while the next is being drawn, dimmed. A
//     box that emptied on every press would strobe through a walk down the
//     seeds.
//   - A SEED IS ASKED FOR ONCE. Answers are kept, so walking back up the
//     seeds is instant.
//   - ONLY THE SEED ON SCREEN IS DRAWN, and a press is only sent once the
//     arrows have been still for a moment, so a held key does not queue a
//     backlog of maps nobody will look at.
//   - THE BOX IS ALREADY THE SIZE IT WILL BE when the first chart lands:
//     the plate is a square the CARD sizes, so nothing moves under a press
//     already aimed at a button.

import type { PisteGrade, RegionId } from "@engine";
import { useEffect, useState } from "preact/hooks";

import type { FreeRunInfo } from "./free-ride.ts";
import { GRADE_LOOK, gradePath } from "./grade-look.ts";
import {
  PANORAMA_VIEW,
  fromPanorama,
  spotInPanorama,
  toPanorama,
  type PanoramaSchematic,
} from "./panorama.ts";
import { CHART_VIEW, degrees, fromChart, toChart, type ChartHouse } from "./seed-chart.ts";
import { askKey, onSeedMaps, seedAnswer, wantSeed, type SeedAnswer } from "./seed-maps.ts";
import { GradeMark } from "./grade-mark.tsx";
import { STRINGS } from "./strings.ts";

export type { SeedAnswer } from "./seed-maps.ts";

/** How long the arrows have to be still before a map is built, ms. */
const SETTLE_MS = 220;

/** The chart as the card holds it: the last answer that arrived, and
 * whether it is the answer for the seed on screen. */
export type SeedChart = { shown: SeedAnswer | null; fresh: boolean };

export function useSeedPreview(
  seed: number,
  region: RegionId,
  grade: PisteGrade | null,
  face: string | null = null,
): SeedChart {
  const ask = { seed, region, face, grade };
  const key = askKey(ask);
  const [shown, setShown] = useState<SeedAnswer | null>(() => seedAnswer(ask));

  useEffect(() => {
    const show = (): void => {
      const answer = seedAnswer({ seed, region, face, grade });
      if (answer) setShown(answer);
    };
    show();
    const off = onSeedMaps(show);
    // A chart already kept is shown at once and its map asked for at once;
    // anything else once the arrows have been still for a moment.
    const timer = window.setTimeout(
      () => wantSeed({ seed, region, face, grade }),
      seedAnswer({ seed, region, face, grade }) ? 0 : SETTLE_MS,
    );
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, [seed, region, face, grade]);

  return { shown, fresh: shown !== null && askKey(shown) === key };
}

/** A kicker's mark: a chevron pointing the way it throws, at its lip. */
const KICKER_MARK = "M 0 -2.6 L 2 1.6 L 0 0.6 L -2 1.6 Z";

/** A house's mark: walls under a gable, drawn upright (a map's pictogram,
 * not a roof turned to its heading), centred on the house. */
const HOUSE_MARK = "M -1.5 1.5 L -1.5 -0.3 L 0 -1.7 L 1.5 -0.3 L 1.5 1.5 Z";

/** Every house on a view, the afterski lodges larger and in their own
 * colour (a ski area's piste map marks where the party is); on the
 * panorama each stands on its foot rather than over it. */
function HouseMarks({
  houses,
  scale,
  standing,
}: {
  houses: readonly ChartHouse[] | undefined;
  scale: number;
  standing: boolean;
}) {
  return (
    <>
      {(houses ?? []).map((h) => {
        const k = h.kind === "afterski" ? scale * 1.35 : scale;
        const lift = standing ? 1.5 * k : 0;
        return (
          <path
            key={h.id}
            class={`seed-preview-house${h.kind === "afterski" ? " seed-preview-house-lodge" : ""}`}
            d={HOUSE_MARK}
            transform={`translate(${h.x.toFixed(1)} ${(h.y - lift).toFixed(1)}) scale(${k.toFixed(2)})`}
          />
        );
      })}
    </>
  );
}

/** The start line's mark: a triangle pointing down the piste. */
const GRID_MARK = "M 0 -3 L 2.4 2 L -2.4 2 Z";

/** Which of the plate's two views is up. */
export type SeedView = "panorama" | "plan";

/** A run's number on the panorama: in its grade's sign, as a piste map
 * prints it, this many user units across. */
const BADGE = 7;

type Drawn = Extract<SeedAnswer, { ok: true }>;

/** The plan: the ground from above, summit-up (`seed-chart.ts`). */
function PlanLayers({
  drawn,
  at,
  entry,
}: {
  drawn: Drawn;
  at: [number, number] | null;
  entry: boolean;
}) {
  return (
    <>
      {/* THE GROUND, baked with its rows along +z (the summit's row first,
          so at the top) and its columns turned round here once, so the
          plan is seen from the valley (`seed-chart.ts`). */}
      {drawn.url && (
        <image
          href={drawn.url}
          x={0}
          y={0}
          width={CHART_VIEW}
          height={CHART_VIEW}
          preserveAspectRatio="none"
          transform={`matrix(-1 0 0 1 ${CHART_VIEW} 0)`}
        />
      )}
      <path class="seed-preview-route" d={drawn.schematic.track} fill="none" />
      <HouseMarks houses={drawn.schematic.houses} scale={0.8} standing={false} />
      {drawn.schematic.kickers.map((k) => (
        <path
          key={k.id}
          class={`seed-preview-kicker${k.onTrack ? "" : " seed-preview-kicker-off"}`}
          d={KICKER_MARK}
          transform={`translate(${k.x.toFixed(1)} ${k.y.toFixed(1)}) rotate(${degrees(k.angle).toFixed(0)})`}
        />
      ))}
      {!entry && (
        <path
          class={`seed-preview-grid${at ? " seed-preview-grid-off" : ""}`}
          d={GRID_MARK}
          transform={`translate(${drawn.schematic.grid.x.toFixed(1)} ${drawn.schematic.grid.y.toFixed(1)}) rotate(${degrees(drawn.schematic.grid.angle).toFixed(0)})`}
        />
      )}
    </>
  );
}

/** The panorama: the painted mountain and the ski area over it. Every run's
 * hidden stretches (behind a ridge, in a gully the view does not see into)
 * dotted faintly under the lot, then the seen ones cased in white, the
 * course raced the widest; the lifts over the runs, as they hang over them;
 * the kickers, the numbers, the start and the finish on top. */
function PanoramaLayers({
  drawn,
  at,
  entry,
}: {
  drawn: Drawn;
  at: [number, number] | null;
  entry: boolean;
}) {
  const pano: PanoramaSchematic = drawn.panorama.schematic;
  const stroke = (grade: PisteGrade): string => GRADE_LOOK[grade].paint;
  return (
    <>
      {drawn.panoUrl && (
        <image
          href={drawn.panoUrl}
          x={0}
          y={0}
          width={PANORAMA_VIEW}
          height={PANORAMA_VIEW}
          preserveAspectRatio="none"
        />
      )}
      {pano.runs.map((r) => (
        <path
          key={`h${r.id}`}
          class="pano-run-hidden"
          d={r.hidden}
          stroke={stroke(r.grade)}
          fill="none"
        />
      ))}
      {pano.runs.map((r) => (
        <path
          key={`c${r.id}`}
          class={`pano-run-casing${r.raced ? " pano-raced" : ""}${r.kind === "road" ? " pano-road" : ""}`}
          d={r.seen}
          fill="none"
        />
      ))}
      {pano.runs.map((r) => (
        <path
          key={`r${r.id}`}
          class={`pano-run${r.raced ? " pano-raced" : ""}${r.kind === "road" ? " pano-road" : ""}`}
          d={r.seen}
          stroke={stroke(r.grade)}
          fill="none"
        />
      ))}
      {pano.lifts.map((l) => (
        <g key={l.id} class={`pano-lift pano-lift-${l.kind}`}>
          <line class="pano-lift-casing" x1={l.from[0]} y1={l.from[1]} x2={l.to[0]} y2={l.to[1]} />
          <line class="pano-lift-line" x1={l.from[0]} y1={l.from[1]} x2={l.to[0]} y2={l.to[1]} />
          <circle class="pano-station" cx={l.from[0]} cy={l.from[1]} r={0.9} />
          <circle class="pano-station" cx={l.to[0]} cy={l.to[1]} r={0.9} />
        </g>
      ))}
      <HouseMarks houses={pano.houses} scale={0.75} standing />
      {pano.kickers.map((k) => (
        <path
          key={k.id}
          class={`seed-preview-kicker${k.onTrack ? "" : " seed-preview-kicker-off"}`}
          d={KICKER_MARK}
          transform={`translate(${k.x.toFixed(1)} ${k.y.toFixed(1)}) rotate(${k.angle.toFixed(0)}) scale(0.45)`}
        />
      ))}
      {pano.runs.map((r) =>
        r.badge ? (
          <g
            key={`b${r.id}`}
            class="pano-badge"
            transform={`translate(${(r.badge[0] - BADGE / 2).toFixed(1)} ${(r.badge[1] - BADGE / 2).toFixed(1)})`}
          >
            <path
              d={gradePath(GRADE_LOOK[r.grade].shape)}
              fill={GRADE_LOOK[r.grade].paint}
              stroke={GRADE_LOOK[r.grade].rim}
              stroke-width={1.6}
              transform={`scale(${BADGE / 24})`}
            />
            <text x={BADGE / 2} y={BADGE / 2 + 1.3}>
              {r.number}
            </text>
          </g>
        ) : null,
      )}
      {pano.finish && (
        <rect
          class="pano-finish"
          x={pano.finish[0] - 1.4}
          y={pano.finish[1] - 1.4}
          width={2.8}
          height={2.8}
        />
      )}
      {pano.start && !entry && (
        <path
          class={`seed-preview-grid${at ? " seed-preview-grid-off" : ""}`}
          d={GRID_MARK}
          transform={`translate(${pano.start.x.toFixed(1)} ${pano.start.y.toFixed(1)}) rotate(${pano.start.angle.toFixed(0)}) scale(0.75)`}
        />
      )}
    </>
  );
}

/** WHERE THE RIDE STARTS, marked so it cannot be missed: a dot in the
 * run's colour with rings beating out of it — at the spot tapped, or at
 * the head of the run the lift carries the skier to. */
function EntryMark({ at, grade }: { at: [number, number]; grade: PisteGrade | null }) {
  const look = grade ? GRADE_LOOK[grade] : null;
  return (
    <g class="seed-preview-entry" transform={`translate(${at[0].toFixed(1)} ${at[1].toFixed(1)})`}>
      <circle class="seed-preview-pulse" r={2.4} />
      <circle class="seed-preview-pulse seed-preview-pulse-late" r={2.4} />
      <circle class="seed-preview-entry-ring" r={3.2} />
      <circle
        class="seed-preview-entry-dot"
        r={1.7}
        fill={look?.paint}
        stroke={look ? look.rim : undefined}
      />
    </g>
  );
}

export function SeedPreview({
  chart,
  entry,
  machine = null,
  spot,
  onSpot,
}: {
  chart: SeedChart;
  /** The run the lift carries the skier to (`markedRun`); null off a ski
   * area, or before the chart has named the runs. */
  entry: FreeRunInfo | null;
  /** The machine the ride begins on, when the RUN row picked one: marked
   * where it waits on the valley floor (the paramotor on the summit)
   * rather than at any run's head; the afterski at its lodge's door. */
  machine?: "heli" | "sled" | "para" | "balloon" | "afterski" | null;
  /** The picked start, m on the snow; null is the start line. */
  spot: { x: number; z: number } | null;
  onSpot: (spot: { x: number; z: number }) => void;
}) {
  const { shown, fresh } = chart;
  const [view, setView] = useState<SeedView>("panorama");
  const drawn = shown !== null && shown.ok ? shown : null;
  const pick = (e: MouseEvent): void => {
    if (!drawn || !fresh) return;
    const box = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return;
    const u = (e.clientX - box.left) / box.width;
    const v = (e.clientY - box.top) / box.height;
    if (view === "plan") {
      onSpot(fromChart(drawn.schematic.size, u * CHART_VIEW, v * CHART_VIEW));
      return;
    }
    // A tap on the sky picks nothing.
    const { view: lens, pick: grid } = drawn.panorama;
    const at = fromPanorama(lens, grid, u * PANORAMA_VIEW, v * PANORAMA_VIEW);
    if (at) onSpot(at);
  };
  const at =
    drawn && spot
      ? view === "plan"
        ? toChart(drawn.schematic.size, spot.x, spot.z)
        : spotInPanorama(drawn.panorama.view, drawn.panorama.pick, spot.x, spot.z)
      : null;
  // The head of the run picked, where the lift sets him down — or the
  // machine he begins on, at the bottom — drawn even where a ridge hides it
  // from the valley, since it is where he starts.
  const start = drawn && machine ? (drawn.machines[machine] ?? null) : (entry?.head ?? null);
  const head =
    drawn && start
      ? view === "plan"
        ? toChart(drawn.schematic.size, start.x, start.z)
        : toPanorama(drawn.panorama.view, start.x, start.y, start.z)
      : null;
  const label = drawn
    ? view === "plan"
      ? STRINGS.seedChart(drawn.seed, drawn.schematic.kickers.length)
      : STRINGS.seedPanorama(
          drawn.seed,
          drawn.panorama.schematic.runs.filter((r) => r.kind === "piste").length,
          drawn.panorama.schematic.lifts.length,
        )
    : "";
  return (
    <div class={`seed-preview${fresh ? "" : " seed-preview-waiting"}`}>
      <div class="seed-preview-plate">
        {drawn ? (
          <svg
            class="seed-preview-map"
            viewBox={`0 0 ${CHART_VIEW} ${CHART_VIEW}`}
            role="img"
            aria-label={label}
            onClick={pick}
          >
            {view === "plan" ? (
              <PlanLayers drawn={drawn} at={at} entry={head !== null} />
            ) : (
              <PanoramaLayers drawn={drawn} at={at} entry={head !== null} />
            )}
            {at ? (
              <EntryMark at={at} grade={null} />
            ) : (
              head && <EntryMark at={head} grade={machine ? null : (entry?.grade ?? null)} />
            )}
          </svg>
        ) : (
          <p class="seed-preview-word">
            {shown === null ? STRINGS.seedReading : STRINGS.seedRefused}
          </p>
        )}
        {drawn && (
          <button
            type="button"
            class="seed-preview-view"
            data-menu="view"
            onClick={() => setView(view === "plan" ? "panorama" : "plan")}
          >
            {view === "plan" ? STRINGS.seedViewPanorama : STRINGS.seedViewPlan}
          </button>
        )}
      </div>
      {/* Always rendered, empty until there is a reading: the line holds its
          own height, so the chart's arrival adds nothing under the plate. */}
      <p class="seed-preview-read">
        {drawn && <GradeMark grade={entry?.grade ?? drawn.colour} className="seed-preview-grade" />}
        {drawn
          ? STRINGS.seedRead(
              STRINGS.gradeNames[entry?.grade ?? drawn.colour],
              entry?.length ?? drawn.length,
              entry?.vertical ?? drawn.vertical,
              drawn.schematic.kickers.length,
            )
          : ""}
      </p>
    </div>
  );
}
