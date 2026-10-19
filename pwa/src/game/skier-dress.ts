// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DRESSED SKIER AS DRAWN: an outfit's two meshes (`dress.ts`) skinned
// on the skier's own rig (`skier-rig.ts`'s bones, bound in `STANDING`) and
// posed every frame by the game's pose, bone for bone — `skierBones` of
// the very `SkierPose` the poles and the headlamp hang on. So the cloth
// bends at the knee, the hip, the elbow and the small of the back as one
// skin, and every pose the game has (a carve, the tuck, a landing, a grab,
// thrown) is the rig's arithmetic, never a second animation.
//
// Two draws a skier: the CLOTH (matt) and the HARD goods (the helmet, the
// goggles or the visor, the chin guard: a shine of their own). Each
// vertex carries its colour; a ghost's are washed pale.

import * as THREE from "three";

import { dressOutfit } from "./dress.ts";
import { bindPose, type DressPart } from "./dress-loft.ts";
import { dealtOutfit, gearOf, type Outfit } from "./outfit.ts";
import type { SkierPose } from "./skier-pose.ts";
import { SKIER_BONES, skierBones, type BoneFrame, type SkierBone } from "./skier-rig.ts";
import type { Collapse } from "./gore-cut.ts";
import { suitDress } from "./wingsuit-dress.ts";
import type { RiderId } from "@engine";
import {
  createSprings,
  flutterUniforms,
  modelKey,
  playerModel,
  playerNow,
  KITS,
  withFlutter,
  type ModelPart,
  type RaceKit,
  type PlayerModel,
} from "./player-model.ts";

export type Dressed = {
  /** What the figure's group carries: the bones and the two meshes. */
  group: THREE.Group;
  meshes: THREE.SkinnedMesh[];
  pose(p: SkierPose, cut?: Collapse | null): void;
  /** Posed off bone frames handed in whole (a piece torn off,
   * `gore-view.ts`), each in the group's frame. */
  frames(f: Record<SkierBone, BoneFrame>, cut?: Collapse | null): void;
  /** The frames of the last pose, in the group's frame. */
  last(): Record<SkierBone, BoneFrame>;
  /** The cloth's vertex colours, the bind pose's positions and its weights
   * — what a wound soaks red (`gore-view.ts`). */
  cloth: THREE.BufferGeometry;
  dispose(): void;
};

type Wrap = <M extends THREE.Material>(m: M, name: string) => M;

/** What the skier is dressed in: the outfit, his skin's own tone, and
 * whether he is a GHOST (every colour washed pale). */
export type SkierDress = {
  outfit: Outfit;
  tone?: number;
  ghost?: boolean;
  /** Indoors: no helmet and no goggles (`cutHead`). */
  bare?: boolean;
  /** In a WINGSUIT, its colourway (`wingsuit-look.ts`): the body cut as
   * the suit's (`wingsuit-dress.ts`) and the wings hung on the figure. */
  suit?: number;
  /** The player's MODELLED kit (`player-model.ts`) in place of the
   * outfit's cut, once it is loaded and when his outfit's body is the
   * modelled one (the hiker, the racer) — never in a suit or indoors. */
  model?: boolean;
  /** A racer's discipline kit (`RACE_KITS`): what his model leaves off —
   * the slalom's guards on a technical race, the airbag on a speed one. */
  kit?: RaceKit;
};

/** An enthusiast's kit, dealt off his look and build (`dealtOutfit`) and
 * kept in `kits` under them, so a rider is dressed once a run. */
export function dealtKit(kits: Map<string, SkierDress>, look: number, rider: RiderId): SkierDress {
  const key = `${look}:${rider}`;
  const kit = kits.get(key);
  if (kit) return kit;
  const { tone, ...dressed } = dealtOutfit(look, rider);
  const made: SkierDress = { outfit: dressed, tone };
  kits.set(key, made);
  return made;
}

/** The modelled kit `outfit`'s body wears (the hiker, the racer —
 * `player-model.ts`), at its build and with what the discipline `kit`
 * leaves off — or `null` for a body dressed in code. */
const modelOf = (outfit: Outfit, kit?: RaceKit): PlayerModel | null => {
  const body = gearOf("body", outfit.body);
  return body.model
    ? playerModel(
        modelKey(body.model, body.female),
        outfit.weight,
        gearOf("weight", outfit.weight),
        kit,
      )
    : null;
};

/** A ghost's colours: the kit's own light, lifted toward a pale ice blue. */
const PALE = new THREE.Color(0xdcecff).convertSRGBToLinear();

function geometryOf(part: DressPart | ModelPart, ghost: boolean): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  if ("flutter" in part) {
    g.setAttribute("flutter", new THREE.Float32BufferAttribute(part.flutter, 1));
    g.setAttribute("shiver", new THREE.Float32BufferAttribute(part.shiver, 1));
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(part.position, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(part.normal, 3));
  const colour = Float32Array.from(part.color);
  if (ghost) {
    for (let i = 0; i < colour.length; i += 3) {
      const l = 0.3 * colour[i] + 0.55 * colour[i + 1] + 0.15 * colour[i + 2];
      colour[i] = PALE.r * (0.55 + 0.45 * l);
      colour[i + 1] = PALE.g * (0.55 + 0.45 * l);
      colour[i + 2] = PALE.b * (0.55 + 0.45 * l);
    }
  }
  g.setAttribute("color", new THREE.BufferAttribute(colour, 3));
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(part.skinIndex, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(part.skinWeight, 4));
  g.setIndex(part.index);
  // The skier stands inside a couple of metres of his root at any pose.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 2.2);
  return g;
}

/** Every array a part holds a value a vertex in, and how many values. */
const PER_VERTEX = [
  ["position", 3],
  ["normal", 3],
  ["color", 3],
  ["skinIndex", 4],
  ["skinWeight", 4],
  ["flutter", 1],
  ["shiver", 1],
] as const;
/** The parts cut down so far, a part's by the bones kept. */
const TRIMMED = new WeakMap<DressPart, Map<string, DressPart>>();

/** `part` cut down to the triangles that move with one of the bones `keep`
 * (any weight on one), its vertices renumbered — the skin of a piece torn
 * off, whose every other triangle its pose gathers into a point. Cut once
 * a part and a set of bones, and shared: never written to. */
function keepBones<P extends DressPart>(part: P, keep: readonly number[]): P {
  const key = keep.join();
  let cuts = TRIMMED.get(part);
  if (!cuts) TRIMMED.set(part, (cuts = new Map()));
  const known = cuts.get(key);
  if (known) return known as P;
  const kept = new Set(keep);
  const count = part.position.length / 3;
  // Each vertex's verdict, and the number it is given: -1 none yet.
  const moves = new Int8Array(count);
  for (let v = 0; v < count; v++) {
    for (let k = 0; k < 4; k++) {
      if (part.skinWeight[4 * v + k] > 0 && kept.has(part.skinIndex[4 * v + k])) moves[v] = 1;
    }
  }
  const to = new Int32Array(count).fill(-1);
  const order: number[] = [];
  const index: number[] = [];
  const tri = part.index;
  for (let i = 0; i < tri.length; i += 3) {
    if (!moves[tri[i]] && !moves[tri[i + 1]] && !moves[tri[i + 2]]) continue;
    for (let k = 0; k < 3; k++) {
      const v = tri[i + k];
      if (to[v] < 0) {
        to[v] = order.length;
        order.push(v);
      }
      index.push(to[v]);
    }
  }
  const out: Record<string, unknown> = { ...part, index };
  for (const [name, n] of PER_VERTEX) {
    const from = (part as Record<string, unknown>)[name] as number[] | undefined;
    if (!from) continue;
    const array = new Array<number>(order.length * n);
    for (let i = 0; i < order.length; i++) {
      for (let k = 0; k < n; k++) array[i * n + k] = from[order[i] * n + k];
    }
    out[name] = array;
  }
  cuts.set(key, out as P);
  return out as P;
}

/** What `dress` is cut from: the modelled kit, the wingsuit or the outfit
 * off the loom (each cut once and kept). */
function cutOf(dress: SkierDress) {
  const model =
    dress.model && dress.suit === undefined && !dress.bare
      ? modelOf(dress.outfit, dress.kit)
      : null;
  const cut = model
    ? model
    : dress.suit === undefined
      ? dressOutfit(dress.outfit, dress.tone, dress.bare)
      : suitDress(dress.outfit, dress.suit, dress.tone, dress.bare);
  return { model, cut };
}

/** How far what `dress` carries stands out of his back, m (`KitDef.pack`):
 * the modelled hiker's pack; nothing on a body dressed in code. */
export function packOf(dress: SkierDress): number {
  if (!dress.model || dress.suit !== undefined || dress.bare) return 0;
  const kit = gearOf("body", dress.outfit.body).model;
  return kit ? KITS[kit].pack : 0;
}

const boneIndices = (keep: readonly SkierBone[]) => keep.map((b) => SKIER_BONES.indexOf(b));

/** Cut `dress` down to each of `pieces` ahead of the moment it is asked
 * for (`createDressed`'s `keep`): a hit tears several at once. */
export function cutAhead(dress: SkierDress, pieces: readonly (readonly SkierBone[])[]): void {
  const { cut } = cutOf(dress);
  for (const keep of pieces)
    for (const part of [cut.cloth, cut.hard]) keepBones(part, boneIndices(keep));
}

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

/** THE SKIER IN HIS OUTFIT, skinned and ready to pose — or, with `keep`,
 * only what moves with those bones (a piece torn off, `gore-view.ts`). */
export function createDressed(dress: SkierDress, wrap: Wrap, keep?: readonly SkierBone[]): Dressed {
  const group = new THREE.Group();
  group.name = "dressed";
  const bones = SKIER_BONES.map((name) => {
    const b = new THREE.Bone();
    b.name = name;
    group.add(b);
    return b;
  });
  // Bound in the rig's own standing pose, the frame the loom cut him in.
  const bind = bindPose().frames;
  SKIER_BONES.forEach((name, i) => setBone(bones[i], bind[name]));
  // The modelled kit's SPRING BONES after the rig's own, bound with the
  // chest's axes at their heads (`player-model.ts`).
  const { model, cut } = cutOf(dress);
  const kit = model ? KITS[model.kit] : null;
  const springs = model && kit ? createSprings(bind, model.heads, kit.springs) : null;
  const fx =
    model && kit
      ? kit.springs.map((s) => {
          const b = new THREE.Bone();
          b.name = s.name;
          group.add(b);
          setBone(b, { ...bind.chest, head: model.heads[s.name], length: s.length });
          return b;
        })
      : [];
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([...bones, ...fx]);

  const ghost = !!dress.ghost;
  const flutter = flutterUniforms();
  const kept = keep && boneIndices(keep);
  const geos = [cut.cloth, cut.hard].map((part) =>
    geometryOf(kept ? keepBones(part, kept) : part, ghost),
  );
  const mats = [
    wrap(
      // Both sides of the cloth: a hem, a cuff and a collar are open, and
      // a lens under one sees the inside of the garment, not the snow
      // through it.
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: kit?.rough ?? 0.78,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
      "skier-cloth",
    ),
    wrap(
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.15 }),
      "skier-hard",
    ),
  ];
  if (kit) withFlutter(mats[0], flutter, kit.wind);
  const meshes = geos.map((g, i) => {
    const m = new THREE.SkinnedMesh(g, mats[i]);
    m.name = i === 0 ? "skier-cloth" : "skier-hard";
    m.bind(skeleton, new THREE.Matrix4());
    m.castShadow = true;
    m.receiveShadow = true;
    // A skinned mesh's bound is its bind pose's; the skier is small and on
    // screen whenever he matters.
    m.frustumCulled = false;
    m.visible = (g.index?.count ?? 1) > 0;
    group.add(m);
    return m;
  });

  let lastFrames = bind;
  const lay = (frames: Record<SkierBone, BoneFrame>, cut: Collapse | null | undefined): void => {
    lastFrames = frames;
    SKIER_BONES.forEach((name, i) => {
      const b = bones[i];
      setBone(b, frames[name]);
      const at = cut?.bones.get(name);
      if (at) {
        b.position.set(at.x, at.y, at.z);
        b.scale.setScalar(1e-4);
      } else if (name === "head" && cut?.crush) {
        const k = cut.crush;
        b.scale.set(1 + 0.35 * k, 1 - 0.45 * k, 1 + 0.25 * k);
      } else b.scale.setScalar(1);
    });
    if (!springs) return;
    // On the run's clock (`setPlayerClock`), the figure's place brought up
    // to date here: a lab poses him without drawing a frame.
    const now = playerNow();
    group.updateWorldMatrix(true, false);
    const swung = springs.step(frames, group.matrixWorld, now);
    const torn = cut?.bones.get("chest");
    fx.forEach((b, i) => {
      setBone(b, swung.frames[i]);
      if (torn) {
        b.position.set(torn.x, torn.y, torn.z);
        b.scale.setScalar(1e-4);
      } else b.scale.setScalar(1);
    });
    flutter.uFlow.value.set(swung.flow.x, swung.flow.y, swung.flow.z);
    flutter.uFlTime.value = now;
    flutter.uFloat.value = swung.float;
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
    cloth: geos[0],
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      skeleton.dispose();
    },
  };
}
