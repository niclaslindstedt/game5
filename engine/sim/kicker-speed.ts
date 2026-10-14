// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A KICKER OR A DROP ASKS OF A SKIER — the speed at its lip he still
// lands from: the bot's (`bot.ts`, which checks to it) and the daring
// bot's (`daring.ts`, which goes at it flat out to it). Worked out once a
// lip per pair, gravity and margin, and kept beside the map, never in it.

import type { Cliff, Kicker, Level } from "../mapgen/types.ts";
import type { SkiSpec } from "../game/defs/skis.ts";
import { harshSpeedOf } from "../game/limits.ts";

/** THE SPEED A KICKER WANTS, m/s: the fastest a skier can leave its lip and
 * still come down on its landing rather than past it — found by flying a
 * point off the lip at the ramp's own angle over the real snow, at each
 * speed in turn, until the impact into the slope would fold the legs of
 * the skier on these skis — `margin` the share of the harsh-landing speed
 * (`air.harshSpeed`) it is planned to be landed under. A skier learns this on his first run; the bot
 * is handed it. Worked out once per kicker per pair. */
const kickerSpeeds = new WeakMap<SkiSpec, Map<string, WeakMap<Kicker | Cliff, number>>>();
function knownSpeeds(spec: SkiSpec, fall: number, margin: number): WeakMap<Kicker | Cliff, number> {
  let bySpec = kickerSpeeds.get(spec);
  if (!bySpec) {
    bySpec = new Map();
    kickerSpeeds.set(spec, bySpec);
  }
  const key = `${fall}:${margin}`;
  let mine = bySpec.get(key);
  if (!mine) {
    mine = new WeakMap();
    bySpec.set(key, mine);
  }
  return mine;
}
export function kickerSpeed(
  level: Level,
  k: Kicker,
  spec: SkiSpec,
  margin: number,
  fall: number,
): number {
  const mine = knownSpeeds(spec, fall, margin);
  const known = mine.get(k);
  if (known !== undefined) return known;
  const fx = Math.sin(k.heading);
  const fz = Math.cos(k.heading);
  const lip = level.groundAt(k.x, k.z);
  // The ramp rises as t² (`kickerProfile`), steepest AT the lip, so its
  // grade over the last 2 m reads flatter than the one the skier leaves on:
  // the profile's own share of that difference is put back, exactly.
  const back = Math.min(2, k.ramp);
  const averaged = (k.height * (1 - (1 - back / k.ramp) ** 2)) / back;
  const angle = Math.atan(
    (lip - level.groundAt(k.x - fx * back, k.z - fz * back)) / back +
      (2 * k.height) / k.ramp -
      averaged,
  );
  const best = flownSpeed(level, k.x, k.z, fx, fz, lip, angle, spec, margin, fall);
  mine.set(k, best);
  return best;
}

/** THE SPEED A DROP WANTS (R24), m/s: the same flight off its edge, which
 * the shelf leaves level with the line — so the skier goes over it along
 * the line's own pitch, read over the last two metres before it. */
export function dropSpeed(
  level: Level,
  d: Cliff,
  spec: SkiSpec,
  margin: number,
  fall: number,
): number {
  const mine = knownSpeeds(spec, fall, margin);
  const known = mine.get(d);
  if (known !== undefined) return known;
  const fx = Math.sin(d.heading);
  const fz = Math.cos(d.heading);
  const lip = level.groundAt(d.x, d.z);
  const angle = Math.atan((lip - level.groundAt(d.x - fx * 2, d.z - fz * 2)) / 2);
  const best = flownSpeed(level, d.x, d.z, fx, fz, lip, angle, spec, margin, fall);
  mine.set(d, best);
  return best;
}

/** The fastest a point flown off a lip at `angle` over the real snow
 * comes down without the impact into the slope folding the legs. */
function flownSpeed(
  level: Level,
  x0: number,
  z0: number,
  fx: number,
  fz: number,
  lip: number,
  angle: number,
  spec: SkiSpec,
  margin: number,
  fall: number,
): number {
  const floor = 0.9;
  const limit = harshSpeedOf(spec) * margin;
  const n = { x: 0, y: 1, z: 0 };
  let best = 8;
  for (let v = 8; v <= 45; v += 1) {
    let x = x0;
    let z = z0;
    let y = lip + floor;
    const h = v * Math.cos(angle);
    let vy = v * Math.sin(angle);
    let impact = 0;
    for (let t = 0; t < 5; t += 0.02) {
      x += fx * h * 0.02;
      z += fz * h * 0.02;
      vy -= fall * 0.02;
      y += vy * 0.02;
      if (y <= level.groundAt(x, z) + floor) {
        level.normalAt(x, z, n);
        impact = -(fx * h * n.x + vy * n.y + fz * h * n.z);
        break;
      }
    }
    if (impact > limit) break;
    best = v;
  }
  return best;
}
