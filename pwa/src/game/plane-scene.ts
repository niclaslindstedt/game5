// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE IN THE RENDERER — the one hand the renderer holds it by
// (through `machines.ts`): the airframe drawn off the engine's plane
// (`plane-view.ts`: the Blender model, or the code's stand-in), its
// propeller turned, its blur disc faded in with the spin, its surfaces on
// their hinges where the engine has them, its lamps lit, charred where it
// came down; and the lens it takes while the skier stands in its door
// (`camera-plane.ts`).
//
// Drawn between two steps on the RIDER'S own line (`interp.ts`), so the
// door he stands in never parts from under him between frames. The lens is
// FLOWN onto the plane as he boards and off it after the jump, never cut:
// out of the door it is held where it was for a beat, its look coming round
// onto him as he falls away — the chase that framed the door would be in
// the wing — and then handed back to the ladder.

import * as THREE from "three";
import { PLANE, type GameState } from "@engine";

import { blendLens, type LensPose } from "./camera-rigs.ts";
import { orbitBlend } from "./camera-heli.ts";
import { createPlaneCam, framePlane, planeMiddleOf, type PlaneAt } from "./camera-plane.ts";
import type { HazeUniforms } from "./haze.ts";
import { createTrack, observe, sample, type Pose } from "./interp.ts";
import type { Flood } from "./headlamp.ts";
import { PLANE_COCKPIT, bodyOf, inPlaneCabin } from "./plane-cockpit-plan.ts";
import { createPlaneLook } from "./plane-view.ts";
import { shelterAt, shelterOff } from "./shelter.ts";
import type { CameraRung } from "./renderer-api.ts";

export type PlaneScene = {
  group: THREE.Group;
  /** One frame: the airframe drawn `alpha` of the way from the step before,
   * and the lens it wants on `rung` worked out (`lens` hands it over) — a
   * change of rung flown while `flying`, else cut; framed for a screen
   * `aspect` wide to its height. */
  frame(
    state: GameState,
    alpha: number,
    dt: number,
    rung: CameraRung,
    flying: boolean,
    aspect?: number,
  ): void;
  /** THE PLANE'S LENS, flown in from the skier's `ladder` and back out to
   * it, or null while the ladder has it whole. */
  lens(ladder: LensPose, dt: number): LensPose | null;
  /** The plane as drawn this frame, or null with none. */
  drawn(): PlaneAt | null;
  /** The eye settled for this frame: the cockpit shown while it is in the
   * cabin (no snow falling in there) or near enough outside to see in. */
  seen(eye: { x: number; y: number; z: number }): void;
  /** After dark (`lit` > 0), its landing light into `out`. */
  lamps(lit: number, out: Flood[]): void;
  /** Settled once the model is in (or the stand-in is kept). */
  ready: Promise<void>;
  dispose(): void;
};

/** How long the exit's lens is held after the jump, s, and how long its
 * look takes to come round onto him; how long the lens takes to fly onto
 * the plane as he boards, and back to the ladder after the exit, s. */
const DROP_HOLD = 1.6;
const DROP_TURN = 0.5;
const HAND_IN = 1.1;
const HAND_OUT = 1.3;
/** How far the wreck is charred, 0..1, and how long the charring takes, s. */
const CHAR = 0.85;
const CHAR_TIME = 3;
/** How near the eye must be outside to see the pilot through the glass, m. */
const NEAR = 60;
/** The cabin's box the snowfall is kept out of: its middle and half
 * extents, body frame. */
const CABIN = {
  centre: {
    x: 0,
    y: (PLANE.cabin.floor + PLANE_COCKPIT.roof) / 2,
    z: (PLANE.cabin.back + PLANE_COCKPIT.firewall) / 2,
  },
  half: {
    x: PLANE.cabin.width / 2,
    y: (PLANE_COCKPIT.roof - PLANE.cabin.floor) / 2,
    z: (PLANE_COCKPIT.firewall - PLANE.cabin.back) / 2,
  },
};
const PILOT = bodyOf(PLANE_COCKPIT.eye);

export function createPlaneScene(haze: HazeUniforms): PlaneScene {
  const look = createPlaneLook(haze);
  const group = new THREE.Group();
  group.name = "plane";
  group.add(look.group);
  group.visible = false;
  const track = createTrack();
  const at: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  let shown: PlaneAt | null = null;
  const cam = createPlaneCam();
  let wrecked = false;
  let clock = 0;
  // THE HAND-OVER: what the plane wants on screen this frame (null: the
  // ladder), whether it is cut to, the share of it on screen and the last
  // lens it asked for (flown out from once it stops).
  let own: LensPose | null = null;
  let cut = false;
  let share = 0;
  let held: LensPose | null = null;
  let lastLens: LensPose | null = null;
  let worn = false;
  let since = Infinity;
  let lastState: GameState | null = null;
  let sheltered = false;
  const local = new THREE.Vector3();
  const qi = new THREE.Quaternion();

  return {
    group,
    frame(state, alpha, dt, rung, flying, aspect = 16 / 9) {
      const p = state.plane;
      own = null;
      cam.cut = !flying;
      cut = state !== lastState;
      lastState = state;
      group.visible = !!p;
      if (!p) {
        shown = null;
        return;
      }
      const wreck = p.mode === "wreck";
      if (wreck !== wrecked) {
        wrecked = wreck;
        track.tick = -1;
      }
      look.char(wreck ? CHAR * Math.min(1, p.t / CHAR_TIME) : 0);
      observe(track, { x: p.x, y: p.y, z: p.z, q: p.q }, state.tick);
      sample(track, alpha, at);
      look.group.position.set(at.x, at.y, at.z);
      look.group.quaternion.set(at.q.x, at.q.y, at.q.z, at.q.w);
      shown = { x: at.x, y: at.y, z: at.z, q: { ...at.q } };
      // The propeller turned clockwise seen from the cockpit, its blur
      // faded in as it spins up; the surfaces where the engine has them.
      clock += dt;
      look.pose(p, clock, state.level, dt);

      const groundAt = (x: number, z: number) => state.level.groundAt(x, z);
      const step = Math.min(dt, 0.1);
      if (!p.rider || wreck) {
        cam.fresh = true;
        if (lastLens && !wreck && since < DROP_HOLD && rung !== "orbit" && !worn) {
          // THE EXIT: held where it was, its look coming round onto him as
          // he falls away from the door.
          since += dt;
          const c = state.skier;
          const k = Math.min(1, since / DROP_TURN);
          const s = k * k * (3 - 2 * k);
          const f = lastLens.target;
          own = {
            ...lastLens,
            target: {
              x: f.x + (c.x - f.x) * s,
              y: f.y + (c.y - f.y) * s,
              z: f.z + (c.z - f.z) * s,
            },
            roll: lastLens.roll * (1 - s),
          };
          return;
        }
        // From the door or the cockpit, let go at once: the ladder's own
        // stand-in flies out of his head (`camera.ts`'s `bail`).
        if (worn && lastLens) cut = true;
        lastLens = null;
        return;
      }
      since = 0;
      worn = rung === "tips" || rung === "helmet";
      lastLens = framePlane(cam, p, shown, rung, step, groundAt, aspect);
      own = lastLens;
    },
    lens(ladder, dt) {
      if (own) {
        share = cut ? 1 : Math.min(1, share + dt / HAND_IN);
        held = own;
      } else {
        share = cut ? 0 : Math.max(0, share - dt / HAND_OUT);
      }
      // Flown onto it round the airframe as it is drawn, never through it;
      // off it, straight back to the skier falling away.
      const out =
        !held || share <= 0
          ? null
          : share >= 1
            ? held
            : own && shown
              ? orbitBlend(ladder, held, share, planeMiddleOf(shown), 10)
              : blendLens(ladder, held, share);
      if (!out) held = null;
      return out;
    },
    drawn: () => shown,
    seen(eye) {
      const p = lastState?.plane;
      if (!p || !shown || p.mode === "wreck") {
        look.inside(false, false, false);
        if (sheltered) shelterOff();
        sheltered = false;
        return;
      }
      qi.set(shown.q.x, shown.q.y, shown.q.z, shown.q.w).invert();
      local.set(eye.x - shown.x, eye.y - shown.y, eye.z - shown.z).applyQuaternion(qi);
      const inside = inPlaneCabin(local);
      const own = Math.hypot(local.x - PILOT.x, local.y - PILOT.y, local.z - PILOT.z) < 0.05;
      look.inside(inside, own, !inside && local.length() < NEAR);
      // No snow falls inside the cabin the lens is in (`shelter.ts`).
      if (inside) {
        qi.invert();
        shelterAt({ ...shown, q: qi }, CABIN.centre, CABIN.half);
        sheltered = true;
      } else if (sheltered) {
        shelterOff();
        sheltered = false;
      }
    },
    lamps(lit, out) {
      const p = lastState?.plane;
      if (p && shown) look.lamps(p, shown, lit, out);
    },
    ready: look.ready,
    dispose() {
      look.dispose();
    },
  };
}
