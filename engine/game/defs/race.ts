// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A RACE'S OWN NUMBERS, stated beside `TUNING` (which carries them as
// `TUNING.start` and `TUNING.flex`): the start push out of a slalom's start
// house and the flex poles of its gates — every number with its unit.

/** THE START PUSH out of a slalom's start house (`start-push.ts`): the
 * racer held in the hut on his planted poles after GO until he goes,
 * then ONE push — both poles, both skis together, a hop over the wand —
 * and no skating or poling after it: a slalom racer is at speed by the
 * first gate on the pitch below the hut. */
export const START_PUSH = {
  /** How long the push lasts, s, the speed it sends him out at, m/s, and
   * the hop he springs off it with, m/s up. */
  push: 0.35,
  speed: 4.2,
  hop: 0.9,
  /** How far the tuck must be held to throw him out, 0..1. */
  press: 0.5,
  /** How long the figure is told of the push after it, s. */
  shown: 1.2,
  /** OUT OF A SKI CROSS'S START GATE: how long after the doors drop the
   * pull on the handles can still throw him out, s. */
  gate: 1.5,
} as const;

/** THE FLEX POLES of a slalom's gates (R31, `gate-poles.ts`): a pole on
 * a hinge at the snow that a racer knocks over and that stands itself
 * back up — the turning pole is one by rule (at least 1.8 m over the
 * snow, its hinge's resistance at least 4 N·m a metre up) — and what
 * knocking one costs him. */
export const FLEX = {
  /** The pole's height over the snow, m. */
  height: 1.8,
  /** The hinge as a damped spring on the tilt: its stiffness, 1/s² (a
   * pole springing back up at about 2.5 Hz), and its damping, 1/s. */
  stiff: 247,
  damp: 7.5,
  /** The furthest a pole lies over, rad — on its hinge, short of the
   * snow. */
  most: 1.35,
  /** THE BODY that knocks it, as a plan line from his feet to his
   * shoulders `shoulder` m up the body from the CoG, `reach` m either
   * side of it — the shin guards, the knees, the hands and the arm a
   * racer clears a pole with. */
  shoulder: 0.55,
  reach: 0.24,
  /** What a knock costs: this share of the speed he drives into the
   * pole, and never more than `loss` m/s at a blow — a flex pole tips
   * at a few newtons against a skier's whole weight. */
  share: 0.05,
  loss: 0.25,
  /** A knock is reported at this closing speed, m/s. */
  knock: 0.4,
} as const;
