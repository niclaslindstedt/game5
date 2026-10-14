// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS A BIKE PARK'S TRAILS ARE NAMED FROM (§39.1) — the names burned on
// the signs at the trail heads (`bike-sign-plan.ts`). A park names a trail
// for what it rides like, the way a ski area names a run for what it is:
// a green's a gentle word, a blue's the flow and the berms, a red's the
// roots and the rocks of the woods it drops through, a black's fearsome;
// the race line is the DOWNHILL. Dealt off a hash of the map's seed and
// the trail's id, never the stream. And below them THE WORDS OF THE RIDE
// ITSELF (`bike.ts`), spread into `STRINGS` as `BIKE_STRINGS` as the
// snowmobile's are: the START row's stop, the news a ride earns, its HUD.

import type { BikeCrash, BikeLanding, BikePart, TrailGrade } from "@engine";

export const BIKE_TRAIL_NAMES: Readonly<Record<TrailGrade, readonly string[]>> = {
  green: ["EASY FLOW", "MEADOW LINE", "FIRST TURNS", "LAZY BERMS", "VALLEY WAY", "SUNNY SIDE"],
  blue: ["BERM BURNER", "ROLLER LINE", "FLOW STATE", "TABLE SERVICE", "SWOOP", "CORKSCREW"],
  red: ["ROOT CELLAR", "ROCK HOP", "FOREST FLOOR", "LOAM RANGER", "SIDEWINDER", "ANKLE BITER"],
  black: ["NO BRAKES", "THE CHUTE", "GRAVITY", "STEEP SIDE", "WIDOW MAKER", "LAST RITES"],
};

/** The race line's name on its start sign. */
export const BIKE_RACE_NAME = "DOWNHILL";

const LANDINGS: Record<BikeLanding, string> = {
  clean: "CLEAN",
  cased: "CASED IT",
  nosed: "NOSED IN",
  overshot: "OVERSHOT",
  flat: "TO FLAT",
};

const CRASHES: Record<BikeCrash, string> = {
  bars: "OVER THE BARS!",
  washout: "FRONT WASHED OUT!",
  lowside: "LOWSIDED!",
  landing: "CRASH LANDING",
  hit: "BIKE HIT!",
  down: "OFF THE BIKE!",
};

/** A limb caught in the bike, by the part that caught it. */
const SNAGS: Record<BikePart, string> = {
  front: "CAUGHT IN THE SPOKES!",
  rear: "CAUGHT IN THE SPOKES!",
  ring: "CAUGHT IN THE CHAINRING!",
  bars: "TANGLED IN THE BARS!",
  stem: "TANGLED IN THE BARS!",
  frame: "TANGLED IN THE FRAME!",
};

/** Met by the bike as he came off it. */
const STRUCK: Record<BikePart, string> = {
  front: "INTO HIS OWN WHEEL",
  rear: "INTO HIS OWN WHEEL",
  ring: "CHAINRING TO THE SHIN",
  bars: "BAR END TO THE GUT",
  stem: "STEM TO THE GROIN",
  frame: "INTO HIS OWN FRAME",
};

export const BIKE_STRINGS = {
  /** The START row's summer stop: the ride begun on the downhill bike. */
  startRunBike: "BIKE",

  /* ── THE NEWS (run-news.ts) ────────────────────────────────────────── */
  newsBikeBoard: "BACK ON THE BIKE",
  newsBikeHop: "OFF THE BIKE",
  newsBikeRight: "BACK ON THE TRAIL",
  newsBikeRestart: "AT THE TRAIL HEAD",
  newsBikeLift: "BIKE HOOKED ON",
  /** A landing judged, with the body's peak load past a clean one. */
  newsBikeLand: (landing: BikeLanding, air: number): string =>
    landing === "clean" ? `${LANDINGS.clean} ${air.toFixed(1)} S` : LANDINGS[landing],
  /** How he came off it. */
  newsBikeCrash: (how: BikeCrash | undefined): string => CRASHES[how ?? "down"],
  /** A limb caught in his own bike, and the bike met as he came off it. */
  newsBikeSnag: (part: BikePart | undefined): string => SNAGS[part ?? "frame"],
  newsBikeStruck: (part: BikePart | undefined): string => STRUCK[part ?? "frame"],

  /* ── THE HUD (hud-bike.tsx) ────────────────────────────────────────── */
  /** How far is left of the trail he rides. */
  bikeToGo: (m: number): string =>
    m >= 1000 ? `${(m / 1000).toFixed(1)} KM` : `${Math.round(m / 10) * 10} M`,
  bikeFalls: (n: number): string => (n === 1 ? "1 FALL" : `${n} FALLS`),
  /** The way to it, walking; and how to get on, stood beside it. */
  bikeCall: "BIKE",
  bikeAway: (m: number): string => `${Math.round(m)} M`,
  bikeTake: (touch: boolean, key: string): string =>
    touch ? "TAP TO RIDE" : `${key} OR CLICK TO RIDE`,
};
