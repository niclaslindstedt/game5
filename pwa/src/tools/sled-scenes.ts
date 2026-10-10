// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE LAB'S SCENES (`sled-harness.ts`): every moment the free
// ride's snowmobile has (`docs/snowmobile.md`), staged on the engine and
// photographed through the game's own renderer. A scene stands up its own
// run (`Stage.fresh`), so any one of them can be shot alone; it moves it on
// by stepping the engine on the rider's own controls (the tuck the
// throttle, the skid the brake, the edge the bars, the lean his weight, the
// jump pressed twice to step off) and stands the machine where a frame must
// be exact (`standSled`, a speed set along its nose). Nothing reads a wall
// clock, so a seed's sheet is the same sheet twice.

import {
  NEUTRAL_INPUT,
  rotate,
  SLED,
  treesNear,
  standSkier,
  sledWithin,
  standSled,
  startSled,
  type GameState,
  type Level,
  type SkierInput,
  type SkyOverride,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import type { CameraRung } from "../game/renderer-api.ts";
import type { Hideable } from "../game/benchmark-report.ts";
import type { Spot, Spots } from "./heli-spots.ts";

/** A lens for a frame: a rung of the game's own ladder, a pose planted for
 * it, or one worked out off the state at the moment it is shot. */
export type Lens = CameraRung | LensPose | ((state: GameState) => LensPose);

/** What drives a run on, step by step. */
export type Drive = (state: GameState) => SkierInput;

/** What a scene may ask of the page. */
export type Stage = {
  level: Level;
  spots: Spots;
  /** A free ride stood up on the map: on the snowmobile's boards at its
   * spot (`sled`), or with the skier on the start line and the machine
   * parked at the bottom. */
  fresh(sled: boolean): GameState;
  run(state: GameState, seconds: number, drive?: Drive): void;
  until(state: GameState, test: (s: GameState) => boolean, limit: number, drive?: Drive): boolean;
  once(state: GameState, input: SkierInput): void;
  camera(rung: CameraRung): void;
  shoot(state: GameState, label: string, lens?: Lens): void;
  sky(over: SkyOverride | null): Promise<void>;
  hide(names: readonly Hideable[]): void;
};

const still: Drive = () => NEUTRAL_INPUT;
const RUNGS = ["tips", "helmet", "chase", "far", "high"] as const;
const ride =
  (o: Partial<SkierInput>): Drive =>
  () => ({ ...NEUTRAL_INPUT, ...o });

/** THE MACHINE STOOD where a frame needs it, its rider on it: at (x, z),
 * its nose on `heading`, going `speed` m/s along it with its belt turning
 * at that speed. */
function place(state: GameState, at: { x: number; z: number }, heading: number, speed = 0): void {
  if (!state.sled?.rider) startSled(state, []);
  const s = state.sled!;
  standSled(state, s, at.x, at.z, heading);
  s.vx = Math.sin(heading) * speed;
  s.vz = Math.cos(heading) * speed;
  s.treadSpeed = speed;
  s.rpm = speed > 0 ? 6000 : SLED.idleRpm;
  s.t = 0;
}

/** A lens planted off the machine where it stands: `right` m to the
 * screen's right of its nose, `up` m over its snow, `back` m behind it,
 * looking at a point `ahead` m along its nose and `over` m up. */
function around(
  right: number,
  up: number,
  back: number,
  fov = 50,
  ahead = 0,
  over = 0.7,
): (s: GameState) => LensPose {
  return (state) => {
    const k = state.sled!;
    const h = k.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    // The screen's right of a machine facing (fx, fz) is the body's −x.
    const rx = -fz;
    const rz = fx;
    const ex = k.x + rx * right - fx * back;
    const ez = k.z + rz * right - fz * back;
    const ground = state.level.groundAt(k.x, k.z);
    const ey = Math.max(state.level.groundAt(ex, ez) + 0.4, ground + up);
    return {
      eye: { x: ex, y: ey, z: ez },
      target: { x: k.x + fx * ahead, y: ground + over, z: k.z + fz * ahead },
      fov,
      roll: 0,
    };
  };
}

/** A lens on the RIDER where he is — his thrown body once he is off it,
 * else his own place — planted as `around` plants one, along the
 * machine's heading: `right` m to the screen's right, `up` m over the
 * snow, `back` m behind him. */
function onRider(right: number, up: number, back: number, fov = 50): (s: GameState) => LensPose {
  return (state) => {
    const c = state.skier;
    const at = c.thrown ?? c;
    const h = state.sled!.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const ex = at.x - fz * right - fx * back;
    const ez = at.z + fx * right - fz * back;
    const ground = state.level.groundAt(at.x, at.z);
    const ey = Math.max(state.level.groundAt(ex, ez) + 0.4, ground + up);
    return {
      eye: { x: ex, y: ey, z: ez },
      target: { x: at.x, y: Math.max(at.y, ground + 0.3), z: at.z },
      fov,
      roll: 0,
    };
  };
}

/** A lens planted in the machine's own frame (x right, y up, z forward,
 * the origin at its centre of gravity): an eye and a point looked at,
 * both carried with it as it stands — a close look at its cockpit. */
function onMachine(
  eye: { x: number; y: number; z: number },
  at: { x: number; y: number; z: number },
  fov = 40,
): (s: GameState) => LensPose {
  return (state) => {
    const k = state.sled!;
    const e = rotate(k.q, eye);
    const t = rotate(k.q, at);
    return {
      eye: { x: k.x + e.x, y: k.y + e.y, z: k.z + e.z },
      target: { x: k.x + t.x, y: k.y + t.y, z: k.z + t.z },
      fov,
      roll: 0,
    };
  };
}

/** The bearing from one place to another. */
const bearing = (from: { x: number; z: number }, to: { x: number; z: number }): number =>
  Math.atan2(to.x - from.x, to.z - from.z);

/** Uphill from `at`: the steepest climb of eight spokes. */
function uphill(level: Level, at: Spot): number {
  let best = 0;
  let rise = -Infinity;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const y = level.groundAt(at.x + Math.sin(a) * 8, at.z + Math.cos(a) * 8);
    if (y > rise) {
      rise = y;
      best = a;
    }
  }
  return best;
}

const trunks: number[] = [];

/** Whether the line from `at` along `heading` is open for `reach` m: no
 * trunk within `room` m of it. */
function openLine(
  level: Level,
  at: { x: number; z: number },
  heading: number,
  reach: number,
  room = 5,
): boolean {
  for (let d = -10; d <= reach; d += 5) {
    const x = at.x + Math.sin(heading) * d;
    const z = at.z + Math.cos(heading) * d;
    if (x < 40 || z < 40 || x > level.size - 40 || z > level.size - 40) return false;
    if (treesNear(level, x, z, room, trunks).length > 0) return false;
  }
  return true;
}

/** The most open way across the meadow from it: the first of sixteen
 * bearings with no trunk along 90 m, or the meadow's own. */
function openWay(level: Level, at: Spot): number {
  for (let i = 0; i < 16; i++) {
    const h = (i / 16) * Math.PI * 2;
    if (openLine(level, behind(at, h, 30), h, 90, 7)) return h;
  }
  return 0;
}

/** A FACE A SLED CLIMBS: powder pitched 22–29° straight up for 70 m with no
 * trunk near the line — searched on a fixed grid, nearest the steep spot. */
function climbOf(level: Level, near: Spot): { at: Spot; heading: number } | null {
  let best: { at: Spot; heading: number; d: number } | null = null;
  for (let x = 60; x < level.size - 60; x += 24) {
    for (let z = 60; z < level.size - 60; z += 24) {
      if (level.packedAt(x, z) > 0.1) continue;
      const at = { x, y: level.groundAt(x, z), z };
      const h = uphill(level, at);
      const fx = Math.sin(h);
      const fz = Math.cos(h);
      let ok = true;
      for (let d = 0; d <= 70 && ok; d += 10) {
        const a = level.groundAt(x + fx * d, z + fz * d);
        const b = level.groundAt(x + fx * (d + 10), z + fz * (d + 10));
        const slope = (b - a) / 10;
        if (slope < 0.4 || slope > 0.55) ok = false;
      }
      if (!ok || !openLine(level, at, h, 70, 6)) continue;
      const d = Math.hypot(x - near.x, z - near.z);
      if (!best || d < best.d) best = { at, heading: h, d };
    }
  }
  return best;
}

/** A RUN AT A TRUNK: the nearest trunk to `near` with 26 m of open snow
 * leading up to it, and where that run starts. */
function trunkRun(
  level: Level,
  near: Spot,
): { from: { x: number; z: number }; heading: number } | null {
  const order = level.trees
    .map((t, i) => ({ i, d: Math.hypot(t.x - near.x, t.z - near.z) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 60);
  for (const { i } of order) {
    const t = level.trees[i];
    for (let k = 0; k < 16; k++) {
      const h = (k / 16) * Math.PI * 2;
      const from = { x: t.x - Math.sin(h) * 26, z: t.z - Math.cos(h) * 26 };
      let open = true;
      for (let d = 0; d <= 22 && open; d += 2) {
        const x = from.x + Math.sin(h) * d;
        const z = from.z + Math.cos(h) * d;
        if (treesNear(level, x, z, 3, trunks).length > 0) open = false;
      }
      if (open) return { from, heading: h };
    }
  }
  return null;
}

/** A stretch of open powder in front of `at` along `heading`, for a ride:
 * the point `back` m behind it to start from. */
function behind(at: Spot, heading: number, back: number): { x: number; z: number } {
  return { x: at.x - Math.sin(heading) * back, z: at.z - Math.cos(heading) * back };
}

export const VIEWS: Record<string, (st: Stage) => Promise<void> | void> = {
  // ── THE SPOT ───────────────────────────────────────────────────────────
  park(st) {
    const s = st.fresh(false);
    const k = s.sled!;
    standSkier(s, k.x + 40, k.z + 40, bearing({ x: k.x + 40, z: k.z + 40 }, k));
    st.run(s, 0.5, still);
    st.shoot(s, "quarter", around(3.2, 1.3, -3.4, 45, 0, 0.6));
    st.shoot(s, "side", around(5.2, 0.9, 0, 40, 0, 0.6));
    st.shoot(s, "rear", around(-2.6, 1.4, 4.4, 45, 0, 0.6));
    st.shoot(s, "far", around(14, 6, 18, 45, 0, 0.6));
  },
  call(st) {
    const s = st.fresh(false);
    const k = s.sled!;
    for (const d of [50, 25, 8]) {
      const from = {
        x: k.x + Math.sin(k.heading + 0.8) * d,
        z: k.z + Math.cos(k.heading + 0.8) * d,
      };
      standSkier(s, from.x, from.z, bearing(from, k));
      st.run(s, 0.3, still);
      st.shoot(s, `${d}m`, "chase");
    }
  },
  // ── BOARDING ───────────────────────────────────────────────────────────
  board(st) {
    const s = st.fresh(false);
    const k = s.sled!;
    const from = { x: k.x + Math.sin(k.heading + 1.2) * 9, z: k.z + Math.cos(k.heading + 1.2) * 9 };
    standSkier(s, from.x, from.z, bearing(from, k));
    st.run(s, 0.2, still);
    st.shoot(s, "riding-in", "chase");
    // Skated up to it, then the machine press beside it.
    st.until(s, sledWithin, 12, ride({ tuck: 0.4 }));
    st.until(s, sledWithin, 3, ride({ brake: 1 }));
    st.once(s, { ...NEUTRAL_INPUT, machine: true });
    st.run(s, 0.3, still);
    st.shoot(s, "aboard", "chase");
  },
  rider(st) {
    const s = st.fresh(true);
    st.run(s, 0.6, still);
    st.shoot(s, "side", around(3.4, 1.1, 0, 40, 0, 0.9));
    st.shoot(s, "front", around(0.6, 1.4, -3.8, 45, 0, 0.9));
    st.shoot(s, "quarter", around(-2.6, 1.6, 2.6, 45, 0, 0.9));
    st.shoot(s, "helmet", "helmet");
  },
  // ── ON THE GROOMER ─────────────────────────────────────────────────────
  groomer(st) {
    const s = st.fresh(true);
    st.camera("chase");
    st.run(s, 1.2, ride({ tuck: 1 }));
    st.shoot(s, "1s", "chase");
    st.run(s, 2.5, ride({ tuck: 1 }));
    st.shoot(s, "4s", "chase");
    st.shoot(s, "4s-side", around(6, 1.2, 0, 40, 1, 0.6));
    st.run(s, 1.5, ride({ tuck: 0.7, steer: 1 }));
    st.shoot(s, "turn", "chase");
  },
  // ── THE LADDER ON THE MACHINE ──────────────────────────────────────────
  // Every rung of the game's own camera while he rides, each ridden from
  // the same start to the same moment so the rungs compare frame for frame.
  lenses(st) {
    for (const rung of RUNGS) {
      const s = st.fresh(true);
      st.camera(rung);
      st.run(s, 2.4, ride({ tuck: 1 }));
      st.shoot(s, rung, rung);
    }
    st.camera("chase");
  },
  "lenses-powder"(st) {
    const m = st.spots.meadow;
    const h = openWay(st.level, m);
    for (const rung of RUNGS) {
      const s = st.fresh(true);
      place(s, behind(m, h, 60), h, 8);
      st.camera(rung);
      st.run(s, 1.5, ride({ tuck: 1 }));
      st.run(s, 1.2, ride({ tuck: 0.8, steer: 0.8 }));
      st.shoot(s, `${rung}-turn`, rung);
    }
    st.camera("chase");
  },
  // ── THE COCKPIT (the HELMET rung's own eye over the bars) ───────────────
  cockpit(st) {
    st.camera("helmet");
    const s = st.fresh(true);
    st.run(s, 0.8, still);
    st.shoot(s, "idle", "helmet");
    st.run(s, 2.4, ride({ tuck: 1 }));
    st.shoot(s, "throttle", "helmet");
    // The engine's steer is the screen's mirrored (`SCREEN_TO_ENGINE`):
    // its +1 turns the machine to the picture's left.
    st.run(s, 0.5, ride({ tuck: 1, steer: 1 }));
    st.shoot(s, "left", "helmet");
    st.run(s, 0.8, ride({ tuck: 1, steer: -1 }));
    st.shoot(s, "right", "helmet");
    st.run(s, 0.4, ride({ brake: 1 }));
    st.shoot(s, "brake", "helmet");
    st.camera("chase");
  },
  "cockpit-close"(st) {
    st.camera("helmet");
    const s = st.fresh(true);
    st.run(s, 1.5, ride({ tuck: 0.6 }));
    st.hide(["field"]);
    st.shoot(
      s,
      "right-hand",
      onMachine({ x: -0.5, y: 0.66, z: 0.3 }, { x: -0.3, y: 0.48, z: 0.55 }, 30),
    );
    st.shoot(
      s,
      "left-hand",
      onMachine({ x: 0.5, y: 0.66, z: 0.3 }, { x: 0.3, y: 0.48, z: 0.55 }, 30),
    );
    st.shoot(
      s,
      "right-inboard",
      onMachine({ x: -0.1, y: 0.6, z: 0.4 }, { x: -0.29, y: 0.47, z: 0.57 }, 30),
    );
    st.shoot(
      s,
      "right-front",
      onMachine({ x: -0.42, y: 0.62, z: 0.85 }, { x: -0.3, y: 0.48, z: 0.55 }, 30),
    );
    st.shoot(
      s,
      "left-front",
      onMachine({ x: 0.42, y: 0.62, z: 0.85 }, { x: 0.3, y: 0.48, z: 0.55 }, 30),
    );
    st.run(s, 0.3, ride({ brake: 1 }));
    st.shoot(
      s,
      "left-brake",
      onMachine({ x: 0.5, y: 0.66, z: 0.3 }, { x: 0.3, y: 0.48, z: 0.55 }, 30),
    );
    st.shoot(
      s,
      "display",
      onMachine({ x: -0.05, y: 0.82, z: 0.42 }, { x: 0, y: 0.45, z: 0.82 }, 34),
    );
    st.shoot(s, "over", onMachine({ x: 0, y: 1.12, z: 0.05 }, { x: 0, y: 0.25, z: 0.75 }, 75));
    st.shoot(s, "front", onMachine({ x: -0.3, y: 0.95, z: 1.6 }, { x: 0, y: 0.5, z: 0.6 }, 40));
    st.hide([]);
    st.camera("chase");
  },
  "cockpit-powder"(st) {
    const m = st.spots.meadow;
    const h = openWay(st.level, m);
    st.camera("helmet");
    const s = st.fresh(true);
    place(s, behind(m, h, 60), h, 8);
    st.run(s, 1.5, ride({ tuck: 1 }));
    st.shoot(s, "powder", "helmet");
    st.run(s, 1.2, ride({ tuck: 0.8, steer: 0.8 }));
    st.shoot(s, "powder-turn", "helmet");
    st.camera("chase");
  },
  async "cockpit-night"(st) {
    await st.sky({ hour: 21 });
    st.camera("helmet");
    const s = st.fresh(true);
    st.run(s, 2, ride({ tuck: 0.8 }));
    st.shoot(s, "night", "helmet");
    st.camera("chase");
    await st.sky(null);
  },
  // ── IN POWDER ──────────────────────────────────────────────────────────
  powder(st) {
    const s = st.fresh(true);
    const m = st.spots.meadow;
    const h = openWay(st.level, m);
    place(s, behind(m, h, 60), h, 0);
    st.run(s, 0.6, still);
    st.shoot(s, "sunk", around(3.6, 1.2, -1, 40, 0, 0.5));
    st.run(s, 1.5, ride({ tuck: 1 }));
    st.shoot(s, "launch", "chase");
    st.shoot(s, "launch-side", around(9, 1.5, 3, 40, -2, 1));
    st.run(s, 2.5, ride({ tuck: 1 }));
    st.shoot(s, "planing", "chase");
    st.shoot(s, "planing-far", "far");
  },
  roost(st) {
    const s = st.fresh(true);
    const m = st.spots.meadow;
    const h = openWay(st.level, m);
    place(s, behind(m, h, 30), h, 3);
    // Pinned from a near crawl: the belt spins and throws.
    st.run(s, 1.2, ride({ tuck: 1 }));
    st.shoot(s, "spin-side", around(8, 1.4, 4, 45, -3, 1.2));
    st.shoot(s, "spin-rear", around(-3, 2, 11, 50, 0, 1));
    st.run(s, 1, ride({ tuck: 1 }));
    st.shoot(s, "spin-high", "high");
  },
  carve(st) {
    const s = st.fresh(true);
    const m = st.spots.meadow;
    const h = openWay(st.level, m);
    place(s, behind(m, h, 40), h, 12);
    st.run(s, 0.8, ride({ tuck: 0.7 }));
    st.run(s, 1.2, ride({ tuck: 0.7, steer: 1 }));
    st.shoot(s, "rolled", "chase");
    st.shoot(s, "rolled-front", around(0, 1.6, -8, 45, 0, 0.8));
    st.run(s, 1.2, ride({ tuck: 0.7, steer: -1 }));
    st.shoot(s, "over-the-other", "chase");
  },
  // ── CLIMBING ───────────────────────────────────────────────────────────
  climb(st) {
    const s = st.fresh(true);
    const face = climbOf(st.level, st.spots.steep);
    const at = face?.at ?? st.spots.steep;
    const h = face?.heading ?? uphill(st.level, at);
    place(s, at, h, 10);
    st.run(s, 1.5, ride({ tuck: 1, lean: -0.6 }));
    st.shoot(s, "on-the-face", "chase");
    st.shoot(s, "side", around(16, 6, 2, 45, 0, 1));
    st.run(s, 2, ride({ tuck: 1, lean: -0.6 }));
    st.shoot(s, "high-mark", around(14, 9, 4, 45, 0, 1));
    st.shoot(s, "from-below", around(2, 2, 26, 45, 0, 1));
    st.shoot(s, "far", "far");
  },
  // ── WHAT IT LEAVES ─────────────────────────────────────────────────────
  tracks(st) {
    const s = st.fresh(true);
    const m = st.spots.meadow;
    const h = openWay(st.level, m);
    place(s, behind(m, h, 30), h, 8);
    st.run(s, 2, ride({ tuck: 0.8 }));
    st.run(s, 1.5, ride({ tuck: 0.8, steer: 0.8 }));
    st.run(s, 1.5, ride({ tuck: 0.8, steer: -0.8 }));
    st.run(s, 1, ride({ brake: 1 }));
    st.shoot(s, "lookback", around(0.5, 3.2, -6, 55, -12, 0));
    st.shoot(s, "above", around(5, 14, 14, 50, -10, 0));
  },
  // ── OFF IT ─────────────────────────────────────────────────────────────
  hop(st) {
    const s = st.fresh(true);
    st.run(s, 0.5, still);
    st.once(s, { ...NEUTRAL_INPUT, machine: true });
    st.shoot(s, "off", around(3, 1.4, 4, 50, 0, 0.8));
    st.run(s, 1, still);
    st.shoot(s, "skis-on", "chase");
  },
  crash(st) {
    const s = st.fresh(true);
    const run = trunkRun(st.level, st.spots.meadow);
    if (!run) return;
    place(s, run.from, run.heading, 15);
    st.run(s, 0.25, ride({ tuck: 1 }));
    st.shoot(s, "closing", around(5, 2, 4, 50, 2, 0.8));
    st.until(s, (q) => !!q.skier.thrown, 3, ride({ tuck: 1 }));
    st.run(s, 0.15, still);
    st.shoot(s, "thrown", onRider(7, 2.5, 3));
    st.run(s, 1.5, still);
    st.shoot(s, "down", onRider(4, 2, 3));
    st.shoot(s, "machine", around(5, 2, 4, 50, 0, 0.4));
  },
  // Stalled across a steep face of deep powder, hung off its
  // downhill side: the low ski sinks and it goes over onto its side, the
  // rider off the low side and his skis left on the rack.
  rollover(st) {
    const s = st.fresh(true);
    s.snowDepth = 1.75;
    const face = climbOf(st.level, st.spots.steep);
    const at = face?.at ?? st.spots.steep;
    const across = uphill(st.level, at) + Math.PI / 2;
    // Stood across the face, its low ski sunk, and tipped toward the
    // valley as it goes when it stalls there (the bench's `stall` row
    // goes over so on a 35° face; this one is 22–29°, so it is given the
    // turn it would have).
    const tip = (sign: number): void => {
      place(s, at, across, 1);
      st.run(s, 0.4, still);
      const k = s.sled!;
      const right = rotate(k.q, { x: 1, y: 0, z: 0 });
      const fall = st.level.groundAt(at.x + right.x * 4, at.z + right.z * 4) < at.y ? 1 : -1;
      k.wz = -sign * fall * 2.2;
    };
    tip(1);
    st.run(s, 0.25, ride({ steer: 1 }));
    st.shoot(s, "tipping", around(7, 2, 3, 50, 0, 0.6));
    st.until(s, (q) => !!q.skier.thrown, 4, ride({ steer: 1 }));
    st.shoot(s, "going", onRider(3.5, 1.4, 2.5));
    st.run(s, 0.4, still);
    st.shoot(s, "off", onRider(3.5, 1.6, 2.5));
    st.run(s, 1.5, still);
    st.shoot(s, "lying", onRider(-4, 2.2, -3));
    st.shoot(s, "machine", around(4, 2, 4, 50, 0, 0.3));
  },
  // ── AFTER DARK ─────────────────────────────────────────────────────────
  async night(st) {
    await st.sky({ hour: 21 });
    const s = st.fresh(true);
    st.run(s, 2, ride({ tuck: 0.8 }));
    st.shoot(s, "ride", "chase");
    st.shoot(s, "lamp", around(1, 1.2, -9, 45, 0, 0.6));
    await st.sky(null);
  },
  // ── THE MODEL ALONE ────────────────────────────────────────────────────
  turntable(st) {
    const s = st.fresh(false);
    const k = s.sled!;
    standSkier(s, k.x + 60, k.z + 60, 0);
    st.run(s, 0.3, still);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      st.shoot(
        s,
        `${(i * 45).toFixed(0)}deg`,
        around(Math.sin(a) * 4.5, 1.6, -Math.cos(a) * 4.5, 40, 0, 0.5),
      );
    }
  },
};

export const GROUPS: Record<string, readonly string[]> = {
  park: ["park", "call"],
  board: ["board", "rider"],
  groomer: ["groomer"],
  powder: ["powder", "roost", "carve"],
  climb: ["climb"],
  tracks: ["tracks"],
  hop: ["hop"],
  crash: ["crash", "rollover"],
  night: ["night"],
  turntable: ["turntable"],
  lenses: ["lenses", "lenses-powder"],
  cockpit: ["cockpit", "cockpit-close", "cockpit-powder", "cockpit-night"],
};
