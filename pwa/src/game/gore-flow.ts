// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE THE BLOOD OF A PART HIT HARD LEAVES HIM, AND HOW FAST — for
// `gore-view.ts`. Under his clothes it runs out at the lowest gap in them
// (`gore-leaks.ts`); a head split open has nothing over its face, so it
// runs down the bare skin from under the nose and off the chin or the
// cheek he lies on, in a stream and drops.

import * as THREE from "three";
import type { Bleed, BodyPart } from "@engine";

import { cheekAt, gapAt, lowestGap, noseAt, partAt, soakPath } from "./gore-leaks.ts";
import type { BoneFrame, SkierBone } from "./skier-rig.ts";

type V3 = { x: number; y: number; z: number };
type Frames = Record<SkierBone, BoneFrame>;
type Rgb = readonly [number, number, number];

/** Where the blood leaves him: a torn wound's own place, or the gap in his
 * clothes a part hit hard (`part`) runs out of. */
export type Leak = {
  at: THREE.Vector3;
  dir: THREE.Vector3;
  share: number;
  key: string;
  part?: BodyPart;
  /** Out of his bare face, run over it from these points: no cloth holds it. */
  lead?: THREE.Vector3[];
};

/** Which cheek his face's blood runs over as he lies (−1 left, 1 right),
 * and how far down it (0 … 1). */
export type Cheek = { side: number; lean: number };

/** How fast blood leaves a torn artery at a beat's crest over its pour
 * between, m/s — out of a stump it pumps, never far. */
const JET = 1.3;
const POUR = 0.3;
/** How fast it runs out of a gap in his clothes, m/s. */
const SEEP = 0.12;
/** How fast it runs off his bare face, m/s. */
const FACE = 0.25;
/** The most drops a second that fall off his face beside the stream. */
export const DRIPS = 14;
/** How far off his skin the blood down his face is drawn, m. */
const FACE_OFF = 0.02;
/** Fresh blood on his skin, linear RGB. */
const ON_SKIN: Rgb = [0.32, 0.01, 0.008];

/** How fast a leak pours, m/s, on the beat (`beat` 0 … 1) of a heart at
 * `rate` a minute. */
export function pourOf(w: Leak, beat: number, rate: number): number {
  if (w.lead) return FACE * (1 + beat);
  if (w.part) return SEEP * (1 + beat);
  return rate > 0 ? POUR + JET * beat : POUR * 0.5;
}

/** Every part hit hard, as a leak where it leaves him on frames `f` drawn
 * through `M`; `cheek` is set to the cheek a face's blood runs over. */
export function hardLeaks(
  hard: readonly Bleed[],
  f: Frames,
  M: THREE.Matrix4,
  cheek: Cheek,
): Leak[] {
  const world = (p: V3) => new THREE.Vector3(p.x, p.y, p.z).applyMatrix4(M);
  const out: Leak[] = [];
  for (const h of hard) {
    if (h.part === "head") {
      // Off the lowest of the face as he lies (the chin, a cheek), run
      // down the skin to it from under his nose — each point stood just
      // off the face so the stream lies on it, not in it.
      const mid = world(partAt("head", f));
      const off = (p: THREE.Vector3) => p.addScaledVector(p.clone().sub(mid).normalize(), FACE_OFF);
      let at = world(gapAt("face", f));
      const chin = at.y;
      cheek.lean = 0;
      for (const side of [-1, 1]) {
        const c = world(cheekAt(f, side));
        if (c.y < at.y) {
          at = c;
          cheek.side = side;
          cheek.lean = Math.min(1, (chin - c.y) / 0.05);
        }
      }
      const nose = world(noseAt(f));
      const half = off(nose.clone().lerp(at, 0.5));
      off(nose);
      off(at);
      const dir = at.clone().sub(mid).normalize().multiplyScalar(0.3);
      dir.y -= 1;
      out.push({ at, dir: dir.normalize(), share: h.out, key: "face", lead: [nose, half] });
      continue;
    }
    const gap = lowestGap(h.part, f, (p) => world(p).y);
    const from = world(partAt(h.part, f));
    const at = world(gapAt(gap, f));
    const dir = at.clone().sub(from).normalize().multiplyScalar(0.35);
    dir.y -= 1;
    out.push({ at, dir: dir.normalize(), share: h.out, key: gap, part: h.part });
  }
  return out;
}

/** His bare face run red on the bind pose `bind`: from under the nose down
 * to the chin, and over the cheek it runs off when he lies on his side —
 * fresh blood on skin, not soaked black into cloth. */
export function faceRuns(bind: Frames, cheek: Cheek): { at: V3; r: number; blood: Rgb }[] {
  return [
    ...soakPath(noseAt(bind), gapAt("face", bind), 1, 0.05),
    ...soakPath(noseAt(bind), cheekAt(bind, cheek.side), cheek.lean, 0.045),
  ].map((p) => ({ ...p, blood: ON_SKIN }));
}
