// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JIBS — a RAIL or a BOX ridden (R38's rail sections, `Level.jibs`).
// Nothing else in the engine slides on anything but snow, and a rail is a
// LINE, not a surface: the stations under the skis (`suspension.ts`) would
// find the snow either side of a 8 cm pipe and nothing on it. So a jib is
// ridden as the lift is (`lift-ride.ts`): while he is on one the step is
// this module's, and the skier is a bead on a wire.
//
// GETTING ON. A skier comes at a jib's near end along it, his feet within
// reach of its top across (`JIBS.capture`) and over it or a little under
// it (the ollie onto it is the game's), moving down it — and he is ON: put
// on its line, his speed along it kept, his skis turned to the nearest
// quarter off its line (along it, a 50-50; across it, a SLIDE). Spun onto
// it out of the air, the turn the strokes had made is the trick's ON.
//
// ON IT. He slides down its legs as a body on an incline: g along the leg,
// Coulomb friction of the ski on its top (`JIBS.friction`) and the air's
// drag. The edge TAPPED over swaps him a quarter turn (a 50-50 to a slide
// and back, `JIBS.rate`), the lean held hard PRESSES the skis onto one end.
// Slower than `stall` he slides off its side.
//
// GETTING OFF. At its far end he leaves it on his speed along its last
// leg — and a stride before it he turns OUT: from a slide back to the
// nearest way down the hill (or on round, the way the edge pushes); off a
// 50-50 with the edge held over, a half turn. The jump let go on it pops
// him off it where he is. The skis come off it straight, so the snow takes
// a skier who can ride away. Every jib ridden is FILED (`JibRecord`) for
// the judges.
//
// Nothing here is random and nothing reads a clock.

import { angleDiff, clamp, hypot } from "@niclaslindstedt/oss-game-framework/core/math";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { JIBS } from "./defs/slopestyle.ts";
import { TUNING } from "./defs/tuning.ts";
import { derive } from "./skier.ts";
import type { Jib } from "../mapgen/types.ts";
import type { GameEvent, GameState, JibRide, SkierInput } from "./state.ts";

const QUARTER = Math.PI / 2;

/** Leg `i` of `jib`: its start, its plan direction and length, and its
 * fall over that, m. */
type Leg = { x: number; y: number; z: number; dx: number; dz: number; plan: number; fall: number };

const legsOf = new WeakMap<Jib, Leg[]>();

function legs(jib: Jib): Leg[] {
  let had = legsOf.get(jib);
  if (had) return had;
  had = [];
  for (let i = 0; i + 1 < jib.points.length; i++) {
    const a = jib.points[i];
    const b = jib.points[i + 1];
    const plan = hypot(b.x - a.x, b.z - a.z) || 1e-6;
    had.push({
      x: a.x,
      y: a.y,
      z: a.z,
      dx: (b.x - a.x) / plan,
      dz: (b.z - a.z) / plan,
      plan,
      fall: a.y - b.y,
    });
  }
  legsOf.set(jib, had);
  return had;
}

/** A jib's whole plan length, m. */
export function jibLength(jib: Jib): number {
  return legs(jib).reduce((s, l) => s + l.plan, 0);
}

/** Where on `jib` a point `u` m of plan along it is: its leg, the point
 * and its top's height. */
export function jibAt(jib: Jib, u: number): { leg: Leg; x: number; y: number; z: number } {
  const ls = legs(jib);
  let left = clamp(u, 0, jibLength(jib));
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    if (left <= l.plan || i === ls.length - 1) {
      const k = left / l.plan;
      return { leg: l, x: l.x + l.dx * left, y: l.y - l.fall * k, z: l.z + l.dz * left };
    }
    left -= l.plan;
  }
  const l = ls[0];
  return { leg: l, x: l.x, y: l.y, z: l.z };
}

/** A turn held to (−π, π]. */
function wrap(a: number): number {
  let r = a % (2 * Math.PI);
  if (r > Math.PI) r -= 2 * Math.PI;
  if (r <= -Math.PI) r += 2 * Math.PI;
  return r;
}

/** THE JIB'S STEP: on, along or off a jib. True while the step is the
 * jib's — the skier is on one — and the snow's step must not run. */
export function stepJib(run: GameState, input: SkierInput, events: GameEvent[]): boolean {
  const jibs = run.level.jibs;
  const c = run.skier;
  if (!jibs || c.thrown || c.lift || run.phase !== "racing") {
    if (c.jib) c.jib = null;
    return false;
  }
  if (!c.jib) {
    if (!mount(run, jibs, events)) return false;
  } else ride(run, jibs, input, events);
  return c.jib !== null && c.jib !== undefined;
}

/** Onto the first jib he is at, if any. */
function mount(run: GameState, jibs: readonly Jib[], events: GameEvent[]): boolean {
  const c = run.skier;
  const feet = c.y - c.spec.cogHeight;
  for (let i = 0; i < jibs.length; i++) {
    const jib = jibs[i];
    const first = legs(jib)[0];
    const rx = c.x - first.x;
    const rz = c.z - first.z;
    const u = rx * first.dx + rz * first.dz;
    if (u < -0.3 || u > JIBS.window) continue;
    const across = rx * first.dz - rz * first.dx;
    if (Math.abs(across) > jib.width / 2 + JIBS.capture[jib.kind]) continue;
    const at = jibAt(jib, Math.max(0, u));
    const over = feet - at.y;
    if (over < -JIBS.below || over > JIBS.above) continue;
    const along = c.vx * first.dx + c.vz * first.dz;
    if (along < 1 || c.vy > 1) continue;
    // ON IT: the skis to the nearest quarter off its line, and the turn
    // the strokes had made in the air, if he came onto it flying.
    const lineHeading = Math.atan2(first.dx, first.dz);
    const facing = c.heading;
    const off = wrap(angleDiff(lineHeading, facing));
    const target = Math.round(off / QUARTER) * QUARTER;
    const k = run.tricks;
    const spun = c.airborne && k.inAir ? Math.round(Math.abs(k.yaw) / QUARTER) * 90 : 0;
    const ride: JibRide = {
      index: i,
      u: Math.max(0, u),
      // His speed along it is what he carried along it.
      v: Math.max(1, along),
      yaw: off,
      target,
      on: spun,
      swaps: 0,
      stances: [stanceOf(target)],
      press: null,
      pressed: 0,
      tapped: false,
      loaded: false,
      out: null,
      start: target,
    };
    c.jib = ride;
    // Whatever the strokes still owed of a flight onto it dies with it.
    k.spinGoal = 0;
    k.flipGoal = 0;
    k.spinDone = 0;
    k.flipDone = 0;
    events.push({ kind: "jib", t: run.t, id: jib.id, jib: jib.kind, phase: "on", whole: false });
    hold(run, jib, ride, 0);
    return true;
  }
  return false;
}

function stanceOf(yaw: number): "fifty" | "slide" {
  return Math.abs(Math.cos(yaw)) > 0.5 ? "fifty" : "slide";
}

/** One step along it. */
function ride(run: GameState, jibs: readonly Jib[], input: SkierInput, events: GameEvent[]): void {
  const c = run.skier;
  const r = c.jib as JibRide;
  const jib = jibs[r.index];
  if (!jib) {
    c.jib = null;
    return;
  }
  const dt = TUNING.dt;
  const length = jibLength(jib);
  const at = jibAt(jib, r.u);
  const slope = Math.atan2(at.leg.fall, at.leg.plan);
  // THE SLIDE: g down the leg, the friction of its top, the air.
  const mu = JIBS.friction[jib.kind];
  const drag = (0.5 * TUNING.airDensity * JIBS.drag) / JIBS.mass;
  const a = TUNING.g * (Math.sin(slope) - mu * Math.cos(slope)) - drag * r.v * r.v;
  r.v += a * dt;
  r.u += r.v * Math.cos(slope) * dt;
  // THE SWAP: the edge tapped over turns him a quarter on it.
  const over = Math.abs(input.steer) >= JIBS.tap;
  if (over && !r.tapped && r.out === null) {
    r.target += Math.sign(input.steer) * QUARTER;
    r.swaps += 1;
    const now = stanceOf(r.target);
    if (now !== r.stances[r.stances.length - 1]) r.stances.push(now);
  }
  r.tapped = over;
  // THE PRESS: the lean held hard, an end of the skis on it.
  const press = input.lean >= JIBS.press ? "tail" : input.lean <= -JIBS.press ? "nose" : null;
  if (press) {
    r.pressed += dt;
    if (!r.press) r.press = press;
  }
  // THE TURN OUT, a stride before the end: from a slide to the way down
  // the hill (on round the way the edge pushes, else back the near way);
  // off a 50-50 with the edge over, a half turn.
  const togo = (length - r.u) / Math.max(0.5, r.v);
  if (r.out === null && togo <= JIBS.outLead) {
    const push = Math.abs(input.steer) >= 0.3 ? Math.sign(input.steer) : 0;
    const sideways = stanceOf(r.target) === "slide";
    let to = r.target + push * Math.PI;
    if (sideways) {
      const back = r.target - QUARTER;
      const on = r.target + QUARTER;
      to =
        push !== 0
          ? r.target + push * QUARTER
          : Math.abs(wrap(back)) < Math.abs(wrap(on))
            ? back
            : on;
    }
    r.out = Math.round(Math.abs(to - r.target) / QUARTER) * 90;
    r.target = to;
  }
  // THE SKIS TURNED toward where they are going.
  const turn = r.target - r.yaw;
  r.yaw += clamp(turn, -JIBS.rate * dt, JIBS.rate * dt);
  const jumped = r.loaded && !input.jump;
  r.loaded = input.jump === true;
  if (r.u >= length || r.v < JIBS.stall || jumped) {
    leave(run, jib, r, jumped, events);
    return;
  }
  hold(run, jib, r, press === "nose" ? -1 : press === "tail" ? 1 : 0);
}

/** The skier where the ride has him: on its line, his skis at its turn. */
function hold(run: GameState, jib: Jib, r: JibRide, pressing: number): void {
  const c = run.skier;
  const at = jibAt(jib, r.u);
  const slope = Math.atan2(at.leg.fall, at.leg.plan);
  const heading = Math.atan2(at.leg.dx, at.leg.dz);
  c.x = at.x;
  c.z = at.z;
  c.y = at.y + c.spec.cogHeight;
  const horiz = r.v * Math.cos(slope);
  c.vx = at.leg.dx * horiz;
  c.vz = at.leg.dz * horiz;
  c.vy = -r.v * Math.sin(slope);
  c.q = fromEuler(
    heading + r.yaw,
    -slope * Math.cos(r.yaw) + pressing * 0.15,
    -slope * Math.sin(r.yaw),
  );
  c.wx = c.wy = c.wz = 0;
  c.airborne = false;
  c.airTime = 0;
  c.edge = 0;
  c.skid = 0;
  c.sideSlip = 0;
  c.carve = 0;
  c.bodyHit = 0;
  c.rolledFor = 0;
  c.switched = Math.cos(r.yaw) < -0.5;
  for (const contact of c.contacts) {
    contact.touching = false;
    contact.load = 0;
  }
  derive(c, run.level);
}

/** Off its end (or popped off, or slid off its side when too slow), and
 * the ride filed for the judges. */
function leave(run: GameState, jib: Jib, r: JibRide, popped: boolean, events: GameEvent[]): void {
  const c = run.skier;
  const length = jibLength(jib);
  const whole = r.u >= length - 0.05;
  hold(run, jib, { ...r, u: Math.min(r.u, length), yaw: r.target }, 0);
  if (popped) c.vy += JIBS.pop;
  // Too slow on it, he drops off its side onto the snow.
  if (!whole && !popped) {
    const leg = jibAt(jib, r.u).leg;
    c.vx += leg.dz * 0.8;
    c.vz -= leg.dx * 0.8;
  }
  c.jib = null;
  run.tricks.jibs.push({
    id: jib.id,
    section: jib.section,
    kind: jib.kind,
    on: r.on,
    off: r.out ?? 0,
    stances: r.stances.slice(),
    swaps: r.swaps,
    press: r.press,
    pressed: r.pressed,
    length: Math.min(r.u, length),
    whole,
    t: run.t,
  });
  events.push({ kind: "jib", t: run.t, id: jib.id, jib: jib.kind, phase: "off", whole });
  derive(c, run.level);
}
