// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BLAST — what a burst does where it goes off, the one layer every
// explosive the army fires bursts through: a shoulder-fired rocket, a
// tank's high-explosive shell, and anything later that bursts on the snow
// (a balloon's rockets). The gunfire flies the round (`gunfire.ts`) and
// hands its burst here with the weapon's numbers (`BlastDef`'s `kill`,
// `wound`, `throw`, `shove`, `frag` and `crater`):
//   * THE BURST ITSELF is said once (the gunfire's `blast` event, filed in
//     its log): the drawing's fireball, its column of snow and smoke and
//     its CRATER (the weapon's `crater`, pressed into the snow where it
//     went off), and the ear's report;
//   * A MACHINE near it — the helicopter, the plane, the snowmobile or
//     the balloon he rides — takes a burst's damage at once; and the
//     army's own near it — a carrier, a truck or a tank knocked out, a
//     paramotor's wing shredded (`army-burst.ts`);
//   * HIS BODY, only where the army shoots to kill (`lethalOf`) and he is
//     not inside a cabin: inside `throw` m the blast knocks him off his
//     feet (the `blast` crash), away from it and up, harder the nearer;
//     inside `wound` m its fragments strike him, more and harder the
//     nearer; inside `kill` m, with the INJURIES switch on, he is torn
//     apart. With SAFE FOR WORK on nothing of it reaches him.
//
// The fragments are dealt off the gunfire's own stream and the pieces torn
// off a hash of the map and the round — never `state.rng`.

import { hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { hash2 } from "@niclaslindstedt/oss-game-framework/core/noise";
import { burstOnArmy } from "./army-burst.ts";
import { pierceBody, type PierceHit } from "./body.ts";
import { throwRider } from "./crash.ts";
import { sever } from "./gore.ts";
import { gunDraw, lethalOf } from "./gunfire.ts";
import { bodyCentre } from "./gunfire-body.ts";
import { sayGunfire } from "./gunfire-log.ts";
import { MACHINES, damageMachine, machineAt } from "./gunfire-machine.ts";
import type { BlastDef, WeaponKind } from "./defs/weapons.ts";
import type { BodyPart } from "./defs/anatomy.ts";
import type { GameEvent, GameState } from "./state.ts";
import type { GorePiece } from "./gore-state.ts";
import type { GunfireState } from "./gunfire-state.ts";

/** The torn pieces' hash, the gunfire's own salt. */
const SALT = 0x6a7f1e;

/** What of a blast's numbers the burst reads. */
export type BlastSpec = Pick<BlastDef, "kill" | "wound" | "throw" | "shove" | "frag">;

/** Whether he sits in a cabin a round must come through the airframe to
 * reach: the helicopter he flies, the plane. */
export function inCabin(state: GameState): boolean {
  return !!(state.heli?.rider && state.heli.mode !== "wreck") || !!state.plane?.rider;
}

/** The parts a burst's fragments find, in the order they are dealt. */
const FRAG_PARTS: readonly BodyPart[] = [
  "chest",
  "abdomen",
  "thighL",
  "thighR",
  "armL",
  "armR",
  "shinL",
  "shinR",
  "head",
  "shoulderL",
  "shoulderR",
  "pelvis",
  "back",
  "neck",
];

/** A BURST at (x, y, z) of `weapon`'s (numbers `def`): said, the machines
 * near it damaged, and the man near it thrown, struck or torn where the
 * army shoots to kill. `key` keys the pieces torn (the round's id). */
export function blastAt(
  state: GameState,
  g: GunfireState,
  def: BlastSpec,
  x: number,
  y: number,
  z: number,
  weapon: WeaponKind,
  key: number,
  events: GameEvent[],
): void {
  sayGunfire(g, events, { kind: "gunfire", t: state.t, phase: "blast", weapon, x, y, z });
  // The machines near it.
  for (const m of MACHINES) {
    const at = machineAt(state, m);
    if (at && hypot3(at.x - x, at.y - y, at.z - z) < def.kill + 5)
      damageMachine(state, g, m, 0, true, weapon, events);
  }
  // The hunt's own machines near it (`army-burst.ts`).
  burstOnArmy(state, x, y, z, events);
  // Never on his body where the army does not shoot to kill.
  if (!lethalOf(state) || inCabin(state)) return;
  const c = bodyCentre(state);
  const d = hypot3(c.x - x, c.y - y, c.z - z);
  if (d > Math.max(def.wound, def.throw)) return;
  // THE BLAST off his feet: away from it and up, harder the nearer.
  const sk = state.skier;
  if (d < def.throw) {
    const k = def.shove * (1 - d / def.throw);
    const n = Math.max(0.5, d);
    const v = {
      x: (sk.thrown?.vx ?? sk.vx) + ((c.x - x) / n) * k,
      y: (sk.thrown?.vy ?? sk.vy) + k * 0.6,
      z: (sk.thrown?.vz ?? sk.vz) + ((c.z - z) / n) * k,
    };
    if (!sk.thrown && !sk.lift) throwRider(state, "blast", v, events);
  }
  // THE FRAGMENTS: more and harder the nearer.
  if (d < def.wound) {
    const near = Math.max(0, 1 - d / def.wound);
    const n = Math.max(1, Math.round(1 + 6 * near * near + gunDraw(g) * 2 * near));
    const hits: PierceHit[] = [];
    for (let k = 0; k < n; k++) {
      const part = FRAG_PARTS[Math.floor(gunDraw(g) * FRAG_PARTS.length)];
      const j = def.frag * Math.min(2, def.kill / Math.max(def.kill * 0.5, d)) * (0.5 + gunDraw(g));
      hits.push({ part, j });
      sayGunfire(g, events, {
        kind: "gunfire",
        t: state.t,
        phase: "hit",
        weapon,
        x: c.x,
        y: c.y,
        z: c.z,
        part,
        j,
        on: "body",
      });
    }
    g.hits += 1;
    pierceBody(state, events, hits);
  }
  // TORN APART inside its kill radius, with the INJURIES switch on.
  if (d < def.kill && state.gore && state.skier.thrown) {
    const deal = (k: number): number => hash2(k, key, (state.seed ^ SALT) | 0);
    const pieces: GorePiece[] = [];
    // Each piece's chance: a third at the kill radius's edge, sure at
    // half of it.
    const near = Math.min(1, 1 / 3 + (4 / 3) * (1 - d / def.kill));
    if (deal(0) < near * 0.5) pieces.push("head");
    if (deal(1) < near) pieces.push(deal(2) < 0.5 ? "armL" : "forearmL");
    if (deal(3) < near) pieces.push(deal(4) < 0.5 ? "armR" : "forearmR");
    if (deal(5) < near * 0.4) pieces.push("lower");
    else {
      if (deal(6) < near) pieces.push(deal(7) < 0.5 ? "legL" : "shinL");
      if (deal(8) < near) pieces.push(deal(9) < 0.5 ? "legR" : "shinR");
    }
    sever(state, pieces, near > 0.4 ? ["chest", "abdomen"] : ["abdomen"], events);
  }
}
