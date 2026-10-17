// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LOOPS' MOVES — beside the skier lab's own (`skier-moves.mjs`, in the
// same shape, which the title scene is rendered off and so is kept apart):
// a backflip, a front flip and a spin off a kicker's lip, thrown as he
// leaves the snow and tucked or opened to come round (`engine/game/strokes.ts`).
// The board rides its own off a kicker (`board-trick-moves.mjs`).

const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
/** A kicker's lip at 65 km/h onto a 45 % landing. */
const LIP = (S) => S.flatLevel({ packed: 1, grade: 0.45, slopeFrom: 230 });
const OFF_LIP = () => ({ x: 1500, z: 200, heading: 0, speed: 18, height: 1.2, vy: 8.5 });
/** The lean thrown off the lip, then tucked or opened to come round onto
 * the skis (`strokes.ts`'s `flipLean`). */
const LEAN = (lean) => (_t, st, E) => ({
  ...IDLE,
  lean: st.skier.airborne ? E.flipLean(st, 1, lean) : 0,
});

export const FLIP_MOVES = [
  {
    id: "backflip",
    title: "a backflip off a kicker's lip at 65 km/h: tucked, opened to spot, landed",
    level: LIP,
    place: OFF_LIP,
    mode: "tricks",
    seconds: 2.4,
    window: [0.1, 1.3],
    input: LEAN(1),
  },
  {
    id: "frontflip",
    title: "a front flip off the same lip: tucked chin in, opened to the landing",
    level: LIP,
    place: OFF_LIP,
    mode: "tricks",
    seconds: 2.4,
    window: [0.1, 1.3],
    input: LEAN(-1),
  },
  {
    id: "backflip-off",
    title: "a backflip off the lip leaning, so the loop is not turned square",
    level: LIP,
    place: () => ({ ...OFF_LIP(), roll: 0.3 }),
    mode: "tricks",
    seconds: 2.4,
    window: [0.1, 1.3],
    input: LEAN(1),
  },
  {
    id: "backflip-short",
    title: "a backflip thrown too softly: short of his feet, down on his back",
    level: LIP,
    place: OFF_LIP,
    mode: "tricks",
    seconds: 3.2,
    window: [0.5, 2.6],
    input: (_t, st) => ({
      ...IDLE,
      lean: st.skier.airborne && st.skier.airTime < 0.3 ? 1 : 0,
    }),
  },
  {
    id: "backflip-held",
    title: "a backflip held tucked: round past his feet, down on his face",
    level: LIP,
    place: OFF_LIP,
    mode: "tricks",
    seconds: 3.2,
    window: [0.5, 2.6],
    input: (_t, st) => ({ ...IDLE, lean: st.skier.airborne ? 1 : 0 }),
  },
  {
    id: "spin",
    title: "a 360 off the same lip: the edge thrown over, spotted square",
    level: LIP,
    place: OFF_LIP,
    mode: "tricks",
    seconds: 2.4,
    window: [0.1, 1.3],
    input: (_t, st, E) => ({
      ...IDLE,
      steer: st.skier.airborne ? E.spinSteer(st, 2, 1) : 0,
    }),
  },
  {
    id: "spin-late",
    title:
      "a spin thrown late in a long flight: the edge pushed hard for a quarter second, then let go",
    level: LIP,
    place: () => ({ ...OFF_LIP(), vy: 12 }),
    mode: "tricks",
    seconds: 3.6,
    window: [0.5, 3.1],
    input: (t, st) => ({
      ...IDLE,
      steer: st.skier.airborne && t > 0.7 && t < 0.95 ? -1 : 0,
    }),
  },
];
