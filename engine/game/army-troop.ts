// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SOLDIER ON HIS SKIS (`army-ground.ts` moves every one through this):
// how a winter infantryman gets from where he is to where he is going over
// the mountain's own snow.
//
// ROUGH AND CHEAP, as the crowd's amateur is (`crowd.ts`): not a skier on
// the snow's physics but a point on the heightfield with a heading and a
// speed. Down a slope the hill carries him — gravity along his way, the
// snow's drag and the air's (the crowd's own numbers) — checked to the
// pace he holds (`ARMY_GROUND.ski.pace`) by a skid; he turns no tighter
// than his skis carve or skid (`turn` m). Where the hill does not carry
// him he WORKS: skates the flats, climbs a short rise in a herringbone at
// a pace that falls with its steepness, and a long steep one across it,
// zig-zagging as a ski-tourer on skins does. The anti-armour man, who
// carries his launcher rather than skis, walks.
//
// He keeps clear of what stands in the snow (trunks, posts, walls, rock:
// `solidsNear`) — steering off what is ahead of him and pushed out of what
// he touches — and of the other soldiers, and inside the map. A man who
// barely moves in a window (`stuck.window`) steps off to one side for a
// while, so nothing holds him for good: the ground lab counts the men who
// never got free, and that count is 0.
//
// Nothing here draws from any stream: his side-step is the parity of his
// id and the clock.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { ARMY_GROUND } from "./defs/army-ground.ts";
import { TUNING } from "./defs/tuning.ts";
import { solidsNear, solidsOf } from "./posts.ts";
import type { Soldier } from "./army-state.ts";
import type { GameState } from "./state.ts";

const dt = TUNING.dt;
const G = TUNING.g;
const S = ARMY_GROUND.ski;
const C = ARMY_GROUND.clear;
const near: number[] = [];
const n = { x: 0, y: 1, z: 0 };

/** The slope against a man going along `heading` at (x, z), as a tangent:
 * positive up it, negative down it. */
export function slopeAlong(state: GameState, x: number, z: number, heading: number): number {
  state.level.normalAt(x, z, n);
  return -(n.x * Math.sin(heading) + n.z * Math.cos(heading)) / Math.max(0.2, n.y);
}

/** The fall line's steepness at (x, z), a tangent, and the heading straight
 * up it, rad. */
function fallLine(state: GameState, x: number, z: number): { tan: number; up: number } {
  state.level.normalAt(x, z, n);
  const h = hypot(n.x, n.z);
  return { tan: h / Math.max(0.2, n.y), up: Math.atan2(-n.x, -n.z) };
}

/** THE WAY HE TAKES toward (`tx`, `tz`): straight at it, but up a rise too
 * steep to climb straight, across it (the traverse), and turned off the
 * solids ahead of him and the soldiers beside him. */
function wayToward(
  state: GameState,
  s: Soldier,
  all: readonly Soldier[],
  tx: number,
  tz: number,
): number {
  let want = Math.atan2(tx - s.x, tz - s.z);
  // A side-step out of where he is caught.
  if (s.until > state.t) want += (s.side * Math.PI) / 2;
  const f = fallLine(state, s.x, s.z);
  const along = f.tan * Math.cos(angleDiff(f.up, want));
  // ...but the last few metres he sidesteps straight up to it.
  const far = hypot(tx - s.x, tz - s.z) > 3 * S.turn;
  if (s.role === "rifle" && far && along > S.traverse && f.tan > 0.01) {
    // THE TRAVERSE: up the fall line turned off it far enough that the way
    // across climbs at most `traverse`, to the side he is headed, turned
    // the other way every `zig` s.
    const off = Math.acos(clamp((0.8 * S.traverse) / f.tan, 0, 1));
    const zig = Math.floor((state.t + s.id * 1.7) / S.zig) % 2 === 0 ? 1 : -1;
    const toward = Math.sign(angleDiff(f.up, want)) || zig;
    want = f.up + off * (Math.abs(angleDiff(f.up, want)) < 0.3 ? zig : toward);
  }
  // Off the solids ahead of him: each within his look pushes his way to
  // the side it is not on, harder the nearer and the straighter ahead.
  const fx = Math.sin(want);
  const fz = Math.cos(want);
  const ahead = C.ahead;
  const solids = solidsOf(state.level);
  let push = 0;
  for (const i of solidsNear(
    state.level,
    s.x + fx * ahead * 0.5,
    s.z + fz * ahead * 0.5,
    ahead,
    near,
  )) {
    const u = solids[i];
    if (u.y + u.height < s.y + 0.3) continue;
    const dx = u.x - s.x;
    const dz = u.z - s.z;
    const fwd = dx * fx + dz * fz;
    if (fwd <= 0 || fwd > ahead) continue;
    const side = dx * fz - dz * fx;
    const room = u.radius + C.solid + 0.4;
    if (Math.abs(side) > room) continue;
    const k = (1 - fwd / (ahead + 1)) * (1 - Math.abs(side) / (room + 0.01));
    push += (side >= 0 ? -1 : 1) * k;
  }
  want += clamp(push, -1.2, 1.2);
  // ...and off the other soldiers beside him.
  let ax = 0;
  let az = 0;
  for (const o of all) {
    if (o === s || !onSnow(o)) continue;
    const dx = s.x - o.x;
    const dz = s.z - o.z;
    const d = hypot(dx, dz);
    if (d < C.apart && d > 0.01) {
      ax += (dx / d) * (C.apart - d);
      az += (dz / d) * (C.apart - d);
    }
  }
  if (ax !== 0 || az !== 0) {
    const bx = Math.sin(want) + ax;
    const bz = Math.cos(want) + az;
    want = Math.atan2(bx, bz);
  }
  return want;
}

/** Whether a soldier is a body on the snow that another keeps off. */
export function onSnow(s: Soldier): boolean {
  return (
    s.mode === "chase" ||
    s.mode === "aim" ||
    s.mode === "out" ||
    s.mode === "board" ||
    s.mode === "walk" ||
    s.mode === "wait" ||
    s.mode === "cover" ||
    s.mode === "arrest"
  );
}

/** ONE STEP OF A MAN GOING TOWARD (`tx`, `tz`): the way he takes, the
 * hill's pull and the drags, his pace checked to `pace` m/s (and to a stop
 * `stop` m short of it, when asked), his working pace where the hill does
 * not carry him, the solids he touches and the map's edge. */
export function goToward(
  state: GameState,
  s: Soldier,
  all: readonly Soldier[],
  tx: number,
  tz: number,
  pace: number = S.pace,
  stop = -1,
): void {
  const want = wayToward(state, s, all, tx, tz);
  const dist = hypot(tx - s.x, tz - s.z);
  // Turned no tighter than his skis turn at his speed — and at a walk,
  // stepped round on the spot.
  const most = s.speed > 4 ? Math.max(1.2, s.speed / S.turn) : 6;
  const turn = clamp(angleDiff(s.heading, want), -most * dt, most * dt);
  s.heading = Math.atan2(Math.sin(s.heading + turn), Math.cos(s.heading + turn));
  s.lean +=
    (clamp((turn / dt / most) * Math.min(1, s.speed / 6), -1, 1) - s.lean) * Math.min(1, dt * 4);
  const tan = slopeAlong(state, s.x, s.z, s.heading);
  const cap =
    stop >= 0 ? Math.min(pace, Math.sqrt(Math.max(0, 2 * S.brake * (dist - stop)))) : pace;
  if (s.role === "rocket") {
    // ON FOOT: a walk, slower up a slope and through the snow.
    const walk = ARMY_GROUND.foot.walk;
    const v = clamp(walk - 2 * Math.max(0, tan), ARMY_GROUND.foot.least, walk);
    s.speed += clamp(Math.min(v, cap) - s.speed, -3 * dt, 2 * dt);
    s.climb = true;
    s.tuck = 0;
  } else {
    const sin = tan / Math.sqrt(1 + tan * tan);
    let v = s.speed - (G * sin + (s.speed > 0.2 ? S.snow : 0) + S.air * s.speed * s.speed) * dt;
    // A hard turn at speed is skidded: it scrubs.
    v -= Math.abs(turn / dt) * 0.25 * Math.min(1, s.speed / 10) * dt * s.speed;
    if (v > cap) v = Math.max(cap, v - S.brake * dt);
    // WORKING: skating, the herringbone, the traverse on skins.
    const work = clamp(S.skate - S.climb * Math.max(0, tan), S.least, S.skate);
    s.climb = v < Math.min(work, cap) - 0.05;
    if (s.climb) v = Math.min(Math.min(work, cap), Math.max(v, s.speed) + S.push * dt);
    s.speed = Math.max(0, v);
    s.tuck += ((s.speed > 0.8 * pace && !s.climb ? 0.6 : 0) - s.tuck) * Math.min(1, dt * 2);
  }
  step(state, s);
}

/** ONE STEP OF A MAN STOPPING where he is: a hockey stop on skis, at
 * `brake`; a man on foot pulls up at once. */
export function stopHere(state: GameState, s: Soldier): void {
  const brake = s.role === "rocket" ? 6 : S.brake * 1.5;
  s.speed = Math.max(0, s.speed - brake * dt);
  s.climb = false;
  s.tuck += (0 - s.tuck) * Math.min(1, dt * 4);
  s.lean += (0 - s.lean) * Math.min(1, dt * 4);
  step(state, s);
}

/** On along his heading at his speed; out of what he touches; inside the
 * map; on the snow. */
function step(state: GameState, s: Soldier): void {
  const level = state.level;
  s.vx = Math.sin(s.heading) * s.speed;
  s.vz = Math.cos(s.heading) * s.speed;
  s.x += s.vx * dt;
  s.z += s.vz * dt;
  const solids = solidsOf(level);
  for (const i of solidsNear(level, s.x, s.z, 2.5, near)) {
    const u = solids[i];
    if (u.y + u.height < s.y + 0.3 || u.y > s.y + 1.7) continue;
    const dx = s.x - u.x;
    const dz = s.z - u.z;
    const d = hypot(dx, dz);
    const r = u.radius + 0.4;
    if (d >= r) continue;
    const nx = d > 1e-4 ? dx / d : 1;
    const nz = d > 1e-4 ? dz / d : 0;
    s.x = u.x + nx * r;
    s.z = u.z + nz * r;
    // The way into it taken off him.
    const into = -(s.vx * nx + s.vz * nz);
    if (into > 0) s.speed = Math.max(0, s.speed - into);
  }
  const edge = 8;
  s.x = clamp(s.x, edge, level.size - edge);
  s.z = clamp(s.z, edge, level.size - edge);
  s.y = level.groundAt(s.x, s.z);
}

/** THE WATCH ON HIS PROGRESS: every `stuck.window` s, a man who should be
 * moving and moved under `stuck.least` m steps off to a side for
 * `stuck.detour` s — the other side each time he is caught again. Returns
 * how many windows in a row he has barely moved. */
export function watchProgress(state: GameState, s: Soldier, moving: boolean): number {
  const W = ARMY_GROUND.stuck;
  if (!moving) {
    s.wx = s.x;
    s.wz = s.z;
    s.wt = state.t;
    s.slow = 0;
    return 0;
  }
  if (state.t - s.wt < W.window) return s.slow;
  const moved = hypot(s.x - s.wx, s.z - s.wz);
  s.wx = s.x;
  s.wz = s.z;
  s.wt = state.t;
  if (moved < W.least) {
    s.slow++;
    s.side = s.slow % 2 === 1 ? (s.id % 2 === 0 ? 1 : -1) : -s.side;
    s.until = state.t + W.detour;
  } else s.slow = 0;
  return s.slow;
}

/** A SOLDIER PUT ON THE MAP at (x, z), facing `heading`, in `mode` — his
 * id the army's next, his numbers at rest. */
export function enlist(
  state: GameState,
  a: { troops: Soldier[]; nextSoldier: number },
  role: Soldier["role"],
  from: Soldier["from"],
  squad: number,
  mode: Soldier["mode"],
  x: number,
  z: number,
  heading: number,
): Soldier {
  const s: Soldier = {
    id: a.nextSoldier++,
    role,
    from,
    squad,
    mode,
    t: 0,
    x,
    y: state.level.groundAt(x, z),
    z,
    vx: 0,
    vz: 0,
    heading,
    speed: 0,
    climb: false,
    lean: 0,
    tuck: 0,
    tx: x,
    tz: z,
    kneel: false,
    aimH: heading,
    aimP: 0,
    bursts: 0,
    next: state.t,
    saw: -Infinity,
    shout: -Infinity,
    lift: -1,
    carrier: -1,
    seat: 0,
    wx: x,
    wz: z,
    wt: state.t,
    slow: 0,
    side: 1,
    until: 0,
  };
  a.troops.push(s);
  return s;
}
