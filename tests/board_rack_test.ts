// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A MACHINE CARRIES FOR HIM: a snowboarder's board stowed where a
// skier's pair rides (`board-rack.ts`), and the snowmobile's rack read off
// its own geometry and unloaded of the poles he does not carry
// (`sled-rack.ts`).

import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { pairById, teeSide, TUNING, type GameState } from "@engine";
import { BOARD_TOW, boardStem } from "../pwa/src/game/board-lift.ts";

import { buildRackedBoard, stowBoard } from "../pwa/src/game/board-rack.ts";
import { basketFree, createSledRack, fitRack } from "../pwa/src/game/sled-rack.ts";

const plain = <M extends THREE.Material>(m: M): M => m;

/** A rod of `n` points from `a` to `b`, thickened a little so its
 * covariance has some width. */
function rod(a: THREE.Vector3, b: THREE.Vector3, n = 40, r = 0.01): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const p = a.clone().lerp(b, i / (n - 1));
    out.push(p.clone().add(new THREE.Vector3(r, 0, 0)), p.clone().add(new THREE.Vector3(-r, 0, 0)));
  }
  return out;
}

function mesh(points: THREE.Vector3[], name: string, indexed = false): THREE.Mesh {
  const g = new THREE.BufferGeometry().setFromPoints(points);
  if (indexed) {
    const idx: number[] = [];
    for (let i = 0; i + 2 < points.length; i += 3) idx.push(i, i + 1, i + 2);
    g.setIndex(idx);
  }
  const m = new THREE.MeshStandardMaterial();
  m.name = name;
  return new THREE.Mesh(g, m);
}

/** A rack like the model's: a pair on the left of the tunnel (x < 0),
 * rising toward +z, and two poles beside it with baskets at their feet. */
function rackNode(): THREE.Group {
  const rack = new THREE.Group();
  const lo = new THREE.Vector3(-0.32, 0.5, -0.6);
  const hi = new THREE.Vector3(-0.32, 0.9, 0.9);
  rack.add(mesh(rod(lo, hi), "rack_ski"));
  rack.add(mesh(rod(lo, hi, 10), "rack_trim"));
  const pLo = new THREE.Vector3(-0.38, 0.45, -0.7);
  const pHi = new THREE.Vector3(-0.38, 0.85, 0.6);
  rack.add(mesh(rod(pLo, pHi), "aluminium"));
  rack.add(mesh(rod(pHi, pHi.clone().add(new THREE.Vector3(0, 0.01, 0.1)), 6), "rubber"));
  // The base: the pair's underside, and a basket 9 cm up the poles.
  const dir = pHi.clone().sub(pLo).normalize();
  const basket = pLo.clone().addScaledVector(dir, 0.09);
  const tris: THREE.Vector3[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    tris.push(
      basket.clone(),
      basket.clone().add(new THREE.Vector3(Math.cos(a) * 0.045, Math.sin(a) * 0.045, 0)),
      basket.clone().add(new THREE.Vector3(Math.cos(a + 1) * 0.045, Math.sin(a + 1) * 0.045, 0)),
    );
  }
  for (const p of rod(lo, hi, 10)) tris.push(p.clone().add(new THREE.Vector3(0.012, 0, 0)));
  while (tris.length % 3) tris.pop();
  rack.add(mesh(tris, "rack_base", true));
  return rack;
}

describe("a board stowed on a machine", () => {
  it("is his own board, deck and both bindings, its length his", () => {
    const spec = pairById("lynx");
    const b = buildRackedBoard(spec, plain);
    expect(b.length).toBe(spec.length);
    // The deck and two bindings.
    expect(b.group.children.length).toBe(3);
    b.dispose();
  });

  it("stands on edge, its length along the rack and its top facing out", () => {
    const g = new THREE.Group();
    const along = { x: 0, y: 0.3, z: 1 };
    stowBoard(g, along, { x: -1, y: 0.2, z: 0 }, { x: -0.3, y: 0.7, z: 0.1 });
    const z = new THREE.Vector3(0, 0, 1).applyQuaternion(g.quaternion);
    const y = new THREE.Vector3(0, 1, 0).applyQuaternion(g.quaternion);
    expect(z.dot(new THREE.Vector3(along.x, along.y, along.z).normalize())).toBeCloseTo(1, 6);
    // Its top out, squared off its length.
    expect(y.x).toBeLessThan(-0.9);
    expect(Math.abs(y.dot(z))).toBeLessThan(1e-6);
    expect(g.position.toArray()).toEqual([-0.3, 0.7, 0.1]);
  });
});

describe("the snowmobile's rack", () => {
  it("is read off the pair's own geometry: along it rising, out from the tunnel", () => {
    const fit = fitRack(rackNode())!;
    expect(fit.along.y).toBeGreaterThan(0);
    expect(fit.along.z).toBeGreaterThan(0.9);
    expect(fit.out.x).toBeLessThan(-0.99);
    // The inner face, toward the tunnel from the pair's middle.
    expect(fit.base.x).toBeGreaterThan(-0.32);
    expect(fit.base.x).toBeLessThan(-0.3);
  });

  it("cuts the baskets out of the base and keeps the pair", () => {
    const rack = rackNode();
    const base = rack.children.find(
      (o) => o instanceof THREE.Mesh && (o.material as THREE.Material).name === "rack_base",
    ) as THREE.Mesh;
    const whole = base.geometry.index!.count;
    const bare = basketFree(rack, base)!;
    expect(bare.count).toBe(whole - 12);
  });

  it("hides the poles he rides without, and the pair and poles for his board", () => {
    const rack = rackNode();
    const sled = createSledRack(rack, plain);
    const shown = () =>
      rack.children
        .filter((o) => o instanceof THREE.Mesh && o.visible)
        .map((o) => ((o as THREE.Mesh).material as THREE.Material).name)
        .sort();
    const chamois = pairById("chamois");
    sled.stow({ spec: chamois, poles: true, body: 0xff0000, trim: 0xffffff });
    expect(shown()).toEqual(["aluminium", "rack_base", "rack_ski", "rack_trim", "rubber"]);
    sled.stow({ spec: chamois, poles: false, body: 0xff0000, trim: 0xffffff });
    expect(shown()).toEqual(["rack_base", "rack_ski", "rack_trim"]);
    sled.stow({ spec: pairById("lynx"), poles: false, body: 0, trim: 0 });
    expect(shown()).toEqual([]);
    expect(rack.children.some((o) => o.name === "racked-board")).toBe(true);
    sled.stow({ spec: chamois, poles: true, body: 0, trim: 0 });
    expect(rack.children.some((o) => o.name === "racked-board")).toBe(false);
    sled.dispose();
  });
});

describe("a snowboarder on a T-bar", () => {
  it("rides under the rope with the bar between his legs; a skier on its right arm", () => {
    const run = (id: string) => ({ skier: { spec: pairById(id) } }) as unknown as GameState;
    expect(teeSide(run("lynx"))).toBe(0);
    expect(teeSide(run("chamois"))).toBe(TUNING.lift.tee);
    // The stem rises from the bar's middle at his centre, up the track.
    const top = boardStem(0.6);
    expect(top.x).toBe(0);
    expect(top.y).toBeGreaterThan(BOARD_TOW.y);
    expect(top.z).toBeGreaterThan(BOARD_TOW.z);
  });
});
