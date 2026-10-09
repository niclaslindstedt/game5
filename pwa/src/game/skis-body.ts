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
  flightGravity,
  type GameState,
  type LoneSki,
  type SkiSpec,
  type SkierState,
  type Thrown,
  type TrickPose,
} from "@engine";

import { buildHeadlamp, type Headlamp } from "./headlamp.ts";
import type { SkierPose } from "./skier-joints.ts";
import { armBreaks, breakArms, createArmSwing, SWING, type ArmBreak } from "./skier-broken.ts";
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
import { doorReach, reachPose } from "./door-reach.ts";
import { launchGait } from "./skier-gait.ts";
import { kickStand, slalomStart } from "./slalom-start.ts";
import { attachModels } from "./skier-models.ts";
import {
  createSkierSpring,
  drawnSkiAngle,
  gaitOf,
  leadOf,
  mountsFor,
  pitchHeld,
  restSkierSpring,
  stepSkierSpring,
  type Mounts,
  type SkierPoseInput,
} from "./skier-pose.ts";
import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import type { BoneFrame, SkierBone } from "./skier-rig.ts";
import { fetchMove, movePose } from "./party-pose.ts";
import { bootOn, buildWalkBoots } from "./town-boots.ts";
import { skiLift, streetOver, townLift, townMove, townPose } from "./town-pose.ts";
import { LOOSE } from "./trail-stamp.ts";
import { flightRead, flightShape, type FlightGround } from "./skier-flight.ts";
import {
  CABIN_FLOOR,
  CHAIR_SEAT,
  createSeatEase,
  easeSeat,
  lookBack,
  seatedPose,
  type Seat,
} from "./skier-seat.ts";
import type { Board } from "./skier-sled.ts";
import {
  createDangle,
  resetDangle,
  stepDangle,
  swingLegs,
  swingOf,
  type Perch,
} from "./skier-dangle.ts";
import { createPerchReact, feelOf, resetPerchReact, stepPerchReact } from "./skier-perch.ts";
import { ridingOf, widenStand, type Riding } from "./technique-pose.ts";

/** How long the acceleration a broken arm feels is eased over, s — the
 * engine's steps' jitter taken out of its swing. */
const FELT_EASE = 0.1;

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

/** The snow the skis are drawn over: the ground a flight is read over and,
 * where the map has it, how packed it is (the loose cover stands on the
 * rest). */
export type SnowGround = FlightGround & { packedAt?(x: number, z: number): number };

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
    /** In the start gate under the lights; `"house"` in a slalom's start
     * house. */
    waiting?: boolean | "house",
  ): void;
  setSkierVisible(visible: boolean): void;
  /** SAT ON A HELICOPTER'S SKID (`heli.ts`): the skid's top in his body
   * frame and what his dangling legs feel there (`skier-dangle.ts`), or
   * null off it — read at the next pose. */
  setPerch(perch: Perch | null): void;
  /** STOOD ON A SNOWMOBILE'S BOARDS (`sled.ts`): his skis and poles on its
   * rack — the pair drawn as his boots alone — his boots on the boards and
   * his hands on the grips (`skier-sled.ts`), or null off it — read at the
   * next pose. */
  setSled(sled: SledStand | null): void;
  /** STOOD IN A HOT AIR BALLOON'S BASKET (`balloon.ts`): his pair racked in
   * its corner (`balloon-basket.ts`) — drawn as his boots alone on its
   * floor — and his hands empty; and WALKING about it (`walk`: how far
   * through his stride, in strides, and his pace, 0 stood … 1 the engine's
   * shuffle), his boots stepped. Read at the next pose. */
  setBasket(on: boolean, walk?: BasketWalk): void;
  /** THE SNOW HIS FLIGHTS ARE READ OVER (`skier-flight.ts`): the map, and
   * the flight's gravity, m/s² (`flightGravity`) — how high he is and when
   * the snow comes, which stage his fall by. Without one a fall is staged
   * by the time aloft alone. */
  setGround(ground: SnowGround | null, gravity: number): void;
  /** THE RUN HE SKIS, read each pose: its map as his flights' ground
   * (`setGround`), the technique he carries himself by and the gate he
   * owes (`technique-pose.ts`). Without one he rides as the free skier. */
  setRun(run: GameState | null): void;
  /** HIS BODY TORN APART (`gore.ts`): the pieces lost (a bit each in
   * `GORE_PIECES`' order) and the skull crushed, 0 … 1 — read at the next
   * pose of a thrown body (`gore-cut.ts`). */
  setGore(lost: number, crush: number): void;
  /** His dressed skin as last posed: its bones' frames in its own group's
   * frame, that group (whose world matrix places them) and its cloth — what
   * the torn pieces are drawn off (`gore-view.ts`). */
  skin(): {
    frames: Record<SkierBone, BoneFrame>;
    group: THREE.Object3D;
    dress: SkierDress;
    cloth: THREE.BufferGeometry;
  };
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

/** HIS STEPS IN A BALLOON'S BASKET (`setBasket`): strides walked, and the
 * pace, 0 stood … 1 a full shuffle. */
export type BasketWalk = { strides: number; pace: number };

/** A stride in the basket: each boot swung this far fore and aft of its
 * place, m, and lifted this far at the swing's top, m, at a full pace — a
 * short shuffle in ski boots on a wicker floor. */
const BASKET_STEP = { swing: 0.17, lift: 0.07 };

/** THE BOOTS STEPPED: each boot of `stand` swung and lifted through the
 * stride, the two half a stride apart. */
function stepBoots(stand: Stand, walk: BasketWalk): void {
  const pace = Math.max(0, Math.min(1, walk.pace));
  if (pace < 0.01) return;
  for (let i = 0; i < 2; i++) {
    const p = (walk.strides + i * 0.5) * Math.PI * 2;
    stand.fore[i] += BASKET_STEP.swing * pace * Math.sin(p);
    stand.lift[i] += BASKET_STEP.lift * pace * Math.max(0, Math.cos(p));
  }
}

/** THE SKIER ON A SNOWMOBILE as his model is handed it: where each boot
 * stands on the boards, across off half his stance, m (his body frame),
 * and the grips, his lean and where his weight hangs (`Board`) — his figure
 * stood over the boards' middle, `board.hang` back from where the engine
 * has his weight. */
export type SledStand = { out: [number, number]; board: Board };

/** The mounts a pair carries its skier on (`skier-pose.ts`): its stance
 * and centre of gravity, its boots' cuff over the snow, its poles. */
export function mountsOf(spec: SkiSpec): Mounts {
  const look = lookOf(spec);
  return mountsFor(spec, cuffHeight(look) + 0.02, look.pole.length);
}

const lifted = [0, 0, 0, 0, 0, 0];
const tipward = new THREE.Vector3();
const upward = new THREE.Vector3();
const rightward = new THREE.Vector3();
/** The body's forward axis, and the turn that stands him over the hill. */
const FORWARD = new THREE.Vector3(0, 0, 1);
const hillTurn = new THREE.Quaternion();

/** A ski let go (`lone-skis.ts`) as a world matrix in the frame the drawn
 * ski is built in: at its boot centre on the base, x to its right, y out
 * of its topsheet, z to its tip. `lift` is how far the drawn snow stands
 * over the engine's ground at a point (the loose cover, `LOOSE`): each end
 * is laid on top of it, never in it — a ski rides up out of the snow. */
export function loneSkiFrame(
  ski: LoneSki,
  out: THREE.Matrix4,
  lift: (x: number, z: number) => number = () => 0,
): THREE.Matrix4 {
  const e = lifted;
  for (let k = 0; k < 6; k++) e[k] = ski.ends[k];
  e[1] += lift(e[0], e[2]);
  e[4] += lift(e[3], e[5]);
  tipward.set(e[0] - e[3], e[1] - e[4], e[2] - e[5]).normalize();
  upward.set(ski.up[0], ski.up[1], ski.up[2]);
  upward.addScaledVector(tipward, -upward.dot(tipward)).normalize();
  rightward.crossVectors(upward, tipward);
  out.makeBasis(rightward, upward, tipward);
  const m = ski.mount;
  return out.setPosition(
    e[3] + (e[0] - e[3]) * m,
    e[4] + (e[1] - e[4]) * m,
    e[5] + (e[2] - e[5]) * m,
  );
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
 * `waiting` in the start gate under the lights (`"house"` in a slalom's
 * start house, and out of it on his one push); `stand` where the skis
 * stand on the snow (`ski-stand.ts`, worked out off `legs` when left
 * out); `riding` how he rides (`technique-pose.ts`'s `ridingOf`: the free
 * skier, at no gate, when left out). */
export function poseInputOf(
  skier: SkierState,
  legs: ReturnType<typeof createSkierSpring>,
  mounts: Mounts,
  trick: TrickPose | null,
  waiting: boolean | "house" = false,
  stand: Stand = standOf(
    skier,
    groundOf(skier, legs),
    undefined,
    skier.incline + (Number.isNaN(legs.hip) ? 0 : legs.hill),
    drawnSkiAngle(legs, skier),
  ),
  riding?: Riding,
): SkierPoseInput {
  // A slalom's start house: the slalom start clip, in it and out of it.
  const clip = slalomStart(waiting === "house", skier.launch);
  // The inclination the skis are tipped against beyond the world's roll —
  // carried onto the body's own eased roll.
  // On his platforms the body is drawn stood over the hill (`hillLean`):
  // a roll of its own on top of the engine's.
  const hill = Number.isNaN(legs.hip) ? 0 : legs.hill;
  const roll = skier.roll + hill;
  const onSnow = stand.incline - groundOf(skier, legs) * roll;
  return {
    roll,
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
          tilt: skiTilt({ edge: legs.edge, roll: legs.roll + hill + onSnow, speed: skier.speed }),
          roll: legs.roll + hill,
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
    sidestep: Number.isNaN(legs.hip) ? skier.sidestep : legs.platform,
    // RIDING SWITCH: looking back over the shoulder his body has turned to
    // — or, waiting for a chair or a T-bar, over his inside one for it.
    switched: legs.back * legs.backSide + lookBack(skier.lift),
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
    // Out of a slalom's start house, his one push is the whole gait.
    gait:
      launchGait(skier.launch, TUNING.start.push) ??
      (Number.isNaN(legs.keep) ? gaitOf(skier) : { ...gaitOf(skier), keep: legs.keep }),
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
    // HOW HE RIDES: his technique's row, the block at the gate he owes, and
    // how far he has been edging lately (what tells an edge change).
    style: riding?.style,
    block: riding?.block,
    swing: Number.isNaN(legs.swing) ? undefined : legs.swing,
    mounts,
    // IN THE START GATE under the lights, as his body has settled into it
    // — or, before the spring has read a ride, as the lights say.
    ready: clip ? clip.weight : Number.isNaN(legs.hip) ? (waiting ? 1 : 0) : legs.ready,
    house: clip?.shape,
    // STOOD STILL, he waits alive: his own clock, faded in below a walk.
    idle: {
      t: legs.clock,
      // ...but not while he steps his skis round on the spot.
      still:
        Math.max(0, 1 - skier.speed / 1.5) * Math.max(0, 1 - skier.drive * 4) * (1 - legs.stepping),
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
  let fall: { ground: SnowGround; gravity: number } | null = null;
  let run: GameState | null = null;
  // How far the drawn snow stands over the engine's ground — the loose
  // cover on powder, none on the groomer — for the skis let go to lie on.
  const cover = (x: number, z: number): number =>
    fall?.ground.packedAt ? LOOSE * (1 - fall.ground.packedAt(x, z)) : 0;
  // ...and over nothing at all, stood in a cabin's rack.
  const noCover = (): number => 0;
  // ...and in town, how far the figure and the pair he carries are stood
  // up onto the drawn street (`townLift`, `streetOver`).
  let townCover = 0;
  let townFigure = 0;

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
  // THE PAIR RACKED (on a snowmobile, `setSled`): every part of the skis
  // that is not a boot — the skis, the bindings, the plates — hidden, the
  // code's (out of the merged draw) or the model's (each material its own
  // mesh), so he stands on the boards in his boots.
  const skiParts: THREE.Mesh[] = [];
  if (models?.skis) {
    for (const m of models.meshes) {
      const named = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => x.name);
      if (!named.includes("boot")) skiParts.push(m);
    }
  } else {
    for (const g of gear.skis) {
      g.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material !== boot) skiParts.push(o);
      });
    }
  }
  const rack = (on: boolean): void => {
    if (on === racked) return;
    racked = on;
    for (const m of skiParts) m.visible = !on;
  };
  // IN TOWN (`town.ts`) the boots are on his feet and the pair on his
  // shoulder without them: the shells out of the skis' bindings (the
  // code's, out of the merged draw, or the model's), and a pair of boots
  // of their own on the figure's feet (`walkBoots`).
  const bootParts: THREE.Mesh[] = [];
  if (models?.skis) {
    for (const m of models.meshes) {
      const named = (Array.isArray(m.material) ? m.material : [m.material]).map((x) => x.name);
      // The buckles share the aluminium with the brakes and the lever, so
      // the metal goes too: at the shoulder those are the least missed.
      if (named.includes("boot") || named.includes("aluminium")) bootParts.push(m);
    }
  } else {
    for (const g of gear.skis) {
      g.traverse((o) => {
        if (o instanceof THREE.Mesh && (o.material === boot || o.material === alloy)) {
          bootParts.push(o);
        }
      });
    }
  }
  const walkBoots = buildWalkBoots(look, boot, alloy, (g) => {
    geos.push(g);
    return g;
  });
  for (const b of walkBoots) figure.group.add(b);
  let unbooted = false;
  const unboot = (on: boolean): void => {
    if (on === unbooted) return;
    unbooted = on;
    for (const m of bootParts) m.visible = !on;
    for (const b of walkBoots) b.visible = on;
  };
  // Hung after the merge, so it stays out of the one draw: a lamp of its
  // own, on whichever helmet he wears.
  const lamp = buildHeadlamp(figure.head, mat, (g) => {
    geos.push(g);
    return g;
  });

  // HIS BODY TORN APART (`setGore`).
  let goreLost = 0;
  let goreCrush = 0;
  const toRoot = new THREE.Quaternion();
  const thrown = new THREE.Quaternion();
  // The skis let go: each one's place in the world, the root's inverse,
  // and the pair's root as it would stand for each.
  const lies = [new THREE.Matrix4(), new THREE.Matrix4()];
  const pairAt = [new THREE.Matrix4(), new THREE.Matrix4()];
  const toLocal = new THREE.Matrix4();
  const laid = new THREE.Matrix4();
  const restAt = new THREE.Matrix4();
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
  // How seated he is drawn, eased down as he stands off a chair, and how
  // far sat back onto a T-bar, eased off as it lets go (`easeSeat`).
  const seatEase = createSeatEase();
  // The helicopter's skid he is sat on, if any (`setPerch`), and his legs
  // dangling off it (`skier-dangle.ts`).
  let perch: Perch | null = null;
  // The snowmobile's boards he stands on, if any (`setSled`), and whether
  // his pair is drawn racked — his boots alone.
  let sled: SledStand | null = null;
  let racked = false;
  // In a balloon's basket (`setBasket`): his pair racked, his hands empty.
  let basket = false;
  let basketWalk: BasketWalk | null = null;
  let lastPerch: number | null = null;
  const dangle = createDangle();
  const react = createPerchReact();
  // HIS BROKEN ARMS swinging from their breaks (`skier-broken.ts`), and the
  // acceleration they feel his body's, eased — the velocity it was taken
  // off a frame ago.
  const arms = createArmSwing();
  const felt = { x: 0, y: 0, z: 0 };
  let lastV: { x: number; y: number; z: number } | null = null;
  const feltBody = new THREE.Vector3();
  const toBody = new THREE.Quaternion();
  const reachAt = new THREE.Vector3();
  // Whether his legs' spring has been set back to rest since he was thrown.
  let rested = false;

  /** The pose made over for his broken arms, swung by `dt` s under the
   * gravity they feel: g less his acceleration, in his body's frame. */
  function broken(
    skier: SkierState,
    breaks: [ArmBreak | null, ArmBreak | null],
    dt: number,
  ): (p: SkierPose) => SkierPose {
    if (dt > 0 && lastV) {
      let ax = (skier.vx - lastV.x) / dt;
      let ay = (skier.vy - lastV.y) / dt;
      let az = (skier.vz - lastV.z) / dt;
      const a = Math.hypot(ax, ay, az);
      if (a > SWING.most) [ax, ay, az] = [ax, ay, az].map((v) => (v * SWING.most) / a);
      const k = 1 - Math.exp(-dt / FELT_EASE);
      felt.x += (ax - felt.x) * k;
      felt.y += (ay - felt.y) * k;
      felt.z += (az - felt.z) * k;
    }
    lastV = { x: skier.vx, y: skier.vy, z: skier.vz };
    feltBody
      .set(-felt.x, -9.81 - felt.y, -felt.z)
      .applyQuaternion(toBody.copy(root.quaternion).invert());
    const g = { x: feltBody.x, y: feltBody.y, z: feltBody.z };
    return (p) => breakArms(p, breaks, arms, dt, g);
  }

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
      root.quaternion.set(at.q.x, at.q.y, at.q.z, at.q.w);
      const off = body === undefined ? skier.thrown : body;
      // ON HIS FEET after a buzzed fall (`buzz.ts`'s fetch): up, walking to
      // his skis, picking them up and back into the bindings.
      // ...or IN TOWN, his skis on his shoulder (`town.ts`).
      const town = off ? null : (skier.town ?? null);
      const afoot = off ? null : (skier.fetch ?? town);
      // His legs' spring first: how far he stands on the snow is its own —
      // and thrown, they carry nothing, so he is stood back up on them at
      // rest.
      if (off || afoot) {
        if (!rested) restSkierSpring(legs);
        rested = true;
      } else {
        rested = false;
        stepSkierSpring(
          legs,
          skier.vy,
          skier.airborne,
          dt,
          skier.jumpLoad / TUNING.jump.full,
          skier,
          waiting !== false,
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
      }
      // THE PAIR ON THE SNOW (`ski-stand.ts`): the body turned about its
      // feet, so the drawn origin goes inside the turn by the legs' length
      // times the sine of the inclination.
      // Hanging off a skid the skis are neither pivoted nor edged.
      const hung = perch !== null && !off && !afoot;
      const boarded = sled !== null && !off && !afoot;
      // IN A GONDOLA'S CABIN his skis ride in the rack on its door — the
      // pair itself, placed there (`lift-skis.ts`), or out of sight.
      const cabin = skier.lift?.kind === "gondola" && skier.lift.phase === "ride" && !afoot;
      const racked = cabin ? (skier.lift?.skis ?? null) : null;
      const inBasket = basket && !off && !afoot;
      // Thrown with no skis let go (off a snowmobile) his pair is on its
      // rack, and he lies in his boots.
      const bare = off !== null && off.skis.length === 0;
      rack(boarded || (cabin && !racked) || inBasket || bare);
      unboot(town !== null);
      const angle = hung ? 0 : drawnSkiAngle(legs, skier);
      const ground = off || afoot ? 0 : groundOf(skier, legs);
      // ON HIS PLATFORMS across a steep face, stood over the hill: the body
      // turned about his feet toward it (`hillLean`), as an inclination
      // the skis stand under.
      const hill = off ? 0 : legs.hill;
      if (hill !== 0) root.quaternion.multiply(hillTurn.setFromAxisAngle(FORWARD, -hill));
      standOf(skier, ground, stand, inclineAt(skier, at.q) + hill, angle);
      if (hung) stand.tilt = 0;
      // ...and SHAKEN at speed: each ski hopping, flapping and rocking on
      // the snow passing under it, the knees taking it (the boots stand on
      // the same stand).
      stepChatter(chatter, skier, dt);
      shakeStand(stand, skier, hung ? 0 : ground, chatter);
      // ...and out of a slalom's start house, the heels kicked.
      kickStand(stand, skier.launch);
      // ...and walking about a balloon's basket, his boots stepped.
      if (inBasket && basketWalk) stepBoots(stand, basketWalk);
      // HOW HE RIDES (`technique-pose.ts`): his technique's own stance —
      // never on the skid, where his legs hang.
      const riding = run && !hung ? ridingOf(run, skier) : undefined;
      if (riding) widenStand(stand, riding.style.stance, angle, skier.skid, skier.speed);
      // ON THE BOARDS: a boot on each, his figure stood over their middle
      // (`skier-sled.ts` hangs his weight where the engine has it).
      if (boarded) for (let i = 0; i < 2; i++) stand.out[i] += sled!.out[i];
      const hang = boarded ? sled!.board.hang : null;
      pivot
        .set(stand.pivot.x - (hang?.x ?? 0), stand.pivot.y, -(hang?.z ?? 0))
        .applyQuaternion(root.quaternion);
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
        figure.sprawl(p, goreLost, goreCrush);
        bound.radius = BOUND + figure.group.position.length();
      } else if (afoot) {
        // Laid in the root's own frame (stood upright, facing the way he
        // walks), the snow under his boots.
        // In town, stood on the street as it is drawn (`townLift`).
        const lifted = town && run ? townLift(town, run.level, at.x, at.z) : 0;
        townCover = town && run ? streetOver(run.level, at.x, at.z) : 0;
        townFigure = lifted;
        const snow =
          (fall ? fall.ground.groundAt(at.x, at.z) - root.position.y : -spec.cogHeight) + lifted;
        const p = town
          ? townPose(townMove(town, skier), snow, frame, mounts.pole)
          : movePose(fetchMove(skier.fetch!, skier), snow, frame);
        figure.group.position.set(frame.origin.x, frame.origin.y, frame.origin.z);
        trunk.makeBasis(
          axis.x.set(frame.x.x, frame.x.y, frame.x.z),
          axis.y.set(frame.y.x, frame.y.y, frame.y.z),
          axis.z.set(frame.z.x, frame.z.y, frame.z.z),
        );
        figure.group.quaternion.setFromRotationMatrix(trunk);
        figure.sprawl(p, 0, 0, town !== null);
        if (town) for (let i = 0; i < 2; i++) bootOn(walkBoots[i], p.feet[i], p.boots[i]);
      } else {
        if (bound.radius !== BOUND) {
          figure.group.position.set(0, 0, 0);
          figure.group.quaternion.identity();
          bound.radius = BOUND;
        }
        const pose = poseInputOf(skier, legs, mounts, trick, waiting, stand, riding);
        // Hung, the stand is moved with the boots below, after the figure's
        // input has read it: the input keeps the stand as it stood.
        const held = hung
          ? {
              ...pose,
              skiAngle: 0,
              body: undefined,
              lift: [stand.lift[0], stand.lift[1]] as const,
              spread: [stand.out[0], stand.out[1]] as const,
              fore: [stand.fore[0], stand.fore[1]] as const,
            }
          : pose;
        // A BROKEN ARM drops its pole: both broken, he rides with none.
        const breaks = armBreaks(skier.body.injuries);
        const input = inBasket || (breaks[0] && breaks[1]) ? { ...held, poles: false } : held;
        // ON A CHAIR (`skier-seat.ts`): sat on its seat, and stood up off it
        // over a moment once the chair lets him go.
        // ...or ON A HELICOPTER'S SKID, sat on its tube.
        // ...or IN A GONDOLA'S CABIN, sat on the bench along its back wall
        // at a chair's height, the poles stood on its floor; or TOWED BY A
        // T-BAR, sat back onto the bar as it takes him.
        const { sat } = easeSeat(seatEase, skier.lift, perch !== null, dt);
        const { seated, towing } = seatEase;
        const seatY = perch?.y ?? lastPerch ?? TUNING.lift.seat - CHAIR_SEAT;
        if (perch !== null) lastPerch = perch.y;
        else if (sat) lastPerch = null;
        const seat: Seat | null = boarded
          ? { share: 1, y: 0, board: sled!.board }
          : seated > 0
            ? { share: seated, y: seatY, ...(cabin ? { floor: CABIN_FLOOR } : {}) }
            : towing > 0
              ? { share: towing, y: 0, tow: true }
              : null;
        if (hung && seat) {
          // HIS LEGS DANGLING off the skid (`skier-dangle.ts`), swung by the
          // machine, the air and himself — the figure's lower legs turned
          // about the knees, and each ski moved and turned with its boot
          // on the stand both the code's skis and the model's stand on.
          stepDangle(dangle, perch!, dt);
          const swing = swingOf(dangle, perch!);
          // ...and above them, swaying, bracing and hung (`skier-perch.ts`).
          const feel = feelOf(perch!);
          stepPerchReact(react, feel, dt);
          seat.held = { react, feel };
          const { skis } = swingLegs(seatedPose(input, seat), swing, mounts);
          seat.legs = swing;
          for (let i = 0; i < 2; i++) {
            stand.out[i] += skis[i].dx;
            stand.lift[i] += skis[i].dy;
            stand.fore[i] += skis[i].dz;
            stand.pitch[i] += skis[i].pitch;
            stand.rock[i] += skis[i].rock;
          }
        } else {
          resetDangle(dangle);
          resetPerchReact(react);
        }
        const arms = breaks[0] || breaks[1] ? broken(skier, breaks, dt) : undefined;
        // A hand on a door (`door-reach.ts`), in his body's frame.
        const door = run && run.skier === skier ? doorReach(run) : null;
        if (door) {
          reachAt
            .set(door.x, door.y, door.z)
            .sub(root.position)
            .applyQuaternion(toBody.copy(root.quaternion).invert());
          const at = { x: reachAt.x, y: reachAt.y, z: reachAt.z };
          figure.pose(input, seat, (p) => reachPose(arms ? arms(p) : p, at, door.weight));
        } else figure.pose(input, seat, arms);
      }
      // The skis drawn on the skid's pivot as his body carries it — the
      // figure's boots stand on the same one.
      gear.pose(skier, sink, angle, stand);
      // The chatter's (and a dangling leg's) flap and rock on the code's
      // skis, about each ski's own across and then its length (tips up a
      // negative turn about +x) — the order the model's rig turns them in.
      for (let i = 0; i < 2; i++) {
        if (stand.pitch[i] === 0 && stand.rock[i] === 0) continue;
        gear.skis[i].quaternion.multiply(
          flap.setFromEuler(shook.set(-stand.pitch[i], 0, -stand.rock[i], "ZYX")),
        );
      }
      // THE SKIS LET GO (`lone-skis.ts`): each laid where its own body
      // lies, no longer a pair under him.
      const loose =
        off && off.skis.length === 2
          ? off.skis
          : afoot?.skis.length === 2
            ? afoot.skis
            : racked?.length === 2
              ? racked
              : null;
      if (loose) {
        root.updateWorldMatrix(true, false);
        toLocal.copy(root.matrixWorld).invert();
        let reach = 0;
        for (let i = 0; i < 2; i++) {
          loneSkiFrame(
            loose[i],
            lies[i],
            town && run
              ? () => skiLift(loose[i], run!.level, townCover, townFigure)
              : racked
                ? noCover
                : cover,
          );
          const g = gear.skis[i];
          const keep = g.scale.clone();
          laid.multiplyMatrices(toLocal, lies[i]).decompose(g.position, g.quaternion, g.scale);
          g.scale.copy(keep);
          reach = Math.max(reach, g.position.length() + spec.length);
          // The pair's root as it would stand for this ski at rest.
          pairAt[i].multiplyMatrices(
            lies[i],
            restAt.makeTranslation((-loose[i].side * spec.stance) / 2, spec.cogHeight, 0),
          );
        }
        bound.radius = Math.max(bound.radius, BOUND + reach);
      }
      models?.pose(skier, sink, dt, angle, stand);
      if (loose && models) for (let i = 0; i < 2; i++) models.lay(i, pairAt[i]);
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
    setSled(s) {
      sled = s;
    },
    setBasket(on, walk) {
      basket = on;
      basketWalk = on ? (walk ?? null) : null;
    },
    setPerch(p) {
      perch = p;
    },
    setRun(next) {
      run = next;
      fall = next ? { ground: next.level, gravity: flightGravity(next.rules) } : null;
    },
    setGore(lost, crush) {
      goreLost = lost;
      goreCrush = crush;
    },
    skin: () => ({
      frames: figure.dressed.last(),
      group: figure.dressed.group,
      dress: style.skier,
      cloth: figure.dressed.cloth,
    }),
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
