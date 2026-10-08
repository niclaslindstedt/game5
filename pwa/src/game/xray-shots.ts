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
//      moment before it lands, and the cam takes the run a WALL SECOND
//      before the hit: the run slowed evenly from its own pace almost to a
//      stop so the blow lands on that second's last frame, the lens closing
//      right in on the part of him the blow lands on — the skier drawn as
//      he is for the first half of it, the skin turning to glass round the
//      skeleton and the organs over the second half;
//   2. THE BONES: it watches that bone crack; every other BIG bone that
//      goes after it (the skull, the spine, the ribs, the pelvis, the long
//      bones of the arm and the leg) is a shot of its own, the lens panning
//      to it — ahead of time where the read ahead sees it coming — and
//      holding while it cracks;
//   3. THE TEAR: a limb torn off (`gore.ts`) is a shot of its own, as is a
//      skull crushed, the trunk opened or the body run through;
//   4. THE WAY BACK: then the lens draws back out to where the game's own
//      camera has him (the death cam's, or the ladder's), the skin
//      dissolving back over the bones until he is solid again and the run
//      speeding back up to its own pace, and the cam lets go on the very
//      frame the two lenses meet — no cut. A blow seen coming that never
//      lands goes the same way back.
//
// ONLY A FALL HE DIES OF is shot: the read ahead says whether the blow
// (and the tumble after it) will be mortal, and a blow it missed starts the
// cam only once the run itself knows he is dying. A run is slowed only once
// per fall: the cam waits for the skier to be stood back up before it looks
// for another blow.

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
  /** How near a blow seen coming starts the cam, game s: what a run slowed
   * evenly from its own pace to `slow` covers in `leadWall`. */
  lead: 0.55,
  /** The wall seconds from the cam taking the run to the hit, and of them
   * the ones the skier is drawn solid; the glass comes over him in the
   * rest. */
  leadWall: 1,
  leadSolid: 0.5,
  /** How slow the bones and the tear are shot. */
  slow: 0.08,
  /** How fast the rate eases toward what a shot wants, 1/s. */
  ease: 12,
  /** A bone held after it cracks; a shot seen coming dropped when its
   * crack is this late, game s. */
  hold: 1.5,
  late: 0.25,
  /** A tear held. */
  tear: 1.4,
  /** THE WAY BACK: the rate it starts at, and the wall seconds the lens
   * draws back home, the skin comes back and the run speeds up over; how
   * fast a new bone after it began takes the lens back in, 1/s. */
  bodyRate: 0.22,
  back: 2.6,
  backIn: 2,
  /** The glass coming over the skin on the way in, wall s. */
  glassIn: 0.35,
  /** At most this many shots of bones and tears in one fall. */
  most: 6,
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
  /** How far the lens is back where the game's own camera has him, 0 … 1
   * (eased): the X-ray lens is drawn this far toward it. */
  back: number;
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

export const IDLE_XRAY: XrayLook = {
  active: false,
  rate: 1,
  xray: 0,
  back: 0,
  shot: null,
  age: 0,
  index: 0,
};
const IDLE = IDLE_XRAY;

const smooth = (k: number): number => k * k * (3 - 2 * k);

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
  /** How far along the way back, linear 0 … 1. */
  let home = 0;
  /** The lead under way: the game second the first blow lands, the wall
   * seconds since the cam took the run; and the wall seconds the shot on
   * screen has been held since its blow landed. */
  let leading = false;
  let firstAt = 0;
  let leadAge = 0;
  let since = 0;
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
    home = 0;
    leading = false;
    firstAt = 0;
    leadAge = 0;
    since = 0;
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
    // A new bone on the way back: back in for it (the lens and the glass
    // turn round where they are).
    if (body) body = false;
  };

  const begin = (): void => {
    on = true;
    spent = true;
  };

  return {
    seen(f, state) {
      if (!f || (spent && !on) || (body && !on)) return;
      if (!on && (f.in > XRAY.lead || !f.fatal)) return;
      const at = state.t + f.in;
      const bone = bestBone(f.bones);
      if (on && bone && !BIG_BONES.includes(boneKind(bone))) return;
      if (on && !bone && !f.gore) return;
      // The first shot is of the part the blow lands on: its own bone if
      // that is one that breaks, else the bone it is best seen on.
      let look = bone ?? partBone(f.part);
      if (!on && f.part) {
        const own = PART_BONE[f.part];
        look = f.bones.find((b) => boneKind(b) === boneKind(own)) ?? own;
      }
      if (!on) {
        begin();
        leading = true;
        firstAt = at;
        leadAge = 0;
      }
      want({ kind: "bone", bone: look }, at, false);
    },

    step(state) {
      if (state !== last) {
        reset();
        last = state;
      }
      // Stood back up: ready for the next fall.
      if (spent && !on && !state.skier.thrown && !(state.gore && state.gore.dead >= 0)) reset();
      // A blow the read ahead missed starts the cam only if he is dying.
      const dying = !!state.gore && (state.gore.mortal >= 0 || state.gore.dead >= 0);
      for (const e of state.events as GameEvent[]) {
        if (e.kind === "injury") {
          const bones = bonesOf(e.injury, e.part);
          const bone = bestBone(bones);
          if (!bone) continue;
          const big = BIG_BONES.includes(boneKind(bone));
          if (!on && !spent && dying) begin();
          else if (!on) continue;
          if (big || shots === 0) want({ kind: "bone", bone }, e.t, true);
          else
            for (const p of [current, ...queue]) if (p && keyOf(p.shot) === bone) p.landed = true;
        } else if (e.kind === "gore") {
          if (!on && !spent && dying) begin();
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
      if (leading && state.t >= firstAt) leading = false;
      // The shot on screen: done when its bone has cracked and been held,
      // or when what was seen coming never came.
      if (current) {
        if (current.landed && state.t >= current.at) since += wall;
        const held = current.shot.kind === "tear" ? XRAY.tear : XRAY.hold;
        const late = !current.landed && state.t > current.at + XRAY.late;
        if ((current.landed && since > held) || late) current = null;
      }
      if (!current && queue.length) {
        current = queue.shift()!;
        age = 0;
        since = 0;
        index++;
      }
      if (!current && !body) {
        body = true;
        age = 0;
        index++;
      }
      let want: number;
      if (leading && !body) {
        // THE LEAD: the rate set (never eased) so that, falling evenly to
        // `slow`, the run reaches the blow just as the lead's wall second
        // runs out; the skin solid, then glass.
        leadAge += wall;
        const gap = Math.max(0, firstAt - state.t);
        const left = Math.max(0.05, XRAY.leadWall - leadAge);
        rate = Math.min(1, Math.max(XRAY.slow, (2 * gap) / left - XRAY.slow));
        const glass = (leadAge - XRAY.leadSolid) / (XRAY.leadWall - XRAY.leadSolid);
        xray = Math.min(1, Math.max(0, glass));
        return { active: true, rate, xray, back: 0, shot: current!.shot, age, index };
      }
      if (body) {
        home = Math.min(1, home + wall / XRAY.back);
        want = XRAY.bodyRate + (1 - XRAY.bodyRate) * home * home;
        // The skin comes back as the lens goes home, never the other way.
        xray = Math.min(xray, 1 - smooth(home));
      } else {
        home = Math.max(0, home - wall * XRAY.backIn);
        want = XRAY.slow;
        xray = Math.min(1, xray + wall / XRAY.glassIn);
      }
      rate += (want - rate) * (1 - Math.exp(-XRAY.ease * wall));
      // Home, solid and at its own pace: the game's camera has him already.
      if (body && home >= 1 && rate > 0.98) {
        on = false;
        return IDLE;
      }
      return {
        active: true,
        rate,
        xray,
        back: smooth(home),
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
