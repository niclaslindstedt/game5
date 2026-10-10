// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START CARD — the first of the two questions between the front door and
// a FREE RIDE: WHERE, and WHEN. The second, WHAT ON, is the skis card this
// card's way on opens, which is also where RIDE is.
//
// IT IS THE FREE RIDE'S CARD AND NOBODY ELSE'S. A race is dealt its map fresh
// off the front door and rides the day that map came with; the free ride is
// the one way onto the snow where nothing is compared, which is exactly
// where a map of your own, a day of your own and a depth of snow of your own
// belong. (Sibling game3's start card, ported for snow.)
//
// THREE ROWS SAY WHERE, A CHART SHOWS IT, and the rest say when:
//
//   RANGE   the massif: the RANGE a real face lies in (`face-picks.ts`: a
//           country, or a range across borders; by name) — only the ranges
//           with a face whose real ski area signs a link's `?grade=` where
//           one asks it — or, last, GENERATED: a mountain the generator raises off a seed.
//
//   AREA    under GENERATED, the kind of snow country it is raised in
//           (R21): the alpine, a fell, a continental range or a maritime
//           one. Under a real range, which of its ski areas, by the place
//           it is known by (a real face brings its own country).
//
//   MOUNTAIN under GENERATED, the mountain's NUMBER — the seed, typed or
//           stepped — with ANOTHER MOUNTAIN beside the rows to deal a
//           fresh one. The CHART is the row's meaning — a number nobody
//           can picture is not a choice — and it is cut from the real
//           generated map in a worker (`seed-preview.tsx`), with every
//           KICKER marked on it, which is what a free skier is hunting.
//   PART    under a real area, which part of it (`real-face.ts`) — a real
//           mountainside's ridge, spurs, gullies and tree line under the
//           seed's lifts and runs; shown only where the area has more
//           than one.
//
//   SEASON  early winter, midwinter, late winter or spring (`SEASONS`): how
//           high the sun climbs and how long the shadows lie.
//   TIME    morning, day, evening or night — a WORD, whose hour is the
//           ENGINE's answer on that date at that map's latitude
//           (`hourOfTime`), never hours written down here. The sun
//           stands there for the whole ride.
//   SNOW    thin, medium, thick or very deep (`SNOW_STOPS`), read as how
//           deep the loose snow lies — up to a metre of fresh snow.
//
//   START   how the ride begins: ON SKIS, carried by the lift to the RUN
//           row's run — or a way up with no lift: the PARAMOTOR (the
//           ride begun on the summit, the wing over him, skied off and
//           flown — `para.ts`), the HOT AIR BALLOON (begun in its basket
//           on the valley floor and flown up the mountain on the day's
//           wind — `balloon.ts`), the SNOWMOBILE (stood on its boards, the
//           skis racked — `sled.ts`), the HELICOPTER (sat on the skid on
//           its pad — `heli.ts`), or the AFTERSKI (inside the valley's
//           lodge at the party — `afterski.ts`). A machine is kept as a
//           run id of its map, as it always was (`startPicked`).
//
//   RUN     which run of the ski area the ride starts down, by the number
//           the piste map signs it with — EVERY run of the map, of any
//           colour, and nothing that is not a run (`markedRun`, the
//           engine's `pickFreeRun`). The lift up to its top carries the
//           skier the last few seconds, and the chart marks its head with
//           a pulse; the line under the chart bills it. Picking one puts
//           the START row back ON SKIS (`runPicked`). There is NO GRADE
//           row: the mountain is the seed's own, and the slope is chosen
//           here, whatever its colour.
//
//   WEATHER the sky (R19): the map's own (AS DEALT), or one of the six at
//           its typical numbers (`weatherFor`). It names no hour: the hour
//           is TIME's alone, so the two rows cannot disagree.
//
// THE DAY'S TWO ROWS DEFER TO THE MAP until they are moved (`free-ride.ts`):
// both stand on AS DEALT, and stepping one pins a word. THE CHART IS A CONTROL too: a press on it is where
// the ride starts, and FROM THE GRID takes that back.
//
// What the rows WRITE is `settings.ride` — so a ride stood up from here and
// one a `?start=free` link boots into are the same ride read the same way.

import {
  type RunGrade,
  TIMES_OF_DAY,
  WEATHER_KINDS,
  realFacePlace,
  realFaceRegion,
  type RegionId,
  type WeatherKind,
} from "@engine";
import { useState } from "preact/hooks";

import {
  areaIds,
  areaOf,
  areaParts,
  GENERATED,
  rangeIds,
  rangeOf,
  wherePicked,
} from "./face-picks.ts";
import { SEASONS, SNOW_STOPS, runPicked, spotOn, startPicked, type FreeRide } from "./free-ride.ts";
import { Caption, MenuBody, MenuHead, NumberRow, StepRow, type Hint } from "./menu-knobs.tsx";
import { useRunPick } from "./run-pick.ts";
import { SeedPreview } from "./seed-preview.tsx";
import type { Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";

/** The seeds the MAP row walks. Seed 0 is not a map; a link may name any
 * seed the stream takes, and the row clamps what it is typed. */
export const SEED_RANGE = { min: 1, max: 999_999 } as const;

/** The WEATHER row's stops: the map's own sky, then R19's eight. */
const WEATHER_STOPS: { id: "dealt" | WeatherKind; label: string }[] = [
  { id: "dealt", label: STRINGS.weatherDealt },
  ...WEATHER_KINDS.map((kind) => ({ id: kind, label: STRINGS.weatherNames[kind] })),
];

/** The RANGE row's stops: every range with a real face
 * whose ski area signs a link's grade (any, without one) (R25), then GENERATED. */
function rangeStops(grade: RunGrade | null): { id: string; label: string }[] {
  return rangeIds(grade).map((id) => ({
    id,
    label: id === GENERATED ? STRINGS.rangeGenerated : STRINGS.rangeName(id),
  }));
}

/** The AREA row's stops: R21's four countries under GENERATED, a real
 * range's ski areas of a link's grade (any, without one). */
function areaStops(range: string, grade: RunGrade | null): { id: string; label: string }[] {
  return areaIds(range, grade).map((id) => ({
    id,
    label: range === GENERATED ? STRINGS.regionNames[id as RegionId] : STRINGS.placeName(id),
  }));
}

/** The PART row's stops: an area's parts of a link's grade (any, without one). */
function partStops(
  range: string,
  area: string,
  grade: RunGrade | null,
): { id: string; label: string }[] {
  return areaParts(range, area, grade).map(({ id, part }) => ({
    id,
    label: STRINGS.placeName(part),
  }));
}

/** The SEASON row's stops: the map's own date, then the four. */
const SEASON_STOPS = [
  { id: "dealt" as const, label: STRINGS.weatherDealt },
  ...SEASONS.map(({ id }) => ({ id, label: STRINGS.seasonNames[id] })),
];

/** The TIME row's stops: the map's own hour, then the four. */
const TIME_STOPS = [
  { id: "dealt" as const, label: STRINGS.weatherDealt },
  ...TIMES_OF_DAY.map((id) => ({ id, label: STRINGS.timeNames[id] })),
];

/** The SNOW row's stops. */
const SNOW_ROW = SNOW_STOPS.map(({ id }) => ({ id, label: STRINGS.snowNames[id] }));

export function StartPage({
  settings,
  seed,
  onSettings,
  onReroll,
  onBack,
  onNext,
}: {
  settings: Settings;
  /** The map on the card: the stored one, or the front door's. */
  seed: number;
  onSettings: (settings: Settings) => void;
  /** Deal a fresh map. */
  onReroll: () => void;
  onBack: () => void;
  /** On to the skis card, which is where RIDE is. */
  onNext: () => void;
}) {
  const [hint, setHint] = useState<Hint | null>(null);
  const ride = settings.ride;
  const setRide = (patch: Partial<FreeRide>): void =>
    onSettings({ ...settings, ride: { ...ride, ...patch } });

  /** Where the ride stands, as RANGE and AREA read it. */
  const range = rangeOf(ride.face);
  const generated = range === GENERATED;
  /** A pick of RANGE (and AREA): GENERATED and a country, or a real face. */
  const pickWhere = (next: string, area?: string): void => {
    const at = wherePicked(next, ride.grade, ride.region, area);
    if (at) setRide({ ...at, spot: null, run: null });
  };
  const place = ride.face ? realFacePlace(ride.face) : null;
  const parts = place ? partStops(place.range, place.area, ride.grade) : [];

  // THE RUN ROW AND ITS CHART, as the pause card's PISTE MAP asks them too.
  const pick = useRunPick(settings, seed);

  return (
    <div class="menu-card menu-card-start" onPointerLeave={() => setHint(null)}>
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={STRINGS.startTitle}
        /* THE WAY ON STANDS IN THE HEAD, opposite the way back: a press
           under the chart and the rows would be the part of the card that
           hangs off the bottom of a phone. */
        action={
          <button
            type="button"
            class="menu-item menu-item-start menu-head-go"
            data-menu="next"
            data-nav-next
            data-nav-focus
            onClick={onNext}
          >
            <span class="menu-item-name">{STRINGS.startNext}</span>
          </button>
        }
      />
      <MenuBody>
        <div class="start-cols">
          <div class="start-col">
            <div class="knob-rows">
              <StepRow
                label={STRINGS.startRange}
                hint={STRINGS.startRangeHint}
                stops={rangeStops(ride.grade)}
                value={range}
                onPick={(id) => pickWhere(id)}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.startArea}
                hint={generated ? STRINGS.startRegionHint : STRINGS.startAreaHint}
                stops={areaStops(range, ride.grade)}
                value={areaOf(ride.face, ride.region)}
                onPick={(area) => pickWhere(range, area)}
                onHint={setHint}
              />
              {generated && (
                <NumberRow
                  label={STRINGS.startMap}
                  hint={STRINGS.startMapHint}
                  value={seed}
                  min={SEED_RANGE.min}
                  max={SEED_RANGE.max}
                  onValue={(next) => setRide({ seed: next })}
                  onHint={setHint}
                />
              )}
              {parts.length > 1 && (
                <StepRow
                  label={STRINGS.startPart}
                  hint={STRINGS.startPartHint}
                  stops={parts}
                  value={ride.face ?? ""}
                  onPick={(face) =>
                    setRide({ face, region: realFaceRegion(face)!, spot: null, run: null })
                  }
                  onHint={setHint}
                />
              )}
              <StepRow
                label={STRINGS.startStart}
                hint={STRINGS.startStartHint}
                stops={pick.starts}
                value={pick.start}
                extra={STRINGS.startRunWaiting}
                onPick={(id) => setRide(startPicked(ride, seed, id))}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.startRun}
                hint={STRINGS.startRunHint}
                stops={pick.stops}
                value={pick.value}
                extra={pick.machine ? STRINGS.startRunOff : STRINGS.startRunWaiting}
                onPick={(id) => setRide(runPicked(ride, seed, id))}
                onHint={setHint}
              />
            </div>
            <SeedPreview
              chart={pick.chart}
              entry={pick.marked}
              machine={pick.machine}
              spot={pick.spot}
              onSpot={(at) => setRide({ spot: { seed, x: at.x, z: at.z } })}
            />
          </div>
          <div class="start-col">
            <div class="knob-rows">
              <StepRow
                label={STRINGS.startSeason}
                hint={STRINGS.startSeasonHint}
                stops={SEASON_STOPS}
                value={ride.season ?? "dealt"}
                onPick={(id) => setRide({ season: id === "dealt" ? null : id })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.startTime}
                hint={STRINGS.startTimeHint}
                stops={TIME_STOPS}
                value={ride.time ?? "dealt"}
                onPick={(id) => setRide({ time: id === "dealt" ? null : id })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.startWeather}
                hint={STRINGS.startWeatherHint}
                stops={WEATHER_STOPS}
                value={ride.weather ?? "dealt"}
                onPick={(id) => setRide({ weather: id === "dealt" ? null : id })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.startSnow}
                hint={STRINGS.startSnowHint}
                stops={SNOW_ROW}
                value={ride.snow}
                onPick={(snow) => setRide({ snow })}
                onHint={setHint}
              />
            </div>
            <div class="start-actions">
              <button type="button" class="menu-chip" data-menu="reroll" onClick={onReroll}>
                <span class="menu-tile-name">{STRINGS.startReroll}</span>
              </button>
              <button
                type="button"
                class="menu-chip"
                data-menu="grid"
                disabled={spotOn(ride, seed) === null}
                onClick={() => setRide({ spot: null })}
              >
                <span class="menu-tile-name">{STRINGS.startGrid}</span>
              </button>
            </div>
          </div>
        </div>
      </MenuBody>
      <Caption hint={hint} fallback={STRINGS.startCaption} />
    </div>
  );
}
