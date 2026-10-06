// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIS LET GO — the yard sale. Once the skier is thrown (`crash.ts`)
// his two skis are no longer a pair standing on legs: each binding lets go
// on its own and each ski is a body of its own (`LoneSki`), a stick the
// length of the ski whose tip and tail meet the snow and the trunks on
// their own, turned about its length by its `up`.
//
// THEY COME APART. The ski on the side he goes down on is held in its
// binding a moment longer (`crash.skis.hold`), going wherever his foot
// goes, while the other is let go at once; and each leaves with a wrench of
// its own — turned, popped up, spun about its length and thrown away from
// the other — sized off a hash of the moment, never the run's stream, so a
// crash replays ski for ski and the two never fly alike.
//
// THEY SLIDE, THEY DO NOT BOUNCE. A ski is light and long and lands flat:
// the way into the snow is taken whole and nothing of it handed back
// (`pushOut` is the most a ski put back on the surface comes out of it
// with). On the snow it flops flat onto its base — unless it came down
// well over on its back, since the binding stands proud of the topsheet
// and a ski propped on it rolls back over (`settle`, `right`) — and
// slides: the base on wax along its length, the
// brake's arms dragging at the tail end once the boot is out, the steel
// edge holding it across. So a ski base down turns tip first down the fall
// line and slides away on anything steeper than a gentle pitch, and one on
// its topsheet grinds to a stop. A ski is built to rise: it never sinks —
// not into powder, not into a crest under its middle — and in powder it
// only ploughs, across far more than along.

import { clamp, hypot, hypot3 } from "@niclaslindstedt/oss-game-framework/core/math";
import { hash2 } from "@niclaslindstedt/oss-game-framework/core/noise";
import { fromEuler, rotate, type Vec3 } from "@niclaslindstedt/oss-game-framework/core/quat";
import { TUNING } from "./defs/tuning.ts";
import { solidsNear, solidsOf } from "./posts.ts";
import { RAGDOLL } from "./ragdoll.ts";
import { depthUnder, packedUnder } from "./snow.ts";
import type { GameState, LoneSki, SkierState, Thrown } from "./state.ts";

const S = TUNING.crash.skis;
const dt = TUNING.dt;
/** The hash's own salt: no other draw reads this stream. */
const SALT = 0x5c1a;
/** How many times a step puts the ski back on the snow and its length. */
const SNOW_PASSES = 3;
/** A trunk's reach is grown by this much for a ski's end, m. */
const END = 0.04;

/** The two skis as they are let go off `c`, the pair under the skier
 * thrown: each stood where the pair stood it and moving as that point of
 * the pair moved, then wrenched apart. `fall` is the side he goes down on
 * (−1 left, 1 right) and `speed` how fast he was going, m/s. */
export function letGo(state: GameState, c: SkierState, fall: number, speed: number): LoneSki[] {
  const spec = c.spec;
  const f = rotate(c.q, { x: 0, y: 0, z: 1 });
  const u = rotate(c.q, { x: 0, y: 1, z: 0 });
  const w = rotate(c.q, { x: c.wx, y: c.wy, z: c.wz });
  const hard = clamp(speed / S.kickSpeed, 0, 1);
  const n: Vec3 = { x: 0, y: 1, z: 0 };
  state.level.normalAt(c.x, c.z, n);
  return [-1, 1].map((side, i) => {
    const at = rotate(c.q, { x: (side * spec.stance) / 2, y: -spec.cogHeight, z: 0 });
    const ax = c.x + at.x;
    const ay = c.y + at.y;
    const az = c.z + at.z;
    const fore = (1 - spec.mount) * spec.length;
    const aft = spec.mount * spec.length;
    const ends = [
      ax + f.x * fore,
      ay + f.y * fore,
      az + f.z * fore,
      ax - f.x * aft,
      ay - f.y * aft,
      az - f.z * aft,
    ];
    // Each one's own share of the wrench, off the moment and the side.
    const draw = (k: number, least: number): number =>
      least + (1 - least) * hash2(state.tick, 4 * i + k, (state.seed ^ SALT) | 0);
    const under = side === fall;
    const sign = draw(0, 0) < 0.5 ? -1 : 1;
    const yaw = sign * S.yaw * draw(1, S.yawMin) * hard;
    const pop = (under ? 0 : S.pop * draw(2, S.popMin)) * hard;
    const spread = side * S.spread * hard;
    // The way across the pair, square to the snow's up.
    const ax2 = { x: f.z * n.y - f.y * n.z, y: f.x * n.z - f.z * n.x, z: f.y * n.x - f.x * n.y };
    const al = hypot3(ax2.x, ax2.y, ax2.z) || 1;
    const rx = -ax2.x / al;
    const ry = -ax2.y / al;
    const rz = -ax2.z / al;
    const last = new Array<number>(6);
    const kick = new Array<number>(6);
    for (let e = 0; e < 2; e++) {
      const j = 3 * e;
      const dx = ends[j] - c.x;
      const dy = ends[j + 1] - c.y;
      const dz = ends[j + 2] - c.z;
      // The pair's own way at that point, v + w × r.
      const vx = c.vx + w.y * dz - w.z * dy;
      const vy = c.vy + w.z * dx - w.x * dz;
      const vz = c.vz + w.x * dy - w.y * dx;
      // ...and the wrench, m a step: the turn about the snow's up swings
      // the tip one way across and the tail the other. The free ski leaves
      // with it now; the held one when its binding lets go.
      const arm = e === 0 ? fore : -aft;
      kick[j] = (rx * (yaw * arm + spread) + n.x * pop) * dt;
      kick[j + 1] = (ry * (yaw * arm + spread) + n.y * pop) * dt;
      kick[j + 2] = (rz * (yaw * arm + spread) + n.z * pop) * dt;
      for (let a = 0; a < 3; a++) {
        last[j + a] = ends[j + a] - (a === 0 ? vx : a === 1 ? vy : vz) * dt;
        if (!under) last[j + a] -= kick[j + a];
      }
    }
    return {
      side,
      held: under ? S.hold * Math.max(0.4, hard) : 0,
      mount: spec.mount,
      ends,
      last,
      kick: under ? kick : [0, 0, 0, 0, 0, 0],
      up: [u.x, u.y, u.z],
      spin: -sign * S.spin * draw(3, S.spinMin) * hard,
      touching: 0,
      hooked: 0,
      hook: [0, 0, 0, 0, 0, 0],
      tried: 0,
    };
  });
}

const n: Vec3 = { x: 0, y: 1, z: 0 };
const near: number[] = [];
const floor = [0, 0];
const soft = [0, 0];
const packed = [0, 0];
const arrive = [0, 0];

/** One step of both skis, after the body's own (`stepThrown`): a ski still
 * held goes where his foot went this step. */
export function stepLoneSkis(state: GameState, b: Thrown): void {
  for (const ski of b.skis) stepSki(state, b, ski);
}

/** THE SKIS LYING WHERE THE FALL LEFT THEM while he walks to fetch them
 * (`buzz.ts`): each one not yet `carried` slides on, its binding long let
 * go. */
export function slideSkis(
  state: GameState,
  skis: readonly LoneSki[],
  carried: readonly boolean[],
): void {
  for (let i = 0; i < skis.length; i++) if (!carried[i]) stepSki(state, null, skis[i]);
}

function stepSki(state: GameState, b: Thrown | null, ski: LoneSki): void {
  const level = state.level;
  const P = ski.ends;
  const L = ski.last;
  const length = hypot3(P[0] - P[3], P[1] - P[4], P[2] - P[5]);
  if (ski.held > 0 && b) {
    // STILL IN ITS BINDING: carried by his foot's own move this step.
    ski.held = Math.max(0, ski.held - dt);
    const k = 3 * (ski.side < 0 ? RAGDOLL.footL : RAGDOLL.footR);
    const dx = b.points[k] - b.last[k];
    const dy = b.points[k + 1] - b.last[k + 1];
    const dz = b.points[k + 2] - b.last[k + 2];
    // Let go, it leaves with his foot's way — no more than `fling` off
    // his body's own: a leg whipped round is not a catapult.
    let ex = 0;
    let ey = 0;
    let ez = 0;
    if (ski.held === 0) {
      const rx = dx / dt - b.vx;
      const ry = dy / dt - b.vy;
      const rz = dz / dt - b.vz;
      const r = hypot3(rx, ry, rz);
      const k = r > S.fling ? 1 - S.fling / r : 0;
      ex = rx * k * dt;
      ey = ry * k * dt;
      ez = rz * k * dt;
    }
    for (let j = 0; j < 6; j += 3) {
      P[j] += dx;
      P[j + 1] += dy;
      P[j + 2] += dz;
      L[j] = P[j] - dx + ex;
      L[j + 1] = P[j + 1] - dy + ey;
      L[j + 2] = P[j + 2] - dz + ez;
      if (ski.held === 0) {
        L[j] -= ski.kick[j];
        L[j + 1] -= ski.kick[j + 1];
        L[j + 2] -= ski.kick[j + 2];
      }
    }
  } else {
    const g = TUNING.g * dt * dt;
    for (let j = 0; j < 6; j++) {
      const v = P[j] - L[j];
      L[j] = P[j];
      P[j] += v;
    }
    P[1] -= g;
    P[4] -= g;
  }
  // An end HOOKED in a net's mesh (`nets.ts`) stays where it caught, and
  // the ski hangs off it.
  pin(ski);
  // The stick held at its length, both ends alike — or all of it on the
  // free end, the other hooked.
  holdLength(P, length, ski.hooked);
  const depth = depthUnder(state.snowDepth, state.fresh);
  for (let e = 0; e < 2; e++) {
    const j = 3 * e;
    const p = packedUnder(level.packedAt(P[j], P[j + 2]), state.fresh);
    packed[e] = p;
    soft[e] = (1 - p) * depth;
    floor[e] = level.groundAt(P[j], P[j + 2]);
    level.normalAt(P[j], P[j + 2], n);
    arrive[e] = Math.max(
      0,
      -((P[j] - L[j]) * n.x + (P[j + 1] - L[j + 1]) * n.y + (P[j + 2] - L[j + 2]) * n.z) / dt,
    );
  }
  // The trunks and the map's edge, then the snow: no end inside a trunk,
  // none under the surface.
  solidsNear(level, (P[0] + P[3]) / 2, (P[2] + P[5]) / 2, length, near);
  const solids = solidsOf(level);
  const lo = TUNING.bounds.margin;
  const hi = level.size - TUNING.bounds.margin;
  let touching = 0;
  for (let e = 0; e < 2; e++) {
    const j = 3 * e;
    if (ski.hooked & (1 << e)) continue;
    P[j] = clamp(P[j], lo, hi);
    P[j + 2] = clamp(P[j + 2], lo, hi);
    for (const t of near) {
      const tree = solids[t];
      if (P[j + 1] > tree.y + tree.height) continue;
      const dx = P[j] - tree.x;
      const dz = P[j + 2] - tree.z;
      const d = hypot(dx, dz) || 1e-6;
      const reach = tree.radius + END;
      if (d >= reach) continue;
      // Out of the bark and the way into it gone: a ski knocks off a trunk
      // and drops, it does not spring back.
      const ux = dx / d;
      const uz = dz / d;
      P[j] = tree.x + ux * reach;
      P[j + 2] = tree.z + uz * reach;
      const into = (P[j] - L[j]) * ux + (P[j + 2] - L[j + 2]) * uz;
      if (into < 0) {
        L[j] += into * ux;
        L[j + 2] += into * uz;
      }
    }
  }
  // The snow last, a few passes over the length held: no end under it, and
  // none of the ski between them either — on a crest the snow comes up
  // between the two ends, and the ski rides up over it rather than
  // through it. The last pass leaves it on the snow, not in it.
  const m = ski.mount;
  for (let k = 0; k < SNOW_PASSES; k++) {
    if (k > 0) holdLength(P, length, ski.hooked);
    for (let e = 0; e < 2; e++) {
      const j = 3 * e;
      if (ski.hooked & (1 << e)) continue;
      if (P[j + 1] < floor[e]) {
        P[j + 1] = floor[e];
        touching |= 1 << e;
      }
    }
    const mx = P[3] + (P[0] - P[3]) * m;
    const mz = P[5] + (P[2] - P[5]) * m;
    const under = level.groundAt(mx, mz) - (P[4] + (P[1] - P[4]) * m);
    if (under > 0 && !ski.hooked) {
      P[1] += under;
      P[4] += under;
      touching = 3;
    }
  }
  // The tail-to-tip, for the friction along it and the turn about it.
  const fx0 = P[0] - P[3];
  const fy0 = P[1] - P[4];
  const fz0 = P[2] - P[5];
  const fl = hypot3(fx0, fy0, fz0) || 1;
  const fx = fx0 / fl;
  const fy = fy0 / fl;
  const fz = fz0 / fl;
  let face = 0;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let e = 0; e < 2; e++) {
    if (!(touching & (1 << e))) continue;
    const j = 3 * e;
    level.normalAt(P[j], P[j + 2], n);
    nx += n.x;
    ny += n.y;
    nz += n.z;
    let vx = (P[j] - L[j]) / dt;
    let vy = (P[j + 1] - L[j + 1]) / dt;
    let vz = (P[j + 2] - L[j + 2]) / dt;
    // NO BOUNCE: the way into the snow gone, the way out of it no faster
    // than `pushOut` — the end put back on the surface is a position
    // corrected, never a launch.
    const un = vx * n.x + vy * n.y + vz * n.z;
    const out = clamp(un, 0, S.pushOut) - un;
    vx += out * n.x;
    vy += out * n.y;
    vz += out * n.z;
    // Along the ski and across it, in the snow's plane.
    const fn = fx * n.x + fy * n.y + fz * n.z;
    let ax = fx - fn * n.x;
    let ay = fy - fn * n.y;
    let az = fz - fn * n.z;
    const al = hypot3(ax, ay, az);
    if (al < 1e-6) {
      // Stood on its end: everything across.
      ax = 0;
      ay = 0;
      az = 0;
    } else {
      ax /= al;
      ay /= al;
      az /= al;
    }
    const along = vx * ax + vy * ay + vz * az;
    const vn = vx * n.x + vy * n.y + vz * n.z;
    const cx = vx - along * ax - vn * n.x;
    const cy = vy - along * ay - vn * n.y;
    const cz = vz - along * az - vn * n.z;
    const across = hypot3(cx, cy, cz);
    // Which face it lies on: the base unless it has come down well over
    // onto its back — the binding stands proud of the topsheet, and a ski
    // propped on it rolls back onto its base (`crash.skis.right`).
    const down = ski.up[0] * n.x + ski.up[1] * n.y + ski.up[2] * n.z >= -S.right;
    face += down ? 1 : -1;
    const load = Math.max(TUNING.g * n.y * dt, arrive[e]);
    // The brake's arms drop in at the tail end, base down, and hold it
    // every way.
    const brake = down && e === 1 ? S.brake : 0;
    const muAlong = down ? S.base + brake : S.top;
    const plough = Math.min(1, S.plough * soft[e] * dt);
    const keepAlong = 1 - Math.min(1, (muAlong * load) / Math.max(Math.abs(along), 1e-9));
    const keepAcross = 1 - Math.min(1, ((S.edge + brake) * load) / Math.max(across, 1e-9));
    const a = along * Math.max(0, keepAlong) * (1 - plough / 4);
    const s = Math.max(0, keepAcross) * (1 - plough);
    vx = a * ax + cx * s + vn * n.x;
    vy = a * ay + cy * s + vn * n.y;
    vz = a * az + cz * s + vn * n.z;
    L[j] = P[j] - vx * dt;
    L[j + 1] = P[j + 1] - vy * dt;
    L[j + 2] = P[j + 2] - vz * dt;
  }
  ski.touching = touching;
  pin(ski);
  // ITS TURN ABOUT ITS LENGTH: carried in the air, and on the snow laid
  // flat onto the face it lies on.
  const up = ski.up;
  if (touching && ski.held === 0) {
    const nl = hypot3(nx, ny, nz) || 1;
    const s = face >= 0 ? 1 : -1;
    // The face's normal square to the ski: where its up is laid to.
    const tn = (nx * fx + ny * fy + nz * fz) / nl;
    const tx = s * (nx / nl - tn * fx);
    const ty = s * (ny / nl - tn * fy);
    const tz = s * (nz / nl - tn * fz);
    // The signed angle from its up to there, about the tip — none to lay
    // it to while it stands on its end.
    const cxv = up[1] * tz - up[2] * ty;
    const cyv = up[2] * tx - up[0] * tz;
    const czv = up[0] * ty - up[1] * tx;
    const sin = cxv * fx + cyv * fy + czv * fz;
    const cos = up[0] * tx + up[1] * ty + up[2] * tz;
    ski.spin = hypot3(tx, ty, tz) > 0.2 ? Math.atan2(sin, cos) * S.settle : 0;
  } else if (!touching) {
    ski.spin *= 1 - Math.min(1, S.spinFade * dt);
  }
  turnAbout(up, fx, fy, fz, ski.spin * dt);
}

/** Hold the two ends `length` apart, moving each half the error — or the
 * whole of it on the one end not `pinned` (bits as `LoneSki.hooked`), and
 * none with both. */
function holdLength(P: number[], length: number, pinned = 0): void {
  if (pinned === 3) return;
  const dx = P[0] - P[3];
  const dy = P[1] - P[4];
  const dz = P[2] - P[5];
  const d = hypot3(dx, dy, dz) || 1e-9;
  const k = (d - length) / (2 * d);
  const tip = pinned === 1 ? 0 : pinned === 2 ? 2 : 1;
  const tail = 2 - tip;
  P[0] -= dx * k * tip;
  P[1] -= dy * k * tip;
  P[2] -= dz * k * tip;
  P[3] += dx * k * tail;
  P[4] += dy * k * tail;
  P[5] += dz * k * tail;
}

/** Every hooked end of `ski` put back where it caught, and still. */
function pin(ski: LoneSki): void {
  for (let e = 0; e < 2; e++) {
    if (!(ski.hooked & (1 << e))) continue;
    for (let a = 3 * e; a < 3 * e + 3; a++) {
      ski.ends[a] = ski.hook[a];
      ski.last[a] = ski.hook[a];
    }
  }
}

/** Turn `up` by `angle` rad about the unit (`fx`, `fy`, `fz`), then square
 * it to that axis again and keep it unit — the ski's length moves under it
 * every step. */
function turnAbout(up: number[], fx: number, fy: number, fz: number, angle: number): void {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const d = up[0] * fx + up[1] * fy + up[2] * fz;
  let x = up[0] * cos + (fy * up[2] - fz * up[1]) * sin + fx * d * (1 - cos);
  let y = up[1] * cos + (fz * up[0] - fx * up[2]) * sin + fy * d * (1 - cos);
  let z = up[2] * cos + (fx * up[1] - fy * up[0]) * sin + fz * d * (1 - cos);
  const along = x * fx + y * fy + z * fz;
  x -= along * fx;
  y -= along * fy;
  z -= along * fz;
  const l = hypot3(x, y, z);
  if (l < 1e-6) return;
  up[0] = x / l;
  up[1] = y / l;
  up[2] = z / l;
}

/** The skis' place written back onto the skier's own state while he is
 * off them: his centre over the mid of the two, his way theirs, nothing
 * asked of his legs or edges, and the six stations each ski's tip, middle
 * and tail where it lies — so the trail the renderer stamps is where the
 * skis slid, and whatever follows the skier's state follows his skis. */
export function followSkis(state: GameState, c: SkierState, skis: readonly LoneSki[]): void {
  let x = 0;
  let y = 0;
  let z = 0;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let pk = 0;
  let any = false;
  for (const ski of skis) {
    const P = ski.ends;
    const L = ski.last;
    const m = ski.mount;
    x += P[3] + (P[0] - P[3]) * m;
    y += P[4] + (P[1] - P[4]) * m;
    z += P[5] + (P[2] - P[5]) * m;
    vx += (P[0] + P[3] - L[0] - L[3]) / (2 * dt);
    vy += (P[1] + P[4] - L[1] - L[4]) / (2 * dt);
    vz += (P[2] + P[5] - L[2] - L[5]) / (2 * dt);
    if (ski.touching) any = true;
  }
  const k = 1 / skis.length;
  c.x = x * k;
  c.y = y * k + c.spec.cogHeight;
  c.z = z * k;
  c.vx = vx * k;
  c.vy = vy * k;
  c.vz = vz * k;
  c.wx = 0;
  c.wy = 0;
  c.wz = 0;
  // Faced the way they go, level: nothing reads a pair's attitude now.
  if (hypot(c.vx, c.vz) > 0.5) c.q = fromEuler(Math.atan2(c.vx, c.vz), 0, 0);
  c.speed = hypot3(c.vx, c.vy, c.vz);
  c.way = c.speed;
  c.airborne = !any;
  c.tuck = 0;
  c.brake = 0;
  c.steer = 0;
  c.lean = 0;
  c.crouch = 0;
  c.jumpLoad = 0;
  c.edge = 0;
  c.skid = 0;
  c.carve = 0;
  c.chatter = 0;
  c.sideSlip = 0;
  c.drive = 0;
  for (const contact of c.contacts) {
    const ski = skis[contact.side < 0 ? 0 : 1];
    const P = ski.ends;
    const s = contact.station === "tip" ? 0.95 : contact.station === "tail" ? 0.05 : ski.mount;
    const px = P[3] + (P[0] - P[3]) * s;
    const pz = P[5] + (P[2] - P[5]) * s;
    const p = packedUnder(state.level.packedAt(px, pz), state.fresh);
    pk += p;
    const bit = contact.station === "tip" ? 1 : contact.station === "tail" ? 2 : 3;
    contact.touching = (ski.touching & bit) !== 0;
    if (!contact.touching) continue;
    contact.x = px;
    contact.z = pz;
    contact.y = state.level.groundAt(px, pz);
    contact.sink = 0;
    contact.width = c.spec.waist;
    contact.compression = 0;
    contact.load = 0;
  }
  c.packed = pk / Math.max(1, c.contacts.length);
}
