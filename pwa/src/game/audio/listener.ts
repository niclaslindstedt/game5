// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE EAR IS — what each rung of the camera ladder does to the mix.
//
// The picture moves from the ski tips to a crane shot and the sound has to
// move with it, or the high shot is a helmet's ear with a long lens. Every
// number here is a multiplier on one part of the mix, read by the beds
// every frame and by the event router for the one-shots, and the whole
// table is the opinion about what a skier sounds like from each seat:
//
//   * AT THE TIPS (`tips`) the snow is an arm's length away: the bases
//     hissing, the edges tearing, the wind full in the face — and the
//     poles' plants right beside you.
//   * IN THE HELMET (`helmet`) you are the skier: the wind roaring round
//     the helmet, the skis under your boots a little muffled by the boots
//     and the suit, every plant in your own hands.
//   * BEHIND AND ABOVE (`chase`, the seat the game is tuned at) it is all
//     there in proportion: the row of ones — the snow a touch up, because
//     the skis are the end of the skier the camera is at.
//   * STOOD BACK (`far`) and CRANED UP (`high`) the skier is a small thing
//     on a big hill: the wind gone, the edges thin, the one-shots softened
//     by the air between.
//   * THE CARDS' SLOW TURN (`orbit`) is not a seat at all — it is a lens
//     over a race nobody is skiing, so the wind is a thread under a card
//     that is ducked anyway (`shell.ts`'s `soundsLive`).
//
// DOM-free, three-free, so the tests can read it and the audition page can
// switch seats without a renderer.

import type { CameraRung } from "../renderer-api.ts";

export type Listener = {
  /** The skier's own wind: the rush, the tuck's roar, the whistle. */
  wind: number;
  /** How bright the wind is, 0..1: the rush's lowpass is scaled by it. */
  tone: number;
  /** How far a crosswind is heard on the side it comes from, 0..1: all of
   * it with the ear on the skier, none from a lens that circles him. */
  side: number;
  /** The skis on the snow: the hiss, the hush, the edge, the skid. */
  snow: number;
  /** Every one-shot the race makes — the poles' plants among them. */
  events: number;
  /** A pitch multiplier on those one-shots. Below 1 moves every filter down
   * with it: a landing heard from a crane is a duller landing. */
  muffle: number;
};

export const LISTENERS: Record<CameraRung, Listener> = {
  tips: {
    wind: 1.3,
    tone: 1,
    side: 1,
    snow: 1.4,
    events: 1.1,
    muffle: 1,
  },
  helmet: {
    wind: 1.45,
    tone: 0.85,
    side: 1,
    snow: 1.05,
    events: 1,
    muffle: 1,
  },
  chase: {
    wind: 0.85,
    tone: 1,
    side: 1,
    snow: 1.05,
    events: 1,
    muffle: 1,
  },
  far: {
    wind: 0.4,
    tone: 0.9,
    side: 0.6,
    snow: 0.8,
    events: 0.9,
    muffle: 0.95,
  },
  high: {
    wind: 0.2,
    tone: 0.8,
    side: 0.3,
    snow: 0.6,
    events: 0.8,
    muffle: 0.9,
  },
  orbit: {
    wind: 0.12,
    tone: 0.7,
    side: 0,
    snow: 0.5,
    events: 0.6,
    muffle: 0.8,
  },
};

/** The mix for a camera, or the chase view's for anything off the ladder. */
export function listenerFor(view: string | null | undefined): Listener {
  return (view && (LISTENERS as Record<string, Listener>)[view]) || LISTENERS.chase;
}
