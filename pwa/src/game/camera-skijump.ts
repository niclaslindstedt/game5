// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI JUMP AS TELEVISION SHOWS IT (R43) — the broadcast's director over a
// jump: the cameras a jumping hill's production stands where it stands
// them, and the cut from one to the next as the jump goes from the bar to
// the out-run. The research (`docs/specs/SKI_JUMPING.md` § *The cameras*,
// in our own words off a broadcaster's camera plan for the sport):
//
//   TOWER    the crane opposite the start tower, over the deck down the
//            in-run, looking back up at him on the bar: the opening.
//   BAR      the close-up on the bar, from the stair beside the gate, wide
//            open; it follows him off it and down the upper in-run.
//   PROFILE  beside the take-off on a platform over the table, a long lens:
//            him in full profile down the in-run, the crouch, the push and
//            the skis leaving the edge — then the cut.
//   FLIGHT   the main camera's shot of the flight from the side at his own
//            height, here on a rail beside the landing hill running with
//            him so he stays big in the frame: the V, the body laid over
//            the skis, the landing slope below and its lines.
//   LANDING  low on the landing hill's side past K, looking up the slope
//            at him as he comes down onto it — the telemark from in front,
//            his spray behind him.
//   OUT-RUN  the crane past the landing slope, over the out-run: the
//            reaction, the stop.
//
// Every lens AIMS AT HIM and ZOOMS to hold a few metres of world round
// him (`JUMP_CAM.frame`), so the long lenses keep him big however far off
// they stand; and no shot is cut away from in under `JUMP_CAM.hold`
// seconds of the run's clock. Which shot a moment wants is a pure function
// of the jump (`wantShot`); the director only holds a shot its time. The
// replay's BROADCAST is this director over the recording, whose collector
// files the take-off and the landing as the moments it runs slow
// (`replay-shots.ts`).
//
// Three-free: it hands the renderer a `LensPose` to plant.

import { type GameState, type Level } from "@engine";

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { LensPose, LineClear, Vec3 } from "./camera-rigs.ts";
import { hillFrame, hillPoint, type HillFrame } from "./ski-jump-frame.ts";
import { landingWidth } from "./ski-jump-plan.ts";

/** The broadcast's shots, in the order a jump runs through them. */
export const JUMP_SHOTS = ["tower", "bar", "profile", "flight", "landing", "outrun"] as const;
export type JumpShot = (typeof JUMP_SHOTS)[number];

/** THE WHOLE DIRECTOR, as numbers. Metres of the hill's frame (`d` along,
 * `a` across to the jumper's right, `h` over the profile), seconds and
 * degrees. */
export const JUMP_CAM = {
  /** The least a shot is held, s. */
  hold: 1.5,
  /** How long the opening holds on the bar, s of the run. */
  tower: 2.2,
  /** The opening's crane: down the in-run on the left, over the deck,
   * looking back up at him on the bar with the tower behind him — its aim
   * led this share of the way from him to K. */
  crane: { d: 30, a: -11, h: 7, fov: 48, lead: 0 },
  /** The bar's camera: down the in-run from the gate, on the stair. */
  bar: { ahead: 4.5, a: 2.1, h: 1.7 },
  /** The bar's camera follows him this far down the in-run, m. */
  follow: 26,
  /** The profile camera beside the table, opposite the coaches. */
  profile: { back: 4, a: -6.5, h: 3.6 },
  /** It hands the flight on this long after the edge, s. */
  airAfter: 0.55,
  /** The flight's rail: how far behind him along, out past the landing
   * area's edge (inside the floodlight masts), and under his height. */
  rail: { back: 3, out: 3.5, under: 1.2 },
  /** The landing camera: past K, out past the landing area's edge, over
   * the snow — and when it is cut to: his distance as a share of K, or
   * this long in the air, s. */
  landing: { past: 25, out: 4, h: 2.4, share: 0.68, after: 3.1 },
  /** The out-run's crane: past U, to the right, over the snow — cut to
   * this long after the touch-down, s. */
  outrun: { past: 32, a: 12, h: 9, after: 1.4 },
  /** The height of world held round him in the frame, m, a shot each. */
  frame: { tower: 6, bar: 2.2, profile: 2.8, flight: 5, landing: 5.5, outrun: 4.5 } as Record<
    JumpShot,
    number
  >,
  /** The zoom's two ends, deg. */
  fovMin: 3.5,
  fovMax: 60,
  /** The least an eye stands over the snow under it, m; how far it is
   * lifted to open a line to him, a try, and how many tries. */
  clearance: 1.2,
  lift: 2,
  tries: 5,
} as const;

/** What the director reads off a jump. */
export type JumpMoment = {
  level: Level;
  stage: "bar" | "tracks" | "air" | "down";
  /** The run's clock, s, and when he went over the edge and how long he
   * flew (the edge −1 until then). */
  t: number;
  edgeAt: number;
  flightTime: number;
  /** Where his gate stands and where he is along the hill, m of plan, and
   * where he is as drawn. */
  gate: number;
  along: number;
  racer: Vec3;
};

/** A ski jump's moment, or null on a map with no hill or no jump. */
export function jumpMoment(state: GameState, racer: Vec3): JumpMoment | null {
  const j = state.jump;
  if (!j || !state.level.skiJump) return null;
  return {
    level: state.level,
    stage: j.stage,
    t: state.t,
    edgeAt: j.edgeAt,
    flightTime: j.record.flightTime,
    gate: state.level.skiJump.gates[j.gate]?.x ?? state.level.skiJump.from,
    along: j.stage === "bar" || j.stage === "tracks" ? j.along : alongOf(state.level, racer),
    racer,
  };
}

function alongOf(level: Level, p: Vec3): number {
  const f = hillFrame(level);
  return f ? (p.x - f.x) * f.fx + (p.z - f.z) * f.fz : 0;
}

/** THE SHOT A MOMENT WANTS — before any holding. */
export function wantShot(m: JumpMoment): JumpShot {
  const hill = m.level.skiJump!;
  const C = JUMP_CAM;
  switch (m.stage) {
    case "bar":
      return m.t < C.tower ? "tower" : "bar";
    case "tracks":
      return m.along < m.gate + C.follow ? "bar" : "profile";
    case "air": {
      const flown = m.t - m.edgeAt;
      if (flown < C.airAfter) return "profile";
      const reach = hill.distanceAt(m.along) / hill.w;
      return reach >= C.landing.share || flown >= C.landing.after ? "landing" : "flight";
    }
    default: {
      const since = m.t - (m.edgeAt + m.flightTime);
      return m.edgeAt >= 0 && since < C.outrun.after ? "landing" : "outrun";
    }
  }
}

/** The vertical field of view that holds `world` m round a subject `dist`
 * m off, deg — or `fallback` when the shot holds no frame. */
function zoom(world: number, dist: number, fallback: number): number {
  if (world <= 0) return fallback;
  const fov = (2 * Math.atan(world / 2 / Math.max(0.5, dist)) * 180) / Math.PI;
  return clamp(fov, JUMP_CAM.fovMin, JUMP_CAM.fovMax);
}

/** Where `shot`'s lens stands this moment, in the world (before any lift
 * off the snow or for a line). */
function eyeOf(shot: JumpShot, m: JumpMoment, f: HillFrame): Vec3 {
  const hill = f.hill;
  const C = JUMP_CAM;
  switch (shot) {
    case "tower":
      return hillPoint(f, C.crane.d, C.crane.a, C.crane.h);
    case "bar":
      return hillPoint(f, m.gate + C.bar.ahead, C.bar.a, C.bar.h);
    case "profile":
      return hillPoint(f, hill.edge - C.profile.back, C.profile.a, C.profile.h);
    case "flight": {
      const d = m.along - C.rail.back;
      const a = -(landingWidth(hill, Math.max(hill.edge, d)) / 2 + C.rail.out);
      const at = hillPoint(f, d, a);
      return { x: at.x, y: Math.max(at.y, m.racer.y - C.rail.under), z: at.z };
    }
    case "landing": {
      const d = hill.k + C.landing.past;
      return hillPoint(f, d, -(landingWidth(hill, d) / 2 + C.landing.out), C.landing.h);
    }
    case "outrun":
      return hillPoint(f, hill.u + C.outrun.past, C.outrun.a, C.outrun.h);
  }
}

/** THE LENS `shot` frames `m` through: aimed at him, zoomed onto him, kept
 * over the snow, lifted until the line to him is open (`clear`, the
 * course's solids and the trees, and the snow itself). */
export function shotLens(shot: JumpShot, m: JumpMoment, clear?: LineClear): LensPose {
  const f = hillFrame(m.level)!;
  const C = JUMP_CAM;
  const eye = eyeOf(shot, m, f);
  const ground = (x: number, z: number) => m.level.groundAt(x, z);
  eye.y = Math.max(eye.y, ground(eye.x, eye.z) + C.clearance);
  const target: Vec3 = { x: m.racer.x, y: m.racer.y + 0.2, z: m.racer.z };
  if (shot === "tower") {
    // The opening holds the hill below him too: the aim led down the in-run.
    const k = hillPoint(f, f.hill.k, 0, 0);
    target.x += (k.x - target.x) * C.crane.lead;
    target.y += (k.y - target.y) * C.crane.lead;
    target.z += (k.z - target.z) * C.crane.lead;
  }
  for (let i = 0; i < C.tries && blocked(m.level, target, eye, clear); i++) eye.y += C.lift;
  const dist = Math.hypot(eye.x - m.racer.x, eye.y - m.racer.y, eye.z - m.racer.z);
  return { eye, target, fov: zoom(C.frame[shot], dist, C.crane.fov), roll: 0 };
}

/** Whether the line from him to the eye is shut: by the snow under it, or
 * by what `clear` calls solid. */
function blocked(level: Level, at: Vec3, eye: Vec3, clear?: LineClear): boolean {
  const n = 24;
  for (let k = 1; k < n; k++) {
    const s = k / n;
    const x = at.x + (eye.x - at.x) * s;
    const y = at.y + (eye.y - at.y) * s;
    const z = at.z + (eye.z - at.z) * s;
    if (level.groundAt(x, z) > y - 0.15) return true;
  }
  return clear ? clear(at, eye) < 0.999 : false;
}

/** THE DIRECTOR: the shot on air and when it was cut to. */
export type JumpDirector = {
  /** The lens this moment, or null on a map with no jump. */
  frame(m: JumpMoment | null, clear?: LineClear): LensPose | null;
  /** The shot on air (null before the first frame). */
  shot(): JumpShot | null;
  /** Forget the edit: a new jump, a seek. */
  reset(): void;
};

export function createJumpDirector(): JumpDirector {
  let on: JumpShot | null = null;
  let since = 0;
  let last = -Infinity;
  return {
    frame(m, clear) {
      if (!m) {
        on = null;
        return null;
      }
      // A clock run back or jumped is another take: the edit starts again.
      if (m.t < last - 1e-6 || m.t > last + 1) on = null;
      last = m.t;
      const want = wantShot(m);
      if (on === null) {
        on = want;
        since = m.t;
      } else if (want !== on && m.t - since >= JUMP_CAM.hold) {
        // Never back up the running order: a shot behind the one on air is
        // the moment it wanted already gone.
        if (JUMP_SHOTS.indexOf(want) > JUMP_SHOTS.indexOf(on)) {
          on = want;
          since = m.t;
        }
      }
      return shotLens(on, m, clear);
    },
    shot: () => on,
    reset() {
      on = null;
      last = -Infinity;
    },
  };
}

/** THE BROADCAST AS THE RENDERER RUNS IT: the director over a played jump
 * until the player picks a rung of his own (the camera press), and over a
 * replay watched on its BROADCAST angle ("tv") — null everywhere else, so
 * the ladder, the machines and the start's shots go on as before. */
export type JumpBroadcast = {
  lens(
    state: GameState,
    racer: Vec3,
    watched: { angle: string } | null,
    clear?: LineClear,
  ): LensPose | null;
  /** Whether the player picked a rung of his own (true: the run is his
   * ladder's until it begins again). */
  pick(chosen: boolean): void;
  /** The shot on air, or null. */
  shot(): JumpShot | null;
};

export function createJumpBroadcast(): JumpBroadcast {
  const director = createJumpDirector();
  let picked = false;
  let last = -Infinity;
  return {
    lens(state, racer, watched, clear) {
      // A run begun again is the broadcast's until he picks.
      if (state.t < last - 1e-6) picked = false;
      last = state.t;
      const on = watched ? watched.angle === "tv" : !picked;
      return director.frame(on ? jumpMoment(state, racer) : null, clear);
    },
    pick: (chosen) => void (picked = chosen),
    shot: () => director.shot(),
  };
}
