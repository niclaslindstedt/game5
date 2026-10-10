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
// FOUR ROWS AND A CHART, and every one of them changes the ride:
//
//   MAP     which seed, typed or stepped, with ANOTHER MAP under the chart to
//           deal a fresh one. The CHART is the row's meaning — a number
//           nobody can picture is not a choice — and it is cut from the real
//           generated map in a worker (`seed-preview.tsx`), with every
//           KICKER marked on it, which is what a free skier is hunting.
//   SEASON  early winter, midwinter, late winter or spring (`SEASONS`): how
//           high the sun climbs and how long the shadows lie.
//   TIME    morning, day, evening or night — a WORD, whose hour is the
//           ENGINE's answer on that date at that map's latitude
//           (`hourOfTime`), never hours written down here. The sun
//           stands there for the whole ride.
//   SNOW    thin, medium, thick or very deep (`SNOW_STOPS`), read as how
//           deep the loose snow lies — up to a metre of fresh snow.
//
//   CLIMATE the kind of snow country the map is built in (R21): the same seed
//           raised as the alpine, a fell, a continental range or a maritime one.
//
//   RANGE   the massif's shape: the seed's own, or the RANGE a real face
//           lies in (`face-picks.ts`: a country, or a range across borders)
//           — only the ranges with a face whose real ski area signs the
//           GRADE asked for.
//
//   AREA    which of that range's ski areas, by the place it is known by.
//
//   PART    which part of that area (`real-face.ts`) — a real
//           mountainside's ridge, spurs, gullies and tree line under the
//           seed's lifts and runs; shown only where the area has more
//           than one.
//
//   GRADE   the colour of the piste (R23): the seed's own (AS DEALT), or a
//           green, a blue, a red or a black built to its band — and the RUN
//           row brought to the first run of that colour.
//
//   RUN     which run of the ski area the ride starts down, by the number
//           the piste map signs it with: the GRADE row's colour's runs
//           stepped through (`markedRun`, the engine's `pickFreeRun`). The
//           lift up to its top carries the skier the last few seconds, and
//           the chart marks its head with a pulse; the line under the chart
//           bills it. Its LAST three stops are no run but a way up with no
//           lift: the PARAMOTOR — the ride begun on the summit, the wing
//           over him, skied off and flown (`para.ts`) — the HOT AIR
//           BALLOON, the ride begun in its basket on the valley floor and
//           flown up the mountain on the day's wind (`balloon.ts`) — the AFTERSKI, the ride
//           begun inside the valley's lodge at the party (`afterski.ts`) — the SNOWMOBILE — the ride begun stood on its boards, the
//           skis racked, ridden up the mountain and hopped off (`sled.ts`) —
//           and the HELICOPTER: the ride begun sat on the skid of the
//           helicopter on its pad on the valley floor, flown up the mountain
//           and pushed off (`heli.ts`).
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
  RUN_GRADES,
  REGION_IDS,
  TIMES_OF_DAY,
  WEATHER_KINDS,
  realFacePlace,
  realFaceRegion,
  type RunGrade,
  type WeatherKind,
} from "@engine";
import { useState } from "preact/hooks";

import { areaParts, faceForGrade, faceRanges, firstFace, rangeAreas } from "./face-picks.ts";
import { SEASONS, SNOW_STOPS, spotOn, type FreeRide } from "./free-ride.ts";
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

/** The CLIMATE row's stops: R21's regions. */
const REGION_STOPS = REGION_IDS.map((id) => ({ id, label: STRINGS.regionNames[id] }));

/** The RANGE row's stops: the seed's own massif, then every range with a
 * real face whose ski area signs the GRADE row's colour (R25). */
function rangeStops(grade: RunGrade | null): { id: string; label: string }[] {
  return [
    { id: "dealt", label: STRINGS.weatherDealt },
    ...faceRanges(grade).map((id) => ({ id, label: STRINGS.rangeName(id) })),
  ];
}

/** The AREA row's stops: a range's ski areas of the GRADE row's colour. */
function areaStops(range: string, grade: RunGrade | null): { id: string; label: string }[] {
  return rangeAreas(range, grade).map((id) => ({ id, label: STRINGS.placeName(id) }));
}

/** The PART row's stops: an area's parts of the GRADE row's colour. */
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

/** The GRADE row's stops: the seed's own colour, then R23's four and the
 * ski route's ORANGE past them (R42). */
const GRADE_STOPS: { id: "dealt" | RunGrade; label: string }[] = [
  { id: "dealt", label: STRINGS.weatherDealt },
  ...RUN_GRADES.map((id) => ({ id, label: STRINGS.gradeNames[id] })),
];

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

  /** A real face picked (its region the ride's), or the seed's own massif. */
  const pickFace = (face: string | null): void =>
    setRide({
      face,
      ...(face ? { region: realFaceRegion(face)! } : {}),
      spot: null,
      run: null,
    });
  /** Where the face on the card is, if any. */
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
              <NumberRow
                label={STRINGS.startMap}
                hint={STRINGS.startMapHint}
                value={seed}
                min={SEED_RANGE.min}
                max={SEED_RANGE.max}
                onValue={(next) => setRide({ seed: next })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.startRegion}
                hint={STRINGS.startRegionHint}
                stops={REGION_STOPS}
                value={ride.region}
                onPick={(region) => setRide({ region, face: null, spot: null, run: null })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.startRange}
                hint={STRINGS.startRangeHint}
                stops={rangeStops(ride.grade)}
                value={place?.range ?? "dealt"}
                onPick={(id) => pickFace(id === "dealt" ? null : firstFace(id, ride.grade))}
                onHint={setHint}
              />
              {place !== null && (
                <StepRow
                  label={STRINGS.startArea}
                  hint={STRINGS.startAreaHint}
                  stops={areaStops(place.range, ride.grade)}
                  value={place.area}
                  onPick={(area) => pickFace(firstFace(place.range, ride.grade, area))}
                  onHint={setHint}
                />
              )}
              {parts.length > 1 && (
                <StepRow
                  label={STRINGS.startPart}
                  hint={STRINGS.startPartHint}
                  stops={parts}
                  value={ride.face ?? ""}
                  onPick={pickFace}
                  onHint={setHint}
                />
              )}
              <StepRow
                label={STRINGS.startGrade}
                hint={STRINGS.startGradeHint}
                stops={GRADE_STOPS}
                value={ride.grade ?? "dealt"}
                onPick={(id) => {
                  const grade = id === "dealt" ? null : id;
                  // A face whose real ski area has no piste of the colour
                  // gives way to one of its area's or its range's that has,
                  // or to the seed's own massif.
                  const face = faceForGrade(ride.face, grade);
                  setRide({
                    grade,
                    face,
                    region: face ? realFaceRegion(face)! : ride.region,
                    spot: null,
                    run: null,
                  });
                }}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.startRun}
                hint={STRINGS.startRunHint}
                stops={pick.stops}
                value={pick.value}
                extra={STRINGS.startRunWaiting}
                onPick={(id) =>
                  setRide({ run: { seed, region: ride.region, face: ride.face, id }, spot: null })
                }
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
