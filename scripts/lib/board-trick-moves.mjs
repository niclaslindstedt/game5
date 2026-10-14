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
/** THE KICKERS every trick is ridden off, as a park builds one: a 20 %
 * run-in that curls up into a ramp over 13.5 m to its lip — the curvature
 * growing from nothing (the slope `p^1.5` of the way from the run-in's to
 * the lip's), so the legs are loaded smoothly rather than kinked into the
 * ramp — a TABLE at the lip's height and a landing below it. The rider
 * starts ON THE SNOW 4 m above the ramp, so every flight begins with the
 * take-off as the game draws it and a snap in the air is the trick's own,
 * never the scene's (the old scenes started mid-air). The PARK kicker (a
 * 30° lip 1.3 m up, a 10 m table, a 27° landing, ridden in at 70 km/h)
 * puts him up ~1.65 s, the lip left ~1.1 s in; the BIG one (32°, 1.6 m,
 * 14 m, 29°, 80 km/h) ~2 s, room for a loop to come round. */
const KICKERS = {
  park: { lip: 30, high: 1.3, table: 10, landing: 0.5, speed: 70 },
  big: { lip: 32, high: 1.6, table: 14, landing: 0.55, speed: 80 },
};
const START = 300;
const CURL = 13.5;
const RUN_GRADE = 0.2;
const kickerLevel = (k) => (S) => {
  const lip = Math.tan((k.lip * Math.PI) / 180);
  const rise = (u) => {
    const p = u / CURL;
    return -RUN_GRADE * u + ((RUN_GRADE + lip) * CURL * p ** 2.5) / 2.5;
  };
  const base = k.high - rise(CURL);
  const height = (_x, z) => {
    const u = z - START;
    if (u < 0) return base - u * RUN_GRADE;
    if (u <= CURL) return base + rise(u);
    if (u < CURL + k.table) return k.high;
    return k.high - (u - CURL - k.table) * k.landing;
  };
  return S.shapedLevel(height, { size: 600, cell: 0.5 });
};
const runIn = (k) => () => ({ x: 300, z: START - 4, heading: 0, speed: k.speed / 3.6 });
const LANDING = kickerLevel(KICKERS.park);
const RUN_IN = runIn(KICKERS.park);
/** THE BOARD LEVELLED FOR THE LANDING, as a rider does once his trick is
 * let go: the deck rolled forward from the lip's pitch to the landing's
 * slope (`k`'s) — a fraction of a front loop, thrown with the lean and
 * stopped on its angle as the flips are (`strokes.ts`'s `flipLean`), from
 * `from` s into the air, a step after a grab is let go so the lean crosses
 * its gate afresh. The air control alone (the lean short of its
 * top) cannot turn the deck the ~57° in the half second left, and left at
 * the lip's pitch every landing came down tail first and was a save. */
const levelled = (k, from) => (st, E) => {
  const c = st.skier;
  if (!c.airborne || c.airTime < from) return 0;
  const pitch = Math.asin(E.rotate(c.q, { x: 0, y: 0, z: 1 }).y);
  const owed = (pitch + Math.atan(k.landing)) / (2 * Math.PI);
  // Aimed off the deck's pitch where it is now, past what the throw has
  // already turned (`flipLean` counts from the take-off).
  const turned = -st.tricks.rotation / (2 * Math.PI);
  return E.flipLean(st, Math.max(0, turned + owed), -1);
};
const GRAB_OFF = 1.0;
const LEVEL_PARK = levelled(KICKERS.park, GRAB_OFF + 0.05);
/** In the air, and how long: what a trick's hands are timed by. */
const aloft = (st, from, to) =>
  st.skier.airborne && st.skier.airTime >= from && st.skier.airTime < to;

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
  title: `a ${grab.toUpperCase()} held off a kicker ridden in at 70 km/h, let go for the landing`,
  level: LANDING,
  place: RUN_IN,
  mode: "tricks",
  seconds: 3.6,
  window: [1.1, 3.4],
  // Grabbed once he is up, let go ~0.5 s before the snow.
  input: (_t, st, E) =>
    aloft(st, 0.1, GRAB_OFF)
      ? { ...IDLE, trick: true, steer, lean }
      : { ...IDLE, lean: LEVEL_PARK(st, E) },
});

export const BOARD_TRICK_MOVES = [
  ...GRAB_ASKS.map(grabMove),
  {
    id: "spin",
    title: "a BACKSIDE 360 off a kicker's flight: two taps of the edge to the right",
    level: LANDING,
    place: RUN_IN,
    mode: "tricks",
    seconds: 3.6,
    window: [1.1, 3.4],
    input: (_t, st, E) => ({
      ...IDLE,
      steer: aloft(st, 0.1, 0.15) || aloft(st, 0.2, 0.25) ? 1 : 0,
      lean: levelled(KICKERS.park, 0.75)(st, E),
    }),
  },
  // The loops off the big kicker (the skier's own are `flip-moves.mjs`'s,
  // off a flight begun in the air): the lean held once he is up and let go
  // in time to come round (`strokes.ts`'s `flipLean`) — round from the lip's
  // pitch to the landing's, 59° short of a whole loop backward and past it
  // forward, as a rider spots his landing — and a held spin.
  ...[
    ["backflip", "a BACKFLIP off the big kicker: tucked, opened to spot, landed", 1, 0.84],
    [
      "frontflip",
      "a FRONT FLIP off the big kicker: tucked chin in, opened to the landing",
      -1,
      1.16,
    ],
  ].map(([id, title, lean, loops]) => ({
    id,
    title,
    level: kickerLevel(KICKERS.big),
    place: runIn(KICKERS.big),
    mode: "tricks",
    seconds: 4,
    window: [1.0, 3.8],
    input: (_t, st, E) => {
      if (!st.skier.airborne || st.skier.airTime <= 0.25) return IDLE;
      return { ...IDLE, lean: E.flipLean(st, loops, lean) };
    },
  })),
  {
    id: "spin-held",
    title: "a spin off the big kicker: the edge held over, let go, settled square",
    level: kickerLevel(KICKERS.big),
    place: runIn(KICKERS.big),
    mode: "tricks",
    seconds: 4,
    window: [1.0, 3.8],
    input: (_t, st, E) => ({
      ...IDLE,
      steer: aloft(st, 0.25, 0.8) ? 1 : 0,
      lean: levelled(KICKERS.big, 0.9)(st, E),
    }),
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
    t: 1.9,
    say: `the ${grab} held`,
  })),
  { id: "windup", move: "ollie", t: 0.8, say: "an ollie loaded over the tail" },
  { id: "nollie", move: "nollie", t: 0.8, say: "a nollie loaded over the nose" },
  { id: "spin", move: "spin", t: 1.6, say: "a backside 360, led by the head" },
  { id: "tail-press", move: "press", t: 1.3, say: "a tail press" },
  { id: "nose-press", move: "press", t: 2.6, say: "a nose press" },
];
