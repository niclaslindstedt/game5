// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE FIGURE ON A MACHINE, RECKONED — what the player's figure is handed
// while he rides one (`SkisModel.setPerch`, `.setSled`, `.setBasket`): sat
// on the helicopter's skid (`createHeliPerch`), hung in the paramotor's
// harness (`createParaPerch`), stood on the snowmobile's boards
// (`sledStandOf`), stepping about the balloon's basket
// (`createBasketWalk`). Three-free and DOM-free, so the scenes that draw the
// machines (`heli-scene.ts`, `para-scene.ts`, `sled-scene.ts`,
// `machines.ts`) and the labs that pose the figure in Node
// (`scripts/lib/jolt-ride.mjs`) read the one reckoning.

import {
  BALLOON,
  HANG_AIR,
  HANG_GROUND,
  SLED,
  TUNING,
  airAt,
  unrotate,
  washAt,
  type BalloonState,
  type GameState,
  type SkierState,
  type Wash,
} from "@engine";

import type { Perch } from "./skier-dangle.ts";
import type { BasketWalk } from "./ski-swing.ts";
import type { SledStand } from "./skis-body.ts";
import { SLED_LOOK, sledFrame } from "./sled-look.ts";

/** How quickly the seat's acceleration is followed, s — the steps'
 * difference of its velocity smoothed of their jitter. */
const ACCEL_LAG = 0.06;
/** How far under his body origin his boots hang under the skid, m, where
 * the air is read, and the height over the snow his skis rest at below
 * which they are laid down on it rather than dangled, m. */
const FEET = 0.9;
const REST = 0.15;
/** How far his seat hangs under him in the paramotor's harness, m; how high
 * over the snow he sits back into it, m. */
export const PARA_SEAT = HANG_AIR;
export const PARA_SIT = 2.5;
/** A whole stride in the basket (both boots), m, and the metres of stride
 * a radian of turning on the spot is worth. */
const STRIDE = 0.7;
const TURN_STEP = 0.25;

/** THE SEAT'S ACCELERATION, smoothed: read once a step however many frames
 * draw it, `reset` when he leaves the seat so the next sit starts still. */
function createSeatAccel() {
  const accel = { x: 0, y: 0, z: 0 };
  const lastV = { x: 0, y: 0, z: 0 };
  let lastTick = -1;
  return {
    accel,
    reset() {
      lastTick = -1;
    },
    read(tick: number, c: SkierState) {
      if (tick === lastTick) return;
      const span = (tick - lastTick) * TUNING.dt;
      if (lastTick >= 0 && span > 0) {
        const k = 1 - Math.exp(-span / ACCEL_LAG);
        accel.x += ((c.vx - lastV.x) / span - accel.x) * k;
        accel.y += ((c.vy - lastV.y) / span - accel.y) * k;
        accel.z += ((c.vz - lastV.z) / span - accel.z) * k;
      } else accel.x = accel.y = accel.z = 0;
      lastTick = tick;
      lastV.x = c.vx;
      lastV.y = c.vy;
      lastV.z = c.vz;
    },
  };
}

/** THE SKID: the skid's top in his body frame and what his dangling legs
 * feel there (`skier-dangle.ts` — the gravity less the seat's acceleration,
 * the air past him, the rotor), or null off it. */
export function createHeliPerch(): (state: GameState) => Perch | null {
  const seat = createSeatAccel();
  const wash: Wash = { x: 0, y: 0, z: 0 };
  return (state) => {
    const h = state.heli;
    if (!h?.rider) {
      seat.reset();
      return null;
    }
    const c = state.skier;
    seat.read(state.tick, c);
    const accel = seat.accel;
    // The air at his boots: the weather's wind at their height over the
    // snow and the rotor's wash there, less his own way.
    const level = state.level;
    const feet = c.y - FEET;
    const over = feet - level.groundAt(c.x, c.z);
    const wind = airAt(level, state.t, c.x, c.z, Math.max(0.5, over));
    washAt(level, h, c.x, feet, c.z, wash);
    const air = unrotate(c.q, {
      x: wind.x + wash.x - c.vx,
      y: wash.y - c.vy,
      z: wind.z + wash.z - c.vz,
    });
    const gravity = unrotate(c.q, { x: -accel.x, y: -TUNING.g - accel.y, z: -accel.z });
    // His skis hang free as the engine lowers them off the snow, and are
    // laid back down on it near the snow.
    const hang = (HANG_GROUND - h.hang) / (HANG_GROUND - HANG_AIR);
    const near = (over - REST) / 0.5;
    return {
      y: -h.hang,
      gravity,
      air,
      spool: h.spool,
      rotor: h.rotor,
      hanging: Math.max(0, Math.min(1, hang, near)),
      t: state.t,
      up: unrotate(c.q, { x: 0, y: 1, z: 0 }),
      hung: h.hung,
      load: h.load,
    };
  };
}

/** THE HARNESS: his seat under the paramotor's wing while it flies him
 * clear of the snow, or null on it. */
export function createParaPerch(): (state: GameState) => Perch | null {
  const seat = createSeatAccel();
  return (state) => {
    const p = state.para;
    if (!p || p.mode !== "flown" || !p.flying || p.agl < PARA_SIT || state.skier.thrown) {
      seat.reset();
      return null;
    }
    const c = state.skier;
    seat.read(state.tick, c);
    const accel = seat.accel;
    const wind = airAt(state.level, state.t, c.x, c.z, Math.max(0.5, p.agl));
    return {
      y: -PARA_SEAT,
      gravity: unrotate(c.q, { x: -accel.x, y: -TUNING.g - accel.y, z: -accel.z }),
      air: unrotate(c.q, { x: wind.x - c.vx, y: -c.vy, z: wind.z - c.vz }),
      spool: 0,
      rotor: 0,
      // Let down onto the snow as he comes in.
      hanging: Math.max(0, Math.min(1, (p.agl - PARA_SIT) / 2)),
      t: state.t,
    };
  };
}

/** THE BOARDS: his feet out on the snowmobile's running boards and his
 * hands on its grips, or null off it. */
export function sledStandOf(state: GameState): SledStand | null {
  const s = state.sled;
  if (!s?.rider || state.skier.thrown) return null;
  const c = state.skier;
  // The boards' middle in the sled's frame, which his figure is stood
  // over, and where the engine has his weight off it (`riderFrame`).
  const oy = SLED.boards.y + c.spec.cogHeight;
  const hang = { x: s.riderRight * 0.5, z: -s.riderAft * 0.5 };
  // The grips turned with the bars about the post.
  const post = sledFrame(SLED_LOOK.post);
  const a = s.skiAngle * 0.8;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const grip = (side: number) => {
    const gx = side * SLED.grips.x;
    const gz = SLED.grips.z - post[0];
    return {
      x: gx * ca + gz * sa,
      y: SLED.grips.y - oy,
      z: post[0] + gz * ca - gx * sa - SLED.boards.z,
    };
  };
  const half = c.spec.stance / 2;
  return {
    out: [-(SLED.boards.x - half), SLED.boards.x - half],
    board: {
      grips: [grip(-1), grip(1)],
      lean: 0.42 - 0.3 * s.controls.lean + 0.15 * s.controls.throttle,
      hang,
    },
  };
}

/** THE BASKET: his steps about the balloon's basket as they are drawn —
 * the strides walked (or turned on the spot) and their pace eased over
 * the frame's `dt` — or null while he is not aboard. */
export function createBasketWalk(): (
  b: BalloonState | null | undefined,
  dt: number,
) => BasketWalk | null {
  const walk = { x: Number.NaN, z: Number.NaN, face: 0, strides: 0, pace: 0 };
  return (b, dt) => {
    if (!b?.aboard) {
      walk.x = Number.NaN;
      walk.pace = 0;
      return null;
    }
    const moved = Number.isNaN(walk.x)
      ? 0
      : Math.hypot(b.walkX - walk.x, b.walkZ - walk.z) +
        TURN_STEP *
          Math.abs(Math.atan2(Math.sin(b.face - walk.face), Math.cos(b.face - walk.face)));
    walk.x = b.walkX;
    walk.z = b.walkZ;
    walk.face = b.face;
    walk.strides += moved / STRIDE;
    const pace = Math.min(1, moved / Math.max(1e-3, dt) / BALLOON.walk.speed);
    walk.pace += (pace - walk.pace) * Math.min(1, dt * 10);
    return walk;
  };
}
