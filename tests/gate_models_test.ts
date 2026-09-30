// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED MARKS OF THE COURSE (`pwa/src/game/gate-models.ts`, made by
// `make blender KIND=gate` off `start-arch.ts`, published packed in
// `pwa/models/gates/`): every role the builder paints with is one the game
// can dress; the stretch that fits the one modelled arch to any line keeps
// its shoulders and feet whole; and both committed models decode, through
// three's own loader and meshopt decoder, to their parts in the frame
// `gates.ts` instances them in.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { describe, expect, it } from "vitest";

import {
  GATE_PARTS,
  archModel,
  checkpointModel,
  gateRoleColour,
  remap,
  setGateModel,
} from "../pwa/src/game/gate-models.ts";
import { readStaticModel, type StaticModel } from "../pwa/src/game/model-parts.ts";
import { ARCH, GATE, type ArchPlan } from "../pwa/src/game/start-arch.ts";

const root = join(import.meta.dirname, "..");
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function parse(id: string): Promise<StaticModel> {
  const b = readFileSync(join(root, "pwa", "models", "gates", `${id}.glb`));
  const g = await loader.parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
    "",
  );
  return readStaticModel(g, (n) => (GATE_PARTS as readonly string[]).includes(n));
}

describe("the gate models' dress", () => {
  it("has a colour for every role the builder paints with", () => {
    const src = readFileSync(join(root, "scripts", "blender", "gate.py"), "utf8");
    const roles = [...(/^ROLES = \(([^)]*)\)/m.exec(src)?.[1] ?? "").matchAll(/"(\w+)"/g)].map(
      (x) => x[1],
    );
    expect(roles.length).toBeGreaterThan(4);
    for (const r of roles) expect(gateRoleColour(r), r).not.toBeNull();
    expect(gateRoleColour("flag")).toBe(0xffffff);
    expect(gateRoleColour("coat")).toBeNull();
  });
});

describe("remap", () => {
  it("is linear between its knots and straight beyond them", () => {
    const knots = [
      [-7, -5],
      [-5.6, -3.6],
      [5.6, 3.6],
      [7, 5],
    ] as const;
    expect(remap(-7, knots)).toBe(-5);
    expect(remap(0, knots)).toBe(0);
    expect(remap(2.8, knots)).toBeCloseTo(1.8, 9);
    expect(remap(7, knots)).toBe(5);
    expect(remap(8, knots)).toBe(6);
    expect(remap(-8, knots)).toBe(-6);
  });
});

describe("the committed gate models", () => {
  it("decode to a stake on its foot, a pennant streaming from its hoist and a marker about its centre", async () => {
    setGateModel("checkpoint", await parse("checkpoint"));
    const m = checkpointModel()!;
    expect(m).not.toBeNull();
    const box = (g: THREE.BufferGeometry) => {
      g.computeBoundingBox();
      return g.boundingBox as THREE.Box3;
    };
    const pole = box(m.pole);
    expect(pole.max.y).toBeCloseTo(GATE.pole + 0.045, 1);
    expect(pole.min.y).toBeLessThan(0);
    expect(Math.max(-pole.min.x, pole.max.x)).toBeLessThan(0.07);
    const flag = box(m.flag);
    expect(flag.max.x).toBeCloseTo(GATE.pennant.reach, 1);
    expect(flag.min.y).toBeCloseTo(-GATE.pennant.drop, 1);
    expect(flag.max.y).toBeLessThan(0.01);
    const marker = box(m.marker);
    expect(marker.max.y).toBeCloseTo(GATE.marker.height / 2, 2);
    expect(marker.min.y).toBeCloseTo(-GATE.marker.height / 2, 2);
    setGateModel("checkpoint", null);
    expect(checkpointModel()).toBeNull();
  });

  it("decode to the arch, stretched to a line's reach and down to each foot", async () => {
    setGateModel("start-arch", await parse("start-arch"));
    const plan = (reach: number, left: number, right: number): ArchPlan => {
      const top = Math.max(left, right) + ARCH.sink + ARCH.top;
      return {
        x: 0,
        z: 0,
        rx: 1,
        rz: 0,
        reach,
        feet: [
          { x: -reach, z: 0, y: left },
          { x: reach, z: 0, y: right },
        ],
        top,
      };
    };
    // Feet at ground -sink: the higher foot's ground is the model's y = 0.
    for (const [reach, left, right] of [
      [ARCH.modelReach, -ARCH.sink, -ARCH.sink],
      [5.5, -ARCH.sink, -ARCH.sink - 0.8],
      [9, -ARCH.sink - 1.2, -ARCH.sink],
    ]) {
      const g = archModel(plan(reach, left, right))!;
      expect(g, `reach ${reach}`).not.toBeNull();
      g.computeBoundingBox();
      const box = g.boundingBox as THREE.Box3;
      // The legs' axes at ±reach, the blowers 1.3 m outside them.
      expect(box.max.x, `reach ${reach}`).toBeCloseTo(reach + 1.3 + 0.3, 0);
      expect(box.min.x, `reach ${reach}`).toBeCloseTo(-(reach + 1.3 + 0.3), 0);
      // The tube's top at ARCH.top over the higher ground; the lower leg's
      // foot, sunk in its own snow, that much lower.
      expect(box.max.y).toBeCloseTo(ARCH.top + ARCH.tube, 1);
      const drop = Math.max(left, right) - Math.min(left, right);
      expect(box.min.y).toBeCloseTo(-ARCH.sink - drop, 1);
      expect(g.index!.count / 3).toBeLessThan(5000);
    }
    setGateModel("start-arch", null);
    expect(archModel(plan(6, 0, 0))).toBeNull();
  });
});
