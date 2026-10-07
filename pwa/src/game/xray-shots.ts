// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE X-RAY CAM'S DIRECTOR — the hard blow as a scene, shot the way the
// sniper games shoot a bullet going in: SLOWED, CLOSE and SEEN THROUGH THE
// SKIN. DOM-free and three-free; the app hands it the blow seen coming
// (`impact-forecast.ts`) and every step's events, and reads back how fast
// the run is to go and what the lens is to look at (`XrayLook`), which the
// renderer frames (`camera-xray.ts`) and draws (`xray-view.ts`).
//
// THE SEQUENCE:
//   1. THE LEAD: a blow that will break a bone or tear him open is seen a
//      moment before it lands, and the run is slowed almost to a stop on
//      the way to it, the lens closing in on the bone it will break, the
//      skin turning to glass round the skeleton and the organs;
//   2. THE BONES: it watches that bone crack; every other BIG bone that
//      goes after it (the skull, the spine, the ribs, the pelvis, the long
//      bones of the arm and the leg) is a shot of its own, the lens panning
//      to it — ahead of time where the read ahead sees it coming — and
//      holding while it cracks;
//   3. THE TEAR: a limb torn off (`gore.ts`) is a shot of its own, as is a
//      skull crushed, the trunk opened or the body run through;
//   4. THE BODY: then the lens pulls out to the whole of him, the skin
//      coming back over the bones, the blood on the snow, the run speeding
//      back up to its own pace — and, if he is dying, holds on him until the
//      run starts again; if he lives, the death cam takes him back.
//
// A run is slowed only once per fall: the cam waits for the skier to be
// stood back up before it looks for another blow.

import {
  bonesOf,
  type BodyPart,
  type Bone,
  type BoneKind,
  type GameEvent,
  type GameState,
  type GorePiece,
} from "@engine";

import type { Forecast } from "./impact-forecast.ts";

/** The whole director, as numbers: seconds of the WALL clock unless named
 * game seconds; rates are game seconds per wall second. */
export const XRAY = {
  /** How near a blow seen coming starts the cam, game s. */
  lead: 0.45,
  /** How slow the bones and the tear are shot. */
  slow: 0.08,
  /** How fast the rate eases toward what a shot wants, 1/s. */
  ease: 12,
  /** A bone held after it cracks; a shot seen coming dropped when its
   * crack is this late, game s. */
  hold: 1.5,
  late: 0.25,
  /** A tear held. */
  tear: 1.8,
  /** THE BODY: the rate it starts at and the wall seconds it speeds back
   * up over; how long it holds on a body that lives; the glass fading back
   * to skin. */
  bodyRate: 0.22,
  speedUp: 3.5,
  bodyHold: 4,
  fade: 1.2,
  /** At most this many shots of bones and tears in one fall. */
  most: 7,
  /** A blow seen coming that never lands lets the run go after this long,
   * game s. */
  miss: 0.35,
} as const;

/** THE BIG BONES — the ones worth a shot of their own after the first. */
export const BIG_BONES: readonly BoneKind[] = [
  "skull",
  "cervical",
  "thoracic",
  "lumbar",
  "ribs",
  "pelvis",
  "humerus",
  "femur",
  "tibia",
];

export const boneKind = (b: Bone): BoneKind => b.replace(/[LR]$/, "") as BoneKind;

/** What the lens looks at. */
export type XrayShot =
  | { kind: "bone"; bone: Bone }
  | { kind: "tear"; piece: GorePiece | null; at: { x: number; y: number; z: number } }
  | { kind: "body" };

export type XrayLook = {
  /** Whether the cam has the run. */
  active: boolean;
  /** Game seconds a wall second. */
  rate: number;
  /** How far the skin is glass, 0 … 1. */
  xray: number;
  shot: XrayShot | null;
  /** Wall seconds on this shot, and its number in the fall (a new number
   * is a new shot: the lens pans). */
  age: number;
  index: number;
};

type Pending = {
  shot: XrayShot;
  /** Game second it lands (seen coming) or landed. */
  at: number;
  landed: boolean;
};

export type XrayDirector = {
  /** A blow read ahead, this frame. */
  seen(f: Forecast | null, state: GameState): void;
  /** One step's events. */
  step(state: GameState): void;
  /** One frame, `wall` seconds after the last: the look. */
  frame(state: GameState, wall: number): XrayLook;
  /** Put it down (a new run). */
  drop(): void;
};

const IDLE: XrayLook = { active: false, rate: 1, xray: 0, shot: null, age: 0, index: 0 };

/** The bone of a forecast or an injury the lens should look at. */
function bestBone(bones: readonly Bone[]): Bone | null {
  return bones.find((b) => BIG_BONES.includes(boneKind(b))) ?? bones[0] ?? null;
}

/** The bone a body part's blow is best seen on. */
const PART_BONE: Record<BodyPart, Bone> = {
  head: "skull",
  neck: "cervical",
  chest: "ribs",
  back: "thoracic",
  abdomen: "lumbar",
  pelvis: "pelvis",
  shoulderL: "clavicleL",
  shoulderR: "clavicleR",
  armL: "humerusL",
  armR: "humerusR",
  handL: "handL",
  handR: "handR",
  thighL: "femurL",
  thighR: "femurR",
  kneeL: "patellaL",
  kneeR: "patellaR",
  shinL: "tibiaL",
  shinR: "tibiaR",
  footL: "footL",
  footR: "footR",
};
const partBone = (part: BodyPart | null): Bone => (part ? PART_BONE[part] : "ribs");

export function createXrayDirector(): XrayDirector {
  let on = false;
  let spent = false;
  let rate = 1;
  let xray = 0;
  let queue: Pending[] = [];
  let current: Pending | null = null;
  let age = 0;
  let index = 0;
  let shots = 0;
  let body = false;
  let bodyAge = 0;
  const shotBones = new Set<string>();
  let last: GameState | null = null;

  const reset = (): void => {
    on = false;
    spent = false;
    rate = 1;
    xray = 0;
    queue = [];
    current = null;
    age = 0;
    index = 0;
    shots = 0;
    body = false;
    bodyAge = 0;
    shotBones.clear();
  };

  const keyOf = (s: XrayShot): string =>
    s.kind === "bone" ? s.bone : s.kind === "tear" ? `tear:${s.piece ?? "?"}` : "body";

  /** Queue a shot unless it has been shot (or is queued) this fall. */
  const want = (shot: XrayShot, at: number, landed: boolean): void => {
    const key = keyOf(shot);
    if (shotBones.has(key)) {
      if (landed)
        for (const p of [current, ...queue]) if (p && keyOf(p.shot) === key) p.landed = true;
      return;
    }
    if (shots >= XRAY.most) return;
    shotBones.add(key);
    shots++;
    queue.push({ shot, at, landed });
    queue.sort((a, b) => a.at - b.at);
    // A new bone after the body shot began: back in for it.
    if (body) {
      body = false;
      xray = Math.max(xray, 0.6);
    }
  };

  const begin = (): void => {
    on = true;
    spent = true;
  };

  return {
    seen(f, state) {
      if (!f || (spent && !on) || (body && !on)) return;
      if (f.in > XRAY.lead && !on) return;
      const at = state.t + f.in;
      const bone = bestBone(f.bones);
      if (on && bone && !BIG_BONES.includes(boneKind(bone))) return;
      if (on && !bone && !f.gore) return;
      if (!on) begin();
      want({ kind: "bone", bone: bone ?? partBone(f.part) }, at, false);
    },

    step(state) {
      if (state !== last) {
        reset();
        last = state;
      }
      // Stood back up: ready for the next fall.
      if (spent && !on && !state.skier.thrown && !(state.gore && state.gore.dead >= 0)) reset();
      for (const e of state.events as GameEvent[]) {
        if (e.kind === "injury") {
          const bones = bonesOf(e.injury, e.part);
          const bone = bestBone(bones);
          if (!bone) continue;
          const big = BIG_BONES.includes(boneKind(bone));
          if (!on && !spent) begin();
          else if (!on) continue;
          if (big || shots === 0) want({ kind: "bone", bone }, e.t, true);
          else
            for (const p of [current, ...queue]) if (p && keyOf(p.shot) === bone) p.landed = true;
        } else if (e.kind === "gore") {
          if (!on && !spent) begin();
          else if (!on) continue;
          const at = { x: e.x, y: e.y, z: e.z };
          if (e.what === "crush") want({ kind: "bone", bone: "skull" }, e.t, true);
          else
            want(
              { kind: "tear", piece: e.what === "torn" ? (e.piece as GorePiece) : null, at },
              e.t,
              true,
            );
        }
      }
    },

    frame(state, wall) {
      if (state !== last) {
        reset();
        last = state;
      }
      if (!on) return IDLE;
      age += wall;
      // The shot on screen: done when its bone has cracked and been held,
      // or when what was seen coming never came.
      if (current) {
        const held = current.shot.kind === "tear" ? XRAY.tear : XRAY.hold;
        const late = !current.landed && state.t > current.at + XRAY.late;
        if ((current.landed && age > held && state.t >= current.at) || late) current = null;
      }
      if (!current && queue.length) {
        current = queue.shift()!;
        age = 0;
        index++;
      }
      if (!current && !body) {
        // Nothing landed at all: the blow seen coming missed him.
        if (index === 0 && state.t > (queue[0]?.at ?? state.t) + XRAY.miss) {
          on = false;
          return IDLE;
        }
        body = true;
        bodyAge = 0;
        age = 0;
        index++;
      }
      let want: number;
      if (body) {
        bodyAge += wall;
        const k = Math.min(1, bodyAge / XRAY.speedUp);
        want = XRAY.bodyRate + (1 - XRAY.bodyRate) * k * k;
        xray = Math.max(0, xray - wall / XRAY.fade);
        const dying = !!state.gore && state.gore.mortal >= 0;
        if (!dying && bodyAge > XRAY.bodyHold) {
          on = false;
          return IDLE;
        }
      } else {
        want = XRAY.slow;
        xray = Math.min(1, xray + wall / 0.35);
      }
      rate += (want - rate) * (1 - Math.exp(-XRAY.ease * wall));
      return {
        active: true,
        rate,
        xray,
        shot: body ? { kind: "body" } : current!.shot,
        age,
        index,
      };
    },

    drop() {
      reset();
      last = null;
    },
  };
}
