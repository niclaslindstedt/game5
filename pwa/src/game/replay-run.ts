// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RECORDING ON THE SNOW — the rig the app drives, beside the tape it cuts
// and reads (`replay.ts`). The split is `ghost.ts` / `ghost-run.ts`'s: one
// module says what a recording IS, this one says when the app arms one,
// stands one up, plays it like a player plays a tape, and hands the run back.
// Everything it needs from the app is handed in — the renderer's two camera
// calls, the surface, and the one call that puts a state on screen.
//
// WHAT HAPPENS WHEN A RECORDING IS WATCHED, in order: the tape is CUT where
// the run stands (never sealed, so a run nobody finished is as watchable as
// one that was); a copy of the run is stood up from the recording's keyframes
// on its first step — or ten seconds before the crash just taken — and put
// on screen; the RUN ITSELF is set aside untouched with the surface it was
// watched from, and handed back to that surface when the recording is left
// (`leave`). A fresh state is also what tells the renderer to clear the trail
// map, so every furrow in a replay is stamped again by the replay itself.
//
// THE TRANSPORT is a video player's, because that is the instrument every
// player already knows: PLAY and PAUSE (and the end of the tape pauses, never
// leaves), a SCRUBBER with the run's moments marked along it, BACK and
// FORWARD five seconds, a FRAME at a time while paused, and four SPEEDS — save
// that an INSTANT REPLAY of a crash, played to its end untouched, hands the run
// back a beat later (`TRANSPORT.handBack`), as a broadcast cuts back live. A
// seek is a keyframe stood up and stepped forward to the mark; the stepping
// is paid out over frames (`SEEK_BUDGET_MS`) rather than in one, so a long
// way back holds the picture for a moment rather than the tab.
//
// THEN, ONCE A FRAME, one question is asked of the director and two answers
// come back (`replay-shots.ts`): which moment holds the frame — which the
// renderer is told, on the broadcast — and how fast the picture runs, which
// the app's accumulator is told, times the player's own speed, on every one
// of the replay's own lenses. Slow motion is fewer steps per frame and
// nothing else.
//
// THE WATCHING LADDER is the replay's own lenses (`camera-replay.ts`: the
// broadcast, which directs, then CLOSE, SIDE, FRONT and AERIAL) and the
// skier's own eye last (`WATCHING_CAMERAS`): a replay opens on the
// broadcast, and the camera key walks the rest and back. DOM-free: the
// renderer is reached through `renderer-api.ts` alone.

import { TUNING, type GameMode, type GameState, type SkierInput } from "@engine";

import { isReplayAngle, REPLAY_ANGLES, type ReplayAngle } from "./camera-replay.ts";
import type { CameraRung, WorldRenderer } from "./renderer-api.ts";
import { createReplayRig, type Replay, type ReplayBill, type ReplayFrom } from "./replay.ts";
import type { ShotKind } from "./replay-shots.ts";
import { hudOver, watching, type Shell } from "./shell.ts";

const HZ = TUNING.physicsHz;

/** A rung a recording may be watched from: one of the replay's own lenses,
 * or a rung a skier could ride from. */
export type WatchRung = ReplayAngle | CameraRung;

/** The ladder a RECORDING is watched on: the replay's own lenses, opened on
 * the broadcast, and the skier's own eye — the one rung of the ride's
 * ladder a replay has a reason to offer. */
export const WATCHING_CAMERAS: readonly WatchRung[] = [...REPLAY_ANGLES, "helmet"];

/** The speeds a recording plays at, share of real time. */
export const REPLAY_SPEEDS = [0.25, 0.5, 1, 2] as const;

/** THE TRANSPORT'S NUMBERS. */
export const TRANSPORT = {
  /** Back and forward, s. */
  skip: 5,
  /** One FRAME at a time while paused, s — a thirtieth, which is a frame
   * of broadcast video and a few steps of the engine. */
  frame: 1 / 30,
  /** Milliseconds of each frame a seek may spend stepping. */
  budgetMs: 12,
  /** How long the end of an instant replay holds before the run is handed
   * back, s. */
  handBack: 1.5,
} as const;

/** One mark along the scrubber: where, and what. */
export type ReplayMark = { at: number; kind: ShotKind };

/** What the bar over a recording draws, bar the presses (the app's). All
 * steps are steps of the recording, `first` to `end`. */
export type ReplayBarFacts = {
  bill: ReplayBill;
  first: number;
  end: number;
  at: number;
  playing: boolean;
  speed: number;
  /** The director has the picture in slow motion. */
  slow: boolean;
  /** A seek is still stepping toward its mark. */
  seeking: boolean;
  rung: WatchRung;
  marks: readonly ReplayMark[];
  /** The crash the recording was opened on, or null. */
  moment: number | null;
  /** Where the recording was watched from, so the bar can say where its
   * way out goes. */
  back: Shell;
};

export type ReplayRunWorld = {
  renderer: Pick<WorldRenderer, "setCamera" | "setReplayCam">;
  /** Put a state on screen as the engine state the loop steps — the
   * recording, or the run handed back. Never re-arms anything. */
  show: (state: GameState) => void;
  shell: () => Shell;
  /** Leave the recording the way the bar's way out does: an instant replay
   * played to its end. */
  done?: () => void;
};

/** Where the app goes when a recording is left: the run as it was set
 * aside, and the surface it was watched from. */
export type ReplayExit = { state: GameState; back: Shell };

export type ReplayRun = {
  /** Arm a run before its first step: `mode` for a run the player is about
   * to ride, null for anything else. */
  arm: (state: GameState, mode: GameMode | null) => void;
  /** One step of the engine, AFTER it was taken. */
  step: (driven: SkierInput, state: GameState) => void;
  /** The controls this step is ridden on, or null where nobody is watching. */
  input: () => SkierInput | null;
  /** Once a frame, before anything is stepped: a seek paid on, the renderer
   * told which moment holds the frame, and the rate the picture runs at
   * returned — 0 while paused or seeking. */
  frame: () => number;
  /** At most the steps left on the tape: a recording is never stepped past
   * its own end. */
  cap: (steps: number) => number;
  /** Whether there is a recording worth OFFERING over this surface. */
  offers: () => boolean;
  /** Whether the crash just taken is worth an instant replay now. */
  crash: () => boolean;
  /** Stand the recording up — from its start, the crash just taken or the
   * last few seconds (`ReplayFrom`) —
   * setting `live` aside to be handed back to `back`. False where there is
   * nothing to watch. */
  watch: (from: ReplayFrom, live: GameState, back: Shell) => boolean;
  /** Leave the recording: what to hand back to, or null where nothing was
   * being watched. */
  leave: () => ReplayExit | null;
  /** Play or pause; at the end of the tape, play it again from the start. */
  toggle: () => void;
  /** Go to step `to` of the recording, playing on as it was. */
  seek: (to: number) => void;
  /** Back or forward `seconds`. */
  skip: (seconds: number) => void;
  /** One frame back or forward, paused. */
  frameStep: (dir: -1 | 1) => void;
  /** One speed slower or faster; `cycle` walks up and wraps from the
   * fastest back to the slowest (the speed chip's press). */
  faster: (dir: -1 | 1 | "cycle") => void;
  /** One rung along the watching ladder. */
  camera: () => void;
  /** Take the recording off the snow and forget the run's tape. Safe when
   * nothing is being watched — every way out of a run calls it. */
  clear: () => void;
  /** What the bar draws; null where nothing is being watched. */
  bar: () => ReplayBarFacts | null;
};

type Watched = {
  replay: Replay;
  live: GameState;
  back: Shell;
  shown: GameState;
  marks: ReplayMark[];
};

export function createReplayRun(world: ReplayRunWorld): ReplayRun {
  const rig = createReplayRig();
  let watched: Watched | null = null;
  let rung: WatchRung = "tv";
  let rate = 1;
  let playing = true;
  let speed = 1;
  /** When an instant replay ran off its end playing, ms — the hand-back's
   * clock — or null. */
  let ended: number | null = null;

  /** A seek stands a new state up: put it on screen in the old one's place. */
  const showNew = (w: Watched): void => {
    if (w.replay.state === w.shown) return;
    w.shown = w.replay.state;
    world.show(w.shown);
  };
  const seek = (to: number): void => {
    if (!watched) return;
    ended = null;
    watched.replay.seek(to);
    showNew(watched);
  };

  return {
    arm: (state, mode) => {
      if (watched && state === watched.shown) return;
      rig.arm(state, mode);
    },
    step: (driven, state) => rig.step(driven, state),
    input: () => watched?.replay.input() ?? null,
    cap: (steps) =>
      watched ? Math.max(0, Math.min(steps, watched.replay.end - watched.replay.at())) : steps,
    offers: () => rig.offers() && hudOver(world.shell()) && !watching(world.shell()),
    crash: () => rig.crash() !== null && world.shell() === "run",
    frame: () => {
      if (!watched) {
        rate = 1;
        return rate;
      }
      const { replay } = watched;
      if (replay.seeking() !== null) {
        const until = performance.now() + TRANSPORT.budgetMs;
        replay.pump(() => performance.now() < until);
      }
      if (replay.over()) {
        if (playing && replay.moment !== null) ended ??= performance.now();
        playing = false;
      }
      if (ended !== null && performance.now() - ended >= TRANSPORT.handBack * 1000) {
        ended = null;
        world.done?.();
        if (!watched) return (rate = 1);
      }
      const call = replay.call();
      const own = isReplayAngle(rung) ? rung : null;
      world.renderer.setCamera(own ? "chase" : (rung as CameraRung));
      world.renderer.setReplayCam(own && { angle: own, shot: own === "tv" ? call.shot : null });
      const director = own ? call.rate : 1;
      rate = playing && replay.seeking() === null ? speed * director : 0;
      return rate;
    },
    watch: (from, live, back) => {
      const replay = rig.open(from);
      if (!replay) return false;
      const marks = replay.plan.map((s) => ({ at: s.at, kind: s.kind }));
      watched = { replay, live, back, shown: replay.state, marks };
      rung = "tv";
      rate = 1;
      ended = null;
      playing = true;
      speed = 1;
      world.show(replay.state);
      return true;
    },
    leave: () => {
      const w = watched;
      watched = null;
      ended = null;
      rate = 1;
      world.renderer.setReplayCam(null);
      return w && { state: w.live, back: w.back };
    },
    toggle: () => {
      if (!watched) return;
      ended = null;
      if (watched.replay.over()) {
        seek(watched.replay.first);
        playing = true;
        return;
      }
      playing = !playing;
    },
    seek,
    skip: (seconds) => {
      if (watched) seek(watched.replay.at() + Math.round(seconds * HZ));
    },
    frameStep: (dir) => {
      if (!watched) return;
      playing = false;
      seek(watched.replay.at() + dir * Math.max(1, Math.round(TRANSPORT.frame * HZ)));
    },
    faster: (dir) => {
      const at = REPLAY_SPEEDS.indexOf(speed as (typeof REPLAY_SPEEDS)[number]);
      const n = REPLAY_SPEEDS.length;
      speed =
        dir === "cycle"
          ? REPLAY_SPEEDS[(at + 1) % n]
          : REPLAY_SPEEDS[Math.min(n - 1, Math.max(0, at + dir))];
    },
    camera: () => {
      const at = WATCHING_CAMERAS.indexOf(rung);
      rung = WATCHING_CAMERAS[(at + 1) % WATCHING_CAMERAS.length];
    },
    clear: () => {
      watched = null;
      ended = null;
      rate = 1;
      rig.clear();
      world.renderer.setReplayCam(null);
    },
    bar: () => {
      if (!watched) return null;
      const { replay } = watched;
      const target = replay.seeking();
      return {
        bill: replay.bill,
        first: replay.first,
        end: replay.end,
        at: target ?? replay.at(),
        playing: playing && !replay.over(),
        speed,
        slow: isReplayAngle(rung) && replay.call().rate < 0.999,
        seeking: target !== null,
        rung,
        marks: watched.marks,
        moment: replay.moment,
        back: watched.back,
      };
    },
  };
}
