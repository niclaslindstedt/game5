// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT'S HANDS ON THE SKYDIVE (`chute.ts`) — what a lab, a test and a
// pre-roll jump and fly on: the skier's own input, as the player's is.
//
//   * `skydiveInput`: in the plane's door it flies the plane to the jump run
//     (`plane-pilot.ts`'s `planeInput`) and, once it is round the jump run
//     at its height, JUMPS — the one hand that ever leaves the door; then
//     `chutePilot`. The sim's and the app's bot (`sim/bot.ts`) never jump
//     from the door: a pre-roll in the door stays in it, the ride the
//     player's to begin. Once he is out, the bot flies the skydive.
//   * `chutePilot`: belly to earth in freefall, the pull at a sport jumper's
//     1,000 m over the snow (and once clear of the plane at once under a
//     hard deck, for a jump run lower than that), then the canopy flown to
//     open snow — the strip, where its glide reaches it, else the nearest
//     piste — losing height in turns while it is too high, the last of it
//     straight in, and the flare a few metres up.
//
// Pure over the state: nothing here moves anything.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { nearestTrackPoint } from "../mapgen/query.ts";
import { airstripOf } from "./airstrip.ts";
import { CHUTE } from "./defs/chute.ts";
import { jumpSpotOf, planeInput } from "./plane-pilot.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "./state.ts";

const B = CHUTE.bot;

/** Where the canopy is flown to: the strip's middle where the glide reaches
 * it from here, else the nearest point of the piste. */
export function landingSpotOf(state: GameState): { x: number; z: number; y: number } {
  const level = state.level;
  const c = state.skier;
  const strip = airstripOf(level);
  const over = c.y - strip.y;
  if (hypot(strip.x - c.x, strip.z - c.z) < over * B.glide) {
    return { x: strip.x, z: strip.z, y: strip.y };
  }
  const hit = nearestTrackPoint(level, c.x, c.z);
  return { x: hit.x, z: hit.z, y: level.groundAt(hit.x, hit.z) };
}

/** Whether the plane he crouches in is round its jump run at its height. */
function onJumpRun(state: GameState): boolean {
  const p = state.plane;
  if (!p || !p.rider || p.mode !== "flown" || p.grounded) return false;
  const spot = jumpSpotOf(state);
  return hypot(spot.x - p.x, spot.z - p.z) < 900 && p.y > spot.y - 80;
}

/** THE WHOLE JUMP on the bot's hands: the plane to the jump run, out of
 * the door, the skydive. */
export function skydiveInput(state: GameState): SkierInput {
  if (state.plane?.rider) {
    if (onJumpRun(state)) return { ...planeInput(state), machine: true };
    return planeInput(state);
  }
  return chutePilot(state);
}

/** THE BOT'S HANDS on the skydive this step. */
export function chutePilot(state: GameState): SkierInput {
  const ch = state.chute;
  if (!ch || ch.done || state.skier.thrown) return { ...NEUTRAL_INPUT };
  if (ch.mode === "exit" || ch.mode === "freefall") {
    const out = ch.since >= CHUTE.exit.clear;
    const pull = (out && ch.agl <= B.deck) || (ch.since >= B.least && ch.agl <= B.open);
    return { ...NEUTRAL_INPUT, machine: pull };
  }
  if (ch.mode !== "open") return { ...NEUTRAL_INPUT };
  const c = state.skier;
  const spot = landingSpotOf(state);
  const d = hypot(spot.x - c.x, spot.z - c.z);
  const over = c.y - c.spec.cogHeight - spot.y;
  const toward = Math.atan2(spot.x - c.x, spot.z - c.z);
  // Too high for the way left: round in turns until the glide is right.
  const excess = over - d / B.glide;
  let want = toward;
  if (ch.agl > B.final && excess > 60) want = ch.canopyHeading + 0.9;
  // The last of it straight on, wings level.
  const steer = ch.agl > B.final ? clamp(1.4 * angleDiff(ch.canopyHeading, want), -1, 1) : 0;
  const brake = clamp((B.flare - ch.agl) / (B.flare - B.flared), 0, 1);
  return { ...NEUTRAL_INPUT, steer, brake };
}
