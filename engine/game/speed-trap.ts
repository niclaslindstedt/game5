// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SPEED TRAP (R32, R33) — the point of a speed course where a racer's speed is
// taken, as television shows it: a pair of photocells a few metres apart
// across the course on its fastest straight, reading the speed he carries
// between them. The game reads his speed on the step his body crosses the
// trap's line (`SpeedCourse.trap`) — once a run, on a run that has
// started and is still on; the field's are dealt about par's there
// (`field.ts`). Nothing here draws from any stream.

import { speedCourseOf } from "../mapgen/index.ts";
import { crossedLine } from "./course.ts";
import type { Checkpoint } from "../mapgen/types.ts";
import type { GameEvent, GameState } from "./state.ts";

const line: Checkpoint = { x: 0, z: 0, y: 0, heading: 0, width: 0, s: 0, colour: "red" };

/** Take the racer's speed if the move he just made took him through the
 * trap. */
export function stepTrap(state: GameState, x0: number, z0: number, events: GameEvent[]): void {
  const trap = speedCourseOf(state.level)?.trap;
  const p = state.progress;
  if (!trap || p.trap !== null || !p.started || p.finished) return;
  line.x = trap.x;
  line.z = trap.z;
  line.heading = trap.heading;
  const c = state.skier;
  const lateral = crossedLine(line, x0, z0, c.x, c.z);
  if (lateral === null || Math.abs(lateral) > trap.width / 2) return;
  p.trap = c.speed;
  p.trapAt = p.time;
  events.push({ kind: "trap", t: state.t, speed: c.speed });
}
