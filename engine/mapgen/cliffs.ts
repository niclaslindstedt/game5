// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R22 — THE CLIFFS: an edge a skier drops off into the lower ground below.
//
// A cliff is a profile along the direction a skier goes over it, like a
// kicker's (kickers.ts), but its job is the opposite one: not to throw the
// skier UP but to take the ground away from under him. Behind the edge a
// SHELF climbs out of the country over `shelf` metres — smoothstepped, so
// it is level at the top and the skier leaves the edge flying flat rather
// than kicked — and then the FACE falls the whole drop over a couple of
// metres: a wall of snow no legs could ride down, which is the point.
// Across, the edge is full height over its width and sinks back into the
// country over `edge` metres at either end, so its two ends are ramps a
// skier can go round by. Below the face an APRON falls away the way the
// skier is going, steepest where it is met first — a kicker's landing — so
// a drop is landed onto a slope rather than slammed into the flat.
//
// Each one stands on the face and faces DOWN the fall line, so the ground
// below the face keeps falling away: the drop is the face and the fall of
// the mountain together, and the landing is a slope running the way the
// skier is going — the lower ground it was asked for.
//
// Dealt off a stream of their own (the attempt's sub-seed, salted), like the
// drifts: the cliffs move the ground the forest then grows on and nothing
// else the map draws.

import { hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  fieldGradient,
  sampleField,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import { onKicker } from "./kickers.ts";
import { nearestTrackPoint, trackPointAt, type HasTrack } from "./query.ts";
import { scaleCount } from "./regions.ts";
import { descentAt, flankAt, type TerrainPlan } from "./terrain.ts";
import type { Cliff, Kicker } from "./types.ts";

/** Salt on the attempt's sub-seed for the cliffs' own stream. */
const CLIFF_SALT = 0x63c1ff5;

/** The lift a cliff's profile adds `u` metres past its edge (negative on
 * the shelf), m. */
export function cliffProfile(
  c: Pick<Cliff, "drop" | "shelf" | "face" | "apron" | "landing">,
  u: number,
): number {
  const top = c.drop + c.apron;
  if (u <= -c.shelf || u >= c.face + c.landing) return 0;
  if (u <= 0) return top * smoothstep(0, 1, 1 + u / c.shelf);
  if (u < c.face) return top - (c.drop * u) / c.face;
  const t = 1 - (u - c.face) / c.landing;
  return c.apron * t * t;
}

/** How far across the edge a cliff stands at full height, and how far
 * ahead and behind its footprint reaches, m. */
function extent(c: Pick<Cliff, "shelf" | "face" | "landing" | "width">): {
  back: number;
  ahead: number;
  side: number;
} {
  const C = R.cliff;
  return { back: c.shelf, ahead: c.face + c.landing + C.runout, side: c.width / 2 + C.edge };
}

/** Plan points over a cliff's footprint — the shelf, the face, the landing
 * below it and its run-out — every `step` metres: what the piste is kept
 * clear of. */
export function cliffFootprint(
  c: Pick<Cliff, "x" | "z" | "heading" | "shelf" | "face" | "landing" | "width">,
  step = 12,
): { x: number; z: number }[] {
  const { back, ahead, side } = extent(c);
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const out: { x: number; z: number }[] = [];
  const nu = Math.max(1, Math.ceil((back + ahead) / step));
  const nv = Math.max(1, Math.ceil((2 * side) / step));
  for (let i = 0; i <= nu; i++) {
    const u = -back + ((back + ahead) * i) / nu;
    for (let j = 0; j <= nv; j++) {
      const v = -side + (2 * side * j) / nv;
      out.push({ x: c.x + fx * u + fz * v, z: c.z + fz * u - fx * v });
    }
  }
  return out;
}

/** Whether a plan point stands on a cliff or on the landing below it (R14
 * and R4 keep off), with `margin` metres to spare. */
export function onCliff(cliffs: readonly Cliff[], x: number, z: number, margin: number): boolean {
  for (const c of cliffs) {
    const { back, ahead, side } = extent(c);
    const dx = x - c.x;
    const dz = z - c.z;
    const fx = Math.sin(c.heading);
    const fz = Math.cos(c.heading);
    const u = dx * fx + dz * fz;
    const v = Math.abs(dx * fz - dz * fx);
    if (u > -back - margin && u < ahead + margin && v < side + margin) return true;
  }
  return false;
}

/** How far past the least clearance a cliff stood BESIDE the piste (R22,
 * R23) may stand, m: near enough that its edge is seen from the line. */
const BESIDE_REACH = 24;

/** R22 — stand the cliffs on the face clear of the piste, the kickers and
 * the drops across it (R24), facing down the fall line, and cut them into
 * the ground: first the ones the grade stands BESIDE the piste (R23), off a
 * station of the line, then the rest anywhere on the face. */
export function layCliffs(
  sub: number,
  plan: TerrainPlan,
  ground: Heightfield,
  piste: HasTrack,
  kickers: readonly Kicker[],
  drops: readonly Cliff[] = [],
  distanceTo?: (x: number, z: number) => number,
): Cliff[] {
  const C = R.cliff;
  const G = plan.grade.cliffs;
  const rng = createRng((sub ^ CLIFF_SALT) >>> 0);
  const count = scaleCount(C.count, plan.region.kickers * G.count);
  const size = plan.size;
  const face = (plan.flankBand ?? R.mountain.flank).inner - 40;
  const clear = R.track.width.max / 2 + G.clearance;
  const out: Cliff[] = [];
  const length = piste.track.length;
  // BESIDE THE PISTE: a station down the line, a side, and the cliff stood
  // just past the clearance off it — drawn only on a grade that asks for
  // any, so the ungraded row draws what it always drew.
  if (G.beside.max > 0) {
    const beside = rng.int(G.beside.min, G.beside.max);
    for (let tries = 0, laid = 0; tries < beside * 60 && laid < beside; tries++) {
      const p = trackPointAt(piste, rng.range(0.08, 0.9) * length);
      const side = rng.chance(0.5) ? 1 : -1;
      const width = inBand(rng, C.width);
      const off = clear + width / 2 + C.edge + rng.range(0, BESIDE_REACH);
      const x = p.x + Math.cos(p.heading) * side * off;
      const z = p.z - Math.sin(p.heading) * side * off;
      const drop = inBand(rng, C.drop);
      const shelf = inBand(rng, C.shelf);
      if (tryCliff(x, z, drop, shelf, width)) laid++;
    }
  }
  const want = out.length + rng.int(count.min, count.max);
  for (let tries = 0; tries < want * 40 && out.length < want; tries++) {
    const x = size / 2 + rng.range(-face, face);
    const z = plan.summitZ + (plan.baseZ - plan.summitZ) * rng.range(0.06, 0.96);
    const drop = inBand(rng, C.drop);
    const shelf = inBand(rng, C.shelf);
    const width = inBand(rng, C.width);
    tryCliff(x, z, drop, shelf, width);
  }
  // Publish the ground the stamp left at the top of each edge.
  for (const c of out) c.y = sampleField(ground, c.x, c.z);
  return out;

  /** One cliff stood at a plan point if the face there takes it: cut into
   * the ground and kept. */
  function tryCliff(x: number, z: number, drop: number, shelf: number, width: number): boolean {
    const run = drop * C.face;
    const apron = drop * C.apron;
    const landing = apron * C.landing;
    if (descentAt(plan, z) > 1) return false;
    // Faces down the mountain's own fall, read over a wide stencil so a
    // roller's face does not pass for a slope.
    const g = fieldGradient(ground, x, z);
    const gx = (sampleField(ground, x + 20, z) - sampleField(ground, x - 20, z)) / 40;
    const gz = (sampleField(ground, x, z + 20) - sampleField(ground, x, z - 20)) / 40;
    const fall = hypot(gx, gz);
    if (fall < C.fall || hypot(g.gx, g.gz) > 0.6) return false;
    const heading = Math.atan2(-gx, -gz);
    const cliff: Cliff = {
      id: `C${out.length + 1}`,
      x,
      z,
      y: 0,
      heading,
      drop,
      face: run,
      apron,
      landing,
      shelf,
      width,
    };
    const foot = cliffFootprint(cliff);
    if (foot.some((p) => flankAt(plan, p.x, p.z) > 0.02)) return false;
    const far =
      distanceTo ?? ((px: number, pz: number) => nearestTrackPoint(piste, px, pz).distance);
    if (foot.some((p) => far(p.x, p.z) < clear)) return false;
    if (
      foot.some(
        (p) =>
          onKicker(kickers, p.x, p.z, 6) ||
          onCliff(out, p.x, p.z, 10) ||
          (drops.length > 0 && onCliff(drops, p.x, p.z, 10)),
      )
    ) {
      return false;
    }
    stampCliff(ground, cliff);
    out.push(cliff);
    return true;
  }
}

/** Add one cliff's profile to the ground in plan. */
export function stampCliff(ground: Heightfield, c: Cliff): void {
  const { back, side } = extent(c);
  const ahead = c.face + c.landing;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const reach = hypot(Math.max(back, ahead), side);
  const cell = ground.cell;
  const c0 = Math.max(0, Math.floor((c.x - reach) / cell));
  const c1 = Math.min(ground.cols - 1, Math.ceil((c.x + reach) / cell));
  const r0 = Math.max(0, Math.floor((c.z - reach) / cell));
  const r1 = Math.min(ground.rows - 1, Math.ceil((c.z + reach) / cell));
  for (let r = r0; r <= r1; r++) {
    for (let col = c0; col <= c1; col++) {
      const dx = col * cell - c.x;
      const dz = r * cell - c.z;
      const u = dx * fx + dz * fz;
      const v = Math.abs(dx * fz - dz * fx);
      const across = 1 - smoothstep(c.width / 2, side, v);
      if (across <= 0) continue;
      ground.data[r * ground.cols + col] += across * cliffProfile(c, u);
    }
  }
}
