// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LOOPS' MOVES — beside the skier lab's own (`skier-moves.mjs`, in the
// same shape, which the title scene is rendered off and so is kept apart):
// a backflip and a front flip off a kicker's lip, the lean held once the
// flight is under way (`engine/game/strokes.ts`). The board skis them too.

const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
/** A kicker's lip at 65 km/h onto a 45 % landing. */
const LIP = (S) => S.flatLevel({ packed: 1, grade: 0.45, slopeFrom: 230 });
const OFF_LIP = () => ({ x: 1500, z: 200, heading: 0, speed: 18, height: 1.2, vy: 8.5 });
const LEAN = (lean) => (_t, st) => ({
  ...IDLE,
  lean: st.skier.airborne && st.skier.airTime > 0.25 ? lean : 0,
});

export const FLIP_MOVES = [
  {
    id: "backflip",
    title: "a backflip off a kicker's lip at 65 km/h: tucked, opened to spot, landed",
    level: LIP,
    place: OFF_LIP,
    mode: "tricks",
    seconds: 2.4,
    window: [0.1, 0.75],
    input: LEAN(1),
  },
  {
    id: "frontflip",
    title: "a front flip off the same lip: tucked chin in, opened to the landing",
    level: LIP,
    place: OFF_LIP,
    mode: "tricks",
    seconds: 2.4,
    window: [0.1, 0.75],
    input: LEAN(-1),
  },
];
