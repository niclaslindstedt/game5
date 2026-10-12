// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CLIMB'S MOVES (`make skate-climb`, `make skier ARGS=--move=climb-0,climb-16`)
// — beside the skier lab's own (`skier-moves.mjs`, in the same shape): a
// skater working for his speed with the tuck key held, on the flat and up
// rises of 8 %, 16 % and 24 %, each off the same crawl and photographed over the SAME two seconds, so a sheet set beside
// another shows how many more strides the climb takes in that time
// (`poles.ts`'s `skateCadence`: up a rise the glide is cut short).

const IDLE = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };

/** The grades, rise over run, the moves climb. */
export const CLIMB_GRADES = [0, 0.08, 0.16, 0.24];

/** A climb's move at `grade`: he skates UP it (−z, the strip falling
 * along +z), off 3 m/s. */
export function climbMove(grade) {
  const pct = Math.round(grade * 100);
  return {
    id: `climb-${pct}`,
    title:
      grade === 0
        ? "skating across the flat, the tuck key held — the long glide"
        : `skating up a ${pct} % rise, the tuck key held — the glide cut short`,
    level: (S) => S.flatLevel({ packed: 1, grade, slopeFrom: 100, size: 3000 }),
    place: () => ({ x: 1500, z: 1400, heading: Math.PI, speed: 3 }),
    seconds: 3.4,
    window: [1.4, 3.4],
    input: () => ({ ...IDLE, tuck: 1 }),
  };
}

export const CLIMB_MOVES = CLIMB_GRADES.map(climbMove);
