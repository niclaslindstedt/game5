// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIRFRAME TORN APART — a crashed helicopter (`heli.ts`'s `crash`) as
// drawn: the machine's own meshes (the Blender model, or the code's
// stand-in) cut once into the pieces an airframe comes apart in — the
// cabin's shell crushed into panels, the nose, the engine deck, the tail
// boom whole with its fin (a boom most often comes off in one piece), the
// skids and their cross tubes, the
// tail rotor, and each main-rotor blade broken at its root and again
// along its span — and, the moment it goes down, every piece flung from
// where it was drawn: off the blast at the fuel cells, with the way the
// machine was going, the blades slung on along their own turn. They
// tumble, strike the snow (a puff of it, and sparks off the metal),
// skid and come to rest, the ones that burn trailing fire as they fly.
//
// The pieces share the machine's own materials, so they char as it does
// (`heli-view.ts`). Built once per model and reused; nothing allocates
// once a piece is cut. Presentation only — a stream of its own, never the
// engine's.

import * as THREE from "three";
import { HELI } from "@engine";

/** WHERE AN AIRFRAME COMES APART, body frame (x right, y up, z forward,
 * from the skid datum), m: under `skid` is the landing gear, cut along
 * its middle and at `skidCut` along it; forward of `cabin` is the cabin,
 * cut at `cabinCuts` along it, at its centre line and at `roof` up it;
 * aft is the boom, whole. A rotor blade breaks at
 * `bladeRoot` of the radius and again at `bladeCut`. */
export const TEAR = {
  skid: 0.62,
  skidCut: 0.1,
  cabin: -1.25,
  cabinCuts: [1.7, 0.25],
  roof: 1.75,
  bladeRoot: 0.16,
  bladeCut: 0.55,
} as const;

/** HOW THE PIECES FLY: the blast's push, m/s, on the lightest piece and
 * how it falls off with a piece's size (∝ size^−½); the climb a piece
 * leaves with, m/s; the share of the machine's own way each keeps; the
 * share of a blade's own turning speed it is slung on with (a tip turns
 * at some 210 m/s; the broken sections fly at 30–60 and land 20–100 m
 * off); the air's drag on a blade section, 1/s (a composite slows fast);
 * the tumble, rad/s; the snow's bounce and the slide's friction. */
export const FLING = {
  push: [9, 22] as const,
  climb: [5, 15] as const,
  keep: 0.55,
  sling: 0.22,
  bladeDrag: 0.5,
  spin: 7,
  bladeSpin: 16,
  bounce: 0.32,
  slide: 2.8,
  /** The share of the pieces that burn as they fly, and how long they
   * burn on the snow after, s. */
  burns: 0.45,
  burnFor: [3, 9] as const,
} as const;

/** What a piece hands back for the fire and the snow: where a burning one
 * is, and where one has just struck the snow, how hard. */
export type ShatterHooks = {
  /** A burning piece at (x, y, z) this frame, `heat` 0..1. */
  flame(x: number, y: number, z: number, heat: number, dt: number): void;
  /** A piece struck the snow at (x, y, z) at `speed` m/s. */
  strike(x: number, y: number, z: number, speed: number): void;
};

export type Shatter = {
  group: THREE.Group;
  /** Tear `model` — drawn under `machine`, whose frame is the engine's
   * body frame, their matrices current — into its pieces and fling them:
   * `v` the way it was going, m/s, `spin` the main rotor's turn about the
   * machine's up as drawn, rad/s. */
  burst(
    machine: THREE.Object3D,
    model: THREE.Object3D,
    v: { x: number; y: number; z: number },
    spin: number,
  ): void;
  update(dt: number, groundAt: (x: number, z: number) => number, hooks: ShatterHooks): void;
  /** Whether any piece is still flying. */
  flying(): boolean;
  clear(): void;
  dispose(): void;
};

type Piece = {
  mesh: THREE.Mesh;
  /** The piece's centre in the machine's frame. */
  centre: THREE.Vector3;
  size: number;
  blade: boolean;
  /** Its distance from the mast, m (a blade's sling). */
  radius: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  rest: boolean;
  burn: number;
  burnLeft: number;
};

/** A seeded stream of its own — never the engine's. */
function makeRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Which piece a triangle centred at `c` (machine frame) falls in. */
function cellOf(c: THREE.Vector3, part: "body" | "rotor" | "tail"): string {
  if (part === "tail") return "tail-rotor";
  if (part === "rotor") {
    const dx = c.x;
    const dz = c.z - HELI.rotor.at;
    const r = Math.hypot(dx, dz) / HELI.rotor.radius;
    if (r < TEAR.bladeRoot) return "hub";
    const n = HELI.rotor.blades;
    const a = Math.atan2(dx, dz) + Math.PI;
    const k = Math.floor((a / (Math.PI * 2)) * n + 0.5) % n;
    return `blade-${k}-${r < TEAR.bladeCut ? "in" : "out"}`;
  }
  if (c.y < TEAR.skid) {
    return `skid-${c.x < 0 ? "l" : "r"}-${c.z < TEAR.skidCut ? "a" : "f"}`;
  }
  if (c.z > TEAR.cabin) {
    const [nose, mid] = TEAR.cabinCuts;
    const along = c.z > nose ? "nose" : c.z > mid ? "front" : "rear";
    if (along === "nose") return "nose";
    return `cabin-${along}-${c.x < 0 ? "l" : "r"}-${c.y > TEAR.roof ? "top" : "low"}`;
  }
  return "boom";
}

/** Every mesh under `model` with its materials, its geometry in the
 * frame of `machine`: anything not a standard material left out. */
function cut(
  machine: THREE.Object3D,
  model: THREE.Object3D,
): Map<string, Map<THREE.Material, number[]>> {
  machine.updateMatrixWorld(true);
  const toMachine = new THREE.Matrix4().copy(machine.matrixWorld).invert();
  const m = new THREE.Matrix4();
  const cells = new Map<string, Map<THREE.Material, number[]>>();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const mid = new THREE.Vector3();
  model.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.every((x) => x instanceof THREE.MeshStandardMaterial)) return;
    let part: "body" | "rotor" | "tail" = "body";
    for (let p: THREE.Object3D | null = o; p && p !== model; p = p.parent) {
      if (p.name === "heli_rotor") part = "rotor";
      if (p.name === "heli_tail_rotor") part = "tail";
    }
    m.multiplyMatrices(toMachine, o.matrixWorld);
    const g = o.geometry as THREE.BufferGeometry;
    const pos = g.getAttribute("position");
    const index = g.getIndex();
    const groups = g.groups.length
      ? g.groups
      : [{ start: 0, count: index ? index.count : pos.count, materialIndex: 0 }];
    for (const grp of groups) {
      const mat = mats[grp.materialIndex ?? 0] ?? mats[0];
      for (let i = grp.start; i + 2 < grp.start + grp.count; i += 3) {
        const ia = index ? index.getX(i) : i;
        const ib = index ? index.getX(i + 1) : i + 1;
        const ic = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, ia).applyMatrix4(m);
        b.fromBufferAttribute(pos, ib).applyMatrix4(m);
        c.fromBufferAttribute(pos, ic).applyMatrix4(m);
        mid
          .copy(a)
          .add(b)
          .add(c)
          .multiplyScalar(1 / 3);
        const key = cellOf(mid, part);
        let cell = cells.get(key);
        if (!cell) cells.set(key, (cell = new Map()));
        let list = cell.get(mat);
        if (!list) cell.set(mat, (list = []));
        list.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
      }
    }
  });
  return cells;
}

/** One piece's mesh, its triangles about their own centre. */
function pieceOf(key: string, cell: Map<THREE.Material, number[]>): Piece {
  const centre = new THREE.Vector3();
  let n = 0;
  const box = new THREE.Box3();
  const p = new THREE.Vector3();
  for (const list of cell.values()) {
    for (let i = 0; i < list.length; i += 3) {
      p.set(list[i], list[i + 1], list[i + 2]);
      centre.add(p);
      box.expandByPoint(p);
      n++;
    }
  }
  centre.multiplyScalar(1 / Math.max(1, n));
  const all: number[] = [];
  const geo = new THREE.BufferGeometry();
  const materials: THREE.Material[] = [];
  for (const [mat, list] of cell) {
    const start = all.length / 3;
    for (let i = 0; i < list.length; i += 3) {
      all.push(list[i] - centre.x, list[i + 1] - centre.y, list[i + 2] - centre.z);
    }
    geo.addGroup(start, list.length / 3, materials.length);
    materials.push(mat);
  }
  geo.setAttribute("position", new THREE.Float32BufferAttribute(all, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, materials);
  mesh.name = `piece-${key}`;
  mesh.castShadow = true;
  mesh.visible = false;
  const size = box.getSize(p).length();
  return {
    mesh,
    centre,
    size,
    blade: key.startsWith("blade"),
    radius: Math.hypot(centre.x, centre.z - HELI.rotor.at),
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    rest: true,
    burn: 0,
    burnLeft: 0,
  };
}

export function createShatter(): Shatter {
  const group = new THREE.Group();
  group.name = "heli-pieces";
  const random = makeRandom(0x5a77e5);
  let pieces: Piece[] = [];
  let builtFor: THREE.Object3D | null = null;
  const q = new THREE.Quaternion();
  const turn = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const blast = new THREE.Vector3();
  const mast = new THREE.Vector3();
  const along = new THREE.Vector3();

  function build(machine: THREE.Object3D, model: THREE.Object3D): void {
    for (const p of pieces) {
      group.remove(p.mesh);
      p.mesh.geometry.dispose();
    }
    pieces = [...cut(machine, model)].map(([key, cell]) => pieceOf(key, cell));
    for (const p of pieces) group.add(p.mesh);
    builtFor = model;
  }

  return {
    group,
    burst(machine, model, v, spin) {
      if (model !== builtFor) build(machine, model);
      machine.updateMatrixWorld(true);
      machine.getWorldQuaternion(q);
      // The blast's heart: the fuel cells under the engine deck, behind
      // the cabin; the mast the blades turn about.
      blast.set(0, 0.9, -0.6).applyMatrix4(machine.matrixWorld);
      mast.set(0, HELI.rotor.hub, HELI.rotor.at).applyMatrix4(machine.matrixWorld);
      for (const p of pieces) {
        p.pos.copy(p.centre).applyMatrix4(machine.matrixWorld);
        p.mesh.quaternion.copy(q);
        p.mesh.position.copy(p.pos);
        p.mesh.visible = true;
        p.rest = false;
        // Off the blast, the smaller the faster.
        along.copy(p.pos).sub(blast);
        along.y = Math.max(0, along.y) + 0.3;
        if (along.lengthSq() < 1e-4) along.set(random() - 0.5, 1, random() - 0.5);
        along.normalize();
        const light = Math.min(1, 1 / Math.sqrt(Math.max(0.3, p.size)));
        const push =
          FLING.push[0] + (FLING.push[1] - FLING.push[0]) * light * (0.6 + 0.4 * random());
        const climb = FLING.climb[0] + (FLING.climb[1] - FLING.climb[0]) * random() * light;
        p.vel.set(
          v.x * FLING.keep + along.x * push,
          Math.max(0, v.y) * FLING.keep + climb + along.y * push * 0.4,
          v.z * FLING.keep + along.z * push,
        );
        if (p.blade) {
          // A blade is slung on along its own turn: ω × r about the mast.
          axis.set(0, 1, 0).applyQuaternion(q);
          along.copy(p.pos).sub(mast);
          along.crossVectors(axis, along).normalize();
          p.vel.addScaledVector(along, spin * p.radius * FLING.sling);
          p.vel.y = Math.min(p.vel.y, 6 + random() * 6);
        }
        const s = p.blade ? FLING.bladeSpin : FLING.spin * light;
        p.spin.set((random() - 0.5) * 2 * s, (random() - 0.5) * 2 * s, (random() - 0.5) * 2 * s);
        p.burn = !p.blade && random() < FLING.burns ? 0.5 + 0.5 * random() : 0;
        p.burnLeft = FLING.burnFor[0] + (FLING.burnFor[1] - FLING.burnFor[0]) * random();
      }
    },
    update(dt, groundAt, hooks) {
      if (dt <= 0) return;
      for (const p of pieces) {
        if (!p.mesh.visible) continue;
        if (p.burn > 0 && p.burnLeft > 0) {
          p.burnLeft -= dt;
          // Burning out on the snow: the flames die down over their last
          // two seconds.
          const heat = p.burn * Math.min(1, p.burnLeft / 2) * (p.rest ? 0.6 : 1);
          if (heat > 0.02) hooks.flame(p.pos.x, p.pos.y, p.pos.z, heat, dt);
        }
        if (p.rest) continue;
        p.vel.y -= 9.81 * dt;
        // The air's drag on a tumbling panel, and on a blade's section.
        p.vel.multiplyScalar(Math.exp(-(p.blade ? FLING.bladeDrag : 0.05) * dt));
        p.pos.addScaledVector(p.vel, dt);
        const g = groundAt(p.pos.x, p.pos.z) + Math.min(0.35, p.size * 0.12);
        if (p.pos.y < g) {
          const down = -p.vel.y;
          p.pos.y = g;
          if (down > 2.5) hooks.strike(p.pos.x, g, p.pos.z, Math.hypot(down, p.vel.x, p.vel.z));
          // Into the snow: a bounce it mostly swallows, and a slide.
          p.vel.y = down * FLING.bounce;
          const keep = Math.exp(-FLING.slide * Math.max(dt, 0.03) * 3);
          p.vel.x *= keep;
          p.vel.z *= keep;
          p.spin.multiplyScalar(0.55);
          if (p.vel.y < 0.8 && Math.hypot(p.vel.x, p.vel.z) < 0.6) {
            p.rest = true;
            p.vel.set(0, 0, 0);
          }
        }
        p.mesh.position.copy(p.pos);
        const w = p.spin.length();
        if (w > 1e-3) {
          axis.copy(p.spin).multiplyScalar(1 / w);
          turn.setFromAxisAngle(axis, w * dt);
          p.mesh.quaternion.premultiply(turn);
        }
      }
    },
    flying() {
      return pieces.some((p) => p.mesh.visible && !p.rest);
    },
    clear() {
      for (const p of pieces) {
        p.mesh.visible = false;
        p.rest = true;
      }
    },
    dispose() {
      for (const p of pieces) p.mesh.geometry.dispose();
      pieces = [];
    },
  };
}
