// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIREBALL — the burst of a crashed helicopter's fuel (`explosion.ts`),
// as numbers and as lobes: three-free, so the suite reads it. The fuel is
// thrown out as a spray along the way the machine was going and lights at
// once: the ball swells to its full size in the first third of its life,
// a dome on the snow, white-yellow at its heart for a beat and then a deep
// orange, its cells bulging out of it, soot pockets darkening inside it
// and black smoke rolling off its skin — and then it LIFTS OFF on its own
// buoyancy and rolls up into a black mushroom. Each lobe of it hands its
// smoke on as it burns out (`smoke`).

import { WRECK, fireballGrowth, fireballOf } from "@engine";

/** THE FIREBALL as drawn: its fuel, its share burnt in the ball, its growth,
 * its lift-off and its rise are the engine's (`WRECK.fire`, which says
 * where each number comes from) — the heat on a body is read off the same
 * ball — and what follows is the look. */
export const BALL = {
  ...WRECK.fire,
  /** The bulging CELLS a ball is a cluster of (a fuel-air fireball is a
   * cauliflower of three to eight, never a sphere), the lobes it is drawn
   * in, how far it is drawn out along the way the wreck was sliding, and
   * the share of its lobes that go over to soot early — the dark pockets
   * in it within its first second. */
  cells: 6,
  lobes: 64,
  stretch: 1.7,
  pockets: 0.18,
  /** The smaller balls the spray lights along the way it was going:
   * their size against the main one's, their delay, s, and how far along
   * they light, shares of its radius at 30 m/s. */
  spray: [
    { size: 0.55, delay: 0.08, along: 0.55 },
    { size: 0.45, delay: 0.22, along: 1.0 },
    { size: 0.35, delay: 0.4, along: 1.35 },
  ],
} as const;

export { fireballOf };

/** The colours of fire, linear RGB a little over one so the tone map
 * keeps them glowing without washing them out to cream: the yellow-white
 * of the heart's first beat, the deep orange of luminous soot at some
 * 1,300–1,600 K, its dull red edge, and soot. */
export const FIRE_COLOURS = {
  white: [2.4, 1.55, 0.42],
  orange: [2.1, 0.62, 0.08],
  red: [0.75, 0.13, 0.025],
  soot: [0.04, 0.03, 0.025],
} as const;

type RGB = readonly [number, number, number] | readonly number[];

/** The fire's colour at `heat` (1 white heat, 0 soot), into `out`. */
export function fireColour(heat: number, out: number[]): number[] {
  const C = FIRE_COLOURS;
  const mix = (a: RGB, b: RGB, t: number): number[] => {
    for (let i = 0; i < 3; i++) out[i] = a[i] + (b[i] - a[i]) * t;
    return out;
  };
  if (heat > 0.75) return mix(C.orange, C.white, (heat - 0.75) / 0.25);
  if (heat > 0.4) return mix(C.red, C.orange, (heat - 0.4) / 0.35);
  return mix(C.soot, C.red, Math.max(0, heat) / 0.4);
}

/** One lobe of a ball: where in it, how big a share of it, and how it
 * burns. */
type Lobe = {
  ux: number;
  uy: number;
  uz: number;
  size: number;
  spin: number;
  rot: number;
  phase: number;
  /** Its depth in the ball, 0 the heart, 1 the skin. */
  depth: number;
  pocket: boolean;
  jitter: number;
  done: boolean;
  /** As drawn this frame: its place, size, colour and opacity. */
  x: number;
  y: number;
  z: number;
  w: number;
  rgb: number[];
  a: number;
};

/** A ball: its middle, its climb, its size, its life, its clock and its
 * lobes. */
export type Ball = {
  x: number;
  y: number;
  z: number;
  ground: number;
  vy: number;
  radius: number;
  life: number;
  age: number;
  live: boolean;
  lobes: Lobe[];
  /** Its heat's halo this frame: its middle, its size and its strength. */
  halo: { x: number; y: number; z: number; size: number; a: number };
};

/** What a ball hands on: smoke at a point, `big` m across, rising `rise`
 * m/s, drifting (vx, vz), living `life` s. */
export type SmokeOut = (
  x: number,
  y: number,
  z: number,
  big: number,
  rise: number,
  vx: number,
  vz: number,
  life: number,
) => void;

export function createBall(): Ball {
  return {
    x: 0,
    y: 0,
    z: 0,
    ground: 0,
    vy: 0,
    radius: 0,
    life: 0,
    age: -1,
    live: false,
    lobes: Array.from({ length: BALL.lobes }, () => ({
      ux: 0,
      uy: 0,
      uz: 0,
      size: 0,
      spin: 0,
      rot: 0,
      phase: 0,
      depth: 0,
      pocket: false,
      jitter: 0,
      done: true,
      x: 0,
      y: 0,
      z: 0,
      w: 0,
      rgb: [0, 0, 0],
      a: 0,
    })),
    halo: { x: 0, y: 0, z: 0, size: 0, a: 0 },
  };
}

/** LIGHT `ball` at (x, y, z), `radius` m at its full size, `delay` s from
 * now, drawn out along (fx, fz); `random` the caller's stream. */
export function lightBall(
  ball: Ball,
  x: number,
  y: number,
  z: number,
  radius: number,
  delay: number,
  fx: number,
  fz: number,
  random: () => number,
): void {
  const full = fireballOf(BALL.fuel * BALL.share);
  Object.assign(ball, {
    x,
    y,
    z,
    ground: y,
    vy: 0,
    radius,
    life: full.life * Math.sqrt(radius / (full.diameter / 2)),
    age: -delay,
    live: true,
  });
  ball.halo.a = 0;
  // The cells it bulges into, scattered through it.
  const cells = Array.from({ length: BALL.cells }, () => {
    const a = random() * Math.PI * 2;
    const up = random() * 1.4 - 0.5;
    const d = 0.35 + 0.35 * random();
    return { x: Math.cos(a) * d, y: up * d, z: Math.sin(a) * d, r: 0.45 + 0.25 * random() };
  });
  const stretch = Math.hypot(fx, fz) > 0.5 ? BALL.stretch : 1;
  for (const l of ball.lobes) {
    // A lobe of one of its cells, more of them toward a cell's skin.
    const cell = cells[Math.floor(random() * cells.length)];
    const d = Math.cbrt(random()) ** 0.6;
    const a = random() * Math.PI * 2;
    const up = random() * 2 - 1;
    const r = Math.sqrt(1 - up * up);
    let ux = cell.x + Math.cos(a) * r * d * cell.r;
    const uy = cell.y + up * d * cell.r;
    let uz = cell.z + Math.sin(a) * r * d * cell.r;
    // Drawn out along the slide.
    const along = (ux * fx + uz * fz) * (stretch - 1);
    ux += fx * along;
    uz += fz * along;
    l.ux = ux;
    l.uy = uy;
    l.uz = uz;
    l.depth = Math.min(1, Math.hypot(ux, uy, uz) / stretch);
    l.pocket = random() < BALL.pockets;
    l.jitter = (random() - 0.5) * 0.35;
    l.size = 0.45 + 0.4 * random();
    l.spin = (random() - 0.5) * 0.8;
    l.rot = random() * Math.PI * 2;
    l.phase = random() * Math.PI * 2;
    l.done = false;
    l.a = 0;
  }
}

/** ONE STEP OF A BALL, `dt` s on at clock `clock`: it grows, lifts off and
 * rises; each lobe burns down and hands its smoke on (`smoke`) — off its
 * skin from its first second, and the whole of it as it goes out. */
export function stepBall(
  ball: Ball,
  dt: number,
  clock: number,
  smoke: SmokeOut,
  random: () => number,
): void {
  if (!ball.live) return;
  ball.age += dt;
  if (ball.age < 0) return;
  const k = ball.age / ball.life;
  // THE GROWTH: to its full size in its first `grow` of its life; it hugs
  // the snow, a dome, until it LIFTS OFF and rises on its own buoyancy.
  const r = ball.radius * fireballGrowth(ball.age, ball.life);
  if (k > BALL.lift) ball.vy = Math.min(BALL.rise, ball.vy + BALL.riseRate * dt);
  ball.y += ball.vy * dt;
  const cy = ball.y + r * 0.55;
  const heat = Math.max(0, 1 - k);
  Object.assign(ball.halo, { x: ball.x, y: cy, z: ball.z, size: r * 2.6, a: 0.55 * heat * heat });
  let left = 0;
  for (const l of ball.lobes) {
    if (l.done) continue;
    // A lobe's heat: the heart burns longest; the skin and the pockets go
    // over to soot first, and once a lobe is soot it is smoke.
    const lk =
      k * (0.75 + 0.55 * l.depth) + (l.pocket ? Math.min(0.5, Math.max(0, k - 0.2) * 1.6) : 0);
    const lh = 1 - lk;
    if (lh <= 0.08) {
      l.done = true;
      l.a = 0;
      // ...and rolls on up as the mushroom's cap.
      smoke(l.x, l.y, l.z, l.w * 0.9, ball.vy * 0.8 + 2, l.ux * 2, l.uz * 2, 12);
      continue;
    }
    left++;
    // Smoke rolls off its skin from its first second — the black that
    // wraps a sooty fireball long before it burns out.
    if (l.depth > 0.75 && k > 0.3 && random() < dt * 2.2) {
      smoke(l.x, l.y + r * 0.2, l.z, l.w * 0.7, ball.vy * 0.6 + 3, l.ux * 3, l.uz * 3, 10);
    }
    // The ball's roll: its lobes turn over on the way up.
    const roll = Math.sin(clock * 1.7 + l.phase) * 0.08;
    l.x = ball.x + l.ux * r * (0.85 + roll);
    l.y = Math.max(ball.ground + l.size * r * 0.3, cy + l.uy * r * 0.8 * (k < BALL.lift ? 0.7 : 1));
    l.z = ball.z + l.uz * r * (0.85 + roll);
    l.w = r * l.size * 1.25;
    l.rot += l.spin * dt;
    // White heat at the heart for its first beat, orange after, each lobe
    // a little hotter or cooler than the next.
    const white = Math.max(0, 1 - ball.age / 0.35) * (1 - l.depth * 0.6);
    const glow = lh * 0.9 + white * 0.35 + (1 - l.depth) * 0.12 + l.jitter * lh;
    fireColour(Math.max(0, Math.min(1, glow)), l.rgb);
    l.a = Math.min(1, lh * 3) * (0.9 + 0.1 * white);
  }
  if (left === 0) {
    ball.live = false;
    ball.halo.a = 0;
  }
}
