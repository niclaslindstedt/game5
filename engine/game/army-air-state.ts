// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S PARAMOTORS AND BALLOONS as the run holds them (`army-para.ts`,
// `army-balloon.ts`) — types of their own so `army-state.ts` can carry
// them without importing the steps that move them (and the one constructor
// the step and the bursts both make it with).

import type { BalloonState } from "./balloon-state.ts";
import type { ParaState } from "./para-state.ts";

/** What one of the army's paramotors is doing:
 *   * `due`: called, not yet on the map (it comes in at `due`);
 *   * `fly`: on the map, circling him — or where he was last seen — the
 *     rifleman in the harness firing when he may;
 *   * `leave`: the hunt over, flying out over the map's edge;
 *   * `fall`: its wing gone — rammed or washed down by a stolen
 *     helicopter, shredded by a burst, or (counted, never meant) flown
 *     into the snow or a crown — the soldier falling under the cloth or,
 *     SAFE FOR WORK, sinking under his reserve;
 *   * `down`: on the snow, lying there;
 *   * `gone`: out over the edge, or taken off — dropped at the end of the
 *     step. */
export type ArmyParaMode = "due" | "fly" | "leave" | "fall" | "down" | "gone";

/** What brought a paramotor down: a stolen helicopter's blades (`ram`) or
 * its wash (`wash`), a rocket's burst (`burst`), or the snow or a crown
 * it was flown into (`terrain` — the one the labs hold at nought). */
export type ArmyParaDown = "ram" | "wash" | "burst" | "terrain";

/** ONE OF THE ARMY'S PARAMOTORS: the soldier in the harness (the pilot's
 * place and way, world frame, m and m/s — the body the lines hang) and the
 * WING over him (`ParaState`, the free ride's paramotor's own shape, so
 * the free ride's drawing hangs off it as it is); which way round it
 * circles; the rifle's aim (heading and pitch, rad); when he may next fire
 * and when he last saw him; how it came down and whether he rode down
 * under his reserve. */
export type ArmyPara = {
  id: number;
  mode: ArmyParaMode;
  due: number;
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  wing: ParaState;
  /** 1 clockwise seen from above, −1 anticlockwise. */
  dir: 1 | -1;
  /** The bearing from the map's middle it came in on, rad. */
  bearing: number;
  /** The height it is holding, m (the world's), and the run time it was
   * read. */
  want: number;
  read: number;
  /** The wing's rate of turn, rad/s, smoothed (the hands damp against it). */
  rate: number;
  aimH: number;
  aimP: number;
  next: number;
  saw: number;
  /** The run time of his last burst. */
  fired: number;
  /** Whether the rifle is up — a burst within the last moment or so (the
   * drawing shoulders it). */
  firing: boolean;
  why: ArmyParaDown | null;
  reserve: boolean;
};

/** What one of the army's balloons is doing:
 *   * `due`: called, being laid out and burned up upwind of him (it is let
 *     go at `due`);
 *   * `fly`: drifting in on the wind at the height its pilot picks, the
 *     rocketeers firing when he is in reach;
 *   * `leave`: past him or the hunt over, climbed away to be gone;
 *   * `fall`: BROUGHT DOWN — its envelope torn by a burst or a stolen
 *     helicopter's blades (and, with the INJURIES on, alight), sinking to
 *     the snow with its burner shut;
 *   * `down`: on the snow — let down, or (counted, never meant) crashed or
 *     burnt;
 *   * `gone`: taken off — dropped at the end of the step. */
export type ArmyBalloonMode = "due" | "fly" | "leave" | "fall" | "down" | "gone";

/** ONE OF THE ARMY'S BALLOONS: its body (the free ride's balloon's own
 * state, flown by the same heat and drift, `flyBalloon`, so the free
 * ride's drawing hangs off it as it is) and its crew — the rocketeers in
 * its basket, each one's aim (heading and pitch, rad) and the run time he
 * last fired (the drawing shoulders the launcher and the backblast puffs);
 * the height its pilot holds over the snow, m, and when he last picked it;
 * when the next rocket may go, and which man fires it. */
export type ArmyBalloon = {
  id: number;
  mode: ArmyBalloonMode;
  due: number;
  t: number;
  body: BalloonState;
  crew: { aimH: number; aimP: number; fired: number }[];
  hold: number;
  picked: number;
  next: number;
  seat: number;
  saw: number;
  /** Crashed or burnt out of the sky — the labs hold it at nought. */
  lost: boolean;
  /** Brought down (`tearBalloon`): its fall and its crash are no fault. */
  downed: boolean;
};

/** THE ARMY'S AIR BESIDE ITS HELICOPTERS, made the first time the roster
 * asks for a paramotor or a balloon: the paramotors and the balloons out,
 * the next one's ids, and the counts the labs read — called, brought down
 * by him, lost by mistake, rockets fired, the army's own vehicles knocked
 * out by a burst. */
export type ArmyAirState = {
  paras: ArmyPara[];
  balloons: ArmyBalloon[];
  nextPara: number;
  nextBalloon: number;
  parasCalled: number;
  balloonsCalled: number;
  parasDowned: number;
  balloonsDowned: number;
  parasLost: number;
  balloonsLost: number;
  rockets: number;
  knocked: number;
};

/** THE ARMY'S AIR'S EVENT: a paramotor or a balloon called (`called`) and
 * on the map (`out`), a rifleman's burst (`fire`), a rocket away
 * (`rocket`), a paramotor or a balloon brought down (`downed`) and on the snow
 * (`landed`), a balloon or a paramotor lost by mistake (`crash`), one of
 * the army's own vehicles knocked out by a burst (`knocked`), and gone
 * (`gone`). */
export type ArmyAirEvent = {
  kind: "army-air";
  t: number;
  change: "called" | "out" | "fire" | "rocket" | "downed" | "landed" | "crash" | "knocked" | "gone";
  craft: "paramotor" | "balloon" | "vehicle";
  id: number;
  x: number;
  y: number;
  z: number;
};

/** THE ARMY'S AIR at nothing out. */
export function freshAirState(): ArmyAirState {
  return {
    paras: [],
    balloons: [],
    nextPara: 0,
    nextBalloon: 0,
    parasCalled: 0,
    balloonsCalled: 0,
    parasDowned: 0,
    balloonsDowned: 0,
    parasLost: 0,
    balloonsLost: 0,
    rockets: 0,
    knocked: 0,
  };
}
