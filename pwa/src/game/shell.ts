// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH SURFACE IS UP, and everything that follows from it. Seven surfaces
// over ONE canvas and ONE engine state — the shell never tears a run down,
// it only decides who rides it and what is drawn over the top:
//
//   splash   the attract card (`splash-screen.tsx`).
//   menu     the front door (`menu-main.tsx`), over a bot-ridden race.
//   loading  a race being stood up (`loading-screen.tsx`).
//   pause    the race HELD for the player to read (`menu-pause.tsx`).
//   run      the player's feet on the skis, with the HUD over the top.
//   replay   a run that already happened, being WATCHED (`replay.ts`): the
//            same engine over the same map, ridden off the controls the run
//            was ridden on, with nobody's hands on it — a surface of its own
//            rather than a flag on `run`, because nothing a skier presses
//            may reach it and nothing it does is booked.
//   bench    a race being TIMED (`benchmark.ts`) behind the developer
//            page's card: the benchmark pumps its own frames as fast as
//            the machine draws them, so the app's loop neither steps nor
//            draws while it is up (`appDraws`) — not because the snow is
//            held, but because somebody else is turning it.
//
// THE SNOW NEVER STOPS BEHIND A CARD — with exactly one exception, and the
// difference between the two is the whole reason this module exists. The
// attract card, the front door and the loading card all stand over a race
// nobody is riding: the bot has the player's skis, the field races on, the
// camera orbits, and a menu that stopped it would announce that the game is
// not running. The PAUSE card stands over a race the PLAYER is in the middle
// of, and a race that carried on being ridden while its skier read a menu
// would be a card that costs them the checkpoint they stopped at. So the
// pause card, and only the pause card, freezes.
//
// DOM-free, so `tests/menu_system_test.ts` holds the rules below without a
// browser. `App.tsx` is the one module that decides WHEN the surface
// changes; these say what each one means once it has.

import { BENCHMARK } from "./benchmark-plan.ts";
import type { CameraRung } from "./renderer-api.ts";

export const SHELLS = ["splash", "menu", "loading", "pause", "run", "replay", "bench"] as const;

export type Shell = (typeof SHELLS)[number];

/** Whether the player's hands are on the skis. Everywhere else the BOT
 * rides it, which is what keeps the snow moving under a card. */
export function playerRides(shell: Shell): boolean {
  return shell === "run";
}

/** Whether what is on screen is a RECORDING rather than a race being
 * ridden. Not the opposite of `playerRides`: nobody rides a replay, and yet
 * everything a skier would hear and read is on — it is the race again. */
export function watching(shell: Shell): boolean {
  return shell === "replay";
}

/** Whether the sound is the FULL mix rather than a bed ducked under a card,
 * and whether the race's events make a noise at all: a checkpoint the bot
 * takes under the front door is not news, and one in a replay is. */
export function soundsLive(shell: Shell): boolean {
  return playerRides(shell) || watching(shell);
}

/** Whether the APP's loop takes steps at all — every surface but the pause
 * card (see this module's header) and the benchmark, which steps its own. */
export function simulates(shell: Shell): boolean {
  return shell !== "pause" && shell !== "bench";
}

/** Whether the app's loop DRAWS: everywhere but under the benchmark, whose
 * pump owns the canvas — a frame drawn between two of its frames is time the
 * measurement is charged for and did not spend. */
export function appDraws(shell: Shell): boolean {
  return shell !== "bench";
}

/** Whether the HUD is drawn. The pause card stands OVER the readouts rather
 * than in place of them: the frozen frame the player is looking at is still
 * the run, and its clock, its gates and its place are part of what they
 * stopped to read. */
export function hudOver(shell: Shell): boolean {
  return shell === "run" || shell === "pause" || shell === "replay";
}

/** Whether the pause card can be reached from here. Only out of a run: a
 * card opened over the front door would be offering to freeze an attract
 * demo, and one over the loading card would freeze a race being built. */
export function canPause(shell: Shell): boolean {
  return shell === "run";
}

/** WHICH CAMERA A SURFACE IS SEEN THROUGH. Every card is framed by the
 * slow orbit round the skis — a card is a picture of the race, not a seat
 * in it — and the run and the frame held under the pause card are seen
 * through the rung the skier chose. */
export function cameraFor(shell: Shell, chosen: CameraRung): CameraRung {
  if (shell === "bench") return BENCHMARK.camera;
  return hudOver(shell) ? chosen : "orbit";
}
