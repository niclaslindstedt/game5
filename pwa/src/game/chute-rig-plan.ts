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
//   * THE CANOPY CUT AWAY (`cutawayPoint`): out of the air in a second and a
//     fifth, the span crumpling in and the cloth streaming, its ends flogging
//     as it falls — then LAID ON THE SNOW (`laidPoint`), crumpled flat in a
//     long heap along the way it fell.
//   * THE CANOPY CAUGHT (`crownDrape`, `ropeDrape`): over a crown, the cloth
//     laid down the cone of the tree from where it caught and hanging off
//     its rim; over a lift's rope, folded over the rope like a sheet on a
//     line, both halves hanging.

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

/** A POINT OF THE CANOPY CAUGHT IN A CROWN: `p` the point where it hung
 * when it caught (the world's frame), laid on the crown's cone out from
 * where it caught it — as far round the cone as it lay from the snag in
 * the air — and hanging straight down off the cone's rim past it; `snag`
 * the point it is held at. Into `out` at `o`. */
export function crownDrape(
  p: P3,
  snag: P3,
  crown: Crown,
  out: Float32Array | number[],
  o: number,
): void {
  // The cone the cloth lies on: the crown's, widened to take in the snag
  // (a line or the cloth's edge can catch a little outside the foliage).
  const radius = Math.max(crown.radius, Math.hypot(snag.x - crown.x, snag.z - crown.z) * 1.05);
  const slant = Math.hypot(crown.depth, radius);
  // How far over the cloth this point is from the snag, and which way.
  const hx = p.x - crown.x;
  const hz = p.z - crown.z;
  const h = Math.hypot(hx, hz);
  const reach = Math.hypot(p.x - snag.x, p.y - snag.y, p.z - snag.z);
  const dx = h > 1e-4 ? hx / h : 1;
  const dz = h > 1e-4 ? hz / h : 0;
  // Down the cone from the snag's own height on it, the cloth wrapping round
  // as much as it runs down.
  const from = Math.max(0, Math.min(1, (crown.top - snag.y) / crown.depth)) * slant;
  const r = from + reach * DRAPE_DOWN;
  if (r <= slant) {
    const d = (r / slant) * radius;
    out[o] = crown.x + dx * d;
    out[o + 1] = crown.top - (r / slant) * crown.depth + 0.12;
    out[o + 2] = crown.z + dz * d;
    return;
  }
  // Off the rim: hanging, swung a little out by the folds.
  const hang = r - slant;
  const d = radius + 0.15 + 0.1 * Math.sin(hang * 3 + h);
  out[o] = crown.x + dx * d;
  out[o + 1] = crown.top - crown.depth - hang * 0.95;
  out[o + 2] = crown.z + dz * d;
}

/** The share of the cloth's run from the snag that goes down the crown's
 * cone (the rest wraps round it). */
const DRAPE_DOWN = 0.7;

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
