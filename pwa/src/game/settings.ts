// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE GAME REMEMBERS between visits: the camera the skier last chose,
// the pair of skis they last took out (the ski card, `menu-skis.tsx`) and
// the topsheet on each pair, whether the sound is on at all, and every row
// of OPTIONS (`menu-options.tsx`) — the three faders, the picture
// (`settings-video.ts`), the keys (`settings-input.ts`), the thumbs, and how
// much help the skier is given — and the time trial's length, the start
// card's answers for a free ride (`free-ride.ts`), and the pinned run the
// level card last picked. The record book, the ghosts and the campaign's
// board are kept beside it, not in it (`records.ts`, `ghost.ts`,
// `campaign.ts`). Nothing is remembered that the player has no way to
// change: the camera is walked with C (or the HUD's press) and the sound is
// the switch on the front door and the pause card.
//
// `mergeSettings` is the one place a stored blob becomes settings this
// build offers, and it is FIELD BY FIELD with every value CHECKED: a value
// off the ladder is one no press can walk the player back to, so
// `Object.assign` over the whole thing would be the bug. DOM-free; the
// storage skin below it is the only part that touches `localStorage`, and it
// never throws — a browser with storage turned off plays with the defaults.

import { SKIS, TIME_TRIAL, isSkiId, type Assist, type SkiId } from "@engine";

import { findLevel } from "./campaign.ts";
import { freshRide, mergeRide, type FreeRide } from "./free-ride.ts";
import type { CameraRung } from "./renderer-api.ts";
import { freshKeys, mergeKeys, type KeyBindings } from "./settings-input.ts";
import { DEFAULT_VIDEO, mergeVideo, videoUntouched, type VideoSettings } from "./settings-video.ts";
import { DEFAULT_OUTFIT, outfitOf, type Outfit } from "./outfit.ts";
import { isTrickMap } from "./trick-maps.ts";

/** THE LADDER C WALKS, nearest first: a lens at the ski tips, the helmet
 * camera, then the three booms behind. "orbit" is not on it: that is the
 * cards' own slow turn round the skier, and a rung a skier could land on by
 * pressing C would be a run seen through a screensaver. */
export const RUN_CAMERAS: readonly CameraRung[] = ["tips", "helmet", "chase", "far", "high"];

/** The rung a first visit rides on — behind and above, the seat the HUD and
 * the sound are tuned at. */
export const DEFAULT_CAMERA: CameraRung = "chase";

/** The rung after `rung` on the ladder, wrapping — and back onto the ladder
 * from anywhere off it. */
export function nextCamera(rung: CameraRung): CameraRung {
  const at = RUN_CAMERAS.indexOf(rung);
  return at < 0 ? DEFAULT_CAMERA : RUN_CAMERAS[(at + 1) % RUN_CAMERAS.length];
}

/** The three faders, each 0..1: everything, the skier's own noise (the
 * wind in the helmet and the edges on the snow — the bus still calls that
 * fader `engine`, the name the sibling games' mixer shares), and every
 * other sound (the powder, every landing and every gate). The sound SWITCH
 * sits over all three. */
export type AudioLevels = { master: number; engine: number; effects: number };

/** One press of a fader's arrow, and the grid a stored level is put on. */
export const AUDIO_STEP = 0.1;

/** WHERE THE THUMBS GO. The tuck lever on the right and the edge control
 * on the left is how the game ships; a left-handed skier swaps them.
 * `sensitivity` multiplies a thumb's travel — above one the edge control
 * reaches full edge and the lever a full tuck with less of it — and
 * `invertLean` makes pushing the edge control AWAY the lean back, the way
 * a flight stick reads. */
export type TouchSettings = { lever: LeverSide; sensitivity: number; invertLean: boolean };
export type LeverSide = "right" | "left";
export const LEVER_SIDES: readonly LeverSide[] = ["right", "left"];
/** The travel of the sensitivity row. */
export const TOUCH_SENSITIVITY = { min: 0.7, max: 1.5, step: 0.1 } as const;

/** HOW MUCH HELP THE SKIER IS GIVEN, a hand at a time (`Assist` in the
 * engine): the body held on the arc the edges ask for (EDGE HOLD), and the
 * skis levelled side to side in the air (AIR BALANCE). */
export type AssistLevel = "off" | "half" | "full";
export const ASSIST_LEVELS: readonly AssistLevel[] = ["off", "half", "full"];
const ASSIST_SHARE: Record<AssistLevel, number> = { off: 0, half: 0.5, full: 1 };
export type AssistSettings = { steer: AssistLevel; air: AssistLevel };

/** The engine's dials for a pair of rows. */
export function assistOf(assist: AssistSettings): Assist {
  return { yaw: ASSIST_SHARE[assist.steer], air: ASSIST_SHARE[assist.air] };
}

export type Settings = {
  /** The run's camera rung (`RUN_CAMERAS`). */
  camera: CameraRung;
  /** The pair the player skis on (`SKI_CATALOG`). */
  skis: SkiId;
  /** What the skier wears (`outfit.ts`): a body, a jacket, pants, a
   * helmet, gloves and poles, each sold in its own colours — picked on the
   * DRESS card. */
  outfit: Outfit;
  /** Whether the game makes a sound at all. */
  sound: boolean;
  audio: AudioLevels;
  video: VideoSettings;
  /** Whether the first-visit probe has had its say (`video-probe.ts`). */
  probed: boolean;
  /** PRESET ▸ AUTO: the picture is the probe's to fit to this machine, on
   * every visit (`video-probe.ts`, `picture-fit.ts`); a row moved by hand
   * or a preset pressed makes it the skier's. */
  autoPicture: boolean;
  keys: KeyBindings;
  touch: TouchSettings;
  assist: AssistSettings;
  /** Whether blows dull an edge or hurt the legs (`damage.ts`) — the next
   * run's, off unless asked for. */
  damage: boolean;
  /** The time trial's length, laps (`TIME_TRIAL.laps`). */
  trialLaps: number;
  /** THE START CARD's answers: the free ride's mountain, day and snow
   * (`free-ride.ts`). */
  ride: FreeRide;
  /** THE LEVEL CARD's answer: the pinned run a RACE and a TIME TRIAL ski
   * (`menu-levels.tsx`, `pinnedFor`) — a campaign run's id, or null for
   * the first rung. */
  level: string | null;
  /** THE TRICK MAP CARD's answer: the park a TRICKS run skis
   * (`trick-maps.ts`) — its id, or null for the first. */
  trickMap: string | null;
  /** Whether the readouts are over the snow (H, OPTIONS ▸ HUD). Off keeps
   * the thumbs and the corner presses, and a picture is then the snow
   * alone (the framework's `shots/shot-hud`). */
  hud: boolean;
  /** Whether the DEVELOPER chip is on the front door — let out by holding
   * the title for `DEV_HOLD_MS` (`menu-hold.ts`), shut by its LOCK press. */
  developer: boolean;
  /** The developer page's switches (`menu-dev.tsx`). */
  dev: DevSettings;
};

/** How long the front door's title is held to let the developer page out,
 * ms: long enough that no thumb resting on it does it by accident. */
export const DEV_HOLD_MS = 7000;

/** DEVELOPER's switches, every one an instrument over the picture rather
 * than a change to the game: the frame rate, the frame's cost, the physics'
 * readouts, the trail maps, the engine's debug output, the free camera. */
export type DevSettings = {
  fps: boolean;
  cost: boolean;
  physics: boolean;
  trails: boolean;
  log: boolean;
  freefly: boolean;
};

export const DEV_SWITCHES = ["fps", "cost", "physics", "trails", "log", "freefly"] as const;

export function freshSettings(): Settings {
  return {
    camera: DEFAULT_CAMERA,
    skis: SKIS.id,
    outfit: { ...DEFAULT_OUTFIT },
    sound: true,
    audio: { master: 1, engine: 1, effects: 1 },
    video: { ...DEFAULT_VIDEO },
    probed: false,
    autoPicture: true,
    keys: freshKeys(),
    touch: { lever: "right", sensitivity: 1, invertLean: false },
    assist: { steer: "full", air: "full" },
    damage: false,
    trialLaps: TIME_TRIAL.laps[0],
    ride: freshRide(),
    level: null,
    trickMap: null,
    hud: true,
    developer: false,
    dev: { fps: false, cost: false, physics: false, trails: false, log: false, freefly: false },
  };
}

/** What the mixer is handed: each fader under the master, and all of it
 * under the switch. */
export function mixOf(settings: Settings): { engine: number; effects: number } {
  const master = settings.sound ? settings.audio.master : 0;
  return { engine: master * settings.audio.engine, effects: master * settings.audio.effects };
}

/** A number off a stored blob, on the grid of a travel, or the fallback. */
function onTravel(
  value: unknown,
  min: number,
  max: number,
  step: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const clamped = Math.min(max, Math.max(min, value));
  // Fixed to hundredths, so a level stepped from 0.7 is 0.8 and not 0.79999.
  return Number((Math.round((clamped - min) / step) * step + min).toFixed(2));
}

/** A string off a stored blob that is a stop on `ladder`, or the fallback. */
function onLadder<T extends string>(value: unknown, ladder: readonly T[], fallback: T): T {
  return typeof value === "string" && ladder.includes(value as T) ? (value as T) : fallback;
}

const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

/** A stored blob — anything at all — made into settings this build offers. */
export function mergeSettings(parsed: unknown): Settings {
  const out = freshSettings();
  if (!parsed || typeof parsed !== "object") return out;
  const blob = parsed as Record<string, unknown>;
  if (typeof blob.camera === "string" && RUN_CAMERAS.includes(blob.camera as CameraRung)) {
    out.camera = blob.camera as CameraRung;
  }
  if (typeof blob.skis === "string" && isSkiId(blob.skis)) out.skis = blob.skis;
  out.outfit = outfitOf(blob.outfit);
  if (typeof blob.sound === "boolean") out.sound = blob.sound;
  const audio = record(blob.audio);
  for (const k of ["master", "engine", "effects"] as const) {
    out.audio[k] = onTravel(audio[k], 0, 1, AUDIO_STEP, out.audio[k]);
  }
  out.video = mergeVideo(blob.video);
  if (typeof blob.probed === "boolean") out.probed = blob.probed;
  // A blob from before AUTO: the fit's only where nobody moved the picture.
  out.autoPicture =
    typeof blob.autoPicture === "boolean" ? blob.autoPicture : videoUntouched(out.video);
  out.keys = mergeKeys(blob.keys);
  const touch = record(blob.touch);
  out.touch.lever = onLadder(touch.lever, LEVER_SIDES, out.touch.lever);
  const T = TOUCH_SENSITIVITY;
  out.touch.sensitivity = onTravel(touch.sensitivity, T.min, T.max, T.step, 1);
  if (typeof touch.invertLean === "boolean") out.touch.invertLean = touch.invertLean;
  const assist = record(blob.assist);
  out.assist.steer = onLadder(assist.steer, ASSIST_LEVELS, out.assist.steer);
  out.assist.air = onLadder(assist.air, ASSIST_LEVELS, out.assist.air);
  if (typeof blob.damage === "boolean") out.damage = blob.damage;
  if (typeof blob.trialLaps === "number" && TIME_TRIAL.laps.includes(blob.trialLaps)) {
    out.trialLaps = blob.trialLaps;
  }
  out.ride = mergeRide(blob.ride);
  if (typeof blob.level === "string" && findLevel(blob.level) !== null) out.level = blob.level;
  if (isTrickMap(blob.trickMap)) out.trickMap = blob.trickMap;
  if (typeof blob.hud === "boolean") out.hud = blob.hud;
  if (typeof blob.developer === "boolean") out.developer = blob.developer;
  const dev = record(blob.dev);
  for (const k of DEV_SWITCHES) {
    const on = dev[k];
    if (typeof on === "boolean") out.dev[k] = on;
  }
  return out;
}

/** Versioned, so a blob a later build reshapes is a blob it can recognise. */
export const SETTINGS_KEY = "fall-line.settings.v1";

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    return mergeSettings(stored === null ? null : JSON.parse(stored));
  } catch {
    // Storage unavailable, or a blob that is not JSON — the defaults are a
    // perfectly good game.
    return freshSettings();
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private mode, a full quota: the visit still plays, it is just not kept.
  }
}
