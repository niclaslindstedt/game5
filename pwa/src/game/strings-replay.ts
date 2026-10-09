// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REPLAY'S WORDS — the transport bar over a recording (`hud-replay.tsx`),
// the offer after a crash (`hud-replay-offer.tsx`), and the rows that open a
// recording on the pause card and the finish plate. Stated beside the one
// table and spread into it (`strings.ts`), so every word the player reads is
// still one `STRINGS` key. Templates, never concatenations at the call site
// (§39.2).

import type { GameMode } from "@engine";
import { formatTime, ordinal } from "@niclaslindstedt/oss-game-framework/hud/format";

import type { ShotKind } from "./replay-shots.ts";

const MODE_WORDS: Record<GameMode, string> = {
  slalom: "SLALOM",
  giantSlalom: "GIANT SLALOM",
  downhill: "DOWNHILL",
  superG: "SUPER-G",
  speedSki: "SPEED SKIING",
  skiCross: "SKI CROSS",
  timeTrial: "TIME TRIAL",
  free: "FREE RIDE",
  tricks: "TRICKS",
  bigAir: "BIG AIR",
  slopestyle: "SLOPESTYLE",
  halfpipe: "HALFPIPE",
  moguls: "MOGULS",
  aerials: "AERIALS",
};

/** A recording's clock: minutes, seconds and a tenth — `1:04.2`. */
function clockOf(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const rest = s - m * 60;
  return `${m}:${rest.toFixed(1).padStart(4, "0")}`;
}

const MARK_WORDS: Record<ShotKind, string> = {
  air: "AIR",
  pass: "PASS",
  bump: "CONTACT",
  hit: "TRUNK",
  wipeout: "CRASH",
  finish: "FINISH",
};

export const REPLAY_STRINGS = {
  replayWatch: "WATCH REPLAY",
  /** Under the pause card's row: the run so far, and the run is kept. */
  replayWatchNote: "the run so far",
  replayLabel: "REPLAY",
  /** Over a recording opened on the crash just taken. */
  replayInstant: "INSTANT REPLAY",
  /** Said while the picture runs slow, so it is not read as dropped frames. */
  replaySlow: "SLOW",
  /** Said while a seek is stepping toward its mark. */
  replaySeeking: "SEEKING",
  replayTitle: (seed: number, mode: GameMode): string =>
    `${MODE_WORDS[mode] ?? "RUN"} · SEED ${seed}`,
  replayLine: (skis: string, time: number | null, place: number | null): string =>
    `${skis.toUpperCase()} · ${
      time === null
        ? "THE RUN SO FAR"
        : place === null
          ? formatTime(time)
          : `${ordinal(place)} · ${formatTime(time)}`
    }`,
  replayClock: clockOf,
  /** The rung the recording is watched from. */
  replayCamera: (rung: string): string => (rung === "tv" ? "BROADCAST" : rung.toUpperCase()),
  replaySpeed: (speed: number): string => `${speed === 0.25 ? "¼" : speed === 0.5 ? "½" : speed}×`,
  /** The way out: back to the run, the pause card it was opened from, or
   * the finish plate. */
  replayBack: (back: string): string => (back === "pause" ? "BACK" : "BACK TO RUN"),
  replayPlay: "PLAY",
  replayPause: "PAUSE",
  replayAgain: "PLAY AGAIN",
  replayStart: "FROM THE START",
  replaySkipBack: "BACK 5 SECONDS",
  replaySkipOn: "FORWARD 5 SECONDS",
  replaySpeedNext: "NEXT SPEED",
  replayScrub: "SEEK",
  replayMark: (kind: ShotKind): string => MARK_WORDS[kind],
  replayNote: "SPACE play · ← → 5 s · , . frame · ↑ ↓ speed · C camera · H readouts · ESC back",
  /** The offer after a crash, and the key that takes it. */
  replayOffer: "WATCH THAT AGAIN",
  /** OPTIONS ▸ KEYS' row. */
  keyReplay: "REPLAY",
  replayOfferKey: (key: string): string => `${key} · INSTANT REPLAY`,
} as const;
