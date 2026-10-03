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
//   poles            optional: false skis it WITHOUT POLES (the hard mode)

const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
const PITCH = Math.tan(Math.PI / 9);
const CLIFF = Math.tan((35 * Math.PI) / 180);

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
    id: "away",
    title: "skating away from a standstill on the flat, the tuck key held, until he double-poles",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 7,
    window: [0.5, 6.8],
    input: () => ({ ...IDLE, tuck: 1 }),
  },
  {
    id: "gate",
    title:
      "in the start gate under the lights, then out of it down a 12 % pitch at GO, the tuck held",
    level: (S) => S.flatLevel({ packed: 1, grade: 0.12, slopeFrom: 150, size: 3000 }),
    place: () => ({ x: 1500, z: 200, heading: 0, lights: 1.5 }),
    seconds: 4.5,
    window: [1.0, 4.4],
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
    id: "skate-turn",
    title: "skating round to the left at a crawl on the flat, the tuck key held: a skate turn",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 3 }),
    seconds: 4.4,
    window: [0.4, 4.3],
    input: (t) => ({ ...IDLE, tuck: 1, steer: t >= 0.6 ? -1 : 0 }),
  },
  {
    id: "step-turn",
    title: "turning to the right from a standstill on the flat, the tuck key held: stepped round",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 4,
    window: [0.2, 3.9],
    input: () => ({ ...IDLE, tuck: 1, steer: 1 }),
  },
  {
    id: "pivot",
    title: "stood still on the flat, only the right key held: stepping his skis round on the spot",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 3,
    window: [0.05, 1.75],
    input: () => ({ ...IDLE, steer: 1 }),
  },
  {
    id: "pivot-bare",
    title: "WITHOUT POLES: stood still, only the right key held — stepped round on empty hands",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 3,
    window: [0.05, 1.75],
    input: () => ({ ...IDLE, steer: 1 }),
    poles: false,
  },
  {
    id: "skate-zigzag",
    title: "skating at a crawl on the flat, stepped left and right a turn each 1.6 s",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 3.5 }),
    seconds: 6,
    window: [0.3, 5.9],
    input: (t) => ({
      ...IDLE,
      tuck: 1,
      steer: t < 0.4 ? 0 : Math.floor((t - 0.4) / 1.6) % 2 ? 1 : -1,
    }),
  },
  {
    id: "pole-turn",
    title: "rolling at 25 km/h on the flat with the tuck key held, then turned to the right",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 7 }),
    seconds: 4,
    window: [0.3, 3.9],
    input: (t) => ({ ...IDLE, tuck: 1, steer: t >= 0.8 ? 1 : 0 }),
  },
  {
    id: "bare-away",
    title: "WITHOUT POLES: skating away from a standstill on the flat, the tuck key held",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0 }),
    seconds: 7,
    window: [0.3, 6.8],
    input: () => ({ ...IDLE, tuck: 1 }),
    poles: false,
  },
  {
    id: "bare-skate",
    title: "WITHOUT POLES: skating at 15 km/h on the flat, the tuck key held — a stride each leg",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 4.2 }),
    seconds: 4,
    window: [1.5, 3.8],
    input: () => ({ ...IDLE, tuck: 1 }),
    poles: false,
  },
  {
    id: "bare-turn",
    title: "WITHOUT POLES: skating round to the left at a crawl, the tuck key held",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 3 }),
    seconds: 4.4,
    window: [0.4, 4.3],
    input: (t) => ({ ...IDLE, tuck: 1, steer: t >= 0.6 ? -1 : 0 }),
    poles: false,
  },
  {
    id: "bare-ride",
    title: "WITHOUT POLES: riding down the 20° pitch from 40 km/h, a turn each way",
    level: (S) => S.flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 }),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 40 / 3.6 }),
    seconds: 4.2,
    window: [0.2, 4],
    input: (t) => ({ ...IDLE, steer: t < 0.8 ? 0 : t < 2.2 ? -1 : t < 3.4 ? 1 : 0 }),
    poles: false,
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
    id: "chatter",
    title: "a carve at 110 km/h down the 20° pitch: the skis chattering, the knees taking it",
    level: (S) => S.flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 }),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 110 / 3.6 }),
    seconds: 1.4,
    // A tenth of a second across the sheet: the flutter frame by frame.
    window: [1.2, 1.3],
    input: (t) => ({ ...IDLE, tuck: 0.6, steer: t >= 0.2 ? -0.7 : 0 }),
  },
  {
    id: "turns",
    title: "linked turns down the 20° pitch from 40 km/h, a pole planted on each",
    level: (S) => S.flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 }),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 40 / 3.6 }),
    seconds: 4.2,
    window: [0.6, 4],
    input: (t) => ({ ...IDLE, steer: t < 0.3 ? 0 : Math.floor((t - 0.3) / 1.1) % 2 ? 1 : -1 }),
  },
  {
    id: "skid",
    title: "a turn skidded at 65 km/h down the 20° pitch, the tuck held through the brake",
    level: (S) => S.flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 }),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 65 / 3.6 }),
    seconds: 1.7,
    window: [0.2, 1.6],
    input: (t) => ({
      ...IDLE,
      tuck: 1,
      steer: t >= 0.2 ? -1 : 0,
      brake: t >= 0.4 && t < 1.6 ? 0.7 : 0,
    }),
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
    id: "bumps",
    title:
      "straight over rollers 15 cm high every 4 m at 35 km/h: the legs take them, the body rides",
    level: (S) =>
      S.flatLevel({
        packed: 1,
        grade: 0.12,
        slopeFrom: 0,
        size: 1200,
        bumps: { height: 0.15, length: 4, from: 300, to: 900 },
      }),
    place: () => ({ x: 600, z: 290, heading: 0, speed: 35 / 3.6 }),
    // The first second on the strip and the first over the rollers ridden
    // in; the window is the legs settled to their work.
    seconds: 4.4,
    window: [2, 4.2],
    input: () => IDLE,
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
    id: "kicker",
    title: "flown 1 m over the 20° pitch at 55 km/h: a kicker's air, ridden compact",
    level: (S) => S.flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 }),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 55 / 3.6, height: 2, vy: -4 }),
    seconds: 1.6,
    window: [0, 1.2],
    input: () => IDLE,
  },
  {
    id: "ledge",
    title: "a 3 m drop at 45 km/h onto the 20° pitch: spotted, then reached for",
    level: (S) => S.flatLevel({ packed: 1, grade: PITCH, slopeFrom: 200, size: 4000 }),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 45 / 3.6, height: 4 }),
    seconds: 1.9,
    window: [0, 1.5],
    input: () => IDLE,
  },
  {
    id: "cliff",
    title: "a 12 m cliff at 40 km/h onto a 35° apron: spotted, windmilled, reached for",
    level: (S) => S.flatLevel({ packed: 1, grade: CLIFF, slopeFrom: 200, size: 4000 }),
    place: () => ({ x: 2000, z: 600, heading: 0, speed: 40 / 3.6, height: 13 }),
    // To the snow: a drop this big buckles his legs there (`crash.ts`).
    seconds: 1.95,
    window: [0, 1.88],
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
 * landing taken in the legs, a hockey stop — and at its hardest, and the
 * height of a linked turn, inclined over both skis on the snow. */
export const MOMENTS = [
  { id: "stance", move: "hockey", t: 0.25, say: "the stance at 50 km/h" },
  { id: "carve", move: "carve", t: 1.0, say: "a full edge at 70 km/h" },
  { id: "cut", move: "carve", t: 2.0, say: "the edge cut hard" },
  { id: "tuck", move: "tuck", t: 1.3, say: "the full tuck" },
  { id: "pole", move: "pole", t: 1.45, say: "a double pole's push" },
  { id: "skate", move: "skate", t: 2.0, say: "a skate stride" },
  { id: "ready", move: "gate", t: 1.2, say: "in the start gate, under the lights" },
  { id: "setoff", move: "gate", t: 1.75, say: "out of the gate: the first push" },
  { id: "air", move: "jump", t: 2.1, say: "in the air off a jump" },
  { id: "landing", move: "drop", t: 0.75, say: "a landing taken in the legs" },
  { id: "absorb", move: "bumps", t: 2.8, say: "a roller taken in the legs, the body riding level" },
  { id: "hockey", move: "hockey", t: 1.4, say: "a hockey stop" },
  { id: "skid", move: "skid", t: 1.0, say: "a turn skidded at speed, tucked" },
  { id: "chatter", move: "chatter", t: 1.25, say: "the skis chattering in a carve at 110 km/h" },
  { id: "plant", move: "turns", t: 1.82, say: "a pole planted at a turn" },
  {
    id: "apex",
    move: "turns",
    t: 2.15,
    say: "the height of a linked turn: inclined over both skis",
  },
  { id: "stopping", move: "hockey", t: 0.95, say: "a hockey stop at its hardest" },
  { id: "spot", move: "ledge", t: 0.7, say: "spotting the landing off a 3 m drop" },
  { id: "windmill", move: "cliff", t: 1.35, say: "windmilling down a 12 m cliff" },
  { id: "reach", move: "cliff", t: 1.75, say: "reaching for the snow at the foot of a cliff" },
  { id: "thrown", move: "wipeout", t: 2.4, say: "thrown off his skis" },
  { id: "pivot", move: "pivot", t: 0.25, say: "a step turn on the spot: the inside ski stepped" },
];

export const MOMENT_IDS = MOMENTS.map((m) => m.id);
