// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE LAB'S CRASH SHEET (`plane-scenes.ts` lists it): the plane
// flown into the snow each way a plane goes in (`PlaneWreck.kind`) with the
// skier in its door — NOSE first at full power, a wing tip caught in a bank
// and CARTWHEELED, slid in on its BELLY, down out of a stall and SPIN, into
// the TREES — each seen through the crash's own lens (`camera-crash.ts`)
// frame by frame and from close; the fireball growing and burning out; the
// wreck burning on at 5, 30 and 90 seconds, by day and after dark.

import {
  NEUTRAL_INPUT,
  airstripOf,
  planeAloft,
  type GameState,
  type PlaneControls,
  type PlaneWreck,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import { wooded } from "../game/camera-crash.ts";
import { BREAK } from "../game/plane-shatter.ts";
import type { Drive, Stage } from "./plane-scenes.ts";

const still: Drive = () => NEUTRAL_INPUT;
const hands =
  (c: Partial<PlaneControls>): Drive =>
  () => ({
    ...NEUTRAL_INPUT,
    plane: { throttle: 0, pitch: 0, roll: 0, yaw: 0, flaps: 0, ...c },
  });

type Kind = "nose" | "cart" | "belly" | "spin" | "tree";

/** Where along its strip the plane is staged from, and how — each kind's
 * entry (the suite's, `plane_wreck_test.ts`) flown on its own hands. */
function staged(st: Stage, kind: Kind): GameState {
  const s = st.fresh();
  // Off the hand that helps a take-off: each is flown in as staged.
  s.assist = { yaw: 0, air: 0 };
  const strip = airstripOf(st.level);
  const p = s.plane!;
  const h = strip ? strip.heading : p.heading;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  // From a little way down the strip, flying along it.
  const x = p.x + fx * 60;
  const z = p.z + fz * 60;
  const g = st.level.groundAt(x, z);
  let drive: Drive = still;
  switch (kind) {
    case "nose":
      planeAloft(s, { x, z, y: g + 110, heading: h, speed: 50, pitch: -1.1, power: 1 });
      drive = hands({ throttle: 1 });
      break;
    case "belly":
      planeAloft(s, { x, z, y: g + 4, heading: h, speed: 48, pitch: -0.12, power: 0.3 });
      break;
    case "cart":
      planeAloft(s, { x, z, y: g + 4, heading: h, speed: 45, pitch: -0.08, roll: 1.1 });
      drive = hands({ roll: 1 });
      break;
    case "spin":
      planeAloft(s, {
        x,
        z,
        y: g + 40,
        heading: h,
        speed: 28,
        pitch: -0.6,
        roll: 0.5,
        power: 0,
        rates: { wx: 0, wy: 1.4, wz: 0 },
        way: { x: fx * 0.4 + fz * 0.3, y: -1, z: fz * 0.4 - fx * 0.3 },
      });
      drive = hands({ pitch: -1, yaw: 1 });
      break;
    case "tree": {
      // The nearest stand of trees to the strip, flown at level into it.
      let best = -1;
      let near = Infinity;
      st.level.trees.forEach((t, i) => {
        const d = Math.hypot(t.x - x, t.z - z);
        if (t.height > 9 && d > 120 && d < near) {
          near = d;
          best = i;
        }
      });
      const t = st.level.trees[best];
      const a = Math.atan2(t.x - x, t.z - z);
      const sx = t.x - Math.sin(a) * 90;
      const sz = t.z - Math.cos(a) * 90;
      const y = Math.max(t.y + t.height * 0.55, st.level.groundAt(sx, sz) + 6);
      planeAloft(s, { x: sx, z: sz, y, heading: a, speed: 42, pitch: 0, power: 0.6 });
      drive = hands({ throttle: 0.6 });
      break;
    }
  }
  st.until(s, (q) => q.plane!.mode === "wreck", 20, drive);
  if (s.plane!.wreck) wrecks.set(s, { ...s.plane!.wreck });
  return s;
}

/** Each staged run's wreck, kept: the ride stands up again on the strip
 * after a while (`plane.ts`'s restart) and takes its own with it, while
 * the fire it left burns on in the drawing. */
const wrecks = new WeakMap<GameState, PlaneWreck>();

/** Where the hulk comes to rest off the wreck (`plane-shatter.ts`'s plan). */
function restOf(s: GameState): { x: number; y: number; z: number } {
  const w = wrecks.get(s)!;
  const way = Math.hypot(w.vx, w.vz);
  const plan = BREAK[w.kind];
  const far = Math.min(plan.most, way * plan.slide);
  const x = w.x + (way > 0.5 ? (w.vx / way) * far : 0);
  const z = w.z + (way > 0.5 ? (w.vz / way) * far : 0);
  return { x, y: 0, z };
}

/** A lens planted `dist` m off the wreck's resting place at `turn` rad off
 * the way it was going, `up` m over the snow, looking at it `over` m up. */
function near(dist: number, turn: number, up: number, over = 1.5, fov = 50) {
  return (s: GameState): LensPose => {
    const w = wrecks.get(s)!;
    const at = restOf(s);
    const target = { x: at.x, y: s.level.groundAt(at.x, at.z) + over, z: at.z };
    // Turned round from the bearing asked for until no trunk stands in the
    // way (in the woods, the least wooded of the tries).
    let eye = { x: 0, y: 0, z: 0 };
    for (const off of [0, 0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6, Math.PI]) {
      const a = Math.atan2(w.vx, w.vz) + turn + off;
      const ex = at.x + Math.sin(a) * dist;
      const ez = at.z + Math.cos(a) * dist;
      eye = { x: ex, y: s.level.groundAt(ex, ez) + up, z: ez };
      if (!wooded(s.level, eye, target)) break;
    }
    return { eye, target, fov, roll: 0 };
  };
}

/** The crash through the game's own lens at each of `times` s. */
function frames(st: Stage, s: GameState, times: readonly number[], tag = ""): void {
  let t = 0;
  for (const at of times) {
    st.run(s, at - t, still);
    t = at;
    st.shoot(s, `${tag}${at}s`, "chase");
  }
}

/** One kind: the impact frame by frame, then close and from the side. */
function kindView(kind: Kind) {
  return (st: Stage) => {
    st.camera("chase");
    const s = staged(st, kind);
    frames(st, s, [0, 0.15, 0.4, 0.8, 1.6, 3]);
    st.shoot(s, "3s-close", near(18, 2.3, 3.5));
    st.shoot(s, "3s-side", near(26, -1.5, 5, 1.5, 45));
  };
}

export const CRASH_VIEWS: Record<string, (st: Stage) => void | Promise<void>> = {
  // THE FIREBALL: a full-power nose-in, its ball's growth and burn-out.
  "crash-ball"(st) {
    st.camera("chase");
    const s = staged(st, "nose");
    frames(st, s, [0, 0.1, 0.25, 0.5, 0.8, 1.2, 1.8, 2.6, 4, 6]);
  },
  "crash-nose": kindView("nose"),
  "crash-cart": kindView("cart"),
  "crash-belly": kindView("belly"),
  "crash-spin": kindView("spin"),
  "crash-tree": kindView("tree"),
  // THE WRECK BURNING ON: at 5, 30 and 90 s — the pool fire, the column,
  // the hulk charred and then burnt to ash — through the lens and close.
  "crash-burn"(st) {
    st.camera("chase");
    const s = staged(st, "belly");
    st.run(s, 5, still);
    st.shoot(s, "5s-lens", "chase");
    st.shoot(s, "5s-close", near(16, 2.2, 3));
    st.skip(s, 23, still);
    st.run(s, 2, still);
    st.shoot(s, "30s-close", near(16, 2.2, 3));
    st.shoot(s, "30s-far", near(70, -2, 12, 12, 45));
    st.skip(s, 58, still);
    st.run(s, 2, still);
    st.shoot(s, "90s-close", near(16, 2.2, 3));
    st.shoot(s, "90s-far", near(70, -2, 12, 12, 45));
  },
  // AFTER DARK: the fire lighting the snow, the trees and the wreck.
  async "crash-night"(st) {
    await st.sky({ hour: 21, weather: "clear" });
    st.camera("chase");
    const s = staged(st, "nose");
    frames(st, s, [0.3, 1.2], "night-");
    st.run(s, 3.8, still);
    st.shoot(s, "5s-close", near(18, 2.3, 3.5));
    st.skip(s, 23, still);
    st.run(s, 2, still);
    st.shoot(s, "30s-close", near(18, 2.3, 3.5));
    st.shoot(s, "30s-far", near(60, -2, 8, 6, 45));
    await st.sky(null);
  },
};

/** The crash's two sheets: the fire (the ball's growth and burn-out, the
 * wreck burning on by day and after dark) and the kinds frame by frame. */
export const CRASH_SHEET = ["crash-ball", "crash-burn", "crash-night"] as const;
export const KINDS_SHEET = [
  "crash-nose",
  "crash-cart",
  "crash-belly",
  "crash-spin",
  "crash-tree",
] as const;
