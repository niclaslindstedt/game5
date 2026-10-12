// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE'S LENSES (`chute.ts`, the rig drawn by `chute-scene.ts`) —
// three-free, so the suite reads it. Out of the door until the canopy is
// full the skier's own ladder is no good: it frames a skier on the snow,
// and a body falling at fifty metres a second belly to the earth is seen
// the way the camera flyer who jumps with him sees him.
//
//   * FREEFALL, rung by rung: CHASE the camera flyer straight behind him
//     and over him, looking past him to where he is falling — the ground
//     coming up ahead and under him; FAR the same flyer further back; HIGH from straight over him looking down
//     on his back and the mountain under him; ORBIT the flyer slowly
//     flying round him; HELMET his own eyes, ahead and down over the snow
//     coming up; TIPS first person looking down and back past his own
//     skis at the snow.
//   * THE OPENING: the lens pulls back and up behind him to keep him and
//     the pieces over him — the pilot chute, the bag, the canopy — in one
//     frame, opening out as they stream up away from him; through his own
//     eyes (HELMET, TIPS) he looks up the lines at the canopy filling.
//
// Once the canopy is full the ladder under it takes over (`camera-para.ts`'s
// `CHUTE_RIGS`). Every change is flown, never cut: in from the skier's own
// ladder and back out to the canopy's.

import type { ChuteState } from "@engine";

import { blendLens, type LensPose } from "./camera-rigs.ts";
import type { CameraRung } from "./renderer-api.ts";

type P = { x: number; y: number; z: number };

/** The camera flyer's places, m: off the jumper's right, over him, behind
 * him (along his heading), and the lens's field, deg. */
export const FLYER = {
  chase: { right: 0.3, up: 1.6, back: 4.6, fov: 60 },
  far: { right: 0.8, up: 5.5, back: 9.5, fov: 52 },
  high: { right: 0.4, up: 13, back: 2.5, fov: 55 },
  orbit: { radius: 6.5, up: 2.5, rate: 0.22, fov: 55 },
} as const;
/** Where the flyer's look falls, m: `ahead` of him along his heading and
 * `down` under him — past him to the ground he is falling toward. */
const LOOK = { ahead: 6, down: 2.2 };
/** The opening's pull-back: off his side by the pieces' reach times this,
 * plus this many metres, and its field, deg. */
const OPENING = { reach: 1.15, plus: 7, up: 1.5, fov: 52 };
/** How long the door's own lens holds him falling away before the camera
 * flyer's takes over, s (`plane-scene.ts` holds it). */
const EXIT_HELD = 1.2;
/** How long a lens takes to fly in from the ladder and back out to it, s. */
export const SKYDIVE_HAND = { in: 0.9, out: 1.4 };

/** Whether the skydive's lens is wanted for `ch`: out of the door, in
 * freefall and through the opening — not under a full canopy, cut away
 * or after. */
export function skydiveFramed(ch: ChuteState | null | undefined, thrown: boolean): boolean {
  if (!ch || thrown || ch.done || ch.fell) return false;
  if (ch.mode === "exit") return ch.since >= EXIT_HELD;
  return ch.mode === "freefall" || ch.mode === "deploying";
}

/** His eyes as drawn: the point, the way his face looks and his head's up. */
export type SkydiveEyes = { at: P; face: P; up: P };

/** THE LENS THIS FRAME on `rung`, for a jumper drawn at `at` heading
 * `ch.heading`, the opening's furthest piece at `top` (or null), the snow's
 * height `ground(x, z)`, and his eyes as posed (or null, when they are
 * reckoned off his middle). */
export function skydiveLens(
  rung: CameraRung,
  ch: ChuteState,
  at: P,
  top: P | null,
  ground: (x: number, z: number) => number,
  eyes: SkydiveEyes | null = null,
  aspect = 16 / 9,
): LensPose {
  // A tall screen narrows the lens across: the flyer stands further off.
  const wide = Math.pow(Math.max(1, 16 / 9 / aspect), 0.7);
  const fx = Math.sin(ch.heading);
  const fz = Math.cos(ch.heading);
  const rx = fz;
  const rz = -fx;
  const off = (right: number, up: number, back: number): P => ({
    x: at.x + rx * right - fx * back,
    y: at.y + up,
    z: at.z + rz * right - fz * back,
  });
  const keepUp = (e: P): P => ({ ...e, y: Math.max(e.y, ground(e.x, e.z) + 1.5) });
  const opening = ch.mode === "deploying" && top !== null;
  const first = rung === "helmet" || rung === "tips";
  // His own eyes: his head along his heading (belly to earth, his head is
  // forward of his middle), looking ahead and down — or, opening, up the
  // lines at the canopy over him.
  if (first) {
    const head = eyes ? { ...eyes.at } : { x: at.x + fx * 0.5, y: at.y + 0.15, z: at.z + fz * 0.5 };
    if (opening) {
      return { eye: head, target: { ...top }, fov: 75, roll: 0 };
    }
    if (rung === "helmet") {
      // Belly to the earth his head is up and his eyes on the horizon ahead,
      // the snow coming up under it — never down at the haze straight below.
      return {
        eye: head,
        target: { x: head.x + fx * 8, y: head.y - 4.5, z: head.z + fz * 8 },
        fov: 72,
        roll: 0,
      };
    }
    // Back along his body past his legs and the skis over them (boxed, his
    // shins are up behind him) to the snow beyond.
    return {
      eye: { x: head.x, y: head.y + 0.25, z: head.z },
      target: { x: at.x - fx * 4, y: at.y - 1.5, z: at.z - fz * 4 },
      fov: 82,
      roll: 0,
    };
  }
  if (opening) {
    // Pulled back behind him to hold him and every piece over him.
    const mid = { x: (at.x + top.x) / 2, y: (at.y + top.y) / 2, z: (at.z + top.z) / 2 };
    const reach = Math.hypot(top.x - at.x, top.y - at.y, top.z - at.z);
    const d = (reach * OPENING.reach + OPENING.plus) * wide;
    const far = rung === "far" ? 1.8 : 1;
    const eye = keepUp({
      x: mid.x + (rx * 0.3 - fx * 0.95) * d * far,
      y: mid.y + OPENING.up,
      z: mid.z + (rz * 0.3 - fz * 0.95) * d * far,
    });
    return { eye, target: mid, fov: OPENING.fov, roll: 0 };
  }
  const below = { x: at.x + fx * LOOK.ahead, y: at.y - LOOK.down, z: at.z + fz * LOOK.ahead };
  if (rung === "orbit") {
    const O = FLYER.orbit;
    const a = ch.since * O.rate;
    const eye = keepUp({
      x: at.x + Math.sin(a) * O.radius * wide,
      y: at.y + O.up * wide,
      z: at.z + Math.cos(a) * O.radius * wide,
    });
    return { eye, target: below, fov: O.fov, roll: 0 };
  }
  const F = FLYER[rung];
  const eye = keepUp(off(F.right * wide, F.up * wide, F.back * wide));
  return {
    eye,
    target: rung === "high" ? { x: at.x, y: at.y - 20, z: at.z } : below,
    fov: F.fov,
    roll: 0,
  };
}

/** THE HAND-OVER: the skydive's lens flown in from the skier's ladder and
 * back out to whichever ladder is next (the canopy's), never cut — save on
 * a lab's or a restart's first frame. */
export type SkydiveCam = {
  /** This frame's lens, or null while the skydive wants none. */
  want(lens: LensPose | null, cut: boolean): void;
  lens(ladder: LensPose, dt: number): LensPose | null;
};

export function createSkydiveCam(): SkydiveCam {
  let own: LensPose | null = null;
  let held: LensPose | null = null;
  let share = 0;
  let cut = false;
  return {
    want(lens, c) {
      own = lens;
      cut = c;
    },
    lens(ladder, dt) {
      if (own) {
        share = cut ? 1 : Math.min(1, share + dt / SKYDIVE_HAND.in);
        held = own;
      } else share = cut ? 0 : Math.max(0, share - dt / SKYDIVE_HAND.out);
      if (!held || share <= 0) {
        held = null;
        return null;
      }
      return share >= 1 ? held : blendLens(ladder, held, share);
    },
  };
}
