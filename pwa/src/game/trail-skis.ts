// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE SKIS PRESS THE SNOW, AS DRAWN. The engine's stations hang both
// skis parallel down the body's line, a stance apart: that is all its grip
// and its legs need, and the line he glides on (`SkierState.glide`) and the
// skid's pivot (`skiAngle`) only turn the way each station grips, never
// where it stands. The skis are DRAWN turned, though: pivoted across by the
// skid about the pair's middle (`ski-stand.ts`), and skating opened into the
// V, the pushing ski driven out on its inside edge and lifted back in for
// the next stride (`skier-gait.ts`). A trail stamped off the engine's
// stations is then two straight lines under two skis splayed into a V.
//
// So the trail is stamped where the skis are drawn: each ski's stations
// laid along that ski's own line as the drawing turns it and set where the
// drawing puts its binding, and a ski lifted clear of the snow for the
// recovery lifts its pen. A skid's tip and tail lie across the way the
// skis do.
//
// A SKATING SKI DOES NOT SLIDE SIDEWAYS. Stood on its edge, a skate's ski
// runs along its own line: that is what a skater pushes against, and why
// his track is a row of clean straight strokes, each angled off the line he
// goes, the next ski's the other way. The drawing swings the feet across
// under him (the push out, the weight carried over), which a stamp taken
// where the ski is drawn smears into a band a stroke long. So while he
// skates (or strides) each ski's pen moves only along that ski's line, the
// drawing's sideways shift taken off as it comes (`SkiKeep`); a skating ski
// marks the snow from when his weight is carried onto it to the end of its
// own push, and a stroke the drawn ski has been swung `DRIFT_MOST` off ends
// there, so no mark is left far from the ski that made it. Presentation
// only: the engine's own contacts are copied, never written.

import { probesOf, skateDuty, type SkierState, type SnowContact } from "@engine";

import { gaitOf } from "./skier-gait.ts";

/** A ski lifted this far off the snow by the gait, m, leaves no mark —
 * the recovering ski of a skate or a stride, swung clear. */
export const LIFT_OFF = 0.01;

/** The share of him stepping his skis (`Gait.skate` and `.stride`) from
 * which each ski's stroke takes none of its sideways shift. */
const HELD_FROM = 0.25;

/** How much of him must be skating (`Gait.skate`) for his skis to mark
 * the snow by the stride's phase, and how far through the other leg's push
 * (a share of `skateDuty`) a gliding ski's mark begins: once the push has
 * carried him onto it. */
const SKATING = 0.5;
const SET_IN = 1;

/** How far a skating ski's stroke may run off the ski as drawn, m, before
 * it ends: the drawing swings the skis across under him further than an
 * edge can run, and a mark left that far off its ski reads as nobody's. */
export const DRIFT_MOST = 0.25;

/** A ski's pen whose stroke is done while the ski is still down. */
const SPENT = 2;

/** WHERE EACH SKI'S PEN IS, kept between steps for one skier (left, right):
 * the binding's place in the plan and whether it is down (1), up (0) or
 * done with its stroke while the ski is still down (`SPENT`). */
export type SkiKeep = { xs: Float64Array; zs: Float64Array; down: Uint8Array };

export function createKeep(): SkiKeep {
  return { xs: new Float64Array(2), zs: new Float64Array(2), down: new Uint8Array(2) };
}

/** The plan-view footprint of one skier's skis as drawn, into `out` (one
 * copy a contact, made once and reused — a scratch shared by every caller
 * when left out, read before the next call): the engine's `contacts` turned
 * and moved to where `ski-stand.ts` and the gait draw each ski, a skating
 * ski's sideways shift taken off along its stroke (`keep`, the skier's own;
 * none, and every ski stands where it is drawn). A board, or anything that
 * is not two skis of three stations, comes back as the engine's own. */
export function drawnContacts(
  skier: SkierState,
  keep?: SkiKeep,
  out: SnowContact[] = feet,
): readonly SnowContact[] {
  const contacts = skier.contacts;
  const probes = probesOf(skier.spec);
  if (contacts.length !== 6 || probes.length !== 6 || contacts.some((c) => c.side === 0)) {
    return contacts;
  }
  while (out.length < contacts.length) out.push({ ...contacts[out.length] });
  out.length = contacts.length;
  const gait = gaitOf(skier);
  // Each ski's line in the plan, per metre of ski (tip less tail over their
  // stations' spread — the slope's foreshortening kept), and its binding.
  let mx = 0;
  let mz = 0;
  let fx = 0;
  let fz = 0;
  for (let k = 0; k < 2; k++) {
    const { tip, tail } = stations(probes, k);
    const span = probes[tip].bz - probes[tail].bz || 1;
    const dx = (contacts[tip].x - contacts[tail].x) / span;
    const dz = (contacts[tip].z - contacts[tail].z) / span;
    line[k * 2] = dx;
    line[k * 2 + 1] = dz;
    bind[k * 2] = contacts[tip].x - dx * probes[tip].bz;
    bind[k * 2 + 1] = contacts[tip].z - dz * probes[tip].bz;
    mx += bind[k * 2] / 2;
    mz += bind[k * 2 + 1] / 2;
    fx += dx;
    fz += dz;
  }
  const fl = Math.hypot(fx, fz);
  if (fl < 1e-6) return contacts;
  fx /= fl;
  fz /= fl;
  // His right in the plan: the forward turned a quarter clockwise.
  const rx = fz;
  const rz = -fx;
  const angle = skier.skiAngle;
  // Whether he is stepping his skis at all — a V half poled through is
  // still a V, each ski on its edge — the share of each ski's sideways
  // shift its stroke does not take.
  const held = Math.min(1, (gait.skate + gait.stride) / HELD_FROM);
  // The share of a stride the leg pushes (`skateDuty`).
  const legDuty = skateDuty(skier.speed, skier.hill);
  for (let k = 0; k < 2; k++) {
    // The binding: the stance turned with the skid's pivot about the
    // pair's middle, then pushed out and slid along as the gait has it.
    const [bx, bz] = turn(bind[k * 2] - mx, bind[k * 2 + 1] - mz, angle);
    let px = mx + bx + rx * gait.out[k] + fx * gait.fore[k];
    let pz = mz + bz + rz * gait.out[k] + fz * gait.fore[k];
    // The ski's own line: the pivot and the V's arm.
    const [lx, lz] = turn(line[k * 2], line[k * 2 + 1], angle + gait.splay[k]);
    const lifted = gait.lift[k] > LIFT_OFF;
    const side = k === 0 ? -1 : 1;
    let touching = !lifted && contacts.some((c) => c.side === side && c.touching);
    // A skating ski marks the snow from when he is carried across onto it
    // — set down light, the weight still on the pushing ski behind it — to
    // the end of its own push; swung back in, it is the air's.
    if (gait.skate > SKATING) {
      const pushing = gait.push === k;
      if (pushing ? gait.phase > legDuty : gait.phase < SET_IN * legDuty) touching = false;
    }
    if (keep) {
      if (!touching) keep.down[k] = 0;
      else if (keep.down[k] === SPENT) touching = false;
      else if (keep.down[k] && held > 0) {
        // THE STROKE: the pen moves from where it was along the ski's line,
        // and across it only by the share of him that is not stepping —
        // and once the ski as drawn has been swung further off it than
        // `DRIFT_MOST`, the stroke is done until the ski is set down again.
        const ll = Math.hypot(lx, lz) || 1;
        const ux = lx / ll;
        const uz = lz / ll;
        const dx = px - keep.xs[k];
        const dz = pz - keep.zs[k];
        const along = dx * ux + dz * uz;
        const sx = keep.xs[k] + ux * along + (dx - ux * along) * (1 - held);
        const sz = keep.zs[k] + uz * along + (dz - uz * along) * (1 - held);
        if (Math.hypot(sx - px, sz - pz) < DRIFT_MOST) {
          px = sx;
          pz = sz;
        } else {
          keep.down[k] = SPENT;
          touching = false;
        }
      }
      if (touching) {
        keep.xs[k] = px;
        keep.zs[k] = pz;
        keep.down[k] = 1;
      }
    }
    for (let i = 0; i < 6; i++) {
      const c = contacts[i];
      if (c.side !== side) continue;
      const o = out[i];
      Object.assign(o, c);
      o.x = px + lx * probes[i].bz;
      o.z = pz + lz * probes[i].bz;
      o.touching = c.touching && touching;
    }
  }
  return out;
}

/** The shared scratch `drawnContacts` writes into. */
const feet: SnowContact[] = [];

/** Scratch: each ski's line (x, z per metre of ski) and its binding. */
const line = new Float64Array(4);
const bind = new Float64Array(4);

/** The tip's and the tail's index among ski `k`'s stations (0 left). */
function stations(
  probes: readonly { station: string; side: number }[],
  k: number,
): { tip: number; tail: number } {
  const side = k === 0 ? -1 : 1;
  let tip = 0;
  let tail = 0;
  for (let i = 0; i < probes.length; i++) {
    if (probes[i].side !== side) continue;
    if (probes[i].station === "tip") tip = i;
    else if (probes[i].station === "tail") tail = i;
  }
  return { tip, tail };
}

/** (x, z) turned `a` rad clockwise from above (heading's sense). */
function turn(x: number, z: number, a: number): [number, number] {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c + z * s, -x * s + z * c];
}
