// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHERE ONE TREE IS DRAWN: the place, turn, lean, size and girth an
// instance of it stands at — stated once, for the woods (`forest.ts`) and
// for anything drawn over one tree of them (the blood on a tree a skier is
// run through, `gore-tree.ts`), so the two stand as one tree.

import * as THREE from "three";
import type { Level, TreeDef, Vec3 } from "@engine";

import { TRUNK_REF } from "./tree-mesh.ts";
import { treeTilt, trunkYaw, type Tilt } from "./tree-tilt.ts";
import { leadVariant } from "./tree-variants.ts";

/** A hash of a tree's place, 0..1: its tone, and how broad and oval it is. */
export function treeHash(x: number, z: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
  return s - Math.floor(s);
}

/** One tree as drawn: its foot `p`, its turn and lean `q`, its size `s` (the
 * shapes are built a metre tall and a metre in crown) and its trunk's GIRTH
 * on each stretched axis (the trunk's radius over the radius the shapes are
 * built with). */
export type TreePlace = {
  p: THREE.Vector3;
  q: THREE.Quaternion;
  s: THREE.Vector3;
  girth: [number, number];
};

export const createTreePlace = (): TreePlace => ({
  p: new THREE.Vector3(),
  q: new THREE.Quaternion(),
  s: new THREE.Vector3(),
  girth: [1, 1],
});

const up = new THREE.Vector3(0, 1, 0);
const across = new THREE.Vector3();
const lean = new THREE.Quaternion();
const ground: Vec3 = { x: 0, y: 1, z: 0 };

/** Stand `t` into `out`; its LEAN off plumb is handed back. */
export function placeTree(level: Level, t: TreeDef, out: TreePlace): Tilt {
  // Turned about its own axis, then LEANT off plumb about its foot
  // (`tree-tilt.ts`): mostly a few degrees, mostly down the slope.
  level.normalAt(t.x, t.z, ground);
  const tilt = treeTilt(t.x, t.z, leadVariant(t.kind ?? "spruce").shape.form, ground.x, ground.z);
  across.set(tilt.dz, 0, -tilt.dx);
  lean.setFromAxisAngle(across, tilt.angle);
  out.q.setFromAxisAngle(up, trunkYaw(t.x, t.z)).premultiply(lean);
  // The crown the generator gives is the collision's idea of it; drawn a
  // touch narrower so a wood keeps gaps between its trees — and every tree
  // a little broader or slimmer and a little oval, off a hash of its
  // place, so no two of one variant stand as the same tree.
  const broad = 0.86 + 0.18 * treeHash(t.x * 0.37 + 3, t.z * 1.9);
  const oval = 0.9 + 0.2 * treeHash(t.x * 2.3, t.z * 0.41 - 7);
  out.s.set(t.crown * 0.95 * broad * oval, t.height, (t.crown * 0.95 * broad) / oval);
  out.girth[0] = t.radius / (TRUNK_REF * out.s.x);
  out.girth[1] = t.radius / (TRUNK_REF * out.s.z);
  // Sunk a little, so a tree on a slope stands in the snow — and a leaning
  // one by as much again as its flared foot rises on the side it leans
  // from.
  out.p.set(t.x, t.y - 0.3 - t.radius * 1.45 * Math.sin(tilt.angle), t.z);
  return tilt;
}
