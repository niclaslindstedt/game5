// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERY WORD THE PLAYER READS, in one table (OSS_GAME_SPEC §39.1). The HUD
// and the cards reference a key here and never carry a literal of their own,
// so a line can be fixed without a code review and a second language is a
// second table rather than a rewrite. Composed lines are templates —
// functions of their parameters — never concatenations at the call site
// (§39.2). Developer diagnostics are deliberately not here.
//
// THE VOCABULARY is a skier's: a run is skied down a PISTE through GATES
// from the START GATE to the FINISH; the equipment is a PAIR of SKIS; the
// body on them is THE SKIER. Nothing here is a lap, a vehicle or a machine.

import type { TrickKind, TrickPart } from "@engine";

import { formatTime, ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";
import { BODY_STRINGS } from "./strings-body.ts";
import { CAMPAIGN_STRINGS } from "./strings-campaign.ts";
import { DEV_STRINGS } from "./strings-dev.ts";
import { GALLERY_STRINGS } from "./strings-gallery.ts";
import { DOWNHILL_STRINGS } from "./strings-downhill.ts";
import { SUPER_G_STRINGS } from "./strings-superg.ts";
import { SPEED_SKI_STRINGS } from "./strings-speedski.ts";
import { SKI_CROSS_STRINGS } from "./strings-skicross.ts";
import { SLED_STRINGS } from "./strings-sled.ts";
import { SLALOM_STRINGS } from "./strings-slalom.ts";

/** THE TRICK VOCABULARY: what each element the engine names (`TrickKind`)
 * is CALLED. The engine names the thing and never the word. */
export const TRICK_WORDS: Readonly<Record<TrickKind, string>> = {
  air: "BIG AIR",
  backflip: "BACKFLIP",
  frontflip: "FRONT FLIP",
  spin: "360",
  half: "180",
  twist: "TWIST",
  landing: "CLEAN LANDING",
  daffy: "DAFFY",
  spread: "SPREAD EAGLE",
  grab: "MUTE GRAB",
};

/** How a revolution's count reads in front of a flip. */
const TIMES = ["", "", "DOUBLE ", "TRIPLE "];

/** One element as read: a flip by its count, a spin by its degrees (and
 * the half turn landed over it, `half`), a landing by its tier. */
function trickWord(kind: TrickKind, spins: number, half = false): string {
  if (kind === "spin") return String(360 * spins + (half ? 180 : 0));
  if (kind === "landing" && spins > 1) return "PERFECT LANDING";
  if (kind === "backflip" || kind === "frontflip") {
    return `${TIMES[spins] ?? `${spins}× `}${TRICK_WORDS[kind]}`;
  }
  return TRICK_WORDS[kind];
}

/** THE COMBO AS ONE LINE: its elements in the order they were won, a
 * revolution's later index read INTO its first (a backflip that came round
 * twice in one flight is one DOUBLE BACKFLIP, not two words), and a half
 * turn landed over a flight's 360s read into them (a 540, not 360 + 180). */
export function comboLine(parts: readonly TrickPart[]): string {
  const merged: { kind: TrickKind; spins: number; flight: number; half: boolean }[] = [];
  for (const p of parts) {
    const spun =
      p.kind === "half" && merged.find((m) => m.kind === "spin" && m.flight === p.flight);
    if (spun) {
      spun.half = true;
      continue;
    }
    const same = p.spins > 1 && merged.find((m) => m.kind === p.kind && m.flight === p.flight);
    if (same) same.spins = Math.max(same.spins, p.spins);
    else merged.push({ ...p, half: false });
  }
  return merged.map((m) => trickWord(m.kind, m.spins, m.half)).join(" + ");
}

/** Metres of vertical, as the HUD and the cards print them. */
const vertical = (metres: number): string => `${Math.round(metres)} M`;

export const STRINGS = {
  /* ── THE SHUTTER AND THE GALLERY — stated in strings-gallery.ts ─────── */
  ...GALLERY_STRINGS,
  /* ── THE DEVELOPER PAGE — stated in strings-dev.ts ─────────────────── */
  ...DEV_STRINGS,
  /* ── THE BODY AND THE G METER — stated in strings-body.ts ──────────── */
  ...BODY_STRINGS,
  /* ── THE SLALOM — stated in strings-slalom.ts ──────────────────────── */
  ...SLALOM_STRINGS,
  ...DOWNHILL_STRINGS,
  ...SUPER_G_STRINGS,
  ...SPEED_SKI_STRINGS,
  ...SKI_CROSS_STRINGS,
  ...SLED_STRINGS,

  /* ── THE HUD (hud.tsx) ─────────────────────────────────────────────── */
  speedUnit: "km/h",
  /** The EDGE bar's caption (`hud-dial.tsx`) and the skid's word on it. */
  edge: "EDGE",
  brake: "SKID",
  cut: "CUT",
  /** THE WIND METER beside the speed (`hud-wind.tsx`): the felt wind's
   * caption, the weather's wind where he stands under it, and both said
   * aloud. */
  windLabel: "WIND",
  windAir: (kmh: number): string => `WEATHER ${Math.round(kmh)}`,
  windAria: (felt: number, air: number): string =>
    `Wind ${Math.round(felt)} km/h, weather ${Math.round(air)} km/h`,
  clockLabel: "TIME",
  /** Gates taken, of how many the piste has — the start gate the first,
   * the finish the last. */
  gates: (taken: number, total: number): string => `${taken} / ${total}`,
  gatesLabel: "GATES",
  /** The vertical dropped so far, m, and its caption. */
  dropped: vertical,
  droppedLabel: "DROPPED",
  /** Where the skier stands in the field, `1ST / 4`. */
  place: (place: number, of: number): string => `${ordinal(place)} / ${of}`,
  placeLabel: "POS",
  /** The clock at the last gate taken, and its caption. */
  split: (seconds: number): string => formatTime(seconds),
  splitLabel: "SPLIT",
  /** The air-time readout, tenths. */
  air: (seconds: number): string => `${seconds.toFixed(1)}s`,
  airLabel: "AIR",
  airBest: "BEST",
  /** THE FREE RIDE's figures, billed on the pause card (never over the
   * snow — a free ride is no contest): the longest flight so far and how
   * far has been skied. */
  bestAirLabel: "BEST AIR",
  distance: (metres: number): string =>
    metres < 1000 ? `${Math.round(metres)} M` : `${(metres / 1000).toFixed(2)} KM`,
  distanceLabel: "SKIED",
  /** Under the free ride's map seed — its one figure over the snow — so a
   * picture of it names its mountain. */
  seedLabel: "SEED",
  /** THE LIGHTS: the whole second still to run, and the word after. */
  count: (left: number): string => String(left),
  go: "GO!",
  /** The standing warning after a gate skied past without being taken,
   * and how far back up the piste it is. */
  missed: "MISSED GATE",
  missedBack: (metres: number): string => `${Math.round(metres)} M BACK`,
  /** The standing hint while the skier is bogged to the knees
   * (`trench.ts`). */
  stuck: "BOGGED",
  stuckHow: "POLE OUT: TUCK AND ROCK",
  /** Down past the first seconds of a fall (`crash.getUp`): what stands
   * him up — a tap anywhere, or the tuck key as bound. */
  getUp: (touch: boolean, key: string): string =>
    touch ? "TAP TO GET UP" : `PRESS ${key} TO GET UP`,
  /** THE DAMAGE INSTRUMENT: its caption, and what each part is called. */
  damageLabel: "DAMAGE",
  damageSkiLeft: "Left edge",
  damageSkiRight: "Right edge",
  damageLegs: "Legs",
  /** The presses in the corner (the pause is the minimap's own). */
  resetTitle: "Back to the last gate you took (R)",
  cameraTitle: "Next camera (C)",
  pauseTitle: "Pause (Esc)",
  /** The build corner: which mountain this frame is of. */
  stage: (seed: number): string => `SEED ${seed}`,
  /** The card the HUD puts up while the TAB is away (§37.3) — not the pause
   * card, which is next door in menu-pause.tsx and shares only the word. */
  paused: "PAUSED",
  pausedNote: "The run waits until you come back",

  /** Printed across the finish arch's span (gates.ts). */
  archLine: "FINISH",
  /** The start house's banner. */
  startLine: "START",

  /* ── THE NEWS COLUMN (run-news.ts) ─────────────────────────────────── */
  newsCheckpoint: (index: number, seconds: number): string =>
    `GATE ${index}  ${formatTime(seconds)}`,
  newsStart: "OUT OF THE GATE",
  /** A gate gone past — and, for a slalom gate the run is charged for
   * (`missed`'s `penalty`), the seconds it put on the clock. */
  newsMissed: (index: number, penalty?: number): string =>
    index === 0
      ? "MISSED THE START GATE"
      : penalty
        ? `MISSED GATE ${index}  +${Number(penalty.toFixed(1))} s`
        : `MISSED GATE ${index}`,
  newsTree: "TREE!",
  /** A lift's tower or a floodlight mast met (`posts.ts`), and an edge
   * stake snapped off (`edge-stakes.ts`). */
  newsPost: "POST!",
  newsStake: "STAKE DOWN",
  /** A landing the legs paid for, and a big one ridden away — its load in
   * g (`flight.ts`'s `landingLoad`). */
  newsHarsh: (g: number): string => `HARD LANDING · ${g.toFixed(1)} G`,
  newsLoad: (g: number): string => `${g.toFixed(1)} G LANDING`,
  newsReset: "BACK ON THE PISTE",
  /** THE SAVE (`crash.ts`): a near fall ridden out, by what nearly put
   * the skier down — a hard landing, a trunk on the shoulder, the body on
   * the snow and back up, an edge that bit, a stake run through. */
  newsSave: (kind: "landing" | "tree" | "body" | "edge" | "stake"): string =>
    kind === "landing"
      ? "SAVED THE LANDING"
      : kind === "tree"
        ? "SHRUGGED OFF THE TREE"
        : kind === "body"
          ? "BACK UP!"
          : kind === "stake"
            ? "STAYED UP!"
            : "HELD THE EDGE",
  /** THE WIPEOUT (`crash.ts`), by what put the skier down: a trunk, a
   * landing taken over the tips, a fall at speed, an edge caught, a
   * landing on the body or one the legs folded under, a stake hit fast,
   * the empty chair off a lift run into his legs, a downhill's A-nets
   * driven into. */
  newsWipeout: (
    cause:
      | "tree"
      | "nose"
      | "roll"
      | "catch"
      | "landing"
      | "skier"
      | "heli"
      | "sled"
      | "stake"
      | "chair"
      | "net",
  ): string =>
    cause === "heli"
      ? "THROWN CLEAR!"
      : cause === "chair"
        ? "SWEPT BY THE CHAIR!"
        : cause === "net"
          ? "INTO THE NETS!"
          : cause === "stake"
            ? "YARD SALE! STAKE"
            : cause === "sled"
              ? "OFF THE SLED!"
              : cause === "tree"
                ? "YARD SALE! TREE"
                : cause === "skier"
                  ? "YARD SALE! TAKEN OUT"
                  : cause === "nose"
                    ? "OVER THE TIPS"
                    : cause === "roll"
                      ? "YARD SALE"
                      : cause === "landing"
                        ? "CRASH LANDING"
                        : "EDGE CAUGHT",
  newsStuck: "BOGGED! POLE OUT",
  /** Riding switch into loose snow on tails that do not ride over it
   * (`switch.ts`'s tail dug in): only a twin-tip planes through it. */
  newsTailDug: "TAILS DUG IN",
  /** The player into one of the crowd on a free ride (`crowd.ts`): a
   * shoulder he rode through, or one that put the other skier down. */
  newsCrowdBump: "OI! WATCH IT",
  newsCrowdDown: "SKIER DOWN! SORRY",
  /** THE HELICOPTER (`heli.ts`): sat on its skid, pushed off it, the
   * machine flown into the mountain, and the ride begun again. */
  newsHeliBoard: "ON THE SKID! FLY HER UP",
  newsHeliDrop: (metres: number): string => `DROPPED FROM ${Math.round(metres)} M!`,
  newsHeliCrash: "MAYDAY! SHE'S GONE DOWN",
  newsHeliRestart: "BACK ON THE PAD",
  /** THE HELICOPTER'S HUD (`hud-heli.tsx`): the height its skids are over
   * the snow, its climb, how to jump off it, and the way to it. */
  heliHeight: "DROP",
  heliMetres: (m: number): string => `${Math.round(m)} M`,
  heliClimb: (v: number): string => `${v >= 0 ? "▲" : "▼"} ${Math.abs(v).toFixed(1)} M/S`,
  /** How to get off — the machine key (`key`, as bound), a double tap on
   * touch: off the skid in the air, onto the snow where it has landed. */
  heliJump: (touch: boolean, key: string): string =>
    touch ? "DOUBLE TAP TO JUMP" : `${key} TO JUMP`,
  heliLanded: (touch: boolean, key: string): string =>
    `LANDED — ${touch ? "DOUBLE TAP" : key} TO STEP OFF`,
  heliCollective: "Collective",
  heliCollectiveShort: "COL",
  heliCall: "HELICOPTER",
  heliPad: (m: number): string => `${Math.round(m)} M`,
  /** Stood beside its skid: how to get on. */
  heliTake: (touch: boolean, key: string): string =>
    touch ? "DOUBLE TAP TO FLY" : `${key} TO FLY`,
  /** Blown into a wind tunnel along the valley floor (`wind-tunnels.ts`). */
  newsTunnel: "WIND TUNNEL! HOLD ON",
  /** Taken onto a lift on a free ride (`lift-ride.ts`). */
  newsLift: (kind: "gondola" | "chair" | "drag"): string =>
    kind === "gondola" ? "GONDOLA UP" : kind === "chair" ? "CHAIR UP" : "T-BAR UP",
  newsDamage: (part: "skiLeft" | "skiRight" | "legs"): string =>
    part === "legs" ? "KNEE HURT" : part === "skiLeft" ? "LEFT EDGE DULLED" : "RIGHT EDGE DULLED",
  newsFinish: (place: number, of: number, seconds: number): string =>
    `${ordinal(place)} OF ${of}  ${formatTime(seconds)}`,

  /* ── THE FINISH PLATE (hud-result.tsx) ─────────────────────────────── */
  resultTitle: "RUN FINISHED",
  resultPlace: (place: number, of: number): string => `${ordinal(place)} OF ${of}`,
  resultTime: (seconds: number): string => formatTime(seconds),
  /** The slalom gates the run was charged for (R28), already in its time. */
  resultPenalty: (seconds: number): string =>
    `INCL. +${Number(seconds.toFixed(1))} s FOR MISSED GATES`,
  /** A skier's name on the standings. */
  skierYou: "YOU",
  skierRival: (slot: number): string => `SKIER ${slot}`,
  /** A skier still out on the piste, and how many gates he has taken. */
  standingOut: (taken: number, gates: number): string => `GATE ${taken}/${gates}`,
  resultAgain: "RACE AGAIN",
  resultNew: "NEW MOUNTAIN",
  resultNote: "B races again · ESC holds the run",

  /* ── THE UPDATE BUTTON (update-button.tsx) ─────────────────────────── */
  updateWord: "RELOAD",
  updateReady: (version: string | null): string =>
    version !== null
      ? `New build v${version} ready — reload to install`
      : "New build ready — reload to install",
  updateArmed: "Press again to reload onto the new build",

  /* ── THE ATTRACT CARD (splash-screen.tsx) ──────────────────────────── */
  loading: "loading",
  splashPresents: "PRESENTS",
  splashTap: "TAP TO START",
  splashPress: "PRESS ANY KEY TO START",

  /* ── THE FRONT DOOR (menu-main.tsx) ────────────────────────────────── */
  /** A race's map line where a link pinned a seed. */
  menuRaceSeed: (seed: number): string => `SEED ${seed}`,
  /** THE DISCIPLINES the game names, by their id. */
  disciplines: {
    slalom: "SLALOM",
    giantSlalom: "GIANT SLALOM",
    superG: "SUPER-G",
    downhill: "DOWNHILL",
    skiCross: "SKI CROSS",
    speedSki: "SPEED SKIING",
  },
  menuFree: "FREE RIDE",
  menuFreeLine: "THE WHOLE MOUNTAIN · NO CLOCK TO BEAT",
  /* ── THE TRICKS RUN (menu-main.tsx, hud-combo.tsx, hud-result.tsx) ── */
  menuTricks: "TRICKS",
  /** The TRICKS tile, billed with the park it skis (or the link's seed). */
  menuTricksLine: (map: string, seconds: number): string =>
    `${map.toUpperCase()} · ${Math.round(seconds / 60)} MIN`,
  menuTricksSeed: (seed: number): string => `SEED ${seed}`,
  /** The run's banked score, the buzzer, and the combo in hand. */
  score: (points: number): string => points.toLocaleString("en-US"),
  scoreLabel: "SCORE",
  timeLeftLabel: "LEFT",
  comboPoints: (base: number, mult: number): string =>
    `${Math.round(base).toLocaleString("en-US")} × ${mult}`,
  comboBanked: (points: number): string => `+${points.toLocaleString("en-US")}`,
  comboSketchy: "SKETCHY",
  comboBailed: (points: number): string => `BAILED −${points.toLocaleString("en-US")}`,
  keyTrick: "GRAB",
  newsTricksFinish: (points: number): string => `TIME! ${points.toLocaleString("en-US")} PTS`,
  resultTricksTitle: "TRICKS",
  pauseSubTricks: (seed: number, points: number): string =>
    `SEED ${seed} · TRICKS · ${points.toLocaleString("en-US")} PTS`,

  menuOptions: "OPTIONS",
  menuBack: "BACK",

  /* ── THE SKI CARD (menu-skis.tsx, ski-picker.tsx, ski-stats.ts) ────── */
  skisTitle: "SKIS",
  skisRide: "SKI",
  skisPrev: "Previous pair",
  skisNext: "Next pair",
  skisDress: "CUSTOMIZE SKIER",
  skisOf: (at: number, of: number): string => `${at} / ${of}`,

  /* ── THE DRESS CARD (menu-dress.tsx, outfit.ts) ───────────────────── */
  dressTitle: "DRESS",
  dressDone: "DONE",
  dressSlots: {
    body: "BODY",
    weight: "WEIGHT",
    jacket: "JACKET",
    pants: "PANTS",
    helmet: "HELMET",
    gloves: "GLOVES",
    poles: "POLES",
  },
  /** Under the rows while the POLES row reads NONE. */
  dressNoPoles:
    "Skiing without poles is harder: no poles to push on, a rise you can barely climb and less to keep your balance with.",
  /** THE SPEC SHEET's figures: what a pair is, off its catalog row. */
  skisFacts: {
    length: "LENGTH",
    waist: "WAIST",
    sidecut: "SIDECUT",
    weight: "PAIR",
    top: "TOP SPEED",
  },
  skisUnits: { cm: "CM", mm: "MM", metres: "M", kg: "KG", speed: "KM/H" },
  /** ...and the bars: what it does on the groomer, and off it. */
  skisBars: {
    top: "TOP SPEED",
    edge: "EDGE HOLD",
    berm: "BERM",
    speed: "SPEED CARVE",
    fast: "FAST BEND",
    quick: "QUICKNESS",
    float: "FLOAT",
    flex: "FORGIVENESS",
    landing: "LANDINGS",
  },

  /* ── THE START CARD (menu-start.tsx, seed-preview.tsx) ─────────────── */
  startTitle: "FREE RIDE",
  startNext: "NEXT",
  startMap: "MOUNTAIN",
  startMapHint: "Which mountain: every seed is another face. Type one, or step through them.",
  startReroll: "ANOTHER MOUNTAIN",
  startRegion: "COUNTRY",
  startRegionHint:
    "What kind of snow country the mountain is raised in: the alpine (steep, woods low down and bowls above the tree line), the fell (low rounded hills in the far north, birch at the tree line), the continental (a tall dry range, cold light snow) or the maritime (deep heavy snow, rime on the trees).",
  /** The REGION row's stops (R21) — a kind of country, never a place. */
  regionNames: {
    alpine: "ALPINE",
    fell: "FELL",
    continental: "CONTINENTAL",
    maritime: "MARITIME",
  },
  startGrade: "GRADE",
  startGradeHint:
    "The colour of the run, as the signs grade it by its steepest stretch: green (gentle and wide, the whole of it under 16 %), blue (under 27 %), red (under 47 %) or black — steep off the start hut, cliff bands to drop across the piste, the most kickers and cliffs beside it. The mountain's own, or one of the four.",
  /** THE PISTE GRADES (R23), as a sign names them: the GRADE row's stops,
   * the mark's name, the loading card's line. */
  gradeNames: { green: "GREEN", blue: "BLUE", red: "RED", black: "BLACK" },
  /** The piste map board at a lift's top (`map-board.ts`): its header, and
   * the mark at the top it stands on. */
  mapBoardTitle: "PISTE MAP",
  mapBoardHere: "YOU ARE HERE",
  /** A grade as a run: `BLACK RUN`. */
  gradeRun: (grade: string): string => `${grade} RUN`,
  startSeason: "SEASON",
  startSeasonHint:
    "The time of winter: how high the sun climbs and how long the shadows lie, from the low sun of December to the long days of April. Starts on the mountain's own date.",
  /** The SEASON row's stops; AS DEALT (`weatherDealt`) is the map's own. */
  seasonNames: {
    early: "EARLY WINTER",
    mid: "MIDWINTER",
    late: "LATE WINTER",
    spring: "SPRING",
  },
  startTime: "TIME",
  startTimeHint:
    "The time of day the run starts at, on that date at that mountain's latitude — a night run under the moon, the runs lit by their floodlight masts and the woods between them dark. The sun stays where it is for the whole run.",
  timeNames: { morning: "MORNING", day: "DAY", evening: "EVENING", night: "NIGHT" },
  startWeather: "WEATHER",
  startWeatherHint:
    "The sky over the run: the mountain's own, or clear, fair, flurries (a few flakes out of a sunny sky), high cloud, overcast (flat light, the rollers hard to read), a steady snowfall, a storm under black cloud (a few tens of metres to see by) or a valley fog. Where it snows, new snow builds up over the run: a storm lays a hand's depth in an hour.",
  /** The WEATHER row's stops: the map's own first, then R19's seven. */
  weatherDealt: "AS DEALT",
  weatherNames: {
    clear: "CLEAR",
    fair: "FAIR",
    flurries: "FLURRIES",
    high: "HIGH CLOUD",
    overcast: "OVERCAST",
    snow: "SNOWING",
    storm: "STORM",
    fog: "FOG",
  },
  startSnow: "SNOW",
  startSnowHint:
    "How deep the powder lies off the piste: thin 20 cm, medium 40 cm (the snow a race is skied on), thick 70 cm, very deep 100 cm. Past medium it is bottomless — stop and you sink to the knees, so keep the speed up and lean back to float the tips; a wide pair floats where a narrow one bogs.",
  /** The SNOW row's stops (`SNOW_STOPS`; the hint above reads their depths). */
  snowNames: { thin: "THIN", medium: "MEDIUM", thick: "THICK", deep: "VERY DEEP" },
  startRun: "RUN",
  startRunHint:
    "Which run to ski: the lift up to its top carries you the last of the way, and the pulsing mark on the chart is where it sets you down. The GRADE row brings up the first run of its colour; step through the others of that colour here. The last two stops are machines waiting at the bottom: the SNOWMOBILE — start stood on its boards with your skis racked, ride it anywhere on the mountain and press the jump twice to ski off — and the HELICOPTER: start sat on its skid on the pad in the valley, fly it anywhere on the mountain and jump off.",
  /** The RUN row's last stop: the ride begun on the helicopter (`heli.ts`). */
  startRunHeli: "HELICOPTER",
  /** A RUN row's stop: the number the piste map signs it with. */
  startRunWord: (number: string): string => number,
  /** The RUN row before the chart has said what runs there are. */
  startRunWaiting: "…",
  startGrid: "FROM THE LIFT",
  startCaption:
    "The pulsing mark is where you start · tap the chart to start anywhere else · the arrows are kickers",
  seedReading: "RAISING THE MOUNTAIN…",
  seedRefused: "NO PISTE ON THIS SEED",
  /** The line under the chart: the run's (or the piste's) grade and
   * length, its vertical and the map's kickers. */
  seedRead: (grade: string, piste: number, drop: number, kickers: number): string =>
    `${grade} · ${(piste / 1000).toFixed(1)} KM · ${vertical(drop)} VERTICAL · ${kickers} KICKERS`,
  seedChart: (seed: number, kickers: number): string =>
    `The mountain on seed ${seed}, with ${kickers} kickers`,
  seedPanorama: (seed: number, runs: number, lifts: number): string =>
    `The mountain on seed ${seed} seen from the valley, with ${runs} runs and ${lifts} lifts`,
  /** The plate's chip, naming the view it turns to. */
  seedViewPanorama: "PANORAMA",
  seedViewPlan: "PLAN",

  /* ── OPTIONS (menu-options.tsx) and its rows (menu-knobs.tsx) ──────── */
  optCaption: "Point at a row to read what it does",
  optRestore: "RESTORE DEFAULTS",
  optOff: "OFF",
  optOn: "ON",
  optLow: "LOW",
  optMedium: "MEDIUM",
  optHigh: "HIGH",
  optMax: "MAX",
  optShadowSkiers: "SKIERS",
  optCustom: "CUSTOM",
  optAuto: "AUTO",
  optUnset: "—",
  optPrev: "previous",
  optNext: "next",
  optLess: "less",
  optMore: "more",
  percent: (share: number): string => `${Math.round(share * 100)}%`,
  times: (factor: number): string => `×${factor.toFixed(1)}`,

  optControlsGroup: "CONTROLS",
  optKeys: "KEYS",
  optKeysHint: "Put any action on any key.",
  optKeysCount: (n: number): string => `${n} ACTIONS`,
  optLever: "TUCK SIDE",
  optLeverHint:
    "Which thumb the tuck lever is under on a touchscreen; the edge control takes the other.",
  optLeverRight: "RIGHT",
  optLeverLeft: "LEFT",
  optSensitivity: "TRAVEL",
  optSensitivityHint:
    "How far a thumb travels for full edge and a full tuck. Higher is a shorter throw.",
  optInvertLean: "INVERT LEAN",
  optInvertLeanHint:
    "Off: pull the edge control toward you to lean back. On: push it away to lean back.",

  optAssistGroup: "ASSIST",
  optAssistSteer: "EDGE HOLD",
  optAssistSteerHint:
    "Holds the body on the arc the edges ask for and catches a skid. Off is the bare skier.",
  optAssistAir: "AIR BALANCE",
  optAssistAirHint:
    "The skier's body keeps the skis level side to side in the air. Off, a jump taken leaning lands leaning.",
  assistOff: "OFF",
  assistHalf: "HALF",
  assistFull: "FULL",
  optAssistNote: "Applies from the next run.",
  optDamage: "DAMAGE",
  optDamageHint:
    "On: a trunk or a hard landing dulls an edge or hurts a knee, and you ski it for the rest of the run.",

  optSoundGroup: "SOUND",
  optSound: "SOUND",
  optSoundHint: "Every sound the game makes, on or off. The same switch as on the front door.",
  optMaster: "MASTER",
  optMasterHint: "Everything, under the three rows below it.",
  optEngine: "WIND",
  optEngineHint: "The skier's own noise: the wind in the helmet and the edges on the snow.",
  optEffects: "EFFECTS",
  optEffectsHint: "The powder, every landing, every gate and every tree.",
  optSoundOff: "OFF",

  optPicture: "PICTURE",
  optPreset: "PRESET",
  optPresetHint:
    "Every row below at once. AUTO times this machine and sets each row for sixty frames a second, keeping what shows most. CUSTOM means a row has been moved off the preset it was on.",
  optResolution: "RESOLUTION",
  optResolutionHint: "How many pixels are drawn, as a share of the screen's own.",
  optDistance: "DISTANCE",
  optDistanceHint:
    "How far out anything is drawn. Shorter is cheaper, and a mist closes before the edge. MAX draws the whole mountain, clear to the summit ridge.",
  optTerrain: "TERRAIN",
  optTerrainHint:
    "How fine the ground's mesh is under the skis. Every setting reaches as far as DISTANCE draws.",
  optTrails: "TRAILS",
  optTrailsHint:
    "How finely the snow keeps every track cut, and how far round the skier. Off leaves the snow untouched.",
  optForest: "FOREST",
  optForestHint:
    "How far out trees are drawn in full, how thick the far woods stand, and how many variants of each kind of tree are drawn: ten, five or two.",
  optShadows: "SHADOWS",
  optShadowsHint:
    "The sun's shadows: every stop but OFF lays the mountain's own shade over the slopes behind its ridges; SKIERS casts the field alone; MEDIUM adds every tree's; HIGH draws every skier's shadow sharp in a map of his own.",
  optSpray: "SPRAY",
  optSprayHint: "How much snow the skis throw.",
  optAntialias: "SMOOTH EDGES",
  optAntialiasHint: "Antialiasing. Takes effect the next time the game is opened.",

  /* ── OPTIONS ▸ KEYS (menu-keys.tsx) ────────────────────────────────── */
  keysTitle: "KEYS",
  keysCaption: "Press a row, then the key to put on it. Escape leaves it as it was.",
  keysRestore: "RESET KEYS",
  keysPrompt: "PRESS A KEY…",
  keysUnbound: "NONE",
  keysClash: "ALSO",
  keysRowHint: (action: string): string => `Press, then the key for ${action.toLowerCase()}.`,
  keysClashHint: (action: string, others: string): string =>
    `The key on ${action.toLowerCase()} also does ${others.toLowerCase()} — pressing it does both.`,
  keyTuck: "TUCK",
  keyBrake: "BRAKE / CUT",
  keyJump: "JUMP",
  /** OPTIONS ▸ KEYS' helicopter section (`settings-heli-keys.ts`). */
  keysHeliTitle: "HELICOPTER",
  keyCollectiveUp: "COLLECTIVE UP",
  keyCollectiveDown: "COLLECTIVE DOWN",
  keyCyclicForward: "CYCLIC FORWARD",
  keyCyclicBack: "CYCLIC BACK",
  keyCyclicLeft: "CYCLIC LEFT",
  keyCyclicRight: "CYCLIC RIGHT",
  keyPedalLeft: "PEDAL LEFT",
  keyPedalRight: "PEDAL RIGHT",
  keyLeft: "LEFT",
  keyRight: "RIGHT",
  keyLeanBack: "LEAN BACK",
  keyLeanForward: "LEAN FORWARD",
  keyReset: "RESET",
  /** On to the snowmobile or the helicopter, and off again. */
  keyMachine: "GET ON / OFF",
  keyRestart: "RESTART",
  keyCamera: "CAMERA",
  keyPause: "PAUSE",

  /* ── THE LOADING CARD (loading-screen.tsx) ─────────────────────────── */
  /** The phases of a load, in order; steps sharing a label are one PHASE
   * and one slot in the count. */
  loadLevel: "Raising the mountain",
  loadScene: "Planting the forest",
  loadWarm: "Grooming the piste",
  /** The phase and where it sits in the plan — a count of PHASES, never of
   * seconds (see `run-loader.ts`). */
  loadStep: (label: string, at: number, of: number): string => `${label}… (${at}/${of})`,
  /** A seed the generator refused, said on the card the player is looking
   * at rather than swallowed. */
  loadFailed: "NO PISTE ON THIS SEED",
  loadFailedHint: "Try another mountain",
  loadFailedBack: "BACK",

  /* ── THE PAUSE CARD (menu-pause.tsx) ───────────────────────────────── */
  pauseHead: "PAUSED",
  pauseSub: (seed: number, taken: number, gates: number): string =>
    `SEED ${seed} · GATE ${taken} OF ${gates}`,
  /** ...over a free ride, where there is no gate to count. */
  pauseSubFree: (seed: number): string => `SEED ${seed} · FREE RIDE`,
  /** ...and under a measured run's, the mountain it is raced on as the free
   * ride's start card raises it again: `FREE RIDE IT · SEED 8 · ALPINE · RED`. */
  pauseMountain: (seed: number, country: string, grade: string): string =>
    `FREE RIDE IT · SEED ${seed} · ${country} · ${grade}`,
  pauseResume: "RESUME",
  pauseRestart: "RESTART",
  pauseRestartFree: "START AGAIN",
  pauseOptions: "OPTIONS",
  pauseMainMenu: "MAIN MENU",
  /** The card BEHIND the pause card's own options panel, named on the way
   * back to it. */
  pauseBack: "PAUSED",
  /** The options panel's line while no row is being looked at. */
  pauseOptionsCaption:
    "What the frame in front of you looks and sounds like. The rest is on the front door.",
  /** THE CAPTION ON THE HELD RUN'S RECORD CELL (`pause-stats.ts`); the
   * other cells wear the HUD's own captions. */
  pauseRecord: "RECORD",
  /** THE CAMERA ROW on the pause card's panel, and a word per rung
   * (`RUN_CAMERAS`). */
  optCameraGroup: "CAMERA",
  optCamera: "VIEW",
  optCameraHint: "Where the eye rides — the same ladder the C key walks.",
  cameraWords: {
    tips: "TIPS",
    helmet: "HELMET",
    chase: "CHASE",
    far: "FAR",
    high: "HIGH",
  },

  /* ── THE TIME TRIAL AND THE RECORD BOOK (menu-main.tsx, hud.tsx,
        hud-result.tsx) ─────────────────────────────────────────────────── */
  menuTrial: "TIME TRIAL",
  menuTrialLine: (seed: number): string => `SEED ${seed} · TOP TO BOTTOM · ALONE`,
  /** The row standing for this mountain and pair, on the tile. */
  menuTrialBest: (seconds: number, skis: string): string =>
    `BEST ${formatTime(seconds)} · ${skis.toUpperCase()}`,
  menuTrialNoBest: "NO TIME SET YET",
  /** The gap to the record at a crossing: `-0.42` ahead, `+1.30` behind. */
  gap: (seconds: number): string => `${seconds < 0 ? "−" : "+"}${Math.abs(seconds).toFixed(2)}`,
  gapLabel: "VS BEST",
  resultTrialTitle: "TIME TRIAL",
  resultRecord: "NEW RECORD",
  /** The row that stood, with its pair and the day it was set. */
  resultBest: (seconds: number, skis: string, at: number): string =>
    `BEST ${formatTime(seconds)} · ${skis.toUpperCase()}${
      at > 0 ? ` · ${new Date(at).toISOString().slice(0, 10)}` : ""
    }`,
  resultOff: (seconds: number): string => `+${seconds.toFixed(2)} OFF THE RECORD`,
  resultTrialAgain: "SKI AGAIN",
  /** The news line at the finish of a run with nobody else on it. */
  newsFinishAlone: (seconds: number): string => `FINISH  ${formatTime(seconds)}`,

  /* ── THE REPLAY (hud-replay.tsx, hud-result.tsx, menu-pause.tsx) ─────── */
  replayWatch: "WATCH REPLAY",
  /** Under the pause card's row: taken mid-run, the run is over. */
  replayWatchNote: "ends this run",
  replayLabel: "REPLAY",
  /** Said while the picture runs slow, so it is not read as dropped frames. */
  replaySlow: "SLOW",
  replayTitle: (seed: number, mode: string): string =>
    `SEED ${seed} · ${mode === "timeTrial" ? "TIME TRIAL" : mode === "tricks" ? "TRICKS" : "RACE"}`,
  replayLine: (skis: string, time: number | null, place: number | null): string =>
    `${skis.toUpperCase()} · ${
      time === null
        ? "UNFINISHED"
        : place === null
          ? formatTime(time)
          : `${ordinal(place)} · ${formatTime(time)}`
    }`,
  /** The rung the recording is watched from. */
  replayCamera: (rung: string): string => (rung === "tv" ? "BROADCAST" : rung.toUpperCase()),
  replayExit: "EXIT",
  replayNote: "C for the camera · ESC to leave",

  /* ── THE CAMPAIGN (strings-campaign.ts, spread in) ─────────────────── */
  ...CAMPAIGN_STRINGS,
} as const;
