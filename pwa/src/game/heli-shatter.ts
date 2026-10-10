// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE AIRFRAME TORN APART — a crashed helicopter (`heli.ts`'s `crash`) as
// drawn: the machine's own meshes (the Blender model, or the code's
// stand-in) cut once into the pieces an airframe comes apart in, and
// thrown about the way accident sites show them. A light helicopter's
// fuel DEFLAGRATES rather than detonates, so the fire does not blow the
// airframe apart — the impact does. The CABIN stays where it struck, a
// crumpled HULK rolled onto its side (the commonest way a helicopter
// comes to rest), its panels buckled and the skids splayed out from under
// it; the TAIL BOOM snaps off at the cabin and is thrown a few metres
// (it most often survives in one piece); the ROOF's panels are thrown up
// off the blast; and the MAIN ROTOR's blades, which strike the snow still
// turning at some 210 m/s at the tip, break at the root and along their
// span and are slung tens of metres on along their own turn. The flung
// pieces tumble, strike the snow (a puff of it, and sparks off the
// metal), skid and come to rest, the ones that burn trailing fire.
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

/** THE HULK: how long the cabin takes to go over, s; how far onto its
 * side it rolls, rad (a band either way), how far it pitches, rad; the
 * share of its way along the snow it slides on, s, and at most, m; how
 * far its panels are buckled out of true, m and rad; and how far the
 * skids are splayed out from under it, m. */
export const HULK = {
  settle: 0.7,
  roll: [0.95, 1.45] as const,
  pitch: 0.3,
  slide: 0.35,
  slideMost: 6,
  dent: 0.22,
  twist: 0.28,
  splay: 0.7,
} as const;

/** What a piece is to the crash: part of the HULK that stays, the BOOM
 * snapped off, a ROOF panel thrown up, a BLADE section slung, or the hub
 * and tail rotor thrown. */
type Role = "hulk" | "boom" | "roof" | "blade" | "rotor";

const roleOf = (key: string): Role =>
  key.startsWith("blade")
    ? "blade"
    : key === "boom"
      ? "boom"
      : key === "hub" || key === "tail-rotor"
        ? "rotor"
        : key.endsWith("-top")
          ? "roof"
          : "hulk";

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
  role: Role;
  /** A hulk piece: where it stood off the hulk's pivot as it struck, its
   * turn then, and the dent it is buckled by. */
  rel: THREE.Vector3;
  q0: THREE.Quaternion;
  dent: THREE.Vector3;
  bend: THREE.Quaternion;
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
    role: roleOf(key),
    rel: new THREE.Vector3(),
    q0: new THREE.Quaternion(),
    dent: new THREE.Vector3(),
    bend: new THREE.Quaternion(),
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
  // THE HULK: the point it goes over about, its slide along the snow, the
  // turn it ends at, how long it has been going over, and how far it is
  // let down to lie on the snow (worked out on its first step).
  const pivot = new THREE.Vector3();
  const slide = new THREE.Vector3();
  const over = new THREE.Quaternion();
  const turnNow = new THREE.Quaternion();
  const bendNow = new THREE.Quaternion();
  const unit = new THREE.Quaternion();
  const at = new THREE.Vector3();
  let hulkAge = -1;
  let sink: number | null = null;
  let landed = false;

  function build(machine: THREE.Object3D, model: THREE.Object3D): void {
    for (const p of pieces) {
      group.remove(p.mesh);
      p.mesh.geometry.dispose();
    }
    pieces = [...cut(machine, model)].map(([key, cell]) => pieceOf(key, cell));
    for (const p of pieces) group.add(p.mesh);
    builtFor = model;
  }

  /** THE HULK GOING OVER: `k` of the way, gravity's tip — slow off its
   * skid, fast onto its side — the slide along the snow eased out. */
  function placeHulk(k: number, groundAt: (x: number, z: number) => number): void {
    const tip = k * k;
    const out = 1 - (1 - k) * (1 - k);
    turnNow.slerpQuaternions(unit, over, tip);
    for (const p of pieces) {
      if (p.role !== "hulk") continue;
      at.copy(p.rel).applyQuaternion(turnNow).add(pivot).addScaledVector(slide, out);
      at.addScaledVector(p.dent, Math.min(1, k * 1.5));
      if (sink !== null) at.y -= sink * tip;
      p.pos.copy(at);
      p.mesh.position.copy(at);
      bendNow.slerpQuaternions(unit, p.bend, Math.min(1, k * 1.5));
      p.mesh.quaternion.copy(turnNow).multiply(p.q0).multiply(bendNow);
    }
    // Let down onto the snow: worked out once, where it will lie.
    if (sink === null) {
      turnNow.copy(over);
      let low = Infinity;
      for (const p of pieces) {
        if (p.role !== "hulk") continue;
        at.copy(p.rel).applyQuaternion(over).add(pivot).add(slide).add(p.dent);
        low = Math.min(low, at.y - p.size * 0.18 - groundAt(at.x, at.z));
      }
      sink = Number.isFinite(low) ? low : 0;
    }
  }

  function stepHulk(
    dt: number,
    groundAt: (x: number, z: number) => number,
    hooks: ShatterHooks,
  ): void {
    if (hulkAge > HULK.settle) return;
    hulkAge += dt;
    const k = Math.min(1, hulkAge / HULK.settle);
    placeHulk(k, groundAt);
    if (k >= 1 && !landed) {
      // Down on its side: a slam of snow and sparks off the metal.
      landed = true;
      hooks.strike(pivot.x + slide.x, groundAt(pivot.x, pivot.z), pivot.z + slide.z, 12);
    }
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
      // The hulk goes over about its skid on the side it rolls to, sliding
      // on a little along its way, nose up or down a touch.
      const side = random() < 0.5 ? -1 : 1;
      pivot.set(side * 1.1, 0, 0.3).applyMatrix4(machine.matrixWorld);
      const flatWay = Math.hypot(v.x, v.z);
      const far = Math.min(HULK.slideMost, flatWay * HULK.slide);
      slide.set(
        flatWay > 0.1 ? (v.x / flatWay) * far : 0,
        0,
        flatWay > 0.1 ? (v.z / flatWay) * far : 0,
      );
      const roll = side * (HULK.roll[0] + (HULK.roll[1] - HULK.roll[0]) * random());
      const pitch = (random() - 0.5) * 2 * HULK.pitch;
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      over
        .setFromAxisAngle(fwd, -roll)
        .multiply(new THREE.Quaternion().setFromAxisAngle(right, pitch));
      hulkAge = 0;
      sink = null;
      landed = false;
      for (const p of pieces) {
        p.pos.copy(p.centre).applyMatrix4(machine.matrixWorld);
        p.mesh.quaternion.copy(q);
        p.mesh.position.copy(p.pos);
        p.mesh.visible = true;
        p.rest = false;
        p.burn = 0;
        if (p.role === "hulk") {
          // Stays: buckled out of true, the skids splayed from under it.
          p.rel.copy(p.pos).sub(pivot);
          p.q0.copy(q);
          const d = HULK.dent;
          p.dent.set((random() - 0.5) * 2 * d, (random() - 0.6) * d, (random() - 0.5) * 2 * d);
          if (p.mesh.name.startsWith("piece-skid")) {
            along.set(p.centre.x < 0 ? -1 : 1, 0, 0).applyQuaternion(q);
            p.dent.addScaledVector(along, HULK.splay * (0.5 + random()));
          }
          axis.set(random() - 0.5, random() - 0.5, random() - 0.5).normalize();
          p.bend.setFromAxisAngle(axis, HULK.twist * random());
          p.rest = true;
          continue;
        }
        if (p.role === "boom") {
          // Snapped off at the cabin and thrown back off it, end over end.
          along
            .set((random() - 0.5) * 0.6, 0.35, -1)
            .applyQuaternion(q)
            .normalize();
          const sp = 4 + 3 * random();
          p.vel.set(v.x * 0.4 + along.x * sp, 3 + 2 * random(), v.z * 0.4 + along.z * sp);
          // Slewed round as it goes, never stood on end: it lands lying.
          p.spin.set((random() - 0.5) * 0.3, (random() - 0.5) * 2.5, (random() - 0.5) * 0.3);
          p.burn = 0.5;
          p.burnLeft = FLING.burnFor[1];
          continue;
        }
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
        if (p.role === "roof") p.vel.y += 4;
        p.burn = !p.blade && random() < FLING.burns ? 0.5 + 0.5 * random() : 0;
        p.burnLeft = FLING.burnFor[0] + (FLING.burnFor[1] - FLING.burnFor[0]) * random();
      }
    },
    update(dt, groundAt, hooks) {
      if (dt <= 0) return;
      if (hulkAge >= 0) stepHulk(dt, groundAt, hooks);
      for (const p of pieces) {
        if (!p.mesh.visible) continue;
        if (p.burn > 0 && p.burnLeft > 0) {
          p.burnLeft -= dt;
          // Burning out on the snow: the flames die down over their last
          // two seconds.
          const heat = p.burn * Math.min(1, p.burnLeft / 2) * (p.rest ? 0.6 : 1);
          if (heat > 0.02) hooks.flame(p.pos.x, p.pos.y, p.pos.z, heat, dt);
        }
        if (p.rest || p.role === "hulk") continue;
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
      hulkAge = -1;
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
