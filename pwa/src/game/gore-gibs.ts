// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT FLIES OFF A BODY TORN APART, as flown — three-free, so the suite
// reads it. Presentation only: the engine keeps where a piece tore and how
// it was going (`TornPiece`) and nothing after; everything here is the
// drawing's own, stepped on the frame's time and dealt off a seed of its
// own, so it is the same in a replay of the run.
//
//   * A STICK — a limb, the head, the hips and legs torn in two: two ends,
//     the CUT and the FAR end, a length apart, each meeting the snow on its
//     own (a Verlet pair, as the skis let go are), and a roll about its
//     length. Its pose is the turn that takes the stick as it tore to the
//     stick now, about the roll.
//   * A LUMP — an organ, a shard of bone or skull, a gobbet of flesh: one
//     point with a radius and a tumble that the snow slows to a roll and
//     then to rest.
//   * A ROPE — the bowel out of a burst belly: a chain of points, one end
//     held at the wound, the rest falling, draped on the snow, dragged.
//
// The snow is the map's (`groundAt`, `normalAt`) under the drawn cover;
// every one of them slides on it with a snow's friction and stops.

import type { V3 } from "./skier-pose.ts";

/** The snow a gib lands on: the height of the DRAWN surface and its normal. */
export type GibGround = {
  heightAt(x: number, z: number): number;
  normalAt(x: number, z: number, out: V3): V3;
};

const G = 9.81;
/** The air's drag on a tumbling body part, 1/s — light, it is a heavy lump. */
const AIR = 0.05;
/** The snow's grip on a limb sliding on it: what it loses a second of its
 * speed along the snow, as a share, and what stops it outright, m/s. */
const SLIDE = 2.6;
const REST = 0.25;
/** The share of the way into the snow it bounces back out with. */
const BOUNCE = 0.18;

/** A TWO-ENDED PIECE: the cut end `a` and the far end `b`, where each was a
 * frame ago, the length between them, each end's radius, and the roll about
 * the length, rad, with its rate, rad/s. */
export type Stick = {
  a: V3;
  b: V3;
  la: V3;
  lb: V3;
  length: number;
  ra: number;
  rb: number;
  roll: number;
  spin: number;
  /** On the snow this frame: either end. */
  down: boolean;
  /** How long it has lain still, s. */
  still: number;
};

/** A stick at ends `a` and `b`, going `v` m/s, its far end swung on by `w`
 * m/s across it. */
export function stick(
  a: V3,
  b: V3,
  v: V3,
  w: V3,
  ra: number,
  rb: number,
  spin: number,
  dt: number,
): Stick {
  const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) || 0.01;
  return {
    a: { ...a },
    b: { ...b },
    la: { x: a.x - v.x * dt, y: a.y - v.y * dt, z: a.z - v.z * dt },
    lb: { x: b.x - (v.x + w.x) * dt, y: b.y - (v.y + w.y) * dt, z: b.z - (v.z + w.z) * dt },
    length,
    ra,
    rb,
    roll: 0,
    spin,
    down: false,
    still: 0,
  };
}

const n: V3 = { x: 0, y: 1, z: 0 };

/** One end of a body on the snow: kept out of it, its way into it bounced
 * a little, its way along it slowed. True when it touched. */
function onSnow(p: V3, l: V3, r: number, ground: GibGround, dt: number): boolean {
  const floor = ground.heightAt(p.x, p.z) + r;
  if (p.y >= floor) return false;
  ground.normalAt(p.x, p.z, n);
  let vx = (p.x - l.x) / dt;
  let vy = (p.y - l.y) / dt;
  let vz = (p.z - l.z) / dt;
  p.y = floor;
  const into = vx * n.x + vy * n.y + vz * n.z;
  if (into < 0) {
    vx -= (1 + BOUNCE) * into * n.x;
    vy -= (1 + BOUNCE) * into * n.y;
    vz -= (1 + BOUNCE) * into * n.z;
  }
  const along = vx * n.x + vy * n.y + vz * n.z;
  const tx = vx - along * n.x;
  const ty = vy - along * n.y;
  const tz = vz - along * n.z;
  const slide = Math.hypot(tx, ty, tz);
  const keep = slide < REST ? 0 : Math.max(0, 1 - SLIDE * dt);
  vx = along * n.x + tx * keep;
  vy = along * n.y + ty * keep;
  vz = along * n.z + tz * keep;
  l.x = p.x - vx * dt;
  l.y = p.y - vy * dt;
  l.z = p.z - vz * dt;
  return true;
}

function verlet(p: V3, l: V3, dt: number): void {
  const k = 1 - AIR * dt;
  const vx = (p.x - l.x) * k;
  const vy = (p.y - l.y) * k - G * dt * dt;
  const vz = (p.z - l.z) * k;
  l.x = p.x;
  l.y = p.y;
  l.z = p.z;
  p.x += vx;
  p.y += vy;
  p.z += vz;
}

/** Hold two points `length` apart, each moved by its share `wa` : `wb`. */
function hold(a: V3, b: V3, length: number, wa: number, wb: number): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const d = Math.hypot(dx, dy, dz) || 1e-6;
  const s = (d - length) / d / (wa + wb);
  a.x += dx * s * wa;
  a.y += dy * s * wa;
  a.z += dz * s * wa;
  b.x -= dx * s * wb;
  b.y -= dy * s * wb;
  b.z -= dz * s * wb;
}

/** One frame of a stick. */
export function stepStick(s: Stick, ground: GibGround, dt: number): void {
  if (dt <= 0) return;
  const before = { x: s.a.x + s.b.x, y: s.a.y + s.b.y, z: s.a.z + s.b.z };
  verlet(s.a, s.la, dt);
  verlet(s.b, s.lb, dt);
  let down = false;
  for (let k = 0; k < 3; k++) {
    hold(s.a, s.b, s.length, 1, 1);
    down = onSnow(s.a, s.la, s.ra, ground, dt) || down;
    down = onSnow(s.b, s.lb, s.rb, ground, dt) || down;
  }
  s.down = down;
  // The roll: free in the air, rolled along by the snow, and stopped.
  if (down) s.spin *= Math.max(0, 1 - 4 * dt);
  s.roll += s.spin * dt;
  const moved =
    Math.hypot(s.a.x + s.b.x - before.x, s.a.y + s.b.y - before.y, s.a.z + s.b.z - before.z) / 2;
  s.still = down && moved / dt < REST ? s.still + dt : 0;
}

/** A ONE-POINT LUMP: where it is and was, its radius, and its tumble — an
 * axis and a rate, rad/s — which the snow brings to a roll and to rest. */
export type Lump = {
  p: V3;
  l: V3;
  r: number;
  axis: V3;
  spin: number;
  turn: number;
  down: boolean;
};

export function lump(p: V3, v: V3, r: number, axis: V3, spin: number, dt: number): Lump {
  return {
    p: { ...p },
    l: { x: p.x - v.x * dt, y: p.y - v.y * dt, z: p.z - v.z * dt },
    r,
    axis,
    spin,
    turn: 0,
    down: false,
  };
}

export function stepLump(o: Lump, ground: GibGround, dt: number): void {
  if (dt <= 0) return;
  verlet(o.p, o.l, dt);
  o.down = onSnow(o.p, o.l, o.r, ground, dt);
  if (o.down) {
    // Rolled by the snow at the speed it slides, about the axis across it.
    const vx = (o.p.x - o.l.x) / dt;
    const vz = (o.p.z - o.l.z) / dt;
    const v = Math.hypot(vx, vz);
    if (v > 0.05) {
      o.axis = { x: vz / v, y: 0, z: -vx / v };
      o.spin = v / Math.max(0.01, o.r);
    } else o.spin *= Math.max(0, 1 - 6 * dt);
  }
  o.turn += o.spin * dt;
}

/** A ROPE: its points, where each was, the length between two, its radius,
 * and the point it is held at (`held`, the wound) — or none, let go. */
export type Rope = {
  p: V3[];
  l: V3[];
  link: number;
  r: number;
  held: V3 | null;
};

/** A rope `count` points long, coiled out of `at` along `v` m/s. */
export function rope(at: V3, v: V3, count: number, link: number, r: number, dt: number): Rope {
  const p: V3[] = [];
  const l: V3[] = [];
  for (let i = 0; i < count; i++) {
    // Packed in a loose coil at the wound, flung out along the way.
    const a = i * 1.7;
    const q = { x: at.x + 0.04 * Math.cos(a), y: at.y + 0.01 * i, z: at.z + 0.04 * Math.sin(a) };
    p.push(q);
    const k = 0.3 + 0.7 * (i / count);
    l.push({ x: q.x - v.x * k * dt, y: q.y - v.y * k * dt, z: q.z - v.z * k * dt });
  }
  return { p, l, link, r, held: { ...at } };
}

export function stepRope(o: Rope, ground: GibGround, dt: number): void {
  if (dt <= 0) return;
  for (let i = 0; i < o.p.length; i++) verlet(o.p[i], o.l[i], dt);
  for (let k = 0; k < 6; k++) {
    if (o.held) {
      o.p[0].x = o.held.x;
      o.p[0].y = o.held.y;
      o.p[0].z = o.held.z;
    }
    for (let i = 0; i + 1 < o.p.length; i++) {
      hold(o.p[i], o.p[i + 1], o.link, i === 0 && o.held ? 0 : 1, 1);
    }
    for (let i = 0; i < o.p.length; i++) onSnow(o.p[i], o.l[i], o.r, ground, dt);
  }
}
