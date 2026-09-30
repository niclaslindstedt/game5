// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TV CAM — the run as a broadcast rather than as a ride, and the only
// camera in the game that is not hung off the skier.
//
// Every rung of the ladder (`camera-rigs.ts`) stands on or behind the
// skier and goes where he goes. This one is a LENS PLANTED IN THE SNOW at
// the edge of the wood, beside a moment the recording already knows is
// coming, and the only thing that happens while the run plays is that the
// skis arrives at it. Nothing follows. The skier comes.
//
// WHERE IT STANDS is decided by what the moment is:
//
//   A FLIGHT is shot from beside the KICKER it was launched off (the
//   nearest lip to the take-off that faces the same way), level with the
//   middle of the landing — so the skier comes off the lip at the lens and
//   crosses the frame against the sky, which is the only angle a jump has a
//   shape in. A flight off a crest no kicker made is shot from beside its
//   own take-off, along the line it was going.
//
//   THE FINISH is shot from beside the finish arch, just past the line, so
//   the skier comes through the arch at the lens.
//
//   ANYTHING ELSE (a pass, a trunk, a rival, a wipeout) from the edge of the
//   piste a little ahead of where it happened.
//
// ALWAYS AT THE EDGE OF THE WOOD, NEVER IN IT: the stand is tried beyond the
// track's own shoulder on the preferred side, then the other, then pushed
// further out, and a stand is taken only where the sightline from the moment
// to the lens is clear all the way (`camera-clear.ts` — the trunks, the
// crowns as drawn, the course's stakes and the arch). Asked FROM the moment
// TO the lens, because the line clear starts counting at its first open step:
// asked the other way, a lens standing inside a spruce would pass.
//
// THE OPERATOR IS SLOW, AND THE LENS BREATHES. The aim lags the skier (`pan`)
// and the zoom holds about `frame` metres of world across at whatever range
// the skier is, eased too slowly to keep up — so a skier far off is a long
// lens on a speck and the same skier arriving is wide open, which is what
// makes the arrival sudden.
//
// NOBODY RIDES FROM IT. A lens framed on the lip a skier is arriving at has
// the snow beyond it out of shot; it is reached only while a recording is
// watched (`replay-run.ts`'s `WATCHING_CAMERAS`). Which moment, when the cut lands
// and how slowly the picture runs are `replay-shots.ts`'s.
//
// Three-free: this turns a shot into a `LensPose` and the renderer applies it.

import { angleDiff, nearestTrackPoint, type Level } from "@engine";

import { clamp } from "@niclaslindstedt/oss-game-framework/core/math";
import type { LensPose, LineClear, Vec3 } from "./camera-rigs.ts";
import type { ReplayShot } from "./replay-shots.ts";

/** The whole camera, as numbers. Metres, seconds and degrees. */
export const TV = {
  /** How far past the track's own half-width the lens stands, m — over the
   * shoulder and the berm, at the first trees. */
  edge: 6,
  /** How much further out a fouled stand is tried, m, and how many times. */
  pushOut: 4,
  pushes: 4,
  /** How far ALONG the line from the moment the stand sits, m: beside the
   * middle of a kicker's landing, just past the finish line, a little ahead
   * of anything else — so the skier is still closing for most of the shot. */
  ahead: 10,
  pastLine: 5,
  landingShare: 0.55,
  /** A take-off is launched off a kicker if a lip stands within this, m,
   * facing within `kickerTurn` rad of the way the skis was going. */
  kickerReach: 30,
  kickerTurn: 1,
  /** The lens over the snow under it, m: a camera on a tripod, low so a skis
   * in the air is against the sky. */
  lift: 1.6,
  /** Where on the skis the aim sits, m over its centre — the skier. */
  aimUp: 0.9,
  /** How fast the aim follows, 1/s. Loose on purpose. */
  pan: 4.5,
  /** The width of world the lens tries to hold at the skis, m (about five
   * skis lengths), the zoom's two ends, deg, and how fast it works, 1/s. */
  frame: 14,
  fovMin: 12,
  fovMax: 70,
  zoom: 2.8,
  /** The least range the zoom solves for, m. */
  near: 5,
  /** How much of the sightline must be clear to take a stand. */
  sightline: 0.999,
} as const;

/** Where a lens has been planted — fixed for the life of the shot. */
export type Stand = Vec3;

/** Where the moment happens and which way it runs: the anchor the stand is
 * measured off, and how far along from it the lens is placed. */
function anchorOf(
  shot: ReplayShot,
  level: Level,
): { x: number; z: number; heading: number; along: number } {
  if (shot.kind === "finish") {
    // The FINISH LINE is the piste's last gate, under the arch.
    const line = level.checkpoints[level.checkpoints.length - 1];
    return { x: line.x, z: line.z, heading: line.heading, along: TV.pastLine };
  }
  if (shot.kind === "air") {
    let best = null as { x: number; z: number; heading: number; along: number } | null;
    let bestD: number = TV.kickerReach;
    for (const k of level.kickers ?? []) {
      const d = Math.hypot(k.x - shot.x, k.z - shot.z);
      if (d >= bestD || Math.abs(angleDiff(k.heading, shot.heading)) > TV.kickerTurn) continue;
      bestD = d;
      best = { x: k.x, z: k.z, heading: k.heading, along: k.landing * TV.landingShare };
    }
    if (best) return best;
  }
  return { x: shot.x, z: shot.z, heading: shot.heading, along: TV.ahead };
}

/** WHERE THE LENS IS PLANTED for a shot, before the skier has got anywhere
 * near it — or NULL where there is nowhere clear to stand one, and the
 * moment keeps the boom. Pure, so `tests/replay_test.ts` holds it. The side
 * alternates with the shot's own step, so two shots in a row are not the
 * same angle. */
export function standFor(shot: ReplayShot, level: Level, clear: LineClear): Stand | null {
  const a = anchorOf(shot, level);
  const fx = Math.sin(a.heading);
  const fz = Math.cos(a.heading);
  const rx = Math.cos(a.heading);
  const rz = -Math.sin(a.heading);
  const hit = nearestTrackPoint(level, a.x, a.z);
  const half = level.track.points[hit.index].width / 2;
  const first: 1 | -1 = shot.at % 2 === 0 ? 1 : -1;
  const target = { x: a.x, y: level.groundAt(a.x, a.z) + TV.aimUp, z: a.z };
  const bx = a.x + fx * a.along;
  const bz = a.z + fz * a.along;
  for (let push = 0; push <= TV.pushes; push++) {
    const out = half + TV.edge + push * TV.pushOut;
    for (const side of [first, -first]) {
      const x = bx + rx * out * side;
      const z = bz + rz * out * side;
      if (x < 0 || z < 0 || x > level.size || z > level.size) continue;
      const stand = { x, y: level.groundAt(x, z) + TV.lift, z };
      if (clear(target, stand) >= TV.sightline) return stand;
    }
  }
  return null;
}

export type TvCamera = {
  /** Frame `shot` from the stand it earns. A shot not seen before lands as a
   * CUT — the aim and the lens snapped. Null where there is nowhere to stand
   * a lens for it: the caller keeps the boom. */
  update: (
    shot: ReplayShot,
    skis: Vec3,
    level: Level,
    clear: LineClear,
    dt: number,
  ) => LensPose | null;
  /** Forget the live stand, so the next shot lands as a cut. */
  drop: () => void;
};

export function createTvCamera(): TvCamera {
  /** The shot the live stand was planted for, by its own step; -1 off one. */
  let live = -1;
  let stand: Stand | null = null;
  const aim = { x: 0, y: 0, z: 0 };
  let fov: number = TV.fovMax;
  const pose: LensPose = { eye: { x: 0, y: 0, z: 0 }, target: aim, fov, roll: 0 };

  return {
    drop: () => {
      live = -1;
      stand = null;
    },
    update: (shot, skis, level, clear, dt) => {
      const cut = shot.at !== live;
      if (cut) {
        live = shot.at;
        stand = standFor(shot, level, clear);
      }
      if (!stand) return null;
      const toY = skis.y + TV.aimUp;
      if (cut) {
        aim.x = skis.x;
        aim.y = toY;
        aim.z = skis.z;
      } else {
        const follow = clamp(TV.pan * dt, 0, 1);
        aim.x += (skis.x - aim.x) * follow;
        aim.y += (toY - aim.y) * follow;
        aim.z += (skis.z - aim.z) * follow;
      }
      const range = Math.max(
        TV.near,
        Math.hypot(skis.x - stand.x, toY - stand.y, skis.z - stand.z),
      );
      const want = clamp(
        (2 * Math.atan(TV.frame / (2 * range)) * 180) / Math.PI,
        TV.fovMin,
        TV.fovMax,
      );
      fov = cut ? want : fov + (want - fov) * clamp(TV.zoom * dt, 0, 1);
      pose.eye.x = stand.x;
      pose.eye.y = stand.y;
      pose.eye.z = stand.z;
      pose.fov = fov;
      return pose;
    },
  };
}
