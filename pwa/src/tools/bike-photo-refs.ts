// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PHOTOGRAPHS AS NUMBERS (`make bike-photo`): for every clip of
// `bike-clips.ts`, the figures traced off 2–4 reference frames of real
// downhill and freeride riders doing the same thing — side-on where the
// frames allowed it, the angles read with a protractor laid on the frame,
// the heights scaled off the wheel (a 27.5″ wheel is 0.71 m across). The
// photographs themselves are studied locally and never committed; these
// numbers are what they say. `bike-photo-match.mjs` scores the game's
// rider against them.
//
//   knee, elbow   the inside angle, deg (a straight limb 180°): the clip's
//                 middle frame (its median) — for the foot out, the foot on
//                 its pedal
//   trunk         the trunk's bend forward of the bike's up, deg
//   hips          the hips' middle over the bottom bracket, cm
//   back          the hips' middle behind it, cm
//   travel        the hips' rise and fall over the clip, cm
//   least         the deepest knee of the clip, deg (a landing's fold)
//   yaw, roll     the bike turned and laid under him at a trick's peak, deg

export type PhotoRef = {
  /** How many frames it was traced off. */
  frames: number;
  knee?: number;
  elbow?: number;
  trunk?: number;
  hips?: number;
  back?: number;
  travel?: number;
  least?: number;
  yaw?: number;
  roll?: number;
};

/** How far off a figure may be before it reads wrong at chase range. */
export const PHOTO_TOLERANCE: Record<Exclude<keyof PhotoRef, "frames">, number> = {
  knee: 15,
  elbow: 15,
  trunk: 10,
  hips: 8,
  back: 8,
  travel: 10,
  least: 12,
  yaw: 15,
  roll: 15,
};

export const PHOTO_REFS: Record<string, PhotoRef> = {
  // Stood up on the pedals out of the gate and on a fast straight: cranks
  // level between strokes, hips a hand behind them, chest low.
  pedal: { frames: 2, knee: 120, elbow: 108, trunk: 58, hips: 74, back: 26 },
  // Linked flat turns: the bike laid under a body held nearer upright, the
  // outside pedal down, the hips dropped a little.
  turns: { frames: 3, knee: 112, elbow: 102, trunk: 60, hips: 70, back: 14 },
  // A berm: laid over with the bike, lower, the inside knee folded, the
  // head low over the stem.
  berm: { frames: 3, knee: 102, elbow: 98, trunk: 62, hips: 66, back: 15 },
  // A pump: the legs and arms folding into the back of the roller and
  // pushed out down its face; the head stays.
  pump: { frames: 2, knee: 106, elbow: 104, trunk: 58, hips: 67, travel: 22, least: 85 },
  // A jump: the bike pulled up under him in the air, knees bent, elbows
  // out, the trunk prouder than on the ground.
  jump: { frames: 4, knee: 102, elbow: 110, trunk: 52, hips: 66, least: 85 },
  // A whip: the rear swung out and the bike laid over at the peak, the
  // knees bent, the shoulders kept down the trail.
  whip: { frames: 4, knee: 96, elbow: 106, trunk: 52, hips: 64, yaw: 55, roll: 45 },
  // A table: the bike laid flat on its side, little yaw, knees tucked.
  table: { frames: 2, knee: 92, elbow: 100, trunk: 55, hips: 62, roll: 65 },
  // A landing: legs reached out for the ground, then folded deep into it.
  land: { frames: 2, knee: 110, elbow: 106, trunk: 56, hips: 70, least: 86, travel: 24 },
  // On the levers: hips well back and down, arms longer, heels dropped.
  brake: { frames: 2, knee: 118, elbow: 124, trunk: 50, hips: 68, back: 22 },
  // The foot out: the outside foot on its pedal (the inside one off),
  // elbows wide, the trunk over the bars.
  footout: { frames: 2, knee: 108, elbow: 100, trunk: 52, hips: 66 },
};
