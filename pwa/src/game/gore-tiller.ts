// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// UNDER A PISTE MACHINE, AS DRAWN (`gore.ts`'s `underMachine` tears, this
// throws): while any point of him lies under a working machine's belts
// and tiller, the tiller's shaft — turning at some 1000 a minute — chews
// it and SPITS it out of the back of the hood: a jet of blood mist,
// gobbets of flesh and splinters of bone thrown out behind the machine and
// up, across the width of the swath where he lies, and the corduroy it
// lays down smeared red behind it. The rotor's fan (`gore-rotor.ts`) for
// the machine that works slower.

import * as THREE from "three";

import { GORE, GROOMER, RAGDOLL, type GameState } from "@engine";

import type { Rng } from "@niclaslindstedt/oss-game-framework/core/prng";

/** The blood it throws into (`gore-blood.ts`'s `Blood`, stated here so
 * the suite reads this module without the drawing's DOM). */
export type TillerBlood = {
  emit(
    at: THREE.Vector3,
    dir: THREE.Vector3,
    speed: number,
    count: number,
    spread: number,
    carry: THREE.Vector3,
    next: () => number,
  ): void;
  splat(x: number, z: number, r: number, shade: number, turn: number): void;
};

/** THE SPIT: drops a second for every point of him under the tiller, and
 * the most a frame; the chance a second a point under it throws a gobbet
 * (and a splinter of bone); how far up the hood's mouth stands over the
 * snow, m; the jet's rise over the level, a share of its way out; the
 * smear's width on the corduroy, m, and a blot laid every this many m of
 * the machine's travel. */
export const TILLER = {
  mist: 700,
  most: 400,
  chunk: 8,
  mouth: 0.45,
  rise: 0.9,
  smear: 0.55,
  every: 0.35,
} as const;

const at = new THREE.Vector3();
const way = new THREE.Vector3();
const carry = new THREE.Vector3();

/** How far each machine has gone since its last smear, m, keyed by it. */
const memory = new WeakMap<object, number>();

/** One frame of `simDt` game seconds of every working machine over him:
 * its blood thrown into `blood` and blotted on the snow at `groundAt`,
 * dealt off `rng`, and `fling` handed where each gobbet leaves the hood,
 * its way out (a unit) and how fast, m/s. */
export function tillerSpray(
  state: GameState,
  simDt: number,
  blood: TillerBlood,
  rng: Rng,
  groundAt: (x: number, z: number) => number,
  fling: (at: THREE.Vector3, way: THREE.Vector3, speed: number) => void,
): void {
  const ms = state.groomers;
  const b = state.skier.thrown;
  if (!ms || !b || simDt <= 0) return;
  const M = GORE.machine;
  const K = GROOMER;
  const next = (): number => rng.next();
  for (const m of ms) {
    if (m.rider || Math.abs(m.speed) < M.speed) continue;
    const dir = Math.sign(m.speed);
    const fx = Math.sin(m.heading);
    const fz = Math.cos(m.heading);
    const lead = dir > 0 ? K.front : K.back;
    const tail = dir > 0 ? K.back : K.front;
    // The points of him under it — the engine's own footprint — and where
    // across it they lie.
    let n = 0;
    let across = 0;
    for (let i = 0; i < RAGDOLL.count; i++) {
      const px = b.points[3 * i];
      const pz = b.points[3 * i + 2];
      if (b.points[3 * i + 1] > m.y + M.over) continue;
      const dx = px - m.x;
      const dz = pz - m.z;
      const u = (dx * fx + dz * fz) * dir;
      const v = dx * fz - dz * fx;
      if (u > lead - M.behind || u < -tail || Math.abs(v) > K.half) continue;
      n++;
      across += v;
    }
    if (n === 0) continue;
    across = Math.max(-K.tiller.width / 2, Math.min(K.tiller.width / 2, across / n));
    // The hood's mouth, behind the tiller where he lies across it.
    const bx = m.x - fx * tail * dir + fz * across;
    const bz = m.z - fz * tail * dir - fx * across;
    at.set(bx, groundAt(bx, bz) + TILLER.mouth, bz);
    way.set(-fx * dir, TILLER.rise, -fz * dir).normalize();
    const speed = M.spit + Math.abs(m.speed);
    carry.set(fx * m.speed, 0, fz * m.speed);
    const drops = Math.min(TILLER.most, Math.ceil(TILLER.mist * n * simDt));
    blood.emit(at, way, speed, drops, 0.3, carry, next);
    blood.emit(at, way, speed * 0.4, Math.ceil(drops / 2), 0.8, carry, next);
    if (next() < 1 - Math.exp(-TILLER.chunk * n * simDt)) fling(at, way, speed);
    // The corduroy laid red behind it.
    const gone = (memory.get(m) ?? TILLER.every) + Math.abs(m.speed) * simDt;
    if (gone >= TILLER.every) {
      blood.splat(bx, bz, TILLER.smear * (0.7 + 0.6 * next()), 1, next() * Math.PI * 2);
      memory.set(m, 0);
    } else memory.set(m, gone);
  }
}
