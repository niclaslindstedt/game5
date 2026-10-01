// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKIER ON HIS SKIS AS DRAWN — every pair built off TWO sources: its
// spec (`defs/skis.ts`: the length, the widths, the sidecut, the stance and
// the mount — where the physics' six stations stand — and how tall the
// skier stands over the snow) and its class's TRACED LOOK (`ski-looks.ts`:
// the shovel, the tail, the camber, the binding, the boot and the poles,
// taken off a studio photograph of a real pair of the class). Everything in
// the engine's own body frame — x right, y up, z forward, the origin at the
// centre of gravity of skier and skis together — so a drawn ski stands
// where its probes are, and a drawn boot where the leg's spring hangs.
//
//   * THE SKIS (`ski-gear.ts`) — two lofted beams with a sidecut, on their
//     bindings, the boots clamped in them, posed every frame off the engine:
//     lifted by each leg's compression, pivoted by the skid, tipped onto the
//     edge, and raised toward the body by the tuck's drop.
//   * THE SKIER (`skier-figure.ts`), hung on the points `skier-pose.ts`
//     works out: his boots are the skis' boots, his hips angulated inside
//     the turn by what the engine reports, folded into the tuck, his poles
//     in his hands — planted at a crawl, tucked under his arms at speed.
//   * ONE DRAW: every opaque part is merged into a single vertex-coloured
//     mesh (`posed-merge.ts`) and re-posed in place, so four skiers of forty
//     parts each are four draws and four shadow casts.
//
// There are no lamps on a skier. The night's lights are the finish arena's
// floods and the piste's edge-pole reflectors (`gates.ts`), never the
// figure's.
//
// Four colour schemes (`SKI_STYLES`), one per start-line slot, their paint
// read off `skier-colours.ts` so the minimap's dot is the same colour.

import * as THREE from "three";
import { TUNING, type SkiSpec, type SkierState, type Thrown, type TrickPose } from "@engine";

import type { Pose } from "./interp.ts";
import { mergePosed } from "./posed-merge.ts";
import { buildGear, cuffHeight, gearLift, skiTilt } from "./ski-gear.ts";
import { SKI_LOOKS, lookOf } from "./ski-looks.ts";
import { PATTERNS, TOPSHEETS, type PatternId, type Topsheet } from "./ski-topsheets.ts";
import { SKIER_BODY } from "./skier-colours.ts";
import { createSkier, type SkierFigure, type SkierStyle } from "./skier-figure.ts";
import { attachModels } from "./skier-models.ts";
import {
  createSkierSpring,
  gaitOf,
  mountsFor,
  ragdollPose,
  skierPose,
  stepSkierSpring,
  type BodyFrame,
  type Mounts,
  type SkierPoseInput,
} from "./skier-pose.ts";

export { REST_SAG } from "./ski-gear.ts";

export type SkiStyle = {
  /** The topsheet's paint, and the trim its graphic is cut in. */
  body: number;
  accent: number;
  skier: SkierStyle;
  /** The rest of a topsheet (`ski-topsheets.ts`), when the style carries
   * one: the sidewalls' and bindings' dark, the boots' shell, the poles'
   * shaft, the pattern. Left out, the sidewalls and bindings are black, the
   * boots the kit's own, the poles alloy, and the pattern the pair's own
   * first topsheet's. */
  panel?: number;
  boot?: number;
  pole?: number;
  pattern?: PatternId;
};

/** A start-line slot's style dressed in a topsheet: the paint, the trim,
 * the sidewalls, the boots, the poles and the pattern are the topsheet's;
 * the skier's kit stays the slot's. */
export function styleIn(style: SkiStyle, topsheet: Topsheet): SkiStyle {
  return {
    ...style,
    body: topsheet.body,
    accent: topsheet.trim,
    panel: topsheet.panel,
    boot: topsheet.boot,
    pole: topsheet.pole,
    pattern: topsheet.pattern,
  };
}

export const SKI_STYLES: SkiStyle[] = [
  // The player's: the gate red, and a racer's kit to match — a red suit
  // with a black yoke, black pants, a black helmet under a red stripe,
  // gold-mirrored goggles.
  {
    body: SKIER_BODY[0],
    accent: 0xf4f4f4,
    skier: {
      jacket: 0xc92a1c,
      accent: 0x15171b,
      pants: 0x15171b,
      helmet: 0x1b1d21,
      visor: 0xd9a21a,
      peak: 0xe8412c,
      skin: 0xc68863,
    },
  },
  {
    body: SKIER_BODY[1],
    accent: 0xf2f5f8,
    skier: {
      jacket: 0x2a6fd6,
      accent: 0xf2f2f2,
      pants: 0x1a1d24,
      helmet: 0xf2f2f2,
      visor: 0x6fb4e8,
      peak: 0x2a6fd6,
      skin: 0xe8b896,
    },
  },
  {
    body: SKIER_BODY[2],
    accent: 0x151515,
    skier: {
      jacket: 0x252525,
      accent: 0xf2bf22,
      pants: 0x151515,
      helmet: 0xf2bf22,
      visor: 0x2b2f36,
      peak: 0x151515,
      skin: 0x8a5a3c,
    },
  },
  {
    body: SKIER_BODY[3],
    accent: 0x0e1a14,
    skier: {
      jacket: 0x0f6b48,
      accent: 0x0e1a14,
      pants: 0x1b1f1d,
      helmet: 0x0e1a14,
      visor: 0xd96a2b,
      peak: 0x0f6b48,
      skin: 0xb07650,
    },
  },
];

export type SkisModel = {
  root: THREE.Group;
  /** Pose from the engine's state, drawn at `at` (the interpolated place);
   * `sink` lowers the skis into the snow by the drawn furrow's extra depth,
   * m. `trick` is a tricks run's grab held in the air, if any; `dt` is the
   * frame's, s — the skier's body on its legs moves with it (0 holds it);
   * `body` the skier thrown as drawn between two steps (`sampleBody`),
   * `skier.thrown` as stepped when not given. */
  pose(
    skier: SkierState,
    at: Pose,
    sink: number,
    trick?: TrickPose | null,
    dt?: number,
    body?: Thrown | null,
  ): void;
  setSkierVisible(visible: boolean): void;
  /** Every mesh that draws the pair and its skier — what casts. */
  casters: THREE.Mesh[];
  /** The draw's bound in the world, at the last pose: grown while the
   * skier lies away from his skis. */
  bound(out: THREE.Sphere): THREE.Sphere;
  /** Lay the skier in a pose handed in whole rather than read off the
   * engine — the skis lab's (`tools/skis-harness.ts`), which holds him at
   * an exact moment. */
  poseSkier(input: SkierPoseInput): void;
  dispose(): void;
};

/** The mounts a pair carries its skier on (`skier-pose.ts`): its stance
 * and centre of gravity, its boots' cuff over the snow, its poles. */
export function mountsOf(spec: SkiSpec): Mounts {
  const look = lookOf(spec);
  return mountsFor(spec, cuffHeight(look) + 0.02, look.pole.length);
}

/** Whether `o` hangs anywhere under `group`. */
function isUnder(o: THREE.Object3D, group: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === group) return true;
  return false;
}

/** The engine's readings as the pose wants them, for one frame. */
export function poseInputOf(
  skier: SkierState,
  legs: ReturnType<typeof createSkierSpring>,
  mounts: Mounts,
  trick: TrickPose | null,
): SkierPoseInput {
  return {
    roll: skier.roll,
    hipRight: skier.hipRight,
    hipAft: skier.hipAft,
    lean: skier.lean,
    steer: skier.steer,
    edge: skiTilt(skier),
    skiAngle: skier.skiAngle,
    crouch: skier.crouch,
    drop: skier.spec.crouchDrop * skier.crouch,
    lift: gearLift(skier),
    airborne: skier.airborne,
    landing: skier.landing,
    bump: legs.bump,
    // THE GAIT at a crawl — the skate and the double pole — in time with
    // the engine's own push (`poles.ts`).
    gait: gaitOf(skier),
    air: legs.air,
    jumpLoad: legs.load,
    popped: skier.popped,
    carve: skier.carve,
    skid: skier.skid,
    trick,
    mounts,
    // STOOD STILL, he waits alive: his own clock, faded in below a walk.
    idle: {
      t: legs.clock,
      still: Math.max(0, 1 - skier.speed / 1.5) * Math.max(0, 1 - skier.drive * 4),
    },
  };
}

export function createSkisModel(
  spec: SkiSpec,
  style: SkiStyle,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
): SkisModel {
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const mat = (params: THREE.MeshStandardMaterialParameters, name = "skis") => {
    const m = wrap(new THREE.MeshStandardMaterial(params), name);
    mats.push(m);
    return m;
  };
  const look = SKI_LOOKS[spec.id];
  const paint = mat({ color: style.body, roughness: 0.28, metalness: 0.05 });
  const trim = mat({ color: style.accent, roughness: 0.35 });
  const black = mat({ color: style.panel ?? 0x1c1f23, roughness: 0.7 });
  const boot = mat({ color: style.boot ?? style.skier.pants, roughness: 0.55 });
  const alloy = mat({ color: 0x9aa1a9, roughness: 0.3, metalness: 0.8 });
  // The base: the black sintered sheet a ski runs on, with a little sheen.
  const base = mat({ color: 0x0c0d10, roughness: 0.45, metalness: 0.2 });
  const pattern = PATTERNS[style.pattern ?? TOPSHEETS[spec.id][0].pattern];

  const add = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D = root) => {
    geos.push(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };

  // THE SKIS, THE BINDINGS AND THE BOOTS, posed off the engine's readings.
  const gear = buildGear(
    spec,
    look,
    root,
    { add, keep: (g) => geos.push(g), paint, trim, black, boot, alloy, base },
    pattern,
  );

  // THE SKIER, in the body frame — his feet go where the boots go.
  const mounts = mountsOf(spec);
  const figure: SkierFigure = createSkier(
    { ...style.skier, pole: style.pole ?? style.skier.pole },
    wrap,
    look.pole,
  );
  root.add(figure.group);
  // His own clock starts at his kit's own offset: four on a start line
  // breathe and shift their weight out of step.
  const legs = createSkierSpring((style.skier.jacket % 997) / 31);

  // THE WHOLE PAIR AND ITS SKIER AS ONE DRAW (`posed-merge.ts`): every
  // opaque part keeps its place in the tree for the posing and is drawn
  // through one vertex-coloured mesh, each part a bone of it.
  const parts: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh) parts.push(o);
  });
  const merged = mergePosed(
    root,
    parts,
    mat({ vertexColors: true, roughness: 0.55, metalness: 0.05 }, "skis-merged"),
  );

  // THE MODELLED SKIS AND SKIER, where this build draws them
  // (`skier-models.ts`): the code's drawn parts collapsed out of the merged
  // draw — the figure by hiding its group, the skis by hiding every other
  // part — and the models posed beside them.
  const models = attachModels({
    spec,
    root,
    skis: style,
    skier: style.skier,
    wrap,
  });
  // The merged draw itself stays: it is the one draw the code's parts
  // (the figure, the poles) reach the screen through.
  if (models?.skis) {
    root.traverse((o) => {
      if (
        o instanceof THREE.Mesh &&
        o !== merged.mesh &&
        !isUnder(o, figure.group) &&
        !models.meshes.includes(o)
      ) {
        o.visible = false;
      }
    });
  }
  // The modelled skier carries no poles, so the code figure keeps its
  // group (and the poles in its hands) and hides its body alone.
  if (models?.skier) figure.setBodyVisible(false);
  merged.update();

  const toRoot = new THREE.Quaternion();
  const thrown = new THREE.Quaternion();
  const trunk = new THREE.Matrix4();
  const axis = { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
  const frame: BodyFrame = {
    origin: { x: 0, y: 0, z: 0 },
    x: { x: 1, y: 0, z: 0 },
    y: { x: 0, y: 1, z: 0 },
    z: { x: 0, y: 0, z: 1 },
  };
  // The merged draw's bound: the pair's own, grown while the skier is
  // lying away from it.
  const bound = merged.mesh.geometry.boundingSphere!;
  const BOUND = bound.radius;

  return {
    root,
    casters: [merged.mesh, ...(models?.meshes ?? [])],
    bound(out) {
      out.center.copy(bound.center);
      root.localToWorld(out.center);
      out.radius = bound.radius;
      return out;
    },
    pose(skier, at, sink, trick = null, dt = 0, body) {
      root.position.set(at.x, at.y - sink, at.z);
      root.quaternion.set(at.q.x, at.q.y, at.q.z, at.q.w);
      gear.pose(skier, sink);
      const off = body === undefined ? skier.thrown : body;
      if (off) {
        // THE SKIER THROWN (`crash.ts`): off his skis, his figure hung on
        // the engine's ragdoll — laid in the root's frame at his trunk's
        // own place and turn, so the one merged draw still carries him,
        // and the draw's bound grown to reach him. The skis carry on
        // without him, riderless.
        const p = ragdollPose(off.points, frame);
        toRoot.set(at.q.x, at.q.y, at.q.z, at.q.w).invert();
        figure.group.position
          .set(frame.origin.x - at.x, frame.origin.y - (at.y - sink), frame.origin.z - at.z)
          .applyQuaternion(toRoot);
        trunk.makeBasis(
          axis.x.set(frame.x.x, frame.x.y, frame.x.z),
          axis.y.set(frame.y.x, frame.y.y, frame.y.z),
          axis.z.set(frame.z.x, frame.z.y, frame.z.z),
        );
        thrown.setFromRotationMatrix(trunk);
        figure.group.quaternion.copy(toRoot).multiply(thrown);
        figure.sprawl(p);
        models?.poseSkier(p, figure.group);
        bound.radius = BOUND + figure.group.position.length();
      } else {
        if (bound.radius !== BOUND) {
          figure.group.position.set(0, 0, 0);
          figure.group.quaternion.identity();
          bound.radius = BOUND;
        }
        stepSkierSpring(legs, skier.vy, skier.airborne, dt, skier.jumpLoad / TUNING.jump.full);
        const input = poseInputOf(skier, legs, mounts, trick);
        figure.pose(input);
        models?.poseSkier(skierPose(input), figure.group);
      }
      models?.pose(skier, sink, dt);
      merged.update();
    },
    poseSkier(input) {
      const full = { mounts, ...input };
      figure.pose(full);
      models?.poseSkier(skierPose(full), figure.group);
      merged.update();
    },
    setSkierVisible(v) {
      models?.setSkierVisible(v);
      if (figure.group.visible === v) return;
      figure.group.visible = v;
      merged.update();
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      merged.dispose();
      figure.dispose();
      models?.dispose();
    },
  };
}
