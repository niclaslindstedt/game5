// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE START CARD — the first of the two questions between the front door and
// a FREE RIDE: WHERE, and WHEN. The second, WHO and WHAT ON, is the rider
// card this card's way on opens and the gear card after it, which is also
// where RIDE is.
//
// IT IS THE FREE RIDE'S CARD AND NOBODY ELSE'S. A race is dealt its map fresh
// off the front door and rides the day that map came with; the free ride is
// the one way onto the snow where nothing is compared, which is exactly
// where a map of your own, a day of your own and a depth of snow of your own
// belong. (Sibling game3's start card, ported for snow.)
//
// THE WHERE STEPS COME FIRST (`menu-where.tsx`, `where-steps.ts`): FREE RIDE
// opens on a world map with every real ski area marked where it lies, then,
// where an area has more than one, its mountainsides; this card is the
// third step, and its way back walks them again.
//
// WHERE IS NOT ASKED AGAIN: the steps before this card picked it, and its
// way back is how to change it. Only a GENERATED mountain asks one more
// thing here, as A CHART SHOWS IT, and the rest say when:
//
//   MOUNTAIN under GENERATED, the mountain's NUMBER — the seed, typed or
//           stepped. The CHART is the row's meaning — a number nobody
//           can picture is not a choice — and it is cut from the real
//           generated map in a worker (`seed-preview.tsx`), with every
//           KICKER marked on it, which is what a free skier is hunting.
//
//   SEASON  early winter, midwinter, late winter or spring (`SEASONS`): how
//           high the sun climbs and how long the shadows lie — or SUMMER,
//           the snow gone (`summer.ts`): no SNOW or AVALANCHES row, a sky
//           that never snows, and a START row of the ways into the air.
//   TIME    morning, day, evening or night — a WORD, whose hour is the
//           ENGINE's answer on that date at that map's latitude
//           (`hourOfTime`), never hours written down here. The sun
//           stands there for the whole ride.
//   SNOW    thin, medium, thick or very deep (`SNOW_STOPS`), read as how
//           deep the loose snow lies — up to a metre of fresh snow.
//
//   START   how the ride begins: SLOPE (on the skis or the board the
//           gear card picks), carried by the lift to the RUN
//           row's run — or a way up with no lift: the PARAMOTOR (the
//           ride begun on the summit, the wing over him, skied off and
//           flown — `para.ts`), the HOT AIR BALLOON (begun in its basket
//           on the valley floor and flown up the mountain on the day's
//           wind — `balloon.ts`), the SNOWMOBILE (stood on its boards, the
//           skis racked — `sled.ts`), the HELICOPTER (sat on the skid on
//           its pad — `heli.ts`), the PLANE (in its door on the strip —
//           `plane.ts`), the WINGSUIT (no skis, stood on its exit high on
//           the mountain — `wingsuit-start.ts`), or the AFTERSKI (inside
//           the valley's lodge at the party — `afterski.ts`). A machine is
//           kept as a run id of its map, as it always was (`startPicked`).
//
//   RUN     which run of the ski area the ride starts down, by the number
//           the piste map signs it with — EVERY run of the map, of any
//           colour, and nothing that is not a run (`markedRun`, the
//           engine's `pickFreeRun`). The lift up to its top carries the
//           skier the last few seconds, and the chart marks its head with
//           a pulse; the line under the chart bills it. Picking one puts
//           the START row back on the SLOPE (`runPicked`). There is NO GRADE
//           row: the mountain is the seed's own, and the slope is chosen
//           here, whatever its colour.
//
//   WEATHER the sky (R19): the map's own, or one of the eight at
//           its typical numbers (`weatherFor`). It names no hour: the hour
//           is TIME's alone, so the two rows cannot disagree.
//
//   TEMPERATURE the air at the valley floor at the start hour
//           (`Weather.temp`, `engine/game/air-temp.ts`): AUTO — the air
//           model's own on the season, time and sky picked, its value shown
//           in the dealt colour (`autoTempOf`) — or −20 to +10 °C, the whole
//           day's air shifted to it. It wets the snow or keeps it dry, makes
//           the piste's slush and its freeze, and runs the guns. Not in
//           summer.
//
// THE DAY'S ROWS ARE PUT AWAY behind the SKY press in the head, a cloud
// over a sun: the chart, the SEASON and the two rows that say where the
// ride starts are the card, and the rest of the day is asked only by
// whoever goes looking for it. SEASON stands out with START because it
// changes what START offers (summer's bike and aircraft) and what the rider
// and gear cards after it stand him in.
//
// THE DAY'S ROWS DEFER TO THE MAP until they are moved (`free-ride.ts`):
// SEASON, TIME and WEATHER show what the map was dealt (`dealtDay`), in a
// colour of their own, and stepping one pins a word. There is no AS DEALT
// stop: the row always says what the ride will get. THE CHART IS A CONTROL too: a press on it is where
// the ride starts, and a pick of the RUN row takes that back.
//
// What the rows WRITE is `settings.ride` — so a ride stood up from here and
// one a `?start=free` link boots into are the same ride read the same way.

import { TIMES_OF_DAY, WEATHER_KINDS, snows, summerSky, type WeatherKind } from "@engine";
import { useState } from "preact/hooks";

import { GENERATED, rangeOf } from "./face-picks.ts";
import {
  SEASONS,
  SNOW_STOPS,
  TEMP_STOPS,
  autoTempOf,
  runPicked,
  summerOn,
  type FreeRide,
} from "./free-ride.ts";
import { Glyph } from "./menu-glyphs.tsx";
import { MenuBody, MenuHead, NumberRow, StepRow } from "./menu-knobs.tsx";
import { startChosen, useRunPick } from "./run-pick.ts";
import { SeedPreview } from "./seed-preview.tsx";
import type { Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";

/** The seeds the MAP row walks. Seed 0 is not a map; a link may name any
 * seed the stream takes, and the row clamps what it is typed. */
export const SEED_RANGE = { min: 1, max: 999_999 } as const;

/** The WEATHER row's stops: R19's eight. */
const WEATHER_STOPS: { id: WeatherKind; label: string }[] = WEATHER_KINDS.map((kind) => ({
  id: kind,
  label: STRINGS.weatherNames[kind],
}));

/** ...and in summer, the skies that do not snow. */
const SUMMER_WEATHER = WEATHER_STOPS.filter((s) => !snows(s.id));

/** The SEASON row's stops: the four winters and the summer. */
const SEASON_STOPS = SEASONS.map(({ id }) => ({ id, label: STRINGS.seasonNames[id] }));

/** The TIME row's stops: the four. */
const TIME_STOPS = TIMES_OF_DAY.map((id) => ({ id, label: STRINGS.timeNames[id] }));

/** The TEMPERATURE row's stops: AUTO — showing the air it would give —
 * then the ladder, °C. */
const AUTO_TEMP = "auto";
function tempStops(auto: number | null): { id: string; label: string }[] {
  return [
    { id: AUTO_TEMP, label: STRINGS.tempAuto(auto) },
    ...TEMP_STOPS.map((c) => ({ id: String(c), label: STRINGS.tempWord(c) })),
  ];
}

/** The SNOW row's stops. */
const SNOW_ROW = SNOW_STOPS.map(({ id }) => ({ id, label: STRINGS.snowNames[id] }));
const AVALANCHE_ROW = [
  { id: "on", label: STRINGS.optOn },
  { id: "off", label: STRINGS.optOff },
] as const;

export function StartPage({
  settings,
  seed,
  onSettings,
  onBack,
  onNext,
}: {
  settings: Settings;
  /** The map on the card: the stored one, or the front door's. */
  seed: number;
  onSettings: (settings: Settings) => void;
  /** Back a WHERE step: the area's parts or the world map. */
  onBack: () => void;
  /** On to the skis card, which is where RIDE is. */
  onNext: () => void;
}) {
  /** The day's rows are out (the SKY press) in place of the ride's. */
  const [sky, setSky] = useState(false);
  const ride = settings.ride;
  const setRide = (patch: Partial<FreeRide>): void =>
    onSettings({ ...settings, ride: { ...ride, ...patch } });

  /** A GENERATED mountain asks its number here. */
  const generated = rangeOf(ride.face) === GENERATED;
  const summer = summerOn(ride);

  // THE RUN ROW AND ITS CHART, as the pause card's PISTE MAP asks them too.
  const pick = useRunPick(settings, seed);
  const weather: WeatherKind | "" = ride.weather ?? pick.dealt?.weather ?? "";

  return (
    <div class="menu-card menu-card-start">
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={STRINGS.startTitle}
        /* THE WAY ON STANDS IN THE HEAD, opposite the way back: a press
           under the chart and the rows would be the part of the card that
           hangs off the bottom of a phone. The SKY press beside it puts
           the day's rows out. */
        action={
          <div class="menu-head-acts">
            <button
              type="button"
              class={`menu-chip start-sky${sky ? " start-sky-on" : ""}`}
              data-menu="sky"
              aria-label={STRINGS.startSky}
              aria-pressed={sky}
              onClick={() => setSky((on) => !on)}
            >
              <Glyph name="weather" />
            </button>
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
          </div>
        }
      />
      <MenuBody>
        <div class="start-cols">
          <SeedPreview
            chart={pick.chart}
            entry={pick.marked}
            machine={pick.machine}
            spot={pick.spot}
            onSpot={(at) => setRide({ spot: { seed, x: at.x, z: at.z } })}
          />
          {sky ? (
            <div class="knob-rows start-rows">
              <StepRow
                label={STRINGS.startTime}
                stops={TIME_STOPS}
                value={ride.time ?? pick.dealt?.time ?? ""}
                dealt={ride.time === null}
                extra={STRINGS.startRunWaiting}
                onPick={(time) => setRide({ time })}
              />
              <StepRow
                label={STRINGS.startWeather}
                stops={summer ? SUMMER_WEATHER : WEATHER_STOPS}
                value={weather === "" || !summer ? weather : summerSky(weather)}
                dealt={ride.weather === null}
                extra={STRINGS.startRunWaiting}
                onPick={(weather) => setRide({ weather })}
              />
              {!summer && (
                <StepRow
                  label={STRINGS.startTemp}
                  stops={tempStops(autoTempOf(ride, pick.dealt))}
                  value={ride.temp === null ? AUTO_TEMP : String(ride.temp)}
                  dealt={ride.temp === null}
                  onPick={(id) => setRide({ temp: id === AUTO_TEMP ? null : Number(id) })}
                />
              )}
              {!summer && (
                <StepRow
                  label={STRINGS.startSnow}
                  stops={SNOW_ROW}
                  value={ride.snow}
                  onPick={(snow) => setRide({ snow })}
                />
              )}
              {!summer && (
                <StepRow
                  label={STRINGS.startAvalanche}
                  stops={AVALANCHE_ROW}
                  value={ride.avalanche ? "on" : "off"}
                  onPick={(id) => setRide({ avalanche: id === "on" })}
                />
              )}
              {!summer && (
                <StepRow
                  label={STRINGS.startRamps}
                  stops={AVALANCHE_ROW}
                  value={ride.ramps ? "on" : "off"}
                  onPick={(id) => setRide({ ramps: id === "on" })}
                />
              )}
            </div>
          ) : (
            <div class="knob-rows start-rows">
              {generated && (
                <NumberRow
                  label={STRINGS.startMap}
                  value={seed}
                  min={SEED_RANGE.min}
                  max={SEED_RANGE.max}
                  onValue={(next) => setRide({ seed: next })}
                />
              )}
              <StepRow
                label={STRINGS.startSeason}
                stops={SEASON_STOPS}
                value={ride.season ?? pick.dealt?.season ?? ""}
                dealt={ride.season === null}
                extra={STRINGS.startRunWaiting}
                onPick={(season) => setRide({ season })}
              />
              <StepRow
                label={STRINGS.startStart}
                stops={pick.starts}
                value={pick.start}
                extra={STRINGS.startRunWaiting}
                onPick={(id) => onSettings(startChosen(settings, seed, id))}
              />
              <StepRow
                label={STRINGS.startRun}
                stops={pick.stops}
                value={pick.value}
                extra={pick.machine ? STRINGS.startRunOff : STRINGS.startRunWaiting}
                onPick={(id) => setRide(runPicked(ride, seed, id))}
              />
            </div>
          )}
        </div>
      </MenuBody>
    </div>
  );
}
