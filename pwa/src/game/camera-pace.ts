// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SENSE OF SPEED IN THE AIR — three-free, so the suite and the speed
// lab (`make speed-cam`) read it. The skier's booms fold three readings of
// pace into their framing (`camera-rigs.ts`'s `PACE`: the stretch, the
// surge, the tremor); a flyer's lenses (`camera-wingsuit.ts`,
// `camera-skydive.ts`) are planted off him each frame and had none, so a
// wingsuit at 180 km/h read as a figure hanging still over a far-off map.
// This is the same answer for a body in the air, stated once:
//
//   * THE STRETCH. The field widens with the airspeed and the lens pulls in
//     along its own line by `hold` of what keeps him his size — the world
//     rushes out past the frame's edges while he stays where he was. A
//     widened field is the one cue the studies of third-person racing
//     found raises the speed a player reads; a lens that runs further out
//     with speed shrinks him into the distance and reads slow.
//   * THE SURGE. The lens has mass: it falls back behind a flyer diving
//     into speed and closes in on one flaring out of it, then settles —
//     the chase camera's pull-back on a boost, driven by the acceleration
//     along his way, never by the speed itself.
//   * THE BUFFET. Past a brisk airspeed the lens is rocked by the air it
//     flies through: a few incommensurate swings, low and slow (a flyer's
//     body rides the air, it does not chatter like skis on ice), growing
//     with the dynamic pressure and easing in and out on an envelope —
//     never a fresh random offset a frame.
//   * THE BANK. A camera flyer banks with the flyer he follows: the horizon
//     takes a share of his bank, so a carved turn in the air reads as one.
//
// Motion blur is deliberately NOT one of them: a strong blur lowered the
// speed players read in the same studies, and the ice crystals streaking
// past the lens (`snowfall.ts`) are the peripheral flow instead.

import type { LensPose } from "./camera-rigs.ts";

type P = { x: number; y: number; z: number };

/** Every number the air's sense of speed is made of. */
export const FLIGHT_PACE = {
  stretch: {
    /** Where the field starts to widen and where it is wide, m/s. */
    from: 14,
    full: 70,
    /** Degrees it widens by, and the widest it is let go. */
    fov: 20,
    max: 92,
    /** Share of the widening the lens pulls in to keep him his size. */
    hold: 0.8,
  },
  surge: {
    /** Metres of standoff per m/s² along his way, the most either way. */
    gain: 0.18,
    max: 1.3,
    /** How briskly the acceleration is read and the lens follows it, 1/s. */
    read: 3,
    follow: 2.2,
  },
  buffet: {
    /** Where it starts and where it is whole, m/s. */
    from: 22,
    full: 75,
    /** How far the lens travels at the whole of it, m, and how far the
     * horizon cants, rad. */
    travel: 0.09,
    roll: 0.014,
    /** The swings, Hz: low, the air's, never the skis' chatter. */
    freq: [1.3, 2.3, 3.7, 5.3],
    /** How briskly the envelope follows, 1/s. */
    rise: 2,
  },
  /** Share of his bank the horizon takes on a boom. */
  bank: 0.3,
} as const;

/** How wide the field is let go at `speed` m/s on a lens of `fov` deg. */
export function stretchedFov(fov: number, speed: number): number {
  const S = FLIGHT_PACE.stretch;
  return Math.min(Math.max(fov, S.max), fov + S.fov * paceShare(speed, S.from, S.full));
}

/** 0..1 eased between `from` and `full`. */
export function paceShare(speed: number, from: number, full: number): number {
  const t = Math.max(0, Math.min(1, (speed - from) / (full - from)));
  return t * t * (3 - 2 * t);
}

/** How far along its own line a boom stands after the stretch, as a share
 * of its length: what keeps the subject his size at the wider field, by
 * `hold` of the way. */
export function heldShare(fov: number, wider: number, hold: number): number {
  const ratio = Math.tan((fov * Math.PI) / 360) / Math.tan((wider * Math.PI) / 360);
  return 1 - hold * (1 - ratio);
}

/** What the lens is handed a frame: the flyer at `at`, his way `way` (a
 * unit vector), his airspeed (m/s), his bank (rad, right side down), and
 * whether the lens is worn (his own eyes: no pull, no bank, the buffet in
 * the aim). */
export type PaceSubject = { at: P; way: P; speed: number; bank: number; worn: boolean };

export type FlightPace = {
  /** `lens` with the pace folded in, after `dt` s; `cut` forgets the past
   * (a restart, a lab's first frame). */
  apply(lens: LensPose, s: PaceSubject, dt: number, cut: boolean): LensPose;
  /** The standoff the surge has the lens out to this frame, m. */
  surge(): number;
};

export function createFlightPace(): FlightPace {
  let lastSpeed = 0;
  let accel = 0;
  let surge = 0;
  let clock = 0;
  let buzz = 0;
  let fresh = true;
  return {
    apply(lens, s, dt, cut) {
      const U = FLIGHT_PACE.surge;
      const B = FLIGHT_PACE.buffet;
      if (cut || fresh) {
        lastSpeed = s.speed;
        accel = 0;
        surge = 0;
        buzz = paceShare(s.speed, B.from, B.full);
        fresh = false;
      } else if (dt > 0) {
        const a = (s.speed - lastSpeed) / dt;
        lastSpeed = s.speed;
        accel += (a - accel) * (1 - Math.exp(-dt * U.read));
        const want = Math.max(-U.max, Math.min(U.max, accel * U.gain));
        surge += (want - surge) * (1 - Math.exp(-dt * U.follow));
        buzz += (paceShare(s.speed, B.from, B.full) - buzz) * (1 - Math.exp(-dt * B.rise));
        clock += dt;
      }
      const fov = stretchedFov(lens.fov, s.speed);
      const eye = { ...lens.eye };
      const target = { ...lens.target };
      if (!s.worn) {
        // Pulled in along its own line, then let back along his way.
        const k = heldShare(lens.fov, fov, FLIGHT_PACE.stretch.hold);
        eye.x = s.at.x + (eye.x - s.at.x) * k - s.way.x * surge;
        eye.y = s.at.y + (eye.y - s.at.y) * k - s.way.y * surge;
        eye.z = s.at.z + (eye.z - s.at.z) * k - s.way.z * surge;
      }
      // The buffet: a sum of slow swings on each axis, scaled by the
      // envelope — the eye on a boom, the aim through his own eyes.
      const f = B.freq;
      const w = (i: number, ph: number): number =>
        (Math.sin(clock * f[i] * 2 * Math.PI + ph) +
          0.6 * Math.sin(clock * f[(i + 2) % f.length] * 2 * Math.PI + ph * 1.7)) /
        1.6;
      const amp = B.travel * buzz;
      const shake = { x: w(0, 0.3) * amp, y: w(1, 1.9) * amp, z: w(3, 4.1) * amp * 0.5 };
      const into = s.worn ? target : eye;
      const scale = s.worn
        ? Math.hypot(target.x - eye.x, target.y - eye.y, target.z - eye.z) * 0.15
        : 1;
      into.x += shake.x * scale;
      into.y += shake.y * scale;
      into.z += shake.z * scale;
      const roll = lens.roll + (s.worn ? 0 : s.bank * FLIGHT_PACE.bank) + w(2, 2.7) * B.roll * buzz;
      return { eye, target, fov, roll };
    },
    surge: () => surge,
  };
}
