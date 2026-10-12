// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIR LEANED FORWARD — the skier lab's moves for a flight with the
// lean held FORWARD (the engine's `lean` −1 is forward, +1 back): off a
// kicker's lip, off a cliff, and the same lip sat back beside them, so the
// sheets set the forward flight against the neutral and the back one. The
// lean is held once he is a quarter of a second into the air, as a player
// presses into a flight; the runs name no mode, so no stroke turns him.

const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };
/** A big kicker's lip at 60 km/h onto a 45 % landing. */
const LIP = (S) => S.flatLevel({ packed: 1, grade: 0.45, slopeFrom: 230 });
const OFF_LIP = () => ({ x: 1500, z: 200, heading: 0, speed: 17, height: 1.2, vy: 6.5 });
const CLIFF = (S) =>
  S.flatLevel({ packed: 1, grade: Math.tan((35 * Math.PI) / 180), slopeFrom: 200, size: 4000 });
const OFF_CLIFF = () => ({ x: 2000, z: 600, heading: 0, speed: 40 / 3.6, height: 13 });
const LEAN = (lean) => (_t, st) => ({
  ...IDLE,
  lean: st.skier.airborne && st.skier.airTime > 0.25 ? lean : 0,
});

export const AIR_LEAN_MOVES = [
  {
    id: "air-forward",
    title: "off a kicker's lip at 60 km/h, the lean held FORWARD: pressed over the tips",
    level: LIP,
    place: OFF_LIP,
    seconds: 1.9,
    window: [0.05, 1.5],
    input: LEAN(-1),
  },
  {
    id: "air-half",
    title: "the same lip, the lean held half forward",
    level: LIP,
    place: OFF_LIP,
    seconds: 1.9,
    window: [0.05, 1.5],
    input: LEAN(-0.5),
  },
  {
    id: "air-neutral",
    title: "the same lip, no lean",
    level: LIP,
    place: OFF_LIP,
    seconds: 1.9,
    window: [0.05, 1.5],
    input: LEAN(0),
  },
  {
    id: "air-back",
    title: "the same lip, the lean held BACK",
    level: LIP,
    place: OFF_LIP,
    seconds: 1.9,
    window: [0.05, 1.5],
    input: LEAN(1),
  },
  {
    id: "cliff-forward",
    title: "a 12 m cliff at 40 km/h, the lean held FORWARD",
    level: CLIFF,
    place: OFF_CLIFF,
    seconds: 1.95,
    window: [0, 1.85],
    input: LEAN(-0.6),
  },
];

/** The moments the close sheets stand him at. */
export const AIR_LEAN_MOMENTS = [
  { id: "fly-forward", move: "air-forward", t: 0.9, say: "flying a kicker, leaned forward" },
  { id: "fly-half", move: "air-half", t: 0.9, say: "flying a kicker, half forward" },
  { id: "fly-neutral", move: "air-neutral", t: 0.9, say: "flying a kicker, no lean" },
  { id: "fly-cliff", move: "cliff-forward", t: 1.2, say: "down a cliff, leaned forward" },
];
