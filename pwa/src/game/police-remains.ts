// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE BODY THE POLICE COME FOR, ONE BODY — a dead rider is left lying where
// he died (`gore-view.ts`' remains: his body as last drawn, torn and
// soaked, in the pose he came to rest in), and a police call
// (`police-plan.ts`) carries a body away from the same place. So the
// remains ARE the body the whole time: the call's own lying figure is never
// drawn beside them. When the recovery rolls him onto the bag, the part of
// the statue that is HIM (his dressed skin, and what lies on him — not his
// skis or his poles) is moved as the scoop moves the
// casualty (`police-bag.ts`' `statueDelta`, handed back by the call), and
// once the bag's lid is down over him that part goes out of sight for good:
// the bag carries him from there. His blood and what was torn off him stay
// on the snow. His KIT lying where the bag is to be laid (a ski, a pole —
// the statue's parts that are not him) is gathered up by the photographer
// once the last photograph is taken and carried aboard as evidence
// (`police-kit.ts`, timed by `police-plan.ts`' `kit`), so the bag is
// never laid over it.
// Presentation only: `renderer.ts` hands the one view's answer to the other
// every frame.

import * as THREE from "three";
import { RAGDOLL, type GameState } from "@engine";

import type { Remains } from "./gore-remains.ts";
import { SMALL, gatherKit, type KitFrame } from "./police-kit.ts";
import { LOOSE } from "./trail-stamp.ts";

/** How near a body left lying must be to a call's casualty to be his, m. */
const SAME = 2.5;
/** How far from his hips a part of the statue is still him, m (the largest
 * a part that is not his skin can be and still be on him is `SMALL`). */
const REACH = 1.5;

/** A police call's casualty this frame: where he lay; whether its crew
 * have begun on him (`taken`); the world matrix his body is moved by (16
 * numbers, column-major, or null: where it lies); and whether the bag is
 * shut over him (`shut`: from then he is the bag). */
export type Taken = {
  x: number;
  z: number;
  taken: boolean;
  delta: readonly number[] | null;
  shut: boolean;
  /** His kit gathered out of the bag's way (`kitOf`), or null. */
  kit: KitFrame | null;
};

/** Where a body lies: his hips, and the way his head points from his feet. */
export type Lying = { x: number; z: number; heading: number };

/** Where a dead run left him lying: his hips (else where he stood) and his
 * line. */
function lying(run: GameState): Lying {
  const P = run.skier.thrown?.points;
  if (!P) return { x: run.skier.x, z: run.skier.z, heading: run.skier.heading };
  const R = RAGDOLL;
  const x = (P[3 * R.hipL] + P[3 * R.hipR]) / 2;
  const z = (P[3 * R.hipL + 2] + P[3 * R.hipR + 2]) / 2;
  const fx = (P[3 * R.footL] + P[3 * R.footR]) / 2;
  const fz = (P[3 * R.footL + 2] + P[3 * R.footR + 2]) / 2;
  const heading = Math.atan2(P[3 * R.head] - fx, P[3 * R.head + 2] - fz);
  return { x, z, heading };
}

/** Where every body left lying lies. */
export const remainsAt = (all: readonly Remains[]): Lying[] => all.map((r) => lying(r.run));

/** The body left lying at (`x`, `z`), or null. */
export const lyingAt = (spots: readonly Lying[], x: number, z: number): Lying | null =>
  spots.find((p) => Math.hypot(p.x - x, p.z - z) < SAME) ?? null;

/** Whether a body is left lying at (`x`, `z`). */
export const lyingNear = (spots: readonly Lying[], x: number, z: number) =>
  lyingAt(spots, x, z) !== null;

/** The part of a statue that is him, gathered under one group of its own
 * the first time it is drawn; and the bodies the police have bagged. */
const bodies = new WeakMap<Remains, THREE.Group>();
const bagged = new WeakSet<Remains>();

function himOf(r: Remains): THREE.Group {
  const had = bodies.get(r);
  if (had) return had;
  const at = lying(r.run);
  const him = new THREE.Group();
  him.name = "remains-him";
  him.matrixAutoUpdate = false;
  const o = r.body.position;
  for (const child of [...r.body.children]) {
    const mesh = child as THREE.Mesh;
    const sphere = mesh.geometry?.boundingSphere;
    if (!sphere) continue;
    const c = sphere.center;
    if (Math.hypot(o.x + c.x - at.x, o.z + c.z - at.z) > REACH) continue;
    if (!mesh.userData.skin && sphere.radius > SMALL) continue;
    him.add(mesh);
  }
  r.body.add(him);
  bodies.set(r, him);
  return him;
}

/** How high a man's hips lie over the snow he lies on, m: his seat's flesh. */
const HIPS = 0.12;

/** HOW FAR HE IS LIFTED OUT OF HIS DENT, m. The ragdoll lies in the snow
 * with his joints at the ground, and while his run was drawn the snow was
 * dented under him; the next run's snow is drawn whole, so the statue would
 * lie half under it. The part of him that is him is stood back on the drawn
 * snow: his hips their own height over it, never pushed down. */
function restOf(run: GameState): number {
  const P = run.skier.thrown?.points;
  if (!P) return 0;
  const R = RAGDOLL;
  const at = lying(run);
  const hips = (P[3 * R.hipL + 1] + P[3 * R.hipR + 1]) / 2;
  const level = run.level;
  const top = level.groundAt(at.x, at.z) + LOOSE * (1 - level.packedAt(at.x, at.z));
  return Math.max(0, top + HIPS - hips);
}

const rest = new THREE.Matrix4();
const delta = new THREE.Matrix4();
const base = new THREE.Matrix4();

/** THE BODIES LEFT LYING, as the police find and take them: each lying on
 * the snow as drawn, moved as a call moves him, and out of sight once he is
 * in the bag. */
export function bagRemains(all: readonly Remains[], calls: readonly Taken[]): void {
  for (const r of all) {
    const at = lying(r.run);
    const c = calls.find((k) => k.taken && Math.hypot(k.x - at.x, k.z - at.z) < SAME);
    if (c?.shut) bagged.add(r);
    const him = himOf(r);
    him.visible = !bagged.has(r);
    // Lifted out of the dent he lay in, and moved as the call moves him:
    // into the statue's own frame, moved, and back out of it.
    rest.makeTranslation(0, restOf(r.run), 0);
    if (c?.delta) {
      base.makeTranslation(r.body.position.x, r.body.position.y, r.body.position.z);
      delta.fromArray(c.delta);
      him.matrix.copy(base).invert().multiply(delta).multiply(base).multiply(rest);
    } else him.matrix.copy(rest);
    him.matrixWorldNeedsUpdate = true;
    const k = calls.find((q) => q.kit && Math.hypot(q.x - at.x, q.z - at.z) < SAME)?.kit;
    if (k) gatherKit(r, k, him);
  }
}
