// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP UNDER WAY on a ski jumping hill (R43) — what `GameState.jump`
// carries through one jump: the bar, the tracks, the take-off, the flight
// and the landing (`ski-jump.ts`, `jump-inrun.ts`, `jump-flight.ts`), and
// the RECORD a scorer, the HUD, the replay and the sim read off it. Stated
// apart so `state.ts` stays under its line cap.

import type { HillAir } from "./jump-wind.ts";

/** Where the jumper is in his jump: sat on the BAR, down the TRACKS, in the
 * AIR, or DOWN — on the snow of the landing hill and the out-run, the jump
 * over and the engine's skier riding it out. */
export type JumpStage = "bar" | "tracks" | "air" | "down";

/** HOW HE CAME DOWN: in a TELEMARK (the legs split as the tails touched), on
 * both feet side by side (TWO-FOOTED), a telemark set on the snow after the
 * touch (LATE), or a FALL. */
export type JumpLanding = "telemark" | "twoFooted" | "late" | "fall";

/** WHAT CAME OF IT once down: still riding to the fall line (`pending`),
 * ridden out CLEAN, a hand put down on the snow (TOUCH), or a FALL. */
export type JumpOutcome = "pending" | "clean" | "touch" | "fall";

/** A JUMP AS IT WAS JUMPED — everything the judges, the board and the sim
 * are read off. Speeds m/s, times s, lengths m, angles degrees. */
export type JumpRecord = {
  /** The gate sat on (its number, 1 the lowest). */
  gate: number;
  /** The speed through the in-run's photocells (8 m ending 10 m before the
   * edge) and over the edge itself. */
  inRunSpeed: number;
  edgeSpeed: number;
  /** THE TAKE-OFF: when the push was started against the moment that ends
   * it at the edge (negative early, positive late; null never pressed),
   * the share of the push the edge kept (0..1) and the speed it gave him
   * at right angles to the table. */
  timing: number | null;
  share: number;
  push: number;
  /** THE FLIGHT: its time, the highest the jumper's centre rose over the
   * slope under him and how far down the hill that was, and the mean head
   * wind along the hill he met over it (negative a tail wind). */
  flightTime: number;
  peak: number;
  peakAt: number;
  wind: number;
  /** THE WIND MEASURED: what the hill's stations read as he passed each
   * (`jump-wind.ts`, the edge first), and their mean, m/s (head positive)
   * — the wind the jump is compensated for. */
  stations: number[];
  measured: number;
  /** HOW WELL IT WAS FLOWN: the mean of the angle of attack's distance from
   * the ideal over the flight after the take-off's transition, the most it
   * rolled, when the V was open, s after the edge (−1 never), and whether
   * the air turned him over or he stalled out of it. */
  attitude: number;
  roll: number;
  veeAt: number;
  lost: boolean;
  /** THE LANDING: the distance credited, to the half metre, and unrounded;
   * the speed he came down at and its part into the slope; the load the
   * legs took, g (filled once the engine has landed him); how he came down
   * and what came of it. */
  distance: number;
  reach: number;
  landingSpeed: number;
  into: number;
  load: number;
  landing: JumpLanding | null;
  outcome: JumpOutcome;
};

/** THE JUMP UNDER WAY. The along/across/height are in the hill's own frame:
 * `along` m of plan down its line from the tower's deck, `across` m to the
 * right of it, `y` the height of his centre of mass in the map's frame. */
export type SkiJumpState = {
  stage: JumpStage;
  /** The gate sat on, an index into `Level.skiJump.gates` (0 the lowest). */
  gate: number;
  /** The air's density at the hill, kg/m³ (the standard atmosphere at the
   * edge's height over the sea). */
  density: number;
  /** Where he is and how fast, in the hill's frame. */
  along: number;
  across: number;
  y: number;
  /** On the tracks his speed along them, m/s, and the arc still to the
   * edge, m; in the air his velocity, m/s (along, across, up). */
  speed: number;
  left: number;
  va: number;
  vw: number;
  vy: number;
  /** When he left the bar, pressed for the take-off (−1 not yet) and left
   * the edge, s of run clock; whether the jump key was down last step. */
  leftAt: number;
  pressAt: number;
  edgeAt: number;
  jumpHeld: boolean;
  /** In the air: the angle of attack of his skis to the air, rad; how far
   * he has laid out over them (0 the take-off's crouch, 1 the flight's
   * V-style); how far the V is open (0 the skis together, 1 the V); the
   * roll, rad; the take-off's error still in his attitude, rad; and when
   * the landing was made ready (the telemark asked for), s (−1 not). */
  aoa: number;
  lay: number;
  vee: number;
  roll: number;
  error: number;
  prepAt: number;
  /** The photocells' first crossing, s (−1 not yet). */
  cellAt: number;
  /** Sums over the flight: the attitude's error × time, the head wind ×
   * time, and the seconds summed. */
  errSum: number;
  windSum: number;
  timeSum: number;
  /** THE HILL'S AIR the jump is flown in (`jump-wind.ts`): the contest's
   * day at his moment, or the map's own hill dealt off its seed. */
  air: HillAir;
  /** A STAGED WIND for the labs and the tests, m/s along the hill (head
   * positive) and across it (to the right): read in place of the map's air
   * when set, never by a played run. */
  staged?: { head: number; across: number };
  record: JumpRecord;
};
