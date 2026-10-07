// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRIMBEAR as the run holds him (`grimbear.ts`) — a type of its own so
// `state.ts` can carry him without importing the step that moves him.

import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";

/** What he is doing: nowhere to be seen (`away`), waiting behind a trunk
 * (`lurk`), running at the skier (`run`), over him (`maul`), diving past
 * the skier he missed and stumbling on (`miss`), stood
 * roaring after a chase he gave up (`halt`), or walking off into the woods
 * (`leave`). */
export type GrimbearPhase = "away" | "lurk" | "run" | "maul" | "miss" | "halt" | "leave";

/** THE GRIMBEAR on a free ride that met him. `hunt` is whether he will
 * CATCH the skier the next time he runs at him — true until he has, once;
 * after that every sighting is a chase that comes up short. Where he
 * stands (plan, m), the way he faces (rad, 0 = +z, clockwise), his speed
 * (m/s) and how far he has run in all (m — the stride the figure reads).
 * `t` is the seconds in this phase, `wait` the seconds left before he lies
 * in wait again, `tree` the trunk he hides behind (-1 none). `top` is set
 * by the catch: the next reset stands the skier at the top of the slope.
 * `lands` is whether the run he is on catches the skier (dealt at each
 * burst on a hunt, `GRIMBEAR.miss` of them not). */
export type GrimbearState = {
  rng: Rng;
  hunt: boolean;
  phase: GrimbearPhase;
  x: number;
  z: number;
  heading: number;
  speed: number;
  stride: number;
  t: number;
  wait: number;
  tree: number;
  top: boolean;
  lands: boolean;
  /** How many times he has broken cover this run. */
  sightings: number;
};

/** THE GRIMBEAR'S EVENT (`grimbear.ts`): out of the trees, over the skier
 * he caught, diving past the one he missed, pulled up roaring short of one he did not, or gone — and
 * where he stood. */
export type GrimbearEvent = {
  kind: "grimbear";
  t: number;
  phase: "burst" | "maul" | "miss" | "halt" | "gone";
  x: number;
  z: number;
};
