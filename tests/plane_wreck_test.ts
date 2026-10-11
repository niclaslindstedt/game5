// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PLANE'S WRECK (`engine/game/defs/plane-wreck.ts`, `plane.ts`'s
// crash): the fuel the flight burns, the kind of crash an attitude and a
// way make (nose-in, cartwheel, belly, spin, trees), the fireball sized off
// the fuel by the helicopter's law and only at an impact hard enough to
// mist jet fuel, WHETHER IT BURNS AT ALL (a tank torn open onto the hot
// engine — most crashes do not, and a wing torn off alone never does), the pool fire's life and its flames, and the crash's lens
// planted off the wreck (`camera-crash.ts`) — held on the fire, out of the
// fireball, clear of the trunks and the snow.

import { describe, expect, it } from "vitest";
import {
  NEUTRAL_INPUT,
  PLANE,
  TUNING,
  createGame,
  fireballOf,
  planeAloft,
  planeFireOf,
  planeFireballAt,
  poolHeat,
  step,
  wreckIgnites,
  wreckKindOf,
  type GameEvent,
  type GameState,
  type Level,
  type PlaneControls,
  type SkierInput,
} from "@engine";

import { CRASH_LOOK, frameCrash, startCrashCam } from "../pwa/src/game/camera-crash.ts";
import type { LensPose } from "../pwa/src/game/camera-rigs.ts";
import { flatLevel, shapedLevel } from "./support/synthetic.ts";

const flat = flatLevel({ size: 4000 });
const dt = TUNING.dt;

const hands = (c: Partial<PlaneControls> = {}): SkierInput => ({
  ...NEUTRAL_INPUT,
  plane: { throttle: 0, pitch: 0, roll: 0, yaw: 0, flaps: 0, ...c },
});

function ride(level: Level = flat): GameState {
  return createGame({ level, mode: "free", plane: true, crowd: 0, quiet: true });
}

/** Staged `y` m over the flat map's middle and flown on `c` until it is a
 * wreck (or `limit` s). */
function crashOf(
  at: Omit<Parameters<typeof planeAloft>[1], "x" | "z" | "heading">,
  c: Partial<PlaneControls> = {},
  limit = 20,
): GameState {
  const s = ride();
  planeAloft(s, { x: 0, z: 0, heading: 0, ...at, y: flat.groundAt(0, 0) + at.y });
  for (let i = 0; i < limit / dt && s.plane!.mode !== "wreck"; i++) step(s, hands(c));
  return s;
}

describe("the plane's wreck", () => {
  it("burns its fuel in the air, more at full power", () => {
    const s = ride();
    planeAloft(s, { x: 0, y: flat.groundAt(0, 0) + 900, z: 0, heading: 0, speed: 45 });
    const f0 = s.plane!.fuel;
    expect(f0).toBe(PLANE.fuel);
    for (let i = 0; i < 60 / dt; i++) step(s, hands({ throttle: 1 }));
    const full = f0 - s.plane!.fuel;
    for (let i = 0; i < 60 / dt; i++) step(s, hands({ throttle: 0 }));
    const idle = f0 - full - s.plane!.fuel;
    // A minute at full power some 3 kg, at idle about 1 kg (200 / 70 kg/h).
    expect(full).toBeGreaterThan(2.5);
    expect(full).toBeLessThan(3.6);
    expect(idle).toBeLessThan(full);
    expect(idle).toBeGreaterThan(0.6);
  });

  it("names the kind of crash off how it went in", () => {
    const base = { tip: 0, tree: false, vx: 0, vy: -3, vz: 40, pitch: 0, roll: 0, yawRate: 0 };
    expect(wreckKindOf({ ...base, stalled: 0 })).toBe("belly");
    expect(wreckKindOf({ ...base, vy: -40, stalled: 0 })).toBe("nose");
    expect(wreckKindOf({ ...base, tip: 1, roll: 0.8, stalled: 0 })).toBe("cart");
    expect(wreckKindOf({ ...base, vy: -25, vz: 10, yawRate: 1.2, stalled: 0.8 })).toBe("spin");
    expect(wreckKindOf({ ...base, tree: true, stalled: 0 })).toBe("tree");
  });

  it("stages each kind on the engine and keeps how it struck", () => {
    const nose = crashOf({ y: 120, speed: 50, pitch: -1.1, power: 1 }, { throttle: 1 });
    expect(nose.plane!.wreck?.kind).toBe("nose");
    const belly = crashOf({ y: 4, speed: 48, pitch: -0.12, power: 0.3 });
    expect(belly.plane!.wreck?.kind).toBe("belly");
    const cart = crashOf({ y: 4, speed: 45, pitch: -0.08, roll: 1.1 }, { roll: 1 });
    expect(cart.plane!.wreck?.kind).toBe("cart");
    expect(cart.plane!.wreck?.tip).not.toBe(0);
    const spin = crashOf(
      {
        y: 40,
        speed: 28,
        pitch: -0.6,
        roll: 0.5,
        power: 0,
        rates: { wx: 0, wy: 1.4, wz: 0 },
        way: { x: 0.3, y: -1, z: 0.4 },
      },
      { pitch: -1, yaw: 1 },
    );
    expect(spin.plane!.wreck?.kind).toBe("spin");
    // The cartwheel's wing went first, its tank with it: half the fuel.
    expect(cart.plane!.wreck!.torn.some((t) => t)).toBe(true);
    expect(cart.plane!.wreck!.fuel).toBeLessThan(PLANE.fuel / 2 + 1);
    for (const s of [nose, belly, cart, spin]) {
      const w = s.plane!.wreck!;
      expect(w.fuel).toBeGreaterThan((s === cart ? PLANE.fuel / 2 : PLANE.fuel) - 2);
      expect(w.speed).toBeGreaterThan(5);
      expect(Math.hypot(w.q.x, w.q.y, w.q.z, w.q.w)).toBeCloseTo(1, 6);
    }
    // A crash is the same crash twice: nothing drawn from the stream.
    const again = crashOf({ y: 120, speed: 50, pitch: -1.1, power: 1 }, { throttle: 1 });
    expect(again.plane!.wreck).toEqual(nose.plane!.wreck);
  });

  it("sizes the fireball off the fuel by the helicopter's law, only on a hard impact", () => {
    const hard = planeFireOf(200, 50);
    const law = fireballOf(200 * 0.3);
    expect(hard.ball).toBeCloseTo(60, 6);
    expect(hard.diameter).toBeCloseTo(law.diameter, 6);
    expect(hard.life).toBeCloseTo(law.life, 6);
    // Some 23 m across for under two seconds (the research's table).
    expect(hard.diameter).toBeGreaterThan(20);
    expect(hard.diameter).toBeLessThan(26);
    // Too slow to mist jet fuel: a pool fire alone, all the fuel in it.
    const slow = planeFireOf(200, 10);
    expect(slow.ball).toBe(0);
    expect(slow.pool).toBeCloseTo(200, 6);
    expect(planeFireballAt(slow, 0.5).radius).toBe(0);
    // Less fuel, a smaller ball.
    expect(planeFireOf(80, 50).diameter).toBeLessThan(hard.diameter);
    // A belly slide keeps most of its tanks whole: a smaller ball, a
    // bigger pool; a cartwheel bursts them as a nose-in does.
    const belly = planeFireOf(200, 50, "belly");
    expect(belly.diameter).toBeLessThan(hard.diameter * 0.8);
    expect(belly.pool).toBeGreaterThan(hard.pool);
    expect(planeFireOf(200, 50, "cart").diameter).toBeCloseTo(hard.diameter, 6);
    // The ball grows, lifts off and burns out within its life.
    const a = planeFireballAt(hard, 0.1);
    const b = planeFireballAt(hard, hard.life * 0.5);
    expect(b.radius).toBeGreaterThan(a.radius);
    expect(b.height).toBeGreaterThan(a.height);
    expect(planeFireballAt(hard, hard.life).glow).toBe(0);
  });

  it("burns the pool a minute and more under flames some metres tall, then smoulders out", () => {
    const fire = planeFireOf(180, 45);
    expect(fire.burns).toBeGreaterThan(60);
    expect(fire.burns).toBeLessThan(200);
    expect(fire.flame).toBeGreaterThan(6);
    expect(fire.flame).toBeLessThan(16);
    expect(fire.radius).toBeGreaterThan(2.5);
    expect(fire.radius).toBeLessThan(5);
    expect(poolHeat(fire, 1)).toBeGreaterThan(0.9);
    expect(poolHeat(fire, fire.burns * 0.5)).toBeLessThan(poolHeat(fire, 1));
    expect(poolHeat(fire, fire.burns + 5)).toBeGreaterThan(0);
    expect(poolHeat(fire, fire.burns + 5)).toBeLessThan(0.3);
    expect(poolHeat(fire, fire.out + 1)).toBe(0);
    // A fuel-dry tank burns nothing.
    expect(planeFireOf(0, 50).out).toBeGreaterThan(0);
    expect(planeFireOf(0, 50).burns).toBe(0);
  });
});

describe("whether a wreck burns", () => {
  it("lights only when a tank is torn open onto the hot engine", () => {
    // A slow nose-in holds its tanks; a hard one burns.
    expect(wreckIgnites("nose", 15, 200, 1)).toBe(false);
    expect(wreckIgnites("nose", 50, 200, 1)).toBe(true);
    // A belly slide at a landing's speed holds them; far faster it tears one.
    expect(wreckIgnites("belly", 30, 200, 1)).toBe(false);
    expect(wreckIgnites("belly", 50, 200, 1)).toBe(true);
    // No heat, no fire; no fuel, no fire.
    expect(wreckIgnites("nose", 50, 200, 0)).toBe(false);
    expect(wreckIgnites("nose", 50, 0, 1)).toBe(false);
    // Unlit, there is nothing to burn: no ball, no pool, no flames.
    const cold = planeFireOf(200, 50, "nose", false);
    expect(cold.ball).toBe(0);
    expect(cold.diameter).toBe(0);
    expect(cold.pool).toBe(0);
    expect(cold.burns).toBe(0);
    expect(cold.flame).toBe(0);
    expect(poolHeat(cold, 1)).toBe(0);
    expect(cold.out).toBeGreaterThan(0);
  });

  it("burns a hard nose-in and leaves a slow belly slide cold", () => {
    const nose = crashOf({ y: 120, speed: 50, pitch: -1.1, power: 1 }, { throttle: 1 });
    expect(nose.plane!.wreck!.fire).toBe(true);
    const slow = crashOf({ y: 3, speed: 30, pitch: 0.05, power: 0 }, { pitch: 1 });
    expect(slow.plane!.wreck?.fire).toBe(false);
  });

  it("tears a wing off on a trunk without a fire", () => {
    const level = shapedLevel(() => 0, {
      size: 2000,
      cell: 2,
      trees: [{ x: 1007.9, z: 1060, y: 0, height: 14, radius: 0.3, crown: 3 }],
    });
    const s = createGame({ level, mode: "free", plane: true, crowd: 0, quiet: true });
    planeAloft(s, { x: 1000, z: 1000, heading: 0, y: 4, speed: 40, power: 0.8 });
    let tear: GameEvent | null = null;
    for (let i = 0; i < 4 / dt && !tear; i++) {
      step(s, hands({ throttle: 0.8 }));
      tear =
        (s.events as GameEvent[]).find((e) => e.kind === "plane" && e.phase === "tear") ?? null;
    }
    expect(tear).not.toBeNull();
    const p = s.plane!;
    // The left wing (the engine's +x) is off, its tank spilt with it, and
    // nothing is alight: the plane is still flying when it lets go.
    expect(p.wings[0].torn?.cause).toBe("tree");
    expect(p.wings[1].torn).toBeNull();
    expect(p.mode).toBe("flown");
    expect(p.wreck).toBeNull();
    expect(p.fuel).toBeLessThan(PLANE.fuel / 2 + 1);
  });

  it("calls a ground loop's slew a belly, never a spin", () => {
    const base = { tip: 0, tree: false, vx: 0, vy: -1, vz: 30, pitch: 0, roll: 0.2 };
    expect(wreckKindOf({ ...base, yawRate: 1.2, stalled: 0.8 })).toBe("spin");
    expect(wreckKindOf({ ...base, yawRate: 1.2, stalled: 0.8, gear: true })).toBe("belly");
  });
});

describe("the plane's crash lens", () => {
  const fire = planeFireOf(200, 50);
  const ground = (x: number, z: number) => 0.02 * x + 0.01 * z;
  const wreck = { x: 0, y: 0, z: 0 };
  const from: LensPose = {
    eye: { x: 0, y: 6, z: -25 },
    target: { x: 0, y: 2, z: 0 },
    fov: 60,
    roll: 0,
  };

  it("is planted well back off the wreck, out of the fireball, and holds on the fire", () => {
    const cam = startCrashCam(from, wreck, ground, undefined, { ball: fire.diameter });
    let worst = Infinity;
    for (let t = 0; t < 90; t += 0.1) {
      const lens = frameCrash(cam, wreck, 0.1, ground);
      const d = Math.hypot(lens.eye.x, lens.eye.z);
      worst = Math.min(worst, d);
      const ball = planeFireballAt(fire, t);
      const centre = { x: 0, y: ball.height, z: 0 };
      const db = Math.hypot(lens.eye.x - centre.x, lens.eye.y - centre.y, lens.eye.z - centre.z);
      expect(db).toBeGreaterThan(ball.radius + 3);
      expect(lens.eye.y).toBeGreaterThan(ground(lens.eye.x, lens.eye.z) + 1);
      // Looking at the fire.
      expect(Math.hypot(lens.target.x, lens.target.z)).toBeLessThan(1);
    }
    expect(worst).toBeGreaterThan(fire.diameter);
    expect(worst).toBeGreaterThanOrEqual(CRASH_LOOK.nearest - 1e-6);
  });

  it("never drifts in behind a trunk or into one", () => {
    // A ring of trunks that the slow drift round would walk into.
    const trunks = [-0.4, 0.2, 0.9, 1.6, 2.4].map((a) => ({
      x: Math.sin(a) * 30,
      z: Math.cos(a) * 30,
    }));
    const blocked = (eye: { x: number; z: number }, at: { x: number; z: number }) =>
      trunks.some((t) => {
        if (Math.hypot(eye.x - t.x, eye.z - t.z) < 4) return true;
        const dx = at.x - eye.x;
        const dz = at.z - eye.z;
        const k = Math.max(
          0,
          Math.min(1, ((t.x - eye.x) * dx + (t.z - eye.z) * dz) / (dx * dx + dz * dz)),
        );
        return Math.hypot(eye.x + dx * k - t.x, eye.z + dz * k - t.z) < 1.2;
      });
    const cam = startCrashCam(from, wreck, ground, blocked, { ball: fire.diameter });
    for (let t = 0; t < 90; t += 0.1) {
      const lens = frameCrash(cam, wreck, 0.1, ground, blocked);
      expect(blocked(lens.eye, wreck)).toBe(false);
    }
  });

  it("stands clear of a fireball the wreck slid on past", () => {
    // Slid 40 m on from where its ball went up, back toward the lens.
    const ballAt = { x: 0, y: 0, z: -40 };
    const cam = startCrashCam(from, wreck, ground, undefined, { ball: fire.diameter, ballAt });
    for (let t = 0; t < 30; t += 0.1) {
      const lens = frameCrash(cam, wreck, 0.1, ground);
      const d = Math.hypot(lens.eye.x - ballAt.x, lens.eye.z - ballAt.z);
      expect(d).toBeGreaterThan(fire.diameter * 0.9);
    }
  });
});
