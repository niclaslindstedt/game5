// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THROUGH THE ROTOR, AS DRAWN (`heli-grip.ts` strikes, `gore-view.ts`
// throws): every point of him a blade went through flings a fan of blood,
// flesh and bone off along the blade's way at a share of its speed — the
// mist a rotor strike leaves — and back down the wash.

import * as THREE from "three";

import { HELI_BLADES, RAGDOLL, bladeAt, type GameState } from "@engine";

import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";

import type { Blood } from "./gore-blood.ts";

/** The drops a point of him throws as a blade goes through it: a tight fan
 * along the blade and a slower, wider half as many. */
const MIST = 70;

const B = HELI_BLADES;
const edge = { x: 0, y: 0, z: 0 };
const at = new THREE.Vector3();
const way = new THREE.Vector3();

/** Every point of the thrown body a blade has been through since `drawn`
 * (a bit a point, `HeliState.taken`): its blood thrown into `blood` off a
 * body going `carry`, dealt off `rng`, and `fling` handed where it is, the blade's way there
 * (a unit) and how fast what it cuts off flies, m/s, for the flesh and bone.
 * The bits drawn now are handed back. */
export function rotorStruck(
  state: GameState,
  drawn: number,
  blood: Blood,
  carry: THREE.Vector3,
  rng: Rng,
  fling: (at: THREE.Vector3, way: THREE.Vector3, speed: number) => void,
): number {
  const h = state.heli;
  const b = state.skier.thrown;
  if (!h || !b || !(h.taken & ~drawn)) return drawn;
  const next = (): number => rng.next();
  for (let i = 0; i < RAGDOLL.count; i++) {
    if (!(h.taken & ~drawn & (1 << i))) continue;
    drawn |= 1 << i;
    at.set(b.points[3 * i], b.points[3 * i + 1], b.points[3 * i + 2]);
    bladeAt(h, at.x, at.y, at.z, edge);
    const fast = Math.hypot(edge.x, edge.y, edge.z);
    if (fast < 1) continue;
    way.set(edge.x / fast, edge.y / fast, edge.z / fast);
    const speed = Math.min(B.flingMost, fast * B.fling);
    blood.emit(at, way, speed, MIST, 0.35, carry, next);
    blood.emit(at, way, speed * 0.45, MIST / 2, 0.9, carry, next);
    fling(at, way, speed);
  }
  return drawn;
}
