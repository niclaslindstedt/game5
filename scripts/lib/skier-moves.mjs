// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER LAB'S MOVES — each a short run SKIED BY THE REAL ENGINE on a
// synthetic strip (`tests/support/synthetic.ts`), staged with `placeRun`
// and scripted input by input, and the window of it the lab photographs.
// The figure on the sheets is posed off exactly the states the engine
// wrote, so what the sheet shows is what the game does — a skate stride, a
// double pole, a jump loaded and sprung, a hockey stop — and never a pose
// typed in for the picture.
//
// A move is:
//   id, title        the name on the command line and over the sheet
//   level(S)         the map, off the synthetic module `S`
//   place()          the moment (`RunMoment`)
//   seconds          how long it is skied
//   window           [from, to] s: the stretch the frames are spread over
//   input(t, st)     the controls at run time t
//   mode, snow       optional: the run's mode and snow dial

const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
const PITCH = Math.tan(Math.PI / 9);

export const MOVES = [
  {
    id: "wait",
    title: "stood still on the flat, waiting at the start line",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 8,
    window: [0.5, 7.5],
    input: () => IDLE,
  },
  {
    id: "start",
    title: "setting off from a standstill on the flat, the tuck key held: skating away",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 2.6,
    window: [0.05, 2.5],
    input: () => ({ ...IDLE, tuck: 1 }),
  },
  {
    id: "stride",
    title: "striding up a gentle rise from a walk, the tuck key held — the diagonal stride",
    level: (S) => S.flatLevel({ packed: 1, grade: 0.2, slopeFrom: 100, size: 3000 }),
    place: () => ({ x: 1500, z: 1400, heading: Math.PI, speed: 1.2 }),
    seconds: 3,
    window: [1.0, 2.6],
    input: () => ({ ...IDLE, tuck: 1 }),
  },
  {
    id: "skate",
    title: "skating off a shuffle on the flat, hands off — a stride each leg",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 1 }),
    seconds: 3,
    window: [1.2, 2.8],
    input: () => IDLE,
  },
  {
    id: "pole",
    title: "double-poling across the flat at 20 km/h",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 6.8 }),
    seconds: 3,
    window: [1.2, 2.15],
    input: () => IDLE,
  },
  {
    id: "jump",
    title: "a jump loaded for 1.5 s at 40 km/h and sprung, the flight and the landing",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 40 / 3.6 }),
    seconds: 3.4,
    window: [0.2, 3.1],
    input: (t) => ({ ...IDLE, jump: t >= 0.3 && t < 1.8 }),
  },
  {
    id: "hockey",
    title: "a hockey stop from 50 km/h: the back key, then the edge",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 50 / 3.6 }),
    seconds: 3,
    window: [0.2, 2.6],
    input: (t) => ({ ...IDLE, brake: t >= 0.3 ? 1 : 0, steer: t >= 0.5 ? 1 : 0 }),
  },
  {
    id: "carve",
    title: "a full edge down the 20° pitch at 70 km/h, then cut hard",
    level: (S) => S.flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 }),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 70 / 3.6 }),
    seconds: 2.6,
    window: [0.1, 2.4],
    input: (t) => ({ ...IDLE, tuck: 0.3, steer: t >= 0.2 ? -1 : 0, carve: t >= 1.2 }),
  },
  {
    id: "tuck",
    title: "folding into the tuck down the 20° pitch from 40 km/h",
    level: (S) => S.flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 }),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 40 / 3.6 }),
    seconds: 1.4,
    window: [0, 1.3],
    input: (t) => ({ ...IDLE, tuck: t >= 0.1 ? 1 : 0 }),
  },
  {
    id: "drop",
    title: "dropped 1.5 m at 60 km/h onto the groomer: the landing taken in the legs",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 60 / 3.6, height: 2.5 }),
    seconds: 2,
    window: [0.3, 1.4],
    input: () => IDLE,
  },
  {
    id: "wipeout",
    title: "dropped 8 m at 70 km/h onto the groomer: the legs buckle",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 70 / 3.6, height: 9 }),
    seconds: 3.4,
    window: [0.9, 3.3],
    input: () => ({ ...IDLE, tuck: 1 }),
  },
];

export const MOVE_IDS = MOVES.map((m) => m.id);

/** THE MOMENTS the close-up, game-scale and stretch sheets stand him at —
 * each a move skied to a second of it, so a moment is a state the engine
 * reached and never a pose typed in: the stance, a carve each way and cut
 * hard, the tuck, a double pole's push, a skate's, the flight and a
 * landing taken in the legs, a hockey stop. */
export const MOMENTS = [
  { id: "stance", move: "hockey", t: 0.25, say: "the stance at 50 km/h" },
  { id: "carve", move: "carve", t: 1.0, say: "a full edge at 70 km/h" },
  { id: "cut", move: "carve", t: 2.0, say: "the edge cut hard" },
  { id: "tuck", move: "tuck", t: 1.3, say: "the full tuck" },
  { id: "pole", move: "pole", t: 1.45, say: "a double pole's push" },
  { id: "skate", move: "skate", t: 2.0, say: "a skate stride" },
  { id: "air", move: "jump", t: 2.1, say: "in the air off a jump" },
  { id: "landing", move: "drop", t: 0.75, say: "a landing taken in the legs" },
  { id: "hockey", move: "hockey", t: 1.4, say: "a hockey stop" },
  { id: "thrown", move: "wipeout", t: 2.4, say: "thrown off his skis" },
];

export const MOMENT_IDS = MOMENTS.map((m) => m.id);
