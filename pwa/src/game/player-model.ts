// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PLAYER'S MODELLED KIT: the ski mountaineer made in Blender
// (`scripts/blender/mountaineer.py`, `make models KIND=player`) — a touring
// guide's softshell, harness, pack, ice axe, rope coil, climbing helmet and
// glacier glasses — skinned on the very rig the dressed skier is bound on
// (`dress-loft.ts`'s `bindPose`, bone for bone by name). So it is handed to
// `skier-dress.ts` as the dressed skin's two parts and every pose the game
// has (a carve, the tuck, a landing, a grab, thrown, a torn piece) moves it
// with no animation of its own.
//
// Two things move it beyond the rig, both presentation only:
//
// - THE SPRING BONES. The pack (`fx_pack`, hung off the chest at its top),
//   the rope's coil on it (`fx_coil`) and the coil's loose tail (`fx_tail`)
//   are each a damped pendulum about its own head, swung by the specific
//   force there — his acceleration less gravity, read in the parent's frame
//   — so a landing bobs the coil, a hard turn swings the tail out and a
//   tuck lets it hang down past his back.
// - THE FLUTTER. Every vertex carries how loose it is (the builder's
//   `FLUTTER`, carried as the UV's u): the jacket's dropped hem, the
//   straps' tails, the rope's tail. The cloth's vertex shader trails those
//   points down the air past him and flaps them along their normal, harder
//   the faster he goes.

import * as THREE from "three";

import type { DressPart } from "./dress-loft.ts";
import { SKIER_BONES, type BoneFrame, type SkierBone } from "./skier-rig.ts";
import type { V3 } from "./skier-pose.ts";

/** A part of the model: the dressed skin's buffers and each vertex's
 * looseness (0 held, 1 free). */
export type ModelPart = DressPart & { flutter: number[] };

/** THE SPRING BONES, in the order they follow `SKIER_BONES` in the
 * skeleton: each one's parent, its pendulum's length (m), its own
 * frequency (Hz) and damping ratio, how far it may swing (rad), and how
 * much of the force reaches it (a pack strapped tight takes little). */
export const SPRING_BONES = [
  { name: "fx_pack", parent: "chest", length: 0.3, hz: 2.8, zeta: 0.4, most: 0.09, gain: 0.25 },
  { name: "fx_coil", parent: "fx_pack", length: 0.16, hz: 2.0, zeta: 0.22, most: 0.32, gain: 0.6 },
  { name: "fx_tail", parent: "fx_coil", length: 0.3, hz: 1.3, zeta: 0.14, most: 0.85, gain: 1 },
] as const;
export type SpringBone = (typeof SPRING_BONES)[number]["name"];

/** The model as the game holds it: the cloth (matt, both sides) and the
 * hard goods (a shine), and each spring bone's head in the bind pose. */
export type PlayerModel = {
  cloth: ModelPart;
  hard: ModelPart;
  heads: Record<SpringBone, V3>;
};

/** The materials `mountaineer.py` names that are drawn with a shine: the
 * helmet and its lamp, the glasses, the metal. The rest is cloth. */
export const HARD_GOODS = new Set([
  "helmet",
  "helmet_dark",
  "lamp",
  "lamp_lens",
  "glasses",
  "glass_lens",
  "metal",
  "steel",
  "axe_shaft",
  "grip",
  "biner_gold",
  "biner_red",
  "biner_blue",
]);

/** Each bone's index in the dressed skeleton: `SKIER_BONES`, then the
 * spring bones. A bone the game has no use for (the rig's root, an arm's
 * lower half) is folded onto the bone it lies on. */
export function boneIndexOf(name: string): number {
  const fx = SPRING_BONES.findIndex((b) => b.name === name);
  if (fx >= 0) return SKIER_BONES.length + fx;
  const base = name === "body" ? "pelvis" : name.replace("_lo_", "_");
  const i = SKIER_BONES.indexOf(base as SkierBone);
  return i >= 0 ? i : 0;
}

const empty = (): ModelPart => ({
  position: [],
  normal: [],
  color: [],
  skinIndex: [],
  skinWeight: [],
  index: [],
  flutter: [],
});

/** The glTF's bind pose read into the body frame: three.js's glTF frame is
 * the body frame half turned about its up (`scripts/blender/lib.py`'s
 * export), so x and z change sign. */
const body = (v: THREE.Vector3): V3 => ({ x: -v.x, y: v.y, z: -v.z });

/** THE MODEL READ OUT OF ITS glTF: every skinned primitive, its vertices
 * at rest in the body frame, sorted into the cloth and the hard goods by
 * its material's name, its joints renumbered to the dressed skeleton's. */
export function readPlayerModel(scene: THREE.Object3D): PlayerModel {
  scene.updateMatrixWorld(true);
  const parts = { cloth: empty(), hard: empty() };
  const heads = {} as Record<SpringBone, V3>;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  scene.traverse((o) => {
    const mesh = o as THREE.SkinnedMesh;
    if (!mesh.isSkinnedMesh) return;
    for (const b of mesh.skeleton.bones) {
      if (SPRING_BONES.some((s) => s.name === b.name) && !(b.name in heads))
        heads[b.name as SpringBone] = body(b.getWorldPosition(new THREE.Vector3()));
    }
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name;
    const into = HARD_GOODS.has(mat) ? parts.hard : parts.cloth;
    const g = mesh.geometry;
    const pos = g.getAttribute("position");
    const nor = g.getAttribute("normal");
    const col = g.getAttribute("color");
    const uv = g.getAttribute("uv");
    const ji = g.getAttribute("skinIndex");
    const jw = g.getAttribute("skinWeight");
    const joints = mesh.skeleton.bones.map((b) => boneIndexOf(b.name));
    nm.getNormalMatrix(mesh.matrixWorld);
    const base = into.position.length / 3;
    for (let i = 0; i < pos.count; i++) {
      mesh.applyBoneTransform(i, p.fromBufferAttribute(pos, i)).applyMatrix4(mesh.matrixWorld);
      const at = body(p);
      into.position.push(at.x, at.y, at.z);
      const d = body(n.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize());
      into.normal.push(d.x, d.y, d.z);
      if (col) into.color.push(col.getX(i), col.getY(i), col.getZ(i));
      else into.color.push(1, 1, 1);
      into.flutter.push(uv ? Math.max(0, Math.min(1, uv.getX(i))) : 0);
      // Weights summed onto the bones they fold to, the four largest kept.
      const w = new Map<number, number>();
      for (let k = 0; k < 4; k++) {
        const wk = jw.getComponent(i, k);
        if (wk <= 0) continue;
        const j = joints[ji.getComponent(i, k)];
        w.set(j, (w.get(j) ?? 0) + wk);
      }
      const top = [...w].sort((a, b) => b[1] - a[1]).slice(0, 4);
      const sum = top.reduce((s, [, x]) => s + x, 0) || 1;
      for (let k = 0; k < 4; k++) {
        into.skinIndex.push(top[k]?.[0] ?? 0);
        into.skinWeight.push((top[k]?.[1] ?? 0) / sum);
      }
    }
    const idx = g.getIndex();
    if (idx) for (let i = 0; i < idx.count; i++) into.index.push(base + idx.getX(i));
    else for (let i = 0; i < pos.count; i++) into.index.push(base + i);
  });
  return { ...parts, heads };
}

let held: PlayerModel | null = null;

/** The model, once `skier-models.ts`'s `loadModels` has read it — or
 * `null` (switched off, not packed, failed to load, or not in yet), when
 * the player is dressed in code as any other skier. */
export function playerModel(): PlayerModel | null {
  return held;
}
export function setPlayerModel(m: PlayerModel | null): void {
  held = m;
}

// ---------------------------------------------------------------- springs
const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3): V3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: V3, k: number): V3 => v3(a.x * k, a.y * k, a.z * k);
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;

/** A point stated in a frame's axes, from the frame's head. */
const inFrame = (f: BoneFrame, o: V3): V3 =>
  add(f.head, add(mul(f.x, o.x), add(mul(f.y, o.y), mul(f.z, o.z))));

/** One spring's swing: about its frame's x (the stuff under its head
 * swung fore and aft) and its z (swung to the side), each with its rate. */
type Swing = { pitch: number; roll: number; wp: number; wr: number };

/** THE SPRINGS OF ONE FIGURE: handed the posed frames, the figure's place
 * in the world and the time, they return the spring bones' frames — and
 * the air past him in the figure's own frame, which the flutter reads. */
export type Springs = {
  step(
    frames: Record<SkierBone, BoneFrame>,
    world: THREE.Matrix4,
    now: number,
  ): { frames: BoneFrame[]; flow: V3 };
  rest(): void;
};

export function createSprings(
  bind: Record<SkierBone, BoneFrame>,
  heads: Record<SpringBone, V3>,
): Springs {
  // Each spring's head stated in its parent's bind frame; every spring's
  // bind frame takes the chest's axes, so a chain's offsets are the same
  // arithmetic from the chest down.
  const chest = bind.chest;
  const offsets: V3[] = [];
  let parentHead = chest.head;
  for (const s of SPRING_BONES) {
    const d = sub(heads[s.name] ?? parentHead, parentHead);
    offsets.push(v3(dot(d, chest.x), dot(d, chest.y), dot(d, chest.z)));
    parentHead = heads[s.name] ?? parentHead;
  }
  // Gravity as the chest is stood in the bind pose: the share of it the
  // springs hang against at rest, so the model's own drape is their zero.
  const restG = v3(dot(v3(0, 9.81, 0), chest.x), 0, dot(v3(0, 9.81, 0), chest.z));
  const swings: Swing[] = SPRING_BONES.map(() => ({ pitch: 0, roll: 0, wp: 0, wr: 0 }));
  let last = -1;
  let pos: THREE.Vector3 | null = null;
  const vel = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const here = new THREE.Vector3();
  const rot = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
  const ax = new THREE.Vector3();
  const flow = new THREE.Vector3();

  const rest = (): void => {
    for (const w of swings) w.pitch = w.roll = w.wp = w.wr = 0;
    pos = null;
    vel.set(0, 0, 0);
    acc.set(0, 0, 0);
  };

  return {
    rest,
    step(frames, world, now) {
      const dt = last < 0 ? 0 : Math.min(0.05, now - last);
      last = now;
      // The pack's head in the world: its velocity and acceleration,
      // smoothed over a few frames (a frame's jitter is not a jolt).
      const top = inFrame(frames.chest, offsets[0]);
      here.set(top.x, top.y, top.z).applyMatrix4(world);
      if (pos && dt > 1e-4) {
        const v = here.clone().sub(pos).divideScalar(dt);
        const a = v.clone().sub(vel).divideScalar(dt);
        // A teleport (a reset, a cut) is no force: the springs are let go.
        if (v.length() > 120 || a.length() > 600) rest();
        else {
          const k = Math.min(1, dt / 0.03);
          acc.lerp(a, k);
          vel.lerp(v, Math.min(1, dt / 0.05));
        }
      }
      pos = (pos ?? new THREE.Vector3()).copy(here);
      rot.extractRotation(world);
      inv.copy(rot).invert();
      // The specific force his kit feels (acceleration less gravity), in
      // the figure's frame.
      const f = acc
        .clone()
        .add(new THREE.Vector3(0, 9.81, 0))
        .applyMatrix4(inv);
      const force = v3(f.x, f.y, f.z);
      flow.copy(vel).negate().applyMatrix4(inv);

      const out: BoneFrame[] = [];
      let parent: BoneFrame = frames.chest;
      SPRING_BONES.forEach((s, i) => {
        const head = inFrame(parent, offsets[i]);
        const w = swings[i];
        if (dt > 1e-4) {
          const om = 2 * Math.PI * s.hz;
          const az = (dot(force, parent.z) - restG.z) * s.gain;
          const axl = (dot(force, parent.x) - restG.x) * s.gain;
          // Linearised pendulum: the thing below the head hangs away from
          // the force (a push ahead swings it back, toward −z; a push to
          // the right swings it left), sprung back to its drape.
          w.wp += (-om * om * w.pitch - 2 * s.zeta * om * w.wp + az / s.length) * dt;
          w.wr += (-om * om * w.roll - 2 * s.zeta * om * w.wr - axl / s.length) * dt;
          w.pitch = Math.max(-s.most, Math.min(s.most, w.pitch + w.wp * dt));
          w.roll = Math.max(-s.most, Math.min(s.most, w.roll + w.wr * dt));
          if (Math.abs(w.pitch) >= s.most) w.wp *= 0.5;
          if (Math.abs(w.roll) >= s.most) w.wr *= 0.5;
        }
        // The parent's axes turned by the swing: about x by the pitch,
        // then about z by the roll.
        const cp = Math.cos(w.pitch);
        const sp = Math.sin(w.pitch);
        const cr = Math.cos(w.roll);
        const sr = Math.sin(w.roll);
        const y1 = add(mul(parent.y, cp), mul(parent.z, sp));
        const z1 = add(mul(parent.y, -sp), mul(parent.z, cp));
        const x2 = add(mul(parent.x, cr), mul(y1, sr));
        const y2 = add(mul(parent.x, -sr), mul(y1, cr));
        const frame: BoneFrame = { head, x: x2, y: y2, z: z1, length: s.length };
        out.push(frame);
        parent = frame;
      });
      ax.set(flow.x, flow.y, flow.z);
      return { frames: out, flow: v3(ax.x, ax.y, ax.z) };
    },
  };
}

// ---------------------------------------------------------------- flutter
export type FlutterUniforms = { uFlow: { value: THREE.Vector3 }; uFlTime: { value: number } };

export function flutterUniforms(): FlutterUniforms {
  return { uFlow: { value: new THREE.Vector3() }, uFlTime: { value: 0 } };
}

/** THE FLUTTER, chained after whatever the material already does to its
 * shader (the haze): a loose point trailed down the air past him and
 * flapped along its normal, by its looseness and his speed. */
export function withFlutter<M extends THREE.Material>(m: M, u: FlutterUniforms): M {
  const before = m.onBeforeCompile.bind(m);
  const key = m.customProgramCacheKey.bind(m);
  m.customProgramCacheKey = (): string => `${key()}:flutter`;
  m.onBeforeCompile = (shader, renderer) => {
    before(shader, renderer);
    shader.uniforms.uFlow = u.uFlow;
    shader.uniforms.uFlTime = u.uFlTime;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float flutter;\nuniform vec3 uFlow;\nuniform float uFlTime;",
      )
      .replace(
        "#include <skinning_vertex>",
        `#include <skinning_vertex>
  {
    float sp = length(uFlow);
    if (flutter > 0.0 && sp > 0.3) {
      vec3 d = uFlow / sp;
      float k = flutter * clamp(sp / 22.0, 0.0, 1.0);
      float ph = dot(position, vec3(23.0, 17.0, 29.0));
      float f = 9.0 + 9.0 * k;
      transformed += d * k * (0.035 + 0.012 * sin(uFlTime * f * 0.7 + ph));
      transformed += normalize(objectNormal) * k * 0.022 * sin(uFlTime * f + ph * 1.7);
    }
  }`,
      );
  };
  return m;
}
