// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// EVERY PARAMETER THE APP READS OFF ITS URL, and what each one means. A
// surface the player can reach is a surface a link can reach, which is what
// makes a frame somebody found handable to somebody else — and it is the
// contract `scripts/screenshot.mjs` drives the built site through.
//
//   ?seed=<n>       pin the map: the front door's RACE rides this seed
//                   rather than a race map off the level card, and the race
//                   the menu stands over is built on it too.
//   ?start=slalom   boot straight into a slalom in its start house (the splash
//                   and the front door skipped). `start=race` and `start=1`
//                   are the same.
//   ?start=downhill ...or into a DOWNHILL's training run in its start house.
//   ?start=superg   ...or into a SUPER-G's one run in its start house.
//   ?start=gs       ...or into a GIANT SLALOM's first run in its start house.
//   ?start=speedski ...or into a SPEED RACE's qualification on its track.
//   ?start=skicross ...or into a SKI CROSS's qualification (`run=2` its
//                   first heat, four out of the start gate).
//   ?start=bigair   ...or into a BIG AIR contest's first jump (`run=2` the
//                   next jump, off the first jumped by the bot).
//   ?start=slopestyle ...or into a SLOPESTYLE contest's first run (`run=2`
//                   the next run, off the first skied by the bot).
//   ?start=halfpipe ...or into a HALFPIPE contest's first run (`run=2`
//                   the next run, off the first skied by the bot).
//   ?start=moguls   ...or into a MOGULS contest's qualification run
//                   (`run=2` its next run, off the first skied by the bot).
//   ?start=aerials  ...or into an AERIALS contest's qualification jump
//                   (`run=2` its next jump, off the first jumped by the
//                   bot); `?plan=bLF` the jump it declares.
//   ?start=free     ...or into a FREE RIDE on the start card's stored map,
//                   day and snow (the seed a `?seed=` names over it).
//   ?t=<s>          ...with this many seconds of it already ridden — by the
//                   BOT, so a picture of a race is a picture of one moving.
//   ?pose=x,z,h,v   ...and then the player's skis stood HERE — plan metres,
//                   heading (rad), forward speed (m/s) — over where the
//                   bot's pre-roll left it: the REPRO line's last word
//                   (`debug-readout.ts`), so a frame found on the developer
//                   page is a link.
//   ?hold=<kmh>[,<move>[,<s>]]
//                   ...and then ridden on a few seconds more (three unless
//                   named) HELD at that speed along his heading in a move
//                   (`hold-input.ts`: straight, carve, turn, skid, check,
//                   stop, skate) —
//                   how a lab photographs what a speed looks like in the
//                   game: the cloud it raises, the skier at it.
//   ?shot=1         ...and held still once drawn, so nothing moves under a
//                   screenshot's shutter.
//   ?paused=1       ...or held under the pause card.
//   ?camera=<rung>  the run's camera (tips, helmet, chase, far, high).
//   ?skis=<id>      the player's pair for this visit (chamois, swift,
//                   chough, falcon, eagle, wolverine, peregrine, marmot,
//                   hare), over the stored one and never written back —
//                   how a lab photographs a pair it did not pick.
//   ?mode=tricks    the run a link boots into (or the next one pressed) is
//                   a TRICKS run on the seed's trick field rather than a
//                   slalom; ?mode=downhill, a DOWNHILL;
//                   ?mode=superg, a SUPER-G; ?mode=gs, a GIANT SLALOM;
//                   ?mode=speedski, a SPEED RACE;
//                   ?mode=skicross, a SKI CROSS; ?mode=bigair, a BIG AIR
//                   contest's first jump, built over the seed's map;
//                   ?mode=slopestyle, a SLOPESTYLE contest's first run,
//                   its course built over the seed's map;
//                   ?mode=halfpipe, a HALFPIPE contest's first run, its
//                   pipe cut into the seed's map; ?mode=moguls, a MOGULS
//                   contest's first run, its course built over the map;
//                   ?mode=aerials,
//                   an AERIALS contest's first jump, its site built over
//                   the map.
//   ?run=2          a slalom or a giant slalom link boots into its SECOND
//                   RUN: the first
//                   skied by the bot to the flag, then the second stood up
//                   off it (`pinned-run.ts`'s `secondRunOff`) — what the
//                   finish plate's SECOND RUN press reaches; a downhill
//                   link, into its RACE rather than its training; a speed
//                   race's, into its FINAL.
//   ?bot=1          the player's own skis skied by the bot for the whole
//                   run, not just the pre-roll — a race watched to its
//                   finish plate with nobody's hands on it.
//   ?poles=0        the player's runs this visit skied WITHOUT POLES (the
//                   hard mode), over the stored OPTIONS row (`poles=1` with
//                   them) — never written back.
//   ?menu=root      open on the front door rather than the attract card;
//   ?menu=options   ...on OPTIONS, and `keys` on OPTIONS ▸ KEYS; `skis` on
//                   the skis card RACE opens; `start` on the free ride's
//                   start card; `campaign` on the campaign card; `levels` on
//                   the level card a RACE picks its pinned map on (the
//                   discipline `mode=` names); `gallery` on the pictures
//                   kept; `dev` on the DEVELOPER page (let out, as the
//                   title's hold lets it out), `unlocks` and `benchHistory` behind it.
//   ?bench=1        run DEVELOPER ▸ BENCHMARK the moment the app is up —
//                   how a lab takes a score off the built site.
//   ?gpu=<mode>     ...with the GPU's timer cutting each frame into its
//                   render passes (`passes`, the default), the scene split
//                   by subsystem as well (`split`), or not at all (`off`).
//   ?hide=<a,b>     ...drawn WITHOUT these subsystems (`HIDEABLE`): the
//                   A/B reading a slice is checked against.
//   ?ab=1           ...hiding each subsystem a frame in turn, and timing
//                   every variant on the GPU (the interleaved A/B).
//   ?frames=<n>     ...timing this many frames instead of the plan's (60 up
//                   to the plan's own) — a price list's shorter stretch.
//   ?view=vista     ...from high on a side ridge, looking across the whole
//                   mountain (`vistaOf`): the view DISTANCE is dearest from.
//   ?weather=<kind> ski the mountain under this sky instead of the one R19
//                   dealt it (clear, fair, high, overcast, snow, fog) —
//                   how a lab photographs every weather on one seed.
//   ?hour=<h>       ...and from this solar start hour (0–24), so a lab can
//                   stand a race in the dark.
//   ?region=<id>    build a seed's mountain in this kind of snow country
//                   (R21: alpine, fell, continental, maritime) — a free ride over the
//                   start card's COUNTRY row, and a race a `?seed=` link
//                   boots into; never a campaign map, which is pinned.
//   ?grade=<id>     build a seed's piste to this grade (R23: green, blue,
//                   red, black) instead of the one the seed deals — a free
//                   ride over the start card's GRADE row, and a race a
//                   `?seed=` link boots into; never a campaign map.
//   ?heli=1         a free ride begun ON THE HELICOPTER on its pad
//                   (`heli.ts`), over the start card's RUN row.
//   ?sled=1         a free ride begun ON THE SNOWMOBILE parked at the
//                   bottom (`sled.ts`), over the start card's RUN row.
//   ?para=1         a free ride begun ON THE SUMMIT UNDER THE PARAMOTOR
//                   (`para.ts`), over the start card's RUN row.
//   ?grimbear=1     a free ride the GRIMBEAR hunts (`grimbear.ts`) — or,
//                   with 0, one he never shows on — over the odds the app
//                   deals him by (`GRIMBEAR_ODDS`).
//   ?afterski=1     a free ride begun INSIDE the valley's afterski lodge
//                   (`afterski.ts`), the party under way.
//   ?buzz=<0..1>    a free ride begun with that BUZZ (`buzz.ts`), as
//                   though he had been to the afterski already.
//   ?groomer=1      a free ride the PISTE MACHINES work whatever the hour
//                   (`groomer.ts`) — or, with 0, one they never do; left
//                   out, they are out after dark.
//   ?video=<tier>   ski this visit at a picture preset (low, medium, high —
//                   `settings-video.ts`) without storing it: how a lab
//                   meters or photographs a rung.
//   ?picture=<r:s,…> ...and these rows at these stops over it
//                   (`distance:low,shadows:off`, `readPicture`), never stored:
//                   how the benchmark prices one row at a time.
//   ?probe=0        do not time the machine on this visit: the first-visit
//                   probe (`video-probe.ts`) may move the picture, and a lab
//                   wants it held still.
//   ?splash=1|0     force the attract card up, or off an ordinary visit.
//   ?update=1       draw the new-build button as if a build were waiting
//                   (read by `update-button.tsx` itself).
//
// DOM-free: the query string is an argument, so `tests/menu_system_test.ts`
// reads every rule here without a browser.

import {
  WEATHER_KINDS,
  isAerialCode,
  isPisteGrade,
  isRegionId,
  isSkiId,
  type CreateGameOptions,
  type PisteGrade,
  type RegionId,
  type GameMode,
  type SkyOverride,
  type SkiId,
  type WeatherKind,
} from "@engine";

import { BENCHMARK } from "./benchmark-plan.ts";
import { GPU_MODES, HIDEABLE, type GpuMode, type Hideable } from "./benchmark-report.ts";
import { readPose, type SkisPose } from "./debug-readout.ts";
import { isHoldMove, type HoldMove } from "./hold-input.ts";
import type { CameraRung } from "./renderer-api.ts";
import { RUN_CAMERAS } from "./settings.ts";
import { readPicture, TIERS, type Tier, type VideoSettings } from "./settings-video.ts";

/** The developer's pages (`menu-dev.tsx`). */
export type DevPage = "dev" | "unlocks" | "benchHistory";

/** The cards a link may open on. */
export type MenuPage =
  | "root"
  | "skis"
  | "dress"
  | "options"
  | "keys"
  | "start"
  | "races"
  | "freestyle"
  | "campaign"
  | "levels"
  | "tricks"
  | "gallery"
  | "stats"
  | DevPage;
const MENU_PAGES: readonly MenuPage[] = [
  "root",
  "skis",
  "dress",
  "options",
  "keys",
  "start",
  "races",
  "freestyle",
  "campaign",
  "levels",
  "tricks",
  "gallery",
  "stats",
  "dev",
  "unlocks",
  "benchHistory",
];

export type UrlParams = {
  seed: number | null;
  /** The URL names a RACE to boot into rather than a card. */
  rides: boolean;
  /** ...and that ride is a FREE RIDE. */
  free: boolean;
  /** Seconds of the race to pre-ride before the first frame is shown. */
  t: number;
  /** Where the player's skier is stood once the pre-roll is skied. */
  pose: SkisPose | null;
  /** ...and the ride he is held on after it, at a speed in a move. */
  hold: { kmh: number; move: HoldMove; seconds: number } | null;
  /** Run the benchmark on boot. */
  bench: boolean;
  /** ...its GPU timer's cut, and what it is drawn without. */
  gpu: GpuMode;
  hide: Hideable[];
  ab: boolean;
  frames: number | null;
  view: "race" | "vista";
  shot: boolean;
  paused: boolean;
  camera: CameraRung | null;
  /** The player's pair for this visit. */
  skis: SkiId | null;
  /** The mode a booted run is ridden in. */
  mode: GameMode;
  /** The bot rides the player's skis for the whole run. */
  bot: boolean;
  /** Which run of a slalom a link boots into. */
  run: 1 | 2;
  /** The player's poles for this visit — false without, true with, null
   * the stored OPTIONS row's. */
  poles: boolean | null;
  /** The URL names the front door. */
  menu: boolean;
  /** ...and which page of it. */
  page: MenuPage;
  /** A picture preset for this visit only. */
  video: Tier | null;
  /** Picture rows for this visit only, laid over the preset (`?picture=`). */
  picture: Partial<VideoSettings>;
  /** Whether the first-visit probe may run. */
  probe: boolean;
  /** A sky and a start hour for this visit's races, over the dealt ones;
   * null when the link names neither. */
  sky: SkyOverride | null;
  /** The kind of snow country a seed's map is built in, over the card's. */
  region: RegionId | null;
  /** The piste grade a seed's map is built to, over the card's. */
  grade: PisteGrade | null;
  /** The jump an AERIALS link's first jump declares (`?plan=bLF`), or null
   * for the contest's own. */
  plan: string | null;
  /** A free ride begun on the helicopter, over the card's RUN row. */
  heli: boolean;
  /** A free ride begun under the paramotor, over the card's RUN row. */
  para: boolean;
  /** A free ride begun on the snowmobile, over the card's RUN row. */
  sled: boolean;
  /** A free ride the grimbear hunts (true) or never shows on (false), over
   * the odds; null when the link names neither. */
  grimbear: boolean | null;
  /** A free ride the piste machines work whatever the hour (true) or never
   * (false); null when the link names neither — out after dark. */
  groomer: boolean | null;
  /** A free ride begun inside the valley's afterski lodge. */
  afterski: boolean;
  /** A free ride's buzz to begin with, 0..1; null sober. */
  buzz: number | null;
};

/** The sky a link names, if any. */
function skyOf(q: URLSearchParams): SkyOverride | null {
  const weather = q.get("weather");
  const hour = Number(q.get("hour") ?? NaN);
  const sky: SkyOverride = {};
  if (weather !== null && WEATHER_KINDS.includes(weather as WeatherKind)) {
    sky.weather = weather as WeatherKind;
  }
  if (q.get("hour") !== null && Number.isFinite(hour) && hour >= 0 && hour <= 24) sky.hour = hour;
  return sky.weather === undefined && sky.hour === undefined ? null : sky;
}

/** A benchmark's stretch a link may name: whole frames, from a second's
 * worth to the plan's own. */
function framesOf(raw: string | null): number | null {
  const n = Number(raw);
  return raw !== null && Number.isInteger(n) && n >= 60 && n <= BENCHMARK.frames ? n : null;
}

/** A held ride a link may name: a speed, km/h (0–150), a move and the
 * seconds it is ridden (0.5–20, three unless named). */
function holdOf(raw: string | null): UrlParams["hold"] {
  if (raw === null || raw.trim() === "") return null;
  const [kmhRaw, moveRaw, secondsRaw] = raw.split(",");
  const kmh = Number(kmhRaw);
  if (!Number.isFinite(kmh) || kmh < 0 || kmh > 150) return null;
  const seconds = Number(secondsRaw ?? 3);
  return {
    kmh,
    move: isHoldMove(moveRaw) ? moveRaw : "straight",
    seconds: Number.isFinite(seconds) ? Math.max(0.5, Math.min(20, seconds)) : 3,
  };
}

/** A seed a link may name: a whole number the generator's stream takes. */
function seedOf(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : null;
}

export function readParams(search: string): UrlParams {
  const q = new URLSearchParams(search);
  const start = q.get("start");
  const paused = q.get("paused") === "1";
  const t = Number(q.get("t") ?? 0);
  const camera = q.get("camera");
  const skis = q.get("skis");
  return {
    seed: seedOf(q.get("seed")),
    rides:
      start === "race" ||
      start === "slalom" ||
      start === "downhill" ||
      start === "superg" ||
      start === "gs" ||
      start === "speedski" ||
      start === "skicross" ||
      start === "bigair" ||
      start === "slopestyle" ||
      start === "halfpipe" ||
      start === "moguls" ||
      start === "aerials" ||
      start === "free" ||
      start === "1" ||
      paused ||
      q.get("shot") === "1",
    free: start === "free",
    t: Number.isFinite(t) && t > 0 ? Math.min(t, 600) : 0,
    pose: readPose(q.get("pose")),
    hold: holdOf(q.get("hold")),
    bench: q.get("bench") === "1",
    gpu: GPU_MODES.includes(q.get("gpu") as GpuMode) ? (q.get("gpu") as GpuMode) : "passes",
    hide: (q.get("hide") ?? "")
      .split(",")
      .filter((name): name is Hideable => HIDEABLE.includes(name as Hideable)),
    ab: q.get("ab") === "1",
    frames: framesOf(q.get("frames")),
    view: q.get("view") === "vista" ? "vista" : "race",
    shot: q.get("shot") === "1",
    paused,
    camera:
      camera !== null && RUN_CAMERAS.includes(camera as CameraRung) ? (camera as CameraRung) : null,
    skis: skis !== null && isSkiId(skis) ? skis : null,
    mode:
      start === "free"
        ? "free"
        : start === "downhill" || q.get("mode") === "downhill"
          ? "downhill"
          : start === "superg" || q.get("mode") === "superg"
            ? "superG"
            : start === "gs" || q.get("mode") === "gs"
              ? "giantSlalom"
              : start === "speedski" || q.get("mode") === "speedski"
                ? "speedSki"
                : start === "skicross" || q.get("mode") === "skicross"
                  ? "skiCross"
                  : q.get("mode") === "tricks"
                    ? "tricks"
                    : start === "bigair" || q.get("mode") === "bigair"
                      ? "bigAir"
                      : start === "slopestyle" || q.get("mode") === "slopestyle"
                        ? "slopestyle"
                        : start === "halfpipe" || q.get("mode") === "halfpipe"
                          ? "halfpipe"
                          : start === "moguls" || q.get("mode") === "moguls"
                            ? "moguls"
                            : start === "aerials" || q.get("mode") === "aerials"
                              ? "aerials"
                              : "slalom",
    bot: q.get("bot") === "1",
    run: q.get("run") === "2" ? 2 : 1,
    poles: q.get("poles") === "0" ? false : q.get("poles") === "1" ? true : null,

    menu: q.get("menu") !== null,
    page: MENU_PAGES.includes(q.get("menu") as MenuPage) ? (q.get("menu") as MenuPage) : "root",
    video: TIERS.includes(q.get("video") as Tier) ? (q.get("video") as Tier) : null,
    picture: readPicture(q.get("picture")),
    probe: q.get("probe") !== "0",
    sky: skyOf(q),
    region: isRegionId(q.get("region")) ? (q.get("region") as RegionId) : null,
    grade: isPisteGrade(q.get("grade")) ? (q.get("grade") as PisteGrade) : null,
    plan: isAerialCode(q.get("plan")) ? q.get("plan") : null,
    heli: q.get("heli") === "1",
    para: q.get("para") === "1",
    sled: q.get("sled") === "1",
    grimbear: q.get("grimbear") === "1" ? true : q.get("grimbear") === "0" ? false : null,
    groomer: q.get("groomer") === "1" ? true : q.get("groomer") === "0" ? false : null,
    afterski: q.get("afterski") === "1",
    buzz: buzzOf(q.get("buzz")),
  };
}

/** WHAT A LINK SAYS ABOUT THE WORLD a seed's run is stood up in: its sky,
 * its region and its grade, as options `createGame` takes — nothing where it
 * names none. */
export function linkWorld(
  params: UrlParams,
): Pick<CreateGameOptions, "sky" | "region" | "grade" | "plan"> {
  return {
    sky: params.sky ?? undefined,
    region: params.region ?? undefined,
    grade: params.grade ?? undefined,
    // An aerials link's declared jump (the other modes declare none).
    plan: params.plan ?? undefined,
  };
}

/** A free ride's options with a link's sky, region, grade, helicopter,
 * snowmobile and paramotor laid over the card's. */
export function overLink(ride: CreateGameOptions, params: UrlParams): CreateGameOptions {
  return {
    ...ride,
    heli: !params.para && (params.heli || ride.heli),
    sled: !params.para && !params.heli && (params.sled || ride.sled),
    para: params.para || (!params.heli && !params.sled && ride.para),
    sky: params.sky ? { ...ride.sky, ...params.sky } : ride.sky,
    region: params.region ?? ride.region,
    grade: params.grade ?? ride.grade,
    grimbear: params.grimbear === null ? ride.grimbear : params.grimbear ? "hunt" : undefined,
    groomer: params.groomer === null ? ride.groomer : params.groomer ? "on" : "off",
    inLodge: params.afterski || ride.inLodge,
    buzz: params.buzz ?? ride.buzz,
  };
}

/** A link's buzz: a number in 0..1, or null. */
function buzzOf(raw: string | null): number | null {
  const b = raw === null ? NaN : Number(raw);
  return Number.isFinite(b) && b > 0 ? Math.min(1, b) : null;
}

/** A fresh seed for a race nobody pinned. Off `Math.random` on purpose:
 * this is the APP choosing which map to build, not the engine drawing
 * inside a run, so the determinism contract is not in play — the engine is
 * handed the number and everything after it replays exactly. */
export function dealSeed(random: () => number = Math.random): number {
  return 1 + Math.floor(random() * 99_999);
}
