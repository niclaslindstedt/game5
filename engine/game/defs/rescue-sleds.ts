// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI PATROL'S SNOWMOBILES — the numbers a rescue by snowmobile is
// planned to (`rescue-sled-route.ts`) and met by (`rescue-sled.ts`): the
// rescue sent where an air ambulance has nowhere to set down. Two patrol
// machines, two patrollers on each, one towing an empty rescue toboggan
// up and the casualty in it down. The research is `docs/rescue.md`'s
// "By snowmobile".

/** The rescue by snowmobile's numbers, m, s, m/s, m/s². */
export const RESCUE_SLEDS = {
  /** THE ROUTE SEARCH: the grid's cell, m; the steepest grade a loaded
   * patrol machine is driven on, as a gradient (about 33°); the room kept
   * from a trunk, a post or a wall, m (and the narrower room taken when
   * the woods leave no other way); how far in from the map's edge it
   * keeps, m; what a groomed run takes off a cell's cost (the patrol
   * drives the pistes where it can) and what the grade puts on it. */
  route: {
    cell: 8,
    steepest: 0.65,
    room: 2.4,
    tight: 1.2,
    edge: 24,
    piste: 0.35,
    grade: 4,
  },
  /** THE MACHINES: a patrol's two-up work sled, its plan's length and
   * width and its height to the top of the screen, m. */
  sled: { length: 3.2, width: 1.15, height: 1.25 },
  /** THE TOBOGGAN: a fibreglass pan on runners about 2.3 m long and 0.6 m
   * wide, its height to the rails with a casualty in it, m; the rigid tow
   * bar from the machine's hitch to its nose, m. */
  toboggan: { length: 2.3, width: 0.62, height: 0.45, tongue: 1.0 },
  /** How far behind a machine's middle its toboggan's middle trails, m. */
  trail: 3.2 / 2 + 1.0 + 2.3 / 2,
  /** WHERE THEY STOP: the toboggan's middle ahead of where he lies along
   * the way down and out to his side, m; the second machine out past the
   * first, m; and the straight the first is driven in on, m. */
  park: { ahead: 6, out: 2.6, beside: 3.2, inRun: 12 },
  /** THE PACE: driven up empty, at most and at least, m/s, and how much a
   * climb's grade takes off it; towing a casualty down — slowly, in a low
   * gear — at most and at least, and what a grade either way takes off;
   * the turn's lateral grip, m/s²; the speeding up and the slowing down,
   * empty and towing. */
  pace: {
    up: 10,
    upLeast: 3.5,
    climb: 11,
    tow: 5,
    towLeast: 1.8,
    towGrade: 7,
    lateral: 2.5,
    accel: 1.6,
    brake: 2.2,
    towAccel: 0.8,
    towBrake: 1.0,
  },
  /** THE SECOND MACHINE's start behind the first, s; where it leaves the
   * first's tracks to park, m short of the first's stop; and how far
   * behind the tow it follows down, s. */
  convoy: { start: 3, peel: 16, follow: 5 },
  /** THE WORK AT THE SCENE: from the first machine stopped to the convoy
   * leaving, s — off its seat, the walk up with the board, the scoop, the
   * carry, laid into the toboggan, strapped, and back on the machines
   * (`pwa/src/game/rescue-sleds-crew.ts` plays it inside this). */
  work: 62,
  /** Seconds after the convoy reaches the bottom that the call is over. */
  over: 6,
  /** STOLEN: within `reach` m of a stopped machine's middle, no faster
   * than `fastest` m/s — the snowmobile's own boarding (`SLED.board`). */
  take: { reach: 5, fastest: 12 },
  /** How many machines the player has left behind are kept where he left
   * them (the oldest beyond it goes back to the patrol). */
  left: 3,
} as const;
