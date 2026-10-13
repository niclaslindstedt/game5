// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LOOPS' MOVES — beside the skier lab's own (`skier-moves.mjs`, in the
// same shape, which the title scene is rendered off and so is kept apart):
// a backflip, a front flip and a held spin off a kicker's lip, the lean held once the
// flight is under way and let go to come round (`engine/game/strokes.ts`).
// The board skis them too.

const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
/** A kicker's lip at 65 km/h onto a 45 % landing. */
const LIP = (S) => S.flatLevel({ packed: 1, grade: 0.45, slopeFrom: 230 });
const OFF_LIP = () => ({ x: 1500, z: 200, heading: 0, speed: 18, height: 1.2, vy: 8.5 });
/** The lean held once he is up, and let go in time to come round onto
 * the skis (`strokes.ts`'s `flipLean`). */
const LEAN = (lean) => (_t, st, E) => ({
  ...IDLE,
  lean: st.skier.airborne && st.skier.airTime > 0.25 ? E.flipLean(st, 1, lean) : 0,
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
    id: "spin",
    title: "a spin off the same lip: the edge held over, let go, settled square",
    level: LIP,
    place: OFF_LIP,
    mode: "tricks",
    seconds: 2.4,
    window: [0.1, 1.3],
    input: (_t, st) => ({
      ...IDLE,
      steer: st.skier.airborne && st.skier.airTime > 0.25 && st.skier.airTime < 0.8 ? 1 : 0,
    }),
  },
];
