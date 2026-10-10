// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOP INTO SWITCH LAB'S MOVES (`make hop-switch`) — beside the skier
// lab's own and the revert's, in the same shape: a skier riding forward
// who loads a jump with the edge held winds up against it, pops, and is
// turned half round in the air off it to land riding switch
// (`engine/game/switch.ts`'s `hopSwitch`) — to the right, to the left,
// quick off a tap of the jump, and what follows it (the look back over the
// shoulder, riding switch away).

const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
/** When the jump is pressed, and how long it is held (the legs loading,
 * the shoulders winding up), s. */
const PRESS = 0.4;
const HOLD = 0.35;
/** Riding forward down a gentle groomer at 22 km/h. */
const SLOPE = (S) => S.flatLevel({ packed: 1, size: 3000, grade: 0.08, slopeFrom: 0 });
const FORWARD = (speed) => () => ({
  x: 1500,
  z: 200,
  heading: 0,
  pitch: -Math.atan(0.08),
  speed,
});
/** The edge held to `side` from `from` s after the jump is pressed (the
 * legs loading) until he is round. */
const hop =
  (side, hold = HOLD, from = 0) =>
  (t) => ({
    ...IDLE,
    steer: t >= PRESS + from && t < PRESS + hold + 0.3 ? side : 0,
    jump: t >= PRESS && t < PRESS + hold,
  });
/** The frames: from the end of the load to a moment after the landing —
 * the turn itself is some 0.3 s. */
const AROUND = (hold = HOLD) => [PRESS + hold - 0.15, PRESS + hold + 0.5];

export const HOP_SWITCH_MOVES = [
  {
    id: "hop-switch",
    title:
      "riding forward at 22 km/h, the jump loaded with the edge held to the right: wound up, popped and hopped round into SWITCH",
    level: SLOPE,
    place: FORWARD(6),
    seconds: 2.5,
    window: AROUND(),
    input: hop(1),
    // The tricks run rides switch with the free ride's rules, and no crowd.
    mode: "tricks",
  },
  {
    id: "hop-switch-left",
    title: "the same with the edge held to the left: turned round the other way",
    level: SLOPE,
    place: FORWARD(6),
    seconds: 2.5,
    window: AROUND(),
    input: hop(-1),
    mode: "tricks",
  },
  {
    id: "hop-switch-tap",
    title: "a quick tap of the jump with the edge held: the shortest hop round, barely wound up",
    level: SLOPE,
    place: FORWARD(6),
    seconds: 2,
    window: AROUND(0.1),
    input: hop(1, 0.1),
    mode: "tricks",
  },
  {
    id: "hop-switch-late",
    title:
      "the jump loaded with nothing held, the edge to the right pressed just after the pop: hopped round off the snow already",
    level: SLOPE,
    place: FORWARD(6),
    seconds: 2.5,
    window: AROUND(),
    input: hop(1, HOLD, HOLD + 0.05),
    mode: "tricks",
  },
  {
    id: "hop-switch-away",
    title:
      "the hop into switch and what follows it: riding switch away, looking back over the shoulder",
    level: SLOPE,
    place: FORWARD(6),
    seconds: 4,
    window: [PRESS - 0.05, PRESS + HOLD + 2.5],
    input: hop(1),
    mode: "tricks",
  },
];

export const HOP_SWITCH_MOMENTS = [
  {
    id: "hop-wind",
    move: "hop-switch",
    t: PRESS + HOLD - 0.02,
    say: "loading the jump: the shoulders wound up against the turn",
  },
  {
    id: "hop-lead",
    move: "hop-switch",
    t: PRESS + HOLD + 0.08,
    say: "off the snow: the head leading round over the shoulder",
  },
  {
    id: "hop-half",
    move: "hop-switch",
    t: PRESS + HOLD + 0.16,
    say: "half way round in the air",
  },
  {
    id: "hop-landed",
    move: "hop-switch",
    t: PRESS + HOLD + 0.5,
    say: "landed switch, looking back down the hill over the shoulder",
  },
];
