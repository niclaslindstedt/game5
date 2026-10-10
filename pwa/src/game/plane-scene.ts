// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE IN THE RENDERER — the one hand the renderer holds it by
// (through `machines.ts`): the airframe drawn off the engine's plane
// (`plane-standin.ts`, built off `PLANE`), its propeller turned, its blur
// disc faded in with the spin, its surfaces on their hinges where the
// engine has them, charred where it came down; and the lens it takes while
// the skier stands in its door (`camera-plane.ts`).
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
import { createPlaneStandIn } from "./plane-standin.ts";
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
  dispose(): void;
};

/** How long the exit's lens is held after the jump, s, and how long its
 * look takes to come round onto him; how long the lens takes to fly onto
 * the plane as he boards, and back to the ladder after the exit, s. */
const DROP_HOLD = 1.6;
const DROP_TURN = 0.5;
const HAND_IN = 1.1;
const HAND_OUT = 1.3;
/** The blur disc's opacity at the propeller's full spin. */
const DISC = 0.45;
/** How far the wreck is charred, 0..1, and how long the charring takes, s. */
const CHAR = 0.85;
const CHAR_TIME = 3;

export function createPlaneScene(haze: HazeUniforms): PlaneScene {
  const look = createPlaneStandIn(haze);
  const group = new THREE.Group();
  group.name = "plane";
  group.add(look.group);
  group.visible = false;
  const colours = look.materials.map((m) => m.color.clone());
  const track = createTrack();
  const at: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  let shown: PlaneAt | null = null;
  const cam = createPlaneCam();
  let charred = 0;
  let wrecked = false;
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

  function char(k: number): void {
    if (k === charred) return;
    look.materials.forEach((m, i) => m.color.copy(colours[i]).multiplyScalar(1 - k));
    charred = k;
  }

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
      char(wreck ? CHAR * Math.min(1, p.t / CHAR_TIME) : 0);
      observe(track, { x: p.x, y: p.y, z: p.z, q: p.q }, state.tick);
      sample(track, alpha, at);
      look.group.position.set(at.x, at.y, at.z);
      look.group.quaternion.set(at.q.x, at.q.y, at.q.z, at.q.w);
      shown = { x: at.x, y: at.y, z: at.z, q: { ...at.q } };
      // The propeller turned clockwise seen from the cockpit, its blur
      // faded in as it spins up; the surfaces where the engine has them.
      look.prop.rotation.z = -p.prop;
      look.disc.material.opacity = DISC * Math.max(0, Math.min(1, (p.spin - 0.2) / 0.6));
      look.elevator.rotation.x = -p.surfaces.elevator;
      look.rudder.rotation.y = -p.surfaces.rudder;
      look.ailerons[0].rotation.x = -p.surfaces.aileron;
      look.ailerons[1].rotation.x = p.surfaces.aileron;
      const flap = -p.surfaces.flaps * PLANE.controls.flaps;
      look.flaps[0].rotation.x = flap;
      look.flaps[1].rotation.x = flap;

      const groundAt = (x: number, z: number) => state.level.groundAt(x, z);
      const step = Math.min(dt, 0.1);
      if (!p.rider || wreck) {
        look.inside(false);
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
      look.inside(rung === "helmet");
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
    dispose() {
      look.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const m of look.materials) m.dispose();
      look.disc.material.dispose();
    },
  };
}
