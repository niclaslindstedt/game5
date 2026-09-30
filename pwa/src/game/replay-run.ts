// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RECORDING ON THE SNOW — the rig the app drives, beside the tape it cuts
// and reads (`replay.ts`). The split is `ghost.ts` / `ghost-run.ts`'s: one
// module says what a recording IS, this one says when the app arms one,
// stands one up and takes it down. Everything it needs from the app is handed
// in — the renderer's two camera calls, the surface, and the one call that
// makes a rebuilt race the app's own.
//
// WHAT HAPPENS WHEN A RECORDING IS STOOD UP, in order: the tape is CUT where
// the run stands (never sealed, so a race nobody finished is as watchable as
// one that was); the race is rebuilt from what was read off it at its first
// step; the app ADOPTS it — from then on the engine state the loop holds is
// the recording's and the input it is stepped on comes off the tape, and the
// run that was being ridden is over. A fresh state is also what tells the
// renderer to clear the trail map, so every furrow in a replay is stamped
// again by the replay itself, from empty.
//
// THEN, ONCE A FRAME, one question is asked of the director and two answers
// come back (`replay-shots.ts`): which moment holds the frame — which the
// renderer is told, on the broadcast rung — and how fast the picture runs,
// which the app's accumulator is told. Slow motion is fewer steps per frame
// and nothing else.
//
// THE WATCHING LADDER is the run's own camera ladder with the broadcast at
// its head (`WATCHING_CAMERAS`): a replay opens on `tv`, and the camera key
// walks the rest of the rungs and back. Between two moments the broadcast IS
// the chase boom — a broadcast does not leave a skier on a tripod for a whole
// race. DOM-free: the renderer is reached through `renderer-api.ts` alone.

import type { GameMode, GameState, SkierInput } from "@engine";

import type { CameraRung, WorldRenderer } from "./renderer-api.ts";
import { createReplayRig, type Replay, type ReplayBill } from "./replay.ts";
import { RUN_CAMERAS } from "./settings.ts";
import { hudOver, watching, type Shell } from "./shell.ts";

/** A rung a recording may be watched from: the broadcast, or any rung a
 * skier could ride from. */
export type WatchRung = "tv" | CameraRung;

/** The ladder a RECORDING is watched on: the run's own, opened on the
 * broadcast. Stated beside the play ladder so the two never come apart. */
export const WATCHING_CAMERAS: readonly WatchRung[] = ["tv", ...RUN_CAMERAS];

/** What the bar over a recording draws, bar the way out (the app's). */
export type ReplayBarFacts = {
  bill: ReplayBill;
  through: number;
  slow: boolean;
  rung: WatchRung;
};

export type ReplayRunWorld = {
  renderer: Pick<WorldRenderer, "setCamera" | "setShot">;
  /** Make a rebuilt race the app's own engine state. */
  adopt: (state: GameState) => void;
  shell: () => Shell;
};

export type ReplayRun = {
  /** Arm a run before its first step: `mode` for a run the player is about
   * to ride, null for anything else. The recording being watched is never
   * re-armed by its own adoption. */
  arm: (state: GameState, mode: GameMode | null) => void;
  /** One step of the engine, AFTER it was taken. */
  step: (driven: SkierInput, state: GameState) => void;
  /** The controls this step is ridden on, or null where nobody is watching. */
  input: () => SkierInput | null;
  /** Once a frame, before anything is stepped: the renderer told which
   * moment holds the frame, and the rate the picture runs at returned. */
  frame: () => number;
  /** Whether the recording being watched has run out. */
  over: () => boolean;
  /** Whether there is a recording worth OFFERING, over a surface that may
   * offer one: a run, or the card that holds one. */
  offers: () => boolean;
  /** Stand the recording up and adopt it. False where there is nothing to
   * watch or the rebuild is not the same race — a press that does nothing. */
  watch: () => boolean;
  /** One rung along the watching ladder. */
  camera: () => void;
  /** Take the recording off the snow and forget it. Safe when nothing is
   * being watched — every way out of a run calls it. */
  clear: () => void;
  /** What the bar draws; null where nothing is being watched. */
  bar: () => ReplayBarFacts | null;
};

export function createReplayRun(world: ReplayRunWorld): ReplayRun {
  const rig = createReplayRig();
  let watched: Replay | null = null;
  let rung: WatchRung = "tv";
  let rate = 1;

  return {
    arm: (state, mode) => {
      if (watched && state === watched.state) return;
      rig.arm(state, mode);
    },
    step: (driven, state) => rig.step(driven, state),
    input: () => watched?.input() ?? null,
    over: () => watched?.over() ?? false,
    offers: () => rig.offers() && hudOver(world.shell()) && !watching(world.shell()),
    frame: () => {
      if (!watched) {
        rate = 1;
        return rate;
      }
      const call = watched.call();
      world.renderer.setCamera(rung === "tv" ? "chase" : rung);
      world.renderer.setShot(rung === "tv" ? call.shot : null);
      rate = call.rate;
      return rate;
    },
    watch: () => {
      const cut = rig.open();
      if (!cut) return false;
      watched = cut;
      rung = "tv";
      rate = 1;
      world.adopt(cut.state);
      return true;
    },
    camera: () => {
      const at = WATCHING_CAMERAS.indexOf(rung);
      rung = WATCHING_CAMERAS[(at + 1) % WATCHING_CAMERAS.length];
    },
    clear: () => {
      watched = null;
      rate = 1;
      rig.clear();
      world.renderer.setShot(null);
    },
    bar: () =>
      watched && { bill: watched.bill, through: watched.through(), slow: rate < 0.999, rung },
  };
}
