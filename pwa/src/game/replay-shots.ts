// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HIGHLIGHTS — the moments in a run worth leaving the chase boom for,
// and the director that cuts to them while the recording plays back.
//
// A LIVE CAMERA CANNOT DO THIS AND A REPLAY'S CAN, which is the whole reason
// the TV camera is replay-only (`camera-tv.ts`). A broadcast cuts to the
// lens in the trees beside a kicker BEFORE the jump, because the shot is the
// skier arriving into a frame that is already standing there waiting for
// him — and a camera watching a run for the first time has no way of knowing
// a jump is coming. A replay does: the run already happened. So the moments
// are written down AS THEY HAPPEN, by the run itself, and the recording is
// watched by a director who has the list in his hand from the first frame.
//
// IT IS THE PAST, BACK-DATED. What makes a flight worth watching is how long
// it stayed up, and that is not known until the skis are back on the snow —
// so the collector remembers where the skis last stood on the snow, waits
// for the landing, and files the shot at the TAKE-OFF's own step. The cut
// can therefore land a second and a half before a lip the skier had not
// reached yet.
//
// WHAT EARNS ONE. The list is short on purpose: a shot is an interruption,
// and an interruption every few seconds is the programme.
//
//   air      a flight off a kicker or a crest that stayed up (`air`/`land`),
//            weighted up for every trick turned in it (`trick`, `tricks.ts`).
//   pass     a place taken off the field (`racePlace` improving, and holding).
//   bump     another skis met at speed (`bump`).
//   hit      a trunk met at speed (`hit`).
//   wipeout  the skier thrown off (`wipeout`).
//   finish   the flag (`finish`) — always worth the arch's lens.
//
// AND THE SLOW MOTION, the other thing only a replay may have. It is part of
// the shot rather than a setting, runs over the thing worth watching, and
// ramps in before and out after so the picture never visibly changes gear.
// It is FEWER STEPS PER FRAME and nothing else: the engine's step never
// changes size, so a third-speed jump is the same physics at a third of the
// rate, every furrow and every sound with it.
//
// Three-free and DOM-free: this decides WHICH moment and WHEN,
// `camera-tv.ts` decides where the lens stands, and `tests/replay_test.ts`
// holds both without a browser.

import { racePlace, TUNING, type GameState } from "@engine";

/** What a shot is OF. The word the bar prints is `strings.ts`'s (§39.1). */
export type ShotKind = "air" | "pass" | "bump" | "hit" | "wipeout" | "finish";

/** ONE MOMENT WORTH A CAMERA, as the run wrote it down. Steps rather than
 * seconds: a step is the one clock a replay and its run cannot disagree on.
 * A step here counts the steps TAKEN — step `n` is the state after the
 * `n + 1`-th call of `step`, which is the index the tape writes it under. */
export type ReplayShot = {
  kind: ShotKind;
  /** The step the shot is ABOUT — the take-off, the contact, the flag. The
   * cut lands `SHOTS.lead` seconds before it. */
  at: number;
  /** How long the thing worth watching runs for, steps. */
  runs: number;
  /** How special it was, 0..1, comparable ACROSS the kinds. */
  weight: number;
  /** Where the skis was at `at`, and how it was going — the lens is planted
   * off this before the skis has got anywhere near it. */
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
};

/** THE WHOLE DIRECTOR, as numbers. Seconds, metres per second and steps. */
export const SHOTS = {
  /** The shortest flight worth a camera, s: under it a skis is skipping over
   * a mogul, which is not an event. */
  airLeast: 0.5,
  /** ...and the flight a full-weight air shot is measured against, s — about
   * what a big kicker at race pace buys. */
  airBig: 1.8,
  /** A trunk or a rival met at under this closing speed is a brush, m/s;
   * at `contactHard` it is worth the top of the scale. */
  contactLeast: 4,
  contactHard: 14,
  /** What each trick turned in a flight adds to its weight — a flip off a
   * small lip outranks a long plain jump. */
  trick: 0.35,
  /** What a wipeout, a pass and the flag are worth. The flag is worth the
   * whole scale: it is the one moment every replay has and ends on. */
  wipeout: 0.7,
  pass: 0.45,
  finish: 1,
  /** A place taken has to HOLD this long before it is a pass, s — two skis
   * side by side swap places a dozen times a second. */
  passHold: 1,
  /** The beat a contact, a pass or the flag is given, s. */
  beat: 0.8,
  /** The MOST of any moment framed and run slow, s. */
  longest: 3.5,
  /** How far before the beat the cut lands, s. The skis has to come out of
   * the trees and arrive; anything shorter is a lens it is past before the
   * shot has read. */
  lead: 1.6,
  /** ...and how long the lens holds on after, s. */
  hold: 1.1,
  /** The floor on weight: a moment under it keeps the boom. */
  least: 0.25,
  /** How long the boom keeps to itself between two shots, s of the
   * recording's own clock. */
  rest: 4,
  /** The most shots one replay carries. */
  most: 16,
} as const;

/** THE SLOW MOTION. */
export const SLOW = {
  /** How slowly the picture runs at the bottom of the ramp, share of real
   * time — a third is where a flight reads as an arc rather than a blur. */
  rate: 0.34,
  /** The ramp down and back up, s. Out is longer: coming out of slow motion
   * is the picture handing the run back, and a jump back to speed reads as
   * a dropped frame. */
  in: 0.45,
  out: 0.7,
} as const;

const HZ = TUNING.physicsHz;

function steps(s: number): number {
  return Math.round(s * HZ);
}

/** Where a shot's window opens and closes, steps — the cut and the
 * hand-back. Stated once: the plan's spacing, the director and the tests
 * all ask it. */
export function shotWindow(shot: ReplayShot): { from: number; until: number } {
  return {
    from: Math.max(0, shot.at - steps(SHOTS.lead)),
    until: shot.at + shot.runs + steps(SHOTS.hold),
  };
}

export type ShotCollector = {
  /** One step of the PLAYER's run, after it was taken, as step `at`. */
  step: (state: GameState, at: number) => void;
  /** Everything worth watching so far, ranked and spaced (`planShots`);
   * callable mid-run, which is what the pause card's offer is built on. */
  plan: () => ReplayShot[];
};

type Pose = Omit<ReplayShot, "kind" | "runs" | "weight">;

function poseInto(out: Pose, state: GameState, at: number): Pose {
  const s = state.skier;
  out.at = at;
  out.x = s.x;
  out.y = s.y;
  out.z = s.z;
  out.heading = s.heading;
  out.speed = s.speed;
  return out;
}

const emptyPose = (): Pose => ({ at: 0, x: 0, y: 0, z: 0, heading: 0, speed: 0 });

/** Watch a run and write down what was worth a camera. */
export function createShotCollector(): ShotCollector {
  const found: ReplayShot[] = [];
  /** Where the skis last stood on the snow — the take-off, once it is in
   * the air. Reused: this runs 120 times a second. */
  const ground = emptyPose();
  let flight: Pose | null = null;
  /** Tricks turned in the flight that is up (`trick`, bar the air's rung). */
  let turned = 0;
  /** The place held, and a better one waiting to have held long enough. */
  let place = 0;
  let pending: { place: number; pose: Pose } | null = null;

  const push = (kind: ShotKind, pose: Pose, runs: number, weight: number): void => {
    found.push({ kind, ...pose, runs, weight });
  };

  return {
    plan: () => planShots(found),
    step: (state, at) => {
      // The tricks first: a revolution the touchdown finished is won on the
      // landing's own step, after its `land`.
      for (const e of state.events)
        if (e.kind === "trick" && e.trick !== "air" && e.trick !== "landing") turned += 1;
      for (const e of state.events) {
        switch (e.kind) {
          case "air":
            flight = { ...ground };
            turned = 0;
            break;
          case "land": {
            const open = flight;
            flight = null;
            if (!open || e.airTime < SHOTS.airLeast) break;
            push(
              "air",
              open,
              Math.min(steps(SHOTS.longest), Math.max(1, at - open.at)),
              Math.min(1, e.airTime / SHOTS.airBig + turned * SHOTS.trick),
            );
            turned = 0;
            break;
          }
          case "hit":
          case "bump":
            if (e.speed < SHOTS.contactLeast) break;
            push(
              e.kind,
              poseInto(emptyPose(), state, at),
              steps(SHOTS.beat),
              Math.min(1, e.speed / SHOTS.contactHard),
            );
            break;
          case "wipeout":
            flight = null;
            push("wipeout", poseInto(emptyPose(), state, at), steps(SHOTS.beat), SHOTS.wipeout);
            break;
          case "finish":
            push("finish", poseInto(emptyPose(), state, at), steps(SHOTS.beat), SHOTS.finish);
            break;
          default:
            break;
        }
      }
      if (!state.skier.airborne) poseInto(ground, state, at);
      // THE PASS: a better place, held. Read only while the race is on —
      // the start line's own order under the lights is not an overtake.
      if (state.rivals.length === 0 || state.phase !== "racing") return;
      const now = racePlace(state);
      if (place === 0) place = now;
      // A place LOST is simply the new place held, so winning it back is a
      // pass like any other.
      if (now >= place) {
        pending = null;
        place = now;
        return;
      }
      if (!pending || pending.place !== now) {
        pending = { place: now, pose: poseInto(emptyPose(), state, at) };
      } else if (at - pending.pose.at >= steps(SHOTS.passHold)) {
        push("pass", pending.pose, steps(SHOTS.beat), SHOTS.pass);
        place = now;
        pending = null;
      }
    },
  };
}

/** THE RUNNING ORDER: what actually gets cut to, out of everything that
 * earned a mark. Ranked by weight and THEN spaced: a pass down the run in
 * order keeps the first of a crowded pair, which on a rhythm of kickers is
 * reliably the small one; strongest-first keeps the big one. */
export function planShots(found: readonly ReplayShot[]): ReplayShot[] {
  const rest = steps(SHOTS.rest);
  const kept: ReplayShot[] = [];
  const ranked = found
    .filter((shot) => shot.weight >= SHOTS.least)
    .sort((a, b) => b.weight - a.weight || a.at - b.at);
  for (const shot of ranked) {
    if (kept.length >= SHOTS.most) break;
    const { from, until } = shotWindow(shot);
    const crowds = kept.some((held) => {
      const w = shotWindow(held);
      return from < w.until + rest && w.from < until + rest;
    });
    if (!crowds) kept.push(shot);
  }
  return kept.sort((a, b) => a.at - b.at);
}

/** What the director has decided for a step: the shot holding the frame, or
 * null for the boom, and how fast the picture runs. */
export type ShotCall = { shot: ReplayShot | null; rate: number };

/** THE DIRECTOR — a pure function of how far into the recording the picture
 * has got, so the whole edit is known before the first frame. */
export function directAt(plan: readonly ReplayShot[], step: number): ShotCall {
  for (const shot of plan) {
    const { from, until } = shotWindow(shot);
    if (step < from) break;
    if (step > until) continue;
    return { shot, rate: rateFor(shot, step) };
  }
  return { shot: null, rate: 1 };
}

/** Full rate outside the thing worth watching, `SLOW.rate` over it, and an
 * ease at either end. */
function rateFor(shot: ReplayShot, step: number): number {
  const into = steps(SLOW.in);
  const outOf = steps(SLOW.out);
  const opens = shot.at - into;
  const closes = shot.at + shot.runs;
  if (step <= opens || step >= closes + outOf) return 1;
  if (step >= shot.at && step <= closes) return SLOW.rate;
  const share =
    step < shot.at ? (step - opens) / Math.max(1, into) : 1 - (step - closes) / Math.max(1, outOf);
  return 1 + (SLOW.rate - 1) * ease(share);
}

/** Smoothstep — the ramp has no corner at either end. */
function ease(t: number): number {
  const s = t < 0 ? 0 : t > 1 ? 1 : t;
  return s * s * (3 - 2 * s);
}
