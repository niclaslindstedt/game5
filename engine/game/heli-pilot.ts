// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BOT'S HANDS ON THE HELICOPTER — the same four controls the player has
// (`HeliControls`: the collective, the cyclic's two axes, the pedals) and
// nothing more, flown by a pilot who knows the machine's physics: what a
// link's pre-roll and a card's run behind it fly, what the labs stage their
// scenes with, and what flies the machine home after the drop. That it can
// fly the bare physics at all is the proof the player can.
//
// A CASCADE, as a pilot flies: where it is to be → the velocity to get
// there (slowed in time, `pilot.brake`) → the acceleration that wants → the
// disc's tilt that gives it (the thrust's lean, the drag at speed held off)
// → the cyclic that tilts the disc there against its damping and its
// flapback; the height over the snow ahead → the climb → the collective
// that lifts for it, through what the rotor can give (`thrustMost`); the
// way it is going → the heading → the pedals, against the rotor's torque
// and the fin's weathervane.
//
// Pure over the state; draws nothing from the stream.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import { HELI } from "./defs/heli.ts";
import { TUNING } from "./defs/tuning.ts";
import { discQuat, heliMass, thrustMost } from "./heli-rotor.ts";
import { profileAt, windAt, type Wind } from "./wind.ts";
import { NEUTRAL_INPUT, type GameState, type HeliControls, type SkierInput } from "./state.ts";

const F = HELI.flight;
const P = HELI.pilot;

/** WHERE THE BOT FLIES: to (x, z), `height` m over the snow — and, with
 * `land`, down onto the snow there. */
export type HeliAim = {
  x: number;
  z: number;
  height: number;
  land?: boolean;
  /** The heading to set down on, rad — the nose turned to it over the last
   * stretch of a landing; with none, the way it is going. */
  face?: number;
};

const wind: Wind = { x: 0, z: 0, speed: 0, gust: 0 };

/** The bot's controls for this step, flying `run`'s helicopter to `aim`. */
export function pilotControls(run: GameState, aim: HeliAim): HeliControls {
  const h = run.heli!;
  const level = run.level;
  const g = TUNING.g;
  const dx = aim.x - h.x;
  const dz = aim.z - h.z;
  const d = hypot(dx, dz);
  // THE WAY THERE: the velocity it wants, slowed in time to stop at the aim.
  const reach = aim.land ? 0 : 4;
  // Near it, in proportion to the distance, so the hover settles rather
  // than hunting across the spot.
  const speed = Math.min(
    P.cruise,
    Math.sqrt(2 * P.brake * Math.max(0, d - reach)),
    0.4 * Math.max(0, d - reach),
  );
  const vxw = d > 0.5 ? (dx / d) * speed : 0;
  const vzw = d > 0.5 ? (dz / d) * speed : 0;
  const tiltMost = Math.tan(P.tilt) * g;
  let axw = 0.8 * (vxw - h.vx);
  let azw = 0.8 * (vzw - h.vz);
  const aw = hypot(axw, azw);
  if (aw > tiltMost) {
    axw *= tiltMost / aw;
    azw *= tiltMost / aw;
  }
  // ...as the disc's tilt in its own heading's frame, with the drag at
  // speed leant into.
  const fx = Math.sin(h.heading);
  const fz = Math.cos(h.heading);
  windAt(level, run.t, wind);
  const lift = profileAt(clamp(h.y - level.groundAt(h.x, h.z) + HELI.cog, 1, 300));
  const airF = (h.vx - wind.x * lift) * fx + (h.vz - wind.z * lift) * fz;
  const airS = (h.vx - wind.x * lift) * fz - (h.vz - wind.z * lift) * fx;
  const m = heliMass(run);
  const dragF = (0.5 * HELI.density * HELI.drag.front * Math.abs(airF) * airF) / m;
  const dragS = (0.5 * HELI.density * HELI.drag.side * Math.abs(airS) * airS) / m;
  const aF = axw * fx + azw * fz + dragF;
  const aS = axw * fz - azw * fx + dragS;
  const pitchTo = clamp(-Math.atan2(aF, g), -P.tilt * 1.3, P.tilt * 1.3);
  const rollTo = clamp(Math.atan2(aS, g), -P.tilt * 1.3, P.tilt * 1.3);
  // THE CYCLIC: the disc's own dynamics inverted — a damped spring onto the
  // tilt wanted, its damping and its flapback paid for.
  const w2 = P.attitude * P.attitude;
  const z2 = 2 * P.damping * P.attitude;
  const sp = h.disc.pitchRate;
  const sr = h.disc.rollRate;
  const wantP = w2 * (pitchTo - h.disc.pitch) - z2 * sp;
  const wantR = w2 * (rollTo - h.disc.roll) - z2 * sr;
  const spool2 = Math.max(0.05, h.spool * h.spool);
  const pitch = clamp(
    -(wantP + F.damping.pitch * sp - F.flapback * airF) / (F.cyclic.pitch * spool2),
    -1,
    1,
  );
  const roll = clamp(
    (wantR + F.damping.roll * sr + F.flapback * airS) / (F.cyclic.roll * spool2),
    -1,
    1,
  );
  // THE PEDALS: the nose the way it is going (or held, at the hover),
  // the torque and the weathervane paid for.
  const going = hypot(h.vx, h.vz) > 6 ? Math.atan2(h.vx, h.vz) : h.heading;
  const yawTo =
    d > 15 && !aim.land
      ? Math.atan2(dx, dz)
      : aim.land && aim.face !== undefined && d < 40
        ? aim.face
        : going;
  const rWant = clamp(angleDiff(h.heading, yawTo) * 1.2, -0.6, 0.6);
  const hover = m * g;
  const torque = F.torque * (h.thrust / hover - 1);
  const vane = HELI.vane * airS * Math.min(40, Math.abs(airF) + Math.abs(airS));
  const pedal = clamp(
    (3 * (rWant - h.yawRate) + F.yawDamping * h.yawRate + torque - vane) / F.pedal,
    -1,
    1,
  );
  // THE COLLECTIVE: the height over the snow along the way, the climb to it,
  // the thrust that climbs so, as a share of what the rotor gives.
  let ground = level.groundAt(h.x, h.z);
  const look = Math.min(d, 300);
  for (let s = 30; s <= look; s += 30) {
    ground = Math.max(ground, level.groundAt(h.x + (dx / d) * s, h.z + (dz / d) * s));
  }
  const over = h.y - level.groundAt(h.x, h.z);
  const flat = hypot(h.vx, h.vz);
  const sinkMost = flat > 15 ? P.sink : P.sinkSlow;
  let climb = clamp(0.4 * (ground + aim.height - h.y), -sinkMost, P.climb);
  if (aim.land && d < 5 && flat < 2.5) {
    climb = -clamp(over * 0.25, P.settle, P.sinkSlow);
    if (h.grounded) return { collective: 0, pitch: 0, roll: 0, pedal: 0 };
  }
  const up = rotate(discQuat(h), { x: 0, y: 1, z: 0 });
  const want = (m * (g + P.hold * (climb - h.vy))) / Math.max(0.5, up.y);
  const along = hypot(airF, airS);
  const most = thrustMost(along, h.vy, h.agl) * h.spool * h.spool;
  const collective = most > 0 ? clamp(want / most, 0, 1) : 0;
  return { collective, pitch, roll, pedal };
}

/** THE BOT'S INPUT for a skier sat on the skid: `pilotControls` to `aim` —
 * with none, up the mountain (−z, the face) at `pilot.clear` m over the
 * snow. Never the jump: that is the player's. */
export function pilotInput(run: GameState, aim?: HeliAim): SkierInput {
  const h = run.heli!;
  const to = aim ?? { x: h.x, z: h.z - 400, height: P.clear };
  return { ...NEUTRAL_INPUT, heli: pilotControls(run, to) };
}
