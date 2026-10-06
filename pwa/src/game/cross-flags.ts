// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A SKI CROSS'S COURSE AS MARKED (R35) — what a racer reads it by:
//
//   * THE FLAGS: every ski-cross gate (`Checkpoint.flags`) is TRIANGULAR
//     FLAGS, each a short padded STUBBY pole on the course's edge — the
//     turning pole, the one a racer skis past — and a long rigid OUTSIDE
//     pole beyond it, the flag between them falling toward the course. A
//     TURNING GATE is one flag on the INSIDE of its berm (the end its
//     `turn` names); a CORRIDOR GATE, before every feature, a flag at each
//     end of its line. Red and blue as the engine dealt them; the owed
//     gate's at full strength and breathing a little light, every other
//     muted, as the panel gates are (`gates.ts`).
//   * THE EDGES dyed BLUE along both sides of the course from the doors to
//     the finish line, the line a racer must stay inside.
//
// Every flag and pole is one instance of one of three meshes built in code
// (`mark-shapes.ts`), coloured per instance.

import * as THREE from "three";
import type { Checkpoint, GameState, Level } from "@engine";

import { PALETTE } from "../identity.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { crossFlag, gatePole, stubbyPole } from "./mark-shapes.ts";
import { LOOSE } from "./trail-stamp.ts";

/** A ski-cross flag, m: the STUBBY pole's height over its hinge (the rule's
 * 45 cm at most) and radius in its padding; the OUTSIDE pole's height and
 * radius; and the flag — its base along the snow (the rule's 1.0–1.3 m),
 * its foot over the snow, its short side at the stubby and its long side at
 * the outside pole (the rule's 0.8–1.1 m). */
export const FLAG = {
  stubby: { height: 0.45, radius: 0.045 },
  pole: { height: 1.35, radius: 0.017 },
  base: 1.15,
  foot: 0.06,
  low: 0.4,
  high: 1.0,
} as const;

/** THE BLUE EDGE: the dyed line's width, m, centred on the course's edge. */
const EDGE_DYE = 0.3;

export type CrossFlags = {
  group: THREE.Group;
  /** Where a gate's marker rides: over each of its outside poles. */
  tops(gate: number): THREE.Vector3[];
  /** The owed gate `lit` loud and breathing, the rest muted. */
  update(state: GameState, lit: number): void;
  dispose(): void;
};

/** One flag: the gate it marks and the end of its line (−1 the left, +1
 * the right as the gate is crossed). */
type Flag = { gate: number; side: -1 | 1 };

/** The flags of `level`'s ski-cross gates: a turning gate's one on its
 * inside, a corridor gate's two. */
export function flagsOf(checkpoints: readonly Checkpoint[]): Flag[] {
  const out: Flag[] = [];
  checkpoints.forEach((cp, gate) => {
    if (!cp.flags) return;
    if (cp.pole === "open" && cp.turn !== undefined) out.push({ gate, side: cp.turn });
    else out.push({ gate, side: -1 }, { gate, side: 1 });
  });
  return out;
}

/** THE MARKS of `level`'s ski cross, or null on a map with none. */
export function createCrossFlags(level: Level, haze: HazeUniforms): CrossFlags | null {
  const xc = level.skiCross;
  if (!xc) return null;
  const group = new THREE.Group();
  group.name = "cross-flags";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const std = (p: THREE.MeshStandardMaterialParameters, name: string): THREE.Material => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), haze, name);
    mats.push(m);
    return m;
  };
  const flags = flagsOf(level.checkpoints);
  const n = Math.max(1, flags.length);
  const stubGeo = stubbyPole(FLAG.stubby.height, FLAG.stubby.radius);
  const poleGeo = gatePole(FLAG.pole.height, FLAG.pole.radius);
  const flagGeo = crossFlag(FLAG.base, FLAG.foot, FLAG.low, FLAG.high);
  geos.push(stubGeo, poleGeo, flagGeo);
  const stubs = new THREE.InstancedMesh(
    stubGeo,
    std({ vertexColors: true, roughness: 0.7 }, "cross-stubby"),
    n,
  );
  const poles = new THREE.InstancedMesh(
    poleGeo,
    std({ vertexColors: true, roughness: 0.5 }, "cross-pole"),
    n,
  );
  const cloth = new THREE.InstancedMesh(
    flagGeo,
    std({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }, "cross-flag"),
    n,
  );
  for (const m of [stubs, poles, cloth]) {
    m.castShadow = true;
    m.count = flags.length;
    group.add(m);
  }
  const red = new THREE.Color(PALETTE.flag);
  const blue = new THREE.Color(PALETTE.gateBlue);
  const muted = (c: THREE.Color) => c.clone().lerp(new THREE.Color(0x9aa4ad), 0.4);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const tops = new Map<number, THREE.Vector3[]>();
  const of = new Map<number, number[]>();
  const base: THREE.Color[] = [];
  flags.forEach((f, i) => {
    const cp = level.checkpoints[f.gate];
    // The skier's right: forward turned clockwise a quarter.
    const rx = Math.cos(cp.heading);
    const rz = -Math.sin(cp.heading);
    const edge = (cp.width / 2) * f.side;
    const sx = cp.x + rx * edge;
    const sz = cp.z + rz * edge;
    const ox = sx + rx * f.side * FLAG.base;
    const oz = sz + rz * f.side * FLAG.base;
    const sy = level.groundAt(sx, sz) - 0.04;
    const oy = level.groundAt(ox, oz) - 0.04;
    stubs.setMatrixAt(i, m4.compose(at.set(sx, sy, sz), q.identity(), one));
    poles.setMatrixAt(i, m4.compose(at.set(ox, oy, oz), q.identity(), one));
    // The flag runs out from the stubby: its +x is the gate's end outward.
    q.setFromAxisAngle(up, cp.heading + (f.side > 0 ? 0 : Math.PI));
    cloth.setMatrixAt(i, m4.compose(at.set(sx, Math.min(sy, oy), sz), q, one));
    const c = cp.colour === "blue" ? blue : red;
    base.push(c);
    for (const m of [stubs, poles, cloth]) m.setColorAt(i, muted(c));
    const list = tops.get(f.gate) ?? [];
    list.push(new THREE.Vector3(ox, oy + FLAG.pole.height + 1.2, oz));
    tops.set(f.gate, list);
    of.set(f.gate, [...(of.get(f.gate) ?? []), i]);
  });
  for (const m of [stubs, poles, cloth]) {
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }

  // THE BLUE EDGES: a dyed band down each side of the course, laid on the
  // snow as it lies and lifted a hair so it never flickers in and out of it.
  const dye = std(
    {
      color: 0x2c6fd8,
      roughness: 0.9,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -4,
    },
    "cross-edge",
  );
  const lift = (x: number, z: number): number =>
    level.groundAt(x, z) + LOOSE * (1 - level.packedAt(x, z)) + 0.03;
  for (const side of [-1, 1]) {
    const pos: number[] = [];
    const idx: number[] = [];
    let k = 0;
    for (const p of level.track.points) {
      if (p.s < xc.from || p.s > xc.to) continue;
      const rx = Math.cos(p.heading) * side;
      const rz = -Math.sin(p.heading) * side;
      // Outer edge then inner on the right, inner then outer on the left:
      // the same winding both sides, so both bands face up.
      const inner = p.width / 2 - EDGE_DYE / 2;
      const outer = p.width / 2 + EDGE_DYE / 2;
      for (const d of side > 0 ? [outer, inner] : [inner, outer]) {
        const x = p.x + rx * d;
        const z = p.z + rz * d;
        pos.push(x, lift(x, z), z);
      }
      if (k > 0) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k, 2 * k - 1, 2 * k + 1);
      k++;
    }
    if (k < 2) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    geos.push(g);
    const band = new THREE.Mesh(g, dye);
    band.receiveShadow = true;
    group.add(band);
  }

  const glow = new THREE.Color();
  let shown = -1;
  const paint = (gate: number, c: (i: number) => THREE.Color): void => {
    for (const i of of.get(gate) ?? [])
      for (const m of [stubs, poles, cloth]) m.setColorAt(i, c(i));
  };
  return {
    group,
    tops: (gate) => tops.get(gate) ?? [],
    update(state, lit) {
      let dirty = false;
      if (lit !== shown) {
        if (of.has(shown)) {
          paint(shown, (i) => muted(base[i]));
          dirty = true;
        }
        shown = lit;
      }
      if (of.has(lit)) {
        const k = 1 + 0.35 * (0.5 + 0.5 * Math.sin(state.t * 4));
        paint(lit, (i) => glow.copy(base[i]).multiplyScalar(k));
        dirty = true;
      }
      if (!dirty) return;
      for (const m of [stubs, poles, cloth])
        if (m.instanceColor) m.instanceColor.needsUpdate = true;
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      stubs.dispose();
      poles.dispose();
      cloth.dispose();
    },
  };
}
