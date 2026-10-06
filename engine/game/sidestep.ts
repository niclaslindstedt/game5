// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SIDESTEP — how a skier climbs a slope too steep to walk up. Stood
// still across it, his skis square to the fall line, with the steer held
// TOWARD THE HILL, he steps up it sideways a ski at a time: the uphill ski
// lifted, carried a step up the hill and set down hard on its uphill edge —
// STAMPED, the snow pressed into a ledge under it — his weight moved onto
// it, then the downhill ski lifted and set down beside it on a ledge of its
// own. A staircase up the face, each stair cut as he stands on it
// (`TUNING.sidestep`, its numbers and their sources in `defs/sidestep.ts`).
//
// IT IS THE STEP TURN ON THE SPOT turned sideways (`poles.ts`'s
// `stepRound`): kinematic, a pair at a time, a pair begun always finished
// and set down together, the stride's phase where in the pair he is. His
// body, which stands between his skis, is carried up the snow half a step
// with each ski; each ski stands where it was set (`skiOffsets`, which
// `skier.ts` lays the snow's contacts by, so the trail map takes a LADDER
// of platforms and never a smear) and the one in the air touches nothing.
//
// HE STANDS ON HIS PLATFORMS (`SkierState.sidestep`): stood across a slope
// between `from` and `none`, his skis are set into the hill on their uphill
// edges (`sidestepEdge`) and the ledges he has cut hold him however steep
// it is (`skier.ts`'s standstill hold), whether or not he is stepping — a
// skier who stops half way up a 45° face is not slid back down it. He
// leaves them by going anywhere: the tuck sends him off across the slope,
// the brake or a steer away from the hill steps him round to face down it.
//
// THE STEEPER THE SHORTER: past `steep` each step is shorter and slower,
// to `least` of it by `most`; past `none` the snow sluffs rather than lies
// and there is no platform to cut — he does not try. In loose snow each
// stamp packs down before it carries him (`powder`).

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import type { Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { rotate } from "@niclaslindstedt/oss-game-framework/core/quat";
import type { Level } from "../mapgen/types.ts";
import { TUNING } from "./defs/tuning.ts";
import type { SkierState } from "./state.ts";

const D = TUNING.sidestep;
/** The steer, of full, that asks for a step — the same as asks for a step
 * round on the spot (`poles.ts`). */
const SIDE_STEER = 0.3;

/** How much of a whole step the slope `slope` rad leaves, 0..1: whole to
 * `steep`, `least` of it by `most`, none by `none`. */
export function sidestepReach(slope: number): number {
  if (slope <= D.steep) return 1;
  if (slope <= D.most) return 1 - ((1 - D.least) * (slope - D.steep)) / (D.most - D.steep);
  return D.least * clamp(1 - (slope - D.most) / (D.none - D.most), 0, 1);
}

/** HOW FAR UP EACH SKI HAS BEEN STEPPED over a pair, at its phase `u`
 * 0..1, as shares of the step: the UPHILL ski lifted, carried up and set
 * down over the first part, the DOWNHILL ski brought up beside it over the
 * second, each eased at both ends — and the body, between them, half of
 * each. */
export function sideSteps(u: number): { uphill: number; downhill: number; body: number } {
  const ease = (a: number, b: number): number => {
    const k = clamp((u - a) / (b - a), 0, 1);
    return k * k * (3 - 2 * k);
  };
  const uphill = ease(0.04, 0.44);
  const downhill = ease(0.54, 0.94);
  return { uphill, downhill, body: (uphill + downhill) / 2 };
}

/** The slope under him, rad, off the snow's normal `n`. */
export function slopeOf(n: Vec3): number {
  return Math.acos(clamp(n.y, -1, 1));
}

/** Which side of him the hill rises on, ±1 (right positive), when he
 * stands across the slope under normal `n` — his skis within
 * `sidestep.across` of square to the fall line — and 0 when he does not. */
export function hillSide(c: SkierState, n: Vec3): number {
  const fall = hypot(n.x, n.z);
  if (fall < 1e-6) return 0;
  const right = rotate(c.q, { x: 1, y: 0, z: 0 });
  const rl = hypot(right.x, right.z) || 1;
  // The fall line goes along the normal's own lean: the hill rises against it.
  const up = -(right.x * n.x + right.z * n.z) / (fall * rl);
  return Math.abs(up) >= Math.cos(D.across) ? Math.sign(up) : 0;
}

/** The step's length, m, and the pairs a second, on a slope of `slope`
 * rad over snow `packed` 0..1: the steep's slowing (`sidestepReach`) shared
 * between the two by `pace`, and loose snow packing under each stamp. */
export function sidestepPace(slope: number, packed: number): { step: number; rate: number } {
  const reach = sidestepReach(slope);
  const snow = packed + (1 - packed) * D.powder;
  return {
    step: D.step * snow * reach ** (1 - D.pace),
    rate: D.steps * reach ** D.pace,
  };
}

/** THE SIDESTEP, this step: `still` is `poles.ts`'s `stoodStill` (and no
 * step round on the spot under way). Sets `c.sidestep` — the side the hill
 * rises on while he stands on his platforms, 0 off them — and steps him a
 * pair at a time up the snow while the steer asks toward the hill: the
 * stride's phase where in the pair he is. Returns whether he stands on his
 * platforms, which a step round on the spot then leaves alone. */
export function stepSide(
  c: SkierState,
  level: Level,
  n: Vec3,
  still: boolean,
  dt: number,
): boolean {
  const mid = c.sidestep !== 0 && c.stride - Math.floor(c.stride) > 1e-6;
  const slope = slopeOf(n);
  const side = still && slope >= D.from && slope < D.none ? hillSide(c, n) : 0;
  // A pair half taken is finished the way it was begun, unless he has
  // been put off his skis or into the air.
  const on = mid ? still || (!c.airborne && c.thrown === null && c.drive === 0) : side !== 0;
  if (!on) {
    if (mid) c.stride = Math.round(c.stride);
    c.sidestep = 0;
    return false;
  }
  if (!mid) {
    c.sidestep = side;
    // Asked away from the hill, he steps round to face down it instead.
    if (c.steer * side < -SIDE_STEER) {
      c.sidestep = 0;
      return false;
    }
    if (c.steer * side <= SIDE_STEER) return true;
    c.stride = Math.ceil(c.stride - 1e-6);
  }
  const fall = hypot(n.x, n.z);
  if (fall < 1e-6) return true;
  const pace = sidestepPace(slope, c.packed);
  const u0 = c.stride - Math.floor(c.stride);
  const end = Math.floor(c.stride) + 1;
  c.stride = Math.min(c.stride + pace.rate * dt, end);
  const u1 = c.stride >= end ? 1 : c.stride - Math.floor(c.stride);
  // Up the snow, square across the fall line: against the normal's lean,
  // along the slope, so the step is `step` m of snow whatever its pitch.
  const along = (pace.step * (sideSteps(u1).body - sideSteps(u0).body)) / fall;
  const dx = -n.x * n.y * along;
  const dz = -n.z * n.y * along;
  const y0 = level.groundAt(c.x, c.z);
  c.x += dx;
  c.z += dz;
  c.y += level.groundAt(c.x, c.z) - y0;
  return true;
}

/** Where each ski stands off his body while he sidesteps, m up the snow —
 * [left, right] — and whether it is in the air: the uphill ski stepped up
 * ahead of the body and the downhill one left behind it, together at the
 * end of a pair (`sideSteps`). Both 0 and down off his platforms. */
export function skiOffsets(
  c: SkierState,
  slope: number,
): {
  off: [number, number];
  lifted: [boolean, boolean];
} {
  if (c.sidestep === 0) return { off: [0, 0], lifted: [false, false] };
  const u = c.stride - Math.floor(c.stride);
  const s = sideSteps(u);
  const step = sidestepPace(slope, c.packed).step;
  const hill = c.sidestep > 0 ? 1 : 0;
  const off: [number, number] = [0, 0];
  const lifted: [boolean, boolean] = [false, false];
  off[hill] = step * (s.uphill - s.body);
  off[1 - hill] = step * (s.downhill - s.body);
  lifted[hill] = s.uphill > 0 && s.uphill < 1;
  lifted[1 - hill] = s.downhill > 0 && s.downhill < 1;
  return { off, lifted };
}

/** His speed OVER the snow under normal `n`, m/s: his legs settling along
 * its normal move him nowhere, and do not take him off his platforms. */
export function slideOver(c: SkierState, n: Vec3): number {
  const vn = c.vx * n.x + c.vy * n.y + c.vz * n.z;
  return hypot3(c.vx - vn * n.x, c.vy - vn * n.y, c.vz - vn * n.z);
}

/** The edge his skis are SET on while he stands on his platforms, rad
 * (right edges down positive): into the hill by `set` of the slope, never
 * past `edge` — and 0 off them. */
export function sidestepEdge(c: SkierState, n: Vec3): number {
  if (c.sidestep === 0) return 0;
  return c.sidestep * Math.min(D.edge, D.set * slopeOf(n));
}

/** ON HIS PLATFORMS, THE SNOW'S CONTACTS LAID WHERE EACH SKI STANDS: each
 * ski's stations moved up or down the snow by its offset (`skiOffsets`),
 * the one in the air touching nothing — so the trail map takes the ledge
 * each stamp cut, one above the other, and nothing between them. The
 * physics stood on the body's own stations; this is what the snow is left
 * with. */
const lay = { x: 0, y: 1, z: 0 };
export function laySkis(c: SkierState, level: Level): void {
  if (c.sidestep === 0) return;
  const n = lay;
  level.normalAt(c.x, c.z, n);
  const fall = hypot(n.x, n.z);
  if (fall < 1e-6) return;
  const { off, lifted } = skiOffsets(c, slopeOf(n));
  for (const contact of c.contacts) {
    if (contact.kind !== "ski") continue;
    const ski = contact.side > 0 ? 1 : 0;
    const along = (off[ski] * n.y) / fall;
    contact.x -= n.x * along;
    contact.z -= n.z * along;
    contact.y = level.groundAt(contact.x, contact.z);
    if (lifted[ski]) contact.touching = false;
  }
}
