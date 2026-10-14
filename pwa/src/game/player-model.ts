// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PLAYER'S MODELLED KITS: the HIKER made in Blender
// (`scripts/blender/hiker.py`, `make models KIND=player`), a man
// (`hiker.glb`) and a woman (`hiker-woman.glb`) — a mountain guide's
// hardshell, reinforced touring pants, harness, pack, ice axe, rope coil,
// climbing helmet and glacier glasses — skinned on the very rig the dressed
// skier is bound on
// (`dress-loft.ts`'s `bindPose`, bone for bone by name). So it is handed to
// `skier-dress.ts` as the dressed skin's two parts and every pose the game
// has (a carve, the tuck, a landing, a grab, thrown, a torn piece) moves it
// with no animation of its own. The WEIGHT row reshapes it as it does the
// code's dress (`builtModel`, off `dress-body.ts`'s `builtTo` numbers).
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

import type { RiderId } from "@engine";

import { bindPose, pastBreak, type DressPart } from "./dress-loft.ts";
import type { BuildShape } from "./dress-body.ts";
import type { ModelKit } from "./outfit.ts";
import { BREAK } from "./skier-broken.ts";
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
  { name: "fx_coil", parent: "chest", length: 0.12, hz: 2.4, zeta: 0.3, most: 0.22, gain: 0.5 },
  { name: "fx_tail", parent: "fx_coil", length: 0.22, hz: 1.5, zeta: 0.14, most: 0.85, gain: 1 },
] as const;
export type SpringBone = (typeof SPRING_BONES)[number]["name"];

/** The model as the game holds it: the cloth (matt, both sides) and the
 * hard goods (a shine), and each spring bone's head in the bind pose. */
export type PlayerModel = {
  cloth: ModelPart;
  hard: ModelPart;
  heads: Record<SpringBone, V3>;
};

/** The materials `hiker.py` names that are drawn with a shine: the
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

/** Each arm bone that can break, the bone below its break and where along
 * it the break is (`skier-broken.ts`'s `BREAK`). */
const ARM_CUTS = (["l", "r"] as const).flatMap((s) =>
  (
    [
      [`upperarm_${s}`, BREAK.upper],
      [`forearm_${s}`, BREAK.fore],
    ] as const
  ).map(([bone, at]) => ({
    bone,
    at,
    i: SKIER_BONES.indexOf(bone as SkierBone),
    lo: SKIER_BONES.indexOf(bone.replace("arm_", "arm_lo_") as SkierBone),
  })),
);

/** PAST A BREAK: a vertex's share on an arm bone below where it would
 * break moves to the bone below the break, by the code dress's own rule
 * (`dress-loft.ts`'s `pastBreak`) — on a sound arm the two halves move as
 * one; on a broken one the sleeve hangs from the break with the arm in it,
 * rather than folding at the joint. */
function splitAtBreaks(at: V3, w: Map<number, number>): void {
  for (const { bone, at: cut, i, lo } of ARM_CUTS) {
    const share = w.get(i);
    if (!share) continue;
    const c = pastBreak(bone, cut, at);
    if (c <= 0) continue;
    if (c >= 1) w.delete(i);
    else w.set(i, share * (1 - c));
    w.set(lo, (w.get(lo) ?? 0) + share * c);
  }
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
      splitAtBreaks(at, w);
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

/** Which model of a kit: a man's or a woman's. */
export type ModelKey = `${ModelKit}${"" | "-woman"}`;
export const modelKey = (kit: ModelKit, female: boolean): ModelKey =>
  female ? `${kit}-woman` : kit;

/** Every model the build packs, each its own file (`<key>.glb`). */
export const PLAYER_MODELS: readonly ModelKey[] = ["hiker", "hiker-woman"];

const held = new Map<ModelKey, PlayerModel>();
const builds = new Map<string, PlayerModel>();

let runClock: number | null = null;

/** THE CLOCK THE KIT MOVES ON: the run's own (`GameState.t`), handed in
 * where the player is posed, so a lab's stepped stills, a paused frame, a
 * replay's slow motion and its seeks all show the cloth as the run had it;
 * `null` off a run (the rider card), when it is the wall clock. */
export function setPlayerClock(t: number | null): void {
  runClock = t;
}
export function playerNow(): number {
  return runClock ?? performance.now() / 1000;
}

/** A kit's model, a man's or a woman's, at the build its WEIGHT row picks
 * (`builtModel`, made once a build) — once `skier-models.ts`'s
 * `loadModels` has read it; or `null` (switched off, not packed, failed to
 * load, or not in yet), when the player is dressed in code as any other
 * skier. */
export function playerModel(
  key: ModelKey,
  weight?: RiderId,
  shape?: BuildShape,
): PlayerModel | null {
  const m = held.get(key) ?? null;
  if (!m || !weight || !shape) return m;
  const id = `${key}:${weight}`;
  let made = builds.get(id);
  if (!made) {
    made = builtModel(m, shape, bindPose().frames);
    builds.set(id, made);
  }
  return made;
}
export function setPlayerModel(key: ModelKey, m: PlayerModel | null): void {
  if (m) held.set(key, m);
  else held.delete(key);
  for (const id of [...builds.keys()]) if (id.startsWith(`${key}:`)) builds.delete(id);
}

// ---------------------------------------------------------------- the build
const v3 = (x: number, y: number, z: number): V3 => ({ x, y, z });
const add = (a: V3, b: V3): V3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a: V3, b: V3): V3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a: V3, k: number): V3 => v3(a.x * k, a.y * k, a.z * k);
const dot = (a: V3, b: V3): number => a.x * b.x + a.y * b.y + a.z * b.z;

/** The bones the trunk's girth moves, and the limbs' (which take 0.7 of
 * it, as `builtTo`'s do); the rest (the head, the hands, the boots) is a
 * heavier skier's as the medium one's. */
const TRUNK_BONES = new Set<string>(["pelvis", "chest"]);
const LIMB_BONES = new Set<string>(
  SKIER_BONES.filter((b) => /^(thigh|shin|upperarm|forearm|hip|knee|shoulder|elbow)/.test(b)),
);

/** THE MODEL AT A BUILD (the WEIGHT row, `outfit.ts`'s `WEIGHTS`): every
 * vertex moved off the line of the bone that carries most of it by the
 * build's share — the loom's own numbers (`dress-body.ts`'s `builtTo`):
 * the trunk by its girth, a heavy skier's STOMACH carried ahead over the
 * belt and a solid one's CHEST and upper arms, the limbs by 0.7 of it —
 * and the pack and the coil on the chest set back or out as far as the
 * trunk has grown. The medium build is the model as it is. */
export function builtModel(
  m: PlayerModel,
  b: BuildShape,
  bind: Record<SkierBone, BoneFrame>,
): PlayerModel {
  if (b.girth === 1 && b.belly === 0 && b.chest === 0) return m;
  const limb = 1 + (b.girth - 1) * 0.7;
  const spine = bind.pelvis;
  const chest = bind.chest;
  // The back grows by the girth's share of its depth behind the spine.
  const shift = mul(chest.z, -(b.girth - 1) * 0.11);
  // The stomach's level: a hand above the hips' head, gone by the crotch
  // and under the ribs; the chest's from the lowest rib up.
  const gut = (y: number): number => {
    const u = Math.max(0, 1 - Math.abs(y - (spine.head.y + 0.16)) / 0.2);
    return u * u * (3 - 2 * u);
  };
  const pecs = (y: number): number => Math.max(0, Math.min(1, (y - chest.head.y + 0.05) / 0.2));
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
        // The pack and the coil ride his back and chest.
        if (SPRING_BONES[bone - SKIER_BONES.length].parent === "chest") to = add(p, shift);
      } else {
        const name = SKIER_BONES[bone];
        const f = bind[name];
        if (TRUNK_BONES.has(name) || LIMB_BONES.has(name)) {
          const t = Math.max(0, Math.min(f.length, dot(sub(p, f.head), f.y)));
          const on = add(f.head, mul(f.y, t));
          const off = sub(p, on);
          let k = TRUNK_BONES.has(name) ? b.girth : limb;
          if (TRUNK_BONES.has(name)) {
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

// ---------------------------------------------------------------- springs

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
  const headOf = (name: string): V3 =>
    name === "chest" ? chest.head : (heads[name as SpringBone] ?? chest.head);
  for (const s of SPRING_BONES) {
    const d = sub(heads[s.name] ?? headOf(s.parent), headOf(s.parent));
    offsets.push(v3(dot(d, chest.x), dot(d, chest.y), dot(d, chest.z)));
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
      // A clock run back or jumped on (a restart, a replay's seek, the
      // card's wall clock handed over to a run's) is no motion: let go.
      const gap = now - last;
      if (last >= 0 && (gap < 0 || gap > 0.5)) rest();
      const dt = last < 0 || gap < 0 || gap > 0.5 ? 0 : Math.min(0.05, gap);
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
      SPRING_BONES.forEach((s, i) => {
        // Each spring hangs off its own parent: the chest, or a spring
        // before it in the list.
        const parent =
          s.parent === "chest"
            ? frames.chest
            : out[SPRING_BONES.findIndex((b) => b.name === s.parent)];
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
