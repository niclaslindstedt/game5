// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE'S LOOSE PIECES AS DRAWN, DECIDED — three-free, so the suite
// reads it; `chute-scene.ts` draws what is decided here.
//
//   * THE PILOT CHUTE (`pilotOpen`): a crumpled fistful of cloth in his hand
//     at the throw, opening into its dome in the air in a third of a second,
//     and — the canopy flying — collapsed on its kill line, trailing.
//   * THE BRIDLE (`bridlePath`): the tape from the container (and, the bag
//     off his back, from the bag) to the pilot chute — slack, it snakes in
//     the air rushing past; taut, it is straight.
//   * THE BAG (`bagTurn`): lifted off his back and tumbling as the lines
//     strip out of its bands, then stood on the bridle over the canopy.
//   * WHERE THEY RIDE OVER THE CANOPY (`overCanopy`): the bridle sewn to the
//     top skin's middle; through the opening, the pilot chute straight over
//     it pulling with the bag on the tape under it; the canopy flying, the
//     bag (a free bag, kept on the bridle) lying on the top skin behind the
//     attachment and the pilot chute collapsed and trailing up and behind
//     the tail in the air off it, as sport mains are photographed.
//   * THE CANOPY CUT AWAY (`cutawayPoint`): out of the air in a second and a
//     fifth, the span crumpling in and the cloth streaming, its ends flogging
//     as it falls — then LAID ON THE SNOW (`laidPoint`), crumpled flat in a
//     long heap along the way it fell.
//   * THE CANOPY CAUGHT (`crownDrape`, `ropeDrape`): over a crown, the cloth
//     thrown over the tree's top like a sheet over a cone, gathered in folds
//     down its sides; over a lift's rope, folded over the rope like a sheet on a
//     line, both halves hanging.

import type { GameState } from "@engine";

/** A point, m. */
export type P3 = { x: number; y: number; z: number };

/** How far open the pilot chute is, 0 a fistful of cloth .. 1 a full dome:
 * `t` s since the throw, `trailing` once the canopy flies (collapsed on its
 * kill line to a third). */
export function pilotOpen(t: number, trailing: boolean): number {
  if (trailing) return 0.35;
  const k = Math.max(0, Math.min(1, (t - 0.05) / 0.3));
  return 0.15 + 0.85 * k * k * (3 - 2 * k);
}

/** WHERE THE BRIDLE, THE BAG AND THE PILOT CHUTE RIDE over the canopy,
 * in its own frame (`chute-scene.ts`'s: x along the span, y up its lines,
 * z forward; the leading edge at z 0.85, the tail at −2, the top skin
 * highest, some 0.3 m, a third of the way back): `fly` 0 the opening (the
 * air rising straight up past it) .. 1 flying (the air past it from ahead
 * and under, up and back over the top skin). `top` the bridle's
 * attachment, `bag` the bag's middle, `pilot` the pilot chute's apex. */
export function overCanopy(fly: number): { top: P3; bag: P3; pilot: P3 } {
  const k = Math.max(0, Math.min(1, fly));
  const f = k * k * (3 - 2 * k);
  const top = { ...OVER.top };
  const mix = (a: P3, b: P3): P3 => ({
    x: a.x + (b.x - a.x) * f,
    y: a.y + (b.y - a.y) * f,
    z: a.z + (b.z - a.z) * f,
  });
  return {
    top,
    bag: mix(OVER.bag.opening, OVER.bag.flying),
    pilot: mix(OVER.pilot.opening, OVER.pilot.flying),
  };
}

/** The places `overCanopy` blends between, m in the canopy's frame. The
 * flying bag lies on the top skin (0.27 m up there) and the bridle's 2.5 m
 * reach the pilot chute a metre over and some 0.6 m behind the tail. */
export const OVER = {
  top: { x: 0, y: 0.33, z: -0.25 },
  bag: { opening: { x: 0, y: 1.05, z: -0.25 }, flying: { x: 0, y: 0.36, z: -0.85 } },
  pilot: { opening: { x: 0, y: 2.8, z: -0.1 }, flying: { x: 0, y: 1.1, z: -2.6 } },
} as const;

/** How far over from the opening to flying the rig over the canopy is, 0..1,
 * `t` s after the canopy is open: the air turning from rising past it to
 * coming from ahead over a couple of seconds. */
export function flownOver(t: number): number {
  return Math.max(0, Math.min(1, t / 2.2));
}

/** THE BRIDLE as `n + 1` points from `from` to `to` into `out` (x, y, z a
 * point), `length` m of tape: whatever it has over the straight distance is
 * slack, sagging off the line across `side` (a unit vector square to it)
 * and snaking in waves that run up it at `t` s. */
export function bridlePath(
  from: P3,
  to: P3,
  length: number,
  side: P3,
  t: number,
  n: number,
  out: Float32Array | number[],
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const d = Math.hypot(dx, dy, dz);
  const slack = Math.max(0, length - d);
  // A slack arc's depth off its chord, about √(3/8 · chord · slack).
  const sag = Math.sqrt(Math.max(0, (3 / 8) * Math.max(d, 0.2) * slack));
  for (let i = 0; i <= n; i++) {
    const a = i / n;
    const bow = Math.sin(Math.PI * a);
    const wave = Math.sin(a * Math.PI * 3 - t * 14) * bow;
    const off = sag * (0.75 * bow + 0.35 * wave);
    out[i * 3] = from.x + dx * a + side.x * off;
    out[i * 3 + 1] = from.y + dy * a + side.y * off;
    out[i * 3 + 2] = from.z + dz * a + side.z * off;
  }
  return slack;
}

/** THE BAG'S TUMBLE, rad about its own across: turning over as the lines
 * strip out of it (`lines` 0..1 out), then hanging still on the bridle. */
export function bagTurn(t: number, lines: number): number {
  return lines >= 1 ? 0.4 : t * 7 * (0.5 + 0.5 * lines);
}

/** How far a cut-away canopy has gone out of the air, 0 flying .. 1 a
 * streamer: `t` s since it was let go. */
export function deflated(t: number): number {
  // It goes fastest at once, as the air spills out of the open cells.
  const k = Math.max(0, Math.min(1, t / 1.2));
  return 1 - (1 - k) * (1 - k) * (1 - k);
}

/** A POINT OF THE CANOPY CUT AWAY, falling: `p` the point as it flew
 * (its own frame, m), `t` s since it was let go — its span crumpled in,
 * its section flattened, the ends falling below its middle and flogging,
 * the whole cloth fluttering. Into `out` at `o`. */
export function cutawayPoint(p: P3, t: number, out: Float32Array | number[], o: number): void {
  const k = deflated(t);
  const ax = Math.abs(p.x);
  const span = 1 - 0.62 * k;
  const flog = k * (0.12 + 0.1 * ax) * Math.sin(t * 9 + p.x * 2.1 + p.z * 1.7);
  out[o] = p.x * span + k * 0.08 * Math.sin(t * 6 + p.z * 3);
  out[o + 1] = p.y * (1 - 0.7 * k) - k * 0.55 * ax * ax + flog;
  out[o + 2] = p.z * (1 - 0.25 * k) + k * 0.1 * Math.cos(t * 7 + p.x * 2.6);
}

/** A POINT OF THE CANOPY LAID ON THE SNOW: `p` its point as it flew (its
 * own frame, m), laid on the snow flat along `heading` from `at` (the
 * piece's place), crumpled in a long heap — `ground` the snow's height.
 * Into `out` at `o`, the world's frame. */
export function laidPoint(
  p: P3,
  at: { x: number; z: number; heading: number },
  ground: (x: number, z: number) => number,
  out: Float32Array | number[],
  o: number,
): void {
  const fx = Math.sin(at.heading);
  const fz = Math.cos(at.heading);
  // The span along the way it fell, gathered to two thirds, the chord
  // crushed under it.
  const along = p.x * 0.66;
  const across = p.z * 0.45 + p.y * 0.2;
  const wx = at.x + fx * along + fz * across;
  const wz = at.z + fz * along - fx * across;
  const rumple = 0.04 + 0.08 * Math.abs(Math.sin(p.x * 2.9 + p.z * 3.7) * Math.cos(p.y * 4.1));
  out[o] = wx;
  out[o + 1] = ground(wx, wz) + 0.03 + rumple;
  out[o + 2] = wz;
}

/** A CROWN: its top, m, how far down it reaches from it, m, and its widest
 * radius at the foot of that reach, m. */
export type Crown = { x: number; z: number; top: number; depth: number; radius: number };

/** A POINT OF THE CANOPY CAUGHT IN A CROWN: `p` the point in the canopy's
 * own frame (x along the span, y up its lines, z forward), the cloth thrown
 * over the tree like a sheet over a cone — its middle on the top, every
 * point as far down the cone as it lay from the middle across the flat
 * cloth and round it the way it lay (`heading` the canopy's, the span
 * across it), gathered into folds as the cone's girth runs short of the
 * cloth's, the top skin a little proud of the bottom one, and any of it
 * past the cone's foot hanging off its rim. Into `out` at `o`, the
 * world's frame. */
export function crownDrape(
  p: P3,
  crown: Crown,
  heading: number,
  out: Float32Array | number[],
  o: number,
): void {
  const slant = Math.hypot(crown.depth, crown.radius);
  // The cloth laid flat: its span along the arc (some 6 % longer than its
  // chord across the span), its middle at mid-chord.
  const fx = p.x * DRAPE.arc;
  const fz = p.z - DRAPE.middle;
  const r = Math.hypot(fx, fz);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);
  const ax = Math.sin(heading);
  const az = Math.cos(heading);
  let dx = r > 1e-4 ? (fx * rx + fz * ax) / r : 1;
  let dz = r > 1e-4 ? (fx * rz + fz * az) / r : 0;
  const dl = Math.hypot(dx, dz) || 1;
  dx /= dl;
  dz /= dl;
  // Proud of the foliage, the top skin over the bottom, and the folds.
  const theta = Math.atan2(fz, fx);
  const gather = 1 - crown.radius / slant;
  const fold = DRAPE.fold * gather * Math.min(1, r / 1.2) * Math.sin(theta * 9 + r * 1.7);
  const lift = DRAPE.proud + DRAPE.skin * Math.max(0, Math.min(1.4, p.y + 0.8)) + fold;
  if (r <= slant) {
    const d = (r / slant) * crown.radius;
    // The cone's outward normal (straight up over its point), and a
    // rounded cap over the point.
    const round = Math.min(1, r / 0.9);
    const nh = (crown.depth / slant) * round;
    const nv = 1 - (1 - crown.radius / slant) * round;
    const cap = DRAPE.cap * Math.exp(-r / 0.9);
    out[o] = crown.x + dx * (d + nh * lift);
    out[o + 1] = crown.top - (r / slant) * crown.depth + nv * lift + cap;
    out[o + 2] = crown.z + dz * (d + nh * lift);
    return;
  }
  // Off the rim: hanging over the wider boughs below, flared out on them
  // and hung in deep folds between their tips.
  const hang = r - slant;
  const d =
    crown.radius + lift + DRAPE.flare * hang + DRAPE.hang * Math.sin(theta * 9 + hang * 2.2);
  out[o] = crown.x + dx * d;
  out[o + 1] = crown.top - crown.depth - hang * 0.95;
  out[o + 2] = crown.z + dz * d;
}

/** How the caught canopy lies on the crown: its span's arc over its chord,
 * the chord's middle (the canopy's frame, m), how far proud of the cone,
 * how much the top skin stands over the bottom, the folds' depth and the
 * rounded cap over the tree's point, m; off the rim, how far the skirt
 * flares out per metre it hangs and its folds' depth, m. */
const DRAPE = {
  arc: 1.06,
  middle: -0.6,
  proud: 0.18,
  skin: 0.35,
  fold: 0.16,
  cap: 0.3,
  flare: 0.3,
  hang: 0.22,
};

/** A POINT OF THE CANOPY CAUGHT OVER A ROPE: `p` the point where it hung
 * when it caught (the world's frame), folded over the rope through `snag`
 * along `dir` (a unit vector, level or not): the cloth either side of the
 * rope hanging down from it as far as it lay across from it. Into `out` at
 * `o`. */
export function ropeDrape(p: P3, snag: P3, dir: P3, out: Float32Array | number[], o: number): void {
  const rx = p.x - snag.x;
  const ry = p.y - snag.y;
  const rz = p.z - snag.z;
  const along = rx * dir.x + ry * dir.y + rz * dir.z;
  // Across the rope, level: square to it and to the vertical.
  let cx = -dir.z;
  let cz = dir.x;
  const cl = Math.hypot(cx, cz) || 1;
  cx /= cl;
  cz /= cl;
  const across = rx * cx + rz * cz + ry * 0.4;
  const side = Math.sign(across) || 1;
  const drop = Math.abs(across);
  const fold = 0.12 * Math.min(1, drop / 0.3);
  out[o] = snag.x + dir.x * along + cx * side * fold;
  out[o + 1] = snag.y + dir.y * along - drop * 0.93 - 0.03 * along * along;
  out[o + 2] = snag.z + dir.z * along + cz * side * fold;
}

/** WHETHER HE WEARS THE RIG: in the skydive, and on every ride in the air
 * he could jump from with it (`craftFreefall`) — in the plane's door, on
 * the helicopter's skid, a balloon ride and a paramotor ride whole. */
export function rigWorn(state: GameState): boolean {
  return (
    !!state.chute || !!state.plane?.rider || !!state.heli?.rider || !!state.balloon || !!state.para
  );
}
