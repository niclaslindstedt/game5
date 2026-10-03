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
//     edge, and raised toward the body by the tuck's drop — and ON THE
//     SNOW (`ski-stand.ts`): the body drawn turned about its feet rather
//     than its centre of gravity, the inside ski lifted toward him and the
//     outside let down, so he inclines over two skis on the snow and never
//     rolls the outside one up into the air.
//   * THE SKIER (`skier-figure.ts`), hung on the points `skier-pose.ts`
//     works out: his boots are the skis' boots, his hips angulated inside
//     the turn by what the engine reports, folded into the tuck, his poles
//     in his hands — planted at a crawl, tucked under his arms at speed.
//   * ONE DRAW: every opaque part is merged into a single vertex-coloured
//     mesh (`posed-merge.ts`) and re-posed in place, so four skiers of forty
//     parts each are four draws and four shadow casts.
//
// THE HEADLAMP (`headlamp.ts`) on the brow of his helmet, on a band round
// the crown, hung on the head's frame so it is on whichever helmet is
// drawn; a draw of its own, since its lens is a lamp, not paint. After
// dark it and the finish arena's floods (`gates.ts`) are the night's lights.
//
// Every pair is drawn in its own topsheet (`ski-topsheets.ts`) — a pair is
// sold in one — and every skier in his own outfit (`outfit.ts`): the
// player's as dressed on the DRESS card, each rival's his slot's
// (`SLOT_DRESS`), his jacket in the slot's colour so the minimap's dot is
// the jacket a player sees.

import * as THREE from "three";
import {
  TUNING,
  seatedShare,
  type SkiSpec,
  type SkierState,
  type Thrown,
  type TrickPose,
} from "@engine";

import { buildHeadlamp, type Headlamp } from "./headlamp.ts";
import type { Pose } from "./interp.ts";
import { mergePosed } from "./posed-merge.ts";
import { buildGear, cuffHeight, gearLift, skiTilt } from "./ski-gear.ts";
import { SKI_LOOKS, lookOf } from "./ski-looks.ts";
import { emptyStand, inclineAt, standOf, type Stand } from "./ski-stand.ts";
import { createChatter, shakeStand, stepChatter } from "./ski-chatter.ts";
import { outfitKey } from "./dress.ts";
import { DEFAULT_OUTFIT, RIVAL_OUTFITS } from "./outfit.ts";
import { PATTERNS, TOPSHEETS, type PatternId, type Topsheet } from "./ski-topsheets.ts";
import { createSkier, type SkierDress, type SkierFigure } from "./skier-figure.ts";
import { attachModels } from "./skier-models.ts";
import {
  createSkierSpring,
  drawnSkiAngle,
  gaitOf,
  leadOf,
  mountsFor,
  pitchHeld,
  stepSkierSpring,
  type Mounts,
  type SkierPoseInput,
} from "./skier-pose.ts";
import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import { flightRead, flightShape, type FlightGround } from "./skier-flight.ts";
import { CHAIR_SEAT } from "./skier-seat.ts";

/** How long a rider takes to stand up off a chair, s. */
const STAND_UP = 0.35;

export { REST_SAG } from "./ski-gear.ts";

export type SkiStyle = {
  /** The topsheet's paint, and the trim its graphic is cut in. */
  body: number;
  accent: number;
  /** What the skier on the pair wears (`skier-dress.ts`). */
  skier: SkierDress;
  /** The rest of a topsheet (`ski-topsheets.ts`), when the style carries
   * one: the sidewalls' and bindings' dark, the boots' shell, the poles'
   * shaft, the pattern. Left out, the sidewalls and bindings are black, the
   * boots black, the poles alloy, and the pattern the pair's own. */
  panel?: number;
  boot?: number;
  pole?: number;
  pattern?: PatternId;
};

/** A pair in a topsheet with a skier on it in `skier`'s outfit. */
export function styleIn(topsheet: Topsheet, skier: SkierDress): SkiStyle {
  return {
    body: topsheet.body,
    accent: topsheet.trim,
    panel: topsheet.panel,
    boot: topsheet.boot,
    pole: topsheet.pole,
    pattern: topsheet.pattern,
    skier,
  };
}

/** WHAT EACH START-LINE SLOT'S SKIER WEARS: the player's (slot 0) before
 * they have dressed, then each rival's own (`RIVAL_OUTFITS`). */
export const SLOT_DRESS: readonly SkierDress[] = [
  { outfit: DEFAULT_OUTFIT },
  ...RIVAL_OUTFITS.map(({ tone, ...outfit }) => ({ outfit, tone })),
];

/** A pair in its own topsheet, `skier` on it. */
export function pairStyle(spec: SkiSpec, skier: SkierDress): SkiStyle {
  return styleIn(TOPSHEETS[spec.id], skier);
}

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
    /** In the start gate under the lights. */
    waiting?: boolean,
  ): void;
  setSkierVisible(visible: boolean): void;
  /** THE SNOW HIS FLIGHTS ARE READ OVER (`skier-flight.ts`): the map, and
   * the flight's gravity, m/s² (`flightGravity`) — how high he is and when
   * the snow comes, which stage his fall by. Without one a fall is staged
   * by the time aloft alone. */
  setGround(ground: FlightGround | null, gravity: number): void;
  /** The lamp on his helmet (`headlamp.ts`), lit by the renderer. */
  lamp: Headlamp;
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

/** How far he stands on the snow as drawn, 0..1: the view's eased air, or
 * the engine's flag before the spring has read a ride. */
export function groundOf(skier: SkierState, legs: ReturnType<typeof createSkierSpring>): number {
  if (skier.thrown) return 0;
  return Number.isNaN(legs.hip) ? (skier.airborne ? 0 : 1) : 1 - legs.air;
}

/** The engine's readings as the pose wants them, for one frame —
 * `waiting` in the start gate under the lights; `stand` where the skis
 * stand on the snow (`ski-stand.ts`, worked out off `legs` when left
 * out). */
export function poseInputOf(
  skier: SkierState,
  legs: ReturnType<typeof createSkierSpring>,
  mounts: Mounts,
  trick: TrickPose | null,
  waiting = false,
  stand: Stand = standOf(
    skier,
    groundOf(skier, legs),
    undefined,
    undefined,
    drawnSkiAngle(legs, skier),
  ),
): SkierPoseInput {
  // The inclination the skis are tipped against beyond the world's roll —
  // carried onto the body's own eased roll.
  const onSnow = stand.incline - groundOf(skier, legs) * skier.roll;
  return {
    roll: skier.roll,
    // The hips' shift as his body carries it (eased in the view's spring),
    // or the engine's own before the spring has read a ride.
    hipRight: Number.isNaN(legs.hip) ? skier.hipRight : legs.hip,
    hipAft: skier.hipAft,
    lean: skier.lean,
    steer: skier.steer,
    edge: stand.tilt,
    // The edge and the roll as his body above the boots carries them.
    body: Number.isNaN(legs.hip)
      ? undefined
      : {
          tilt: skiTilt({ edge: legs.edge, roll: legs.roll + onSnow, speed: skier.speed }),
          roll: legs.roll,
        },
    // The upper body's lead into a turn, ahead of the skis' edge.
    lead: leadOf(legs),
    // The skid's pivot as his body carries it (eased in the view's spring).
    skiAngle: drawnSkiAngle(legs, skier),
    crouch: skier.crouch,
    tuck: skier.tuck,
    drop: skier.spec.crouchDrop * skier.crouch,
    lift: stand.lift,
    spread: stand.out,
    fore: stand.fore,
    incline: stand.incline,
    airborne: skier.airborne,
    landing: skier.landing,
    bump: legs.bump,
    // THE POLE PLANT the view times on his turns (`skier-spring.ts`).
    plantAt:
      legs.plantT < legs.plantLength
        ? { side: legs.plantSide, t: legs.plantT / legs.plantLength, weight: legs.plantOk }
        : undefined,
    // THE GAIT at a crawl — the skate and the double pole — in time with
    // the engine's own push (`poles.ts`).
    // ...how much he works the poles as his arms carry it.
    gait: Number.isNaN(legs.keep) ? gaitOf(skier) : { ...gaitOf(skier), keep: legs.keep },
    // The snow passed since the stroke's plant, as the view kept it.
    poled: Number.isNaN(legs.poledStride) ? undefined : legs.poled,
    air: legs.air,
    jumpLoad: legs.load,
    popped: skier.popped,
    carve: skier.carve,
    skid: skier.skid,
    // THE SAVE his body is making, as the view's spring carries it.
    jolt: legs.jolt,
    // THE TRUNK HELD while the skis rock under him over a bump.
    pitchHeld: pitchHeld(legs, skier.pitch),
    // THE FALL his body is riding, by how far it is.
    flight: flightShape(legs.flight, legs.clock, legs.air),
    trick,
    // ...with his poles, or with nothing in his hands (the hard mode).
    poles: skier.poles,
    mounts,
    // IN THE START GATE under the lights, as his body has settled into it
    // — or, before the spring has read a ride, as the lights say.
    ready: Number.isNaN(legs.hip) ? (waiting ? 1 : 0) : legs.ready,
    // STOOD STILL, he waits alive: his own clock, faded in below a walk.
    idle: {
      t: legs.clock,
      still: Math.max(0, 1 - skier.speed / 1.5) * Math.max(0, 1 - skier.drive * 4),
    },
  };
}

/** How far the drawn skis stand folded up toward him off the engine's
 * legs, m, the two skis' mean (`gearLift`) — what the body's spring is
 * handed so the legs never fold or stretch past their reach. */
export function legsLift(skier: SkierState): number {
  const lift = gearLift(skier);
  return (lift[0] + lift[1]) / 2;
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
  const boot = mat({ color: style.boot ?? 0x121316, roughness: 0.55 });
  const alloy = mat({ color: 0x9aa1a9, roughness: 0.3, metalness: 0.8 });
  // The base: the black sintered sheet a ski runs on, with a little sheen.
  const base = mat({ color: 0x0c0d10, roughness: 0.45, metalness: 0.2 });
  const pattern = PATTERNS[style.pattern ?? TOPSHEETS[spec.id].pattern];

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
  const figure: SkierFigure = createSkier(style.skier, wrap, look.pole);
  root.add(figure.group);
  // His own clock starts at his kit's own offset: four on a start line
  // breathe and shift their weight out of step.
  const kit = outfitKey(style.skier.outfit, style.skier.tone);
  let seed = 0;
  for (let i = 0; i < kit.length; i++) seed = (seed * 31 + kit.charCodeAt(i)) % 997;
  const legs = createSkierSpring(seed / 31);
  let fall: { ground: FlightGround; gravity: number } | null = null;

  // THE WHOLE PAIR AND ITS SKIER AS ONE DRAW (`posed-merge.ts`): every
  // opaque part keeps its place in the tree for the posing and is drawn
  // through one vertex-coloured mesh, each part a bone of it.
  const parts: THREE.Mesh[] = [];
  // The dressed skin is skinned on the rig and drawn apart.
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !(o instanceof THREE.SkinnedMesh)) parts.push(o);
  });
  const merged = mergePosed(
    root,
    parts,
    mat({ vertexColors: true, roughness: 0.55, metalness: 0.05 }, "skis-merged"),
  );

  // THE MODELLED SKIS, where this build draws them (`skier-models.ts`):
  // the code's skis collapsed out of the merged draw and the model posed
  // beside them. The merged draw itself stays: it is the one draw the
  // code's poles reach the screen through.
  const models = attachModels({ spec, root, skis: style, wrap });
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
  merged.update();
  // Hung after the merge, so it stays out of the one draw: a lamp of its
  // own, on whichever helmet he wears.
  const lamp = buildHeadlamp(figure.head, mat, (g) => {
    geos.push(g);
    return g;
  });

  const toRoot = new THREE.Quaternion();
  const thrown = new THREE.Quaternion();
  const stand = emptyStand();
  // THE CHATTER as drawn (`ski-chatter.ts`): the snow passed and the shake.
  const chatter = createChatter();
  const flap = new THREE.Quaternion();
  const shook = new THREE.Euler();
  const pivot = new THREE.Vector3();
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
  // How seated he is drawn, eased down as he stands off a chair.
  let seated = 0;

  return {
    root,
    lamp,
    casters: [merged.mesh, ...figure.skin, ...(models?.meshes ?? [])],
    bound(out) {
      out.center.copy(bound.center);
      root.localToWorld(out.center);
      out.radius = bound.radius;
      return out;
    },
    pose(skier, at, sink, trick = null, dt = 0, body, waiting = false) {
      // IN A GONDOLA'S CABIN he is out of sight, skis and all.
      root.visible = !(skier.lift?.kind === "gondola" && skier.lift.phase === "ride");
      root.quaternion.set(at.q.x, at.q.y, at.q.z, at.q.w);
      const off = body === undefined ? skier.thrown : body;
      // His legs' spring first: how far he stands on the snow is its own.
      if (!off)
        stepSkierSpring(
          legs,
          skier.vy,
          skier.airborne,
          dt,
          skier.jumpLoad / TUNING.jump.full,
          skier,
          waiting,
          fall
            ? {
                read: skier.airborne
                  ? flightRead(fall.ground, skier, skier.spec.cogHeight, fall.gravity)
                  : null,
                gravity: fall.gravity,
              }
            : undefined,
          legsLift(skier),
        );
      // THE PAIR ON THE SNOW (`ski-stand.ts`): the body turned about its
      // feet, so the drawn origin goes inside the turn by the legs' length
      // times the sine of the inclination.
      const angle = drawnSkiAngle(legs, skier);
      const ground = off ? 0 : groundOf(skier, legs);
      standOf(skier, ground, stand, inclineAt(skier, at.q), angle);
      // ...and SHAKEN at speed: each ski hopping, flapping and rocking on
      // the snow passing under it, the knees taking it (the boots stand on
      // the same stand).
      stepChatter(chatter, skier, dt);
      shakeStand(stand, skier, ground, chatter);
      pivot.set(stand.pivot.x, stand.pivot.y, 0).applyQuaternion(root.quaternion);
      root.position.set(at.x + pivot.x, at.y - sink + pivot.y, at.z + pivot.z);
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
        bound.radius = BOUND + figure.group.position.length();
      } else {
        if (bound.radius !== BOUND) {
          figure.group.position.set(0, 0, 0);
          figure.group.quaternion.identity();
          bound.radius = BOUND;
        }
        const input = poseInputOf(skier, legs, mounts, trick, waiting, stand);
        // ON A CHAIR (`skier-seat.ts`): sat on its seat, and stood up off it
        // over a moment once the chair lets him go.
        const sat = skier.lift?.kind === "chair" && skier.lift.phase !== "lead";
        const share = sat ? seatedShare(skier.lift!) : 0;
        seated = share >= seated ? share : Math.max(share, seated - dt / STAND_UP);
        const seat = seated > 0 ? { share: seated, y: TUNING.lift.seat - CHAIR_SEAT } : null;
        figure.pose(input, seat);
      }
      // The skis drawn on the skid's pivot as his body carries it — the
      // figure's boots stand on the same one.
      gear.pose(skier, sink, angle, stand);
      // The chatter's flap and rock on the code's skis, about each ski's
      // own across and length (tips up a negative turn about +x).
      for (let i = 0; i < 2; i++) {
        if (stand.pitch[i] === 0 && stand.rock[i] === 0) continue;
        gear.skis[i].quaternion.multiply(
          flap.setFromEuler(shook.set(-stand.pitch[i], 0, -stand.rock[i])),
        );
      }
      models?.pose(skier, sink, dt, angle, stand);
      merged.update();
    },
    poseSkier(input) {
      const full = { mounts, ...input };
      figure.pose(full);
      merged.update();
    },
    setGround(ground, gravity) {
      fall = ground ? { ground, gravity } : null;
    },
    setSkierVisible(v) {
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
