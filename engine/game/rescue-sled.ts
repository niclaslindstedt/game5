// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI PATROL'S SNOWMOBILES ON THE MOUNTAIN — a rescue by snowmobile
// (`rescue-sled-route.ts` plans it; `RescueCall.kind === "sled"`) as a run
// meets it: where each of the two machines and the toboggan is at a moment
// of the call (`rescueSledsAt`), held as solids the skier is kept out of,
// and a machine STOLEN — a skier stood beside one the patrol has left
// standing while it tends the casualty, who gives the machine press, takes
// it (`PATROL_SOURCE`, through `steal.ts`). It becomes the player's snowmobile (`GameState.sled`,
// in the patrol's colours); the one he had is left standing where it was
// (`GameState.sledsLeft`), to be taken back the same way.
//
// A stolen machine changes the rescue, and the change is a pure function
// of when it was taken (`RescueCall.sledsTaken`, the call's clock): the
// first machine gone, the second drives round to the toboggan and tows him
// down itself; both gone, the toboggan stays where it is. The app reads
// the same function to draw it (`pwa/src/game/rescue-sleds-view.ts`).
//
// A run with no such call and no machine stolen never comes here; nothing
// is drawn from the stream.

import { hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { meetBoxes, ragdollOutOfBoxes, type StripBox } from "./airstrip-solids.ts";
import { RESCUE_SLEDS } from "./defs/rescue-sleds.ts";
import { onSkis } from "./groomer.ts";
import { inGrace } from "./machine-grace.ts";
import { onRoute, type RescueSledPlan, type SledPark } from "./rescue-sled-route.ts";
import type { StealSource } from "./steal.ts";
import type { GameEvent, GameState, SledState } from "./state.ts";

const K = RESCUE_SLEDS;

/** One patrol machine at a moment: where, its heading and speed, what it
 * is doing, whether it is there at all (gone down, or stolen), and
 * whether it is stood still where the patrol left it (the moment it can
 * be taken). */
export type RescueSledPose = SledPark & {
  speed: number;
  doing: "up" | "parked" | "hitch" | "down" | "gone";
  shown: boolean;
};

/** THE CALL'S MACHINES AT A MOMENT: the two, the toboggan, and which of
 * the two tows him down (−1 neither — both stolen). */
export type RescueSledsFrame = {
  sleds: [RescueSledPose, RescueSledPose];
  toboggan: SledPark & { speed: number; shown: boolean; hitched: number };
  tow: -1 | 0 | 1;
};

export function freshSledsFrame(): RescueSledsFrame {
  const pose = (): RescueSledPose => ({
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    doing: "up",
    shown: false,
  });
  return {
    sleds: [pose(), pose()],
    toboggan: { x: 0, z: 0, heading: 0, speed: 0, shown: false, hitched: 0 },
    tow: 0,
  };
}

/** When machine `k` was stolen on the call's clock, or Infinity. */
function takenAt(taken: readonly (number | null)[] | undefined, k: number): number {
  const v = taken?.[k];
  return v === null || v === undefined ? Infinity : v;
}

/** Which machine tows him down, given the ones stolen before the convoy
 * leaves. */
export function towOf(plan: RescueSledPlan, taken?: readonly (number | null)[]): -1 | 0 | 1 {
  if (takenAt(taken, 0) >= plan.go) return 0;
  if (takenAt(taken, 1) >= plan.go) return 1;
  return -1;
}

/** When the call is over on its own clock: the convoy at the bottom — or,
 * both machines stolen, a long while later (the patrol sends for another). */
export function sledCallGone(plan: RescueSledPlan, taken?: readonly (number | null)[]): number {
  const tow = towOf(plan, taken);
  if (tow < 0) return plan.go + 600;
  if (tow === 1) return plan.go + plan.hitch.time + plan.down.time + K.over;
  const follow = takenAt(taken, 1) < plan.go ? 0 : K.convoy.follow + plan.follow.time;
  return plan.go + Math.max(plan.down.time, follow) + K.over;
}

/** THE CALL'S MACHINES `t` s into it (the call's clock), the ones in
 * `taken` gone from the moment each was stolen. */
export function rescueSledsAt(
  plan: RescueSledPlan,
  taken: readonly (number | null)[] | undefined,
  t: number,
  out: RescueSledsFrame,
): RescueSledsFrame {
  const tow = towOf(plan, taken);
  out.tow = tow;
  for (let k = 0; k < 2; k++) {
    const p = out.sleds[k];
    p.shown = t < takenAt(taken, k);
    if (t < plan.parked[k]) {
      onRoute(plan.arrive[k], t - plan.start[k], p);
      p.doing = "up";
      p.shown &&= t >= plan.start[k];
      continue;
    }
    if (t < plan.go) {
      Object.assign(p, plan.park[k]);
      p.speed = 0;
      p.doing = "parked";
      continue;
    }
    if (k === tow) {
      const lead = k === 1 ? plan.hitch.time : 0;
      if (k === 1 && t < plan.go + lead) {
        onRoute(plan.hitch, t - plan.go, p);
        p.doing = "hitch";
      } else {
        onRoute(plan.down, t - plan.go - lead, p);
        p.doing = "down";
        if (t - plan.go - lead > plan.down.time + K.over) p.shown = false;
      }
    } else {
      onRoute(plan.follow, t - plan.go - K.convoy.follow, p);
      p.doing = "down";
      if (t - plan.go - K.convoy.follow > plan.follow.time + K.over) p.shown = false;
    }
    if (!p.shown) p.doing = "gone";
  }
  // THE TOBOGGAN: behind the first machine on its way up, left beside him,
  // then behind whichever tows it down.
  const b = out.toboggan;
  b.shown = true;
  b.hitched = 0;
  if (t < plan.parked[0]) {
    onRoute(plan.arrive[0], t - plan.start[0], b, K.trail);
    b.shown = t >= plan.start[0];
    b.hitched = 1;
  } else {
    const lead = tow === 1 ? plan.hitch.time : 0;
    if (tow < 0 || t < plan.go + lead) {
      Object.assign(b, plan.toboggan);
      b.speed = 0;
    } else {
      onRoute(plan.down, t - plan.go - lead, b, K.trail);
      b.hitched = 1;
      if (t - plan.go - lead > plan.down.time + K.over) b.shown = false;
    }
  }
  return out;
}

/** A machine's plan as boxes (x right, y up, z ahead off its middle on
 * the snow): the machine, or the toboggan. */
function boxOf(
  level: GameState["level"],
  p: SledPark,
  length: number,
  width: number,
  height: number,
  out: StripBox[],
): void {
  const y = level.groundAt(p.x, p.z);
  out.push({
    x: p.x,
    z: p.z,
    dx: Math.sin(p.heading),
    dz: Math.cos(p.heading),
    halfLength: length / 2,
    halfWidth: width / 2,
    base: y - 0.3,
    top: y + height,
    stuff: "steel",
  });
}

const frame = freshSledsFrame();
const boxes: StripBox[] = [];

/** How near a call's machines a body must be for them to be measured, m:
 * the toboggan's trail past a machine's length. */
const NEAR = 12;

/** Every patrol machine and toboggan near (x, z) at the run's clock, as
 * boxes (shared; read before the next call). */
function sledsNear(state: GameState, x: number, z: number): readonly StripBox[] {
  boxes.length = 0;
  for (const r of state.rescue ?? []) {
    if (r.kind !== "sled" || !r.sleds) continue;
    rescueSledsAt(r.sleds, r.sledsTaken, state.t - r.start, frame);
    for (const p of frame.sleds) {
      if (p.shown && hypot(x - p.x, z - p.z) < NEAR) {
        boxOf(state.level, p, K.sled.length, K.sled.width, K.sled.height, boxes);
      }
    }
    const b = frame.toboggan;
    if (b.shown && hypot(x - b.x, z - b.z) < NEAR) {
      boxOf(state.level, b, K.toboggan.length, K.toboggan.width, K.toboggan.height, boxes);
    }
  }
  return boxes;
}

/** THE SKIER HELD OUT OF THE PATROL'S MACHINES this step (`meetRescue`'s). */
export function meetRescueSleds(state: GameState, events: GameEvent[]): void {
  const near = sledsNear(state, state.skier.x, state.skier.z);
  if (near.length) meetBoxes(state, near, events);
}

/** THE THROWN BODY HELD OUT OF THEM (`ragdollOutOfRescue`'s). */
export function ragdollOutOfSleds(
  state: GameState,
  P: number[],
  L: number[],
  radius: ArrayLike<number>,
  struck: number[],
  dt: number,
): void {
  const near = sledsNear(state, P[0], P[2]);
  if (near.length) ragdollOutOfBoxes(P, L, radius, struck, dt, near);
}

/** THE PATROL'S MACHINES as a source of machines to take (`steal.ts`):
 * each of a call's two stood where the patrol left it, its door its
 * middle; taken, its call keeps the call's clock it went at
 * (`RescueCall.sledsTaken`), from which the rescue goes on without it.
 * Index `2 × call + machine`. */
export const PATROL_SOURCE: StealSource = {
  id: "patrol",
  parked(state, out) {
    const calls = state.rescue;
    if (!calls?.length || !state.sled) return;
    for (let i = 0; i < calls.length; i++) {
      const r = calls[i];
      if (r.kind !== "sled" || !r.sleds) continue;
      rescueSledsAt(r.sleds, r.sledsTaken, state.t - r.start, frame);
      for (let k = 0; k < 2; k++) {
        const p = frame.sleds[k];
        if (!p.shown || p.doing !== "parked") continue;
        out.push({
          kind: "sled",
          livery: "patrol",
          from: "patrol",
          index: 2 * i + k,
          x: p.x,
          y: state.level.groundAt(p.x, p.z),
          z: p.z,
          heading: p.heading,
          pitch: 0,
          roll: 0,
          door: { x: p.x, z: p.z },
          reach: K.take.reach,
          fastest: K.take.fastest,
          spool: 0,
        });
      }
    }
  },
  taken(state, index) {
    const r = state.rescue?.[Math.floor(index / 2)];
    if (!r) return;
    (r.sledsTaken ??= [null, null])[index % 2] = state.t - r.start;
  },
};

/** ONE HE LEFT STANDING that the press would take back instead of the one
 * he has now: the nearest of `sledsLeft` within `RESCUE_SLEDS.take.reach`
 * of a skier on his skis, slow enough and nearer than `own` m — its index
 * there and how far — or null. */
export function leftSledWithin(run: GameState, own = Infinity): { left: number; d: number } | null {
  const left = run.sledsLeft;
  if (!left?.length || !run.sled || inGrace(run) || !onSkis(run)) return null;
  const c = run.skier;
  if (hypot3(c.vx, c.vy, c.vz) > K.take.fastest) return null;
  let best: { left: number; d: number } | null = null;
  let most = Math.min(own, K.take.reach);
  for (let i = 0; i < left.length; i++) {
    const d = hypot(c.x - left[i].x, c.z - left[i].z);
    if (d < most) {
      most = d;
      best = { left: i, d };
    }
  }
  return best;
}

/** THE MACHINE HE HAS LEFT STANDING where it is, for `next` to be his —
 * kept in `sledsLeft` (the oldest beyond `RESCUE_SLEDS.left` gone back to
 * the patrol), unless it is burnt out. */
export function leaveSledFor(run: GameState, next: SledState): void {
  const mine = run.sled!;
  const left = (run.sledsLeft ??= []);
  if (!(mine.burn && mine.burn.boom >= 0)) {
    mine.running = false;
    mine.rider = false;
    left.push(mine);
    while (left.length > K.left) left.shift();
  }
  run.sled = next;
}
