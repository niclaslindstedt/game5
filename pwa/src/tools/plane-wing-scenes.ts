// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE LAB'S WINGS SHEET (`plane-scenes.ts` lists it): what a wing
// takes and when it is torn off (`engine/game/plane-wings.ts`), and whether a
// wreck burns (`defs/plane-wreck.ts`'s `wreckIgnites`) — a wingtip SCUFFED on
// the take-off roll and flown on, a wing torn off by a TRUNK, a wing dug in
// and torn off LANDING, the plane flying on with ONE WING after the other is
// pulled off past its ultimate load, the torn wing tumbling down and LYING on
// the snow, and a crash that does NOT catch fire beside one that does.

import {
  NEUTRAL_INPUT,
  airstripOf,
  planeAloft,
  type GameState,
  type PlaneControls,
  type Quat,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import type { Drive, Stage } from "./plane-scenes.ts";

const hands =
  (c: Partial<PlaneControls>): Drive =>
  () => ({
    ...NEUTRAL_INPUT,
    plane: { throttle: 0, pitch: 0, roll: 0, yaw: 0, flaps: 0, ...c },
  });
const still = hands({});

/** `v` (the engine's body frame) turned into the world by `q`. */
function turn(q: Quat, v: readonly [number, number, number]) {
  const [x, y, z] = v;
  const ix = q.w * x + q.y * z - q.z * y;
  const iy = q.w * y + q.z * x - q.x * z;
  const iz = q.w * z + q.x * y - q.y * x;
  const iw = -q.x * x - q.y * y - q.z * z;
  return {
    x: ix * q.w - iw * q.x - iy * q.z + iz * q.y,
    y: iy * q.w - iw * q.y - iz * q.x + ix * q.z,
    z: iz * q.w - iw * q.z - ix * q.y + iy * q.x,
  };
}

/** A lens off the plane's body point `at` (from its datum): planted `dist`
 * m off it on the bearing `bear` rad from the plane's heading, `up` m over
 * the point (and never under the snow). */
function onPoint(at: [number, number, number], dist: number, bear: number, up: number, fov = 45) {
  return (s: GameState): LensPose => {
    const p = s.plane!;
    const r = turn(p.q, at);
    const t = { x: p.x + r.x, y: p.y + r.y, z: p.z + r.z };
    const a = p.heading + bear;
    const ex = t.x + Math.sin(a) * dist;
    const ez = t.z + Math.cos(a) * dist;
    const ey = Math.max(s.level.groundAt(ex, ez) + 0.6, t.y + up);
    return { eye: { x: ex, y: ey, z: ez }, target: t, fov, roll: 0 };
  };
}

/** A lens on the torn wing of `side` where it lies (or flies), from `dist`
 * m off it on the world bearing `bear`, `up` m over it. */
function onWing(side: number, dist: number, bear: number, up: number, fov = 45) {
  return (s: GameState): LensPose => {
    const t = s.plane!.wings[side].torn ?? held.get(s)?.[side];
    const at = t ?? { x: s.plane!.x, y: s.plane!.y, z: s.plane!.z };
    const ex = at.x + Math.sin(bear) * dist;
    const ez = at.z + Math.cos(bear) * dist;
    const ey = Math.max(s.level.groundAt(ex, ez) + 0.6, at.y + up);
    return { eye: { x: ex, y: ey, z: ez }, target: { x: at.x, y: at.y, z: at.z }, fov, roll: 0 };
  };
}

/** The torn wings of a staged run, kept: the ride is begun again ten
 * seconds after a crash and takes its own with it. */
const held = new WeakMap<GameState, { x: number; y: number; z: number }[]>();
function keep(s: GameState): void {
  held.set(
    s,
    s.plane!.wings.map((w) => (w.torn ? { x: w.torn.x, y: w.torn.y, z: w.torn.z } : s.plane!)),
  );
}

/** A run stood up `ahead` m down its strip — the take-off hand on, as a
 * player flies it — with the plane put down as `at` asks. */
function staged(st: Stage, at: Partial<Parameters<typeof planeAloft>[1]>, ahead = 80): GameState {
  const s = st.fresh();
  const strip = airstripOf(st.level);
  const p = s.plane!;
  const h = strip ? strip.heading : p.heading;
  const x = (strip?.start.x ?? p.x) + Math.sin(h) * ahead;
  const z = (strip?.start.z ?? p.z) + Math.cos(h) * ahead;
  const y = st.level.groundAt(x, z) + (at.y ?? 0);
  planeAloft(s, { heading: h, speed: 30, ...at, x, z, y });
  return s;
}

/** Run on `drive` until the plane says `phase` on any step (a frame is
 * several steps, and an event lasts one), or `limit` s. */
function untilSaid(st: Stage, s: GameState, phase: string, limit: number, drive: Drive): void {
  let seen = false;
  const said = (q: GameState) => q.events.some((e) => e.kind === "plane" && e.phase === phase);
  const watch: Drive = (q) => {
    seen ||= said(q);
    return drive(q);
  };
  st.until(s, (q) => seen || said(q), limit, watch);
}

/** The body points the lenses look at: the right wingtip (the engine's −x),
 * the left, and the cabin. */
const TIP_R: [number, number, number] = [-7.9, 3, -0.5];
const TIP_L: [number, number, number] = [7.9, 3, -0.5];
const CABIN: [number, number, number] = [0, 1.6, 0];

export const WING_VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  // A WINGTIP SCUFFED on the take-off roll: the right wing dropped in the
  // run, its tip touching the snow, scraped and lifted again — flown on.
  "wing-scuff"(st) {
    const roll = hands({ throttle: 1, flaps: 0.5 });
    const s = staged(st, {
      y: 0.05,
      speed: 30,
      pitch: 0.05,
      roll: 0.25,
      power: 1,
      rates: { wx: 0, wy: 0, wz: -3 },
    });
    untilSaid(st, s, "scrape", 3, roll);
    st.run(s, 0.05, roll);
    st.shoot(s, "tip on the snow", onPoint(TIP_R, 7, -2.2, 0.6, 50));
    st.shoot(s, "scuffed, from behind", onPoint(CABIN, 22, Math.PI - 0.3, 3, 45));
    st.run(s, 1, roll);
    st.shoot(s, "lifted, rolling on", onPoint(CABIN, 24, Math.PI - 0.5, 3, 45));
    untilSaid(st, s, "liftoff", 8, roll);
    st.run(s, 1, roll);
    st.shoot(s, "flown off", onPoint(CABIN, 30, Math.PI - 0.6, 4, 45));
  },
  // A WING TORN OFF BY A TRUNK: flown level into the edge of the nearest
  // stand of trees, its left tip the first thing into a trunk.
  "wing-tree"(st) {
    const s = st.fresh();
    const p0 = s.plane!;
    const strip = airstripOf(st.level);
    const h = strip ? strip.heading : p0.heading;
    const x0 = p0.x + Math.sin(h) * 60;
    const z0 = p0.z + Math.cos(h) * 60;
    let best = 0;
    let near = Infinity;
    st.level.trees.forEach((t, i) => {
      const d = Math.hypot(t.x - x0, t.z - z0);
      if (t.height > 9 && d > 120 && d < near) {
        near = d;
        best = i;
      }
    });
    const t = st.level.trees[best];
    const a = Math.atan2(t.x - x0, t.z - z0);
    // The engine's +x (the left wing) on that heading.
    const lx = Math.cos(a);
    const lz = -Math.sin(a);
    const sx = t.x - Math.sin(a) * 90 - lx * 7;
    const sz = t.z - Math.cos(a) * 90 - lz * 7;
    const y = Math.max(t.y + 3.2, st.level.groundAt(sx, sz) + 3);
    planeAloft(s, { x: sx, z: sz, y, heading: a, speed: 42, pitch: 0, power: 0.7 });
    const fly = hands({ throttle: 0.7 });
    untilSaid(st, s, "tear", 8, fly);
    st.shoot(s, "trunk takes the wing", onPoint(TIP_L, 16, 2.7, 3, 55));
    st.run(s, 0.12, fly);
    st.shoot(s, "torn off", onPoint(CABIN, 26, 2.4, 4, 50));
    st.until(s, (q) => q.plane!.mode === "wreck", 6, fly);
    keep(s);
    st.run(s, 2.5, still);
    keep(s);
    st.shoot(s, "the wreck", onPoint(CABIN, 30, 2.6, 6, 50));
    st.run(s, 4, still);
    keep(s);
    st.shoot(s, "the wing on the snow", onWing(0, 12, a + 2.2, 4, 50));
  },
  // A WING TORN OFF LANDING: brought down fast in a bank, its right tip
  // dug in and torn off, and the rest cartwheeling after it.
  "wing-land"(st) {
    const bank = hands({ roll: 1 });
    const s = staged(st, {
      y: 6,
      speed: 45,
      pitch: -0.1,
      roll: 0.7,
      power: 0,
      rates: { wx: 0, wy: 0, wz: -1 },
    });
    untilSaid(st, s, "tear", 4, bank);
    const side = s.plane!.wings[1].torn ? 1 : 0;
    st.shoot(s, "tip dug in", onPoint(TIP_R, 12, -1.6, 2, 50));
    st.run(s, 0.2, bank);
    st.shoot(s, "torn off", onPoint(CABIN, 28, -1.9, 4, 50));
    st.until(s, (q) => q.plane!.mode === "wreck", 4, bank);
    keep(s);
    st.run(s, 6, still);
    keep(s);
    st.shoot(s, "the wing on the snow", onWing(side, 12, s.plane!.heading - 2, 4, 50));
  },
  // FLYING ON WITH ONE WING: pulled past its ultimate load in a rolling
  // pull, the right wing folds off; the plane rolls away after it and the
  // wing tumbles down on its own.
  "wing-one"(st) {
    const pull = hands({ throttle: 1, pitch: -1, roll: 1 });
    const s = staged(st, { y: 700, speed: 90, pitch: 0, power: 1, rates: { wx: 0, wy: 0, wz: 2 } });
    untilSaid(st, s, "tear", 4, pull);
    const side = s.plane!.wings[0].torn ? 0 : 1;
    st.run(s, 0.25, still);
    st.shoot(s, "folded off", onPoint(CABIN, 26, -2.6, 5, 50));
    st.run(s, 0.8, still);
    st.shoot(s, "one wing", onPoint(CABIN, 30, -2.4, 6, 50));
    st.shoot(s, "the wing tumbling", onWing(side, 22, s.plane!.heading + 1.5, 4, 50));
    st.run(s, 2, still);
    st.shoot(s, "rolling away", onPoint(CABIN, 40, -2, 10, 50));
  },
  // A CRASH THAT DOES NOT BURN beside one that does: slid in on its belly
  // at a landing's speed (the tanks hold) and flown nose first into the
  // snow at full power (a tank torn open onto the hot engine).
  "wing-fire"(st) {
    const cold = staged(st, {
      y: 3,
      speed: 30,
      pitch: 0.05,
      roll: 0.25,
      power: 0,
    });
    st.until(cold, (q) => q.plane!.mode === "wreck", 8, hands({ roll: 1, yaw: 1 }));
    st.run(cold, 3, still);
    st.shoot(cold, "cold — 3 s", onPoint(CABIN, 20, 2.3, 4, 45));
    st.run(cold, 5, still);
    st.shoot(cold, "cold — 8 s", onPoint(CABIN, 26, -2, 6, 45));
    const hot = staged(st, { y: 110, speed: 50, pitch: -1.1, power: 1 }, 60);
    st.until(hot, (q) => q.plane!.mode === "wreck", 10, hands({ throttle: 1 }));
    st.run(hot, 3, still);
    st.shoot(hot, "alight — 3 s", onPoint(CABIN, 28, 2.3, 5, 45));
    st.run(hot, 5, still);
    st.shoot(hot, "alight — 8 s", onPoint(CABIN, 34, -2, 8, 45));
  },
};

/** The wings sheet. */
export const WINGS_SHEET = [
  "wing-scuff",
  "wing-tree",
  "wing-land",
  "wing-one",
  "wing-fire",
] as const;
