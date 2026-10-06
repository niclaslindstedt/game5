// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SLALOM'S POLES, DRAWN — every pole of its pole gates (R31) as the flex
// pole it is: a plastic pole on a hinge at the snow, red or blue as its
// gate, no panel. An open gate's two poles, a closed gate's two one above
// the other. Each lies over as the engine says the racer has knocked it
// (`GameState.gatePoles`: how far over, which way) and swings back up on
// its hinge — read every frame, so a knocked pole is seen going down under
// the racer's guard and springing back behind him.
//
// THE GATE OWED is the loud one: its poles breathe a little light, and the
// marker turns over its turning pole, so the next gate reads down the
// course before its thin poles do.

import * as THREE from "three";
import { polePlan, type GameState, type Level } from "@engine";

import { PALETTE } from "../identity.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { gatePole } from "./mark-shapes.ts";

/** A slalom pole, m: its height over the snow and its radius — a flex pole
 * stands at least 1.8 m and is about 30 mm across. */
const POLE = { height: 1.8, radius: 0.016 };

export type SlalomPoles = {
  group: THREE.Group;
  /** Where the owed gate's turning pole's top is, for the marker over it;
   * null on a gate that has none. */
  top(gate: number): THREE.Vector3 | null;
  update(state: GameState): void;
  dispose(): void;
};

/** THE POLES of `level`'s pole gates, or null on a map with none. */
export function createSlalomPoles(level: Level, haze: HazeUniforms): SlalomPoles | null {
  const plan = polePlan(level);
  if (plan.count === 0) return null;
  const group = new THREE.Group();
  group.name = "slalom-poles";
  const geo = gatePole(POLE.height, POLE.radius);
  const mat = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }),
    haze,
    "slalom-pole",
  );
  const poles = new THREE.InstancedMesh(geo, mat, plan.count);
  poles.castShadow = true;
  group.add(poles);
  const red = new THREE.Color(PALETTE.flag);
  const blue = new THREE.Color(PALETTE.gateBlue);
  const base: THREE.Color[] = [];
  const feet: THREE.Vector3[] = [];
  for (let i = 0; i < plan.count; i++) {
    const x = plan.xz[i * 2];
    const z = plan.xz[i * 2 + 1];
    feet.push(new THREE.Vector3(x, level.groundAt(x, z) - 0.05, z));
    const c = level.checkpoints[plan.gate[i]];
    base.push(c.colour === "blue" ? blue : red);
    poles.setColorAt(i, base[i]);
  }
  /** Which pole is a gate's turning pole: an open gate's at the end its
   * `turn` names (the plan lists a gate's left end first), a closed gate's
   * the upper. */
  const turning = new Map<number, number>();
  for (let i = 0; i < plan.count; i += 2) {
    const c = level.checkpoints[plan.gate[i]];
    turning.set(plan.gate[i], c.pole === "open" && c.turn === 1 ? i + 1 : i);
  }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const glow = new THREE.Color();
  let lit = -1;
  const place = (i: number, tilt: number, dx: number, dz: number): void => {
    if (tilt === 0) q.identity();
    else {
      // Over toward (dx, dz): about the level axis square to it.
      axis.set(dz, 0, -dx).normalize();
      q.setFromAxisAngle(axis, tilt);
    }
    poles.setMatrixAt(i, m4.compose(feet[i], q, one));
  };
  for (let i = 0; i < plan.count; i++) place(i, 0, 1, 0);
  poles.instanceMatrix.needsUpdate = true;
  return {
    group,
    top(gate) {
      const i = turning.get(gate);
      return i === undefined ? null : feet[i].clone().setY(feet[i].y + POLE.height + 1.2);
    },
    update(state) {
      const tilt = state.gatePoles;
      if (tilt) {
        for (let i = 0; i < plan.count; i++) place(i, tilt.tilt[i], tilt.dirX[i], tilt.dirZ[i]);
        poles.instanceMatrix.needsUpdate = true;
      }
      // The owed gate's poles breathing.
      const next = state.progress.nextCheckpoint;
      for (let i = 0; i < plan.count; i++) {
        const owed = plan.gate[i] === next;
        if (!owed && plan.gate[i] !== lit) continue;
        glow.copy(base[i]).multiplyScalar(owed ? 1.2 + 0.25 * Math.sin(state.t * 4) : 1);
        poles.setColorAt(i, glow);
      }
      lit = next;
      if (poles.instanceColor) poles.instanceColor.needsUpdate = true;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
      poles.dispose();
    },
  };
}
