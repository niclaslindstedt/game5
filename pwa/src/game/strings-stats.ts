// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE STATISTICS — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names, so nothing reads it by any other path. The numbers are
// kept by `stats.ts` and laid out by `menu-stats.tsx`; every word and every
// unit they are read in is here.

import { formatTime, ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";

import type { CrashCause, DeathCause, GameMode } from "@engine";

/** A whole number with its thousands marked. */
const whole = (n: number): string => Math.round(n).toLocaleString("en-US");

/** A long stretch of riding, in hours and minutes (or minutes and seconds
 * under an hour). */
const clock = (seconds: number): string => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} H ${String(m).padStart(2, "0")} MIN`;
  return `${m} MIN ${String(s % 60).padStart(2, "0")} S`;
};

/** A distance: metres under a kilometre, kilometres with a decimal over. */
const reach = (metres: number): string =>
  metres < 1000 ? `${whole(metres)} M` : `${(metres / 1000).toFixed(1)} KM`;

/** What each run was played as, as the statistics name it. */
const MODE_NAMES: Record<GameMode, string> = {
  slalom: "SLALOM",
  giantSlalom: "GIANT SLALOM",
  superG: "SUPER-G",
  downhill: "DOWNHILL",
  skiCross: "SKI CROSS",
  speedSki: "SPEED SKIING",
  timeTrial: "SOLO RUN",
  free: "FREE RIDE",
  tricks: "TRICKS",
  bigAir: "BIG AIR",
  slopestyle: "SLOPESTYLE",
  halfpipe: "HALFPIPE",
  moguls: "MOGULS",
  aerials: "AERIALS",
};

/** What threw him, as a line on the HARD KNOCKS chart. */
const CAUSE_NAMES: Record<CrashCause, string> = {
  tree: "TREES",
  nose: "OVER THE TIPS",
  catch: "CAUGHT EDGES",
  roll: "TUMBLES",
  landing: "BAD LANDINGS",
  skier: "OTHER SKIERS",
  heli: "HELICOPTER",
  sled: "SNOWMOBILE",
  stake: "STAKES",
  chair: "CHAIRLIFTS",
  net: "NETS",
  maul: "THE GRIMBEAR",
  groomer: "PISTE MACHINES",
  car: "TRAFFIC",
  balloon: "BALLOON CRASHES",
};

const DEATH_NAMES: Record<DeathCause, string> = {
  head: "HEAD",
  crush: "CRUSHED",
  impaled: "RUN THROUGH",
  opened: "OPENED",
  torn: "TORN APART",
  bled: "BLED OUT",
  trauma: "INJURIES",
  fire: "FIRE",
  maul: "THE GRIMBEAR",
  machine: "PISTE MACHINE",
  blast: "ROTOR BLAST",
};

export const STATS_STRINGS = {
  /** The front door's small button, and its one figure: the runs counted
   * and how far they went. */
  menuStats: "STATISTICS",
  menuStatsLine: (runs: number, metres: number): string =>
    runs === 0 ? "NO RUNS YET" : `${whole(runs)} ${runs === 1 ? "RUN" : "RUNS"} · ${reach(metres)}`,
  statsTitle: "STATISTICS",
  /** The count of runs and how long they go back, under the head. */
  statsSince: (runs: number, since: number): string =>
    `${whole(runs)} ${runs === 1 ? "RUN" : "RUNS"} SINCE ${new Date(since)
      .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
      .toUpperCase()}`,
  statsEmpty:
    "NOTHING SKIED YET. EVERY RUN YOU RIDE IS COUNTED HERE — HOW FAR, HOW FAST, HOW HIGH, AND EVERY TREE ON THE WAY.",

  /* The four headline tiles, each with one line that puts it in proportion. */
  statsRuns: "RUNS",
  statsRunsLine: (finished: number): string => `${whole(finished)} TO THE FINISH`,
  statsTime: "ON THE SNOW",
  statsTimeValue: clock,
  statsTimeLine: (kmh: number): string => `AVERAGING ${Math.round(kmh)} KM/H`,
  statsDistance: "SKIED",
  statsDistanceValue: reach,
  /** How the distance compares with a marathon's 42.195 km. */
  statsDistanceLine: (metres: number): string =>
    metres >= 42195
      ? `${(metres / 42195).toFixed(1)} MARATHONS`
      : `${Math.round((metres / 42195) * 100)} % OF A MARATHON`,
  statsVertical: "DESCENDED",
  statsVerticalValue: (metres: number): string => `${whole(metres)} M`,
  /** How the vertical compares with an airliner's cruise, about 10.7 km. */
  statsVerticalLine: (metres: number): string =>
    metres >= 10700
      ? `${(metres / 10700).toFixed(1)} × AN AIRLINER'S CRUISE`
      : `${Math.round((metres / 10700) * 100)} % OF AN AIRLINER'S CRUISE`,

  /* The sections. */
  statsBests: "PERSONAL BESTS",
  statsTop: "TOP SPEED",
  statsTopValue: (ms: number): string => `${Math.round(ms * 3.6)} KM/H`,
  statsLongest: "LONGEST AIR",
  statsLongestValue: (s: number): string => `${s.toFixed(2)} S`,
  statsLanding: "HARDEST LANDING RIDDEN",
  statsLandingValue: (g: number): string => `${g.toFixed(1)} G`,
  statsCombo: "BIGGEST COMBO",
  statsComboValue: (points: number): string => whole(points),
  statsIss: "WORST INJURY SCORE",
  statsIssValue: (iss: number): string => `ISS ${whole(iss)}`,
  statsPeak: "HARDEST BLOW",
  statsPeakValue: (g: number): string => `${Math.round(g)} G`,
  statsMostBones: "MOST BONES IN ONE RUN",
  statsMostBonesValue: (n: number): string => whole(n),
  statsScore: "BEST TRICK SCORE",
  statsScoreValue: (points: number): string => whole(points),
  /** Where a best was set: the mode, the seed, the pair. */
  statsWhere: (mode: GameMode, seed: number, skis: string): string =>
    `${MODE_NAMES[mode] ?? mode.toUpperCase()} · SEED ${seed} · ${skis.toUpperCase()}`,
  statsNone: "—",

  statsRacing: "RACING",
  statsWins: "WINS",
  statsPodiums: "PODIUMS",
  statsOuts: "DNF / DSQ",
  statsGates: "GATES TAKEN",
  statsAccuracy: "GATES HIT",
  statsAccuracyValue: (taken: number, missed: number): string =>
    taken + missed === 0 ? "—" : `${Math.round((taken / (taken + missed)) * 100)} %`,

  statsAir: "IN THE AIR",
  statsAirTime: "AIRTIME",
  statsAirTimeValue: (s: number): string => (s < 60 ? `${s.toFixed(1)} S` : clock(s)),
  statsJumps: "LANDINGS",
  statsPoints: "TRICK POINTS",

  statsKnocks: "HARD KNOCKS",
  statsWipeouts: "WIPEOUTS",
  statsTrees: "TREES MET",
  statsSaves: "SAVES",
  statsInjuries: "INJURIES",
  statsBones: "BONES BROKEN",
  statsDeaths: "DEATHS",
  statsCauses: "WHAT PUT YOU DOWN",
  statsKilled: "HOW YOU DIED",
  statsCause: (cause: CrashCause): string => CAUSE_NAMES[cause] ?? cause.toUpperCase(),
  statsDeath: (cause: DeathCause): string => DEATH_NAMES[cause] ?? cause.toUpperCase(),

  statsMountain: "AROUND THE MOUNTAIN",
  statsLifts: "LIFT RIDES",
  statsHeli: "HELICOPTER",
  statsPara: "UNDER A WING",
  statsSled: "SNOWMOBILE",
  statsGroomer: "PISTE MACHINE",
  statsBeers: "BEERS",
  statsBumps: "SKIERS BUMPED",
  statsMauled: "GRIMBEAR",
  statsMinutes: clock,
  statsReach: reach,
  statsCount: whole,

  statsModes: "TIME BY MODE",
  statsMode: (mode: GameMode): string => MODE_NAMES[mode] ?? mode.toUpperCase(),
  statsSkis: "DISTANCE BY SKIS",

  statsTricks: "TRICKS LANDED",
  statsTricksNone: "NO TRICKS LANDED HERE YET",
  statsMaps: "MAP BY MAP",
  statsAllMaps: "ALL MAPS",
  statsSeed: (seed: number): string => `SEED ${seed}`,
  statsMapPrev: "Previous map",
  statsMapNext: "Next map",
  /** One map's row under ALL MAPS: how often, how fast, its best result. */
  statsMapRow: (runs: number, kmh: number): string =>
    `${whole(runs)} ${runs === 1 ? "RUN" : "RUNS"} · ${Math.round(kmh)} KM/H`,
  statsBestTime: (mode: GameMode): string => `BEST ${MODE_NAMES[mode] ?? mode.toUpperCase()}`,
  statsBestTimeValue: (seconds: number): string => formatTime(seconds),

  statsRecent: "RECENT RUNS",
  /** A run's result on its line: the place and time over the line, out of
   * it, or — a run with no finish — how far it went. */
  statsResult: (r: {
    finished: boolean;
    out: boolean;
    place: number | null;
    time: number | null;
    distance: number;
    points: number;
  }): string =>
    r.out
      ? "OUT"
      : r.finished && r.place !== null && r.time !== null
        ? `${ordinal(r.place)} · ${formatTime(r.time)}`
        : r.points > 0
          ? `${whole(r.points)} PTS`
          : reach(r.distance),
  statsWhen: (at: number): string =>
    new Date(at)
      .toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
      .toUpperCase(),

  statsReset: "CLEAR STATISTICS",
  statsResetArm: "PRESS AGAIN TO CLEAR",
};
