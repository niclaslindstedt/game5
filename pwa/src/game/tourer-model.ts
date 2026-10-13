// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TOURER MODELLED IN BLENDER: the rider card's TOURER body
// (`outfit.ts`'s `BODIES`), made by `scripts/blender/tourer.py` (`make
// models KIND=tourer`) — a Nordic ski tourer in a pullover anorak, touring
// pants and gaiters, a wool beanie, sunglasses, leather gloves and a pack
// with a shovel and a sit pad lashed on it — skinned on the very rig the
// dressed skier is bound on (`dress-loft.ts`'s `bindPose`, bone for bone by
// name, the arm's halves below a break included). So it is handed to
// `skier-dress.ts` as the dressed skin's two parts, and every pose the game
// has (a carve, the tuck, a landing, a grab, thrown, a torn piece, an arm
// hanging from its break) moves it with no animation of its own. The
// WEIGHT row reshapes it as it reshapes the loom's man (`builtTo`).
//
// Two things move it beyond the rig, both presentation only and both on
// the RUN'S clock (`setTourerClock`), so a pause stills them and a replay
// in slow motion slows them:
//
// - THE SPRING BONES. The pack (`fx_pack`, hung off the chest at its top),
//   the hood rolled down behind his neck (`fx_hood`, off the chest) and
//   the beanie's pompom (`fx_pom`, off the head) are each a damped
//   pendulum about its own head, swung by the specific force there — his
//   acceleration less gravity, read in its parent's frame — and never
//   swung into him: a landing bobs the pack off his back, a hard turn
//   swings the hood out and the pompom nods.
// - THE FLUTTER. Every vertex carries how loose it is (the builder's
//   `FLUTTER`, carried as the UV's u): the anorak's hem, its drawcords,
//   the straps' tails, the hood's edge. The cloth's vertex shader trails
//   those points down the air past him and flaps them along their normal,
//   harder the faster he goes.

import * as THREE from "three";

import type { RiderId } from "@engine";

import type { BuildShape } from "./dress-body.ts";
import type { DressPart } from "./dress-loft.ts";
import { SKIER_BONES, type BoneFrame, type SkierBone } from "./skier-rig.ts";
import type { V3 } from "./skier-pose.ts";

/** A part of the model: the dressed skin's buffers and each vertex's
 * looseness (0 held, 1 free). */
export type ModelPart = DressPart & { flutter: number[] };

/** THE SPRING BONES, in the order they follow `SKIER_BONES` in the
 * skeleton: each one's parent, its pendulum's length (m), its own
 * frequency (Hz) and damping ratio, how far it may swing (rad) — out and
 * to the side (`most`) and in toward his body (`back`, the pitch it stops
 * at) — how much of the force reaches it (a pack strapped tight takes
 * little), and whether it stands UP off its head (the pompom) rather than
 * hanging below it. */
export const SPRING_BONES = [
  {
    name: "fx_pack",
    parent: "chest",
    length: 0.3,
    hz: 2.6,
    zeta: 0.45,
    most: 0.12,
    back: -0.01,
    gain: 0.3,
    up: false,
  },
  {
    name: "fx_hood",
    parent: "chest",
    length: 0.16,
    hz: 2.1,
    zeta: 0.22,
    most: 0.55,
    back: -0.03,
    gain: 0.8,
    up: false,
  },
  {
    name: "fx_pom",
    parent: "head",
    length: 0.06,
    hz: 3.4,
    zeta: 0.16,
    most: 0.42,
    back: -0.42,
    gain: 1,
    up: true,
  },
] as const satisfies readonly {
  name: string;
  parent: SkierBone;
  length: number;
  hz: number;
  zeta: number;
  most: number;
  back: number;
  gain: number;
  up: boolean;
}[];
export type SpringBone = (typeof SPRING_BONES)[number]["name"];

/** The model as the game holds it: the cloth (matt, both sides) and the
 * hard goods (a shine), and each spring bone's head in the bind pose. */
export type TourerModel = {
  cloth: ModelPart;
  hard: ModelPart;
  heads: Record<SpringBone, V3>;
};

/** The materials `tourer.py` names that are drawn with a shine: the
 * glasses, their lenses, the shovel and the buckles. The rest is cloth. */
export const HARD_GOODS = new Set(["glasses", "glass_lens", "metal", "blade", "shaft", "grip"]);

/** Each bone's index in the dressed skeleton: `SKIER_BONES` (an arm's
 * halves below a break among them), then the spring bones. A bone the game
 * has no use for (the rig's root) is folded onto the pelvis. */
export function boneIndexOf(name: string): number {
  const fx = SPRING_BONES.findIndex((b) => b.name === name);
  if (fx >= 0) return SKIER_BONES.length + fx;
  const i = SKIER_BONES.indexOf(name as SkierBone);
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
export function readTourerModel(scene: THREE.Object3D): TourerModel {
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

// ---------------------------------------------------------------- the build
const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3): V3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: V3, k: number): V3 => v3(a.x * k, a.y * k, a.z * k);
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;

/** The bones the trunk's girth moves, the limbs' (which take 0.7 of it, as
 * `builtTo`'s do), and the rest (the head, the hands, the boots: a heavier
 * skier's skull and boots are the medium one's). */
const TRUNK = new Set<string>(["pelvis", "chest"]);
const LIMBS = new Set<string>(
  SKIER_BONES.filter((b) => /^(thigh|shin|upperarm|forearm|hip|knee|shoulder|elbow)/.test(b)),
);

/** THE MODEL AT A BUILD: every vertex moved off the line of the bone that
 * carries most of it by the build's share (`dress-body.ts`'s `builtTo`,
 * the loom's own numbers) — the trunk by its girth, a heavy skier's
 * STOMACH carried ahead over the belt and a solid one's CHEST and upper
 * arms, the limbs by 0.7 of it — and the pack, the hood and all on them
 * set back as far as his back has grown. The medium build is the model
 * as it is. */
export function builtModel(
  m: TourerModel,
  b: BuildShape,
  bind: Record<SkierBone, BoneFrame>,
): TourerModel {
  if (b.girth === 1 && b.belly === 0 && b.chest === 0) return m;
  const limb = 1 + (b.girth - 1) * 0.7;
  const spine = bind.pelvis;
  const chest = bind.chest;
  // His back grows by the girth's share of its depth behind the spine.
  const backBy = (b.girth - 1) * 0.11;
  const shift = mul(chest.z, -backBy);
  // The stomach's level: a hand above the hips' head, gone by the crotch
  // and under the ribs; the chest's from the lowest rib up.
  const gut = (y: number): number => {
    const u = Math.max(0, 1 - Math.abs(y - (spine.head.y + 0.16)) / 0.2);
    return u * u * (3 - 2 * u);
  };
  const pecs = (y: number): number => Math.max(0, Math.min(1, (y - chest.head.y + 0.05) / 0.2));
  const frames = [...SKIER_BONES.map((n) => bind[n])];
  const reshape = (part: ModelPart): ModelPart => {
    const position = part.position.slice();
    for (let i = 0; i < position.length / 3; i++) {
      let j = 0;
      for (let k = 1; k < 4; k++)
        if (part.skinWeight[i * 4 + k] > part.skinWeight[i * 4 + j]) j = k;
      const bone = part.skinIndex[i * 4 + j];
      const p = v3(position[i * 3], position[i * 3 + 1], position[i * 3 + 2]);
      let to = p;
      if (bone >= SKIER_BONES.length) {
        // The pack, the hood and the pompom: the pack and the hood ride
        // his back; the pompom his head.
        if (SPRING_BONES[bone - SKIER_BONES.length].parent === "chest") to = add(p, shift);
      } else {
        const name = SKIER_BONES[bone];
        const f = frames[bone];
        if (TRUNK.has(name) || LIMBS.has(name)) {
          // Off the line of the bone (the spine's from the hips' head up).
          const t = Math.max(0, Math.min(f.length, dot(sub(p, f.head), f.y)));
          const on = add(f.head, mul(f.y, t));
          const off = sub(p, on);
          let k = TRUNK.has(name) ? b.girth : limb;
          if (TRUNK.has(name)) {
            const ahead = dot(off, chest.z) > 0;
            k *= 1 + (ahead ? b.belly : 0.2 * b.belly) * gut(p.y) * 0.3;
            k *= 1 + (ahead ? 0.6 : 1) * b.chest * pecs(p.y);
          } else if (name.startsWith("upperarm") || name.startsWith("shoulder")) {
            k *= 1 + b.chest;
          }
          to = add(on, mul(off, k));
        }
      }
      position[i * 3] = to.x;
      position[i * 3 + 1] = to.y;
      position[i * 3 + 2] = to.z;
    }
    return { ...part, position };
  };
  const heads = { ...m.heads };
  for (const s of SPRING_BONES) if (s.parent === "chest") heads[s.name] = add(heads[s.name], shift);
  return { cloth: reshape(m.cloth), hard: reshape(m.hard), heads };
}

let held: TourerModel | null = null;
const builds = new Map<RiderId, TourerModel>();

/** The model at a build, once `skier-models.ts`'s `loadModels` has read
 * it — or `null` (switched off, not packed, failed to load, or not in
 * yet), when the tourer is dressed in code as the man is. */
export function tourerModel(
  weight?: RiderId,
  b?: BuildShape,
  bind?: Record<SkierBone, BoneFrame>,
): TourerModel | null {
  if (!held || !weight || !b || !bind) return held;
  let made = builds.get(weight);
  if (!made) {
    made = builtModel(held, b, bind);
    builds.set(weight, made);
  }
  return made;
}
export function setTourerModel(m: TourerModel | null): void {
  held = m;
  builds.clear();
}

// ---------------------------------------------------------------- the clock
/** THE RUN'S CLOCK as the springs and the flutter read it: the run's own
 * `t`, handed in by whatever poses him off a run (`skis-body.ts`), so a
 * pause stills the cloth and a slowed replay slows it; on a card with no
 * run (the rider card's stage), the page's own clock. */
let runT = 0;
let runAt = -Infinity;
const wall = (): number => performance.now() / 1000;
export function setTourerClock(t: number): void {
  runT = t;
  runAt = wall();
}
/** The clock now: the run's while one has handed it in lately (a third
 * of a second — a paused run still hands it in, unmoved), else the
 * page's. */
export function tourerNow(): number {
  return wall() - runAt < 0.3 ? runT : wall();
}

// ---------------------------------------------------------------- springs
/** A point stated in a frame's axes, from the frame's head. */
const inFrame = (f: BoneFrame, o: V3): V3 =>
  add(f.head, add(mul(f.x, o.x), add(mul(f.y, o.y), mul(f.z, o.z))));

/** One spring's swing: about its frame's x (the stuff under its head
 * swung fore and aft) and its z (swung to the side), each with its rate. */
type Swing = { pitch: number; roll: number; wp: number; wr: number };

/** THE SPRINGS OF ONE FIGURE: handed the posed frames, the figure's place
 * in the world and the time (`tourerNow`), they return the spring bones'
 * frames — and the air past him in the figure's own frame, which the
 * flutter reads. */
export type Springs = {
  step(
    frames: Record<SkierBone, BoneFrame>,
    world: THREE.Matrix4,
    now: number,
  ): { frames: BoneFrame[]; flow: V3 };
  rest(): void;
};

/** A spring bone's frame in the bind pose: its parent's axes at its own
 * head, so a swing of zero is the model's own drape. */
export function springBind(
  bind: Record<SkierBone, BoneFrame>,
  heads: Record<SpringBone, V3>,
  i: number,
): BoneFrame {
  const s = SPRING_BONES[i];
  return { ...bind[s.parent], head: heads[s.name], length: s.length };
}

export function createSprings(
  bind: Record<SkierBone, BoneFrame>,
  heads: Record<SpringBone, V3>,
): Springs {
  // Each spring's head stated in its parent's bind frame, and gravity as
  // that parent stands in the bind pose: the share of it the spring hangs
  // against at rest, so the model's own drape is its zero.
  const G = v3(0, 9.81, 0);
  const offsets = SPRING_BONES.map((s) => {
    const f = bind[s.parent];
    const d = sub(heads[s.name] ?? f.head, f.head);
    return v3(dot(d, f.x), dot(d, f.y), dot(d, f.z));
  });
  const restG = SPRING_BONES.map((s) => v3(dot(G, bind[s.parent].x), 0, dot(G, bind[s.parent].z)));
  const swings: Swing[] = SPRING_BONES.map(() => ({ pitch: 0, roll: 0, wp: 0, wr: 0 }));
  let last = -1;
  let pos: THREE.Vector3 | null = null;
  const vel = new THREE.Vector3();
  const acc = new THREE.Vector3();
  const here = new THREE.Vector3();
  const rot = new THREE.Matrix4();
  const inv = new THREE.Matrix4();
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
      // A clock run back (a restart, a replay, the card's clock handed
      // over to the run's) is no motion: the springs are let go.
      if (last >= 0 && (now < last || now - last > 0.5)) rest();
      const dt = last < 0 || now < last ? 0 : Math.min(0.05, now - last);
      last = now;
      // His chest's point in the world: its velocity and acceleration,
      // smoothed over a few frames (a frame's jitter is not a jolt).
      const top = inFrame(frames.chest, offsets[0]);
      here.set(top.x, top.y, top.z).applyMatrix4(world);
      if (pos && dt > 1e-4) {
        const v = here.clone().sub(pos).divideScalar(dt);
        const a = v.clone().sub(vel).divideScalar(dt);
        // A teleport (a reset, a cut) is no force: the springs are let go.
        if (v.length() > 120 || a.length() > 600) rest();
        else {
          acc.lerp(a, Math.min(1, dt / 0.03));
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

      const out = SPRING_BONES.map((s, i): BoneFrame => {
        const parent = frames[s.parent];
        const head = inFrame(parent, offsets[i]);
        const w = swings[i];
        if (dt > 1e-4) {
          const om = 2 * Math.PI * s.hz;
          // What stands UP off its head leans the other way to what hangs.
          const sign = s.up ? -1 : 1;
          const az = (dot(force, parent.z) - restG[i].z) * s.gain * sign;
          const axl = (dot(force, parent.x) - restG[i].x) * s.gain * sign;
          // Linearised pendulum: the thing below the head hangs away from
          // the force (a push ahead swings it back, toward −z; a push to
          // the right swings it left), sprung back to its drape — and is
          // stopped at his body (`back`) and at its reach (`most`).
          w.wp += (-om * om * w.pitch - 2 * s.zeta * om * w.wp + az / s.length) * dt;
          w.wr += (-om * om * w.roll - 2 * s.zeta * om * w.wr - axl / s.length) * dt;
          const pitch = w.pitch + w.wp * dt;
          w.pitch = Math.max(s.back, Math.min(s.most, pitch));
          if (w.pitch !== pitch) w.wp *= pitch < s.back ? -0.2 : 0.5;
          const roll = w.roll + w.wr * dt;
          w.roll = Math.max(-s.most, Math.min(s.most, roll));
          if (w.roll !== roll) w.wr *= 0.5;
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
        return { head, x: x2, y: y2, z: z1, length: s.length };
      });
      return { frames: out, flow: v3(flow.x, flow.y, flow.z) };
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
