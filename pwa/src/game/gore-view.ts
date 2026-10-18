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
//   * THE BLOOD (`gore-blood.ts`). A torn artery spurts on the beat until
//     its spasm closes it; anything slower wells out, in drops — and pools
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
  GORE,
  GORE_OPEN,
  GORE_PIECES,
  bleedsOf,
  brokeAt,
  fracturesOf,
  woundFlow,
  type BodyPart,
  type GameState,
  type GorePiece,
  type Level,
} from "@engine";
import { createRng, type Rng } from "@niclaslindstedt/oss-game-framework/core/prng";

import { bindPose } from "./dress-loft.ts";
import {
  OPEN_BONES,
  breakAlong,
  limbAt,
  openBreakGeometry,
  openBreaksOf,
  placeBreak,
} from "./gore-bones.ts";
import { createBlood } from "./gore-blood.ts";
import {
  arterial,
  bodyVelocity,
  createDrips,
  faceRuns,
  hardLeaks,
  pourOf,
  STREAM,
} from "./gore-flow.ts";
import type { Cheek, Leak } from "./gore-flow.ts";
import { gapAt, lowestGap, PART_BONE, partAt, soakPath, spreadAt } from "./gore-leaks.ts";
import { rotorStruck } from "./gore-rotor.ts";
import { tillerSpray } from "./gore-tiller.ts";
import { createSoak } from "./gore-soak.ts";
import {
  bodyHides,
  cutOf,
  cutsOf,
  farEnd,
  PIECE_BONES,
  PIECE_LOOK,
  pieceCollapse,
  POINT_BONE,
} from "./gore-cut.ts";
import { bakeFigure, disposeFigure, REMAINS, type Remains } from "./gore-remains.ts";
import {
  lump,
  rope,
  stepRope,
  stepStick,
  stick,
  gibGround,
  type Rope,
  type Stick,
} from "./gore-gibs.ts";
import {
  layTube,
  openingGeometry,
  organGeometry,
  ORGAN_KINDS,
  ribGeometry,
  shardGeometry,
  spikeGeometry,
  stumpGeometry,
  tubeGeometry,
  type OrganKind,
} from "./gore-shapes.ts";
import { createLumps, gorePrimer } from "./gore-lumps.ts";
import { createSmears } from "./gore-smear.ts";
import { createBloodTrees } from "./gore-tree.ts";
import { armBreaks } from "./skier-broken.ts";
import { createDressed, cutAhead, type Dressed, type SkierDress } from "./skier-dress.ts";
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
  /** How a piece torn off whole has moved since it tore (its world now
   * over its world then), for the X-ray's bones in it; null if not flying. */
  flown(piece: GorePiece, out: THREE.Matrix4): THREE.Matrix4 | null;
  dispose(): void;
};

/** The litres his clothes hold round a wound before it runs out at a
 * gap: the cloth round it soaked through, a tablespoon or so. */
const HOLD = 0.015;
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

/** What the last frame's `update` cost the processor, ms — read by the
 * gore cost lab (`scripts/gore-cost.mjs`). */
export const goreMeter = { updateMs: 0 };

export function createGoreView(
  level: Level,
  wrap: Wrap,
  variants?: () => number,
  model?: GoreModel,
): GoreView {
  const group = new THREE.Group();
  group.name = "gore";
  const trees = createBloodTrees(level, wrap, variants);
  group.add(trees.group);
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
  const organsOf = (kind: OrganKind): THREE.BufferGeometry[] => {
    let list = organs.get(kind);
    if (!list) {
      list = [0, 1, 2].map((i) => keep(organGeometry(kind, 3.1 + i * 7.7)));
      organs.set(kind, list);
    }
    return list;
  };
  const organ = (kind: OrganKind, rng: Rng) => rng.pick(organsOf(kind));
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
  // An open fracture's end, a bone's and grade's own at the limb it is in.
  const breakGeos = new Map<string, THREE.BufferGeometry>();
  const breakOf = (bone: string, grade: number, limb: number) => {
    const key = `${bone}:${grade}:${limb.toFixed(3)}`;
    let g = breakGeos.get(key);
    if (!g) {
      const o = OPEN_BONES[bone as (typeof BONES)[number]]!;
      const seed = BONES.indexOf(bone as (typeof BONES)[number]) * 5.1 + 1;
      g = keep(openBreakGeometry({ r: o.r, out: o.out, limb, grade, seed }));
      breakGeos.set(key, g);
    }
    return g;
  };
  const openings = {
    chest: keep(openingGeometry(0.12, true, 4.4)),
    abdomen: keep(openingGeometry(0.11, false, 9.1)),
  };
  const spikeGeo = keep(spikeGeometry(0.6, 0.045));
  // What a smash left on the solid it met (`gore-smear.ts`).
  const smears = createSmears(level, flesh, level.seed ^ 0x5ea5, (...a) => blood.splat(...a));
  group.add(smears.group);

  const ground = gibGround(level);

  // What has been drawn of the engine's wounds so far.
  let rng: Rng = createRng(level.seed ^ 0x5eed90e);
  let pieces: Piece[] = [];
  let tornSeen = 0; // of the engine's torn pieces, flown or crushed
  let lumps = createLumps(flesh);
  group.add(lumps.group);
  // Built with his model, at load: the hit's programs compiled and its shapes cut behind the card.
  const primed = model && createDressed(model.skin().dress, wrap, PIECE_BONES.head);
  if (model) cutAhead(model.skin().dress, Object.values(PIECE_BONES));
  for (const kind of model ? ORGAN_KINDS : []) organsOf(kind);
  for (const piece of model ? GORE_PIECES : []) stumpOf(piece);
  const primer = primed ? gorePrimer(flesh, primed.group) : null;
  if (primer) group.add(primer.group);
  let guts: Gut[] = [];
  let opened = 0;
  let crushed = false;
  let middled = false;
  let bladed = 0; // the points of him the rotor's blades went through, drawn
  let spike: THREE.Mesh | null = null;
  const bodyStumps = new Map<GorePiece, THREE.Mesh>();
  const openMeshes = new Map<number, THREE.Mesh>();
  const fractures = new Map<string, THREE.Mesh>();
  let soakClock = 0;
  let poolClock = 0;
  // The litres each part hit hard bled into his clothes; run under each gap since the pools grew.
  const soakedIn = new Map<BodyPart, number>();
  const drips = createDrips();
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
      const geo = organ(kind, rng);
      v1.set(
        dir.x + rng.range(-0.7, 0.7),
        dir.y + rng.range(-0.3, 0.8),
        dir.z + rng.range(-0.7, 0.7),
      ).normalize();
      const u = speed * rng.range(0.4, 1.1);
      v2.set(carry.x + v1.x * u, carry.y + v1.y * u, carry.z + v1.z * u);
      v3.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
      lumps.add(
        geo,
        lump(
          { x: at.x + v1.x * 0.05, y: at.y + v1.y * 0.05, z: at.z + v1.z * 0.05 },
          { x: v2.x, y: v2.y, z: v2.z },
          kind === "liver" ? 0.035 : kind === "gobbet" ? 0.015 : 0.025,
          { x: v3.x, y: v3.y, z: v3.z },
          rng.range(4, 14),
          1 / 60,
        ),
      );
    }
  };
  const throwBones = (
    count: number,
    at: THREE.Vector3,
    dir: THREE.Vector3,
    carry: THREE.Vector3,
  ) => {
    for (let i = 0; i < count; i++) {
      const geo = rng.chance(0.5) ? rng.pick(ribs) : rng.pick(shards);
      v1.set(
        dir.x + rng.range(-1, 1),
        dir.y + rng.range(0, 1),
        dir.z + rng.range(-1, 1),
      ).normalize();
      const u = rng.range(1.5, 4.5);
      v3.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).normalize();
      lumps.add(
        geo,
        lump(
          { x: at.x, y: at.y, z: at.z },
          { x: carry.x + v1.x * u, y: carry.y + v1.y * u, z: carry.z + v1.z * u },
          0.01,
          { x: v3.x, y: v3.y, z: v3.z },
          rng.range(8, 20),
          1 / 60,
        ),
      );
    }
  };

  /** A piece CRUSHED on a solid (`TornPiece.pulped`): no limb flies, only
   * the meat and the splinters of its bone, in a burst of blood. */
  const pulp = (
    piece: GorePiece,
    v: { vx: number; vy: number; vz: number },
    f: Record<SkierBone, BoneFrame>,
    M: THREE.Matrix4,
  ) => {
    const cut = cutOf(piece, f);
    const at = world(farEnd(piece, f), M);
    const dir = worldDir(cut.out, M);
    const carry = v2.set(v.vx * 0.3, v.vy * 0.3, v.vz * 0.3);
    const head = piece === "head";
    throwOut(
      head ? ["brain", "brain", "brain", "brain", "skull", "skull", "eye"] : [],
      at,
      dir,
      carry,
      3,
    );
    throwOut(["gobbet", "gobbet", "gobbet", "gobbet", "gobbet", "gobbet"], at, dir, carry, 3);
    throwBones(3, at, dir, carry);
    blood.emit(at, dir, 2.2, 90, 0.9, carry, () => rng.next());
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
    const dressed = createDressed(skin.dress, wrap, PIECE_BONES[piece]);
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
    lumps.clear();
    for (const g of guts) {
      group.remove(g.mesh);
      g.mesh.geometry.dispose();
    }
    for (const m of [...bodyStumps.values(), ...openMeshes.values(), ...fractures.values()]) {
      m.parent?.remove(m);
    }
    if (spike) group.remove(spike);
    pieces = [];
    tornSeen = 0;
    smears.clear();
    guts = [];
    bodyStumps.clear();
    openMeshes.clear();
    fractures.clear();
    spike = null;
    opened = 0;
    crushed = false;
    middled = false;
    bladed = 0;
    soakedIn.clear();
    drips.clear();
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
    dead.remove(r.body, r.blood.group, r.lumps.group, ...r.loose, ...r.guts);
    dead.remove(...r.pieces.map((d) => d.group));
    disposeFigure(r.body);
    r.lumps.dispose();
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
      loose: [...(spike ? [spike] : []), ...smears.take()],
      lumps,
      guts: guts.map((g) => g.mesh),
      blood,
    };
    for (const o of [...r.pieces.map((d) => d.group), ...r.loose, ...r.guts]) dead.add(o);
    dead.add(lumps.group);
    remains.push(r);
    while (remains.length > REMAINS) forget(remains.shift()!);
    // Owned by the dead now: the next rider starts with none of it.
    pieces = [];
    lumps = createLumps(flesh);
    group.add(lumps.group);
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
    trees.clear();
  };

  const frame = (state: GameState, model: GoreModel, simDt: number, dt: number, veil = 0): void => {
    if (primer) primer.group.visible = false;
    const veiled = veil > 0.4;
    blood.group.visible = !veiled;
    for (const m of fractures.values()) m.visible = !veiled;
    for (const p of pieces) p.dressed.group.visible = !veiled; // its bones fly in the X-ray
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
    const carry = bodyVelocity(state, new THREE.Vector3());

    // THE PIECES, as they tear — or are crushed — and what a smash left on the solid.
    for (; tornSeen < g.torn.length; tornSeen++) {
      const t = g.torn[tornSeen];
      let before = 0;
      for (const p of g.torn.slice(0, tornSeen)) before |= 1 << GORE_PIECES.indexOf(p.piece);
      if (t.pulped) pulp(t.piece, t, f, M);
      else tear(t.piece, t.t, t, skin, M, before);
    }
    smears.update(g.smears, state.t);
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
    // THE MIDDLE CRUSHED square on: its blood flung on ahead past the solid and back off its face.
    if (g.middle >= 0 && !middled) {
      middled = true;
      const at = world(f.chest.head, M);
      const u = Math.hypot(g.way.x, g.way.y, g.way.z);
      const way = new THREE.Vector3(g.way.x, g.way.y, g.way.z).normalize();
      // Round a wide solid (a tower's pad), never through it: out past both its sides.
      const o = [...g.smears].reverse().find((m) => m.r > 0);
      const ahead = (from: THREE.Vector3, n: number) =>
        blood.emit(from, way, u * 0.45, n, 0.9, carry, () => rng.next());
      if (o && o.r > 0.25)
        for (const k of [1, -1])
          ahead(at.clone().add(v1.set(way.z * k, 0, -way.x * k).setLength(o.r + 0.15)), 250);
      else ahead(at, 500);
      blood.emit(at, way.clone().negate(), 3.5, 300, 1.3, carry, () => rng.next());
      smears.fling(at, g.way, state.t, o && { x: o.cx, z: o.cz, r: o.r });
    }
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
    // The bloodied point stands out of him by how far he has slid.
    const i = g.impaled;
    if (i && spike) spike.scale.set(1, Math.min(0.6, 0.18 + i.sunk) / 0.6, 1);
    if (i && spike) spike.position.set(i.x, i.y - i.sunk - 0.18, i.z);
    trees.update(state);

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
    // THE OPEN FRACTURES: a long bone broken through, its end out of the skin.
    const grades = fracturesOf(state.skier.body);
    const hidden = bodyHides(g.lost);
    const open = openBreaksOf(grades, hidden);
    const arms = armBreaks(state.skier.body.injuries);
    for (const [bone, m] of fractures) {
      if (open.has(bone)) continue;
      m.parent?.remove(m);
      fractures.delete(bone);
    }
    for (const [bone, grade] of open) {
      const limb = limbAt(skin.cloth, bone);
      const geo = breakOf(bone, grade, limb);
      let mesh = fractures.get(bone);
      if (!mesh) {
        mesh = meshOf(geo);
        skin.group.add(mesh);
        fractures.set(bone, mesh);
      }
      mesh.geometry = geo;
      const o = OPEN_BONES[bone as (typeof BONES)[number]]!;
      const arm = arms[bone.endsWith("L") ? 0 : 1];
      placeBreak(mesh, o, f[o.on], breakAlong(bone, f[o.on], arm), limb);
    }

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
    lumps.update(ground, fly);
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
    // it is, pumped on the beat until its artery closes. Every part hit
    // hard bleeds under his clothes until they hold no more, then runs
    // out of the lowest gap in them (`gore-leaks.ts`) — a slow bleed in
    // drops, not a stream (`gore-flow.ts`). What reaches the snow pools.
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
      const torn = g.torn.find((p) => p.piece === piece)?.t ?? g.mortal;
      const flow = arterial(GORE.blood.flow[PIECE_LOOK[piece].flow], state.t - torn);
      wounds.push({ at: world(c.at, M), dir: worldDir(c.out, M), ...flow, key: piece });
    }
    GORE_OPEN.forEach((name, bit) => {
      if (!(g.open & (1 << bit))) return;
      const o = openAt(bit, f);
      wounds.push({
        at: world(o.at, M),
        dir: worldDir(o.out, M),
        ...arterial(GORE.blood.flow[name], state.t - g.mortal),
        key: name,
      });
    });
    if (g.crushed >= 0) {
      wounds.push({
        at: world(f.head.head, M),
        dir: worldDir(f.head.y, M),
        ...arterial(GORE.blood.flow.crush, state.t - g.crushed),
        key: "skull",
      });
    }
    if (g.impaled) {
      const i = g.impaled;
      wounds.push({
        at: new THREE.Vector3(i.x, i.y - i.sunk, i.z),
        dir: new THREE.Vector3(0, 1, 0),
        ...arterial(GORE.blood.flow.impaled, state.t - i.t),
        key: "spike",
      });
    }
    // A limb or the head torn open on a spike's tip welling where it tore.
    for (const h of g.gashes) {
      const share = GORE.blood.flow.gash * woundFlow(state.t - h.t, false).ooze;
      const at = world(f[POINT_BONE[h.point]].head, M);
      wounds.push({ at, dir: new THREE.Vector3(0, 1, 0), share, key: `gash${h.point}` });
    }
    // Every open fracture bleeds where the bone stands out.
    for (const [bone, mesh] of fractures) {
      wounds.push({
        at: mesh.getWorldPosition(new THREE.Vector3()),
        dir: new THREE.Vector3(0, 1, 0).applyQuaternion(
          mesh.getWorldQuaternion(new THREE.Quaternion()),
        ),
        share: GORE.blood.flow.fracture * woundFlow(state.t - brokeAt(state, bone), false).ooze,
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
      // A torn artery spurting streams whatever it pours; anything else
      // streams only fast enough, and lets go as drops below that.
      if (q >= STREAM || (w.spurt ?? 0) > 0.5)
        blood.stream(w.at, w.dir, speed, q, simDt, along, () => rng.next(), w.lead, felt);
      const n = drips.count(w.key, w.lead || q < STREAM ? q : 0, simDt);
      if (n > 0) blood.emit(w.at, w.dir, speed, n, 0.25, along, () => rng.next());
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
      for (const bone of open.keys()) {
        const o = OPEN_BONES[bone as (typeof BONES)[number]]!;
        const b = bind[o.on];
        const k = breakAlong(bone, b, null);
        const p = { x: b.head.x + b.y.x * k, y: b.head.y + b.y.y * k, z: b.head.z + b.y.z * k };
        at.push({ at: p, r: 0.08 + reach * 0.4 });
      }
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
  };

  return {
    group,
    leave,
    clearRemains,
    setPace: (k) => blood.setPace((pace = k)),
    update(state, model, simDt, dt, veil) {
      const at = performance.now();
      frame(state, model, simDt, dt, veil);
      goreMeter.updateMs = performance.now() - at;
    },
    clear(model) {
      clearAll(model);
      last = null;
    },
    flown(piece, out) {
      const p = pieces.find((q) => q.piece === piece);
      return p ? out.copy(p.base).invert().premultiply(p.dressed.group.matrix) : null;
    },
    dispose() {
      clearAll(null);
      clearRemains();
      blood.dispose();
      primer?.dispose();
      primed?.dispose();
      flesh.dispose();
      for (const g of geometries) g.dispose();
    },
  };
}
