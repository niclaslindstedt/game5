// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE BLOOD OF A PART HIT HARD LEAVES HIM, AND HOW FAST — for
// `gore-view.ts`. Under his clothes it runs out at the lowest gap in them
// (`gore-leaks.ts`); a torn wound pours where it is.

import * as THREE from "three";
import type { Bleed, BodyPart } from "@engine";

import { gapAt, lowestGap, partAt } from "./gore-leaks.ts";
import type { BoneFrame, SkierBone } from "./skier-rig.ts";

type Frames = Record<SkierBone, BoneFrame>;

/** Where the blood leaves him: a torn wound's own place, or the gap in his
 * clothes a part hit hard (`part`) runs out of. */
export type Leak = {
  at: THREE.Vector3;
  dir: THREE.Vector3;
  share: number;
  key: string;
  part?: BodyPart;
};

/** How fast blood leaves a torn artery at a beat's crest over its pour
 * between, m/s — out of a stump it pumps, never far. */
const JET = 1.3;
const POUR = 0.3;
/** How fast it runs out of a gap in his clothes, m/s. */
const SEEP = 0.12;

/** How fast a leak pours, m/s, on the beat (`beat` 0 … 1) of a heart at
 * `rate` a minute. */
export function pourOf(w: Leak, beat: number, rate: number): number {
  if (w.part) return SEEP * (1 + beat);
  return rate > 0 ? POUR + JET * beat : POUR * 0.5;
}

/** Every part hit hard, as a leak out of the lowest gap in his clothes on
 * frames `f` drawn through `M`. */
export function hardLeaks(hard: readonly Bleed[], f: Frames, M: THREE.Matrix4): Leak[] {
  const world = (p: { x: number; y: number; z: number }) =>
    new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(M);
  return hard.map((h) => {
    const gap = lowestGap(h.part, f, (p) => world(p).y);
    const from = world(partAt(h.part, f));
    const at = world(gapAt(gap, f));
    const dir = at.clone().sub(from).normalize().multiplyScalar(0.35);
    dir.y -= 1;
    return { at, dir: dir.normalize(), share: h.out, key: gap, part: h.part };
  });
}
