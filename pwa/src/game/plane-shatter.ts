// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE JUMP PLANE TORN APART — a crashed plane (`plane.ts`'s `crash`) as
// drawn: the airframe's own meshes (the Blender model, or the code's
// stand-in) cut once into the pieces a strut-braced high wing comes apart
// in, and broken up the way the KIND of crash it was breaks one
// (`PlaneWreck.kind`, the research in `defs/plane-wreck.ts`):
//
//   - the CABIN is the hulk: it stays, crushed — from the nose in a
//     nose-in, down onto itself out of a spin — and goes on from where it
//     struck along its way (far on its belly, over onto its back in a
//     cartwheel, slewed round a trunk) to come to rest on the snow;
//   - each WING, inboard and outboard of its strut's head, is FOLDED at its
//     root (up into a V out of a spin, forward in a nose-in, back and up on
//     its belly) or TORN OFF (the one whose tip struck in a cartwheel, the
//     one a trunk caught) and left where it came off;
//   - the TAILCONE breaks aft of the door, bent off the hulk or thrown;
//   - the ENGINE tears off its mount and rolls on ahead, or hangs bent off
//     the firewall; its PROPELLER's blades bent back at idle and curled
//     forward under power, each in three pieces along its span;
//   - the STRUTS buckle, the GEAR and its skis are torn off (left behind on
//     the belly), the DOOR is thrown.
//
// A piece is placed off its parent each frame (`placed`): the hulk's pose
// for what stays on it, its own flight for what is thrown, a thrown
// piece's own for what hangs off it (the blades off the engine), each
// bent about its hinge. The thrown ones tumble, strike the snow (a burst of
// sparks and snow), skid and come to rest; the hulk ploughs. The materials
// are cloned for the wreck (sets for what burns with the hulk and what is
// thrown clear), so the next plane on the strip is not charred with it; a
// wreck that does not light (`PlaneWreck.fire`) burns nothing, and a wing
// torn off before it went in is left out — it lies where it came down.
// Presentation only — a stream of its own, seeded off the crash, never the
// engine's; built once per model, nothing allocated once it is cut.

import * as THREE from "three";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { PLANE, type PlaneWreck, type WreckKind } from "@engine";

const W = PLANE.wing;
const ROOT_X = PLANE.struts.foot.x;
const STRUT_HEAD = PLANE.struts.head.x;
/** WHERE THE AIRFRAME COMES APART, body frame (x the left, y up, z
 * forward, from the ground datum), m: the tailcone's break aft of the door,
 * the firewall the engine tears off at, the gear's line under the cabin's
 * floor, the wing's underside, and a blade's three pieces along its
 * radius (shares of it). */
export const TEAR = {
  tail: -2.6,
  firewall: PLANE.cowling.back,
  gear: 0.9,
  wing: W.root.y - 0.25,
  blade: [0.3, 0.62] as const,
} as const;

/** What a piece of the airframe is. */
type Part =
  "cabin" | "engine" | "blade" | "wingIn" | "wingOut" | "strut" | "gear" | "tail" | "door";

/** What a crash does to a piece: kept on the HULK, FOLDED off it about its
 * hinge, TORN off where it struck and left lying, or THROWN off the
 * impact; `drop` torn off and left behind under its way. */
type Fate = "hulk" | "fold" | "tear" | "throw" | "drop";

/** How near the fire a piece lies (`Piece.sets`). */
type Heat = "hot" | "warm" | "cool";
const HEATS: readonly Heat[] = ["hot", "warm", "cool"];

/** ONE KIND OF CRASH: how far the hulk goes on along its way (a share of
 * its speed in metres, at most `most`), how long it takes to stop, s, the
 * slew round off its way, rad (a band), how it comes to rest — rolled,
 * pitched, rad — how far its cabin is crushed, m (`crush` along, `squash`
 * down), and each part's fate, with the fold's angles, rad. */
type Plan = {
  slide: number;
  most: number;
  settle: number;
  slew: readonly [number, number];
  roll: readonly [number, number];
  pitch: number;
  crush: number;
  squash: number;
  fates: Record<Exclude<Part, "cabin" | "blade">, Fate>;
  /** The wings' fold at the root: up (tips up positive), back (swept
   * aft positive); the outboard panel's own droop past it. */
  fold: { up: readonly [number, number]; back: readonly [number, number]; droop: number };
  /** The tailcone's and the engine's bend down off the hulk, rad. */
  tailBend: number;
  engineBend: number;
};

export const BREAK: Record<WreckKind, Plan> = {
  nose: {
    slide: 0.12,
    most: 8,
    settle: 1,
    slew: [-0.35, 0.35],
    roll: [-0.3, 0.3],
    pitch: -0.42,
    crush: 0.9,
    squash: 0.15,
    fates: {
      engine: "throw",
      wingIn: "fold",
      wingOut: "fold",
      strut: "throw",
      gear: "throw",
      tail: "fold",
      door: "throw",
    },
    fold: { up: [-0.25, -0.05], back: [-0.5, -0.2], droop: -0.35 },
    tailBend: -0.75,
    engineBend: 0.5,
  },
  cart: {
    slide: 0.55,
    most: 32,
    settle: 2.4,
    slew: [1.6, 3.0],
    roll: [2.4, 3.3],
    pitch: 0.1,
    crush: 0.4,
    squash: 0.35,
    fates: {
      engine: "throw",
      wingIn: "fold",
      wingOut: "throw",
      strut: "throw",
      gear: "throw",
      tail: "throw",
      door: "throw",
    },
    fold: { up: [0.35, 0.6], back: [0.2, 0.5], droop: 0.3 },
    tailBend: 0.4,
    engineBend: 0.4,
  },
  belly: {
    slide: 0.8,
    most: 46,
    settle: 3.4,
    slew: [-0.9, 0.9],
    roll: [-0.22, 0.22],
    pitch: 0.04,
    crush: 0.3,
    squash: 0.25,
    fates: {
      engine: "fold",
      wingIn: "fold",
      wingOut: "fold",
      strut: "drop",
      gear: "drop",
      tail: "fold",
      door: "throw",
    },
    fold: { up: [-0.12, 0.45], back: [0.15, 0.45], droop: -0.22 },
    tailBend: 0.22,
    engineBend: 0.25,
  },
  spin: {
    slide: 0.08,
    most: 5,
    settle: 0.9,
    slew: [-0.5, 0.5],
    roll: [-0.2, 0.2],
    pitch: -0.12,
    crush: 0.35,
    squash: 0.55,
    fates: {
      engine: "fold",
      wingIn: "fold",
      wingOut: "fold",
      strut: "fold",
      gear: "throw",
      tail: "fold",
      door: "throw",
    },
    fold: { up: [0.35, 0.62], back: [-0.08, 0.18], droop: -0.3 },
    tailBend: 0.35,
    engineBend: 0.42,
  },
  tree: {
    slide: 0.35,
    most: 18,
    settle: 1.8,
    slew: [1.1, 2.2],
    roll: [-0.6, 0.6],
    pitch: -0.08,
    crush: 0.5,
    squash: 0.25,
    fates: {
      engine: "fold",
      wingIn: "fold",
      wingOut: "throw",
      strut: "throw",
      gear: "throw",
      tail: "fold",
      door: "throw",
    },
    fold: { up: [0.1, 0.4], back: [0.3, 0.6], droop: 0.25 },
    tailBend: 0.45,
    engineBend: 0.3,
  },
};

/** HOW THE THROWN PIECES FLY: the share of the impact's way each keeps,
 * the push off the impact on the lightest piece, m/s, the climb, m/s, the
 * tumble, rad/s, the snow's bounce and the slide's friction; the blades'
 * bend, rad (back at idle, forward under power), down its three pieces;
 * the share of the thrown pieces that burn, how long, s, and how long a
 * torn wing's spilt tank burns, s. */
export const FLING = {
  keep: 0.5,
  push: [3, 11] as const,
  climb: [2, 8] as const,
  spin: 5,
  bounce: 0.3,
  slide: 2.6,
  back: [0.3, 0.55, 0.45] as const,
  forward: [0.2, 0.55, 0.75] as const,
  twist: 0.6,
  burns: 0.35,
  burnFor: [3, 10] as const,
  tank: [25, 60] as const,
} as const;

/** What a piece hands back for the fire and the snow. */
export type ShatterHooks = {
  /** A burning piece at (x, y, z) this frame, `heat` 0..1. */
  flame(x: number, y: number, z: number, heat: number, dt: number): void;
  /** A piece struck the snow at (x, y, z) at `speed` m/s. */
  strike(x: number, y: number, z: number, speed: number): void;
  /** The hulk ploughing the snow at (x, y, z) at `speed` m/s along (dx, dz). */
  plough(x: number, y: number, z: number, speed: number, dx: number, dz: number): void;
};

/** Where the wreck's nodes are: the airframe's root (its frame the engine's
 * body frame), the propeller's node and the door's. */
export type WreckParts = {
  root: THREE.Object3D;
  prop: THREE.Object3D | null;
  door: THREE.Object3D | null;
};

export type PlaneShatter = {
  group: THREE.Group;
  /** Tear the airframe under `parts` — drawn under `machine` (its frame the
   * engine's body frame, at the wreck's pose) — into its pieces and break
   * them up as `wreck` went in. */
  burst(
    machine: THREE.Object3D,
    parts: WreckParts,
    wreck: PlaneWreck,
    groundAt: (x: number, z: number) => number,
  ): void;
  /** Cut the airframe under `parts` into its pieces now, hidden, so a
   * burst later finds them built (`PlaneWreckView.prime`). */
  prime(machine: THREE.Object3D, parts: WreckParts): void;
  /** `age` s since the crash (the run's clock, so a frame skipped on is
   * caught up), `dt` this frame. */
  update(age: number, groundAt: (x: number, z: number) => number, hooks: ShatterHooks): void;
  /** Where the hulk's wing roots stand this frame (the pool fire's heart),
   * into `out`; and whether it has stopped. */
  heart(out: THREE.Vector3): boolean;
  /** Where the hulk comes to rest (worked out at the burst). */
  rest(): THREE.Vector3;
  /** Every surface of the wreck charred: `hot` the hulk's and what burns
   * with it, `cool` the thrown pieces'; `ash` how far the hottest has burnt
   * on past soot to grey ash. */
  char(hot: number, cool: number, ash: number): void;
  /** Whether any piece is still moving. */
  moving(): boolean;
  clear(): void;
  dispose(): void;
};

type Piece = {
  key: string;
  part: Part;
  side: number;
  mesh: THREE.Mesh;
  /** Its centre in the airframe's frame, and its box's corners about it. */
  centre: THREE.Vector3;
  corners: THREE.Vector3[];
  size: number;
  /** A blade's index and piece along its span. */
  blade: number;
  seg: number;
  /** Its surfaces charred by how near the fire it lies this crash: on
   * the burning hulk (`hot`), on it but off the fire or thrown burning
   * (`warm`), thrown clear (`cool`). */
  sets: Record<Heat, THREE.Material[]>;
  /** This crash: its fate, its parent (−1 the hulk), its hinge in the
   * airframe's frame and its bend about it, and its dent. */
  fate: Fate;
  parent: number;
  hinge: THREE.Vector3;
  bend: THREE.Quaternion;
  dent: THREE.Vector3;
  /** A free piece's flight. */
  free: boolean;
  pos: THREE.Vector3;
  q: THREE.Quaternion;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
  rest: boolean;
  /** The burn it trails, 0..1, and for how long, s. */
  burn: number;
  burnFor: number;
  /** Placed this frame: its world matrix. */
  world: THREE.Matrix4;
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

/** Which piece a triangle centred at `c` (airframe frame) falls in. */
function cellOf(c: THREE.Vector3, node: "body" | "prop" | "door"): string {
  const side = c.x >= 0 ? "l" : "r";
  if (node === "door") return "door";
  if (node === "prop") {
    const dx = c.x;
    const dy = c.y - PLANE.prop.hub.y;
    const r = Math.hypot(dx, dy) / (PLANE.prop.diameter / 2);
    if (r < 0.14) return "engine";
    const n = PLANE.prop.blades;
    const a = Math.atan2(dx, dy) + Math.PI;
    const k = Math.floor((a / (Math.PI * 2)) * n + 0.5) % n;
    const seg = r < TEAR.blade[0] ? 0 : r < TEAR.blade[1] ? 1 : 2;
    return `blade-${k}-${seg}`;
  }
  const ax = Math.abs(c.x);
  if (c.z < TEAR.tail) return "tail";
  if (c.z > TEAR.firewall) return "engine";
  if (ax > ROOT_X && c.y > TEAR.wing) return `wing-${side}-${ax < STRUT_HEAD ? "in" : "out"}`;
  // The strut runs from its foot on the cabin's side up to its head
  // under the wing: a triangle near that line is the strut's.
  const S = PLANE.struts;
  if (ax > ROOT_X + 0.05 && ax < S.head.x + 0.3) {
    const k = (ax - S.foot.x) / (S.head.x - S.foot.x);
    const y = S.foot.y + (S.head.y - S.foot.y) * k;
    if (Math.abs(c.y - y) < 0.45) return `strut-${side}`;
  }
  if (c.y < TEAR.gear && ax > 0.3) return `gear-${side}`;
  const along = c.z > PLANE.cabin.front ? "front" : c.z > PLANE.door.back ? "mid" : "rear";
  return `cabin-${along}-${side}-${c.y > 2.0 ? "top" : "low"}`;
}

const partOf = (key: string): Part => {
  if (key.startsWith("blade")) return "blade";
  if (key.startsWith("wing")) return key.endsWith("in") ? "wingIn" : "wingOut";
  if (key.startsWith("strut")) return "strut";
  if (key.startsWith("gear")) return "gear";
  if (key.startsWith("cabin")) return "cabin";
  return key as Part;
};

export function createPlaneShatter(): PlaneShatter {
  const group = new THREE.Group();
  group.name = "plane-pieces";
  group.matrixAutoUpdate = false;
  let pieces: Piece[] = [];
  let builtFor: THREE.Object3D | null = null;
  /** The wreck's materials: a clone of each of the airframe's for each
   * heat a piece lies in (`Piece.sets`), with their colours as built. */
  const hot = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const warm = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const cool = new Map<THREE.Material, THREE.MeshStandardMaterial>();
  const SETS: Record<Heat, Map<THREE.Material, THREE.MeshStandardMaterial>> = { hot, warm, cool };
  const built = new Map<THREE.MeshStandardMaterial, { c: THREE.Color; r: number; m: number }>();
  // THE HULK: its pose as it struck and at rest, the clock's settle, where
  // its lowest corner meets the snow, and its pose this frame.
  const q0 = new THREE.Quaternion();
  const p0 = new THREE.Vector3();
  const qRest = new THREE.Quaternion();
  const pRest = new THREE.Vector3();
  const qNow = new THREE.Quaternion();
  const pNow = new THREE.Vector3();
  const hulkM = new THREE.Matrix4();
  let plan: Plan = BREAK.belly;
  let way = 0;
  let wayX = 0;
  let wayZ = 0;
  let age = -1;
  let stepped = 0;
  let last = 0;
  let landed = false;
  const SOOT = new THREE.Color(0x0d0b0a);
  const ASH = new THREE.Color(0x77736d);
  const t = new THREE.Vector3();
  const u = new THREE.Vector3();
  const m = new THREE.Matrix4();
  const mq = new THREE.Quaternion();
  const ONE = new THREE.Vector3(1, 1, 1);
  const unit = new THREE.Quaternion();

  function cloneOf(mat: THREE.Material, set: Map<THREE.Material, THREE.MeshStandardMaterial>) {
    let c = set.get(mat);
    if (!c) {
      c = (mat as THREE.MeshStandardMaterial).clone();
      // The windows are blown out and burnt: no glass on a wreck.
      if (/glass/i.test(c.name)) {
        c.transparent = false;
        c.opacity = 1;
        c.color.set(0x141210);
      }
      // The propeller's blades, faded under their smear while it turned
      // (`plane-view.ts`): solid bent metal now.
      if (/^(prop|tip)/i.test(c.name)) {
        c.transparent = false;
        c.opacity = 1;
      }
      c.side = THREE.DoubleSide;
      set.set(mat, c);
      built.set(c, { c: c.color.clone(), r: c.roughness, m: c.metalness });
    }
    return c;
  }

  /** Every mesh under `parts.root`, cut into cells in the frame of
   * `machine`. */
  function build(machine: THREE.Object3D, parts: WreckParts): void {
    for (const p of pieces) {
      group.remove(p.mesh);
      p.mesh.geometry.dispose();
    }
    machine.updateMatrixWorld(true);
    const toMachine = new THREE.Matrix4().copy(machine.matrixWorld).invert();
    const cells = new Map<string, Map<THREE.Material, number[]>>();
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const mid = new THREE.Vector3();
    parts.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      // Both wings are cut in, the one put away for having been torn off
      // in the air (`plane-wing-cut.ts`) too: a burst leaves that side's
      // pieces out rather than cutting the airframe again.
      if (o.userData.wingCut === undefined && !o.visible) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      if (!mats.every((x) => x instanceof THREE.MeshStandardMaterial)) return;
      let node: "body" | "prop" | "door" = "body";
      for (let p: THREE.Object3D | null = o; p && p !== parts.root; p = p.parent) {
        if (p === parts.prop) node = "prop";
        if (p === parts.door) node = "door";
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
          a.fromBufferAttribute(pos, index ? index.getX(i) : i).applyMatrix4(m);
          b.fromBufferAttribute(pos, index ? index.getX(i + 1) : i + 1).applyMatrix4(m);
          c.fromBufferAttribute(pos, index ? index.getX(i + 2) : i + 2).applyMatrix4(m);
          mid
            .copy(a)
            .add(b)
            .add(c)
            .multiplyScalar(1 / 3);
          const key = cellOf(mid, node);
          let cell = cells.get(key);
          if (!cell) cells.set(key, (cell = new Map()));
          let list = cell.get(mat);
          if (!list) cell.set(mat, (list = []));
          list.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
        }
      }
    });
    // Parents before their children: the hulk, the engine, the inboard
    // wings, the rest, the outboard wings, the blades root first.
    const rank = (k: string): number =>
      k.startsWith("blade")
        ? 10 + Number(k.split("-")[2])
        : k.startsWith("wing") && k.endsWith("out")
          ? 5
          : k.startsWith("cabin")
            ? 0
            : k === "engine"
              ? 1
              : k.startsWith("wing")
                ? 2
                : 3;
    pieces = [...cells]
      .sort(([a], [b]) => rank(a) - rank(b))
      .map(([key, cell]) => pieceOf(key, cell));
    for (const p of pieces) group.add(p.mesh);
    builtFor = parts.root;
  }

  function pieceOf(key: string, cell: Map<THREE.Material, number[]>): Piece {
    const part = partOf(key);
    const centre = new THREE.Vector3();
    const box = new THREE.Box3();
    let n = 0;
    for (const list of cell.values()) {
      for (let i = 0; i < list.length; i += 3) {
        t.set(list[i], list[i + 1], list[i + 2]);
        centre.add(t);
        box.expandByPoint(t);
        n++;
      }
    }
    centre.multiplyScalar(1 / Math.max(1, n));
    const all: number[] = [];
    const geo = new THREE.BufferGeometry();
    const sets: Record<Heat, THREE.Material[]> = { hot: [], warm: [], cool: [] };
    for (const [mat, list] of cell) {
      const start = all.length / 3;
      for (let i = 0; i < list.length; i += 3) {
        all.push(list[i] - centre.x, list[i + 1] - centre.y, list[i + 2] - centre.z);
      }
      geo.addGroup(start, list.length / 3, sets.hot.length);
      for (const h of HEATS) sets[h].push(cloneOf(mat, SETS[h]));
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(all, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, sets.cool);
    mesh.name = `plane-piece-${key}`;
    mesh.castShadow = true;
    mesh.visible = false;
    mesh.matrixAutoUpdate = false;
    const corners: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) {
      corners.push(
        new THREE.Vector3(
          (i & 1 ? box.max.x : box.min.x) - centre.x,
          (i & 2 ? box.max.y : box.min.y) - centre.y,
          (i & 4 ? box.max.z : box.min.z) - centre.z,
        ),
      );
    }
    const blade = part === "blade" ? Number(key.split("-")[1]) : -1;
    const seg = part === "blade" ? Number(key.split("-")[2]) : -1;
    return {
      key,
      part,
      side: key.split("-").includes("l") ? 1 : key.split("-").includes("r") ? -1 : 0,
      mesh,
      centre,
      corners,
      size: box.getSize(t).length(),
      blade,
      seg,
      sets,
      fate: "hulk",
      parent: -1,
      hinge: new THREE.Vector3(),
      bend: new THREE.Quaternion(),
      dent: new THREE.Vector3(),
      free: false,
      pos: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      vel: new THREE.Vector3(),
      spin: new THREE.Vector3(),
      rest: true,
      burn: 0,
      burnFor: 0,
      world: new THREE.Matrix4(),
    };
  }

  /** A piece's matrix in its PARENT's frame at `k` of its bend: turned
   * about its hinge and dented. */
  function local(p: Piece, k: number, out: THREE.Matrix4): THREE.Matrix4 {
    mq.slerpQuaternions(unit, p.bend, k);
    t.copy(p.centre).sub(p.hinge).applyQuaternion(mq).add(p.hinge).addScaledVector(p.dent, k);
    if (p.parent >= 0) t.sub(pieces[p.parent].centre);
    return out.compose(t, mq, ONE);
  }

  /** The hulk's pose `k` of the way from as it struck to at rest. */
  function hulkAt(k: number): void {
    const out = 1 - (1 - k) * (1 - k);
    qNow.slerpQuaternions(q0, qRest, Math.min(1, k * 1.15));
    pNow.lerpVectors(p0, pRest, out);
    hulkM.compose(pNow, qNow, ONE);
  }

  /** Every piece placed: the hulk's and its children's off the hulk, a
   * free piece off its own flight, its children off it. */
  function place(k: number): void {
    hulkAt(k);
    const bendK = Math.min(1, k * 2.2);
    for (const p of pieces) {
      if (!p.mesh.visible) continue;
      if (p.free) {
        p.world.compose(p.pos, p.q, ONE);
      } else {
        const base = p.parent >= 0 ? pieces[p.parent].world : hulkM;
        p.world.multiplyMatrices(base, local(p, bendK, m));
      }
      p.mesh.matrix.copy(p.world);
      p.mesh.matrixWorldNeedsUpdate = true;
    }
  }

  /** The lowest point of every piece kept on the hulk, at the rest pose. */
  function lowest(): number {
    hulkAt(1);
    let low = Infinity;
    for (const p of pieces) {
      if (p.free || !p.mesh.visible) continue;
      const base = p.parent >= 0 ? pieces[p.parent].world : hulkM;
      p.world.multiplyMatrices(base, local(p, 1, m));
      for (const c of p.corners) low = Math.min(low, u.copy(c).applyMatrix4(p.world).y);
    }
    return low;
  }

  /** Thrown: off as it stood, with the impact's way, a push and a tumble. */
  function throwOf(p: Piece, w: PlaneWreck, random: () => number, push: number): void {
    p.free = true;
    p.parent = -1;
    p.world.decompose(p.pos, p.q, u);
    const light = Math.min(1, 1 / Math.sqrt(Math.max(0.3, p.size)));
    const keep = p.fate === "drop" ? 0.12 : p.fate === "tear" ? 0.3 : FLING.keep;
    t.copy(p.pos).sub(pNow);
    t.y = Math.max(0, t.y) + 0.4;
    t.normalize();
    const sp = (FLING.push[0] + (FLING.push[1] - FLING.push[0]) * light * random()) * push;
    const climb = (FLING.climb[0] + (FLING.climb[1] - FLING.climb[0]) * random()) * push;
    p.vel.set(
      w.vx * keep + t.x * sp,
      Math.max(0, w.vy) * keep + climb * (p.fate === "drop" ? 0.3 : 1),
      w.vz * keep + t.z * sp,
    );
    const s = FLING.spin * light * push;
    p.spin.set((random() - 0.5) * 2 * s, (random() - 0.5) * 2 * s, (random() - 0.5) * 2 * s);
    p.rest = false;
  }

  return {
    group,
    prime(machine, parts) {
      if (parts.root !== builtFor) build(machine, parts);
    },
    burst(machine, parts, w, groundAt) {
      const torn = w.torn ?? [false, false];
      if (parts.root !== builtFor) build(machine, parts);
      const random = makeRandom(
        Math.floor(w.x * 131 + w.z * 977 + w.speed * 7919) ^ Math.floor(w.fuel * 37),
      );
      plan = BREAK[w.kind];
      // AS IT STRUCK, and where it comes to rest: on along its way, slewed
      // round off it, rolled and pitched as the kind lays it, on the snow.
      machine.updateMatrixWorld(true);
      machine.getWorldQuaternion(q0);
      machine.getWorldPosition(p0);
      way = Math.hypot(w.vx, w.vz);
      wayX = way > 0.5 ? w.vx / way : 0;
      wayZ = way > 0.5 ? w.vz / way : 0;
      const far = Math.min(plan.most, way * plan.slide);
      pRest.set(p0.x + wayX * far, p0.y, p0.z + wayZ * far);
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q0);
      const heading = way > 3 ? Math.atan2(wayX, wayZ) : Math.atan2(fwd.x, fwd.z);
      // A cartwheel and a trunk slew it round toward the wing that caught.
      const side = w.tip !== 0 ? w.tip : random() < 0.5 ? -1 : 1;
      const turnBy = plan.slew[0] + (plan.slew[1] - plan.slew[0]) * random();
      const slew = w.kind === "cart" || w.kind === "tree" ? -side * turnBy : turnBy;
      const roll =
        (plan.roll[0] + (plan.roll[1] - plan.roll[0]) * random()) * (w.kind === "cart" ? -side : 1);
      const q = fromEuler(heading + slew + (w.kind === "spin" ? w.wy * 0.5 : 0), plan.pitch, roll);
      qRest.set(q.x, q.y, q.z, q.w);
      // Laid along the slope it comes to rest on.
      const e = 1.5;
      const gx = (groundAt(pRest.x + e, pRest.z) - groundAt(pRest.x - e, pRest.z)) / (2 * e);
      const gz = (groundAt(pRest.x, pRest.z + e) - groundAt(pRest.x, pRest.z - e)) / (2 * e);
      const normal = new THREE.Vector3(-gx, 1, -gz).normalize();
      qRest.premultiply(
        new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal),
      );
      age = 0;
      stepped = 0;
      last = 0;
      landed = false;
      // THE PIECES' FATES for this kind.
      for (const p of pieces) {
        // A wing torn off before it went in lies where it came down: its
        // pieces (every one of them its cut triangles, `wingSideOf`) left out.
        const gone = (p.part === "wingIn" || p.part === "wingOut") && torn[p.side > 0 ? 0 : 1];
        p.mesh.visible = !gone;
        p.free = false;
        p.rest = true;
        p.parent = -1;
        p.bend.identity();
        p.dent.set(0, 0, 0);
        p.hinge.copy(p.centre);
        p.burn = 0;
        p.burnFor = 0;
        p.fate = p.part === "cabin" ? "hulk" : p.part === "blade" ? "fold" : plan.fates[p.part];
        // The wing whose tip struck, or the trunk took, is torn off there.
        if ((p.part === "wingIn" || p.part === "wingOut") && p.side === side) {
          if (w.kind === "cart") p.fate = "tear";
          if (w.kind === "tree") p.fate = "tear";
        }
        // Struck hard nose first, an outboard panel snaps off at the strut
        // and goes on ahead with the impact.
        if (w.kind === "nose" && p.part === "wingOut" && w.speed > 38 && random() < 0.55)
          p.fate = "tear";
      }
      const find = (part: Part, side = 0) =>
        pieces.findIndex((p) => p.part === part && (side === 0 || p.side === side));
      const engine = find("engine");
      for (const p of pieces) {
        const s = p.side;
        const r = (lo: number, hi: number) => lo + (hi - lo) * random();
        switch (p.part) {
          case "cabin": {
            // Crushed from the nose back, the front the most; squashed
            // down onto itself; buckled out of true.
            const front =
              p.centre.z > PLANE.cabin.front ? 1 : p.centre.z > PLANE.door.back ? 0.5 : 0.2;
            p.dent.set(
              (random() - 0.5) * 0.25,
              -plan.squash * (p.key.endsWith("top") ? 1 : 0.4) * r(0.6, 1.2),
              -plan.crush * front * r(0.7, 1.1),
            );
            const ax = new THREE.Vector3(
              random() - 0.5,
              random() - 0.5,
              random() - 0.5,
            ).normalize();
            p.bend.setFromAxisAngle(ax, r(0.05, 0.18));
            break;
          }
          case "wingIn":
          case "wingOut": {
            const inner = pieces.findIndex((o) => o.part === "wingIn" && o.side === s);
            if (
              p.part === "wingOut" &&
              inner >= 0 &&
              p.fate === "fold" &&
              pieces[inner].fate === "fold"
            ) {
              // Hung off the inboard panel at the strut's head, drooping.
              p.parent = inner;
              p.hinge.set(s * STRUT_HEAD, W.root.y, W.root.le - W.chord / 2);
              p.bend.setFromAxisAngle(
                new THREE.Vector3(0, 0, 1),
                s * plan.fold.droop * r(0.6, 1.3),
              );
            } else {
              p.hinge.set(s * ROOT_X, W.root.y, W.root.le - W.chord * 0.3);
              const up = r(plan.fold.up[0], plan.fold.up[1]);
              const back = r(plan.fold.back[0], plan.fold.back[1]);
              p.bend
                .setFromAxisAngle(new THREE.Vector3(0, 0, 1), s * up)
                .premultiply(
                  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s * back),
                );
            }
            if (p.part === "wingIn" || p.fate !== "fold") {
              // The tanks are in the wings: a lit wreck's torn wing burns.
              p.burn = p.fate === "fold" ? 0.35 : 0.8;
              p.burnFor = r(FLING.tank[0], FLING.tank[1]);
            }
            break;
          }
          case "strut":
            // Buckled at its middle, swung about its foot.
            p.hinge.set(s * PLANE.struts.foot.x, PLANE.struts.foot.y, PLANE.struts.foot.z);
            p.bend.setFromAxisAngle(new THREE.Vector3(0, 0, 1), s * r(0.3, 0.7));
            break;
          case "tail": {
            // Broken aft of the door: bent down or up and aside.
            p.hinge.set(0, 1.2, TEAR.tail);
            p.bend
              .setFromAxisAngle(new THREE.Vector3(1, 0, 0), plan.tailBend * r(0.6, 1.2))
              .multiply(
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r(-0.35, 0.35)),
              );
            break;
          }
          case "engine":
            // Off its mount at the firewall: hung down and aside.
            p.hinge.set(0, 1.25, TEAR.firewall);
            p.bend
              .setFromAxisAngle(new THREE.Vector3(1, 0, 0), plan.engineBend * r(0.7, 1.2))
              .multiply(
                new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r(-0.3, 0.3)),
              );
            p.burn = 0.5;
            p.burnFor = r(10, 25);
            break;
          case "blade": {
            // Each piece of a blade bent about its inner end, on from the
            // last: back at idle, curled forward and twisted under power.
            const parent =
              p.seg === 0
                ? engine
                : pieces.findIndex((o) => o.blade === p.blade && o.seg === p.seg - 1);
            p.parent = parent;
            const a = ((p.blade + 0.5) / PLANE.prop.blades) * Math.PI * 2 - Math.PI;
            const radial = new THREE.Vector3(Math.sin(a), Math.cos(a), 0);
            const r0 = p.seg === 0 ? 0.14 : TEAR.blade[p.seg - 1];
            p.hinge
              .copy(radial)
              .multiplyScalar(r0 * (PLANE.prop.diameter / 2))
              .add(new THREE.Vector3(0, PLANE.prop.hub.y, PLANE.prop.hub.z));
            const under = w.power > 0.4;
            const amount = (under ? FLING.forward : FLING.back)[p.seg] * r(0.4, 1.25);
            const axis = new THREE.Vector3()
              .crossVectors(radial, new THREE.Vector3(0, 0, 1))
              .normalize();
            p.bend.setFromAxisAngle(axis, under ? amount : -amount);
            if (under)
              p.bend.multiply(
                new THREE.Quaternion().setFromAxisAngle(radial, FLING.twist * r(0, 1)),
              );
            break;
          }
          default:
            break;
        }
      }
      // Laid on the snow under where it rests, on the slope there.
      hulkAt(0);
      place(0);
      const low = lowest();
      pRest.y += groundAt(pRest.x, pRest.z) - low - 0.12;
      // And thrown: every piece off the hulk as it struck.
      hulkAt(0);
      place(0);
      const push = Math.min(1.6, 0.4 + w.speed / 35);
      for (const p of pieces) {
        if (p.fate === "throw" || p.fate === "tear" || p.fate === "drop") {
          throwOf(p, w, random, p.fate === "throw" ? push : 0.5);
          if (p.burn === 0 && random() < FLING.burns) {
            p.burn = 0.4 + 0.5 * random();
            p.burnFor = FLING.burnFor[0] + (FLING.burnFor[1] - FLING.burnFor[0]) * random();
          }
        }
      }
      // A thrown parent's blades go with it: their place re-based on it.
      place(0);
      // Unlit (`PlaneWreck.fire`), nothing burns: the tanks spill cold.
      if (!w.fire) for (const p of pieces) p.burn = 0;
      // How near the fire each lies: the hulk and what stays on it burn
      // with it — the tanks are in the wings — the tail aft of the fire
      // and a thrown piece alight scorch, the rest lie clear.
      for (const p of pieces) {
        const thrown = p.fate === "throw" || p.fate === "tear" || p.fate === "drop";
        const heat: Heat = !w.fire
          ? "cool"
          : thrown
            ? p.burn > 0
              ? "warm"
              : "cool"
            : p.part === "tail"
              ? "warm"
              : "hot";
        p.mesh.material = p.sets[heat];
      }
    },
    update(now, groundAt, hooks) {
      if (age < 0) return;
      // Caught up to the run's clock in steps of a sixtieth at most, so a
      // frame skipped on (a lab's) settles the same as one drawn.
      const target = Math.max(0, now);
      const DT = 1 / 60;
      let guard = 0;
      while (stepped < target - 1e-6 && guard++ < 1200) {
        const dt = Math.min(DT, target - stepped);
        stepped += dt;
        step(dt, groundAt, hooks);
      }
      if (guard >= 1200) stepped = target;
      age = target;
      place(Math.min(1, age / plan.settle));
    },
    heart(out) {
      out.set(0, W.root.y - 0.4, W.root.le - W.chord / 2).applyMatrix4(hulkM);
      return age >= plan.settle;
    },
    rest: () => pRest,
    char(h, c, ash) {
      for (const [set, k] of [
        [hot, h],
        [warm, Math.max(c, h * 0.75)],
        [cool, c],
      ] as const) {
        for (const mat of set.values()) {
          const b = built.get(mat)!;
          mat.color
            .copy(b.c)
            .multiplyScalar(1 - 0.95 * k)
            .lerp(SOOT, 0.6 * k);
          if (set === hot && ash > 0) mat.color.lerp(ASH, ash * 0.7);
          mat.roughness = b.r + (1 - b.r) * k;
          mat.metalness = b.m * (1 - k);
        }
      }
    },
    moving() {
      return age >= 0 && (age < plan.settle || pieces.some((p) => p.free && !p.rest));
    },
    clear() {
      age = -1;
      for (const p of pieces) {
        p.mesh.visible = false;
        p.rest = true;
      }
    },
    dispose() {
      for (const p of pieces) p.mesh.geometry.dispose();
      for (const mat of [...hot.values(), ...warm.values(), ...cool.values()]) mat.dispose();
      pieces = [];
    },
  };

  /** One step of the thrown pieces and the hulk's slide. */
  function step(dt: number, groundAt: (x: number, z: number) => number, hooks: ShatterHooks): void {
    const k = Math.min(1, stepped / plan.settle);
    // The hulk ploughs on along its way, throwing snow, until it stops —
    // and slams down as it settles.
    const was = last;
    last = 1 - (1 - k) * (1 - k);
    const moved = (last - was) * Math.hypot(pRest.x - p0.x, pRest.z - p0.z);
    if (k < 1 && moved > 0) {
      hulkAt(k);
      hooks.plough(pNow.x, groundAt(pNow.x, pNow.z), pNow.z, moved / dt, wayX, wayZ);
    }
    if (k >= 1 && !landed) {
      landed = true;
      hooks.strike(pRest.x, groundAt(pRest.x, pRest.z), pRest.z, 10);
    }
    for (const p of pieces) {
      if (!p.mesh.visible) continue;
      // A piece still on the hulk burns in the pool fire round it; only a
      // piece thrown clear trails a fire of its own.
      if (p.free && p.burn > 0 && p.burnFor > 0) {
        p.burnFor -= dt;
        const heat = p.burn * Math.min(1, p.burnFor / 3) * (p.rest ? 0.7 : 1);
        if (heat > 0.02) {
          u.setFromMatrixPosition(p.world);
          hooks.flame(u.x, u.y, u.z, heat, dt);
        }
      }
      if (!p.free || p.rest) continue;
      p.vel.y -= 9.81 * dt;
      p.vel.multiplyScalar(Math.exp(-0.06 * dt));
      p.pos.addScaledVector(p.vel, dt);
      const g = groundAt(p.pos.x, p.pos.z) + Math.min(0.3, p.size * 0.08);
      if (p.pos.y < g) {
        const down = -p.vel.y;
        p.pos.y = g;
        if (down > 2.5) hooks.strike(p.pos.x, g, p.pos.z, Math.hypot(down, p.vel.x, p.vel.z));
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
      const w = p.spin.length();
      if (w > 1e-3) {
        t.copy(p.spin).multiplyScalar(1 / w);
        mq.setFromAxisAngle(t, w * dt);
        p.q.premultiply(mq);
      }
    }
  }
}
