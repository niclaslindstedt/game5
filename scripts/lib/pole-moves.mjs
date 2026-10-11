// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOUBLE POLE'S MOVES (`make skier ARGS=--move=pole-fast,pole-hill`) —
// beside the skier lab's own (`skier-moves.mjs`, in the same shape, which
// the title scene is rendered off and so is kept apart): the double pole
// worked hard past the skate (`engine/game/poles.ts`), and a pitch steep
// enough that the hill takes over from it.

const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };

export const POLE_MOVES = [
  {
    id: "pole-fast",
    title: "double-poling hard across the flat at 35 km/h, the tuck key held",
    level: (S) => S.flatLevel({ packed: 1 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 9.7 }),
    seconds: 3,
    window: [1.2, 2.0],
    input: () => ({ ...IDLE, tuck: 1 }),
  },
  {
    id: "pole-hill",
    title: "double-poling onto a 10 % pitch from 30 km/h, the tuck key held: the hill takes over",
    level: (S) => S.flatLevel({ packed: 1, grade: 0.1, slopeFrom: 230, size: 3000 }),
    place: () => ({ x: 1500, z: 200, heading: 0, speed: 8.3 }),
    seconds: 9,
    window: [0.5, 8.5],
    input: () => ({ ...IDLE, tuck: 1 }),
  },
];
