// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// R4, R9 — THE KICKERS: crests shaped so a skier at speed leaves the snow.
//
// A kicker is a profile along the direction a skier crosses it: a RAMP that
// rises `height` over `ramp` metres as t², so it is steepest right at the
// lip — a ramp that flattened as it reached the top (a smoothstep) would
// hand the skier no upward speed at the one moment it matters, and a jump
// that does not jump — and then a LANDING that falls the same height away
// over `landing` metres, (1 − u)², steepest at the lip again. The lip is the
// kink between the two, and a kink is a crest no pair of legs can follow.
//
// ON THE PISTE (R9) the profile is added to the graded line itself, by arc
// length, before the corridor is pressed into the ground — so the kicker is
// as wide as the piste, its banks are the corridor's banks, and it follows
// the line through whatever gentle bend it stands in. The line falls the
// whole way down, so a kicker's ramp is the one stretch of it that climbs:
// the search stands one only where the line comes down to the lip gently
// and falls away past it at least as steeply as it came — a roll before a
// pitch, which is where a downhill course's jumps are.
//
// OFF THE PISTE (R4) the same profile is stamped into the ground in plan, on
// a roll of the face facing down the fall line, across a width that blends
// into the snow at its sides — a wind lip a skier leaves the piste to find.

import { angleDiff, clamp, hypot, smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import {
  sampleField,
  fieldGradient,
  type Heightfield,
} from "@niclaslindstedt/oss-game-framework/core/heightfield";
import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";
import type { TrackDrop } from "./drops.ts";
import { UNGRADED, type GradeRow } from "./grades.ts";
import { LEVEL_RULES as R, inBand } from "./rules.ts";
import { nearestTrackPoint } from "./query.ts";
import { scaleCount } from "./regions.ts";
import { fallAlong } from "./spawn.ts";
import { descentAt, flankAt, type TerrainPlan } from "./terrain.ts";
import { trackOf, type Piste } from "./track.ts";
import type { Kicker, KickerShape } from "./types.ts";

/** The ease a built landing falls along and its run-out climbs back
 * along, 0 … 1 over 0 … 1: a quadratic round-over for the first `round` of
 * it, a straight slope through the middle, and a quadratic round-out at the
 * end — so the knuckle is rounded, the slope a skier lands on is one grade,
 * and the foot blends into the flat. */
function ease(x: number, round: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const m = 1 / (1 - round);
  if (x < round) return (m * x * x) / (2 * round);
  if (x < 1 - round) return m * (x - round / 2);
  return 1 - (m * (1 - x) * (1 - x)) / (2 * round);
}

/** How much of a built landing is rounded over at its knuckle and out at
 * its foot, and of its run-out at either end. */
const LANDING_ROUND = 0.25;
const RUNOUT_ROUND = 0.5;

/** The lift a kicker's profile adds `u` metres past its lip (negative on
 * the ramp), m. With no `shape` the landing falls away from the lip as
 * (1 − u)², steepest at the lip (R4, R9). With one (R20) it is BUILT: a
 * flat deck at the lip's height, a landing slope falling `height + dig`
 * over `fall` metres to `dig` under the ground it was shaped on, and a
 * run-out climbing back over the rest of `landing`. */
/** The built landing slope's ease and the run-out's, 0..1 over 0..1 — the
 * park (R20) builds its kickers against the horizontal with these. */
export function landingEase(x: number): number {
  return ease(x, LANDING_ROUND);
}
export function runoutEase(x: number): number {
  return ease(x, RUNOUT_ROUND);
}

export function kickerProfile(
  height: number,
  ramp: number,
  landing: number,
  u: number,
  shape?: KickerShape,
): number {
  if (u <= -ramp || u >= landing) return 0;
  if (u <= 0) {
    const t = 1 + u / ramp;
    return height * t * t;
  }
  if (!shape) {
    const t = 1 - u / landing;
    return height * t * t;
  }
  if (u <= shape.deck) return height;
  const v = u - shape.deck;
  if (v < shape.fall) return height - (height + shape.dig) * ease(v / shape.fall, LANDING_ROUND);
  const out = landing - shape.deck - shape.fall;
  return -shape.dig * (1 - ease((v - shape.fall) / out, RUNOUT_ROUND));
}

/** An on-piste kicker as it is laid: its lip's station. */
export type TrackKicker = { index: number; height: number; ramp: number; landing: number };

/** R9 — choose the piste's kickers and add them to the graded profile, as
 * many and as tall as the grade asks (R23), `drop.kickerClear` off every
 * drop across the line (R24). Returns them by the index of their lip, in
 * order down the line. */
export function layTrackKickers(
  rng: Rng,
  piste: Piste,
  grade: GradeRow = UNGRADED,
  drops: readonly TrackDrop[] = [],
): TrackKicker[] {
  const pts = piste.points;
  const n = pts.length;
  const step = R.track.step;
  const K = R.kickers.on;
  const G = grade.kickers;
  // How many this map carries, dealt in the grade's band: a course with two
  // jumps and one with six are different courses.
  const want = rng.int(G.on.min, G.on.max);
  // Every station a kicker could stand at, scored; then the best that keep
  // their spacing, with a little noise in the score so a seed with two
  // equally good rolls does not always pick the same one.
  type Candidate = { index: number; score: number; fall: number };
  const candidates: Candidate[] = [];
  // One shape of kicker per map — the ramp and the landing as multiples of
  // the lip's height, so a taller lip keeps its slopes — and the lip's
  // height read off each stand's own pitch (R9): the band's foot on a
  // blue's landing, its top on a black's, which is what makes a downhill
  // course's jump and a nursery slope's roller out of one rule. The
  // stands are scored at the tallest lip's reach.
  const rampOf = inBand(rng, K.ramp);
  const landingOf = inBand(rng, K.landing);
  const heightFor = (fall: number): number =>
    (K.height.min +
      (K.height.max - K.height.min) *
        clamp((fall - K.pitch.min) / (K.pitch.max - K.pitch.min), 0, 1)) *
    G.height;
  const ramp = K.height.max * G.height * rampOf;
  const landing = K.height.max * G.height * landingOf;
  const back = Math.ceil((ramp + 10) / step);
  const ahead = Math.ceil((landing + 10) / step);
  const first = Math.ceil((R.grid.back + step + R.spawn.kickerGap) / step);
  const last = n - 1 - Math.ceil((R.track.finish + R.track.runout + landing) / step);
  for (let i = first; i < last; i += 2) {
    if (i - back < 0 || i + ahead >= n) continue;
    // A roll: the line comes down to the lip gently and falls away past
    // it at least as steeply — read over the tallest lip's reach, which
    // sizes this stand's lip …
    const yLip = pts[i].y;
    const yFoot = pts[i - Math.round(ramp / step)].y;
    const yEnd = pts[i + Math.round(landing / step)].y;
    const rise = (yFoot - yLip) / ramp;
    const fall = (yLip - yEnd) / landing;
    if (rise > G.approachGrade || fall < rise - K.roll) continue;
    // … and straight enough over that lip's own ramp and landing.
    const height = heightFor(fall);
    const from = -Math.ceil((height * rampOf) / step);
    const to = Math.ceil((height * landingOf) / step);
    let lo = 0;
    let hi = 0;
    let turned = 0;
    for (let j = from; j < to; j++) {
      turned += angleDiff(pts[i + j].heading, pts[i + j + 1].heading);
      if (turned < lo) lo = turned;
      if (turned > hi) hi = turned;
    }
    if (hi - lo > K.straight) continue;
    candidates.push({ index: i, score: fall - rise + rng.range(0, 0.04), fall });
  }
  candidates.sort((a, b) => b.score - a.score);
  const chosen: TrackKicker[] = [];
  for (const c of candidates) {
    if (chosen.length >= want) break;
    const clear = chosen.every((k) => Math.abs(pts[k.index].s - pts[c.index].s) >= K.spacing);
    if (!clear) continue;
    const height = heightFor(c.fall);
    if (drops.length > 0) {
      const s0 = pts[c.index].s;
      const gap = R.drop.kickerClear;
      const onDrop = drops.some((d) => {
        const ds = pts[d.index].s;
        return (
          s0 - height * rampOf < ds + d.face + d.landing + gap &&
          s0 + height * landingOf > ds - d.shelf - gap
        );
      });
      if (onDrop) continue;
    }
    chosen.push({ index: c.index, height, ramp: height * rampOf, landing: height * landingOf });
  }
  chosen.sort((a, b) => a.index - b.index);
  for (const k of chosen) {
    const s0 = pts[k.index].s;
    for (let j = -Math.ceil(k.ramp / step); j <= Math.ceil(k.landing / step); j++) {
      const p = pts[k.index + j];
      if (!p) continue;
      p.y += kickerProfile(k.height, k.ramp, k.landing, p.s - s0);
    }
  }
  return chosen;
}

/** Publish the piste's kickers against the finished line. */
export function publishTrackKickers(piste: Piste, kickers: readonly TrackKicker[]): Kicker[] {
  const out = kickers
    .map((k) => {
      const p = piste.points[k.index];
      return {
        id: "",
        x: p.x,
        z: p.z,
        y: p.y,
        heading: p.heading,
        height: k.height,
        ramp: k.ramp,
        landing: k.landing,
        width: p.width,
        onTrack: true,
        s: p.s,
      } satisfies Kicker;
    })
    .sort((a, b) => a.s - b.s);
  out.forEach((k, i) => (k.id = `K${i + 1}`));
  return out;
}

/** R4 — stand the natural kickers on the face's rolls clear of the piste,
 * facing down the fall line, and stamp them into the ground. */
export function layOffKickers(
  rng: Rng,
  plan: TerrainPlan,
  ground: Heightfield,
  piste: Piste,
): Kicker[] {
  const K = R.kickers.off;
  // R21, R23 — the region's and the grade's multiple of the rule's count;
  // the same band at one.
  const count = scaleCount(K.count, plan.region.kickers * plan.grade.kickers.off);
  const want = rng.int(count.min, count.max);
  const out: Kicker[] = [];
  const size = R.world.size;
  const face = R.mountain.flank.inner - 60;
  for (let tries = 0; tries < want * 40 && out.length < want; tries++) {
    const x = size / 2 + rng.range(-face, face);
    const z = plan.summitZ + (plan.baseZ - plan.summitZ) * rng.range(0.08, 0.96);
    const height = inBand(rng, K.height);
    const ramp = inBand(rng, K.ramp);
    const landing = inBand(rng, K.landing);
    const width = inBand(rng, K.width);
    const reach = Math.max(ramp, landing) + width / 2 + R.kickers.edge;
    if (flankAt(plan, x, z) > 0.02 || descentAt(plan, z) > 1) continue;
    // Down the fall line, on ground a lip can be shaped on …
    const g = fieldGradient(ground, x, z);
    const slope = hypot(g.gx, g.gz);
    if (slope < R.cliff.fall || slope > K.maxSlope) continue;
    const heading = Math.atan2(-g.gx, -g.gz);
    // … and on a ROLL: the ground past the lip falls away steeper than it
    // comes up to it.
    const above = fallAlong(
      ground,
      x - Math.sin(heading) * ramp,
      z - Math.cos(heading) * ramp,
      heading,
      ramp,
    );
    const below = fallAlong(ground, x, z, heading, landing);
    if (below.steepest - above.gentlest < K.roll) continue;
    const hit = nearestTrackPoint(trackOf(piste), x, z);
    if (hit.distance - reach < R.track.width.max / 2 + K.clearance) continue;
    if (out.some((k) => hypot(k.x - x, k.z - z) < reach + Math.max(k.ramp, k.landing) + 20)) {
      continue;
    }
    const y0 = sampleField(ground, x, z);
    stampKicker(ground, x, z, heading, height, ramp, landing, width);
    out.push({
      id: `X${out.length + 1}`,
      x,
      z,
      y: y0 + height,
      heading,
      height,
      ramp,
      landing,
      width,
      onTrack: false,
    });
  }
  // Publish the ground height the stamp actually left at each lip.
  for (const k of out) k.y = sampleField(ground, k.x, k.z);
  return out;
}

/** Add one kicker's profile to the ground in plan. */
export function stampKicker(
  ground: Heightfield,
  x: number,
  z: number,
  heading: number,
  height: number,
  ramp: number,
  landing: number,
  width: number,
): void {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const edge = R.kickers.edge;
  const reach = Math.max(ramp, landing) + width / 2 + edge;
  const cell = ground.cell;
  const c0 = Math.max(0, Math.floor((x - reach) / cell));
  const c1 = Math.min(ground.cols - 1, Math.ceil((x + reach) / cell));
  const r0 = Math.max(0, Math.floor((z - reach) / cell));
  const r1 = Math.min(ground.rows - 1, Math.ceil((z + reach) / cell));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const dx = c * cell - x;
      const dz = r * cell - z;
      const u = dx * fx + dz * fz;
      const v = Math.abs(dx * fz - dz * fx);
      const across = 1 - smoothstep(width / 2, width / 2 + edge, v);
      if (across <= 0) continue;
      ground.data[r * ground.cols + c] += across * kickerProfile(height, ramp, landing, u);
    }
  }
}

/** Whether a plan point stands on a kicker's footprint (R14 keeps trees
 * off them), with `margin` metres to spare. */
export function onKicker(
  kickers: readonly Kicker[],
  x: number,
  z: number,
  margin: number,
): boolean {
  for (const k of kickers) {
    const dx = x - k.x;
    const dz = z - k.z;
    const fx = Math.sin(k.heading);
    const fz = Math.cos(k.heading);
    const u = dx * fx + dz * fz;
    const v = Math.abs(dx * fz - dz * fx);
    if (
      u > -k.ramp - margin &&
      u < k.landing + margin &&
      v < k.width / 2 + R.kickers.edge + margin
    ) {
      return true;
    }
  }
  return false;
}
