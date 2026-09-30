// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MODELLED BIRDS AND ANIMALS (`pwa/src/game/bird-models.ts`,
// `beast-models.ts`, made by `make blender KIND=bird` / `KIND=beast` off
// the rosters' own rows, published packed in `pwa/models/birds/` and
// `beasts/`): every role a builder paints a face with is one the game can
// dress, and the dress is the species' own style; a model is tagged for
// the shader exactly as the code's is — a wing's flag, a leg's phase, the
// hip and the pivot off the root; and every committed species decodes,
// through three's own loader and meshopt decoder, to every part, in the
// frame and within the budget.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { describe, expect, it } from "vitest";

import { BEASTS, beastById } from "../pwa/src/game/beast-defs.ts";
import {
  BEAST_LEGS,
  BEAST_PARTS,
  beastModel,
  beastRoleColour,
  setBeastModel,
} from "../pwa/src/game/beast-models.ts";
import { BEAST_STYLES, LEG_PHASE } from "../pwa/src/game/beast-shapes.ts";
import { BIRDS, birdById } from "../pwa/src/game/bird-defs.ts";
import {
  BIRD_PARTS,
  birdModel,
  birdRoleColour,
  setBirdModel,
} from "../pwa/src/game/bird-models.ts";
import { BIRD_STYLES } from "../pwa/src/game/bird-shapes.ts";
import { readStaticModel, type ModelPart, type StaticModel } from "../pwa/src/game/model-parts.ts";

const root = join(import.meta.dirname, "..");

/** The roles a builder paints with, read off its `ROLES` tuple. */
function builderRoles(file: string): string[] {
  const src = readFileSync(join(root, "scripts", "blender", file), "utf8");
  const m = /^ROLES = \(([^)]*)\)/m.exec(src);
  if (!m) throw new Error(`${file} states no ROLES`);
  return [...m[1].matchAll(/"(\w+)"/g)].map((x) => x[1]);
}

/** A one-triangle part in one role, its vertices at `at`. */
function part(
  role: string,
  at: [number, number, number],
  tone: [number, number, number] = [1, 0, 0],
): ModelPart {
  return {
    role,
    position: Float32Array.from([...at, at[0] + 0.1, at[1], at[2], at[0], at[1], at[2] + 0.1]),
    normal: Float32Array.from([0, 1, 0, 0, 1, 0, 0, 1, 0]),
    tone: Float32Array.from([...tone, ...tone, ...tone]),
    index: Uint32Array.from([0, 1, 2]),
  };
}

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
async function parse(file: string, keep: readonly string[]): Promise<StaticModel> {
  const b = readFileSync(join(root, "pwa", "models", file));
  const g = await loader.parseAsync(
    b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer,
    "",
  );
  return readStaticModel(g, (n) => keep.includes(n));
}

describe("a bird model's dress", () => {
  it("has a colour for every role the builder paints with", () => {
    const roles = builderRoles("bird.py");
    expect(roles.length).toBeGreaterThan(4);
    for (const r of roles) expect(birdRoleColour(r, BIRD_STYLES.raven), r).not.toBeNull();
    expect(birdRoleColour("needle", BIRD_STYLES.raven)).toBeNull();
    // The tail is the mantle's colour unless the species has its own.
    expect(birdRoleColour("tail", BIRD_STYLES.raven)).toBe(BIRD_STYLES.raven.back);
    expect(birdRoleColour("tail_under", BIRD_STYLES.blackgrouse)).toBe(
      BIRD_STYLES.blackgrouse.tail,
    );
  });

  it("paints a vertex its role's colour, shaded, and tags the wing", () => {
    setBirdModel("raven", {
      parts: new Map([
        ["body", [part("belly", [0, 0, 0], [0.5, 0, 0])]],
        ["wing", [part("tip", [0.5, 0, 0])]],
      ]),
      extras: {},
    });
    const g = birdModel(birdById("raven"), BIRD_STYLES.raven)!;
    const belly = new THREE.Color(BIRD_STYLES.raven.belly).multiplyScalar(0.5);
    const col = g.getAttribute("color");
    expect(col.getX(0)).toBeCloseTo(belly.r, 5);
    const wing = g.getAttribute("aWing");
    expect(wing.getX(0)).toBe(0);
    expect(wing.getX(3)).toBe(1);
    expect(g.getAttribute("position").getX(3)).toBeCloseTo(0.5, 5);
    setBirdModel("raven", null);
    expect(birdModel(birdById("raven"), BIRD_STYLES.raven)).toBeNull();
  });
});

describe("an animal model's dress", () => {
  it("has a colour for every role the builder paints with, on a species that has the part", () => {
    const roles = builderRoles("beast.py");
    expect(roles.length).toBeGreaterThan(6);
    for (const r of roles) {
      const s =
        r === "antlers"
          ? BEAST_STYLES.reindeer
          : r === "horns"
            ? BEAST_STYLES.ibex
            : BEAST_STYLES.fox;
      expect(beastRoleColour(r, s), r).not.toBeNull();
    }
    expect(beastRoleColour("antlers", BEAST_STYLES.fox)).toBeNull();
    expect(beastRoleColour("tailtip", BEAST_STYLES.fox)).toBe(BEAST_STYLES.fox.tailTip);
    expect(beastRoleColour("tailtip", BEAST_STYLES.hare)).toBe(BEAST_STYLES.hare.tail);
  });

  it("tags every leg with its phase in the species' gait, the hip and the head, off the root", () => {
    const parts = new Map<string, ModelPart[]>([["body", [part("coat", [0, 0.5, 0])]]]);
    for (const leg of BEAST_LEGS) parts.set(leg, [part("legs", [0, 0.2, 0])]);
    parts.set("head", [part("head", [0, 0.9, 0.5])]);
    setBeastModel("fox", { parts, extras: { hip: 0.31, pivotUp: 0.4, pivotFwd: 0.28 } });
    const spec = beastById("fox");
    const m = beastModel(spec, BEAST_STYLES.fox)!;
    expect(m.pivot).toEqual({ y: 0.4, z: 0.28 });
    const leg = m.geometry.getAttribute("aLeg");
    const hip = m.geometry.getAttribute("aHip");
    const head = m.geometry.getAttribute("aHead");
    // The parts go in in `BEAST_PARTS`' order: the body, the head, the
    // legs, three vertices each here.
    expect(leg.getX(0)).toBe(0);
    expect(head.getX(3)).toBe(1);
    expect(leg.getX(3)).toBe(0);
    BEAST_LEGS.forEach((_, k) => {
      expect(leg.getX(6 + k * 3)).toBeCloseTo(1 + LEG_PHASE[spec.gait][k], 6);
      expect(hip.getX(6 + k * 3)).toBeCloseTo(0.31, 6);
      expect(head.getX(6 + k * 3)).toBe(0);
    });
    expect(head.getX(0)).toBe(0);
    // A model without its root's numbers cannot be walked: the code's animal.
    setBeastModel("fox", { parts, extras: {} });
    expect(beastModel(spec, BEAST_STYLES.fox)).toBeNull();
    setBeastModel("fox", null);
  });
});

describe("the committed wildlife models", () => {
  it("decode to every bird, all parts, shoulders at the origin, the bill ahead, in budget", async () => {
    for (const spec of BIRDS) {
      const model = await parse(`birds/${spec.id}.glb`, BIRD_PARTS);
      setBirdModel(spec.id, model);
      for (const p of BIRD_PARTS)
        expect(model.parts.get(p)?.length, `${spec.id} ${p}`).toBeGreaterThan(0);
      const g = birdModel(spec, BIRD_STYLES[spec.id])!;
      const tris = g.index!.count / 3;
      expect(tris, spec.id).toBeLessThan(900);
      expect(tris, spec.id).toBeGreaterThan(150);
      g.computeBoundingBox();
      const box = g.boundingBox as THREE.Box3;
      // The span across x; the tail at the row's own length behind.
      expect(box.max.x, spec.id).toBeCloseTo(spec.span / 2, 1);
      expect(box.min.x, spec.id).toBeCloseTo(-spec.span / 2, 1);
      expect(box.min.z, spec.id).toBeLessThan(-(1 - spec.neck) * spec.length * 0.8);
      // The bill reaches the row's own point ahead of the shoulders (a
      // broad wing's leading edge may reach further).
      let bill = -Infinity;
      for (const p of model.parts.get("body")!) {
        for (let i = 2; i < p.position.length; i += 3) bill = Math.max(bill, p.position[i]);
      }
      expect(bill, spec.id).toBeCloseTo(spec.neck * spec.length, 1);
      setBirdModel(spec.id, null);
    }
  });

  it("decode to every animal, all parts, standing on the snow with its nose ahead, in budget", async () => {
    for (const spec of BEASTS) {
      const model = await parse(`beasts/${spec.id}.glb`, BEAST_PARTS);
      setBeastModel(spec.id, model);
      for (const p of BEAST_PARTS)
        expect(model.parts.get(p)?.length, `${spec.id} ${p}`).toBeGreaterThan(0);
      const m = beastModel(spec, BEAST_STYLES[spec.id])!;
      const tris = m.geometry.index!.count / 3;
      expect(tris, spec.id).toBeLessThan(1400);
      expect(tris, spec.id).toBeGreaterThan(300);
      m.geometry.computeBoundingBox();
      const box = m.geometry.boundingBox as THREE.Box3;
      expect(box.min.y, spec.id).toBeGreaterThan(-0.02);
      expect(box.min.y, spec.id).toBeLessThan(0.02);
      expect(box.max.y, spec.id).toBeGreaterThan(spec.height * 0.9);
      expect(box.max.z, spec.id).toBeGreaterThan(spec.length * 0.5);
      expect(box.min.z, spec.id).toBeLessThan(-spec.length * 0.45);
      expect(m.pivot.y).toBeGreaterThan(0);
      expect(m.pivot.z).toBeCloseTo(spec.length * 0.4, 5);
      setBeastModel(spec.id, null);
    }
  });
});
