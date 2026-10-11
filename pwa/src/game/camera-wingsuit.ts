// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WINGSUIT'S LENSES (`wingsuit.ts`, the flyer drawn by
// `wingsuit-body.ts`, his rig by `chute-scene.ts`) — three-free, so the
// suite reads it. A wingsuit picture is the ground rushing under and past
// a flyer, and the lenses are the ones wingsuit footage is shot with:
//
//   * TIPS — the camera on the back of his helmet, over his shoulders:
//     the helmet low in the middle of the frame, the arm wings spread to
//     its edges, the snow he flies over ahead and under.
//   * HELMET — his own eyes, ahead and down along his way.
//   * CHASE — the chase flyer a few metres behind him and over him (the
//     footage's 3–15 m back, 1–5 m up), looking down along his line, so
//     the mountain fills the lower half of the frame and he flies into it.
//   * FAR — the SIDE FLYER off his right wingtip, a little over him and
//     looking down past him at the face.
//   * HIGH — over and behind him, steeply down: him over the mountain.
//   * ORBIT — the flyer slowly circling him.
//
// Stood on a HOVER EXIT (`wingsuit-hover.ts`) the helicopter is on his
// left and its disc over him, so every lens stands off to his RIGHT, out
// of the machine and its disc, a little over him and looking down past him
// at the drop; through the step off the exit's framing is flown into the
// flight's. Every change of rung is FLOWN, never cut (`createWingsuitCam`):
// the lens swung round him from where it was to where it goes, its
// distance eased, so it never passes through him.
//
// Off a craft (the plane's door, the helicopter's skid, the basket) the
// craft's own lens holds him until the jump; through the opening and under
// the canopy the skydive's lenses take him (`camera-skydive.ts`,
// `camera-para.ts`'s `CHUTE_RIGS`).

import type { ChuteState } from "@engine";

import type { LensPose } from "./camera-rigs.ts";
import type { CameraRung } from "./renderer-api.ts";

type P = { x: number; y: number; z: number };

/** The flyers' places, m, in his flight's frame — `back` behind him along
 * his way, `up` over him, `right` off his right — what each looks at
 * (`ahead` m along his way and `down` m under him), and the field, deg. */
export const SUIT_FLYER = {
  chase: { back: 3.9, up: 1.3, right: 0.7, ahead: 4, down: 1.4, fov: 56 },
  far: { back: 1, up: 3.4, right: 7, ahead: 1.5, down: 0.8, fov: 46 },
  high: { back: 6, up: 11, right: 1.5, ahead: 4, down: 3, fov: 56 },
  orbit: { radius: 6, up: 2.8, rate: 0.16, ahead: 1, down: 0.6, fov: 54 },
} as const;
/** THE FIRST PERSON: the camera on the back of his helmet (`tips`), m
 * behind and over his eyes, and his own eyes (`helmet`) — each looking
 * along his way pitched down `pitch` rad, its field, deg. */
export const SUIT_EYES = {
  tips: { back: 0.55, up: 0.8, pitch: 0.42, fov: 100 },
  helmet: { back: 0, up: 0, pitch: 0.42, fov: 80 },
} as const;
/** ON A HOVER EXIT: every lens off his right, out of the helicopter and
 * its disc — `right` across, `ahead` along his facing, `up` over his
 * middle — looking `down` m under him (the drop) and `out` m along his
 * facing; the field, deg. ORBIT swings over his right side only. */
export const SUIT_EXIT = {
  chase: { right: 6.2, ahead: 2.6, up: 0.4, out: 1.2, down: 1.6, fov: 58 },
  far: { right: 15, ahead: 9, up: 2.5, out: 2, down: 3.5, fov: 48 },
  high: { right: 10, ahead: -5, up: 10, out: 9, down: 14, fov: 60 },
  orbit: { radius: 9, up: 1.2, swing: 0.9, rate: 0.22, out: 1.5, down: 1.8, fov: 56 },
} as const;
/** How long the exit's framing takes to fly into the flight's after the
 * step off, s. */
export const SUIT_EXIT_FLOWN = 2.4;
/** How long a change of rung is flown, s (the helicopter's ladder's own
 * pace, `camera-heli.ts`). */
export const SUIT_HAND = 1.1;
/** How far back down his body from his eyes his middle is, m. */
const MID = 0.75;
/** The snow kept under every lens, m. */
const CLEAR = 2;
/** How far across the ground the middle of the frame may land, m: high
 * over the snow a lens looking along his line sees only the mist past the
 * ground's edge (`haze.ts`), so it is pitched down until its middle lands
 * this near — the higher he flies, the steeper the look. */
const SEE = 380;
/** The pitch down a lens `agl` m over the snow wants, rad. */
const seeDown = (agl: number): number => Math.atan2(Math.max(0, agl), SEE);

/** Whether the wingsuit's lens is wanted for `ch` on a wingsuit run begun
 * on its own exit (`cliff`, a hover) or a lab's moment (`air`): stood on
 * the exit, off it, flying and through the opening — never off a craft
 * before the jump (its own lens has him) and never under a full canopy. */
export function wingsuitFramed(
  ch: ChuteState | null | undefined,
  from: "cliff" | "craft" | "air" | undefined,
  thrown: boolean,
): boolean {
  if (!ch || ch.suit !== "wingsuit" || thrown || ch.done || ch.fell) return false;
  if (ch.mode === "ready") return from !== "craft";
  return ch.mode === "exit" || ch.mode === "freefall";
}

/** His eyes as drawn: the point, the way his face looks, his head's up. */
export type SuitEyes = { at: P; face: P; up: P };

/** What the lens is handed a frame: the flyer drawn at `at`, his velocity
 * `v` (m/s), the snow's height, his eyes as posed (or null), whether he
 * stands on a helicopter's skid, the screen's width to its height. */
export type SuitSubject = {
  at: P;
  v: P;
  ground: (x: number, z: number) => number;
  eyes: SuitEyes | null;
  hover: boolean;
  /** Stood on the skid, the level way from the helicopter out to him (a
   * unit vector): every exit lens stands out that side. */
  away?: P | null;
  aspect: number;
};

const smooth = (t: number): number => {
  const s = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return s * s * (3 - 2 * s);
};

/** The way he flies, a unit vector: his velocity once there is any, his
 * heading level before it. */
export function flightWay(heading: number, v: P): P {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const speed = Math.hypot(v.x, v.y, v.z);
  const s = smooth(speed / 10);
  const x = fx * (1 - s) + (speed > 1e-6 ? (v.x / speed) * s : 0);
  const y = speed > 1e-6 ? (v.y / speed) * s : 0;
  const z = fz * (1 - s) + (speed > 1e-6 ? (v.z / speed) * s : 0);
  const n = Math.hypot(x, y, z) || 1;
  return { x: x / n, y: y / n, z: z / n };
}

/** THE LENS ON `rung` for the flyer in flight (or stepping off), his way
 * `d` (`flightWay`), his heading level `h`. */
function flightLens(rung: CameraRung, s: SuitSubject, d: P, h: number, t: number): LensPose {
  // His middle as DRAWN: back down his body from his eyes when they are
  // posed (the engine's point is not where the figure's middle is drawn).
  const at = s.eyes
    ? { x: s.eyes.at.x - d.x * MID, y: s.eyes.at.y - d.y * MID - 0.1, z: s.eyes.at.z - d.z * MID }
    : s.at;
  const wide = Math.pow(Math.max(1, 16 / 9 / s.aspect), 0.7);
  // The flight's frame: along his way, its right level, and up across it.
  let rx = Math.cos(h);
  let rz = -Math.sin(h);
  const rn = Math.hypot(rx, rz) || 1;
  rx /= rn;
  rz /= rn;
  if (rung === "tips" || rung === "helmet") {
    const E = SUIT_EYES[rung];
    const head = s.eyes ? s.eyes.at : { x: at.x + d.x * 0.7, y: at.y + 0.1, z: at.z + d.z * 0.7 };
    // Along his way, pitched further down — steeper high over the snow
    // (`SEE`), his line's own slope counted; level across.
    const slope = Math.asin(Math.max(-1, Math.min(1, -d.y)));
    const agl = head.y - s.ground(head.x, head.z);
    const pitch = Math.max(E.pitch, Math.min(0.9, seeDown(agl) - slope));
    const lx = d.x * Math.cos(pitch);
    const lz = d.z * Math.cos(pitch);
    const ly = d.y * Math.cos(pitch) - Math.sin(pitch);
    const eye = {
      x: head.x - d.x * E.back,
      y: head.y + E.up - d.y * E.back,
      z: head.z - d.z * E.back,
    };
    return {
      eye,
      target: { x: eye.x + lx * 20, y: eye.y + ly * 20, z: eye.z + lz * 20 },
      fov: E.fov * Math.min(1.25, wide),
      roll: 0,
    };
  }
  let eye: P;
  let aim: P;
  let fov: number;
  if (rung === "orbit") {
    const O = SUIT_FLYER.orbit;
    const a = t * O.rate;
    eye = {
      x: at.x + Math.sin(a) * O.radius * wide,
      y: at.y + O.up * wide,
      z: at.z + Math.cos(a) * O.radius * wide,
    };
    aim = { x: at.x + d.x * O.ahead, y: at.y + d.y * O.ahead - O.down, z: at.z + d.z * O.ahead };
    fov = O.fov;
  } else {
    const F = SUIT_FLYER[rung];
    eye = {
      x: at.x - d.x * F.back * wide + rx * F.right * wide,
      y: at.y - d.y * F.back * wide + F.up * wide,
      z: at.z - d.z * F.back * wide + rz * F.right * wide,
    };
    aim = { x: at.x + d.x * F.ahead, y: at.y + d.y * F.ahead - F.down, z: at.z + d.z * F.ahead };
    fov = F.fov;
  }
  // High over the snow, pitched down until the middle of the frame lands on
  // the ground (`SEE`): most of it by climbing the flyer over him, so he
  // stays in the frame, the rest by looking further past him.
  const h0 = Math.hypot(aim.x - eye.x, aim.z - eye.z) || 1;
  const pitch = Math.atan2(eye.y - aim.y, h0);
  const extra = Math.min(0.75, Math.max(0, seeDown(at.y - s.ground(at.x, at.z)) - pitch));
  if (extra > 0) {
    eye.y = aim.y + h0 * Math.tan(pitch + extra * 0.6);
    aim.y -= h0 * (Math.tan(pitch + extra) - Math.tan(pitch + extra * 0.6));
  }
  eye.y = Math.max(eye.y, s.ground(eye.x, eye.z) + CLEAR);
  return { eye, target: aim, fov, roll: 0 };
}

/** THE LENS ON `rung` stood on a hover exit's skid, facing `h`. */
function exitLens(rung: CameraRung, s: SuitSubject, h: number, t: number): LensPose {
  const at = s.at;
  const wide = Math.pow(Math.max(1, 16 / 9 / s.aspect), 0.7);
  // Out from the machine (`away`), else his right; along his facing.
  let rx = s.away ? s.away.x : Math.cos(h);
  let rz = s.away ? s.away.z : -Math.sin(h);
  const rn = Math.hypot(rx, rz) || 1;
  rx /= rn;
  rz /= rn;
  let fx = -rz;
  let fz = rx;
  if (fx * Math.sin(h) + fz * Math.cos(h) < 0) {
    fx = -fx;
    fz = -fz;
  }
  if (rung === "tips" || rung === "helmet") {
    const head = s.eyes ? s.eyes.at : { x: at.x + fx * 0.1, y: at.y + 0.75, z: at.z + fz * 0.1 };
    // TIPS: down past his chest at his boots on the skid and the drop;
    // HELMET: out over the drop ahead, steeply down.
    const tips = rung === "tips";
    // Out sideways over the drop, the way he will step — the cabin's nose
    // is ahead of him on the other side.
    const eye = {
      x: head.x + rx * 0.22 + fx * 0.05,
      y: head.y + 0.06,
      z: head.z + rz * 0.22 + fz * 0.05,
    };
    const out = tips ? 1.4 : 7;
    const down = tips ? 7 : 6;
    const fore = tips ? 0.1 : 0.25;
    return {
      eye,
      target: {
        x: at.x + (rx + fx * fore) * out,
        y: at.y - down,
        z: at.z + (rz + fz * fore) * out,
      },
      fov: (tips ? 92 : 78) * Math.min(1.25, wide),
      roll: 0,
    };
  }
  let right: number;
  let ahead: number;
  let up: number;
  let E: { out: number; down: number; fov: number };
  if (rung === "orbit") {
    const O = SUIT_EXIT.orbit;
    const a = Math.sin(t * O.rate) * O.swing;
    right = Math.cos(a) * O.radius;
    ahead = Math.sin(a) * O.radius;
    up = O.up;
    E = O;
  } else {
    const X = SUIT_EXIT[rung];
    right = X.right;
    ahead = X.ahead;
    up = X.up;
    E = X;
  }
  const eye = {
    x: at.x + (rx * right + fx * ahead) * wide,
    y: at.y + up * wide,
    z: at.z + (rz * right + fz * ahead) * wide,
  };
  eye.y = Math.max(eye.y, s.ground(eye.x, eye.z) + CLEAR);
  return {
    eye,
    target: { x: at.x + fx * E.out, y: at.y - E.down, z: at.z + fz * E.out },
    fov: E.fov,
    roll: 0,
  };
}

/** THE LENS THIS FRAME on `rung` for the flyer in `ch`: stood on a hover
 * exit, the exit's framing; stepping off it, flown into the flight's over
 * `SUIT_EXIT_FLOWN`; flying, the flight's. */
export function wingsuitLens(rung: CameraRung, ch: ChuteState, s: SuitSubject): LensPose {
  const d = flightWay(ch.heading, s.v);
  if (!s.hover || (ch.mode !== "ready" && ch.mode !== "exit")) {
    return flightLens(rung, s, d, ch.heading, ch.since);
  }
  const stood = exitLens(rung, s, ch.heading, ch.mode === "ready" ? ch.t : ch.since);
  if (ch.mode === "ready") return stood;
  const share = ch.since / SUIT_EXIT_FLOWN;
  if (share >= 1) return flightLens(rung, s, d, ch.heading, ch.since);
  return swingLens(s.at, stood, flightLens(rung, s, d, ch.heading, ch.since), share);
}

/** A LENS SWUNG ROUND `at` from `a` to `b` by `t` 0..1 (eased): the eye's
 * way out from him turned between the two and its distance eased, the
 * target's offset eased — so a lens flown from one side of him to the
 * other goes round him, never through him. */
export function swingLens(at: P, a: LensPose, b: LensPose, t: number): LensPose {
  const s = smooth(t);
  const l = (p: number, q: number): number => p + (q - p) * s;
  const ax = a.eye.x - at.x;
  const ay = a.eye.y - at.y;
  const az = a.eye.z - at.z;
  const bx = b.eye.x - at.x;
  const by = b.eye.y - at.y;
  const bz = b.eye.z - at.z;
  const la = Math.hypot(ax, ay, az);
  const lb = Math.hypot(bx, by, bz);
  let ux = l(ax / (la || 1), bx / (lb || 1));
  let uy = l(ay / (la || 1), by / (lb || 1));
  let uz = l(az / (la || 1), bz / (lb || 1));
  let un = Math.hypot(ux, uy, uz);
  if (un < 0.2) {
    // Straight through him: go over the top instead.
    uy += 0.6;
    un = Math.hypot(ux, uy, uz);
  }
  ux /= un;
  uy /= un;
  uz /= un;
  const len = l(la, lb);
  return {
    eye: { x: at.x + ux * len, y: at.y + uy * len, z: at.z + uz * len },
    target: {
      x: l(a.target.x, b.target.x),
      y: l(a.target.y, b.target.y),
      z: l(a.target.z, b.target.z),
    },
    fov: l(a.fov, b.fov),
    roll: l(a.roll, b.roll),
  };
}

/** THE FLOWN CHANGE OF LENS: the lens wanted this frame and the key it is
 * on (the rung, and whether it is the opening's), flown from wherever the
 * last frame's lens stood (as an offset off him, so it travels with him)
 * over `SUIT_HAND` — and cut on a lab's or a restart's first frame. A lens
 * `first` is in his head; `inside` says whether the lens handed back is,
 * near enough: his figure is left out of that frame. */
export type WingsuitCam = {
  frame(key: string, first: boolean, at: P, lens: LensPose, cut: boolean, dt: number): LensPose;
  inside(): boolean;
};

export function createWingsuitCam(): WingsuitCam {
  let key: string | null = null;
  let wasFirst = false;
  let isFirst = false;
  // The lens flown from, as offsets off him: its eye and its target.
  let from: LensPose | null = null;
  let last: LensPose | null = null;
  let share = 1;
  const rel = (lens: LensPose, at: P, sign: 1 | -1): LensPose => ({
    eye: { x: lens.eye.x + sign * at.x, y: lens.eye.y + sign * at.y, z: lens.eye.z + sign * at.z },
    target: {
      x: lens.target.x + sign * at.x,
      y: lens.target.y + sign * at.y,
      z: lens.target.z + sign * at.z,
    },
    fov: lens.fov,
    roll: lens.roll,
  });
  return {
    frame(k, first, at, lens, cut, dt) {
      if (cut || key === null) {
        share = 1;
        from = null;
      } else if (k !== key) {
        if (last) from = rel(last, at, -1);
        wasFirst = isFirst;
        share = 0;
      }
      key = k;
      isFirst = first;
      share = Math.min(1, share + dt / SUIT_HAND);
      const out = from && share < 1 ? swingLens(at, rel(from, at, 1), lens, share) : lens;
      last = out;
      return out;
    },
    inside: () => (isFirst && share > 0.75) || (wasFirst && share < 0.25),
  };
}
