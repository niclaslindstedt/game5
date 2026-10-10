// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// LAKE ICE — whether the water on a map is open, freezing, frozen or
// breaking up on the map's day, and how (`defs/lake-ice.ts` holds the
// numbers and the limnology behind them).
//
// The year is walked a day at a time from the summer's warmest day to the
// map's own: open water cools under the frost until it closes over, border
// ice reaching out from the shore first; the ice thickens by the Stefan
// law; snow falls on it on the frosty days; the spring's warmth melts the
// snow, rots the ice and opens a moat along the shore before the middle
// goes. A pure function of the body, the latitude, the region and the day
// — nothing is drawn from the run's stream and nothing is stepped, so no
// digest can see it; the renderer reads it once a map.

import { dayOfYearOf } from "../mapgen/sun.ts";
import { regionOf, type RegionId } from "../mapgen/regions.ts";
import type { Level, WaterBody, WaterStream } from "../mapgen/types.ts";
import { LAKE_ICE } from "./defs/lake-ice.ts";

const L = LAKE_ICE;
const YEAR = 365;

/** Where in its year a body of water is. */
export type WaterPhase = "open" | "forming" | "frozen" | "thawing";

export type WaterState = {
  phase: WaterPhase;
  /** The ice's thickness, m (0 open). */
  ice: number;
  /** FORMING: how far the shore ice reaches out over the water, m. */
  rim: number;
  /** THAWING: how wide the open moat along the shore is, m. */
  moat: number;
  /** How white the snow on the ice lies, 0..1. */
  snow: number;
  /** How far the spring has rotted the ice, 0..1 (grey, wet, candled). */
  rot: number;
  /** Days since the cover closed (0 open). */
  age: number;
  /** The day's mean air, °C (a cold day over open water steams). */
  air: number;
};

/** The day's mean air, °C, at `altitude` m over the sea. */
export function airOn(day: number, latitude: number, altitude: number, region: RegionId): number {
  const r = L.region[region];
  const lat = Math.abs(latitude);
  const mean = L.sea - L.perLatitude * lat + r.mean - (L.lapse * altitude) / 1000;
  const swing = (L.swing + L.swingPerLatitude * lat) * r.swing;
  const coldest = coldestOf(latitude);
  return mean - swing * Math.cos((2 * Math.PI * (day - coldest)) / YEAR);
}

/** The coldest day of the year at `latitude`. */
const coldestOf = (latitude: number): number => (latitude < 0 ? L.coldest + YEAR / 2 : L.coldest);

/** The frost a body of water takes to close over, °C·day. */
export function frostNeeded(area: number, running: boolean): number {
  const need = L.need + L.perRootArea * Math.sqrt(Math.max(0, area));
  return running ? need * L.running : need;
}

/**
 * A body of water on day `day` (any count off 1 January; folded) of its
 * year: `altitude` its surface's real height over the sea, m, `area` m²,
 * `running` for a river.
 */
export function waterOn(
  day: number,
  latitude: number,
  altitude: number,
  area: number,
  running: boolean,
  region: RegionId,
): WaterState {
  const warmest = latitude < 0 ? L.warmest + YEAR / 2 : L.warmest;
  const target = dayOfYearOf(day);
  const days = (((target - warmest) % YEAR) + YEAR) % YEAR;
  const need = frostNeeded(area, running);
  const alphaSnow = running ? L.alphaSnow * 0.7 : L.alphaSnow;
  const alphaBare = running ? L.alphaBare * 0.7 : L.alphaBare;
  let cold = 0; // frost banked against the freeze, °C·day
  let ice = 0;
  let peak = 0;
  let snow = 0; // m of water
  let age = 0;
  let melting = false;
  let air = 0;
  for (let k = 0; k <= days; k++) {
    air = airOn(warmest + k, latitude, altitude, region);
    if (ice <= 0) {
      cold = air < 0 ? cold - air : Math.max(0, cold - air * L.warmBack);
      melting = false;
      if (cold >= need) {
        ice = L.skin;
        peak = ice;
        age = 0;
        snow = 0;
      }
      continue;
    }
    age++;
    const frost = Math.max(0, -air);
    if (frost > 0) {
      const covered = Math.min(1, snow / L.snowWhite);
      const alpha = alphaBare + (alphaSnow - alphaBare) * covered;
      ice = Math.sqrt(ice * ice + alpha * alpha * frost);
      snow = Math.min(L.snowMost, snow + L.snowFall);
    }
    // The spring's sun melts below zero; the autumn's is too low to.
    const spring = (((warmest + k - coldestOf(latitude)) % YEAR) + YEAR) % YEAR < YEAR / 2;
    const warm = Math.max(0, air - (spring ? L.meltFrom : 0));
    if (warm > 0) {
      snow = Math.max(0, snow - L.melt * warm);
      ice -= L.meltIce * warm * (snow > 0 ? L.underSnow : 1);
      if (spring && air > 0 && ice < peak) melting = true;
    }
    if (ice > peak && !melting) peak = ice;
    if (ice < L.open && melting) {
      ice = 0;
      cold = 0;
      snow = 0;
      age = 0;
      melting = false;
    } else if (ice < L.skin) ice = L.skin;
  }
  const white = Math.min(1, snow / L.snowWhite);
  if (ice <= 0) {
    const rimShare = (cold / need - L.rimFrom) / (1 - L.rimFrom);
    const forming = rimShare > 0;
    return {
      phase: forming ? "forming" : "open",
      ice: 0,
      rim: forming ? rimShare * L.rimMost : 0,
      moat: 0,
      snow: 0,
      rot: 0,
      age: 0,
      air,
    };
  }
  const rotting = melting && ice < Math.max(L.rotten, peak * 0.8);
  const gone = rotting ? 1 - Math.min(1, (ice - L.open) / Math.max(0.01, peak - L.open)) : 0;
  const rot = rotting ? Math.min(1, gone * 1.3 + (ice < L.rotten ? 0.3 : 0)) : 0;
  return {
    phase: rotting ? "thawing" : "frozen",
    ice,
    rim: 0,
    moat: rotting ? Math.min(1, gone * 1.2) * L.moatMost : 0,
    snow: age < L.blackDays && white < 1 ? white * (age / L.blackDays) : white,
    rot,
    age,
    air,
  };
}

/** A lake on its map's day. */
export function bodyState(level: Level, body: WaterBody): WaterState {
  return waterOn(
    level.sun.dayOfYear,
    level.sun.latitude,
    body.realLevel ?? body.y,
    body.area,
    body.kind === "river",
    regionOf(level).id,
  );
}

/** A stream on its map's day: running water a few metres wide, whose
 * frost needed is a pond's of its width squared. */
export function streamState(level: Level, stream: WaterStream, y: number): WaterState {
  return waterOn(
    level.sun.dayOfYear,
    level.sun.latitude,
    stream.realLevel ?? y,
    stream.width * stream.width * 4,
    true,
    regionOf(level).id,
  );
}
