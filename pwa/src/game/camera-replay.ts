// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REPLAY'S CAMERAS — the lenses a recording is watched through, and the
// only cameras in the game that are not the skier's own.
//
// ONE RULE OVER ALL OF THEM: THE SKIER IS IN THE PICTURE. Every lens here
// is aimed at HIM — at his hips on his skis, at his body once he is thrown
// off them (never at the skis sliding on without him) — and every lens is
// kept where it can see him: above the snow under it, with no slope and no
// trunk between it and him (lifted, swung to his other side or brought in
// until the line is open). A replay that frames the mountain with him
// somewhere behind it is a replay that has lost the one thing it is for.
//
// AND CLOSE. A replay is watched to see what HE did, so every lens stands a
// few metres off him and comes further away only where the distance is the
// point: the aerial lens, and the long lens a kicker's flight is framed in,
// whose arc has no shape from closer.
//
// THE ANGLES (`REPLAY_ANGLES`), each one a button press on the bar:
//
//   CLOSE   low behind him and a little to the side, wide: the snow coming
//           at the lens and him filling the bottom of the frame.
//   SIDE    running alongside him, level with his hips — the turn, the
//           angulation, the edge, side on.
//   FRONT   ahead of him and looking back: him coming at the lens.
//   AERIAL  up over him and behind, circling slowly — the line he skied
//           and where it took him.
//
// AND THE BROADCAST (`tv`), which DIRECTS: between moments it cuts between
// CLOSE, SIDE and FRONT every few seconds of the run, and for a moment the
// recording knows is coming (`replay-shots.ts`: a flight, a crash, a pass,
// the flag) it plants a lens in the snow beside where it happens — beside
// the kicker's landing, just past the finish line, a few metres ahead of
// anything else — and lets him arrive at it, the lens's zoom holding a
// few metres of world round him so the arrival is sudden. Planted beside
// HIS line rather than the piste's edge: a wide piste is no reason to stand
// the lens thirty metres off him.
//
// Every lens moves on the RECORDING's clock (paused, it holds; in slow
// motion it moves slowly), and a cut — a new angle, a new moment, a seek —
// lands at once rather than swinging across the mountain.
//
// Three-free: this turns a subject into a `LensPose` and the renderer
// applies it (`renderer.setReplayCam`).

import { angleDiff, type Level } from "@engine";

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { LensPose, LineClear, RigPose, Vec3 } from "./camera-rigs.ts";
import type { ReplayShot } from "./replay-shots.ts";

/** The replay's own lenses: the broadcast and the four it cuts between. */
export const REPLAY_ANGLES = ["tv", "close", "side", "front", "aerial"] as const;
export type ReplayAngle = (typeof REPLAY_ANGLES)[number];

export function isReplayAngle(rung: string): rung is ReplayAngle {
  return (REPLAY_ANGLES as readonly string[]).includes(rung);
}

/** One follow lens, in the frame of the way he is going: `back` m behind
 * him (negative ahead), `side` m to the side, `up` m over his hips; it
 * looks `lead` m ahead of him and `drop` m under his hips; `fov` deg. */
type Follow = { back: number; side: number; up: number; lead: number; drop: number; fov: number };

/** THE WHOLE CAMERA, as numbers. Metres, seconds and degrees. */
export const REPLAY_LENS = {
  close: { back: 3.6, side: 1.1, up: 0.9, lead: 2.2, drop: 0.35, fov: 64 },
  side: { back: -0.8, side: 5.2, up: 0.4, lead: 0.9, drop: 0.2, fov: 54 },
  front: { back: -6.5, side: 1.4, up: 0.8, lead: 0, drop: 0.25, fov: 50 },
  aerial: { back: 9, side: 0, up: 7.5, lead: 3, drop: 0.6, fov: 52 },
  /** The aerial lens circles him, rad/s, never more than this far round
   * from behind, rad. */
  circle: 0.16,
  swing: 1.1,
  /** Where on him the aim sits on his skis, m over the skis (his hips). */
  hips: 0.9,
  /** The broadcast's cut between follow lenses, s of the run, and the
   * lenses it cuts between, in order. */
  cycle: 4.5,
  cuts: ["close", "side", "front", "close", "aerial", "side"] as readonly Exclude<
    ReplayAngle,
    "tv"
  >[],
  /** A PLANTED lens: how far to the side of his line it stands, m (and how
   * much further each retry, how many), how far along from the moment, m —
   * beside the middle of a kicker's landing, just past the finish line, a
   * few metres ahead of anything else — and how high over the snow. */
  plant: { side: 5, pushOut: 2.5, pushes: 3, ahead: 7, pastLine: 4, landingShare: 0.55 },
  plantLift: 1.3,
  /** A take-off is off a kicker if a lip stands within this, m, facing
   * within `kickerTurn` rad of the way he was going. */
  kickerReach: 30,
  kickerTurn: 1,
  /** The planted lens's zoom: the width of world it holds round him, m —
   * wider for a flight, whose arc is the picture — its two ends, deg, and
   * how fast it works, 1/s; the least range it solves for, m. */
  frame: 6,
  frameAir: 11,
  fovMin: 16,
  fovMax: 72,
  zoom: 3,
  near: 3,
  /** A planted lens is given up for the follow lens once he is this far
   * from it, m — it has done its work. */
  leave: 28,
  /** How fast the lens follows its place and its aim, 1/s; the way he is
   * going is turned toward his travel at `turn`, slower once thrown, so a
   * tumble does not spin the lens. */
  follow: 5.5,
  aim: 11,
  turn: 3,
  turnThrown: 1.2,
  /** A jump of the run's clock past this, s, is a seek: a cut. */
  jump: 0.5,
  /** Under this speed, m/s, his facing is the way he is going. */
  still: 1.5,
  /** The least clearance of the lens over the snow under it, m, and of the
   * sightline over the snow it crosses; how much the lens is lifted each
   * try to open a line, m, and the most. */
  clearance: 0.7,
  sight: 0.25,
  raise: 0.6,
  raiseMost: 9,
  /** How much of the sightline must be clear of the trunks. */
  sightline: 0.999,
} as const;

/** WHO THE LENS IS ON: his hips on his skis, his body once thrown. */
export type Subject = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  thrown: boolean;
};

/** Whether the snow stands between `a` and `b` anywhere along the line. */
export function snowBetween(level: Level, a: Vec3, b: Vec3, margin = 0): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(2, Math.ceil(d / 0.75));
  for (let k = 1; k < n; k++) {
    const f = k / n;
    const x = a.x + (b.x - a.x) * f;
    const z = a.z + (b.z - a.z) * f;
    if (a.y + (b.y - a.y) * f < level.groundAt(x, z) + margin) return true;
  }
  return false;
}

/** A lens at `eye` made to see `at`: set over the snow under it, then
 * lifted until neither the slope nor (where `clear` is asked) a crown
 * stands between them. Returns how far it was lifted, m. */
export function openLine(level: Level, at: Vec3, eye: Vec3, clear?: LineClear): number {
  const floor = level.groundAt(eye.x, eye.z) + REPLAY_LENS.clearance;
  if (eye.y < floor) eye.y = floor;
  let lifted = 0;
  while (lifted < REPLAY_LENS.raiseMost) {
    const snow = snowBetween(level, at, eye, REPLAY_LENS.sight);
    if (!snow && (!clear || clear(at, eye) >= REPLAY_LENS.sightline)) break;
    eye.y += REPLAY_LENS.raise;
    lifted += REPLAY_LENS.raise;
  }
  return lifted;
}

/** Where the moment happens and which way it runs: the anchor a planted
 * lens is measured off, and how far along from it it stands. */
function anchorOf(
  shot: ReplayShot,
  level: Level,
): { x: number; z: number; heading: number; along: number; air: boolean } {
  const P = REPLAY_LENS.plant;
  if (shot.kind === "finish") {
    const line = level.checkpoints[level.checkpoints.length - 1];
    return { x: line.x, z: line.z, heading: line.heading, along: P.pastLine, air: false };
  }
  if (shot.kind === "air") {
    let best = null as ReturnType<typeof anchorOf> | null;
    let bestD: number = REPLAY_LENS.kickerReach;
    for (const k of level.kickers ?? []) {
      const d = Math.hypot(k.x - shot.x, k.z - shot.z);
      if (d >= bestD || Math.abs(angleDiff(k.heading, shot.heading)) > REPLAY_LENS.kickerTurn)
        continue;
      bestD = d;
      best = { x: k.x, z: k.z, heading: k.heading, along: k.landing * P.landingShare, air: true };
    }
    if (best) return best;
    return { x: shot.x, z: shot.z, heading: shot.heading, along: P.ahead + 3, air: true };
  }
  return { x: shot.x, z: shot.z, heading: shot.heading, along: P.ahead, air: false };
}

/** WHERE A LENS IS PLANTED for a moment, before he has got anywhere near
 * it — a few metres off his line, level with where it happens, with the
 * line from the moment to it open — or NULL where nowhere near is open,
 * and the moment keeps the follow lens. Pure, so `tests/replay_test.ts`
 * holds it. The side alternates with the shot's own step. */
export function standFor(shot: ReplayShot, level: Level, clear: LineClear): Vec3 | null {
  const P = REPLAY_LENS.plant;
  const a = anchorOf(shot, level);
  const fx = Math.sin(a.heading);
  const fz = Math.cos(a.heading);
  const rx = Math.cos(a.heading);
  const rz = -Math.sin(a.heading);
  const first: 1 | -1 = shot.at % 2 === 0 ? 1 : -1;
  const target = { x: a.x, y: level.groundAt(a.x, a.z) + REPLAY_LENS.hips, z: a.z };
  const bx = a.x + fx * a.along;
  const bz = a.z + fz * a.along;
  for (let push = 0; push <= P.pushes; push++) {
    const out = P.side + push * P.pushOut;
    for (const side of [first, -first]) {
      const x = bx + rx * out * side;
      const z = bz + rz * out * side;
      if (x < 0 || z < 0 || x > level.size || z > level.size) continue;
      const stand = { x, y: level.groundAt(x, z) + REPLAY_LENS.plantLift, z };
      if (clear(target, stand) < REPLAY_LENS.sightline) continue;
      if (snowBetween(level, target, stand, REPLAY_LENS.sight)) continue;
      return stand;
    }
  }
  return null;
}

/** Where a follow lens wants to stand and look, for a subject going `way`
 * (rad), on `side` (±1), `t` s into the run. Pure. */
export function followPose(
  angle: Exclude<ReplayAngle, "tv">,
  at: Vec3,
  way: number,
  side: 1 | -1,
  t: number,
  eye: Vec3,
  target: Vec3,
): number {
  const f: Follow = REPLAY_LENS[angle];
  let yaw = way;
  if (angle === "aerial") yaw += Math.sin(t * REPLAY_LENS.circle) * REPLAY_LENS.swing * side;
  const fx = Math.sin(yaw);
  const fz = Math.cos(yaw);
  const rx = Math.cos(yaw);
  const rz = -Math.sin(yaw);
  eye.x = at.x - fx * f.back + rx * f.side * side;
  eye.y = at.y + f.up;
  eye.z = at.z - fz * f.back + rz * f.side * side;
  target.x = at.x + Math.sin(way) * f.lead;
  target.y = at.y - f.drop;
  target.z = at.z + Math.cos(way) * f.lead;
  return f.fov;
}

/** What a recording is watched on: the angle, and the broadcast's moment. */
export type ReplayView = { angle: ReplayAngle; shot: ReplayShot | null };

/** The body thrown off his skis, as the renderer draws it (`interp.ts`). */
export type ThrownBody = { x: number; y: number; z: number; vx: number; vz: number };

/** The map and its sightline test, while one is loaded. */
export type ReplayWorld = () => { level: Level; clear: LineClear } | null;

export type ReplayCamera = {
  /** Frame him on `view` this frame: `rig` his drawn pose, `body` his body
   * when he is thrown, `t` the run's clock, `dt` the recording's seconds
   * since the last frame (0 paused). Null with no map loaded. */
  update: (
    view: ReplayView,
    rig: RigPose,
    body: ThrownBody | null,
    t: number,
    dt: number,
  ) => LensPose | null;
  /** Forget everything, so the next frame lands as a cut. */
  drop: () => void;
};

/** WHO THE LENS IS ON, off what the renderer has of him. */
export function subjectOf(rig: RigPose, body: ThrownBody | null, out: Subject): Subject {
  if (body) {
    out.x = body.x;
    out.y = body.y;
    out.z = body.z;
    out.vx = body.vx;
    out.vz = body.vz;
  } else {
    out.x = rig.x;
    out.y = rig.y + REPLAY_LENS.hips;
    out.z = rig.z;
    out.vx = rig.vx;
    out.vz = rig.vz;
  }
  out.heading = rig.heading;
  out.thrown = body !== null;
  return out;
}

export function createReplayCamera(world: ReplayWorld): ReplayCamera {
  /** What the lens was last framed as: the angle and, planted, the shot's
   * step. A change is a CUT. */
  let was = "";
  let stand: Vec3 | null = null;
  /** The shot the stand was looked for, by its own step; -1 none. */
  let standOf = -1;
  let way = 0;
  let side: 1 | -1 = 1;
  let fov = 60;
  const eye = { x: 0, y: 0, z: 0 };
  const aim = { x: 0, y: 0, z: 0 };
  const wantEye = { x: 0, y: 0, z: 0 };
  const wantAim = { x: 0, y: 0, z: 0 };
  const at = { x: 0, y: 0, z: 0 };
  const subject: Subject = { x: 0, y: 0, z: 0, vx: 0, vz: 0, heading: 0, thrown: false };
  /** The run's clock last framed: a step back or a jump on is a seek. */
  let last = -Infinity;
  const pose: LensPose = { eye, target: aim, fov, roll: 0 };

  return {
    drop: () => {
      was = "";
      stand = null;
      standOf = -1;
    },
    update: (view, rig, body, t, wall) => {
      const map = world();
      if (!map) return null;
      const { level, clear } = map;
      const { angle, shot } = view;
      const dt = Math.min(wall, 0.1);
      if (t < last || t > last + REPLAY_LENS.jump) {
        was = "";
        standOf = -1;
      }
      last = t;
      subjectOf(rig, body, subject);
      at.x = subject.x;
      at.y = subject.y;
      at.z = subject.z;
      // THE WAY HE IS GOING, turned toward his travel — slowly once thrown.
      const speed = Math.hypot(subject.vx, subject.vz);
      const going =
        speed > REPLAY_LENS.still ? Math.atan2(subject.vx, subject.vz) : subject.heading;

      // WHICH LENS: the broadcast plants one for a moment and cuts between
      // the follow lenses otherwise.
      let lens: Exclude<ReplayAngle, "tv"> | "plant" = angle === "tv" ? "close" : angle;
      let key: string = angle;
      if (angle === "tv") {
        const n = Math.floor(Math.max(0, t) / REPLAY_LENS.cycle);
        lens = REPLAY_LENS.cuts[n % REPLAY_LENS.cuts.length];
        key = `tv:${n}`;
        if (shot) {
          const k = `shot:${shot.at}`;
          if (standOf !== shot.at) {
            standOf = shot.at;
            stand = standFor(shot, level, clear);
          }
          if (stand && Math.hypot(at.x - stand.x, at.z - stand.z) < REPLAY_LENS.leave) {
            lens = "plant";
            key = k;
          }
        }
      }
      const cut = key !== was;
      was = key;
      if (cut) {
        way = going;
        // The side the run's own clock deals, so two cuts in a row are
        // never the same framing.
        side = Math.floor(t / REPLAY_LENS.cycle) % 2 === 0 ? 1 : -1;
      } else {
        const rate = subject.thrown ? REPLAY_LENS.turnThrown : REPLAY_LENS.turn;
        way += angleDiff(way, going) * clamp(rate * dt, 0, 1);
      }

      let want: number;
      if (lens === "plant") {
        const s = stand!;
        wantEye.x = s.x;
        wantEye.y = s.y;
        wantEye.z = s.z;
        wantAim.x = at.x;
        wantAim.y = at.y;
        wantAim.z = at.z;
        const range = Math.max(REPLAY_LENS.near, Math.hypot(at.x - s.x, at.y - s.y, at.z - s.z));
        const width = shot?.kind === "air" ? REPLAY_LENS.frameAir : REPLAY_LENS.frame;
        want = clamp(
          (2 * Math.atan(width / (2 * range)) * 180) / Math.PI,
          REPLAY_LENS.fovMin,
          REPLAY_LENS.fovMax,
        );
      } else {
        want = followPose(lens, at, way, side, t, wantEye, wantAim);
        // KEPT WHERE IT SEES HIM: the other side where this one is closed,
        // then lifted until the line is open.
        if (lens !== "aerial" && snowOrWood(level, at, wantEye, clear)) {
          followPose(lens, at, way, side === 1 ? -1 : 1, t, wantEye, wantAim);
          if (!snowOrWood(level, at, wantEye, clear)) side = side === 1 ? -1 : 1;
          else followPose(lens, at, way, side, t, wantEye, wantAim);
        }
        openLine(level, at, wantEye, clear);
      }

      if (cut) {
        Object.assign(eye, wantEye);
        Object.assign(aim, wantAim);
        fov = want;
      } else {
        const f = lens === "plant" ? 1 : clamp(REPLAY_LENS.follow * dt, 0, 1);
        const a = clamp(REPLAY_LENS.aim * dt, 0, 1);
        eye.x += (wantEye.x - eye.x) * f;
        eye.y += (wantEye.y - eye.y) * f;
        eye.z += (wantEye.z - eye.z) * f;
        aim.x += (wantAim.x - aim.x) * a;
        aim.y += (wantAim.y - aim.y) * a;
        aim.z += (wantAim.z - aim.z) * a;
        fov += (want - fov) * clamp(REPLAY_LENS.zoom * dt, 0, 1);
      }
      // The eased lens may have drifted under a crest the wanted one cleared.
      const floor = level.groundAt(eye.x, eye.z) + REPLAY_LENS.clearance;
      if (eye.y < floor) eye.y = floor;
      pose.fov = fov;
      return pose;
    },
  };
}

/** Whether the slope or a trunk stands between him and a lens. */
function snowOrWood(level: Level, at: Vec3, eye: Vec3, clear: LineClear): boolean {
  return snowBetween(level, at, eye, REPLAY_LENS.sight) || clear(at, eye) < REPLAY_LENS.sightline;
}
