// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BUZZ — the afterski's beer in the skier (`SkierState.buzz`, 0 sober
// to 1; `afterski.ts` pours it) and everything it does to him, an arcade
// dial argued against the feel (`BUZZ`):
//
//   * THE HANDS GO LATE AND WRONG (`drunkInput`): the edge and the lean he
//     asks for reach the skis through a lag that grows with the buzz; the
//     edge goes on harder than asked and then softer, swinging between the
//     two, so a turn is over-cooked one moment and runs wide the next; and
//     a slow pull to one side and back he never asked for, so he does not
//     ride straight. The lean wanders fore and aft, the tuck comes and goes.
//     Every wobble is a sine of the run's clock under a phase dealt off a
//     hash of the run's seed — never the stream — so a buzzed run replays.
//   * HE FALLS SOONER (`buzzLimit`, read by `crash.ts`'s `crashLimit`):
//     every threshold that throws him is blended toward `BUZZ.crash`'s,
//     well under a club skier's, by the buzz.
//   * NO RESET (`fetchesSkis`, `getUp`, `stepFetch`): thrown on a free ride
//     with the buzz in him, he is not stood back on the piste. He lies, he
//     GETS UP where he lies, and WALKS in his boots to each ski the fall
//     threw off (`lone-skis.ts`: they slide on until they stop), picks it
//     up, and once he has both steps back into them and skis on. The
//     player walks him himself or, his hands off, the walk goes on by
//     itself; the reset press is still the way out of it.
//   * HE SOBERS UP (`soberUp`): `BUZZ.decay` a second, outside the lodge.
//
// At a buzz of 0 nothing here is read — `run.ts` asks only past it — so a
// sober run, every rival's and the whole sim's, is the run it always was.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { hash2 } from "@niclaslindstedt/oss-game-framework/core/noise";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { standSkier } from "./course.ts";
import { BUZZ } from "./defs/afterski.ts";
import { TUNING } from "./defs/tuning.ts";
import { slideSkis } from "./lone-skis.ts";
import { solidsNear, solidsOf } from "./posts.ts";
import { depthUnder, packedUnder } from "./snow.ts";
import type { CrashLimit } from "./crash.ts";
import type { GameEvent, GameState, SkierInput, SkierState, Thrown } from "./state.ts";

const dt = TUNING.dt;
const F = BUZZ.fetch;
const TAU = 2 * Math.PI;
/** The hash's own salt: no other draw reads this stream. */
const SALT = 0xb0e2;

/** The buzz in a skier, 0 for one with none. */
export function buzzOf(c: SkierState): number {
  return c.buzz ?? 0;
}

/** SOBERING UP: one step's worth off the buzz. */
export function soberUp(c: SkierState): void {
  c.buzz = Math.max(0, buzzOf(c) - BUZZ.decay * dt);
}

/** A threshold the crash reads, blended toward the drunk's by the buzz —
 * `limit` itself, untouched, at none. */
export function buzzLimit(c: SkierState, key: CrashLimit, limit: number): number {
  const b = buzzOf(c);
  return b > 0 ? limit + (BUZZ.crash[key] - limit) * b : limit;
}

/** The run's own phase for wobble `k`, rad, off a hash of its seed. */
function phase(seed: number, k: number): number {
  return TAU * hash2(k, 7, (seed ^ SALT) | 0);
}

const wave = (seed: number, t: number, period: number, k: number): number =>
  Math.sin((TAU * t) / period + phase(seed, k));

const DRUNK: SkierInput = { steer: 0, tuck: 0, brake: 0, lean: 0, reset: false };

/** THE INPUT AS IT REACHES HIS SKIS through the buzz: `input` late, over-
 * and under-steered, pulled off straight, its lean wandering and its tuck
 * coming and going. Returns a scratch object the next call reuses. */
export function drunkInput(run: GameState, input: SkierInput): SkierInput {
  const c = run.skier;
  const b = buzzOf(c);
  const w = (c.wobble ??= { steer: input.steer, lean: input.lean });
  const k = 1 - Math.exp(-dt / (BUZZ.lagSober + BUZZ.lag * b));
  w.steer += (input.steer - w.steer) * k;
  w.lean += (input.lean - w.lean) * k;
  const t = run.t;
  const s = run.seed;
  const gain = 1 + BUZZ.gain * b * wave(s, t, BUZZ.swing, 0);
  const drift =
    b *
    (BUZZ.drift[0] * wave(s, t, BUZZ.driftAt[0], 1) +
      BUZZ.drift[1] * wave(s, t, BUZZ.driftAt[1], 2));
  Object.assign(DRUNK, input);
  DRUNK.steer = clamp(w.steer * gain + drift, -1, 1);
  DRUNK.lean = clamp(w.lean + BUZZ.lean * b * wave(s, t, BUZZ.leanAt, 3), -1, 1);
  DRUNK.tuck = clamp(
    input.tuck * (1 - BUZZ.tuck * b * (0.5 + 0.5 * wave(s, t, BUZZ.tuckAt, 4))),
    0,
    1,
  );
  return DRUNK;
}

/** Whether a fall stands him back up where he lies to fetch his skis
 * rather than resetting him: the player, buzzed past `fetchFrom`, on a run
 * that opens the lodges and counts no course. */
export function fetchesSkis(run: GameState): boolean {
  return !!run.rules.afterski && !run.rules.course && buzzOf(run.skier) >= BUZZ.fetchFrom;
}

/** His body ON FOOT at (x, z) facing `heading`, walking at (vx, vz) m/s:
 * stood in his boots on the snow, nothing on his legs or his edges. */
function onFoot(run: GameState, x: number, z: number, heading: number, vx: number, vz: number) {
  const c = run.skier;
  const level = run.level;
  c.x = x;
  c.z = z;
  c.y = level.groundAt(x, z) + c.spec.cogHeight;
  c.vx = vx;
  c.vy = 0;
  c.vz = vz;
  c.q = fromEuler(heading, 0, 0);
  c.wx = c.wy = c.wz = 0;
  c.heading = heading;
  c.pitch = 0;
  c.roll = 0;
  c.incline = 0;
  c.speed = hypot(vx, vz);
  c.way = c.speed;
  c.airborne = false;
  c.tuck = c.brake = c.steer = c.lean = c.edge = c.skid = c.carve = 0;
  c.crouch = c.jumpLoad = c.drive = c.chatter = c.sideSlip = c.skiAngle = 0;
  c.overFor = c.stuckFor = c.trench = c.trenchFor = c.boggedFor = c.rolledFor = 0;
  c.bodyHit = 0;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  c.packed = packedUnder(level.packedAt(x, z), run.fresh);
}

/** The point along a lone ski its binding is at, in plan. */
function bindingOf(ski: { ends: number[]; mount: number }): { x: number; z: number } {
  const P = ski.ends;
  return { x: P[3] + (P[0] - P[3]) * ski.mount, z: P[5] + (P[2] - P[5]) * ski.mount };
}

/** The nearest ski still lying, by index, or −1. */
function nearestSki(run: GameState): number {
  const f = run.skier.fetch!;
  let best = -1;
  let far = Infinity;
  f.skis.forEach((ski, i) => {
    if (f.carried[i]) return;
    const at = bindingOf(ski);
    const d = hypot(at.x - run.skier.x, at.z - run.skier.z);
    if (d < far) {
      far = d;
      best = i;
    }
  });
  return best;
}

/** HE GETS UP where his body lies — the fall's skis left where they slid
 * to — to go and fetch them (`stepFetch`). */
export function getUp(run: GameState, off: Thrown, events: GameEvent[]): void {
  const c = run.skier;
  for (const ski of off.skis) ski.held = 0;
  c.thrown = null;
  c.fetch = {
    phase: "rise",
    phaseT: 0,
    t: 0,
    skis: off.skis,
    carried: [false, false],
    target: -1,
    walked: 0,
    hands: Infinity,
  };
  const target = nearestSki(run);
  const at = target >= 0 ? bindingOf(off.skis[target]) : { x: off.x, z: off.z + 1 };
  onFoot(run, off.x, off.z, Math.atan2(at.x - off.x, at.z - off.z), 0, 0);
  events.push({ kind: "fetch", t: run.t, phase: "up", skis: 0 });
}

const near: number[] = [];

/** ONE STEP ON FOOT, fetching his skis: up off the snow, the walk to the
 * nearest ski still lying — his own or, his hands off for `hands` s, by
 * itself — bending for it, and once both are in hand, back into the
 * bindings and away. */
export function stepFetch(run: GameState, input: SkierInput, events: GameEvent[]): void {
  const c = run.skier;
  const f = c.fetch!;
  const b = buzzOf(c);
  soberUp(c);
  f.t += dt;
  f.phaseT += dt;
  slideSkis(run, f.skis, f.carried);
  const own = Math.abs(input.steer) > 0.15 || input.tuck > 0.15 || input.brake > 0.15;
  f.hands = own ? 0 : f.hands + dt;
  let heading = c.heading;
  let vx = 0;
  let vz = 0;
  if (f.phase === "rise") {
    if (f.phaseT >= F.rise) next(f, "walk");
  } else if (f.phase === "walk") {
    if (f.target < 0 || f.carried[f.target]) f.target = nearestSki(run);
    if (f.target < 0) next(f, "clip");
    else {
      const at = bindingOf(f.skis[f.target]);
      const dx = at.x - c.x;
      const dz = at.z - c.z;
      if (hypot(dx, dz) <= F.reach) next(f, "pick");
      else {
        let go: number;
        if (f.hands < F.hands) {
          heading += input.steer * F.turn * dt;
          go = input.brake > 0.15 ? 0 : input.tuck * F.jog;
        } else {
          const turn = angleDiff(heading, Math.atan2(dx, dz));
          heading += clamp(turn, -F.turn * dt, F.turn * dt);
          go = Math.abs(turn) < F.facing ? 1 : 0;
        }
        // THE WEAVE in his walk, and his pace: slower up a rise and in
        // loose snow.
        const way = heading + F.stagger * b * wave(run.seed, run.t, F.staggerAt, 5);
        const fx = Math.sin(way);
        const fz = Math.cos(way);
        const level = run.level;
        const rise = (level.groundAt(c.x + fx, c.z + fz) - level.groundAt(c.x - fx, c.z - fz)) / 2;
        const loose = 1 - packedUnder(level.packedAt(c.x, c.z), run.fresh);
        const deep = Math.min(1, depthUnder(run.snowDepth, run.fresh));
        const pace =
          F.walk *
          clamp(
            1 - F.climb * Math.max(0, rise) - F.descend * Math.min(0, rise),
            F.slowest,
            F.fastest,
          ) *
          (1 - F.loose * loose * deep);
        vx = fx * pace * go;
        vz = fz * pace * go;
        f.walked += pace * go * dt;
      }
    }
  } else if (f.phase === "pick") {
    if (f.phaseT >= F.pick) {
      f.carried[f.target] = true;
      events.push({
        kind: "fetch",
        t: run.t,
        phase: "ski",
        skis: f.carried.filter(Boolean).length,
      });
      f.target = nearestSki(run);
      next(f, f.target >= 0 ? "walk" : "clip");
    }
  } else if (f.phaseT >= F.clip) {
    // BACK IN THE BINDINGS, the pair laid across the fall line the way he
    // faces — a skier steps in standing across the slope — and away.
    const level = run.level;
    const gx = level.groundAt(c.x + 1, c.z) - level.groundAt(c.x - 1, c.z);
    const gz = level.groundAt(c.x, c.z + 1) - level.groundAt(c.x, c.z - 1);
    const down = Math.atan2(-gx, -gz);
    const across = angleDiff(down, heading) >= 0 ? down + Math.PI / 2 : down - Math.PI / 2;
    standSkier(run, c.x, c.z, hypot(gx, gz) > 0.02 ? across : heading);
    events.push({ kind: "fetch", t: run.t, phase: "in", skis: 2 });
    return;
  }
  // The trunks, the posts and the walls: walked round, never through.
  const at = clearOfSolids(run, c.x + vx * dt, c.z + vz * dt);
  const lo = TUNING.bounds.margin;
  const hi = run.level.size - lo;
  onFoot(run, clamp(at.x, lo, hi), clamp(at.z, lo, hi), heading, vx, vz);
  carry(run);
}

function next(f: NonNullable<SkierState["fetch"]>, phase: "rise" | "walk" | "pick" | "clip") {
  f.phase = phase;
  f.phaseT = 0;
}

/** His body's radius against a trunk or a wall, m. */
const BODY_R = 0.3;
const clear = { x: 0, z: 0 };

/** (x, z) pushed out of every trunk, post and wall it stands inside. */
function clearOfSolids(run: GameState, x: number, z: number): { x: number; z: number } {
  const list = solidsOf(run.level);
  clear.x = x;
  clear.z = z;
  for (const i of solidsNear(run.level, x, z, 3, near)) {
    const u = list[i];
    const dx = clear.x - u.x;
    const dz = clear.z - u.z;
    const d = hypot(dx, dz);
    const r = u.radius + BODY_R;
    if (d >= r || d < 1e-6) continue;
    clear.x = u.x + (dx / d) * r;
    clear.z = u.z + (dz / d) * r;
  }
  return clear;
}

/** THE SKIS HE HAS PICKED UP, over his shoulder: each laid along his
 * heading, tips up and forward, either side of his neck — the lone ski's
 * own ends, so the drawing lays them where they ride. */
function carry(run: GameState): void {
  const c = run.skier;
  const f = c.fetch;
  if (!f) return;
  const fx = Math.sin(c.heading);
  const fz = Math.cos(c.heading);
  const rx = fz;
  const rz = -fx;
  f.skis.forEach((ski, i) => {
    if (!f.carried[i]) return;
    const side = i === 0 ? -1 : 1;
    const len = c.spec.length;
    const mx = c.x + rx * side * 0.14 - fx * 0.05;
    const mz = c.z + rz * side * 0.14 - fz * 0.05;
    const my = c.y + 0.45;
    const fore = len * (1 - ski.mount);
    const aft = len * ski.mount;
    const up = 0.55;
    const ax = fx * Math.cos(up);
    const ay = Math.sin(up);
    const az = fz * Math.cos(up);
    const P = ski.ends;
    P[0] = mx + ax * fore;
    P[1] = my + ay * fore;
    P[2] = mz + az * fore;
    P[3] = mx - ax * aft;
    P[4] = my - ay * aft;
    P[5] = mz - az * aft;
    for (let j = 0; j < 6; j++) ski.last[j] = P[j];
    ski.up[0] = rx * side;
    ski.up[1] = 0;
    ski.up[2] = rz * side;
    ski.touching = 0;
    ski.spin = 0;
  });
}
