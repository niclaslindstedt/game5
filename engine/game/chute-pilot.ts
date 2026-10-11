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
//     piste — in the PATTERN a canopy pilot flies: held in gentle turns
//     over a point beside the spot and past it while high, then the
//     DOWNWIND leg beside the spot, BASE across, and FINAL straight in —
//     along the strip into the wind, or down the fall line onto a piste
//     (he lands on his skis and skis on) — and the flare a few metres up.
//     Cut away, it pulls the reserve at once and flies it the same way.
//
// Pure over the state: nothing here moves anything.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { nearestTrackPoint } from "../mapgen/query.ts";
import type { Level } from "../mapgen/types.ts";
import { airstripOf } from "./airstrip.ts";
import { AIR_BOUNDS } from "./defs/air-bounds.ts";
import { CHUTE, exitClear } from "./defs/chute.ts";
import { jumpSpotOf, planeInput } from "./plane-pilot.ts";
import { NEUTRAL_INPUT, type GameState, type SkierInput } from "./state.ts";

const B = CHUTE.bot;

/** Where the canopy is flown to: the strip's middle where the glide reaches
 * it from here (or he is over it already), else the nearest point of the
 * piste. */
export function landingSpotOf(state: GameState): { x: number; z: number; y: number } {
  const level = state.level;
  const c = state.skier;
  const strip = airstripOf(level);
  const over = c.y - strip.y;
  if (hypot(strip.x - c.x, strip.z - c.z) < Math.max(over * B.glide, B.near)) {
    return { x: strip.x, z: strip.z, y: strip.y };
  }
  const hit = nearestTrackPoint(level, c.x, c.z);
  return { x: hit.x, z: hit.z, y: level.groundAt(hit.x, hit.z) };
}

const NORMAL = { x: 0, y: 1, z: 0 };

/** The heading the final is flown on to `spot`: along the strip the way
 * the plane lands on it; elsewhere down the fall line. */
function finalHeading(state: GameState, spot: { x: number; z: number }): number {
  const level: Level = state.level;
  const strip = airstripOf(level);
  if (spot.x === strip.x && spot.z === strip.z) return strip.land.heading;
  level.normalAt(spot.x, spot.z, NORMAL);
  return hypot(NORMAL.x, NORMAL.z) < 1e-3 ? 0 : Math.atan2(NORMAL.x, NORMAL.z);
}

type Point = { x: number; z: number };

/** THE PATTERN to `spot`: the final's heading, the side the pattern is
 * flown on and the points its legs are flown at — the final's start, the
 * base turn, and the downwind leg's start beside the spot and past it.
 * The final the spot asks for (`finalHeading`) unless that pattern would
 * not fit inside the map (whose edge blows a canopy back in), then one
 * square to it, on the side of the final nearer the map's middle. */
function patternOf(
  state: GameState,
  spot: Point,
): { h: number; side: number; turnFinal: Point; turnBase: Point; join: Point } {
  const size = state.level.size;
  const keep = AIR_BOUNDS.chute * 2.5;
  const leg = (bh: number, top: number): number => (top - bh) * B.glide;
  const finalLen = leg(0, B.final);
  const baseLen = leg(B.final, B.base) * 0.6;
  const downLen = leg(B.base, B.downwind);
  const first = finalHeading(state, spot);
  let best = null as ReturnType<typeof patternOf> | null;
  let worst = Infinity;
  for (const h of [first, first + Math.PI / 2, first - Math.PI / 2]) {
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const mid = (spot.x - size / 2) * -fz + (spot.z - size / 2) * fx;
    const side = mid > 0 ? -1 : 1;
    const rx = -fz * side;
    const rz = fx * side;
    const at = (along: number, across: number): Point => ({
      x: spot.x + fx * along + rx * across,
      z: spot.z + fz * along + rz * across,
    });
    const p = {
      h,
      side,
      turnFinal: at(-finalLen, 0),
      turnBase: at(-finalLen, baseLen),
      join: at(downLen - finalLen, baseLen),
    };
    // How far the pattern pokes out past the band kept clear of the edge.
    let out = 0;
    for (const q of [p.turnFinal, p.turnBase, p.join]) {
      for (const v of [q.x, q.z]) out = Math.max(out, keep - v, v - (size - keep));
    }
    if (out <= 0) return p;
    if (out < worst) {
      worst = out;
      best = p;
    }
  }
  const inside = (q: Point): Point => ({
    x: clamp(q.x, keep, size - keep),
    z: clamp(q.z, keep, size - keep),
  });
  const p = best!;
  return {
    ...p,
    turnFinal: inside(p.turnFinal),
    turnBase: inside(p.turnBase),
    join: inside(p.join),
  };
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
    const out = ch.since >= exitClear(ch.from);
    const pull = (out && ch.agl <= B.deck) || (ch.since >= B.least && ch.agl <= B.open);
    return { ...NEUTRAL_INPUT, machine: pull };
  }
  // Cut away (never by its own hand, but a lab's or a player's handed
  // over): the reserve pulled at once while there is height for it.
  if (ch.mode === "released" && !ch.reserve) {
    return { ...NEUTRAL_INPUT, machine: ch.agl > CHUTE.handover };
  }
  if (ch.mode !== "open") return { ...NEUTRAL_INPUT };
  const c = state.skier;
  const spot = landingSpotOf(state);
  const { h, side, turnFinal, turnBase, join } = patternOf(state, spot);
  // The legs by his height over the spot (the snow under him falls away
  // on a mountain; the spot's height is what the pattern is flown to).
  const over = c.y - c.spec.cogHeight - spot.y;
  let aim: { x: number; z: number } = spot;
  if (over > B.downwind) aim = join;
  else if (over > B.base) aim = turnBase;
  else if (over > B.final) aim = turnFinal;
  let want = Math.atan2(aim.x - c.x, aim.z - c.z);
  // HOLDING over the downwind leg's start while high: a gentle turn round
  // it, never a spiral down.
  const holding = over > B.downwind && hypot(aim.x - c.x, aim.z - c.z) < B.hold;
  if (holding) want = ch.canopyHeading + side * 0.6;
  // On final, held near the final's line; the last of it wings level.
  if (over <= B.final) want = h + clamp(angleDiff(h, want), -0.5, 0.5);
  const steer =
    ch.agl > B.flare * 4 ? clamp(1.2 * angleDiff(ch.canopyHeading, want), -B.steer, B.steer) : 0;
  const brake = clamp((B.flare - ch.agl) / (B.flare - B.flared), 0, 1);
  return { ...NEUTRAL_INPUT, steer, brake };
}
