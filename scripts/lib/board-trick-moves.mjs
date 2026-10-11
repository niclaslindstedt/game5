// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER LAB'S BOARD TRICKS (`make skier ARGS="--skis=lynx --move=grab-indy"`,
// `make board ARGS=--sheet=grabs`, `make board-metrics`) — each RIDDEN BY THE
// REAL ENGINE on a synthetic strip as the other board moves are
// (`board-figure-moves.mjs`, the same shape): every one of the board's seven
// grabs held through a kicker's flight (the trick button with the lean and
// the edge `board-tricks.ts` reads), a spin, an ollie and a nollie popped
// on the flat, and a press on the nose and on the tail. A regular rider
// faces his board's right, so the steer to the right is toward his TOES.

const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
/** The landing every flight comes down on: a 24° slope from where it lands. */
const LANDING = (S) => S.flatLevel({ packed: 1, grade: 0.45, slopeFrom: 1525, size: 4000 });
/** A kicker's flight: 1.2 m up, climbing 7 m/s at 50 km/h — about 1.6 s up. */
const FLIGHT = () => ({ x: 2000, z: 1500, heading: 0, speed: 50 / 3.6, height: 1.2, vy: 7 });

/** Each grab and the lean and the edge that ask for it (`boardGrabOf`). */
export const GRAB_ASKS = [
  ["indy", 0, 0],
  ["mute", 1, 0],
  ["melon", -1, 0],
  ["stalefish", -1, 1],
  ["method", -1, -1],
  ["nose", 0, -1],
  ["tail", 0, 1],
];

const grabMove = ([grab, steer, lean]) => ({
  id: `grab-${grab}`,
  title: `a ${grab.toUpperCase()} held through a kicker's flight at 50 km/h, let go for the landing`,
  level: LANDING,
  place: FLIGHT,
  mode: "tricks",
  seconds: 2.4,
  window: [0.05, 2.0],
  input: (t) => (t < 1.05 ? { ...IDLE, trick: true, steer, lean } : IDLE),
});

export const BOARD_TRICK_MOVES = [
  ...GRAB_ASKS.map(grabMove),
  {
    id: "spin",
    title: "a BACKSIDE 360 off a kicker's flight: two taps of the edge to the right",
    level: LANDING,
    place: FLIGHT,
    mode: "tricks",
    seconds: 2.4,
    window: [0.0, 2.0],
    input: (t) => ({ ...IDLE, steer: (t > 0.1 && t < 0.15) || (t > 0.2 && t < 0.25) ? 1 : 0 }),
  },
  {
    id: "ollie",
    title: "an OLLIE on the flat at 30 km/h: loaded over the tail, popped",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 30 / 3.6 }),
    mode: "tricks",
    seconds: 2.2,
    window: [0.1, 2.0],
    input: (t) => ({ ...IDLE, jump: t > 0.2 && t < 0.9 }),
  },
  {
    id: "nollie",
    title: "a NOLLIE on the flat at 30 km/h: the lean forward, loaded over the nose, popped",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 30 / 3.6 }),
    mode: "tricks",
    seconds: 2.2,
    window: [0.1, 2.0],
    input: (t) => ({ ...IDLE, lean: t < 0.95 ? -1 : 0, jump: t > 0.2 && t < 0.9 }),
  },
  {
    id: "press",
    title:
      "a TAIL PRESS then a NOSE PRESS rolling at 20 km/h down a 9° groomer: the lean held back, then forward",
    level: (S) => S.flatLevel({ packed: 1, grade: 0.16, slopeFrom: 0 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 20 / 3.6, pitch: Math.atan(0.16) }),
    mode: "tricks",
    seconds: 3.2,
    window: [0.2, 3.0],
    input: (t) => ({ ...IDLE, lean: t < 0.3 ? 0 : t < 1.6 ? 1 : -1 }),
  },
];

/** The moments the close sheets and the metrics judge the tricks at. */
export const BOARD_TRICK_MOMENTS = [
  ...GRAB_ASKS.map(([grab]) => ({
    id: grab,
    move: `grab-${grab}`,
    t: 0.75,
    say: `the ${grab} held`,
  })),
  { id: "windup", move: "ollie", t: 0.8, say: "an ollie loaded over the tail" },
  { id: "nollie", move: "nollie", t: 0.8, say: "a nollie loaded over the nose" },
  { id: "spin", move: "spin", t: 0.45, say: "a backside 360, led by the head" },
  { id: "tail-press", move: "press", t: 1.3, say: "a tail press" },
  { id: "nose-press", move: "press", t: 2.6, say: "a nose press" },
];
