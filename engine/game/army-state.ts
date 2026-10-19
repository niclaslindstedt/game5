// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTERS as the run holds them (`army.ts`) — a type of its
// own so `state.ts` can carry it without importing the step that moves it.

import type { GunfireEvent } from "./gunfire-state.ts";
import type { WantedEvent } from "./wanted-state.ts";

/** What one machine is doing:
 *   * `due`: called, not yet on the map (it comes in at `due`);
 *   * `hunt`: on the map, after him — orbiting him, sat off his tail, or
 *     combing where he was last seen while they search;
 *   * `leave`: flying out over the map's edge, the hunt over;
 *   * `fall`: rammed, its tail gone, spinning down;
 *   * `wreck`: on the snow, burning;
 *   * `gone`: out over the edge, or the wreck burnt out — dropped at the
 *     end of the step. */
export type ArmyHeliPhase = "due" | "hunt" | "leave" | "fall" | "wreck" | "gone";

/** A door gun's aim, rad: `yaw` from square out of the door (toward the
 * nose positive), `pitch` above level — as `ARMY_HELI.gun` states its
 * arcs. */
export type ArmyGunAim = { yaw: number; pitch: number };

/** ONE OF THE ARMY'S HELICOPTERS: the skid datum's place and velocity in
 * the world (m, m/s), its attitude (rad, the game's sign conventions),
 * and what the drawing and the ear read — the rotor's spool, each sliding
 * door's slide and each door gun's aim. */
export type ArmyHeli = {
  id: number;
  phase: ArmyHeliPhase;
  /** Run time it comes in at (`due`), and seconds in its phase. */
  due: number;
  t: number;
  /** The bearing from the map's middle it comes in on, rad. */
  bearing: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** The acceleration it is pulling, m/s², world frame (smoothed: the
   * attitude follows it). */
  ax: number;
  az: number;
  heading: number;
  pitch: number;
  roll: number;
  yawRate: number;
  /** The rotor's share of its full rpm, 0..1. */
  spool: number;
  /** Whether it has reached the hunt: come within the search's circle
   * of where he was last seen. */
  on: boolean;
  /** Which way round it flies its circle: 1 clockwise seen from above
   * (the right door inward), −1 anticlockwise (the left). */
  dir: 1 | -1;
  /** Which doors are manned (the roster's gunners shared out). */
  manned: { r: boolean; l: boolean };
  /** How far each door stands open, 0..1. */
  doors: { r: number; l: number };
  guns: { r: ArmyGunAim; l: ArmyGunAim };
  /** Whether a gun bore on him this step (it fires whenever it may). */
  bears: { r: boolean; l: boolean };
};

/** THE ARMY'S AIR on a run hunted at a star that sends helicopters —
 * absent on every other, so no digest moves. Its own stream (`stream`, a
 * mulberry32 state seeded off the run) deals the bearing they come in on
 * and the way each circles; nothing draws from `state.rng`. */
export type ArmyState = {
  helis: ArmyHeli[];
  stream: number;
  /** The next machine's id. */
  next: number;
  /** The bearing from the map's middle the army comes in from, rad. */
  from: number;
  /** Counts the labs read: machines called, machines rammed down. */
  called: number;
  downed: number;
  /** KEPT HOME (`CreateGameOptions.army` false): the hunt runs with no
   * machine sent — the wanted level alone, as its own tests read it. */
  home?: true;
};

/** THE ARMY'S EVENT: a machine called in (`called`, at its `due`), on
 * the map (`arrived`), turned for home (`leaving`), out over the edge
 * (`gone`), rammed (`rammed`) and come down burning (`down`). */
export type ArmyEvent = {
  kind: "army";
  t: number;
  change: "called" | "arrived" | "leaving" | "gone" | "rammed" | "down";
  id: number;
  x: number;
  y: number;
  z: number;
};

/** THE HUNT'S EVENTS — the wanted level's, the gunfire's and the army's
 * machines' — as one row of `GameEvent`. */
export type HuntEvent = WantedEvent | GunfireEvent | ArmyEvent;
