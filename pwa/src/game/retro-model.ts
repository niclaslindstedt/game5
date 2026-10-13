// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RETRO SKIER AS DRAWN: the Blender model (`scripts/blender/retro.py`,
// committed as `models/retro.glb` by `make models KIND=retro`) put on the
// game's own rig in place of the dressed skin, when the DRESS card's LOOK
// is one of the eighties' colourways (`Outfit.look`).
//
// The model was bound in the very pose the dressed skin is
// (`dress-loft.ts`'s `bindPose`) on the very bones (`SKIER_BONES`), so it
// is re-bound here onto a skeleton of those bones in the body frame and
// posed by `skierBones` exactly as `skier-dress.ts` poses its own — every
// move the game has drives it unchanged. Its own extra bones (the scarf's
// tails and the bobble, `RETRO_CHAINS`) are laid each frame off the wind's
// ropes (`retro-wind.ts`). Recoloured per colourway by material name; a
// ghost washed pale.

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { Dressed, SkierDress } from "./skier-dress.ts";
import { RETRO_CHAINS, RETRO_COLOURWAYS, chainBone, type RetroColourway } from "./retro-look.ts";
import {
  createRetroWind,
  FEEL,
  type ChainRest,
  type Collider,
  type RetroWind,
} from "./retro-wind.ts";
import { SKIER_BONES, skierBones, type BoneFrame, type SkierBone } from "./skier-rig.ts";
import type { Collapse } from "./gore-cut.ts";
import { modelSwitch } from "./model-switch.ts";

const ENV = (import.meta as { env?: Record<string, string | boolean | undefined> }).env ?? {};

/** Whether this build packs the retro skier (`VITE_MODEL_RIDER`, on unless `0`). */
export const RIDER_MODEL = modelSwitch(ENV.VITE_MODEL_RIDER);

let gltf: GLTF | null = null;
let loading: Promise<void> | null = null;

/** Fetch the model once; resolves when it is in or given up on. */
export function loadRetroModel(): Promise<void> {
  if (!RIDER_MODEL) return Promise.resolve();
  loading ??= new GLTFLoader().loadAsync(`${String(ENV.BASE_URL ?? "/")}models/retro.glb`).then(
    (g) => {
      gltf = g;
    },
    () => undefined,
  );
  return loading;
}

/** THE WIND'S CLOCK: the run's own time as last drawn (`setRetroClock`, the
 * renderer's), so the scarf flies with the picture — slowed with a slow
 * replay, still on a held frame — and the wall clock where nothing draws a
 * run (the RIDER card's stage). */
let runClock: { t: number; wall: number } | null = null;
export function setRetroClock(t: number): void {
  runClock = { t, wall: performance.now() };
}
function windClock(): number {
  return runClock && performance.now() - runClock.wall < 500
    ? runClock.t
    : performance.now() / 1000;
}

/** The ropes as last stepped, world — what a lab reads to say where the
 * tails flew. */
export let lastRopes: readonly (readonly { x: number; y: number; z: number }[])[] = [];

/** Hand in a model already loaded (a lab's). */
export function useRetroModel(g: GLTF): void {
  gltf = g;
}

/** The colourway an outfit's LOOK names, or null for the modern kit. */
export function retroOf(look: string | undefined): RetroColourway | null {
  if (!look || !look.startsWith("retro")) return null;
  return RETRO_COLOURWAYS.find((c) => `retro-${c.id}` === look) ?? null;
}

/** Whether the model is in to draw `dress` with. */
export function retroReady(dress: SkierDress): boolean {
  return !!gltf && dress.suit === undefined && !dress.outfit.suit && !!retroOf(dress.outfit.look);
}

/** What each material is coloured, by the name `retro.py` gives it. */
function paintOf(name: string, c: RetroColourway): number | null {
  switch (name) {
    case "suit":
    case "yoke":
    case "stripe":
    case "belt":
    case "knit":
    case "knit2":
    case "bobble":
    case "glove":
    case "frame":
    case "lens":
    case "hair":
      return c[name === "bobble" ? "bobble" : (name as keyof RetroColourway)] as number;
    default:
      return null;
  }
}

const CHAIN_NAMES = RETRO_CHAINS.flatMap((c) =>
  Array.from({ length: c.links }, (_, k) => chainBone(c, k)),
);
const ALL_BONES = [...SKIER_BONES, ...CHAIN_NAMES];
/** The glTF's frame is the body frame turned a half turn about y. */
const TURN = new THREE.Matrix4().makeRotationY(Math.PI);
const PALE = new THREE.Color(0xdcecff);

const ax = new THREE.Vector3();
const ay = new THREE.Vector3();
const az = new THREE.Vector3();
const basis = new THREE.Matrix4();
function setBone(bone: THREE.Bone, f: BoneFrame): void {
  basis.makeBasis(
    ax.set(f.x.x, f.x.y, f.x.z),
    ay.set(f.y.x, f.y.y, f.y.z),
    az.set(f.z.x, f.z.y, f.z.z),
  );
  bone.quaternion.setFromRotationMatrix(basis);
  bone.position.set(f.head.x, f.head.y, f.head.z);
}

/** THE RETRO SKIER, skinned on the game's rig and ready to pose. */
export function createRetroDressed(
  dress: SkierDress,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
  cloth: THREE.BufferGeometry,
): Dressed {
  const look = retroOf(dress.outfit.look) ?? RETRO_COLOURWAYS[0];
  const g = gltf as GLTF;
  g.scene.updateMatrixWorld(true);
  const group = new THREE.Group();
  group.name = "dressed";
  const bones = ALL_BONES.map((name) => {
    const b = new THREE.Bone();
    b.name = name;
    group.add(b);
    return b;
  });
  const index = new Map(ALL_BONES.map((n, i) => [n, i]));

  // Every bone's rest in the body frame, off the glTF's own binds.
  const rest = new Map<string, THREE.Matrix4>();
  const sources: THREE.SkinnedMesh[] = [];
  g.scene.traverse((o) => {
    if (o instanceof THREE.SkinnedMesh) sources.push(o);
  });
  for (const s of sources) {
    s.skeleton.bones.forEach((b, i) => {
      if (!rest.has(b.name)) {
        rest.set(
          b.name,
          new THREE.Matrix4().copy(s.skeleton.boneInverses[i]).invert().premultiply(TURN),
        );
      }
    });
  }
  const restFrame = (name: string): BoneFrame => {
    const m = rest.get(name) ?? new THREE.Matrix4();
    const e = m.elements;
    const n = (x: number, y: number, z: number) => {
      const l = Math.hypot(x, y, z) || 1;
      return { x: x / l, y: y / l, z: z / l };
    };
    return {
      head: { x: e[12], y: e[13], z: e[14] },
      x: n(e[0], e[1], e[2]),
      y: n(e[4], e[5], e[6]),
      z: n(e[8], e[9], e[10]),
      length: 0.1,
    } as BoneFrame;
  };
  const bind: Record<string, BoneFrame> = {};
  for (const name of ALL_BONES) bind[name] = restFrame(name);
  ALL_BONES.forEach((name, i) => setBone(bones[i], bind[name]));
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  // The meshes: each primitive's geometry turned into the body frame and
  // its joints re-indexed onto this skeleton.
  const mats: THREE.Material[] = [];
  const geos: THREE.BufferGeometry[] = [];
  const meshes = sources.map((s) => {
    const geo = s.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(TURN, s.matrixWorld));
    const si = geo.getAttribute("skinIndex");
    const map = s.skeleton.bones.map((b) => index.get(b.name) ?? 0);
    const out = new Uint16Array(si.count * 4);
    for (let i = 0; i < si.count; i++) {
      for (let k = 0; k < 4; k++) out[i * 4 + k] = map[si.getComponent(i, k)];
    }
    geo.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(out, 4));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 2.2);
    geos.push(geo);
    const one = (m: THREE.Material): THREE.Material => {
      const own = m.clone() as THREE.MeshStandardMaterial;
      const c = paintOf(m.name, look);
      if (c !== null) own.color.setHex(c);
      if (dress.ghost) own.color.lerp(PALE, 0.7);
      // The knits seen from either side: a tail flogging in the wind turns
      // its back to the sun as often as its face.
      if (m.name === "knit" || m.name === "knit2") own.side = THREE.DoubleSide;
      if (m.name === "lens") {
        // A mirror with no room to mirror: lit as a bright glossy tint.
        own.metalness = 0.35;
        own.roughness = 0.12;
        own.emissive = new THREE.Color(look.lens).multiplyScalar(0.25);
      }
      own.name = m.name;
      const w = wrap(own, `retro-${m.name}`);
      mats.push(w);
      return w;
    };
    const material = Array.isArray(s.material) ? s.material.map(one) : one(s.material);
    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.name = "skier-retro";
    mesh.bind(skeleton, new THREE.Matrix4());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    return mesh;
  });

  // THE WIND'S ROPES, laid where the model lays the chains at rest, each
  // stated in the frame of the bone its root rides.
  const toLocal = (anchor: string, p: THREE.Vector3) =>
    p.clone().applyMatrix4(rest.get(anchor)!.clone().invert());
  const chains: ChainRest[] = RETRO_CHAINS.map((c) => {
    const anchor = c.name === "bobble" ? "head" : "chest";
    const joints: THREE.Vector3[] = [];
    for (let k = 0; k < c.links; k++)
      joints.push(new THREE.Vector3().setFromMatrixPosition(rest.get(chainBone(c, k))!));
    const last = rest.get(chainBone(c, c.links - 1))!;
    const yAxis = new THREE.Vector3().setFromMatrixColumn(last, 1).normalize();
    joints.push(joints[joints.length - 1].clone().addScaledVector(yAxis, c.length / c.links));
    return {
      name: c.name,
      anchor: index.get(anchor)!,
      joints: joints.map((j) => toLocal(anchor, j)),
      feel: c.name === "bobble" ? FEEL.bobble : FEEL.scarf,
      // The back tail held over his shoulder, the knot to the shoulder's top.
      pin: c.name === "scarf_b" ? 2 : 1,
    };
  });
  const bodyAt = (bone: SkierBone, x: number, y: number, z: number, r: number): Collider => ({
    bone: index.get(bone)!,
    at: { x, y, z },
    r,
  });
  // His trunk and head as spheres, in their bones' frames (y along, z ahead).
  const colliders: Collider[] = [
    bodyAt("pelvis", 0, 0.1, -0.02, 0.16),
    bodyAt("chest", 0, 0.06, -0.01, 0.15),
    bodyAt("chest", 0, 0.24, -0.03, 0.14),
    bodyAt("head", 0, -0.01, 0, 0.13),
    bodyAt("shoulder_l", 0, 0, 0, 0.06),
    bodyAt("shoulder_r", 0, 0, 0, 0.06),
    // The thighs, which a front tail streams along in a tuck.
    bodyAt("thigh_l", 0, 0.12, 0, 0.11),
    bodyAt("thigh_l", 0, 0.3, 0, 0.1),
    bodyAt("thigh_r", 0, 0.12, 0, 0.11),
    bodyAt("thigh_r", 0, 0.3, 0, 0.1),
  ];
  const wind: RetroWind = createRetroWind(chains, colliders);
  // Each link's rest x and z in its anchor bone's frame (what holds its roll).
  const roll = RETRO_CHAINS.map((c) => {
    const anchorInv = rest
      .get(c.name === "bobble" ? "head" : "chest")!
      .clone()
      .invert();
    return Array.from({ length: c.links }, (_, k) => {
      const m = rest.get(chainBone(c, k))!;
      return {
        x: new THREE.Vector3().setFromMatrixColumn(m, 0).transformDirection(anchorInv),
        z: new THREE.Vector3().setFromMatrixColumn(m, 2).transformDirection(anchorInv),
      };
    });
  });
  const world = bones.map(() => new THREE.Matrix4());
  const inv = new THREE.Matrix4();
  const v = new THREE.Vector3();
  let clock = -1;

  let lastFrames = bind as Record<SkierBone, BoneFrame>;
  const lay = (frames: Record<SkierBone, BoneFrame>, cut: Collapse | null | undefined): void => {
    lastFrames = frames;
    SKIER_BONES.forEach((name, i) => {
      const b = bones[i];
      setBone(b, frames[name]);
      const at = cut?.bones.get(name);
      if (at) {
        b.position.set(at.x, at.y, at.z);
        b.scale.setScalar(1e-4);
      } else b.scale.setScalar(1);
    });
    // The ropes stepped in the world on the picture's clock, then laid
    // back into the group's frame as the chains' bones.
    group.updateWorldMatrix(true, false);
    bones.forEach((b, i) => {
      b.updateMatrix();
      world[i].multiplyMatrices(group.matrixWorld, b.matrix);
    });
    const now = windClock();
    // A clock run backwards (a new run, a replay begun again) or jumped far
    // lays the ropes afresh.
    if (clock >= 0 && (now < clock || now - clock > 2)) wind.reset();
    wind.step(
      world.map((m) => m.elements),
      clock < 0 ? 0 : Math.max(0, now - clock),
    );
    clock = now;
    inv.copy(group.matrixWorld).invert();
    const pts = wind.points();
    lastRopes = pts;
    RETRO_CHAINS.forEach((c, ci) => {
      const p = pts[ci];
      if (!p || p.length < 2) return;
      const anchor = bones[chains[ci].anchor].matrix;
      for (let k = 0; k < c.links; k++) {
        const a = new THREE.Vector3(p[k].x, p[k].y, p[k].z).applyMatrix4(inv);
        const y = new THREE.Vector3(p[k + 1].x, p[k + 1].y, p[k + 1].z)
          .applyMatrix4(inv)
          .sub(a)
          .normalize();
        // The link's width held in the plane it was laid in: its rest x
        // (or, should the rope lie along that, its rest z) carried by the
        // anchor bone and squared to the link — so a tail streaming
        // straight back never loses its roll.
        const r = roll[ci][k];
        const x = v.copy(r.x).transformDirection(anchor);
        if (Math.abs(x.dot(y)) > 0.9) x.copy(r.z).transformDirection(anchor).cross(y);
        x.addScaledVector(y, -x.dot(y)).normalize();
        const z = new THREE.Vector3().crossVectors(x, y);
        setBone(bones[index.get(chainBone(c, k))!], {
          head: a,
          x: x.clone(),
          y,
          z,
          length: 0,
        } as unknown as BoneFrame);
      }
    });
  };

  return {
    group,
    meshes,
    pose(p, cut) {
      lay(skierBones(p), cut);
    },
    frames(f, cut) {
      lay(f, cut);
    },
    last: () => lastFrames,
    // Nothing of the model's soaks: a wound reads the code's cut of the
    // same kit, never drawn.
    cloth,
    dispose() {
      for (const g2 of geos) g2.dispose();
      cloth.dispose();
      for (const m of mats) m.dispose();
      skeleton.dispose();
    },
  };
}
