// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S HELICOPTERS as the run holds them (`army.ts`) — a type of its
// own so `state.ts` can carry it without importing the step that moves it.

import type { GunfireEvent } from "./gunfire-state.ts";
import type { SledState } from "./sled-state.ts";
import type { WantedEvent } from "./wanted-state.ts";

/** What one machine is doing:
 *   * `due`: called, not yet on the map (it comes in at `due`);
 *   * `hunt`: on the map, after him — orbiting him, sat off his tail, or
 *     combing where he was last seen while they search;
 *   * `land`: flying to a landing's spot and down onto it (or to the
 *     hover over it, for a fast rope); `set`: on the snow, its doors open;
 *     `rope`: hovering, the men sliding down; `rise`: climbing back off it
 *     to the hunt;
 *   * `leave`: flying out over the map's edge, the hunt over;
 *   * `fall`: rammed, its tail gone, spinning down;
 *   * `wreck`: on the snow, burning;
 *   * `gone`: out over the edge, or the wreck burnt out — dropped at the
 *     end of the step. */
export type ArmyHeliPhase =
  "due" | "hunt" | "land" | "set" | "rope" | "rise" | "leave" | "fall" | "wreck" | "gone";

/** A LANDING the ground's part (`army-ground.ts`) has asked of a machine:
 * to put men DOWN near him (`drop`) or to PICK UP a squad left behind
 * (`pick`), at a spot on the snow (x, y, z, m, the skid datum's place) —
 * set down on it, or (`rope`) hovered over it and the men down a fast
 * rope; `heading` the way it is set down facing, rad. The ground's part
 * says when it is `done` (every man out, or in), and the flight lifts off. */
export type LandTask = {
  kind: "drop" | "pick";
  x: number;
  y: number;
  z: number;
  heading: number;
  rope: boolean;
  /** How many it is to put down (a drop), how many are out, and the run
   * time the last of them was clear (NaN: not yet). */
  count: number;
  put: number;
  clear: number;
  done: boolean;
};

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
  /** The men aboard to put down (`ARMY_GROUND.section` when called), and
   * the landing it has been asked for (null: none). */
  aboard: number;
  task: LandTask | null;
};

/** What a soldier on the ground is doing (`army-ground.ts`):
 *   * `climb`: with his ground wave's column, up the way from the valley
 *     (`army-wave.ts`), until he leaves it for the fight;
 *   * `rope`: sliding down a hovering machine's fast rope;
 *   * `out`: off a landed machine — run out to his side and knelt facing
 *     out until it has lifted;
 *   * `chase`: after him on his skis (or his feet), downhill, skating the
 *     flats and climbing the rises;
 *   * `aim`: stopped — stood or knelt — and firing;
 *   * `board`: skiing to a machine come to pick his squad up;
 *   * `walk`: to a lift's load line (`army-lift.ts`); `wait`: at it;
 *     `ride`: on a carrier of it, up;
 *   * `down`: knocked off his feet (the person on foot `foot.ts` keeps);
 *     `hurt`: past getting up; `dead`;
 *   * `arrest`: holding the man he took (SAFE FOR WORK on); `cover`: his
 *     rifle on him while another does;
 *   * `gone`: aboard a machine — dropped at the end of the step. */
export type SoldierMode =
  | "climb"
  | "rope"
  | "out"
  | "chase"
  | "aim"
  | "board"
  | "walk"
  | "wait"
  | "ride"
  | "down"
  | "hurt"
  | "dead"
  | "arrest"
  | "cover"
  | "gone";

/** ONE SOLDIER ON THE GROUND: his feet's place (m), his way over the snow
 * (m/s, plan) and his heading (rad); his `role` (a rifleman on skis, a
 * rifleman on foot, or the anti-armour man on foot) and where he came from
 * (a machine's squad is its id; a lift's squad is numbered past
 * `LIFT_SQUAD`, a snowmobile's crew past `SLED_SQUAD`, a ground wave's past
 * `WAVE_SQUAD`); what he is doing
 * and for how long; the stance he fires from and the way he aims; and the
 * bookkeeping his decisions run on. */
export type Soldier = {
  id: number;
  role: "rifle" | "foot" | "rocket";
  from: "heli" | "lift" | "sled" | "wave";
  squad: number;
  mode: SoldierMode;
  /** Seconds in his mode. */
  t: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  speed: number;
  /** Working up a rise (skating, a herringbone, a traverse) rather than
   * gliding: what the figure is drawn doing. */
  climb: boolean;
  /** The turn he leans into, −1..1 (positive right), and his tuck, 0..1. */
  lean: number;
  tuck: number;
  /** Where he is going when it is not after him (the spot he runs out to,
   * the machine's door, a lift's load line), m. */
  tx: number;
  tz: number;
  /** His stance and the way he aims (`aim`), rad: the heading and the
   * pitch of his weapon. */
  kneel: boolean;
  aimH: number;
  aimP: number;
  /** Bursts fired this stop, and the run time he may next stop to fire. */
  bursts: number;
  next: number;
  /** The run time he last had him in sight, and last shouted at him. */
  saw: number;
  shout: number;
  /** ON A LIFT: which (its place among the map's lifts), the carrier and
   * his seat on it. */
  lift: number;
  carrier: number;
  seat: number;
  /** WITH A GROUND WAVE: the next point of its way up he climbs to (−1:
   * none), and his file — how far right of the way's line he climbs, m. */
  leg: number;
  lane: number;
  /** NOT GETTING STUCK: where he was at the last check and when, how many
   * checks in a row he barely moved, and the side he steps off to and until
   * when. */
  wx: number;
  wz: number;
  wt: number;
  slow: number;
  side: number;
  until: number;
};

/** A GROUND WAVE'S WAY UP (`army-wave.ts`): its squad, and the points it
 * climbs from its column's tail to him — each a place on a run (m) and the
 * run's width there, m. */
export type WaveRoute = {
  squad: number;
  pts: { x: number; z: number; w: number }[];
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
  /** THE SOLDIERS ON THE GROUND (`army-ground.ts`), the next one's id,
   * the lifts' squads sent, and the run time the next is due (NaN: none
   * asked for). */
  troops: Soldier[];
  nextSoldier: number;
  liftSquads: number;
  liftDue: number;
  /** Counts the labs read: soldiers put down, picked up again. */
  dropped: number;
  picked: number;
  /** THE SNOWMOBILES (`army-sled.ts`), the next one's id, and the counts
   * the labs read: machines called, crews knocked off, machines stolen. */
  sleds: ArmySled[];
  nextSled: number;
  sledsCalled: number;
  crewsDown: number;
  sledsTaken: number;
  /** THE GROUND WAVES (`army-wave.ts`): the waves sent this hunt (the
   * next one's number in `groundWave`), the star the count `waveAt` was
   * kept against, the snowmobiles the last wave keeps out on top of the
   * roster's, the ways up being climbed, and the men marched out (the
   * labs' count). */
  waves: number;
  waveStar: number;
  waveAt: number;
  waveSleds: number;
  routes: WaveRoute[];
  marched: number;
  /** THE ARREST: the soldier holding him, when it was made, and where and
   * which way he was put down — absent until one is. */
  arrest?: { by: number; t: number; x: number; z: number; heading: number };
  /** KEPT HOME (`CreateGameOptions.army` false): the hunt runs with no
   * machine sent — the wanted level alone, as its own tests read it. */
  home?: true;
};

/** THE ARMY'S EVENT: a machine called in (`called`, at its `due`), on
 * the map (`arrived`), turned for home (`leaving`), out over the edge
 * (`gone`), rammed (`rammed`), come down burning (`down`), set down on the
 * snow or hovered for the rope (`landed`), and off it again (`lifted`);
 * and a ground wave sent up the mountain (`wave`: `id` its number, the
 * place its column forms up at). */
export type ArmyEvent = {
  kind: "army";
  t: number;
  change:
    "called" | "arrived" | "leaving" | "gone" | "rammed" | "down" | "landed" | "lifted" | "wave";
  id: number;
  x: number;
  y: number;
  z: number;
};

/** A SOLDIER'S EVENT: put down on the snow off a landing or a rope
 * (`out`), stopped to fire (`aim`), knocked down by the player (`down`),
 * up again (`up`), killed (`dead`), aboard a machine again (`aboard`), on
 * a lift's carrier (`lift`), the man taken (`arrest`), and the order
 * shouted at him to stop (`shout`). */
export type SoldierEvent = {
  kind: "soldier";
  t: number;
  change: "out" | "aim" | "down" | "up" | "dead" | "aboard" | "lift" | "arrest" | "shout";
  id: number;
  x: number;
  y: number;
  z: number;
};

/** What one of the army's snowmobiles is doing (`army-sled.ts`):
 *   * `due`: called, its crew mounting up in the village (it leaves at
 *     `due`);
 *   * `drive`: after him over the snow (or where he was last seen);
 *   * `halt`: stopped for the gunner to fire;
 *   * `empty`: stood where its crew left it — knocked off by him, or got
 *     off to take him in — to be stolen;
 *   * `leave`: the hunt over, driving home to the village;
 *   * `gone`: home, or stolen — dropped at the end of the step. */
export type ArmySledMode = "due" | "drive" | "halt" | "empty" | "leave" | "gone";

/** ONE OF THE ARMY'S SNOWMOBILES: its body on the snow (the free ride's
 * machine, `SledState`, stepped by `rideSled`), what it is doing and for
 * how long, the way it is steering (`way`, rad, chosen by reading the
 * snow ahead) and the pace it wants, m/s; the gunner's aim off its nose
 * (`aimYaw`, `aimPitch`, rad); the bursts fired this halt and when it may
 * next halt; when its crew last had him in sight; and the bookkeeping its
 * stuck watch runs on. */
export type ArmySled = {
  id: number;
  mode: ArmySledMode;
  due: number;
  t: number;
  body: SledState;
  /** Where it set off from, m (the village), and where it is going. */
  home: { x: number; z: number };
  way: number;
  pace: number;
  aimYaw: number;
  aimPitch: number;
  bursts: number;
  next: number;
  saw: number;
  /** The crew still on it: the driver and the gunner. */
  driver: boolean;
  gunner: boolean;
  /** NOT GETTING STUCK: where it was at the last check and when, how many
   * windows in a row it barely moved, the side it swings off to and until
   * when, and how often its crew dug it out. */
  wx: number;
  wz: number;
  wt: number;
  slow: number;
  side: number;
  until: number;
  dug: number;
};

/** A SNOWMOBILE'S EVENT: called in (`called`), out of the village
 * (`out`), stopped to fire (`halt`), its crew knocked off by him
 * (`knocked`), its crew off it to take him in (`dismount`), dug out
 * (`dug`), stolen (`stolen`), and home (`gone`). */
export type ArmySledEvent = {
  kind: "army-sled";
  t: number;
  change: "called" | "out" | "halt" | "knocked" | "dismount" | "dug" | "stolen" | "gone";
  id: number;
  x: number;
  y: number;
  z: number;
};

/** THE HUNT'S EVENTS — the wanted level's, the gunfire's, the army's
 * machines', its soldiers' and its snowmobiles' — as one row of `GameEvent`. */
export type HuntEvent = WantedEvent | GunfireEvent | ArmyEvent | SoldierEvent | ArmySledEvent;
