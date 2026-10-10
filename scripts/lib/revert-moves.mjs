// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REVERT LAB'S MOVES (`make revert`) — beside the skier lab's own
// (`skier-moves.mjs`, in the same shape, which the title scene is rendered
// off and so is kept apart): a skier riding switch slowed under 15 km/h
// turning round to ride forward (`engine/game/switch.ts`), the same with
// the edge held, hopped round off a jump under 40 km/h, and what follows.

const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
/** When the revert moves' skier has slowed under 15 km/h and starts to
 * turn round, s (`engine/game/switch.ts`). */
const REVERT_AT = 0.95;
/** Riding switch across the flat groomer at 17 km/h, tails first. */
const FLAT = (S) => S.flatLevel({ packed: 1, size: 3000 });
const SWITCHED = (speed) => () => ({ x: 1500, z: 200, heading: Math.PI, speed: -speed });

export const REVERT_MOVES = [
  {
    id: "revert",
    title:
      "riding SWITCH across the flat at 17 km/h: under 15 km/h he turns round (the revert) and poles away",
    level: FLAT,
    place: SWITCHED(4.6),
    seconds: 4,
    window: [REVERT_AT - 0.1, REVERT_AT + 0.8],
    input: () => IDLE,
    // The tricks run rides switch with the free ride's rules, and no crowd.
    mode: "tricks",
  },
  {
    id: "revert-steer",
    title: "the revert with the edge held to the right: turned round the way it asks",
    level: FLAT,
    place: SWITCHED(4.6),
    seconds: 4,
    window: [REVERT_AT - 0.1, REVERT_AT + 0.8],
    input: (t) => ({ ...IDLE, steer: t > REVERT_AT - 0.3 ? 1 : 0 }),
    mode: "tricks",
  },
  {
    id: "revert-hop",
    title:
      "riding SWITCH across the flat at 30 km/h, a jump popped: hopped round in the air off it",
    level: FLAT,
    place: SWITCHED(8.3),
    seconds: 2.5,
    window: [0.3, 1.3],
    input: (t) => ({ ...IDLE, jump: t >= 0.3 && t < 0.4 }),
    mode: "tricks",
  },
  {
    id: "revert-away",
    title: "the revert and what follows it: turned round, then the double pole and the skate",
    level: FLAT,
    place: SWITCHED(4.6),
    seconds: 6,
    window: [REVERT_AT - 0.2, REVERT_AT + 4],
    input: () => IDLE,
    mode: "tricks",
  },
];

export const REVERT_MOMENTS = [
  {
    id: "revert-in",
    move: "revert",
    t: REVERT_AT + 0.15,
    say: "the revert begun: the skis light, the head on the line",
  },
  {
    id: "revert-mid",
    move: "revert",
    t: REVERT_AT + 0.33,
    say: "the revert half way: the skis across the way, flat",
  },
  { id: "revert-hop", move: "revert-hop", t: 0.65, say: "hopped round off a jump, half way" },
  {
    id: "revert-out",
    move: "revert",
    t: REVERT_AT + 0.55,
    say: "the revert ending: faced down the line again",
  },
];
