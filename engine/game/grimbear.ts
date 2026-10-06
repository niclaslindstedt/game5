// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GRIMBEAR — the thing in the woods a free ride meets now and then: a
// bear's shaggy bulk and head on a man's stride. The app deals him to a run
// (`CreateGameOptions.grimbear`); a run without him never steps any of this.
//
// HE LIES IN WAIT. A while into the ride he picks a trunk ahead of the
// skier and beside his line — never on it — and stands behind it, the tree
// between them, before the skier can have seen him. When the skier is a
// couple of seconds from passing he BREAKS COVER and runs at him, leading
// him the way a dog leads a hare.
//
// HE CATCHES HIM ONCE. On a hunt (`hunt`) he runs at whatever speed it
// takes and takes him: the skier is thrown (the `maul` crash cause), the
// beast stands over him, then walks back into the woods, and the reset
// stands the skier at the TOP OF THE SLOPE (`top`). Every sighting after
// that is a CHASE: the same ambush, the same burst out of the trees, but
// slower than the skier and pulled up short of him, roaring.
//
// Deterministic: every draw is off his own stream (`GRIMBEAR_SALT`), never
// `state.rng`, and a run without him draws nothing at all.

import { createRng } from "@niclaslindstedt/oss-game-framework/core/prng";
import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { GRIMBEAR } from "./defs/grimbear.ts";
import { TUNING } from "./defs/tuning.ts";
import { throwRider } from "./crash.ts";
import { treesNear } from "./upright-grid.ts";
import type { GrimbearPhase, GrimbearState } from "./grimbear-state.ts";
import type { GameEvent, GameState } from "./state.ts";

const K = GRIMBEAR;
const dt = TUNING.dt;

/** His stream's salt off the run's seed — no other stream shares it. */
const GRIMBEAR_SALT = 0x6b3a91c5;

/** Whether a run is dealt the beast that CATCHES its skier once (`hunt`),
 * or only one that chases him and comes up short (`roam` — a run started
 * again after he has caught him). */
export type GrimbearAsk = "hunt" | "roam";

/** The beast a free ride is dealt: hidden, his first wait dealt. */
export function freshGrimbear(seed: number, ask: GrimbearAsk): GrimbearState {
  const rng = createRng((seed ^ GRIMBEAR_SALT) >>> 0);
  return {
    rng,
    hunt: ask === "hunt",
    phase: "away",
    x: 0,
    z: 0,
    heading: 0,
    speed: 0,
    stride: 0,
    t: 0,
    wait: rng.range(K.firstAfter[0], K.firstAfter[1]),
    tree: -1,
    top: false,
    sightings: 0,
  };
}

/** Whether the skier is out on the snow on his own skis — the only skier
 * the beast waits for or runs at: not thrown, not on a lift, a machine, a
 * tunnel's wind or a rail, nor hung under a paramotor's wing. */
function skiing(state: GameState): boolean {
  const c = state.skier;
  if (c.thrown || c.lift || c.tunnel || c.jib) return false;
  if (state.heli?.rider) return false;
  if (state.sled?.mode === "ridden") return false;
  if (state.para && state.para.mode !== "dropped") return false;
  return true;
}

function enter(b: GrimbearState, phase: GrimbearPhase): void {
  b.phase = phase;
  b.t = 0;
}

/** Hide him away until his next sighting. */
function vanish(b: GrimbearState): void {
  enter(b, "away");
  b.speed = 0;
  b.tree = -1;
  b.wait = b.rng.range(K.againAfter[0], K.againAfter[1]);
}

const near: number[] = [];

/** THE AMBUSH: a trunk ahead of the skier and beside his line, and the spot
 * behind it. False where there is none — above the trees, on a crawl. */
function lieInWait(state: GameState, b: GrimbearState): boolean {
  const c = state.skier;
  const v = hypot(c.vx, c.vz);
  if (v < K.minSpeed) return false;
  const fx = c.vx / v;
  const fz = c.vz / v;
  const trees = state.level.trees;
  let best = -1;
  let score = Infinity;
  for (let d = K.ahead[0]; d <= K.ahead[1]; d += K.search) {
    treesNear(state.level, c.x + fx * d, c.z + fz * d, K.search, near);
    for (const i of near) {
      const t = trees[i];
      const along = (t.x - c.x) * fx + (t.z - c.z) * fz;
      const side = Math.abs((t.x - c.x) * fz - (t.z - c.z) * fx);
      if (along < K.ahead[0] || along > K.ahead[1]) continue;
      if (side < K.lateral[0] || side > K.lateral[1]) continue;
      // The trunk most nearly where he likes it, the first of two alike.
      const s = Math.abs(side - K.aim) + Math.abs(along - (K.ahead[0] + K.ahead[1]) / 2) * 0.1;
      if (s < score) {
        score = s;
        best = i;
      }
    }
  }
  if (best < 0) return false;
  const t = trees[best];
  const dx = t.x - c.x;
  const dz = t.z - c.z;
  const d = Math.max(0.01, hypot(dx, dz));
  const back = t.radius + K.hide;
  b.x = t.x + (dx / d) * back;
  b.z = t.z + (dz / d) * back;
  b.heading = Math.atan2(-dx, -dz);
  b.tree = best;
  b.speed = 0;
  enter(b, "lurk");
  return true;
}

/** Turn him toward `bearing` at his turning rate and run him at `speed`,
 * reached at his acceleration. */
function runToward(b: GrimbearState, bearing: number, speed: number): void {
  b.heading += clamp(angleDiff(b.heading, bearing), -K.turn * dt, K.turn * dt);
  b.speed += clamp(speed - b.speed, -K.accel * dt, K.accel * dt);
  move(b);
}

function move(b: GrimbearState): void {
  const step = b.speed * dt;
  b.x += Math.sin(b.heading) * step;
  b.z += Math.cos(b.heading) * step;
  b.stride += step;
}

/** Back the way he came: away from the skier, toward his trunk and on past
 * it, or straight on where he hid behind none. */
function homeward(state: GameState, b: GrimbearState): number {
  if (b.tree >= 0) {
    const t = state.level.trees[b.tree];
    const dx = t.x - b.x;
    const dz = t.z - b.z;
    if (hypot(dx, dz) > 2) return Math.atan2(dx, dz);
  }
  const c = state.skier;
  return Math.atan2(b.x - c.x, b.z - c.z);
}

/** One step of the beast, after the skier's own. */
export function stepGrimbear(state: GameState, events: GameEvent[]): void {
  const b = state.grimbear;
  if (!b) return;
  b.t += dt;
  const c = state.skier;
  const dx = c.x - b.x;
  const dz = c.z - b.z;
  const dist = hypot(dx, dz);
  const v = hypot(c.vx, c.vz);
  switch (b.phase) {
    case "away": {
      if (state.phase !== "racing" || !skiing(state)) return;
      b.wait -= dt;
      if (b.wait > 0) return;
      if (!lieInWait(state, b)) b.wait = K.retry;
      return;
    }
    case "lurk": {
      // Turned to watch the skier come, behind his trunk.
      b.heading = Math.atan2(dx, dz);
      const ahead = v > 0.5 ? -(dx * c.vx + dz * c.vz) / v : 0;
      if (!skiing(state) || dist > K.giveUp || ahead < -K.passed) {
        vanish(b);
        b.wait = K.retry * 8;
        return;
      }
      const soon = b.hunt ? K.trigger.hunt : K.trigger.chase;
      const close = b.hunt ? K.near.hunt : K.near.chase;
      if (dist < close || (v > 0.5 && ahead / v < soon)) {
        enter(b, "run");
        b.sightings += 1;
        events.push({ kind: "grimbear", t: state.t, phase: "burst", x: b.x, z: b.z });
      }
      return;
    }
    case "run": {
      if (!skiing(state) || dist > K.giveUp) {
        enter(b, "leave");
        return;
      }
      if (b.hunt) {
        // He LEADS the skier: where he will be by the time the beast gets
        // there, a few seconds out at most.
        const pace = Math.max(K.sprint, v * K.outrun);
        const lead = Math.min(K.lead, dist / pace);
        runToward(b, Math.atan2(dx + c.vx * lead, dz + c.vz * lead), pace);
        if (hypot(c.x - b.x, c.z - b.z) <= K.reach) maul(state, b, events);
        else if (b.t > K.huntFor) enter(b, "leave");
        return;
      }
      // ...and on a chase he runs after him, at a point behind him.
      const back = v > 0.5 ? K.short / v : 0;
      runToward(b, Math.atan2(dx - c.vx * back, dz - c.vz * back), Math.min(K.sprint, v * K.share));
      if (b.t > K.chaseFor || hypot(c.x - b.x, c.z - b.z) < K.short) {
        enter(b, "halt");
        events.push({ kind: "grimbear", t: state.t, phase: "halt", x: b.x, z: b.z });
      }
      return;
    }
    case "maul": {
      // Over the body where it lies.
      const at = c.thrown;
      if (at) {
        const ax = at.x - b.x;
        const az = at.z - b.z;
        const d = hypot(ax, az);
        b.heading = Math.atan2(ax, az);
        // He runs on into the tackle and pulls up over him, and follows
        // the body where it slides.
        const want = d > 0.9 ? Math.min(K.sprint, d * 2) : 0;
        b.speed = Math.min(
          d / dt,
          b.speed + clamp(want - b.speed, -K.accel * 2 * dt, K.accel * dt),
        );
        move(b);
      }
      if (b.t > K.maulFor) enter(b, "leave");
      return;
    }
    case "halt": {
      b.speed = Math.max(0, b.speed - K.accel * 1.5 * dt);
      move(b);
      if (b.speed <= 0) b.heading = Math.atan2(dx, dz);
      if (b.t > K.haltFor) enter(b, "leave");
      return;
    }
    case "leave": {
      runToward(b, homeward(state, b), K.walk);
      if (b.t > K.leaveFor || dist > K.gone) {
        events.push({ kind: "grimbear", t: state.t, phase: "gone", x: b.x, z: b.z });
        vanish(b);
      }
      return;
    }
  }
}

/** THE CATCH: the skier taken and thrown down, once a run. */
function maul(state: GameState, b: GrimbearState, events: GameEvent[]): void {
  const c = state.skier;
  const fx = Math.sin(b.heading) * b.speed * K.shove;
  const fz = Math.cos(b.heading) * b.speed * K.shove;
  throwRider(state, "maul", { x: c.vx * K.keep + fx, y: 0, z: c.vz * K.keep + fz }, events);
  b.hunt = false;
  b.top = true;
  enter(b, "maul");
  events.push({ kind: "grimbear", t: state.t, phase: "maul", x: b.x, z: b.z });
}
