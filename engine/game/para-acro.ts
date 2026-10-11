// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR'S ACRO (`para.ts`, its numbers `PARA.acro`, the research in
// `docs/paramotor.md`) — the wing pitched round the pilot and what goes
// wrong past it, stated beside the flight so it reads as one thing:
//   * THE WING'S WAY is KEPT (`ParaState.way`): it noses into the air square
//     to its lines as ever, but a wing met by the air from behind does not
//     turn round to it — it is FLYING BACKWARDS, which a soft wing cannot
//     do, and it collapses whole.
//   * THE LEAN PITCHES IT (`pitchCouple`): forward, the front risers, the
//     wing driven ahead of him and down — a DIVE; back, the rears, the wing
//     held back as he swings out in front of it and up. A couple on the
//     wing and the pilot, equal and opposite, as strong as the air through
//     the wing is fast — so a dive feeds itself and, held, carries the wing
//     on down under him and up behind (the TUMBLE), while a swing-up at a
//     crawl comes to nothing.
//   * THE SWING counted (`countSwing`): the lines' turn about the pitch
//     axis, unwrapped, and a whole turn round him a `loop`.
//   * FALLING INTO THE WING (`fallenIn`): the lines slack with the wing
//     level with him or below, or the two fallen together — he drops into
//     his own canopy, the way a pilot does who swings up past the wing with
//     too little speed to keep the lines tight.
//   * TANGLED (`stepTangled`): the cloth and the lines round him, the motor
//     stopped, the bundle dragging and turning him over as he falls, until
//     the release press cuts it away or the snow stops him.
//   * HUNG ON THE LINES (`hangOnLines`): the pilot's body along his lines,
//     his front along the wing's way — upside down at the top of a tumble.
//
// Pure over the state and the clock: nothing here draws from the stream.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  fromEuler,
  integrate,
  multiply,
  normalize,
  type Quat,
} from "@niclaslindstedt/oss-game-framework/core/quat";
import { PARA } from "./defs/para.ts";
import { TUNING } from "./defs/tuning.ts";
import { derive } from "./skier.ts";
import { paraAirAt, type ParaAir } from "./para-air.ts";
import type { V3 } from "./canopy.ts";
import type { GameState, ParaState } from "./state.ts";

const dt = TUNING.dt;
const A = PARA.acro;
const TWO_PI = 2 * Math.PI;

/** THE WING'S WAY into `out`: the air through it (`ax, ay, az`, of which
 * `down` runs along the lines `u`) square to the lines when it meets the
 * wing from ahead — the canopy noses into it — else the way it last had,
 * turned onto the lines' plane. True when the air meets it from behind:
 * flying backwards. */
export function keptWay(
  ax: number,
  ay: number,
  az: number,
  down: number,
  u: V3,
  last: V3,
  out: V3,
): boolean {
  // The last way, turned square to the lines as they stand now.
  const along = last.x * u.x + last.y * u.y + last.z * u.z;
  let px = last.x - along * u.x;
  let py = last.y - along * u.y;
  let pz = last.z - along * u.z;
  const pl = hypot3(px, py, pz);
  if (pl > 1e-6) {
    px /= pl;
    py /= pl;
    pz /= pl;
  }
  let fwx = ax - down * u.x;
  let fwy = ay - down * u.y;
  let fwz = az - down * u.z;
  const fl = hypot3(fwx, fwy, fwz);
  if (fl > 0.5) {
    fwx /= fl;
    fwy /= fl;
    fwz /= fl;
    const meets = fwx * px + fwy * py + fwz * pz;
    if (pl <= 1e-6 || meets >= 0) {
      out.x = fwx;
      out.y = fwy;
      out.z = fwz;
      return false;
    }
    out.x = px;
    out.y = py;
    out.z = pz;
    return meets < A.backflown && fl > A.backSpeed;
  }
  out.x = px;
  out.y = py;
  out.z = pz;
  return false;
}

/** THE LEAN FORWARD ON THE RISERS as trim, rad, added to the wing's (nose
 * down negative) once he flies: the fronts pulled down and the wing pitched
 * over into a DIVE. */
export function riserRig(p: ParaState, bar: number): number {
  return p.flying && bar > 0 ? A.dive.rig * bar : 0;
}

/** THE LEAN BACK ON THE RISERS as lift, a share of the lift coefficient:
 * the rears pulled bend the trailing edge down and the wing's lift up as
 * hard as they bite (`biteRears`) — at speed a path bent up hard, the
 * wing flying round over him: a LOOP. */
export function riserLift(p: ParaState, bar: number): number {
  return p.flying && bar < 0 ? -bar * A.swing.lift * p.rears : 0;
}

/** THE REARS' BITE, kept in `p.rears`: leant back at a trim's speed they do
 * no more than the trimmers, but pulled with the speed of a dive behind
 * them they bend its path up hard (`riserLift`) — caught
 * at the most the speed he carries (`V`, m/s) has given them, and held
 * until he lets the lean go. */
export function biteRears(p: ParaState, bar: number, V: number): void {
  if (!p.flying || bar > -0.3) {
    p.rears = 0;
    return;
  }
  const bite = clamp((V - A.swing.from) / (A.swing.full - A.swing.from), 0, 1);
  p.rears = Math.max(p.rears, bite);
}

/** How far under its folding angle the pilot's hands on the risers hold
 * the leading edge, rad: pitched over on the fronts, or hauled round on
 * the rears as hard as they bite — he feels the wing and keeps it open. */
export function reflexOf(p: ParaState, bar: number): number {
  return bar > 0 ? A.dive.reflex * bar : -bar * A.swing.reflex * p.rears;
}

/** How far past its stall the rears hold a wing they haul round, rad. */
export function heldOf(p: ParaState, bar: number): number {
  return bar < 0 ? -bar * A.swing.held * p.rears : 0;
}

/** HOW HARD THE REARS HOLD THE WING'S PITCH, 0..1: leant back with them
 * biting, as strong as the speed he carries `V` m/s is past `swing.from` —
 * slowed at the top of a loop the hold lets go, and a wing left under him
 * there falls as it will. */
export function heldShare(p: ParaState, bar: number, V: number): number {
  if (!p.flying || bar >= 0 || p.rears <= 0) return 0;
  return -bar * clamp((V - A.swing.from) / (A.swing.full - A.swing.from), 0, 1);
}

/** THE WING HELD IN ITS PITCH on the rears: while they bite, the rigging
 * keeps the canopy over the pilot's path, on the inside of the curve its
 * lift bends — `swing.back` rad back off square to his way — as a spring
 * and a damper between the two (`swing.spring`, N/m, and `swing.damp`, N
 * per m/s, at a full bite), on the wing (`out`) and, opposite, on the pilot
 * of mass `M` now, `live` of it (`heldShare`). */
export function holdPitch(
  p: ParaState,
  c: { x: number; y: number; z: number; vx: number; vy: number; vz: number },
  live: number,
  cx: number,
  cy: number,
  cz: number,
  u: V3,
  M: number,
  out: V3,
): V3 {
  out.x = out.y = out.z = 0;
  const Vc = hypot3(cx, cy, cz);
  if (live <= 0 || Vc < 1) return out;
  const vx = cx / Vc;
  const vy = cy / Vc;
  const vz = cz / Vc;
  // Square to his way, on the side the wing stands.
  const along = u.x * vx + u.y * vy + u.z * vz;
  let nx = u.x - along * vx;
  let ny = u.y - along * vy;
  let nz = u.z - along * vz;
  const nl = hypot3(nx, ny, nz);
  if (nl < 1e-6) return out;
  nx /= nl;
  ny /= nl;
  nz /= nl;
  const cb = Math.cos(A.swing.back);
  const sb = Math.sin(A.swing.back);
  const L = PARA.wing.lines;
  const tx = c.x + (nx * cb - vx * sb) * L;
  const ty = c.y + (ny * cb - vy * sb) * L;
  const tz = c.z + (nz * cb - vz * sb) * L;
  // The spot's own speed, off where it stood last step (none the first).
  const h = p.hold;
  const fresh = Math.abs(h.at - (p.t - dt)) > dt / 2;
  const svx = fresh ? c.vx : (tx - h.x) / dt;
  const svy = fresh ? c.vy : (ty - h.y) / dt;
  const svz = fresh ? c.vz : (tz - h.z) / dt;
  h.x = tx;
  h.y = ty;
  h.z = tz;
  h.at = p.t;
  const k = A.swing.spring * live;
  const d = A.swing.damp * live;
  out.x = k * (tx - p.x) - d * (p.vx - svx);
  out.y = k * (ty - p.y) - d * (p.vy - svy);
  out.z = k * (tz - p.z) - d * (p.vz - svz);
  c.vx -= (out.x / M) * dt;
  c.vy -= (out.y / M) * dt;
  c.vz -= (out.z / M) * dt;
  return out;
}

/** THE SWING: the lines `u` pitched off plumb about the level pitch axis
 * (`u × way`, laid level — so the lines carried round a spiral, turning
 * about the plumb, count nothing), unwrapped into `p.swing` — true when
 * that made a whole turn round him. */
export function countSwing(p: ParaState, u: V3): boolean {
  const w = p.way;
  let rx = u.y * w.z - u.z * w.y;
  let rz = u.x * w.y - u.y * w.x;
  const rl = hypot(rx, rz);
  if (rl < 1e-6) return false;
  rx /= rl;
  rz /= rl;
  // Ahead, level: right × up.
  const at = Math.atan2(u.x * -rz + u.z * rx, u.y);
  let d = at - Math.atan2(Math.sin(p.swing), Math.cos(p.swing));
  d = Math.atan2(Math.sin(d), Math.cos(d));
  p.swing += d;
  const turns = Math.floor(Math.abs(p.swing) / TWO_PI);
  if (turns > p.loops) {
    p.loops = turns;
    return true;
  }
  return false;
}

/** WHETHER HE HAS FALLEN INTO THE WING this step: the lines' pull `tension`
 * on a pilot of mass `M` under `PARA.acro.slack` of his weight while the
 * wing stands level with him or below (`u.y`) — held for `slackFor` s — or
 * the two fallen within `close` of the lines of each other. Only out of a
 * swing he threw himself on the rears (`p.rears`): what rough air does to
 * the wing is its folds' (`PARA.fold`), and a gale's slack lines are not a
 * fall into it. */
export function fallenIn(p: ParaState, tension: number, M: number, u: V3, apart: number): boolean {
  const slack = p.rears > 0 && tension < A.slack * M * TUNING.g;
  if (slack && u.y < A.over) p.slack += dt;
  else p.slack = 0;
  return p.slack >= A.slackFor || (slack && apart < A.close * PARA.wing.lines);
}

/** How far past `PARA.acro.loaded` g the lines are pulled, a share of one
 * g more: a wing held full by the pull on it, not the air under it. */
export function loaded(p: ParaState): number {
  return p.g - A.loaded;
}

/** The pilot's load on the lines, g, eased after the pull this step. */
export function readLoad(p: ParaState, tension: number, M: number): void {
  const g = tension / (M * TUNING.g);
  p.g += (g - p.g) * (1 - Math.exp(-dt / A.gLag));
}

const air: ParaAir = { x: 0, y: 0, z: 0, mean: 0, lift: 0, rough: 0, lee: 0 };

/** TANGLED IN THE WING for one step, after the skier's own step has fallen
 * him: the bundle's drag on him against the air, the bundle turning him
 * over, the cloth streaming over him on the lines and the motor run down. */
export function stepTangled(state: GameState, p: ParaState, M: number): void {
  const c = state.skier;
  const level = state.level;
  paraAirAt(level, state.t, c.x, c.y, c.z, air);
  const ax = c.vx - air.x;
  const ay = c.vy - air.y;
  const az = c.vz - air.z;
  const V = hypot3(ax, ay, az);
  const k = (0.5 * TUNING.airDensity * A.tangle.drag * V) / M;
  c.vx -= ax * k * dt;
  c.vy -= ay * k * dt;
  c.vz -= az * k * dt;
  // Turned over by the cloth round him, while he is off the snow.
  if (c.airborne) {
    const [wx, wy, wz] = A.tangle.spin;
    c.q = integrate(c.q, wx, wy, wz, dt);
    c.wx = c.wy = c.wz = 0;
  }
  derive(c, level);
  // The cloth trailing up the air from him, a bundle on short lines.
  const trail = V > 0.5 ? 2.5 / V : 0;
  p.x = c.x - ax * trail;
  p.y = c.y - ay * trail + (V > 0.5 ? 0 : 1.5);
  p.z = c.z - az * trail;
  p.vx = c.vx;
  p.vy = c.vy;
  p.vz = c.vz;
  p.tension = 0;
  p.g += (0 - p.g) * (1 - Math.exp(-dt / A.gLag));
  p.airspeed = V;
  p.fold = 1;
  p.foldSide = 0;
  p.stalled = true;
}

/** HUNG ON HIS LINES, off the snow: the pilot's up along the lines `u` and
 * his front along the wing's `way` — upside down at the top of a tumble —
 * leant in the harness `lean` rad (tips up positive), eased there over
 * `swing` s — only `over` of the way from `plumb`, the pilot sat square
 * under his wing, so a swing grows into it. */
export function hangOnLines(
  state: GameState,
  u: V3,
  way: V3,
  lean: number,
  swing: number,
  over: number,
  plumb: Quat,
): void {
  const c = state.skier;
  // right = up × forward
  let rx = u.y * way.z - u.z * way.y;
  let ry = u.z * way.x - u.x * way.z;
  let rz = u.x * way.y - u.y * way.x;
  const rl = hypot3(rx, ry, rz);
  if (rl < 1e-6) return;
  rx /= rl;
  ry /= rl;
  rz /= rl;
  // forward = right × up, square to both
  const fx = ry * u.z - rz * u.y;
  const fy = rz * u.x - rx * u.z;
  const fz = rx * u.y - ry * u.x;
  const lines = multiply(fromBasis(rx, ry, rz, u.x, u.y, u.z, fx, fy, fz), fromEuler(0, lean, 0));
  const target = blend(plumb, lines, over);
  const k = clamp(1 - Math.exp(-dt / swing), 0, 1);
  c.q = blend(c.q, target, k);
  c.wx = c.wy = c.wz = 0;
  derive(c, state.level);
}

/** `a` turned `k` of the way to `b`, the short way round. */
function blend(a: Quat, b: Quat, k: number): Quat {
  const s = a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w < 0 ? -1 : 1;
  return normalize({
    x: a.x + (s * b.x - a.x) * k,
    y: a.y + (s * b.y - a.y) * k,
    z: a.z + (s * b.z - a.z) * k,
    w: a.w + (s * b.w - a.w) * k,
  });
}

/** The rotation taking the body's right, up and forward (x, y, z) onto the
 * world vectors given: the matrix of those columns as a quaternion. */
function fromBasis(
  m00: number,
  m10: number,
  m20: number,
  m01: number,
  m11: number,
  m21: number,
  m02: number,
  m12: number,
  m22: number,
): Quat {
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = 0.5 / Math.sqrt(tr + 1);
    return normalize({ w: 0.25 / s, x: (m21 - m12) * s, y: (m02 - m20) * s, z: (m10 - m01) * s });
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return normalize({ w: (m21 - m12) / s, x: 0.25 * s, y: (m01 + m10) / s, z: (m02 + m20) / s });
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return normalize({ w: (m02 - m20) / s, x: (m01 + m10) / s, y: 0.25 * s, z: (m12 + m21) / s });
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return normalize({ w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: 0.25 * s });
}
