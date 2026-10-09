// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PLAYER'S BODY TORN APART, AS DRAWN — only on a run with the INJURIES
// switch on, the one kind of run whose engine deals the wounds
// (`engine/game/gore.ts`, `GameState.gore`). Presentation only: it reads
// what the engine keeps (the pieces gone and how they were going when they
// tore, the trunk opened, the skull crushed, the spike he is on, the heart's
// beat and the blood leaving him) and draws the rest itself, off a stream
// of its own seeded by the map, so a replay draws it again the same.
//
//   * THE BODY'S CUT. His own skin is posed without the pieces he lost
//     (`skis-body.ts`'s `setGore`, `gore-cut.ts`) and a STUMP is laid over
//     every hole it leaves, faced the way the piece went.
//   * THE PIECES. Each piece torn off is a second skin of the same outfit
//     posed as he was at the moment and cut down to that piece, flown as a
//     stick (`gore-gibs.ts`) with its own stump at its torn end.
//   * WHAT COMES OUT. An opened chest throws the heart, the lungs' lobes and
//     broken ribs; an opened belly the liver, a kidney, the spleen and the
//     bowel, which hangs out of him on its mesentery and drags; a crushed
//     skull throws brain and pieces of its vault. A long bone broken into
//     pieces stands out through the skin (an open fracture).
//   * THE BLOOD (`gore-blood.ts`). Every wound spurts on the heart's beat —
//     the jet thrown far on the pulse and dribbling between — and pools
//     under a body lying still; his clothes soak red round every wound.
//   * THE SPIKE. Run through on a tree's top, the bloodied point stands out of him.
//   * THE DEAD LEFT LYING (`leave`). A rider who died is not tidied away
//     when the next one is stood up on the same mountain: his body as it
//     was last drawn (`gore-remains.ts`), the pieces, the guts, the spike
//     and every blot of his blood stay where they lie, for the next one to
//     ski past — the last few dead, the oldest cleared first.

import * as THREE from "three";
import {
  BONES,
  FRACTURE_GRADE,
  GORE,
  GORE_OPEN,
  GORE_PIECES,
  TUNING,
  bleedsOf,
  fracturesOf,
  type BodyPart,
  type GameState,
  type GorePiece,
  type Level,
} from "@engine";
import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";

import { bindPose } from "./dress-loft.ts";
import { createBlood, type Blood } from "./gore-blood.ts";
import { DRIPS, faceRuns, hardLeaks, pourOf, type Cheek, type Leak } from "./gore-flow.ts";
import { gapAt, lowestGap, PART_BONE, partAt, soakPath, spreadAt } from "./gore-leaks.ts";
import { rotorStruck } from "./gore-rotor.ts";
import { tillerSpray } from "./gore-tiller.ts";
import { createSoak } from "./gore-soak.ts";
import { bodyHides, cutOf, cutsOf, pieceCollapse } from "./gore-cut.ts";
import { bakeFigure, disposeFigure } from "./gore-remains.ts";
import {
  lump,
  rope,
  stepLump,
  stepRope,
  stepStick,
  stick,
  type GibGround,
  type Lump,
  type Rope,
  type Stick,
} from "./gore-gibs.ts";
import {
  layTube,
  openingGeometry,
  organGeometry,
  ribGeometry,
  shardGeometry,
  spikeGeometry,
  stumpGeometry,
  tubeGeometry,
  type OrganKind,
} from "./gore-shapes.ts";
import { createDressed, type Dressed, type SkierDress } from "./skier-dress.ts";
import type { BoneFrame, SkierBone } from "./skier-rig.ts";
import type { V3 } from "./skier-pose.ts";

type Wrap = <M extends THREE.Material>(m: M, name: string) => M;

/** What the view asks of the player's model: to be drawn without the
 * pieces he lost, and his skin — its frames, its group and his outfit. */
export type GoreModel = {
  /** Everything he is drawn as hangs under it: what a body left lying is
   * baked from (`gore-remains.ts`). */
  root: THREE.Object3D;
  setGore(lost: number, crush: number): void;
  skin(): {
    frames: Record<SkierBone, BoneFrame>;
    group: THREE.Object3D;
    dress: SkierDress;
    cloth: THREE.BufferGeometry;
  };
};

export type GoreView = {
  group: THREE.Group;
  /** One frame: `simDt` the engine's time it moved, `dt` the frame's;
   * `veil` how far the X-ray has him (`xray-view.ts`), under which the
   * blood flying and the bone out through his skin stand down — the X-ray
   * draws its own, and under its dark veil they read as black specks. */
  update(state: GameState, model: GoreModel, simDt: number, dt: number, veil?: number): void;
  /** The pace the run is shown at (`Blood.setPace`). */
  setPace(pace: number): void;
  /** A new run: everything gone, his clothes clean. */
  clear(model: GoreModel | null): void;
  /** A DEAD RIDER LEFT LYING: if the last run drawn ended in his death,
   * his body as last drawn, the pieces, the guts, the spike and his blood
   * kept where they are, apart from the next rider's, until `clearRemains`
   * or the map goes. Called on a new run before its first pose, while
   * `model` is still drawn as the body; nothing when he did not die. */
  leave(model: GoreModel): void;
  /** Every body left lying gone. */
  clearRemains(): void;
  dispose(): void;
};

/** Each piece's measures: its stump's radius and the bone out of it, m,
 * and which of the engine's flows it bleeds as. */
const PIECE_LOOK: Record<
  GorePiece,
  { r: number; bone: number; flow: keyof typeof GORE.blood.flow }
> = {
  head: { r: 0.075, bone: 0.035, flow: "head" },
  armL: { r: 0.08, bone: 0.05, flow: "arm" },
  armR: { r: 0.08, bone: 0.05, flow: "arm" },
  forearmL: { r: 0.065, bone: 0.04, flow: "forearm" },
  forearmR: { r: 0.065, bone: 0.04, flow: "forearm" },
  legL: { r: 0.11, bone: 0.07, flow: "leg" },
  legR: { r: 0.11, bone: 0.07, flow: "leg" },
  shinL: { r: 0.08, bone: 0.055, flow: "shin" },
  shinR: { r: 0.08, bone: 0.055, flow: "shin" },
  lower: { r: 0.17, bone: 0.045, flow: "waist" },
};

/** The far end of a piece, off its own bones: where its stick ends. */
function farEnd(piece: GorePiece, f: Record<SkierBone, BoneFrame>): V3 {
  const tail = (b: BoneFrame, k = 1): V3 => ({
    x: b.head.x + b.y.x * b.length * k,
    y: b.head.y + b.y.y * b.length * k,
    z: b.head.z + b.y.z * b.length * k,
  });
  switch (piece) {
    case "head":
      return tail(f.head, 1.6);
    case "armL":
    case "forearmL":
      return tail(f.hand_l);
    case "armR":
    case "forearmR":
      return tail(f.hand_r);
    case "legL":
    case "shinL":
      return f.boot_l.head;
    case "legR":
    case "shinR":
      return f.boot_r.head;
    case "lower": {
      const l = f.boot_l.head;
      const r = f.boot_r.head;
      return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2, z: (l.z + r.z) / 2 };
    }
  }
}

/** The long bones an open fracture stands out of, and the skin's bone it
 * stands out through. */
const OPEN_BONES: Partial<Record<string, SkierBone>> = {
  femurL: "thigh_l",
  femurR: "thigh_r",
  tibiaL: "shin_l",
  tibiaR: "shin_r",
  humerusL: "upperarm_l",
  humerusR: "upperarm_r",
  radiusL: "forearm_l",
  radiusR: "forearm_r",
  ulnaL: "forearm_l",
  ulnaR: "forearm_r",
};

/** The ragdoll's points (`RAGDOLL`) as the skin's bones nearest them. */
const POINT_BONE: SkierBone[] = [
  "pelvis",
  "pelvis",
  "upperarm_l",
  "upperarm_r",
  "head",
  "shin_l",
  "shin_r",
  "boot_l",
  "boot_r",
  "forearm_l",
  "forearm_r",
  "hand_l",
  "hand_r",
];

/** The litres his clothes hold round a wound before it runs out at a
 * gap: a jacket's and its layers' worth of a cupful. */
const HOLD = 0.1;
const G = 9.81;

type Piece = {
  piece: GorePiece;
  dressed: Dressed;
  stick: Stick;
  a0: THREE.Vector3;
  d0: THREE.Vector3;
  base: THREE.Matrix4;
  t: number;
  /** The cut end in the piece's skin frame and its way out of the piece. */
  cut: THREE.Vector3;
  out: THREE.Vector3;
};

type Gib = { mesh: THREE.Mesh; lump: Lump };
type Gut = { mesh: THREE.Mesh; rope: Rope; held: boolean };

const yUp = new THREE.Vector3(0, 1, 0);
const v1 = new THREE.Vector3();
const v2 = new THREE.Vector3();
const v3 = new THREE.Vector3();
const q1 = new THREE.Quaternion();
const q2 = new THREE.Quaternion();
const m1 = new THREE.Matrix4();
const m2 = new THREE.Matrix4();

const toV = (p: V3, out = new THREE.Vector3()) => out.set(p.x, p.y, p.z);

/** How many dead are left lying at once; the oldest goes first. */
const REMAINS = 4;

/** ONE BODY LEFT LYING: the statue of him, what was torn out of him, and
 * the blood he left — all owned here now. */
type Remains = {
  body: THREE.Group;
  pieces: Dressed[];
  loose: THREE.Mesh[];
  guts: THREE.Mesh[];
  blood: Blood;
};

export function createGoreView(level: Level, wrap: Wrap): GoreView {
  const group = new THREE.Group();
  group.name = "gore";
  let blood = createBlood(wrap);
  let pace = 1;
  group.add(blood.group);
  const dead = new THREE.Group();
  dead.name = "gore-remains";
  group.add(dead);
  const remains: Remains[] = [];

  const flesh = wrap(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.32,
      metalness: 0.02,
      side: THREE.DoubleSide,
    }),
    "gore-flesh",
  );
  const geometries: THREE.BufferGeometry[] = [];
  const keep = (g: THREE.BufferGeometry) => {
    geometries.push(g);
    return g;
  };
  // The shapes, built once a view: a few of each kind to deal from.
  const organs = new Map<OrganKind, THREE.BufferGeometry[]>();
  const organ = (kind: OrganKind, rng: Rng): THREE.BufferGeometry => {
    let list = organs.get(kind);
    if (!list) {
      list = [0, 1, 2].map((i) => keep(organGeometry(kind, 3.1 + i * 7.7)));
      organs.set(kind, list);
    }
    return rng.pick(list);
  };
  const stumps = new Map<GorePiece, THREE.BufferGeometry>();
  const stumpOf = (piece: GorePiece) => {
    let g = stumps.get(piece);
    if (!g) {
      const look = PIECE_LOOK[piece];
      g = keep(stumpGeometry(look.r, look.bone, GORE_OPEN.length + piece.length * 1.7));
      stumps.set(piece, g);
    }
    return g;
  };
  const ribs = [0, 1, 2].map((i) => keep(ribGeometry(0.1 + 0.05 * i, i * 5.3)));
  const shards = [0, 1, 2].map((i) => keep(shardGeometry(0.09 + 0.03 * i, 0.016, i * 3.7)));
  // An open fracture's end: thick and long enough to stand well out of the limb.
  const breaks = [0, 1, 2].map((i) => keep(shardGeometry(0.22 + 0.04 * i, 0.024, i * 5.1 + 1)));
  const openings = {
    chest: keep(openingGeometry(0.12, true, 4.4)),
    abdomen: keep(openingGeometry(0.11, false, 9.1)),
  };
  const spikeGeo = keep(spikeGeometry(0.6, 0.045));

  const ground: GibGround = {
    heightAt: (x, z) => level.groundAt(x, z),
    normalAt: (x, z, out) => {
      level.normalAt(x, z, out);
      return out;
    },
  };

  // What has been drawn of the engine's wounds so far.
  let rng: Rng = createRng(level.seed ^ 0x5eed90e);
  let pieces: Piece[] = [];
  let gibs: Gib[] = [];
  let guts: Gut[] = [];
  let opened = 0;
  let crushed = false;
  let bladed = 0; // the points of him the rotor's blades went through, drawn
  let spike: THREE.Mesh | null = null;
  const bodyStumps = new Map<GorePiece, THREE.Mesh>();
  const openMeshes = new Map<number, THREE.Mesh>();
  const fractures = new Map<string, THREE.Mesh>();
  let soakClock = 0;
  let poolClock = 0;
  // The litres each part hit hard bled into his clothes; run under each gap since the pools grew.
  const soakedIn = new Map<BodyPart, number>();
  let drips = 0;
  const cheek: Cheek = { side: 1, lean: 0 }; // the cheek his face's blood runs over, how far
  const drift = new THREE.Vector3(); // his way smoothed, a stream carried along (raw, it jitters)
  /** The share of gravity the blood feels relative to him: 1 while the snow
   * holds him up, near 0 while he falls through the air with it — off his
   * body's own fall, `lastFall` the way down he had a frame ago. */
  let felt = 1;
  let lastFall = 0;
  const poolAcc = new Map<string, number>();
  let last: GameState | null = null;

  const soak = createSoak();

  const meshOf = (g: THREE.BufferGeometry): THREE.Mesh => {
    const m = new THREE.Mesh(g, flesh);
    m.castShadow = true;
    m.frustumCulled = false;
    return m;
  };

  /** The body's velocity, m/s: the mean of his points' over the step. */
  const carryOf = (state: GameState, out: THREE.Vector3): THREE.Vector3 => {
    const b = state.skier.thrown;
    out.set(state.skier.vx, state.skier.vy, state.skier.vz);
    if (!b) return out;
    out.set(0, 0, 0);
    const n = b.points.length / 3;
    for (let i = 0; i < n; i++) {
      out.x += b.points[3 * i] - b.last[3 * i];
      out.y += b.points[3 * i + 1] - b.last[3 * i + 1];
      out.z += b.points[3 * i + 2] - b.last[3 * i + 2];
    }
    return out.multiplyScalar(1 / (n * TUNING.dt));
  };

  /** A point of the skin's frame in the world. */
  const world = (p: V3, M: THREE.Matrix4, out = new THREE.Vector3()) => toV(p, out).applyMatrix4(M);
  const worldDir = (d: V3, M: THREE.Matrix4, out = new THREE.Vector3()) =>
    toV(d, out).transformDirection(M);

  /** Throw a few things out of `at` along `dir`. */
  const throwOut = (
    kinds: OrganKind[],
    at: THREE.Vector3,
    dir: THREE.Vector3,
    carry: THREE.Vector3,
    speed: number,
  ) => {
    for (const kind of kinds) {
      const mesh = meshOf(organ(kind, rng));
      group.add(mesh);
      v1.set(
        dir.x + rng.range(-0.7, 0.7),
        dir.y + rng.range(-0.3, 0.8),
        dir.z + rng.range(-0.7, 0.7),
      ).normalize();
      const u = speed * rng.range(0.4, 1.1);
      v2.set(carry.x + v1.x * u, carry.y + v1.y * u, carry.z + v1.z * u);
      v3.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
      gibs.push({
        mesh,
        lump: lump(
          { x: at.x + v1.x * 0.05, y: at.y + v1.y * 0.05, z: at.z + v1.z * 0.05 },
          { x: v2.x, y: v2.y, z: v2.z },
          kind === "liver" ? 0.035 : kind === "gobbet" ? 0.015 : 0.025,
          { x: v3.x, y: v3.y, z: v3.z },
          rng.range(4, 14),
          1 / 60,
        ),
      });
    }
  };
  const throwBones = (
    count: number,
    at: THREE.Vector3,
    dir: THREE.Vector3,
    carry: THREE.Vector3,
  ) => {
    for (let i = 0; i < count; i++) {
      const mesh = meshOf(rng.chance(0.5) ? rng.pick(ribs) : rng.pick(shards));
      group.add(mesh);
      v1.set(
        dir.x + rng.range(-1, 1),
        dir.y + rng.range(0, 1),
        dir.z + rng.range(-1, 1),
      ).normalize();
      const u = rng.range(1.5, 4.5);
      v3.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
      gibs.push({
        mesh,
        lump: lump(
          { x: at.x, y: at.y, z: at.z },
          { x: carry.x + v1.x * u, y: carry.y + v1.y * u, z: carry.z + v1.z * u },
          0.01,
          { x: v3.x, y: v3.y, z: v3.z },
          rng.range(8, 20),
          1 / 60,
        ),
      });
    }
  };

  /** A piece just torn off: its own skin, its stick, a gout of blood. */
  const tear = (
    piece: GorePiece,
    t: number,
    v: { vx: number; vy: number; vz: number },
    skin: ReturnType<GoreModel["skin"]>,
    M: THREE.Matrix4,
    before: number,
  ) => {
    const frames = skin.frames;
    const dressed = createDressed(skin.dress, wrap);
    dressed.frames(frames, pieceCollapse(piece, frames, before));
    dressed.group.matrixAutoUpdate = false;
    dressed.group.matrix.copy(M);
    group.add(dressed.group);
    const cut = cutOf(piece, frames);
    const a0 = world(cut.at, M);
    const b0 = world(farEnd(piece, frames), M);
    const look = PIECE_LOOK[piece];
    // Flung off the way the body was going, the joint's own whip across it.
    const w = new THREE.Vector3(rng.range(-2, 2), rng.range(0, 2.5), rng.range(-2, 2));
    const s = stick(
      { x: a0.x, y: a0.y, z: a0.z },
      { x: b0.x, y: b0.y, z: b0.z },
      { x: v.vx, y: v.vy, z: v.vz },
      { x: w.x, y: w.y, z: w.z },
      look.r,
      piece === "head" ? 0.1 : look.r * 0.8,
      rng.range(-6, 6),
      1 / 60,
    );
    // Its own stump, at its torn end, facing back the way it came from.
    const stump = meshOf(stumpOf(piece));
    toV(cut.at, stump.position);
    stump.quaternion.setFromUnitVectors(yUp, toV(cut.out, v1).multiplyScalar(-1).normalize());
    dressed.group.add(stump);
    soak.cloth(dressed.cloth, [{ at: cut.at, r: 0.16 }], 1, true);
    pieces.push({
      piece,
      dressed,
      stick: s,
      a0,
      d0: b0.clone().sub(a0).normalize(),
      base: M.clone(),
      t,
      cut: toV(cut.at),
      out: toV(cut.out).multiplyScalar(-1),
    });
    // The gout: a burst out of both ends of the tear, and a gobbet or two.
    const dir = worldDir(cut.out, M);
    const carry = v2.set(v.vx, v.vy, v.vz);
    blood.emit(a0, dir, 1.4, 50, 0.5, carry, () => rng.next());
    blood.emit(a0, dir.clone().negate(), 1, 30, 0.6, carry, () => rng.next());
    throwOut(["gobbet", "gobbet"], a0, dir, carry, 2.5);
  };

  /** The trunk's front at the chest (`chest`) or the belly (`abdomen`), in
   * the skin's frame, and its way out. */
  const openAt = (bit: number, f: Record<SkierBone, BoneFrame>): { at: V3; out: V3 } => {
    const b = bit === 0 ? f.chest : f.pelvis;
    const k = bit === 0 ? 0.55 : 0.9;
    const d = bit === 0 ? 0.11 : 0.1;
    return {
      at: {
        x: b.head.x + b.y.x * b.length * k + b.z.x * d,
        y: b.head.y + b.y.y * b.length * k + b.z.y * d,
        z: b.head.z + b.y.z * b.length * k + b.z.z * d,
      },
      out: b.z,
    };
  };

  const placeOn = (mesh: THREE.Mesh, at: V3, out: V3) => {
    toV(at, mesh.position);
    mesh.quaternion.setFromUnitVectors(yUp, toV(out, v1).normalize());
  };

  const clearAll = (model: GoreModel | null) => {
    for (const p of pieces) {
      group.remove(p.dressed.group);
      p.dressed.dispose();
    }
    for (const g of gibs) group.remove(g.mesh);
    for (const g of guts) {
      group.remove(g.mesh);
      g.mesh.geometry.dispose();
    }
    for (const m of [...bodyStumps.values(), ...openMeshes.values(), ...fractures.values()]) {
      m.parent?.remove(m);
    }
    if (spike) group.remove(spike);
    pieces = [];
    gibs = [];
    guts = [];
    bodyStumps.clear();
    openMeshes.clear();
    fractures.clear();
    spike = null;
    opened = 0;
    crushed = false;
    bladed = 0;
    soakedIn.clear();
    drips = 0;
    drift.set(0, 0, 0);
    felt = 1;
    lastFall = 0;
    poolAcc.clear();
    blood.clear();
    soak.clear();
    model?.setGore(0, 0);
    rng = createRng(level.seed ^ 0x5eed90e);
  };

  const forget = (r: Remains) => {
    dead.remove(r.body, r.blood.group, ...r.loose, ...r.guts, ...r.pieces.map((d) => d.group));
    disposeFigure(r.body);
    for (const d of r.pieces) d.dispose();
    for (const m of r.guts) m.geometry.dispose();
    r.blood.dispose();
  };

  const leave = (model: GoreModel) => {
    if (!last?.gore || last.gore.dead < 0) return;
    // His body baked as the last frame drew it, stumps, wounds and soaked clothes.
    const body = bakeFigure(model.root, wrap);
    dead.add(body);
    blood.settle();
    dead.add(blood.group);
    const r: Remains = {
      body,
      pieces: pieces.map((p) => p.dressed),
      loose: [...gibs.map((g) => g.mesh), ...(spike ? [spike] : [])],
      guts: guts.map((g) => g.mesh),
      blood,
    };
    for (const o of [...r.pieces.map((d) => d.group), ...r.loose, ...r.guts]) dead.add(o);
    remains.push(r);
    while (remains.length > REMAINS) forget(remains.shift()!);
    // Owned by the dead now: the next rider starts with none of it.
    pieces = [];
    gibs = [];
    guts = [];
    spike = null;
    blood = createBlood(wrap);
    blood.setPace(pace);
    group.add(blood.group);
    clearAll(model);
    last = null;
  };

  const clearRemains = () => {
    for (const r of remains) forget(r);
    remains.length = 0;
  };

  return {
    group,
    leave,
    clearRemains,
    setPace: (k) => blood.setPace((pace = k)),
    update(state, model, simDt, dt, veil = 0) {
      const veiled = veil > 0.4;
      blood.group.visible = !veiled;
      for (const m of fractures.values()) m.visible = !veiled;
      if (state !== last || state.tick === 0) {
        if (last) clearAll(model);
        last = state;
      }
      const g = state.gore;
      if (!g) return;
      const crush = g.crushed >= 0 ? Math.min(1, (state.t - g.crushed) * 12) : 0;
      model.setGore(g.lost, crush);
      const skin = model.skin();
      skin.group.updateWorldMatrix(true, false);
      const M = skin.group.matrixWorld;
      const f = skin.frames;
      const carry = carryOf(state, new THREE.Vector3());

      // THE PIECES, as they tear.
      while (pieces.length < g.torn.length) {
        const t = g.torn[pieces.length];
        let before = 0;
        for (const p of pieces) before |= 1 << GORE_PIECES.indexOf(p.piece);
        tear(t.piece, t.t, t, skin, M, before);
      }
      // THE TRUNK OPENED.
      GORE_OPEN.forEach((_, bit) => {
        if (!(g.open & (1 << bit)) || opened & (1 << bit)) return;
        opened |= 1 << bit;
        const o = openAt(bit, f);
        const at = world(o.at, M);
        const dir = worldDir(o.out, M);
        if (bit === 0) {
          throwOut(["heart", "lung", "lung", "gobbet", "gobbet", "gobbet"], at, dir, carry, 3.5);
          throwBones(4, at, dir, carry);
        } else {
          throwOut(["liver", "kidney", "spleen", "gobbet", "gobbet"], at, dir, carry, 2.8);
          for (let i = 0; i < 2; i++) {
            const count = 22;
            const geo = tubeGeometry(count);
            const mesh = new THREE.Mesh(geo, flesh);
            mesh.castShadow = true;
            mesh.frustumCulled = false;
            group.add(mesh);
            // Unfurled out of the wound, going his way with him — spilled
            // slower the faster he goes, the wind taking it back at once.
            const spill = 1 / (1 + carry.length() / 4);
            v1.copy(dir).multiplyScalar(rng.range(1.5, 3) * spill);
            v1.y += rng.range(0.5, 1.5) * spill;
            guts.push({
              mesh,
              rope: rope(
                { x: at.x, y: at.y, z: at.z },
                { x: carry.x, y: carry.y, z: carry.z },
                { x: v1.x, y: v1.y, z: v1.z },
                count,
                0.06,
                0.017,
                1 / 60,
              ),
              held: true,
            });
          }
        }
        blood.emit(at, dir, 1.2, 80, 0.7, carry, () => rng.next());
      });
      // THE SKULL CRUSHED.
      if (g.crushed >= 0 && !crushed) {
        crushed = true;
        const at = world(f.head.head, M);
        const dir = worldDir(f.head.y, M);
        throwOut(
          ["brain", "brain", "brain", "skull", "skull", "skull", "skull", "eye", "gobbet"],
          at,
          dir,
          carry,
          3,
        );
        blood.emit(at, dir, 1.4, 90, 0.9, carry, () => rng.next());
      }
      // THROUGH THE ROTOR (`gore-rotor.ts`), a fan off every point a blade went through,
      // and UNDER A PISTE MACHINE (`gore-tiller.ts`), spat out of the back of its tiller.
      const fling = (at: THREE.Vector3, way: THREE.Vector3, k: number) => {
        throwOut(["gobbet", "gobbet", "gobbet", "gobbet"], at, way, carry, k * 0.8);
        throwBones(2, at, way, carry);
      };
      bladed = rotorStruck(state, bladed, blood, carry, rng, fling);
      tillerSpray(state, simDt, blood, rng, level.groundAt, fling);
      // THE SPIKE through him.
      if (g.impaled && !spike) {
        spike = meshOf(spikeGeo);
        group.add(spike);
      }
      if (g.impaled && spike) {
        const i = g.impaled;
        // The bloodied point stands out of him by how far he has slid.
        const len = Math.min(0.6, 0.18 + i.sunk);
        spike.scale.set(1, len / 0.6, 1);
        spike.position.set(i.x, i.y - len, i.z);
      }

      // THE BODY'S STUMPS and the opened trunk, carried on his skin.
      const cuts = new Set(cutsOf(g.lost));
      for (const [piece, mesh] of bodyStumps) {
        if (!cuts.has(piece)) {
          mesh.parent?.remove(mesh);
          bodyStumps.delete(piece);
        }
      }
      for (const piece of cuts) {
        let mesh = bodyStumps.get(piece);
        if (!mesh) {
          mesh = meshOf(stumpOf(piece));
          skin.group.add(mesh);
          bodyStumps.set(piece, mesh);
        }
        const c = cutOf(piece, f);
        placeOn(mesh, c.at, c.out);
      }
      GORE_OPEN.forEach((name, bit) => {
        if (!(g.open & (1 << bit))) return;
        let mesh = openMeshes.get(bit);
        if (!mesh) {
          mesh = meshOf(openings[name]);
          skin.group.add(mesh);
          openMeshes.set(bit, mesh);
        }
        const o = openAt(bit, f);
        placeOn(mesh, o.at, o.out);
      });
      // THE OPEN FRACTURES: a long bone broken in pieces out through the skin.
      const grades = fracturesOf(state.skier.body);
      const hidden = bodyHides(g.lost);
      BONES.forEach((bone, k) => {
        const on = OPEN_BONES[bone];
        if (!on || grades[k] < FRACTURE_GRADE.simple || hidden.has(on)) {
          const m = fractures.get(bone);
          if (m) {
            m.parent?.remove(m);
            fractures.delete(bone);
          }
          return;
        }
        let mesh = fractures.get(bone);
        if (!mesh) {
          mesh = meshOf(breaks[k % breaks.length]);
          skin.group.add(mesh);
          fractures.set(bone, mesh);
        }
        const b = f[on];
        const side = bone.startsWith("ulna") ? -1 : 1;
        const at = {
          x: b.head.x + b.y.x * b.length * 0.5,
          y: b.head.y + b.y.y * b.length * 0.5,
          z: b.head.z + b.y.z * b.length * 0.5,
        };
        // Out through the front of the limb, its splintered end along it.
        const out = {
          x: b.z.x * 0.8 + b.y.x * 0.45 * side + b.x.x * 0.2 * side,
          y: b.z.y * 0.8 + b.y.y * 0.45 * side + b.x.y * 0.2 * side,
          z: b.z.z * 0.8 + b.y.z * 0.45 * side + b.x.z * 0.2 * side,
        };
        placeOn(mesh, at, out);
      });

      // THE PIECES AND THE GIBS FLOWN.
      const fly = Math.min(dt, 1 / 30);
      for (const p of pieces) {
        stepStick(p.stick, ground, fly);
        const a = v1.set(p.stick.a.x, p.stick.a.y, p.stick.a.z);
        const d = v2.set(p.stick.b.x - a.x, p.stick.b.y - a.y, p.stick.b.z - a.z).normalize();
        q1.setFromUnitVectors(p.d0, d);
        q2.setFromAxisAngle(p.d0, p.stick.roll);
        q1.multiply(q2);
        m1.makeTranslation(-p.a0.x, -p.a0.y, -p.a0.z);
        m2.makeRotationFromQuaternion(q1);
        m2.multiply(m1);
        m1.makeTranslation(a.x, a.y, a.z);
        m1.multiply(m2);
        p.dressed.group.matrix.multiplyMatrices(m1, p.base);
        p.dressed.group.matrixWorldNeedsUpdate = true;
      }
      for (const o of gibs) {
        stepLump(o.lump, ground, fly);
        o.mesh.position.set(o.lump.p.x, o.lump.p.y, o.lump.p.z);
        v1.set(o.lump.axis.x, o.lump.axis.y, o.lump.axis.z);
        o.mesh.quaternion.setFromAxisAngle(v1, o.lump.turn);
      }
      const belly = GORE_OPEN.indexOf("abdomen");
      const held = world(openAt(belly, f).at, M, v3);
      for (const gut of [...guts]) {
        // Held at the wound by the mesentery while there is a body to hold
        // it and it has not been torn off it; a piece torn off flies alone.
        gut.rope.held = gut.held ? { x: held.x, y: held.y, z: held.z } : null;
        const torn = stepRope(gut.rope, ground, fly);
        if (!gut.rope.held) gut.held = false;
        layTube(gut.mesh.geometry, gut.rope.p, gut.rope.r);
        if (torn) {
          const mesh = new THREE.Mesh(tubeGeometry(torn.p.length), flesh);
          mesh.castShadow = true;
          mesh.frustumCulled = false;
          group.add(mesh);
          layTube(mesh.geometry, torn.p, torn.r);
          guts.push({ mesh, rope: torn, held: false });
        }
      }

      // THE BLOOD. A torn wound has no cloth over it: it pours out where
      // it is, pumped on the beat. Every part hit hard bleeds under his
      // clothes until they hold no more, then runs out of the lowest gap
      // in them (`gore-leaks.ts`). What reaches the snow pools under him.
      const beat = g.rate > 0 ? g.pulse : 0;
      drift.lerp(carry, 1 - Math.exp(-dt / 0.2));
      if (simDt > 0) {
        const fallen = Math.min(1, Math.max(0, -(carry.y - lastFall) / (G * simDt)));
        felt += (1 - fallen - felt) * (1 - Math.exp(-simDt / 0.1));
        lastFall = carry.y;
      }
      // A stream takes the body's way only when it is really going (lying, it jitters).
      const going = drift.length();
      const along = new THREE.Vector3()
        .copy(drift)
        .multiplyScalar(Math.min(1, Math.max(0, (going - 1.5) / 2)));
      const wounds: Leak[] = [];
      for (const piece of cuts) {
        const c = cutOf(piece, f);
        wounds.push({
          at: world(c.at, M),
          dir: worldDir(c.out, M),
          share: GORE.blood.flow[PIECE_LOOK[piece].flow],
          key: piece,
        });
      }
      GORE_OPEN.forEach((name, bit) => {
        if (!(g.open & (1 << bit))) return;
        const o = openAt(bit, f);
        wounds.push({
          at: world(o.at, M),
          dir: worldDir(o.out, M),
          share: GORE.blood.flow[name],
          key: name,
        });
      });
      if (g.crushed >= 0) {
        wounds.push({
          at: world(f.head.head, M),
          dir: worldDir(f.head.y, M),
          share: GORE.blood.flow.crush,
          key: "skull",
        });
      }
      if (g.impaled) {
        const i = g.impaled;
        wounds.push({
          at: new THREE.Vector3(i.x, i.y - i.sunk, i.z),
          dir: new THREE.Vector3(0, 1, 0),
          share: GORE.blood.flow.impaled,
          key: "spike",
        });
      }
      // Every open fracture bleeds where the bone stands out.
      for (const [bone, mesh] of fractures) {
        wounds.push({
          at: mesh.getWorldPosition(new THREE.Vector3()),
          dir: new THREE.Vector3(0, 1, 0).applyQuaternion(
            mesh.getWorldQuaternion(new THREE.Quaternion()),
          ),
          share: GORE.blood.flow.fracture,
          key: bone,
        });
      }
      // A piece's own end bleeds out what was in it, for a moment.
      for (const p of pieces) {
        const age = state.t - p.t;
        if (age > 3) continue;
        v1.set(
          p.stick.a.x - p.stick.b.x,
          p.stick.a.y - p.stick.b.y,
          p.stick.a.z - p.stick.b.z,
        ).normalize();
        wounds.push({
          at: new THREE.Vector3(p.stick.a.x, p.stick.a.y, p.stick.a.z),
          dir: v1.clone(),
          share: 0.08 * Math.exp(-age),
          key: `piece${pieces.indexOf(p)}`,
        });
      }
      // The parts hit hard, under his clothes.
      const height = (p: V3) => world(p, M, v3).y;
      const hard = bleedsOf(state).filter((h) => h.out > 0 && !hidden.has(PART_BONE[h.part]));
      wounds.push(...hardLeaks(hard, f, M, cheek));
      const total = wounds.reduce((s, w) => s + w.share, 0) || 1;
      const lying = carry.length() < 0.6;
      poolClock += dt;
      const pool = poolClock > 0.1;
      if (pool) poolClock = 0;
      const hips = world(f.pelvis.head, M);
      const low = hips.y - level.groundAt(hips.x, hips.z) < 0.5;
      for (const w of wounds) {
        const q = g.out * (w.share / total);
        if (w.part) {
          // Soaked into the clothes round the wound until full, then out at the gap.
          const had = soakedIn.get(w.part) ?? 0;
          soakedIn.set(w.part, had + q * simDt);
          if (had < HOLD) continue;
        }
        const speed = pourOf(w, beat, g.rate);
        blood.stream(w.at, w.dir, speed, q, simDt, along, () => rng.next(), w.lead, felt);
        if (w.lead) {
          // And it drips off the face, the more the faster it runs.
          drips += simDt * Math.min(DRIPS, 4 + q * 600);
          const n = Math.floor(drips);
          if (n > 0) {
            drips -= n;
            blood.emit(w.at, w.dir, 0.5 + beat, n, 0.6, along, () => rng.next());
          }
        }
        // What reaches the snow under a gap lying on it pools there; a
        // share runs on under him, into the one pool round his body.
        if (w.at.y - level.groundAt(w.at.x, w.at.z) < 0.45) {
          poolAcc.set(w.key, (poolAcc.get(w.key) ?? 0) + q * simDt * (low ? 0.3 : 1));
          if (low) poolAcc.set("body", (poolAcc.get("body") ?? 0) + q * simDt * 0.7);
        }
      }
      if (pool && lying) {
        for (const [key, litres] of poolAcc) {
          const at = key === "body" ? hips : wounds.find((w) => w.key === key)?.at;
          if (at && litres > 0) blood.pool(key, at.x, at.z, litres, spreadAt(state, at.x, at.z));
        }
        poolAcc.clear();
      }
      // The pieces lying on the snow bleed into it too.
      if (pool) {
        for (const p of pieces) {
          if (!p.stick.down || state.t - p.t > 8) continue;
          blood.pool(
            `lying${pieces.indexOf(p)}`,
            p.stick.a.x,
            p.stick.a.z,
            0.012 * Math.exp(-(state.t - p.t) / 4),
            spreadAt(state, p.stick.a.x, p.stick.a.z),
          );
        }
      }
      blood.update(fly, {
        heightAt: (x, z) => level.groundAt(x, z),
        normalAt: (x, z, out) => ground.normalAt(x, z, out as V3),
      });

      // HIS CLOTHES SOAKED: round every torn wound, and from every part hit
      // hard down the way it runs to the gap it comes out of.
      soakClock += dt;
      if (soakClock > 0.25) {
        soakClock = 0;
        const bind = bindPose().frames;
        const wet = Math.min(1, 0.3 + g.blood / 1.2);
        const reach = 0.1 + Math.min(0.35, g.blood * 0.12);
        const at: { at: V3; r: number; blood?: readonly [number, number, number] }[] = [];
        for (const piece of cuts)
          at.push({ at: cutOf(piece, bind).at, r: reach + PIECE_LOOK[piece].r });
        GORE_OPEN.forEach((_, bit) => {
          if (g.open & (1 << bit)) at.push({ at: openAt(bit, bind).at, r: reach + 0.12 });
        });
        if (g.crushed >= 0) at.push({ at: bind.head.head, r: reach + 0.1 });
        if (g.impaled) at.push({ at: bind[POINT_BONE[g.impaled.point]].head, r: reach + 0.1 });
        BONES.forEach((bone, k) => {
          const on = OPEN_BONES[bone];
          if (on && grades[k] >= FRACTURE_GRADE.simple && !hidden.has(on)) {
            const b = bind[on];
            at.push({
              at: {
                x: b.head.x + b.y.x * b.length * 0.5,
                y: b.head.y + b.y.y * b.length * 0.5,
                z: b.head.z + b.y.z * b.length * 0.5,
              },
              r: 0.08 + reach * 0.4,
            });
          }
        });
        for (const h of hard) {
          if (h.part === "head") {
            at.push(...faceRuns(bind, cheek));
            continue;
          }
          const litres = soakedIn.get(h.part) ?? 0;
          if (litres <= 0.005) continue;
          const gap = lowestGap(h.part, f, height);
          at.push(
            ...soakPath(
              partAt(h.part, bind),
              gapAt(gap, bind),
              Math.min(1, litres / HOLD),
              0.07 + Math.min(0.2, 0.5 * Math.sqrt(litres)),
            ),
          );
        }
        if (at.length > 0) soak.cloth(skin.cloth, at, Math.max(wet, hard.length > 0 ? 0.9 : 0));
      }
    },
    clear(model) {
      clearAll(model);
      last = null;
    },
    dispose() {
      clearAll(null);
      clearRemains();
      blood.dispose();
      flesh.dispose();
      for (const g of geometries) g.dispose();
    },
  };
}
