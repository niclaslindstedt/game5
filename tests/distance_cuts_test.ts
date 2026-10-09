// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DISTANCE CUTS: what is drawn lighter, or not at all, far from the
// lens — the small instanced parts kept in reach (`instance-reach.ts`), the
// rock's lattice by distance (`rocks.ts`), the piste machines' far cut
// (`groomer-far.ts`), a parked machine's stand-in (`far-swap.ts`).

import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { InstanceReach, nearOf } from "../pwa/src/game/instance-reach.ts";
import { CUTS, cutOf } from "../pwa/src/game/rocks.ts";
import {
  GROOMER_FAR,
  GROOMER_MARGIN,
  createGroomerFar,
  farNow,
} from "../pwa/src/game/groomer-far.ts";
import { groomerPaint } from "../pwa/src/game/groomer-build.ts";
import { createHazeUniforms } from "../pwa/src/game/haze.ts";
import { Cut, NO_SHADOW } from "../pwa/src/game/lift-cuts.ts";
import { beyond, createFarSwap } from "../pwa/src/game/far-swap.ts";

/** `n` things in a row along x, `gap` m apart, one instanced part each
 * coloured by its index. */
function row(n: number, gap: number) {
  const mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), n);
  const points = new Float32Array(n * 3);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    points[i * 3] = i * gap;
    mesh.setMatrixAt(i, m.makeTranslation(i * gap, 0, 0));
    mesh.setColorAt(i, new THREE.Color(i / n, 0, 0));
  }
  return { mesh, points };
}

const xOf = (mesh: THREE.InstancedMesh, j: number): number =>
  mesh.instanceMatrix.array[j * 16 + 12];

describe("instance reach", () => {
  it("finds the things within reach, in order", () => {
    const { points } = row(10, 100);
    const out = new Uint32Array(10);
    const n = nearOf(points, { x: 450, y: 0, z: 0 }, 260, out);
    expect([...out.subarray(0, n)]).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it("packs the near ones to the front, colours with them, and counts only them", () => {
    const { mesh, points } = row(10, 100);
    const reach = new InstanceReach([mesh], points, 150);
    reach.update({ x: 700, y: 0, z: 0 });
    expect(mesh.count).toBe(3);
    expect([0, 1, 2].map((j) => xOf(mesh, j))).toEqual([600, 700, 800]);
    const c = new THREE.Color();
    mesh.getColorAt(1, c);
    expect(c.r).toBeCloseTo(0.7);
    // Its bound is the near ones', so three culls it whole out of view.
    expect(mesh.boundingSphere!.center.x).toBeCloseTo(700, 0);
  });

  it("draws everything with no eye, and nothing when all are out of reach", () => {
    const { mesh, points } = row(5, 100);
    const reach = new InstanceReach([mesh], points, 50);
    reach.update(null);
    expect(mesh.count).toBe(5);
    reach.update({ x: 0, y: 0, z: 5000 });
    expect(mesh.count).toBe(0);
    expect(mesh.visible).toBe(false);
  });

  it("repacks only once the eye has moved, or a part was placed anew", () => {
    const { mesh, points } = row(10, 100);
    const reach = new InstanceReach([mesh], points, 150, 10);
    reach.update({ x: 0, y: 0, z: 0 });
    expect(mesh.count).toBe(2);
    reach.update({ x: 5, y: 0, z: 0 });
    expect(mesh.count).toBe(2);
    // A part moved: kept, and handed out at the next update, at its packed
    // slot.
    reach.place(mesh, 1, new THREE.Matrix4().makeTranslation(120, 3, 0));
    reach.update({ x: 5, y: 0, z: 0 });
    expect(xOf(mesh, 1)).toBe(120);
    reach.update({ x: 900, y: 0, z: 0 });
    expect(mesh.count).toBe(2);
    expect(xOf(mesh, 0)).toBe(800);
  });
});

describe("rock cuts", () => {
  it("coarsens with distance", () => {
    expect(cutOf(50, -1)).toBe(0);
    expect(cutOf(CUTS[0].out + 1, -1)).toBe(1);
    expect(cutOf(CUTS[1].out + 1, -1)).toBe(2);
  });

  it("keeps the cut it has inside the margin either side of a band's edge", () => {
    const edge = CUTS[0].out;
    expect(cutOf(edge + 10, 0)).toBe(0);
    expect(cutOf(edge + 60, 0)).toBe(1);
    expect(cutOf(edge - 10, 1)).toBe(1);
    expect(cutOf(edge - 60, 1)).toBe(0);
    // Far past a band, straight to the cut it asks.
    expect(cutOf(5000, 0)).toBe(2);
  });
});

describe("the piste machines' far cut", () => {
  it("hands over past the far line and back inside the margin", () => {
    expect(farNow(GROOMER_FAR - 1, false)).toBe(false);
    expect(farNow(GROOMER_FAR + 1, false)).toBe(true);
    expect(farNow(GROOMER_FAR - GROOMER_MARGIN / 2, true)).toBe(true);
    expect(farNow(GROOMER_FAR - GROOMER_MARGIN - 1, true)).toBe(false);
  });

  it("is a few thousand triangles, one draw a paint, never casting", () => {
    const paint = groomerPaint(createHazeUniforms());
    const far = createGroomerFar(paint, 6);
    // The model is some 22,500 triangles a machine.
    expect(far.triangles).toBeGreaterThan(1000);
    expect(far.triangles).toBeLessThan(6000);
    const meshes = far.group.children as THREE.InstancedMesh[];
    expect(meshes.length).toBeLessThanOrEqual(12);
    for (const m of meshes) expect(m.castShadow).toBe(false);
    far.begin();
    const at = new THREE.Matrix4();
    for (let i = 0; i < 7; i++) expect(far.add(at)).toBe(i < 6);
    far.end();
    expect(meshes[0].count).toBe(6);
    far.dispose();
    paint.dispose();
  });
});

describe("a lift part's distant cut", () => {
  const geo = () => new THREE.BoxGeometry();
  const mat = new THREE.MeshBasicMaterial();
  const at = (x: number) => new THREE.Matrix4().makeTranslation(x, 0, 0);

  it("takes the near, the far and the distant cut by distance", () => {
    const cut = new Cut(geo(), geo(), mat, 8, 100, true, { geo: geo(), reach: 300 });
    cut.begin(new THREE.Vector3());
    for (const x of [10, 50, 150, 250, 350, 900]) cut.add(at(x));
    cut.end();
    expect([cut.near.count, cut.far!.count, cut.distant!.count]).toEqual([2, 2, 2]);
    expect(cut.meshes).toHaveLength(3);
  });

  it("draws nothing past its reach with no distant geometry, and everything far with no eye", () => {
    const cut = new Cut(geo(), geo(), mat, 8, 100, true, { geo: null, reach: 300 });
    cut.begin(new THREE.Vector3());
    for (const x of [10, 150, 350, 900]) cut.add(at(x));
    cut.end();
    expect([cut.near.count, cut.far!.count, cut.distant]).toEqual([1, 1, null]);
    cut.begin(null);
    for (const x of [10, 150, 350, 900]) cut.add(at(x));
    cut.end();
    expect(cut.far!.count).toBe(4);
  });
});

describe("a lift part's shadow far off", () => {
  it("hands a casting part to its far geometry, uncast, past the shadow's reach", () => {
    const far = new THREE.BoxGeometry();
    const cut = new Cut(new THREE.BoxGeometry(), far, new THREE.MeshBasicMaterial(), 8, 100);
    cut.begin(new THREE.Vector3());
    for (const x of [10, 150, NO_SHADOW + 50])
      cut.add(new THREE.Matrix4().makeTranslation(x, 0, 0));
    cut.end();
    expect([cut.near.count, cut.far!.count, cut.distant!.count]).toEqual([1, 1, 1]);
    expect(cut.distant!.geometry).toBe(far);
    expect(cut.far!.castShadow).toBe(true);
    expect(cut.distant!.castShadow).toBe(false);
  });

  it("keeps a part that casts nothing at two cuts", () => {
    const cut = new Cut(
      new THREE.BoxGeometry(),
      new THREE.BoxGeometry(),
      new THREE.MeshBasicMaterial(),
      8,
      100,
      false,
    );
    expect(cut.distant).toBeNull();
  });
});

describe("a parked machine's far cut", () => {
  const camera = (z: number) => {
    const c = new THREE.PerspectiveCamera();
    c.position.set(0, 0, z);
    c.updateMatrixWorld();
    return c;
  };

  it("hands over past the far line and back inside the margin", () => {
    expect(beyond(99, false, 100, 20)).toBe(false);
    expect(beyond(101, false, 100, 20)).toBe(true);
    expect(beyond(90, true, 100, 20)).toBe(true);
    expect(beyond(79, true, 100, 20)).toBe(false);
  });

  it("shows the stand-in far off, the model near, and only the model when held", () => {
    const swap = createFarSwap(100, 20);
    const model = new THREE.Group();
    const stand = new THREE.Group();
    swap.hold(model, stand);
    swap.node.updateMatrixWorld();
    swap.node.update(camera(150));
    expect([model.visible, stand.visible, swap.far]).toEqual([false, true, true]);
    swap.node.update(camera(90));
    expect(swap.far).toBe(true);
    swap.node.update(camera(50));
    expect([model.visible, stand.visible]).toEqual([true, false]);
    swap.node.update(camera(150));
    swap.allow(false);
    expect([model.visible, stand.visible]).toEqual([true, false]);
    swap.node.update(camera(500));
    expect(swap.far).toBe(false);
  });
});
