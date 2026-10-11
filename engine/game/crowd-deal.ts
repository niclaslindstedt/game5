// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// DEALING ONE AMATEUR (`crowd.ts`' `createCrowd`): his group's kind, the
// body in his kit, his knobs off his kind's bands, whether he rides skis or
// a SNOWBOARD and which foot leads it — all off the crowd's own stream, in
// the order `createCrowd` asks. Nothing here touches `state.rng`.

import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import {
  CROWD,
  CROWD_GROUPS,
  CROWD_KINDS,
  TURN_STYLES,
  type AmateurKnobs,
  type CrowdBody,
  type CrowdKind,
  type GroupKind,
  type TurnStyle,
} from "./defs/crowd.ts";
import type { Amateur } from "./state.ts";

export const band = (rng: Rng, b: readonly [number, number]): number => rng.range(b[0], b[1]);

/** His knobs, dealt from his kind's bands. */
export function dealKnobs(rng: Rng, kind: CrowdKind): AmateurKnobs {
  const k = CROWD_KINDS[kind];
  const style = rng.pick(k.styles);
  return {
    skill: band(rng, k.skill),
    aggression: band(rng, k.aggression),
    offPiste: band(rng, k.offPiste),
    width: band(rng, k.width),
    wobble: band(rng, k.wobble),
    stopper: band(rng, k.stopper),
    jumper: band(rng, k.jumper),
    style,
    turn: band(rng, TURN_STYLES[style].len),
  };
}

/** WHAT A SKIER'S STYLE IS ON A BOARD: nobody wedges a snowboard — the
 * beginner's slow turns are the FALLING LEAF, slipped down on an edge. */
const ON_BOARD: Partial<Record<TurnStyle, TurnStyle>> = { plough: "slip" };

/** Skis or a board, off the crowd's stream: his kind's share weighed by his
 * body (`CROWD.board`), or — in a ski school's snake — whatever his
 * instructor rides (`follow`). A board's knobs are a board's: the
 * beginner's wedge becomes the falling leaf, its turn re-dealt to it. */
export function dealBoard(rng: Rng, a: Amateur, follow?: Amateur["board"]): Amateur["board"] {
  const B = CROWD.board;
  const share = Math.min(B.most, CROWD_KINDS[a.kind].board * B.bodies[a.body]);
  const on = follow !== undefined ? follow !== null : rng.chance(share);
  if (!on) return null;
  const to = ON_BOARD[a.knobs.style];
  if (to) a.knobs = { ...a.knobs, style: to, turn: band(rng, TURN_STYLES[to].len) };
  return rng.chance(B.goofy) ? "goofy" : "regular";
}

export function freshAmateur(
  id: number,
  group: number,
  rank: number,
  kind: CrowdKind,
  body: CrowdBody,
  knobs: AmateurKnobs,
  rng: Rng,
): Amateur {
  return {
    id,
    group,
    rank,
    body,
    kind,
    knobs,
    mode: "ski",
    run: 0,
    s: 0,
    d: 0,
    speed: 0,
    yaw: 0,
    centre: 0,
    phase: rng.range(0, Math.PI * 2),
    wander: 0,
    wanderTo: 0,
    kickerAt: NaN,
    kickerD: 0,
    cap: 0,
    timer: 0,
    think: rng.range(0, CROWD.think),
    airT: 0,
    airH: 0,
    airAt: 0,
    x: 0,
    y: 0,
    z: 0,
    heading: 0,
    vx: 0,
    vz: 0,
    lean: 0,
    crouch: 0.3,
    plough: 0,
    across: 0,
    fall: 0,
    fallSide: 1,
    lift: -1,
    carrier: -1,
    seat: 0,
    tx: 0,
    tz: 0,
    ts: 0,
    // His own place in the stride, off his id rather than the stream: the
    // whole crowd pushes off at once, and at one phase it skates in step.
    pole: id * 0.76393,
    push: 0,
    turnSide: 0,
    turnT: 0,
    turnHeld: 0,
    thrown: null,
    rise: 0,
    board: null,
    sit: 0,
    sitDown: false,
  };
}

/** A group kind, by weight. */
export function pickGroup(rng: Rng): GroupKind {
  const kinds = Object.keys(CROWD_GROUPS) as GroupKind[];
  let total = 0;
  for (const k of kinds) total += CROWD_GROUPS[k].weight;
  let at = rng.next() * total;
  for (const k of kinds) {
    at -= CROWD_GROUPS[k].weight;
    if (at <= 0) return k;
  }
  return "solo";
}

/** The body a member of a group wears: a family's second member is the
 * other parent, and a child is a child. */
export function bodyFor(rng: Rng, kind: CrowdKind, group: GroupKind, rank: number): CrowdBody {
  if (group === "family" && kind !== "kid") return rng.pick(["man", "woman", "retro"] as const);
  if (group === "school" && rank > 0) return "child";
  return rng.pick(CROWD_KINDS[kind].bodies);
}
