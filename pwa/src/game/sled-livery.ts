// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWMOBILE'S LIVERIES, AND THE ONES STOOD STILL — what a machine is
// drawn in besides the free ride's own: the SKI PATROL's (`SledLivery`,
// `rescue-sled.ts`) is a signal red on the model's painted panels, a white
// cross on each side of the hood and on the back of the tail pack, an
// amber beacon turning on a short mast over the pack and an orange flag on
// a tall whip off the tunnel's end — the kit a patrol machine carries so
// it is seen on a busy run and over a rise. `tintSled` and `patrolKit` are
// shared by every drawer of a machine: the player's own (`sled-view.ts`,
// a patrol machine he has stolen) and the rescue's (`rescue-sleds-view.ts`).
//
// `createSledFleet` draws machines that STAND (or are driven along a way
// as a whole, nothing on them turning): the patrol's two at a rescue and
// the ones the player has left behind (`GameState.sledsLeft`). One copy of
// the model a livery — its parts merged to a draw a node — cloned for each
// machine, so a fleet of five costs five machines' draws and no more
// geometry. Each copy hangs in the TRACE's frame (`sled-look.ts`: z forward
// from the tunnel's end, y up from the snow under the belt), so a caller
// places it by its middle on the snow (`standOnSnow`) or by the engine's
// body (`atBody`).

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import { SLED, type Level, type SledState } from "@engine";

import { glow } from "./glow-sprite.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { mergeParts } from "./model-merge.ts";
import { armyKitMaterials, armySledKit, type ArmySledKit } from "./sled-army-kit.ts";
import { SLED_LOOK } from "./sled-look.ts";
import { sledModelUrl } from "./skier-models.ts";

export type SledLivery = NonNullable<SledState["livery"]>;

/** EACH LIVERY's colours, sRGB: the paint on the model's `paint` panels,
 * the cross, the beacon's dome, the flag, the mast and the whip. */
export const LIVERIES: Readonly<
  Record<SledLivery, { paint: number; cross: number; beacon: number; flag: number; mast: number }>
> = {
  patrol: { paint: 0xc8101e, cross: 0xf6f6f2, beacon: 0xffa424, flag: 0xff5a12, mast: 0x1c1d20 },
  army: { paint: 0x4b5233, cross: 0xe4e6e2, beacon: 0x3a3f2a, flag: 0x4b5233, mast: 0x1c1d20 },
};

/** THE PATROL'S KIT in the trace's frame, m: the crosses (the hood's side
 * at its fullest, its middle along and up; the tail pack's back), the
 * beacon's mast (where it stands on the pack, how tall, the dome's radius
 * and height) and the flag's whip (where it stands on the tunnel's end,
 * how tall, how far its tip leans back, the pennant's length and drop). */
export const PATROL_KIT = {
  cross: { x: SLED_LOOK.hoodWidth / 2 - 0.02, z: 1.98, y: 0.6, size: 0.3, bar: 0.075 },
  tail: { z: SLED_LOOK.tailbox[0][0] - 0.004, y: 0.69, size: 0.15, bar: 0.04 },
  mast: { x: -0.13, z: 0.98, y: 0.8, height: 0.62, radius: 0.075, dome: 0.12 },
  whip: { x: 0.17, z: 0.1, y: 0.68, height: 1.95, lean: 0.22, pennant: 0.46, drop: 0.3 },
  /** The beacon turns this many revolutions a second. */
  spin: 1.3,
} as const;

/** The model's paint, set to `livery`'s (or back to the model's own, kept
 * in `own` the first time each material is met). */
export function tintSled(
  materials: Iterable<THREE.Material>,
  livery: SledLivery | undefined,
  own: Map<THREE.Material, THREE.Color>,
): void {
  for (const m of materials) {
    if (m.name !== "paint" || !(m instanceof THREE.MeshStandardMaterial)) continue;
    if (!own.has(m)) own.set(m, m.color.clone());
    if (livery) m.color.set(LIVERIES[livery].paint);
    else m.color.copy(own.get(m)!);
  }
}

/** Whether a material is the model's paint — kept out of a merge
 * (`mergeParts`' `keep`), so a livery can still be put on it. */
export const isPaint = (m: THREE.Material): boolean => m.name === "paint";

export type PatrolKit = {
  /** In the trace's frame: hang it beside the model. */
  group: THREE.Group;
  /** The beacon turned to the clock `t`, s, and its flash and dome lit for
   * `lit` (the dark's share, 0..1) as seen from `eye` (or full on). */
  update(t: number, lit: number, eye: THREE.Vector3 | null, on?: boolean): void;
  /** The beacon's beam's heading off the machine's own, rad, and the
   * point it turns about. */
  beam(): number;
  top: THREE.Object3D;
  dispose(): void;
};

/** A box from its two corners, in a material, into `g`. */
function slab(
  g: THREE.Group,
  m: THREE.Material,
  x0: number,
  y0: number,
  z0: number,
  x1: number,
  y1: number,
  z1: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m);
  mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
  g.add(mesh);
  return mesh;
}

/** The kit's materials, shared by every kit one drawer builds. */
export type KitMaterials = {
  cross: THREE.MeshStandardMaterial;
  mast: THREE.MeshStandardMaterial;
  flag: THREE.MeshStandardMaterial;
  dome: THREE.MeshStandardMaterial;
  all: THREE.Material[];
};

export function kitMaterials(haze: HazeUniforms, livery: SledLivery = "patrol"): KitMaterials {
  const L = LIVERIES[livery];
  const mat = (colour: number, rough: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
    hazeMaterial(
      new THREE.MeshStandardMaterial({ color: colour, roughness: rough, ...extra }),
      haze,
      "sled-kit",
    );
  const cross = mat(L.cross, 0.45, { polygonOffset: true, polygonOffsetFactor: -2 });
  const mast = mat(L.mast, 0.5, { metalness: 0.3 });
  const flag = mat(L.flag, 0.8, {
    side: THREE.DoubleSide,
    emissive: L.flag,
    emissiveIntensity: 0.12,
  });
  const dome = mat(L.beacon, 0.25, { emissive: L.beacon, emissiveIntensity: 1 });
  return { cross, mast, flag, dome, all: [cross, mast, flag, dome] };
}

/** One white cross, `size` m across and its bars `bar` wide, on the plane
 * `axis` faces out of (x a side, z the back), its middle at `at`. */
function crossOn(
  g: THREE.Group,
  m: THREE.Material,
  axis: "x" | "z",
  at: THREE.Vector3,
  size: number,
  bar: number,
  out: number,
): void {
  const t = 0.008;
  const h = size / 2;
  const b = bar / 2;
  if (axis === "x") {
    slab(g, m, at.x - t * out, at.y - h, at.z - b, at.x + t * out, at.y + h, at.z + b);
    slab(g, m, at.x - t * out, at.y - b, at.z - h, at.x + t * out, at.y + b, at.z + h);
  } else {
    slab(g, m, at.x - b, at.y - h, at.z - t, at.x + b, at.y + h, at.z + t);
    slab(g, m, at.x - h, at.y - b, at.z - t, at.x + h, at.y + b, at.z + t);
  }
}

/** THE PATROL'S KIT on one machine (`PATROL_KIT`), in `mats`. */
export function patrolKit(mats: KitMaterials): PatrolKit {
  const K = PATROL_KIT;
  const group = new THREE.Group();
  group.name = "patrol-kit";
  // THE CROSSES: either side of the hood, and the tail pack's back.
  for (const s of [-1, 1]) {
    crossOn(
      group,
      mats.cross,
      "x",
      new THREE.Vector3(s * K.cross.x, K.cross.y, K.cross.z),
      K.cross.size,
      K.cross.bar,
      1,
    );
  }
  crossOn(
    group,
    mats.cross,
    "z",
    new THREE.Vector3(0, K.tail.y, K.tail.z),
    K.tail.size,
    K.tail.bar,
    1,
  );
  // THE BEACON on its mast.
  const M = K.mast;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, M.height, 8), mats.mast);
  pole.position.set(M.x, M.y + M.height / 2, M.z);
  group.add(pole);
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(M.radius + 0.01, M.radius + 0.015, 0.04, 14),
    mats.mast,
  );
  base.position.set(M.x, M.y + M.height + 0.02, M.z);
  group.add(base);
  const dome = new THREE.Mesh(
    new THREE.CylinderGeometry(M.radius * 0.8, M.radius, M.dome, 14),
    mats.dome,
  );
  dome.position.set(M.x, M.y + M.height + 0.04 + M.dome / 2, M.z);
  group.add(dome);
  const top = M.y + M.height + 0.04 + M.dome / 2;
  const spin = new THREE.Group();
  spin.position.set(M.x, top, M.z);
  group.add(spin);
  const sprite = (colour: number, size: number): THREE.Sprite => {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glow(),
        color: colour,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    s.scale.set(size, size, 1);
    s.renderOrder = 9;
    return s;
  };
  const flash = sprite(0xff9a20, 2.4);
  flash.position.set(0, 0, M.radius + 0.03);
  spin.add(flash);
  const ball = sprite(0xff8a10, 0.55);
  ball.position.set(M.x, top, M.z);
  group.add(ball);
  // THE FLAG on its whip: a thin rod leaning back, the pennant at its tip.
  const W = K.whip;
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.011, W.height, 6), mats.mast);
  const lean = Math.atan2(W.lean, W.height);
  rod.position.set(W.x, W.y + W.height / 2, W.z - W.lean / 2);
  rod.rotation.x = -lean;
  group.add(rod);
  const tip = new THREE.Vector3(W.x, W.y + W.height, W.z - W.lean);
  const pennant = new THREE.BufferGeometry();
  pennant.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        tip.x,
        tip.y,
        tip.z,
        tip.x,
        tip.y - W.drop,
        tip.z - W.drop * Math.tan(lean),
        tip.x,
        tip.y - W.drop * 0.55,
        tip.z - W.pennant,
      ],
      3,
    ),
  );
  pennant.computeVertexNormals();
  group.add(new THREE.Mesh(pennant, mats.flag));
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) o.castShadow = true;
  });
  const at = new THREE.Vector3();
  const toEye = new THREE.Vector3();
  const way = new THREE.Vector3();
  let turn = 0;
  return {
    group,
    update(t, lit, eye, on = true) {
      turn = (t * Math.PI * 2 * K.spin) % (Math.PI * 2);
      spin.rotation.y = turn;
      flash.visible = on;
      ball.visible = on;
      if (!on) return;
      let facing = 1;
      if (eye) {
        flash.getWorldPosition(at);
        way.set(0, 0, 1).transformDirection(flash.matrixWorld);
        facing = THREE.MathUtils.smoothstep(
          way.dot(toEye.subVectors(eye, at).normalize()),
          0.2,
          0.95,
        );
      }
      (flash.material as THREE.SpriteMaterial).opacity = (0.35 + 0.65 * lit) * facing;
      (ball.material as THREE.SpriteMaterial).opacity = 0.25 + 0.55 * lit;
    },
    beam: () => turn,
    top: spin,
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
        if (o instanceof THREE.Sprite) o.material.dispose();
      });
    },
  };
}

/** The dome's glow by the beacon's turn: brightest as its reflector faces
 * out of each of its sides — set on the shared dome once a frame. */
export function domeGlow(mats: KitMaterials, t: number, lit: number): void {
  const u = (t * PATROL_KIT.spin * 2) % 1;
  mats.dome.emissiveIntensity = 0.6 + (1.4 + 2.5 * lit) * Math.pow(Math.sin(u * Math.PI), 6);
}

// THE ARMY'S livery is olive drab on the model's paint with its own kit
// (`sled-army-kit.ts`): white daubed over the panels, the pillion, the
// rack and what it carries.

// ── THE MACHINES STOOD STILL ──────────────────────────────────────────────

/** The model, fetched once for every fleet (each clones what it draws). */
let fetched: Promise<GLTF | null> | null = null;
function sledModel(): Promise<GLTF | null> {
  const url = sledModelUrl();
  fetched ??= url ? new GLTFLoader().loadAsync(url).catch(() => null) : Promise.resolve(null);
  return fetched;
}

/** ONE MACHINE OF A FLEET: its root (placed by the caller), the trace's
 * frame under it the model and the kit hang in, and its kit, if any. */
export type FleetSled = {
  root: THREE.Group;
  frame: THREE.Group;
  kit: PatrolKit | null;
  lamps: THREE.Sprite[];
};

export type SledFleet = {
  group: THREE.Group;
  /** A machine in `livery` (the free ride's own when undefined), added to
   * the fleet's group. */
  make(livery: SledLivery | undefined): FleetSled;
  /** Every patrol kit's beacon turned and lit for the moment. */
  light(t: number, lit: number, eye: THREE.Vector3 | null): void;
  ready: Promise<void>;
  dispose(): void;
};

/** A plain box stand-in should the model not load: cowl, tunnel, belt. */
function standIn(paint: THREE.Material, dark: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const box = (w: number, h: number, l: number, m: THREE.Material, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m);
    mesh.position.set(0, y, z);
    mesh.castShadow = true;
    g.add(mesh);
  };
  box(0.65, 0.5, 1.2, paint, 0.6, 2.3);
  box(0.42, 0.25, 1.7, dark, 0.65, 0.85);
  box(0.41, 0.3, 1.6, dark, 0.2, 0.85);
  for (const s of [-1, 1]) {
    const ski = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.05, 1.05), dark);
    ski.position.set((s * SLED.skiStance) / 2, 0.04, 2.6);
    g.add(ski);
  }
  return g;
}

export function createSledFleet(haze: HazeUniforms): SledFleet {
  const group = new THREE.Group();
  group.name = "sled-fleet";
  const made: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const kitMats = kitMaterials(haze);
  const kits: PatrolKit[] = [];
  const armyMats = armyKitMaterials(haze);
  const armyKits: ArmySledKit[] = [];
  const sleds: { sled: FleetSled; livery: SledLivery | undefined }[] = [];
  const templates = new Map<string, THREE.Object3D>();
  let gltf: GLTF | null = null;
  let loaded = false;
  let disposed = false;

  /** One livery's copy of the model, merged a draw a node, turned nose to
   * the trace's +z. */
  const templateOf = (livery: SledLivery | undefined): THREE.Object3D => {
    const key = livery ?? "own";
    const kept = templates.get(key);
    if (kept) return kept;
    let root: THREE.Object3D;
    if (gltf) {
      root = gltf.scene.clone(true);
      const own = new Map<THREE.Material, THREE.Color>();
      root.traverse((o) => {
        if (!(o instanceof THREE.Mesh)) return;
        o.material = (Array.isArray(o.material) ? o.material : [o.material]).map(
          (m: THREE.Material) => {
            const c = m.clone();
            made.push(c);
            return c;
          },
        );
        if ((o.material as THREE.Material[]).length === 1)
          o.material = (o.material as THREE.Material[])[0];
        o.castShadow = true;
        o.receiveShadow = true;
      });
      const mats: THREE.Material[] = [];
      root.traverse((o) => {
        if (o instanceof THREE.Mesh && !Array.isArray(o.material)) mats.push(o.material);
      });
      tintSled(mats, livery, own);
      for (const m of mats)
        if (m instanceof THREE.MeshStandardMaterial) hazeMaterial(m, haze, "sled");
      const nodes: THREE.Object3D[] = [];
      root.traverse((o) => {
        if (o.children.some((c) => c instanceof THREE.Mesh)) nodes.push(o);
      });
      for (const o of nodes) mergeParts(o, (m) => hazeMaterial(m, haze, "sled"), made);
      root.traverse((o) => {
        if (o instanceof THREE.Mesh && o.name.endsWith("-merged")) geometries.push(o.geometry);
      });
      // The rack stands empty on a machine nobody is riding.
      root.traverse((o) => {
        if (o.name === "sled_rack") o.visible = false;
      });
      root.rotation.y = Math.PI;
    } else {
      const paint = hazeMaterial(
        new THREE.MeshStandardMaterial({ color: livery ? LIVERIES[livery].paint : 0xb8241a }),
        haze,
        "sled",
      );
      const dark = hazeMaterial(new THREE.MeshStandardMaterial({ color: 0x1a1c1f }), haze, "sled");
      made.push(paint, dark);
      root = standIn(paint, dark);
    }
    templates.set(key, root);
    return root;
  };

  const lampMat = new THREE.SpriteMaterial({
    map: glow(),
    color: 0xfff4dc,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });

  const fill = (sled: FleetSled, livery: SledLivery | undefined): void => {
    sled.frame.add(templateOf(livery).clone(true));
  };

  const ready = sledModel().then((g) => {
    if (disposed) return;
    gltf = g;
    loaded = true;
    for (const { sled, livery } of sleds) fill(sled, livery);
  });

  return {
    group,
    ready,
    make(livery) {
      const root = new THREE.Group();
      const frame = new THREE.Group();
      root.add(frame);
      let kit: PatrolKit | null = null;
      if (livery === "patrol") {
        kit = patrolKit(kitMats);
        frame.add(kit.group);
        kits.push(kit);
      }
      if (livery === "army") {
        const army = armySledKit(armyMats);
        frame.add(army.group);
        armyKits.push(army);
      }
      const L = SLED_LOOK.lamps;
      const lamps = [-1, 1].map((sx) => {
        const s = new THREE.Sprite(lampMat);
        s.scale.set(0.5, 0.5, 1);
        s.renderOrder = 9;
        s.position.set((sx * L.width) / 2, L.y, L.z + 0.06);
        s.visible = false;
        frame.add(s);
        return s;
      });
      const sled: FleetSled = { root, frame, kit, lamps };
      sleds.push({ sled, livery });
      if (loaded) fill(sled, livery);
      group.add(root);
      return sled;
    },
    light(t, lit, eye) {
      domeGlow(kitMats, t, lit);
      for (const k of kits) k.update(t, lit, eye, k.group.parent?.parent?.visible ?? true);
    },
    dispose() {
      disposed = true;
      for (const k of kits) k.dispose();
      for (const k of armyKits) k.dispose();
      for (const g of geometries) g.dispose();
      for (const m of [...made, ...kitMats.all, ...armyMats.all]) m.dispose();
      lampMat.dispose();
    },
  };
}

/** A FLEET MACHINE stood by its MIDDLE on the snow at `p`, heading
 * `heading`, pitched and rolled to the ground under its belt and skis. */
export function standOnSnow(
  level: Level,
  sled: FleetSled,
  p: { x: number; z: number; heading: number },
  length = 3.2,
): void {
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const L = length * 0.4;
  const W = 0.45;
  const g = (a: number, l: number) => level.groundAt(p.x + fx * a + fz * l, p.z + fz * a - fx * l);
  const front = (g(L, -W) + g(L, W)) / 2;
  const back = (g(-L, -W) + g(-L, W)) / 2;
  const left = (g(L, -W) + g(-L, -W)) / 2;
  const right = (g(L, W) + g(-L, W)) / 2;
  sled.root.position.set(p.x, (front + back) / 2, p.z);
  sled.root.rotation.set(
    -Math.atan2(front - back, 2 * L),
    p.heading,
    -Math.atan2(left - right, 2 * W),
    "YXZ",
  );
  sled.frame.position.set(0, 0, -length / 2);
}

/** A FLEET MACHINE stood where the engine's body has one (its centre of
 * gravity and attitude). */
export function atBody(sled: FleetSled, s: SledState): void {
  sled.root.position.set(s.x, s.y, s.z);
  sled.root.quaternion.set(s.q.x, s.q.y, s.q.z, s.q.w);
  sled.frame.position.set(0, -SLED.trace.y, -SLED.trace.z);
}
