// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AVALANCHE AS DRAWN — what is DECIDED about it, three-free so the
// suite reads it (`tests/avalanche_look_test.ts`); `avalanche-view.ts`
// flies and draws it, `avalanche-glsl.ts` lays it into the snow. The
// engine's avalanche (`engine/game/avalanche.ts`) is the slab and the
// flow; nothing here feeds back into it.
//
// WHAT A SLAB AVALANCHE LOOKS LIKE (`docs/avalanche.md` § As drawn):
//
//   * THE CROWN is a clean wall square to the bed, the slab's thickness
//     tall, jogging a little along its line; THE FLANKS run down the fall
//     line either side, lower and more ragged; THE BED SURFACE between is
//     the old, harder snow the slab slid off, smoother and greyer, with the
//     blocks' slide marks down it. Here the bed is a pure function of the
//     slab's frame (`bedDepth`), stated once and mirrored line for line in
//     the shader, so the wall is as sharp as the ground's mesh is fine.
//   * THE SLAB cracks out from its trigger into IRREGULAR PLATES of very
//     different sizes (`avalanche-crack.ts`) that slide, tip, crowd and
//     break up (`plateBreak`) into tumbling CHUNKS that round off into
//     SNOWBALLS as they run (`chunkSize`), in a churned BODY of snow, deepest
//     at its head (`body`).
//   * A POWDER CLOUD boils off the fast part of the flow — the head most —
//     and hangs and drifts after it stops (`cloudShare`); a size 2 throws
//     one tens of metres high.
//   * THE DEBRIS lies in a lobed tongue, a metre or two deep, a jumble of
//     blocks and snowballs with shade in every gap: the engine's own
//     cones (`debrisDepth`), splatted into a small map (`splatDebris`).
//
// Every number is in `SLIDE_LOOK`, with what it was read off.

import { AVALANCHE, AVALANCHE_CELL as CELL, type SlabFrame, type Slide } from "@engine";

export const SLIDE_LOOK = {
  /** THE CROWN'S LINE: two waves along it, m of jog down the fall line
   * and their wavenumbers, 1/m — straight-ish, stepped where it jogged
   * between weak spots. */
  crown: { jog: [0.8, 0.35] as const, wave: [0.19, 0.53] as const },
  /** THE FLANKS: m of ragged edge across and its wavenumber down the
   * slope; within `low` m of a flank the bed is `lowShare` as deep — the
   * flanks are lower than the crown. */
  flank: { ragged: 1.1, wave: 0.23, low: 4, lowShare: 0.6 },
  /** THE BED: the share of the depth lost by the stauchwall (slabs thin
   * down the slope) and the metres over which it fades into the snow the
   * slab pushed against there. */
  bed: { thin: 0.3, toe: 8 },
  /** THE DEBRIS MAP: a texel, m (the engine's cones are 9 m across, so 2 m
   * carries them); the room kept round the slab for where the flow may
   * run, across each way and down past the stauchwall, m; and the most
   * texels either way, so a freak runout cannot grow the map. */
  debris: { texel: 2, side: 70, below: 320, above: 8, most: [160, 360] as const },
  /** THE PLATES (`avalanche-crack.ts` cuts them): the crack round one at
   * the release and once its parcels have run it apart, m; the most; and
   * how far it is carried before it breaks up, m (dealt). */
  plate: {
    gap: [0.08, 0.5] as const,
    most: 1024,
    breaks: [5, 16] as const,
  },
  /** THE CHUNKS a parcel's plates break into: how many a parcel, the most
   * in all, how far its parcel runs before each shows, m (dealt), their
   * size as broken blocks and as the snowballs they round off into, m
   * (blocks 10 cm to 1–2 m across), and the metres of run that rounds a
   * block halfway to a ball. */
  chunk: {
    per: 6,
    /** A small slide's parcels share the budget out to this many each, so
     * its flow is as dense as a big one's. */
    perMost: 16,
    most: 2560,
    from: [2, 16] as const,
    big: [0.5, 1.3] as const,
    ball: [0.25, 0.6] as const,
    round: 60,
  },
  /** THE FLOWING BODY: the churned snow every running parcel carries, a
   * few lumps a parcel (`per`) its half-sizes across and along, m, and
   * their height as a share of the flow's (m over at least `low`); grown
   * in over the parcel's first metres of run as its plates break (m), gone
   * over `fade` s once it rests (the debris has it then); and the HEAD,
   * the parcels within `front` m of the leading one, `head` times as big
   * and `rise` times as tall — a flow is deepest at its front. */
  body: {
    per: 4,
    across: [2.4, 4] as const,
    along: [3.2, 5.6] as const,
    tall: [0.7, 1.2] as const,
    low: 0.45,
    grow: [2, 12] as const,
    fade: 1.6,
    front: 40,
    head: 0.45,
    rise: 0.9,
  },
  /** THE POWDER CLOUD: the parcel speed it starts to boil off at and is
   * whole at, m/s (a dry flow at 20–30 m/s throws one); the BILLOWS a
   * second off the whole slide at the whole of it, most of them off the
   * HEAD (`front` m of it, `headShare` of the rate); their radius, m, how
   * many times that it swells by, how fast they rise, m/s, and how long
   * they hang, s (tens of seconds, drifting on the wind) — a size 2's
   * cloud stands tens of metres tall; and the low SALTATION puffs a second
   * a running parcel raises from `dustFrom` m/s, each short-lived. */
  cloud: {
    from: 4,
    full: 17,
    billows: 34,
    front: 45,
    headShare: 0.75,
    size: [3, 6.5] as const,
    grow: 2.6,
    rise: [2.5, 6.5] as const,
    hang: [14, 26] as const,
    opacity: [0.75, 0.95] as const,
    dust: 2,
    dustFrom: 4,
    dustSize: [1.2, 2.4] as const,
    dustHang: [2, 3.5] as const,
    /** At the release, the whumpf's dust along the crown: puffs a metre of
     * crown. */
    crack: 0.35,
  },
  /** THE GROUND SHAKING under a skier near it, 0..1: from a running parcel
   * `reach` m off to `near` m, by the flow's speed over `speed` m/s; and
   * the release's jolt within `release` m of the crown, gone over `jolt`
   * s. */
  quake: { reach: 90, near: 12, speed: 18, release: 70, jolt: 1.4 },
} as const;

/** A number in 0..1 off two integers and a salt — the look's own hash,
 * never the engine's stream. */
export function hash01(a: number, b: number, salt = 0): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul((b | 0) + 0x165667b1, 0x9e3779b1) ^ salt;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** THE SLAB'S OWN PHASES for its crown's jog and its flanks' rag: four
 * angles off where it broke. */
export function slabPhases(slab: SlabFrame): [number, number, number, number] {
  const a = Math.round(slab.x * 8);
  const b = Math.round(slab.z * 8);
  const t = Math.PI * 2;
  return [hash01(a, b, 1) * t, hash01(a, b, 2) * t, hash01(a, b, 3) * t, hash01(a, b, 4) * t];
}

/** (`x`, `z`) in the slab's frame: `u` across it (+ toward its left
 * flank, along (fz, −fx)), `v` down its fall line from the crown, m. */
export function slabFrameOf(
  slab: SlabFrame,
  x: number,
  z: number,
  out: { u: number; v: number },
): { u: number; v: number } {
  const dx = x - slab.x;
  const dz = z - slab.z;
  out.u = dx * slab.fz - dz * slab.fx;
  out.v = dx * slab.fx + dz * slab.fz;
  return out;
}

/** The crown's line `v` m down the fall line at `u` across. */
export function crownAt(phase: readonly number[], u: number): number {
  const C = SLIDE_LOOK.crown;
  return (
    C.jog[0] * Math.sin(u * C.wave[0] + phase[0]) + C.jog[1] * Math.sin(u * C.wave[1] + phase[1])
  );
}

function smooth(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** THE BED: how far below the old surface the bed surface lies at
 * (`u`, `v`) in the slab's frame, m — 0 off the slab. The crown and the
 * flanks are steps (the slab's whole thickness at once), the bed thins
 * down the slope and fades into the snow at the stauchwall. Mirrored in
 * `avalanche-glsl.ts`'s `slideBed`. */
export function bedDepth(slab: SlabFrame, phase: readonly number[], u: number, v: number): number {
  const F = SLIDE_LOOK.flank;
  const B = SLIDE_LOOK.bed;
  const C = SLIDE_LOOK.crown;
  // Off the slab's box altogether — most of a flow's points — before the
  // crown's waves are worked out.
  if (v > slab.length || v < -(C.jog[0] + C.jog[1])) return 0;
  if (u > slab.left + F.ragged || u < -slab.right - F.ragged) return 0;
  const top = crownAt(phase, u);
  if (v < top || v > slab.length) return 0;
  const left = slab.left + F.ragged * Math.sin(v * F.wave + phase[2]);
  const right = slab.right + F.ragged * Math.sin(v * F.wave * 1.3 + phase[3]);
  if (u > left || u < -right) return 0;
  const edge = Math.min(left - u, u + right);
  const t = Math.min(1, Math.max(0, (v - top) / slab.length));
  return (
    slab.depth *
    (1 - B.thin * t) *
    (F.lowShare + (1 - F.lowShare) * smooth(0, F.low, edge)) *
    (1 - smooth(slab.length - B.toe, slab.length, v))
  );
}

/** THE DEBRIS MAP'S BOX in the slab's frame: its first texel's corner
 * (`u0`, `v0`), m, its texel, m, and its texels across (`nu`) and down
 * (`nv`). */
export type DebrisBox = { u0: number; v0: number; texel: number; nu: number; nv: number };

export function debrisBox(slab: SlabFrame): DebrisBox {
  const D = SLIDE_LOOK.debris;
  const texel = D.texel;
  const nu = Math.min(D.most[0], Math.ceil((slab.left + slab.right + 2 * D.side) / texel));
  const nv = Math.min(D.most[1], Math.ceil((slab.length + D.above + D.below) / texel));
  // Centred across on the slab's middle.
  const mid = (slab.left - slab.right) / 2;
  return { u0: mid - (nu * texel) / 2, v0: -D.above, texel, nu, nv };
}

/** Whether every parcel of `slide`, with its cone round it, lies inside
 * `box` — a flow that has run past the room first kept for it has not. */
export function debrisFits(box: DebrisBox, slide: Slide): boolean {
  const R = AVALANCHE.spread;
  const at = { u: 0, v: 0 };
  const c = slide.cells;
  for (let k = 0; k < slide.count * CELL.stride; k += CELL.stride) {
    slabFrameOf(slide.slab, c[k + CELL.x], c[k + CELL.z], at);
    if (
      at.u - R < box.u0 ||
      at.v - R < box.v0 ||
      at.u + R > box.u0 + box.nu * box.texel ||
      at.v + R > box.v0 + box.nv * box.texel
    ) {
      return false;
    }
  }
  return true;
}

/** THE DEBRIS MAP'S BOX grown to where the flow has got to: the slab and
 * every parcel with its cone, and the room `side` across and `below` past
 * the furthest — its texel coarsened only if that would pass `most`. */
export function debrisBoxOf(slide: Slide): DebrisBox {
  const D = SLIDE_LOOK.debris;
  const k = slide.slab;
  const R = AVALANCHE.spread;
  let u0 = -k.right - R;
  let u1 = k.left + R;
  let v0 = -D.above;
  let v1 = k.length;
  const at = { u: 0, v: 0 };
  const c = slide.cells;
  for (let i = 0; i < slide.count * CELL.stride; i += CELL.stride) {
    slabFrameOf(k, c[i + CELL.x], c[i + CELL.z], at);
    u0 = Math.min(u0, at.u - R);
    u1 = Math.max(u1, at.u + R);
    v0 = Math.min(v0, at.v - R);
    v1 = Math.max(v1, at.v + R);
  }
  u0 -= D.side / 2;
  u1 += D.side / 2;
  v1 += D.below / 2;
  const texel = Math.max(D.texel, (u1 - u0) / D.most[0], (v1 - v0) / D.most[1]);
  const nu = Math.min(D.most[0], Math.ceil((u1 - u0) / texel));
  const nv = Math.min(D.most[1], Math.ceil((v1 - v0) / texel));
  return { u0, v0, texel, nu, nv };
}

/** THE DEBRIS LYING: every parcel at rest laid into `map` (one number a
 * texel, row by row down the slope) as the engine's own cone
 * (`debrisDepth`: its settled volume over a disc `AVALANCHE.spread` m
 * across), so each texel's middle carries exactly the depth the engine
 * has there. Returns how many parcels lay in it. */
export function splatDebris(slide: Slide, box: DebrisBox, map: Float32Array): number {
  map.fill(0);
  const R = AVALANCHE.spread;
  const norm = (3 / (Math.PI * R * R)) * AVALANCHE.settle;
  const c = slide.cells;
  const S = CELL.stride;
  const at = { u: 0, v: 0 };
  let laid = 0;
  for (let k = 0; k < slide.count * S; k += S) {
    if (c[k + CELL.run] !== 0) continue;
    laid++;
    slabFrameOf(slide.slab, c[k + CELL.x], c[k + CELL.z], at);
    const peak = c[k + CELL.vol] * norm;
    const cu = (at.u - box.u0) / box.texel - 0.5;
    const cv = (at.v - box.v0) / box.texel - 0.5;
    const r = R / box.texel;
    const i0 = Math.max(0, Math.ceil(cu - r));
    const i1 = Math.min(box.nu - 1, Math.floor(cu + r));
    const j0 = Math.max(0, Math.ceil(cv - r));
    const j1 = Math.min(box.nv - 1, Math.floor(cv + r));
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const d = Math.hypot(i - cu, j - cv) * box.texel;
        if (d >= R) continue;
        map[j * box.nu + i] += peak * (1 - d / R);
      }
    }
  }
  return laid;
}

/** The debris map read at (`u`, `v`) in the slab's frame, bilinearly
 * between texel middles as the shader's filter reads it, m. */
export function debrisAt(box: DebrisBox, map: Float32Array, u: number, v: number): number {
  const fu = (u - box.u0) / box.texel - 0.5;
  const fv = (v - box.v0) / box.texel - 0.5;
  if (fu < -0.5 || fv < -0.5 || fu > box.nu - 0.5 || fv > box.nv - 0.5) return 0;
  const i = Math.max(0, Math.min(box.nu - 2, Math.floor(fu)));
  const j = Math.max(0, Math.min(box.nv - 2, Math.floor(fv)));
  const a = Math.min(1, Math.max(0, fu - i));
  const b = Math.min(1, Math.max(0, fv - j));
  const k = j * box.nu + i;
  const top = map[k] + (map[k + 1] - map[k]) * a;
  const bottom = map[k + box.nu] + (map[k + box.nu + 1] - map[k + box.nu]) * a;
  return top + (bottom - top) * b;
}

/** How far its parcel carries plate `i` before it breaks up, m. */
export function plateBreak(i: number): number {
  const B = SLIDE_LOOK.plate.breaks;
  return B[0] + (B[1] - B[0]) * hash01(i, 7, 0x51ab);
}

/** The crack round a plate, m, once its parcel has carried it `run` m. */
export function plateGap(run: number): number {
  const G = SLIDE_LOOK.plate.gap;
  return G[0] + (G[1] - G[0]) * Math.min(1, run / 6);
}

/** CHUNK `j` of parcel `k`: whether it shows yet after `run` m of its
 * parcel's run, and its size, m — a broken block rounding off into a
 * snowball the further it runs. */
export function chunkFrom(k: number, j: number): number {
  const F = SLIDE_LOOK.chunk.from;
  return F[0] + (F[1] - F[0]) * hash01(k, j, 0xc4c);
}

export function chunkSize(k: number, j: number, run: number): number {
  const C = SLIDE_LOOK.chunk;
  const big = C.big[0] + (C.big[1] - C.big[0]) * hash01(k, j, 0xb16);
  const ball = C.ball[0] + (C.ball[1] - C.ball[0]) * hash01(k, j, 0xba11);
  return roundOff(big, ball, chunkFrom(k, j), run);
}

/** A block `big` m across broken off at `from` m of its parcel's run,
 * rounded off towards a snowball `ball` m across by `run` m, m — halving
 * the difference every `chunk.round` m. */
export function roundOff(big: number, ball: number, from: number, run: number): number {
  const past = Math.max(0, run - from);
  // Never grown: a block smaller than its snowball keeps its size.
  const end = Math.min(ball, big);
  return end + (big - end) * Math.exp((-past * Math.LN2) / SLIDE_LOOK.chunk.round);
}

/** How many numbers {@link chunkTraits} writes a chunk. */
export const CHUNK_TRAITS = 13;

/** CHUNK `j` OF PARCEL `k`'s own numbers, dealt once a slide rather than
 * hashed every frame, into `out` at `o`: where it breaks off (m of run),
 * its size whole and as a snowball (m), its bearing and drift round its
 * parcel, its share of the spread, its bounce's and roll's phases, its
 * tilt's axis and angle, and its flattening and depth. */
export function chunkTraits(k: number, j: number, out: Float32Array, o: number): void {
  const C = SLIDE_LOOK.chunk;
  out[o] = chunkFrom(k, j);
  out[o + 1] = C.big[0] + (C.big[1] - C.big[0]) * hash01(k, j, 0xb16);
  out[o + 2] = C.ball[0] + (C.ball[1] - C.ball[0]) * hash01(k, j, 0xba11);
  out[o + 3] = hash01(k, j, 0x7a) * Math.PI * 2;
  out[o + 4] = 0.04 * (hash01(k, j, 3) - 0.5);
  out[o + 5] = Math.sqrt(hash01(k, j, 0x7b));
  out[o + 6] = hash01(k, j, 4) * 6;
  out[o + 7] = hash01(k, j, 5) * 6;
  out[o + 8] = hash01(k, j, 6) - 0.5;
  out[o + 9] = hash01(k, j, 7) - 0.5;
  out[o + 10] = hash01(k, j, 8) * 6.28;
  out[o + 11] = 0.75 + 0.25 * hash01(k, j, 10);
  out[o + 12] = 0.85 + 0.3 * hash01(k, j, 11);
}

/** THE POWDER CLOUD: how much of the boil a parcel running at `speed`
 * m/s throws, 0..1 — the front, fastest, throws the most. */
export function cloudShare(speed: number): number {
  const C = SLIDE_LOOK.cloud;
  const s = Math.min(1, Math.max(0, (speed - C.from) / (C.full - C.from)));
  return s * s;
}

/** THE GROUND SHAKING at a point `near` m from the nearest running
 * parcel of a flow whose front runs at `front` m/s, `since` s after its
 * release and `fromCrown` m from its crown, 0..1. */
export function quakeAt(near: number, front: number, since: number, fromCrown: number): number {
  const Q = SLIDE_LOOK.quake;
  const close = 1 - Math.min(1, Math.max(0, (near - Q.near) / (Q.reach - Q.near)));
  const flow = close * close * Math.min(1, front / Q.speed);
  const jolt = since < Q.jolt ? (1 - since / Q.jolt) * Math.max(0, 1 - fromCrown / Q.release) : 0;
  return Math.min(1, Math.max(flow, jolt));
}
