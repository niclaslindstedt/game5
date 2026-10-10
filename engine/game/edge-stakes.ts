// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE EDGE STAKES — the marker poles down both sides of every run (R23,
// R27), as things a skier meets. Where each stands (`stakePlan`) is stated
// here once: the app draws every stake where this plan puts it, and as
// this run has knocked it (`GameState.stakes`).
//
// A STAKE IS LIGHT (`TUNING.stakes`): a skier is never stopped by one. His
// three plan circles (`trees.bodyRadius` down his skis, as a trunk meets
// him) sweep it over: met slowly it BENDS on its foot as on a hinge and
// whips back up, a damped spring on its tilt; met at `snap` or harder it
// SNAPS and lies on the snow the way it was struck, for the rest of the
// run. What it costs him is a little speed and a twist — a stake caught on
// a tip or a boot snatches it back and turns him about his CoG — and, past
// `crash.stakeSpeed` (`crash.ts`), his balance: he goes down. Each stake
// is met ONCE on its way over (a fresh stake, standing), and a stake lying
// over is ridden across.
//
// Every run keeps its own stakes, made the first time one is touched, and
// nothing here draws from any stream.

import { hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { gradeOf, type RunGrade } from "../mapgen/grades.ts";
import { RESORT_RULES } from "../mapgen/resort-rules.ts";
import { skiRoutesOf } from "../mapgen/ski-routes.ts";
import type { Level, TrackPoint } from "../mapgen/types.ts";
import { envelopeOf } from "./defs/skis.ts";
import { hashOf, unit } from "./rocks.ts";
import { TUNING } from "./defs/tuning.ts";
import type { GameEvent, GameState } from "./state.ts";
import { uprightsNear, type Upright } from "./upright-grid.ts";

const K = TUNING.stakes;

/** Every stake of a map: its foot (x, z, the snow's y), its run's grade
 * (what it is painted), and whether it stands on the skier's right as the
 * picture shows him (the orange-banded side) — and a piste stake's
 * measure, m: its height, its radius and how deep that band is down from
 * its top (a ski route's stand taller and thicker, each upright its own) —
 * and the way each stands off plumb as planted, its lean in rad toward +x
 * and +z (a ski route's, untrimmed; a piste's stand straight). */
export type StakePlan = {
  count: number;
  stakes: Upright[];
  grade: RunGrade[];
  banded: Uint8Array;
  leanX: Float32Array;
  leanZ: Float32Array;
  height: number;
  radius: number;
  band: number;
};

/** THE RUN'S STAKES as this run has knocked them: each one's tilt off
 * upright, rad, its rate, rad/s, the way it lies over (a unit plan
 * direction), whether it is snapped, and the stakes still swinging, by
 * index — the only ones a step moves. */
export type StakeState = {
  tilt: Float32Array;
  spin: Float32Array;
  dirX: Float32Array;
  dirZ: Float32Array;
  broken: Uint8Array;
  live: number[];
};

type Edged = {
  points: readonly TrackPoint[];
  length: number;
  grade: RunGrade;
  every?: number;
  route?: boolean;
};

const plans = new WeakMap<Level, StakePlan>();

/** WHERE THE STAKES STAND on `level`: every `every` m down both edges of
 * every run, `out` past its edge — on a map of a ski area every run is
 * marked as the raced one is, and a stake that would stand on another
 * run's groomed snow (a junction, a lane across a piste) is left out. A
 * SPEED TRACK's sides (R34) are its own: its launch marked in blue, its
 * timing zone in red every `zone` m, its run-out in blue again — the marks
 * a racer reads his speed off. A SKI ROUTE (R42) is marked in orange down
 * both sides of its corridor every `route.every` m, off the groomed snow it
 * leaves and comes down onto. Kept per map. */
export function stakePlan(level: Level): StakePlan {
  const known = plans.get(level);
  if (known) return known;
  const lines: Edged[] = level.resort
    ? [...level.resort.runs]
    : [{ points: level.track.points, length: level.track.length, grade: gradeOf(level) }];
  for (const r of skiRoutesOf(level)) {
    lines.push({ ...r, every: RESORT_RULES.route.every, route: true });
  }
  const sk = level.speedSki;
  if (sk) {
    const part = (from: number, to: number, grade: RunGrade, every: number): Edged => {
      const points = level.track.points.filter((p) => p.s >= from && p.s <= to);
      return { points, length: to - from, grade, every };
    };
    lines.push(
      part(0, sk.zone.from, "blue", K.every),
      part(sk.zone.from, sk.zone.to, "red", K.zone),
      part(sk.zone.to, level.track.length, "blue", K.every),
    );
  }
  const stakes: Upright[] = [];
  const grade: RunGrade[] = [];
  const banded: number[] = [];
  const leanX: number[] = [];
  const leanZ: number[] = [];
  const R = K.route;
  for (const run of lines) {
    let nextS = run.points[0]?.s ?? 0;
    for (const p of run.points) {
      if (p.s < nextS) continue;
      nextS += run.every ?? K.every;
      for (const side of [-1, 1]) {
        // A ski route's stake stands a little in or out of its edge, off
        // a hash of the map and the stake (never the stream).
        const h = run.route ? hashOf(level.seed, stakes.length) : 0;
        const off = run.route ? (unit(h, 0) * 2 - 1) * R.shift : 0;
        const x = p.x + Math.cos(p.heading) * side * (p.width / 2 + K.out + off);
        const z = p.z - Math.sin(p.heading) * side * (p.width / 2 + K.out + off);
        if (
          (run.every === undefined || run.route) &&
          lines.length > 1 &&
          level.packedAt(x, z) > 0.5
        )
          continue;
        const m = run.route ? K.route : K;
        stakes.push({ x, z, y: level.groundAt(x, z), height: m.height, radius: m.radius });
        grade.push(run.grade);
        // The skier's right going down AS DRAWN is the engine's left: the
        // renderer's frame mirrors the map (`input-model.ts`).
        banded.push(side < 0 ? 1 : 0);
        const lean = run.route ? Math.sqrt(unit(h, 1)) * R.lean : 0;
        const way = unit(h, 2) * 2 * Math.PI;
        leanX.push(lean * Math.sin(way));
        leanZ.push(lean * Math.cos(way));
      }
    }
  }
  const plan = {
    count: stakes.length,
    stakes,
    grade,
    banded: Uint8Array.from(banded),
    leanX: Float32Array.from(leanX),
    leanZ: Float32Array.from(leanZ),
    height: K.height,
    radius: K.radius,
    band: K.band,
  };
  plans.set(level, plan);
  return plan;
}

/** This run's stakes, made all standing the first time one is asked. */
function stakesOf(state: GameState, count: number): StakeState {
  state.stakes ??= {
    tilt: new Float32Array(count),
    spin: new Float32Array(count),
    dirX: new Float32Array(count),
    dirZ: new Float32Array(count),
    broken: new Uint8Array(count),
    live: [],
  };
  return state.stakes;
}

/** Where the three footprint circles stand along the skis, as shares of
 * their half-length forward of the CoG — the trunks' (`collision.ts`). */
const CIRCLES = [0.8, 0, -0.8];
const near: number[] = [];

/** Step a run's stakes by the step the world has just taken: the skier
 * against the stakes near him (not while he is thrown — his body is the
 * ragdoll's), then every stake still swinging. */
export function stepStakes(state: GameState, events: GameEvent[], thrown: boolean): void {
  if (!thrown) knock(state, events);
  const s = state.stakes;
  if (!s || s.live.length === 0) return;
  const dt = TUNING.dt;
  for (let k = s.live.length - 1; k >= 0; k--) {
    const i = s.live[k];
    if (s.broken[i]) {
      s.live.splice(k, 1);
      continue;
    }
    // The stake's own spring stands it back up, and past upright the
    // other way, where the tilt goes negative along the same line.
    const w = s.spin[i] + (-K.stiff * s.tilt[i] - K.damp * s.spin[i]) * dt;
    let t = s.tilt[i] + w * dt;
    let spin = w;
    if (t > K.most) {
      t = K.most;
      spin = Math.min(0, spin);
    } else if (t < -K.most) {
      t = -K.most;
      spin = Math.max(0, spin);
    }
    if (Math.abs(t) < 1e-4 && Math.abs(spin) < 1e-3) {
      t = 0;
      spin = 0;
      s.live.splice(k, 1);
    }
    s.tilt[i] = t;
    s.spin[i] = spin;
  }
}

/** The skier's circles against the stakes near him. */
function knock(state: GameState, events: GameEvent[]): void {
  const plan = stakePlan(state.level);
  if (plan.count === 0) return;
  const c = state.skier;
  const half = envelopeOf(c.spec).length / 2;
  const most = TUNING.trees.bodyRadius + Math.max(K.radius, K.route.radius);
  uprightsNear(plan.stakes, c.x, c.z, half + most, near);
  if (near.length === 0) return;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  for (const i of near) {
    const p = plan.stakes[i];
    if (c.y < p.y - 1 || c.y > p.y + p.height) continue;
    const reach = TUNING.trees.bodyRadius + p.radius;
    const s = state.stakes;
    // Snapped, or already lying well over: ridden across.
    if (s && (s.broken[i] || Math.abs(s.tilt[i]) > 0.9)) continue;
    for (const share of CIRCLES) {
      const ox = fx * share * half;
      const oz = fz * share * half;
      const dx = p.x - (c.x + ox);
      const dz = p.z - (c.z + oz);
      const d = hypot(dx, dz);
      if (d >= reach) continue;
      // The way from him to the stake — or his own way, right on it.
      const speed = hypot(c.vx, c.vz);
      const ux = d > 1e-6 ? dx / d : speed > 1e-6 ? c.vx / speed : fx;
      const uz = d > 1e-6 ? dz / d : speed > 1e-6 ? c.vz / speed : fz;
      const closing = Math.max(0, c.vx * ux + c.vz * uz);
      const own = stakesOf(state, plan.count);
      const fresh = Math.abs(own.tilt[i]) < 0.05;
      const snapped = closing >= K.snap;
      // Over the way it was struck: snapped flat, or bent until it clears
      // his shins and set swinging at the rate his legs swept it.
      own.dirX[i] = ux;
      own.dirZ[i] = uz;
      if (snapped) {
        own.broken[i] = 1;
        own.tilt[i] = K.broken;
        own.spin[i] = 0;
      } else {
        own.tilt[i] = Math.max(own.tilt[i], Math.min(K.most, Math.atan((reach - d) / K.knee)));
        own.spin[i] = Math.max(own.spin[i], closing / K.knee);
        if (!own.live.includes(i)) own.live.push(i);
      }
      if (!fresh || closing <= 0) break;
      // What it cost him: a share of the speed he drove into it, more to
      // break it — and the twist of a limb snatched back off his middle.
      const lost = Math.min(K.loss, K.share * closing) + (snapped ? K.snapLoss : 0);
      c.vx -= ux * lost;
      c.vz -= uz * lost;
      c.wy += ((ox * uz - oz * ux) / Math.max(half, 1e-6)) * K.twist * lost;
      if (closing >= K.knock) {
        events.push({ kind: "stake", t: state.t, speed: closing, broke: snapped, x: p.x, z: p.z });
      }
      break;
    }
  }
}
