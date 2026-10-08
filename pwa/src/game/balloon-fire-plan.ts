// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BALLOON'S FIRE AS DRAWN, DECIDED — three-free, so a test can hold it:
// the BURNER'S FLAME (how long, how wide, how it lights, how it is bent by
// the air past it, the ignition's burst and the dying tail once the blast
// valve shuts, the pilot light) and THE ENVELOPE ON FIRE (where it caught,
// how the burn spreads over the cloth from there, the front the flames
// stand on, what it throws a second, how long the wreck smoulders).
// `balloon-flame.ts` draws the flame, `balloon-fire.ts` the fire, and the
// envelope's shader (`balloon-envelope.ts`) eats the cloth by the same
// front. Presentation only: it reads the engine's `BalloonState` and never
// writes it, and its scatter is its own hash, never the run's stream.
//
// RESEARCHED, then restated:
//   * A sport balloon's MAIN BURNER fires vaporised propane through its
//     coil as a long, narrow "pencil" flame — over five metres at full
//     blast, the biggest ride-balloon burners past eight — blue and nearly
//     transparent at the jets, then a bright yellow-white body with
//     orange, turbulent tongues tearing off its top. It roars into the
//     mouth from a little over head height, so its upper half is inside
//     the envelope.
//   * The WHISPER (liquid-fire) valve burns a softer golden flame at about
//     two thirds of the power; the game's blast valve is the main burner.
//   * The PILOT LIGHT is a small, steady blue flame at each coil, lit for
//     the whole flight, a hand's length long.
//   * At night a burn turns the envelope into a lantern and throws an
//     orange light down on the basket, the pilot and the ground under it.
//   * ENVELOPE FIRES start where the flame meets the cloth: in wind shear
//     the windward side of the mouth is pushed in over the burner, or the
//     envelope tips over a burning burner on the ground. The base panels
//     are a heat-resistant aramid; above them the coated nylon burns fast,
//     the flames climbing the gores far faster than they creep down or
//     round, the cloth melting and dropping burning, and the whole
//     envelope can be engulfed in well under a minute. Overheated cloth
//     goes at the crown first, where the hottest air collects.

import { BALLOON } from "@engine";

import { meridianAt } from "./balloon-look.ts";

const E = BALLOON.envelope;

/** THE BURNER'S FLAME. */
export const FLAME = {
  /** The main blast's length at full flame, m (a pencil flame of over
   * 5 m), and its widest radius, m — about a third of the way up. */
  length: 5.4,
  radius: 0.27,
  /** The length a flame just lit or nearly out still has, as a share. */
  least: 0.25,
  /** The blue root over the jets, m, before the soot glows yellow. */
  blue: 0.4,
  /** How fast its tongues climb it, m/s (the jet leaves the coil far
   * faster and slows as it burns; this is how the turbulence reads). */
  rise: 9,
  /** THE IGNITION: the blast lit with a soft thump — a flame this much
   * bigger and brighter for a moment, dying away over `decay` s. */
  burst: 0.35,
  decay: 0.28,
  /** THE TAIL: the valve shut, the jet is gone from the coil first and the
   * last of the flame lifts off it and burns out — its root climbing at
   * this speed, m/s. */
  cut: 12,
  /** THE BEND: the air across the burner lays the flame's top over by
   * (air speed / `bend`) of its length, no further than `bendMost`. */
  bend: 14,
  bendMost: 0.85,
  /** THE PILOT LIGHT: its length and radius, m. */
  pilot: { length: 0.2, radius: 0.03 },
  /** THE LIGHT IT THROWS (a lamp slot, `headlamp.ts`'s `Flood`): its power
   * against a flood at full flame, the pilot's, its colour (linear — a
   * propane flame's warm orange), and how far up the flame it stands, as
   * a share of the length. */
  light: { power: 0.9, pilot: 0.03, colour: [1.0, 0.5, 0.18] as const, at: 0.35 },
} as const;

/** What the flame's drawing remembers between frames. */
export type FlameMemory = {
  open: boolean;
  /** Seconds since the blast valve last opened or shut. */
  since: number;
  /** The flame's length when the valve shut, m. */
  held: number;
};

export function flameMemory(): FlameMemory {
  return { open: false, since: 99, held: 0 };
}

/** THE FLAME THIS FRAME: its length, m, the root cut away under the tail
 * (m up the flame that is already out), the ignition's burst 0..1, and its
 * brightness 0..1. */
export type FlameNow = { length: number; cut: number; burst: number; bright: number };

/** One frame of the flame: `valve` the engine's blast valve, `flame` its
 * lagged flame 0..1, `dt` s. */
export function stepFlame(
  m: FlameMemory,
  valve: boolean,
  flame: number,
  dt: number,
  out: FlameNow,
): FlameNow {
  if (valve !== m.open) {
    m.held = out.length;
    m.open = valve;
    m.since = 0;
  }
  m.since += Math.max(0, dt);
  const L = FLAME.length;
  if (m.open) {
    const burst = Math.exp(-m.since / FLAME.decay);
    out.burst = burst;
    out.length =
      L *
      (FLAME.least + (1 - FLAME.least) * Math.pow(Math.max(0, flame), 0.6)) *
      (1 + FLAME.burst * burst * 0.6);
    out.cut = 0;
    out.bright = Math.min(1, 0.35 + flame) * (1 + FLAME.burst * burst);
    return out;
  }
  out.burst = 0;
  out.length = Math.max(m.held, 0);
  out.cut = m.since * FLAME.cut;
  out.bright = out.length > 0 ? Math.max(0, 1 - out.cut / (out.length * 1.1)) : 0;
  return out;
}

/** How far the flame's tip is laid over by `shear` m/s of air past it, as
 * a share of its length. */
export function flameBend(shear: number): number {
  return Math.min(FLAME.bendMost, Math.max(0, shear) / FLAME.bend);
}

// ─── THE ENVELOPE ON FIRE ───────────────────────────────────────────────

/** THE SPREAD: a point of the cloth is reached when its key — its
 * distance from where the fire caught, a climb counted at `up` of its
 * height and a descent at `down`, plus the cloth's own noise × `noise` m
 * — is under the front. The front sweeps the farthest point by
 * `burnt = 1 / sweep`; behind it the cloth is gone (but for the charred
 * streamers the noise leaves, `streamer`), a `char` m band at its edge is
 * blackened and the `edge` m at the front itself is alight. */
export const SPREAD = {
  up: 0.5,
  down: 1.9,
  noise: 3.2,
  sweep: 1.18,
  char: 1.8,
  edge: 1.3,
  streamer: 0.7,
} as const;

/** WHAT A BURNING ENVELOPE THROWS, a second at a full front: flames, smoke
 * puffs, embers, burning drips of melted nylon, and burning shreds of
 * cloth torn off; the smoke's rise, m/s; and how long the wreck burns on
 * the snow, then smoulders, s. */
export const FIRE = {
  flames: 150,
  smoke: 40,
  embers: 45,
  drips: 36,
  shreds: 1.6,
  plume: 7,
  wreckBurn: 25,
  smoulder: 90,
  /** The fire's light: power against a flood at full blaze, and colour. */
  light: { power: 4.5, colour: [1.0, 0.48, 0.16] as const },
} as const;

/** THE CLOTH'S OWN NOISE at a rest point of the envelope (m, its own frame)
 * — the same value noise the envelope's shader eats holes by (`bFbm` of
 * the rest point × 0.42), so the flames stand where the holes open. */
export function clothNoise(x: number, y: number, z: number): number {
  const s = 0.42;
  return fbm(x * s, y * s, z * s);
}

function fract(v: number): number {
  return v - Math.floor(v);
}
function hash(x: number, y: number, z: number): number {
  let px = fract(x * 0.3183099 + 0.1) * 17;
  let py = fract(y * 0.3183099 + 0.1) * 17;
  let pz = fract(z * 0.3183099 + 0.1) * 17;
  px = Math.fround(px);
  py = Math.fround(py);
  pz = Math.fround(pz);
  return fract(px * py * pz * (px + py + pz));
}
function noise(x: number, y: number, z: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  let fx = x - ix;
  let fy = y - iy;
  let fz = z - iz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const l = (a: number, b: number, t: number): number => a + (b - a) * t;
  const h = (dx: number, dy: number, dz: number): number => hash(ix + dx, iy + dy, iz + dz);
  return l(
    l(l(h(0, 0, 0), h(1, 0, 0), fx), l(h(0, 1, 0), h(1, 1, 0), fx), fy),
    l(l(h(0, 0, 1), h(1, 0, 1), fx), l(h(0, 1, 1), h(1, 1, 1), fx), fy),
    fz,
  );
}
function fbm(x: number, y: number, z: number): number {
  return (
    0.55 * noise(x, y, z) +
    0.3 * noise(x * 2.13, y * 2.13, z * 2.13) +
    0.15 * noise(x * 4.37, y * 4.37, z * 4.37)
  );
}

/** THE SPREAD'S KEY of a rest point (x, y, z) of the cloth, m, from the
 * point the fire caught at (cx, cy, cz), its noise `n` (`clothNoise`). */
export function spreadKey(
  x: number,
  y: number,
  z: number,
  cx: number,
  cy: number,
  cz: number,
  n: number,
): number {
  const dx = x - cx;
  const dz = z - cz;
  const dy = y - cy;
  const climb = dy > 0 ? dy * SPREAD.up : -dy * SPREAD.down;
  return Math.sqrt(dx * dx + dz * dz + climb * climb) + (n - 0.5) * SPREAD.noise;
}

/** The front's key at `burnt` (0..1) on an envelope whose farthest point's
 * key is `reach`, m. */
export function fireFront(burnt: number, reach: number): number {
  return Math.max(0, burnt) * SPREAD.sweep * reach;
}

/** WHERE IT CATCHES, in the envelope's own frame (m; y up from the mouth,
 * the way `from` rad off +z toward +x): the flame laid into the windward
 * side of the cloth a couple of metres over the mouth, where the skirt's
 * aramid gives way to nylon — or, cooked rather than blown, at the crown,
 * where the hottest air sits. */
export function catchPoint(windward: boolean, from: number, out: number[]): number[] {
  if (!windward) {
    out[0] = 0;
    out[1] = E.height - 0.6;
    out[2] = 0;
    return out;
  }
  const m = meridianAt(2.6);
  out[0] = Math.sin(from) * m.r;
  out[1] = m.y;
  out[2] = Math.cos(from) * m.r;
  return out;
}

/** THE FIRE ON THE CLOTH, for the envelope's shader (after its noise,
 * `bFbm`, and its uniforms `uBalCatch` and `uBalTime`): `fireKey` the
 * spread's key (`spreadKey`), `fireFlicker` how alight a point `behind` m
 * behind the front is, `fireGlow` its light, `fireEmbers` the embers on a
 * charred streamer. */
export const FIRE_GLSL = /* glsl */ `
#define FIRE_EDGE ${SPREAD.edge.toFixed(3)}
#define FIRE_CHAR ${SPREAD.char.toFixed(3)}
#define FIRE_STREAMER ${SPREAD.streamer.toFixed(3)}
float fireKey(vec3 p, float n) {
  vec3 d = p - uBalCatch;
  float climb = d.y > 0.0 ? d.y * ${SPREAD.up.toFixed(3)} : -d.y * ${SPREAD.down.toFixed(3)};
  return length(vec3(d.x, climb, d.z)) + (n - 0.5) * ${SPREAD.noise.toFixed(3)};
}
float fireFlicker(vec3 p, float behind) {
  // Tongues licking up the gore: noise streaming upward, fastest at the
  // front's own edge.
  float f = bFbm(vec3(p.x * 1.3, p.y * 0.7 - uBalTime * 2.6, p.z * 1.3));
  float band = smoothstep(-0.3, 0.1, behind) * (1.0 - smoothstep(FIRE_EDGE * 0.45, FIRE_EDGE, behind));
  // Patchy, never a clean ring: the cloth burns in tongues and holes.
  float patchy = bNoise(p * 0.9 + vec3(0.0, -uBalTime * 0.8, 0.0));
  return band * smoothstep(0.4, 0.7, f + 0.12 * band) * smoothstep(0.25, 0.6, patchy);
}
vec3 fireGlow(float a) {
  // White-yellow at its hottest, orange, a dull red at its fringe; over
  // one, so the tone map keeps it burning against the snow.
  vec3 c = mix(vec3(1.5, 0.3, 0.04), vec3(3.0, 1.55, 0.4), a * a);
  return c * a * 2.0;
}
vec3 fireEmbers(vec3 p, float behind) {
  float e = bNoise(p * 6.0 + vec3(0.0, uBalTime * 0.7, 0.0));
  float live = exp(-max(0.0, behind - FIRE_EDGE) / 3.0);
  return vec3(2.2, 0.6, 0.1) * smoothstep(0.78, 0.95, e) * live;
}
`;
