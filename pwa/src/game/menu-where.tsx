// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FREE RIDE'S WHERE STEPS — the cards FREE RIDE opens on, before the
// start card (`where-steps.ts` says which step follows which):
//
//   THE WORLD   a world map flown onto the range the ride stands in, a
//               marker on every real ski area where it lies; a marker
//               tapped picks it, and the RANGE and AREA rows beside the map
//               step the same picks from the keys (RANGE's last stop is
//               GENERATED, the seed's own mountain: the map pulls back to
//               the world, and the start card's rows say its country and
//               number).
//   THE AREA    the picked area's mountainsides on a closer map, a marker
//               each, and the PART row — shown only where the area has
//               more than one.
//
// Both write the ride's `face` and `region` and nothing of their own, so
// the start card's rows read the same pick. The map is drawn by
// `world-map-view.tsx`, whose outline is a small download of its own.

import { type RegionId, realFacePlace, realFaceRegion } from "@engine";
import { useState } from "preact/hooks";

import { areaIds, areaOf, GENERATED, rangeIds, rangeOf, wherePicked } from "./face-picks.ts";
import type { FreeRide } from "./free-ride.ts";
import { Caption, MenuBody, MenuHead, StepRow, type Hint } from "./menu-knobs.tsx";
import type { Settings } from "./settings.ts";
import { STRINGS } from "./strings.ts";
import { areaMarks, areaTarget, markOf, partMarks, worldTarget } from "./where-steps.ts";
import { type MapMark, WorldMapView } from "./world-map-view.tsx";

/** How rough a mountainside's marker is on the area step, km: a ring this
 * wide says "about here", never a lift's spot. */
const HALO_KM = 2.5;

export function WherePage({
  step,
  settings,
  onSettings,
  onBack,
  onNext,
}: {
  step: "world" | "area";
  settings: Settings;
  onSettings: (settings: Settings) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [hint, setHint] = useState<Hint | null>(null);
  const ride = settings.ride;
  const setRide = (patch: Partial<FreeRide>): void =>
    onSettings({ ...settings, ride: { ...ride, ...patch } });
  const face = ride.face;
  const range = rangeOf(face);
  const generated = range === GENERATED;
  const area = markOf(face);
  /** A pick of RANGE (and AREA): GENERATED and a country, or a real face. */
  const pickWhere = (next: string, at?: string): void => {
    const where = wherePicked(next, ride.region, at);
    if (where) setRide({ ...where, spot: null, run: null });
  };
  const pickFace = (id: string): void =>
    setRide({ face: id, region: realFaceRegion(id)!, spot: null, run: null });

  const world = step === "world";
  const marks: MapMark[] = world
    ? areaMarks().map((m) => ({
        key: m.key,
        lat: m.lat,
        lon: m.lon,
        label: STRINGS.placeName(m.area),
        group: STRINGS.rangeName(m.range),
        dim: m.range !== range,
      }))
    : partMarks(face).map((p) => ({
        key: p.id,
        lat: p.lat,
        lon: p.lon,
        label: STRINGS.placeName(p.part),
      }));
  const parts = partMarks(face);
  const place = face ? realFacePlace(face) : null;

  return (
    <div class="menu-card menu-card-where" onPointerLeave={() => setHint(null)}>
      <MenuHead
        back={onBack}
        backLabel={STRINGS.menuBack}
        title={world ? STRINGS.whereTitle : STRINGS.whereAreaTitle}
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
        <div class="where-cols">
          <div
            class="where-plate"
            data-hint={STRINGS.whereMapHint}
            data-hint-label={STRINGS.whereTitle}
            onPointerEnter={() =>
              setHint({ label: STRINGS.whereTitle, text: STRINGS.whereMapHint })
            }
          >
            <WorldMapView
              marks={marks}
              selected={world ? (area?.key ?? null) : face}
              target={(view) => (world ? worldTarget(face, view) : areaTarget(face, view))}
              targetKey={world ? range : `${area?.key}`}
              haloKm={world ? undefined : HALO_KM}
              onPick={(key) => {
                if (!world) return pickFace(key);
                const m = areaMarks().find((a) => a.key === key);
                if (m) pickWhere(m.range, m.area);
              }}
            />
          </div>
          <div class="where-side">
            <div class="knob-rows">
              {world ? (
                <>
                  <StepRow
                    label={STRINGS.startRange}
                    hint={STRINGS.startRangeHint}
                    stops={rangeIds().map((id) => ({
                      id,
                      label: id === GENERATED ? STRINGS.rangeGenerated : STRINGS.rangeName(id),
                    }))}
                    value={range}
                    onPick={(id) => pickWhere(id)}
                    onHint={setHint}
                  />
                  <StepRow
                    label={STRINGS.startArea}
                    hint={generated ? STRINGS.startRegionHint : STRINGS.startAreaHint}
                    stops={areaIds(range).map((id) => ({
                      id,
                      label: generated
                        ? STRINGS.regionNames[id as RegionId]
                        : STRINGS.placeName(id),
                    }))}
                    value={areaOf(face, ride.region)}
                    onPick={(at) => pickWhere(range, at)}
                    onHint={setHint}
                  />
                </>
              ) : (
                <StepRow
                  label={STRINGS.startPart}
                  hint={STRINGS.whereMountainHint}
                  stops={parts.map((p) => ({ id: p.id, label: STRINGS.placeName(p.part) }))}
                  value={face ?? ""}
                  onPick={pickFace}
                  onHint={setHint}
                />
              )}
            </div>
            <div class="where-read">
              {place && area ? (
                <>
                  <p class="where-read-name">
                    {world ? STRINGS.placeName(place.area) : STRINGS.placeName(place.part)}
                  </p>
                  <p class="where-read-line">
                    {STRINGS.rangeName(place.range)}
                    {world ? ` · ${STRINGS.whereParts(area.faces.length)}` : ""}
                  </p>
                  <p class="where-read-line">
                    {world
                      ? STRINGS.whereAt(area.lat, area.lon)
                      : STRINGS.whereAt(place.lat, place.lon)}
                  </p>
                </>
              ) : (
                <>
                  <p class="where-read-name">{STRINGS.rangeGenerated}</p>
                  <p class="where-read-line">{STRINGS.whereGenerated}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </MenuBody>
      <Caption hint={hint} fallback={world ? STRINGS.whereCaption : STRINGS.whereAreaCaption} />
    </div>
  );
}
