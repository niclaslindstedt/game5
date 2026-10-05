// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CAMPAIGN'S WORDS — the front door's CAMPAIGN tile, the campaign card
// (`menu-campaign.tsx`), the level card a RACE and a TIME TRIAL pick their
// mountain on (`menu-levels.tsx`), the card a TRICKS run picks its park on
// (`menu-tricks.tsx`) and the lines the finish plate adds on a rung
// (`campaign-run.ts`). Stated beside the one table and spread into it
// (`strings.ts`), so every word the player reads is still one `STRINGS` key
// and the campaign's block is one file to read. Templates, never
// concatenations at the call site (§39.2).
//
// The shelves are four SKI AREAS, each raced down six of its red and black
// courses (`campaign-levels.ts`); their names and blurbs are the ladder's
// own data there, and the kind of country a tab bills is `regionNames`.

import { formatTime, ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** A solar hour as a clock: `13:44`. */
function clockOf(hour: number): string {
  const h = Math.floor(hour);
  const m = Math.round((hour - h) * 60);
  return `${String(h + Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** A day of the year (1–365) as a date: `24 FEB`. */
function dateOf(dayOfYear: number): string {
  let d = Math.min(365, Math.max(1, Math.round(dayOfYear)));
  let m = 0;
  while (d > MONTH_DAYS[m]) d -= MONTH_DAYS[m++];
  return `${d} ${MONTHS[m]}`;
}

export const CAMPAIGN_STRINGS = {
  /* ── THE FRONT DOOR'S TILE (menu-main.tsx) ─────────────────────────── */
  campaign: "CAMPAIGN",
  /** How far up the mountain the player has got. */
  menuCampaignLine: (cleared: number, of: number): string => `${cleared} OF ${of} RUNS CLEARED`,
  /** The rung the campaign would pick next. */
  menuCampaignNext: (name: string): string => `NEXT · ${name.toUpperCase()}`,
  menuCampaignDone: "EVERY RUN CLEARED",
  /** The RACE and TIME TRIAL tiles, billed with the pinned run they ski. */
  menuPinnedLine: (name: string): string => `${name.toUpperCase()} · TOP TO BOTTOM`,

  /* ── THE CAMPAIGN CARD (menu-campaign.tsx) ─────────────────────────── */
  campaignRide: "SKI",
  campaignTable: "THE TABLE",
  campaignShelfWon: "SHELF WON",
  /** A shelf's line: how much of it is cleared, and where the player stands. */
  campaignShelfLine: (cleared: number, of: number, place: number): string =>
    `${cleared} OF ${of} CLEARED · ${ordinal(place)} ON THE TABLE`,
  campaignShelfLocked: "WIN THE SHELF BEFORE IT TO OPEN THIS ONE",
  /** Why a run is shut: the rung before it has not paid out yet. */
  campaignLevelLocked: "CLEAR THE RUN BEFORE IT — A PODIUM OR A MEDAL",
  campaignPoints: (points: number): string => plural(points, "PT", "PTS"),
  campaignPlace: (place: number, of: number): string => `${ordinal(place)} OF ${of}`,
  campaignWins: (wins: number): string => plural(wins, "WIN", "WINS"),
  /** What a box is: the game, and the run it always is — the piste once,
   * top to bottom. */
  campaignBilling: (mode: "slalom" | "downhill" | "timeTrial"): string =>
    `${mode === "timeTrial" ? "TIME TRIAL" : mode === "downhill" ? "DOWNHILL" : "RACE"} · TOP TO BOTTOM`,
  /** The day a run is skied in, under its name: the sky and the start hour. */
  campaignDay: (sky: string, hour: number): string => `${sky} · ${clockOf(hour)}`,
  campaignSky: {
    clear: "CLEAR",
    fair: "FAIR",
    flurries: "FLURRIES",
    high: "HIGH CLOUD",
    overcast: "OVERCAST",
    snow: "SNOW",
    storm: "STORM",
    fog: "FOG",
  } as Record<string, string>,
  campaignMedal: { bronze: "BRONZE", silver: "SILVER", gold: "GOLD" } as Record<string, string>,
  /** What a medal costs on a trial's box, to the whole second: `GOLD 1'51"`. */
  campaignMedalCost: (medal: string, seconds: number): string =>
    `${medal} ${formatTime(seconds).replace(/"\d+$/, '"')}`,

  /* ── THE LEVEL CARD (menu-levels.tsx) ──────────────────────────────── */
  levelsRace: "RACE ON",
  levelsDownhill: "DOWNHILL ON",
  levelsTrial: "TIME TRIAL ON",
  levelsShelfLocked: "OPENED BY THE CAMPAIGN",
  /** Over a discipline's nine: what they are. */
  levelsRaceMaps: "NINE MOUNTAINS PICKED FOR THIS RACE · THE GENTLEST FIRST",
  /** A race map's course on its box: the drop and the length — a slalom's in
   * metres, a speed course's in kilometres. */
  levelsFigures: (vertical: number, length: number): string =>
    `${Math.round(vertical)} M DROP · ${
      length < 1000 ? `${Math.round(length)} M` : `${(length / 1000).toFixed(1)} KM`
    }`,
  levelsNoBest: "NO TIME SET YET",
  /** An open shelf with no map the mode can ride (no black for a downhill). */
  levelsNoneHere: (mode: "slalom" | "downhill" | "timeTrial"): string =>
    `NO ${mode === "timeTrial" ? "TIME TRIAL" : mode === "downhill" ? "DOWNHILL" : "RACE"} ON THIS SHELF`,
  levelsBest: (seconds: number, skis: string): string =>
    `BEST ${formatTime(seconds)} · ${skis.toUpperCase()}`,

  /* ── THE TRICK MAP CARD (menu-tricks.tsx) ──────────────────────────── */
  tricksOn: "TRICKS ON",
  /** What a trick map's box is: the run and how long the buzzer gives it. */
  tricksBilling: (seconds: number): string => `TRICKS · ${Math.round(seconds / 60)} MIN`,
  /** The day a park is skied on: the sky, the hour and the date. */
  tricksDay: (sky: string, hour: number, dayOfYear: number): string =>
    `${sky} · ${clockOf(hour)} · ${dateOf(dayOfYear)}`,

  /* ── THE FINISH PLATE ON A RUNG (campaign-run.ts) ──────────────────── */
  plateRung: (shelf: string, rung: number, name: string): string =>
    `${shelf.toUpperCase()} ${rung} · ${name.toUpperCase()}`,
  platePoints: (points: number): string => `+${plural(points, "POINT", "POINTS")}`,
  plateMedal: (medal: string): string => `${medal} MEDAL`,
  plateNoMedal: (bronze: number): string => `NO MEDAL · BRONZE IS ${formatTime(bronze)}`,
  plateOpened: (name: string): string => `${name.toUpperCase()} IS OPEN`,
  plateShelfWon: (shelf: string): string => `${shelf.toUpperCase()} WON`,
  plateLocked: "CLEAR THIS RUN TO GO ON",
  plateTableLocked: "TOP THE TABLE TO OPEN THE NEXT SHELF",
  plateEnd: "THE MOUNTAIN IS SKIED",
  plateNext: "NEXT RUN",
} as const;
