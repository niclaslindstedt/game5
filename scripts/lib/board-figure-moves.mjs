// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER LAB'S MOVES ON A BOARD (`make skier ARGS=--skis=lynx`) — each a
// short run RIDDEN BY THE REAL ENGINE on a synthetic strip, as the skier's
// moves are (`skier-moves.mjs`, the same shape), and the moments the close
// sheets and `make board-metrics` judge the rider at. A regular rider faces
// his board's right, so the steer to the right is his TOESIDE turn.

const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
const PITCH = Math.tan(Math.PI / 9);
/** The 20° groomed pitch every carve is ridden down. */
const PISTE = (S) => S.flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 });
/** A face of `grade`, the fall line down +z, stood across facing down it
 * (the heel edge uphill) or up it (`toe`). */
const FACE = (grade) => (S) => S.flatLevel({ packed: 1, grade, slopeFrom: 0, size: 4000 });
const ACROSS = (toe) => () => ({ x: 2000, z: 1000, heading: toe ? Math.PI / 2 : -Math.PI / 2 });

export const BOARD_MOVES = [
  {
    id: "skate",
    title: "the one-foot skate off a standstill on the flat: the rear foot out, pushing",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 3.2,
    window: [0.6, 3.0],
    input: () => ({ ...IDLE, tuck: 1 }),
  },
  {
    id: "wait",
    title: "stood strapped in on the flat, waiting",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 6,
    window: [0.5, 5.5],
    input: () => IDLE,
  },
  {
    id: "straight",
    title: "riding straight down the 20° pitch at 40 km/h, flat on the base",
    level: PISTE,
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 40 / 3.6 }),
    seconds: 1.6,
    window: [0.2, 1.5],
    input: () => IDLE,
  },
  {
    id: "toe",
    title: "a TOESIDE carve at 50 km/h down the 20° pitch, cut hard at 1.2 s",
    level: PISTE,
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 50 / 3.6 }),
    seconds: 2.4,
    window: [0.1, 2.3],
    input: (t) => ({ ...IDLE, steer: t >= 0.2 ? 1 : 0, carve: t >= 1.2 }),
  },
  {
    id: "heel",
    title: "a HEELSIDE carve at 50 km/h down the 20° pitch, cut hard at 1.2 s",
    level: PISTE,
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 50 / 3.6 }),
    seconds: 2.4,
    window: [0.1, 2.3],
    input: (t) => ({ ...IDLE, steer: t >= 0.2 ? -1 : 0, carve: t >= 1.2 }),
  },
  {
    id: "turns",
    title: "linked turns down the 20° pitch from 40 km/h, toe and heel",
    level: PISTE,
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 40 / 3.6 }),
    seconds: 4.6,
    window: [0.4, 4.4],
    input: (t) => ({ ...IDLE, steer: t < 0.3 ? 0 : Math.floor((t - 0.3) / 1.2) % 2 ? -1 : 1 }),
  },
  {
    id: "tuck",
    title: "folding into the tuck down the 20° pitch from 40 km/h",
    level: PISTE,
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 40 / 3.6 }),
    seconds: 1.4,
    window: [0, 1.3],
    input: (t) => ({ ...IDLE, tuck: t >= 0.1 ? 1 : 0 }),
  },
  {
    id: "jump",
    title: "a jump loaded for 1.2 s at 40 km/h and sprung, the flight and the landing",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 40 / 3.6 }),
    seconds: 3.2,
    window: [0.2, 3.0],
    input: (t) => ({ ...IDLE, jump: t >= 0.3 && t < 1.5 }),
  },
  {
    id: "drop",
    title: "dropped 1.5 m at 50 km/h onto the groomer: the landing taken in the legs",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 50 / 3.6, height: 2.5 }),
    seconds: 2,
    window: [0.3, 1.4],
    input: () => IDLE,
  },
  {
    id: "pivot",
    title: "stood still, the steer held: the board stepped round about the front foot",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 3,
    window: [0.2, 2.8],
    input: () => ({ ...IDLE, steer: 1 }),
  },
  {
    id: "slip",
    title: "a heelside sideslip down a 31° face, the edge eased off",
    level: FACE(0.6),
    place: ACROSS(false),
    seconds: 3,
    window: [0.5, 2.9],
    input: () => ({ ...IDLE, steer: 0.5 }),
  },
  {
    id: "slip-toe",
    title: "a toeside sideslip down a 31° face, facing up the hill",
    level: FACE(0.6),
    place: ACROSS(true),
    seconds: 3,
    window: [0.5, 2.9],
    input: () => ({ ...IDLE, steer: -0.5 }),
  },
  {
    id: "leaf",
    title: "the falling leaf down a 25° face: the lean forward, then back",
    level: FACE(0.47),
    place: ACROSS(false),
    seconds: 5,
    window: [0.5, 4.8],
    input: (t) => ({ ...IDLE, steer: 0.4, lean: Math.floor(t / 2) % 2 ? -1 : 1 }),
  },
  {
    id: "fakie",
    title: "let go facing up a 14° groomer: riding fakie",
    level: (S) => S.flatLevel({ packed: 1, grade: 0.25, slopeFrom: 0 }),
    place: () => ({ x: 1500, z: 200, heading: Math.PI, pitch: Math.atan(0.25) }),
    mode: "free",
    seconds: 4,
    window: [1.5, 3.9],
    input: () => IDLE,
  },
  {
    id: "slam",
    title: "a toeside sideslip let go past flat: the heel edge caught, slammed onto his back",
    level: FACE(0.6),
    place: ACROSS(true),
    seconds: 3,
    window: [0.4, 2.9],
    input: (t) => ({ ...IDLE, steer: t < 1 ? -0.75 : -1 }),
  },
];

/** The moments the close sheets and the metrics judge him at. */
export const BOARD_MOMENTS = [
  { id: "stance", move: "straight", t: 1.0, say: "stood across the board at 40 km/h" },
  { id: "toe", move: "toe", t: 1.0, say: "a toeside carve" },
  { id: "toe-cut", move: "toe", t: 2.1, say: "a toeside carve cut hard: laid over" },
  { id: "heel", move: "heel", t: 1.0, say: "a heelside carve" },
  { id: "heel-cut", move: "heel", t: 2.1, say: "a heelside carve cut hard: sat over the heels" },
  { id: "tuck", move: "tuck", t: 1.3, say: "the tuck, side-on" },
  { id: "skate", move: "skate", t: 2.0, say: "the one-foot skate's push" },
  { id: "wait", move: "wait", t: 3.0, say: "stood still, strapped in" },
  { id: "air", move: "jump", t: 1.75, say: "in the air off a jump" },
  { id: "landing", move: "drop", t: 0.75, say: "a landing taken in the legs" },
  { id: "slip", move: "slip", t: 2.0, say: "a heelside sideslip on a steep face" },
  { id: "fakie", move: "fakie", t: 3.0, say: "riding fakie, looking over the other shoulder" },
];
