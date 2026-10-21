// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GUNFIRE as the run holds it (`gunfire.ts`) — a type of its own so
// `state.ts` can carry it without importing the step that moves it.

import type { BodyPart } from "./defs/anatomy.ts";
import type { WeaponKind } from "./defs/weapons.ts";

/** THE RULES OF FIRE a burst is fired under (`defs/wanted.ts`' roster):
 * `hold` none, `warn` aimed off him, `aim` aimed at him. */
export type FireRules = "hold" | "warn" | "aim";

/** WHAT A BURST IS AIMED AT: the hunted man (or the machine he rides —
 * `quarryOf`), or a point (with its velocity, to lead it). */
export type AimTarget =
  | { kind: "quarry" }
  | { kind: "point"; x: number; y: number; z: number; vx?: number; vy?: number; vz?: number };

/** THE MACHINES a round can bring down. */
export type GunMachine = "heli" | "plane" | "sled" | "balloon" | "armour";

/** ONE GUN — a rifle in a soldier's hands, a door gun, a launcher on a
 * shoulder: its owner arms it (`armGun`), writes where its muzzle is and
 * how the platform under it moves every step, and pulls the trigger with
 * `fireAt`; `stepGunfire` fires its burst's rounds at the cyclic rate. */
export type Gun = {
  id: number;
  weapon: WeaponKind;
  /** The muzzle, world frame, m, and the platform's velocity, m/s (the
   * rounds leave with it). */
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Rounds still to fire of this burst. */
  left: number;
  /** Seconds to the next round of the burst, or — between bursts — to
   * when the gun is ready again (the pause, the reload). */
  wait: number;
  /** Rounds this burst has fired (the climb grows with them), and rounds
   * the gun has fired in all (every `tracer`th glows). */
  shot: number;
  fired: number;
  /** The burst's rules and its target. */
  rules: FireRules;
  target: AimTarget | null;
  /** The burst's aim error, drawn once a burst: across and up, mil, and
   * the share of the lead misjudged; and for warning fire (`spot`), the
   * offset off him the burst is put down in the snow at, m (world x, z). */
  ex: number;
  ey: number;
  el: number;
  spot: boolean;
  ox: number;
  oz: number;
};

/** ONE ROUND, ROCKET OR SHELL IN FLIGHT. */
export type Round = {
  id: number;
  gun: number;
  weapon: WeaponKind;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** Seconds since it left, and metres flown. */
  age: number;
  flown: number;
  /** A glowing tracer round. */
  tracer: boolean;
  /** Warning fire: never tested against his body. */
  warn: boolean;
  /** Whether its crack past him has been heard. */
  snapped: boolean;
};

/** THE GUNFIRE on a run that armed a gun — absent on every other, so no
 * digest moves. Its own stream (`stream`, a mulberry32 state) deals every
 * spread and burst; nothing draws from `state.rng`. */
export type GunfireState = {
  guns: Gun[];
  rounds: Round[];
  stream: number;
  /** The next round's id. */
  next: number;
  /** WHAT EACH MACHINE HAS TAKEN, a share of what brings it down
   * (`GUNFIRE.machine`), and whether it is lost. */
  damage: Record<GunMachine, number>;
  lost: Record<GunMachine, boolean>;
  /** Counts the labs read: rounds fired, and rounds that struck him. */
  fired: number;
  hits: number;
  /** THE LOG the drawing reads (`gunfire-log.ts`): the last events said,
   * a ring, each numbered; and how many have been said. */
  log: { n: number; e: GunfireEvent }[];
  said: number;
};

/** THE GUNFIRE'S EVENTS:
 *   - `shot`: a gun fired (where, the way the round left, and whether a
 *     tracer) — the muzzle's flash and its report;
 *   - `hit`: a round or a fragment struck him (`part`, the energy `j`);
 *   - `impact`: a round struck the snow, a trunk, steel, rock or a machine
 *     (`on`) — the puff, the chips, the spark;
 *   - `blast`: a rocket or a shell burst;
 *   - `snap`: a round passed close by him — the crack going by;
 *   - `machine`: a machine he rides took a hit (`stage`: `hit`, `smoke`,
 *     `fail`, `lost`). */
export type GunfireEvent = {
  kind: "gunfire";
  t: number;
  phase: "shot" | "hit" | "impact" | "blast" | "snap" | "machine";
  weapon: WeaponKind;
  x: number;
  y: number;
  z: number;
  /** `shot`: the way the round left, a unit vector. */
  dx?: number;
  dy?: number;
  dz?: number;
  tracer?: boolean;
  /** `impact`: what it struck. */
  on?: "snow" | "trunk" | "steel" | "rock" | "machine" | "body";
  /** `hit`: the part, and the energy it carried, J. */
  part?: BodyPart;
  j?: number;
  /** `machine`: which, and what it came to. */
  machine?: GunMachine;
  stage?: "hit" | "smoke" | "fail" | "lost";
  gun?: number;
};
