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
//           high the sun climbs and how long the shadows lie.
//   TIME    morning, day, evening or night — a WORD, whose hour is the
//           ENGINE's answer on that date at that map's latitude
//           (`hourOfTime`), never hours written down here. The sun
//           stands there for the whole ride.
//   SNOW    thin, medium, thick or very deep (`SNOW_STOPS`), read as how
//           deep the loose snow lies — up to a metre of fresh snow.
//
//   START   how the ride begins: ON SKIS or ON A SNOWBOARD (the pair of
//           that kind the gear card picks), carried by the lift to the RUN
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
//   SUIT    on a craft he can jump from (the paramotor, the balloon, the
//           helicopter, the plane) only: what he jumps in — the
//           skydiver's rig on his skis, or the WINGSUIT with none
//           (`FreeRide.suit`).
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
//   WEATHER the sky (R19): the map's own, or one of the eight at
//           its typical numbers (`weatherFor`). It names no hour: the hour
//           is TIME's alone, so the two rows cannot disagree.
//
// THE DAY'S ROWS DEFER TO THE MAP until they are moved (`free-ride.ts`):
// SEASON, TIME and WEATHER show what the map was dealt (`dealtDay`), in a
// colour of their own, and stepping one pins a word. There is no AS DEALT
// stop: the row always says what the ride will get. THE CHART IS A CONTROL too: a press on it is where
// the ride starts, and a pick of the RUN row takes that back.
//
// What the rows WRITE is `settings.ride` — so a ride stood up from here and
// one a `?start=free` link boots into are the same ride read the same way.

import { TIMES_OF_DAY, WEATHER_KINDS, type WeatherKind } from "@engine";
import { useState } from "preact/hooks";

import { GENERATED, rangeOf } from "./face-picks.ts";
import { SEASONS, SNOW_STOPS, runPicked, type FreeRide } from "./free-ride.ts";
import { Caption, MenuBody, MenuHead, NumberRow, StepRow, type Hint } from "./menu-knobs.tsx";
import { startChosen, SUIT_STOPS, useRunPick } from "./run-pick.ts";
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

/** The SEASON row's stops: the four. */
const SEASON_STOPS = SEASONS.map(({ id }) => ({ id, label: STRINGS.seasonNames[id] }));

/** The TIME row's stops: the four. */
const TIME_STOPS = TIMES_OF_DAY.map((id) => ({ id, label: STRINGS.timeNames[id] }));

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
  const [hint, setHint] = useState<Hint | null>(null);
  const ride = settings.ride;
  const setRide = (patch: Partial<FreeRide>): void =>
    onSettings({ ...settings, ride: { ...ride, ...patch } });

  /** A GENERATED mountain asks its number here. */
  const generated = rangeOf(ride.face) === GENERATED;

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
              {generated && (
                <NumberRow
                  label={STRINGS.startMap}
                  value={seed}
                  min={SEED_RANGE.min}
                  max={SEED_RANGE.max}
                  onValue={(next) => setRide({ seed: next })}
                  onHint={setHint}
                />
              )}
              <StepRow
                label={STRINGS.startStart}
                hint={STRINGS.startStartHint}
                stops={pick.starts}
                value={pick.start}
                extra={STRINGS.startRunWaiting}
                onPick={(id) => onSettings(startChosen(settings, seed, id))}
                onHint={setHint}
              />
              {/* THE SUIT the airborne rides ask: the rig on his skis, or the wingsuit. */}
              {pick.suits && (
                <StepRow
                  label={STRINGS.startSuit}
                  hint={STRINGS.startSuitHint}
                  stops={SUIT_STOPS}
                  value={ride.suit}
                  onPick={(suit) => setRide({ suit })}
                  onHint={setHint}
                />
              )}
              <StepRow
                label={STRINGS.startRun}
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
                stops={SEASON_STOPS}
                value={ride.season ?? pick.dealt?.season ?? ""}
                dealt={ride.season === null}
                extra={STRINGS.startRunWaiting}
                onPick={(season) => setRide({ season })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.startTime}
                stops={TIME_STOPS}
                value={ride.time ?? pick.dealt?.time ?? ""}
                dealt={ride.time === null}
                extra={STRINGS.startRunWaiting}
                onPick={(time) => setRide({ time })}
                onHint={setHint}
              />
              <StepRow
                label={STRINGS.startWeather}
                hint={STRINGS.startWeatherHint}
                stops={WEATHER_STOPS}
                value={ride.weather ?? pick.dealt?.weather ?? ""}
                dealt={ride.weather === null}
                extra={STRINGS.startRunWaiting}
                onPick={(weather) => setRide({ weather })}
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
              <StepRow
                label={STRINGS.startAvalanche}
                hint={STRINGS.startAvalancheHint}
                stops={AVALANCHE_ROW}
                value={ride.avalanche ? "on" : "off"}
                onPick={(id) => setRide({ avalanche: id === "on" })}
                onHint={setHint}
              />
            </div>
          </div>
        </div>
      </MenuBody>
      <Caption hint={hint} fallback={STRINGS.startCaption} />
    </div>
  );
}
