// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AERIALS KICKER RIDDEN (R41): from its foot to its lip the skier is
// carried up the kicker's curve as a bead on a wire (`jib.ts`'s way with a
// rail), his skis on the snow and his body square to it.
//
// WHY A WIRE. A real aerialist takes a kicker curved to 71° on six metres
// of radius at 60 km/h by holding his legs against some seven g, and leaves
// it at the speed the climb and the snow's friction leave him. The game's
// skier stands on springs tuned for a piste (`suspension.ts`): on a curve
// that tight they cannot carry him round it, his skis' rigid tips do, and
// the hull's friction (`chassis.ts`) scrubs half his speed off before the
// lip. Changing those for every map would move every digest; so on an
// aerials site, and only there, the kicker is ridden as what it is — a
// guided curve. The speed is the energy's: the climb, the snow's friction
// along the curve, and the share of his speed's square his legs give up
// for each radian the curve turns him (`AERIALS_RULE.skier.compression`) —
// the very loss the in-run was sized with (`lipSpeed`), so a skier tucked
// from the start gate leaves the lip at the kicker's design speed.
//
// At the lip he is let go along its tangent and the air is his own (and
// the flight's, `aerial-flight.ts`). Pure, and drawing nothing from any
// stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { fieldCoords } from "../mapgen/mogul-field.ts";
import { AERIALS_RULE } from "../mapgen/trick-rules.ts";
import { derive } from "./skier.ts";
import { TUNING } from "./defs/tuning.ts";
import type { GameState } from "./state.ts";

/** How far off the lip's snow he is let go, m — clear of it, so the
 * kicker's face behind the lip never catches a tail or a hip. */
const LIFT = 0.25;

/** The descent of the site's profile at `d` m along, rad (a climb
 * negative) — read BEHIND `d`, so at the lip it is the kicker's own angle
 * and never the back face's beyond it. */
function descent(yAt: (d: number) => number, d: number): number {
  const e = 0.05;
  return Math.atan2(yAt(d - e) - yAt(d), e);
}

/** ONE STEP ON THE KICKER: true while the skier is carried up it (the
 * snow's step is not his), false anywhere else. */
export function stepKicker(run: GameState): boolean {
  const site = run.level.aerials;
  const field = run.level.bumps;
  const c = run.skier;
  const f = run.aerial;
  if (f && c.airborne) f.wire = -1;
  if (!site || !field || !run.rules.aerials || c.thrown !== null || c.airborne) return false;
  const at = fieldCoords(field, c.x, c.z);
  // Where on the curve he is: carried, the wire's own place; met, the
  // snow under him.
  const along = f && f.wire >= 0 ? f.wire : at.along;
  const across = at.across;
  if (along < site.foot || along >= site.lip) return false;
  const fx = Math.sin(field.heading);
  const fz = Math.cos(field.heading);
  const dt = TUNING.dt;
  const g = TUNING.g;
  const S = AERIALS_RULE.skier;
  // THE SPEED ON THE WIRE: the climb, the friction and the legs' give.
  const v0 = Math.max(0.5, c.speed);
  const a0 = descent(site.yAt, along);
  let u = Math.min(site.lip, along + v0 * Math.cos(a0) * dt);
  const a1 = descent(site.yAt, u);
  const climb = site.yAt(u) - site.yAt(along);
  const ds = hypot(u - along, climb);
  let v2 = v0 * v0 - 2 * g * climb - 2 * S.friction * g * Math.cos(a0) * ds;
  if (a1 < a0) v2 *= Math.exp(-S.compression * (a0 - a1));
  const v = Math.sqrt(Math.max(0.25, v2));
  if (v2 <= 0.25) u = along;
  // THE SKIER ON IT: his CoG over the snow along its normal, his skis
  // along its line, his way up it.
  const a = descent(site.yAt, u);
  const sx = field.x + fx * u + fz * across;
  const sz = field.z + fz * u - fx * across;
  const sy = site.yAt(u);
  const h = c.spec.cogHeight;
  c.x = sx + fx * Math.sin(a) * h;
  c.z = sz + fz * Math.sin(a) * h;
  c.y = sy + Math.cos(a) * h;
  c.vx = fx * v * Math.cos(a);
  c.vz = fz * v * Math.cos(a);
  c.vy = -v * Math.sin(a);
  c.q = fromEuler(field.heading, -a, 0);
  c.wx = c.wy = c.wz = 0;
  c.edge = 0;
  c.skid = 0;
  c.sideSlip = 0;
  c.carve = 0;
  for (const contact of c.contacts) contact.touching = false;
  // LET GO AT THE LIP, clear of the snow: the air is his own.
  if (u >= site.lip) {
    c.x += fx * Math.sin(a) * LIFT;
    c.z += fz * Math.sin(a) * LIFT;
    c.y += Math.cos(a) * LIFT;
    c.airborne = true;
    c.airTime = 0;
    c.launchVy = c.vy;
  }
  derive(c, run.level);
  if (f) f.wire = u >= site.lip ? site.lip : u;
  return true;
}
