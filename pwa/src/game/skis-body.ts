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
//     outside let down, so he inclines over two skis and never rolls one up.
//   * THE SKIER (`skier-figure.ts`), hung on the points `skier-pose.ts`
//     works out: his boots are the skis' boots, his hips angulated inside
//     the turn by what the engine reports, folded into the tuck, his poles
//     in his hands — planted at a crawl, tucked under his arms at speed.
//   * ONE DRAW: every opaque part is merged into a single vertex-coloured
//     mesh (`posed-merge.ts`) and re-posed in place, so four skiers of forty
//     parts each are four draws and four shadow casts.
//
// THE HEADLAMP (`headlamp.ts`) rides the head's frame on whichever helmet
// is drawn, a draw of its own (its lens is a lamp, not paint). Every pair is
// drawn in its topsheet (`ski-topsheets.ts`), every skier in his outfit
// (`outfit.ts`): the player's off the DRESS card, each rival's his slot's
// (`SLOT_DRESS`), the jacket in the slot's colour the minimap's dot is.

import * as THREE from "three";
import {
  TUNING,
  flightGravity,
  isBoard,
  type GameState,
  type SkiSpec,
  type SkierState,
  type Thrown,
  type TrickPose,
} from "@engine";

import { createBoardModel } from "./board-model.ts";
import { buildHeadlamp, type Headlamp } from "./headlamp.ts";
import type { SkierPose } from "./skier-joints.ts";
import { armBreaks, createBrokenFeel } from "./skier-broken.ts";
import type { Pose } from "./interp.ts";
import { mergePosed } from "./posed-merge.ts";
import { buildGear, cuffHeight } from "./ski-gear.ts";
import { SKI_LOOKS, drawnAs, lookOf } from "./ski-looks.ts";
import { emptyStand, inclineAt, standOf } from "./ski-stand.ts";
import { createChatter, shakeStand, stepChatter } from "./ski-chatter.ts";
import { outfitKey } from "./dress.ts";
import { DEFAULT_OUTFIT, jumpKit, RIVAL_OUTFITS } from "./outfit.ts";
import { PATTERNS, TOPSHEETS, type PatternId, type Topsheet } from "./ski-topsheets.ts";
import {
  createFigureHandOff,
  createSkier,
  type SkierDress,
  type SkierFigure,
} from "./skier-figure.ts";
import { doorReach, reachPose } from "./door-reach.ts";
import { kickStand } from "./slalom-start.ts";
import { attachModels, isBootPart } from "./skier-models.ts";
import {
  createSkierSpring,
  drawnSkiAngle,
  mountsFor,
  restSkierSpring,
  stepSkierSpring,
  type Mounts,
  type SkierPoseInput,
} from "./skier-pose.ts";
import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import type { BoneFrame, SkierBone } from "./skier-rig.ts";
import { fetchMove, movePose } from "./party-pose.ts";
import { bootsOn, buildWalkBoots } from "./town-boots.ts";
import { skiLift, streetOver, townLift, townMove, townPose } from "./town-pose.ts";
import { LOOSE } from "./trail-stamp.ts";
import { stepBoots, swingStand, type BasketWalk } from "./ski-swing.ts";
import { flightRead, type FlightGround } from "./skier-flight.ts";
import {
  CABIN_FLOOR,
  CHAIR_SEAT,
  createSeatEase,
  easeSeat,
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
  type SkiSwing,
} from "./skier-dangle.ts";
import { createPerchReact, feelOf, resetPerchReact, stepPerchReact } from "./skier-perch.ts";
import { ridingOf, widenStand } from "./technique-pose.ts";
import { groundOf, legsLift, poseInputOf } from "./skis-pose-input.ts";
import { loneSkiFrame } from "./lone-ski-frame.ts";
import {
  pitchPast,
  skydivePose,
  squareSkis,
  squareStand,
  type SkydiveShape,
} from "./skier-skydive.ts";
import type { WingsuitShape } from "./skier-wingsuit.ts";
import { flyerSnow, poseFlyer, STOOD } from "./wingsuit-body.ts";
import { createWingsuitWings } from "./wingsuit-figure.ts";
import { jumperPose, jumperShapeOf } from "./skier-jumper.ts";
import { easeGrind, grindArms, grindInput, grindLook } from "./skier-grind.ts";
import { createTuck, uprightSkier, type FlipThrow } from "./skier-somersault.ts";

export { REST_SAG } from "./ski-gear.ts";
export { groundOf, hopLanding, legsLift, poseInputOf } from "./skis-pose-input.ts";

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
  // A ski jumper (only a jump rides the Albatross) in his suit (`jumpKit`).
  const dress =
    spec.id === "albatross" ? { ...skier, outfit: jumpKit(skier.outfit), model: false } : skier;
  return styleIn(TOPSHEETS[drawnAs(spec)], dress);
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
   * `skier.thrown` as stepped when not given; `flip` the loop the lean
   * has thrown (`TrickState`), tucked through (`skier-somersault.ts`). */
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
    flip?: FlipThrow | null,
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
  /** STOOD OFF HIS SKIS in his boots, his hands empty (the rider card's
   * idle, `rider-idle.ts`): the body as `stood` lays it over the snow in
   * the root's frame, the pair out of sight — or null back on them. Read
   * at the next pose. Only the skis' model stands a rider off them. */
  setStood?(stood: StoodPose | null): void;
  /** SKYDIVING (`chute.ts`): his limbs as the jump's stage lays them, his
   * skis carried with his boots and his drawing pitched past what his
   * skier's frame says (`skier-skydive.ts`), or null — read at the next pose. */
  setSkydive(shape: SkydiveShape | null): void;
  /** In a WINGSUIT (`SkierDress.suit`): his body's shape, or null (`skier-wingsuit.ts`). */
  setWingsuit?(shape: WingsuitShape | null): void;
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

/** A BODY STOOD IN HIS BOOTS (`setStood`): the pose over the snow at
 * `ground` (y in the root's frame), its trunk's frame written into `frame`
 * as `ragdollPose` writes it. */
export type StoodPose = (ground: number, frame: BodyFrame) => SkierPose;

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

/** The body's forward axis, and the turn that stands him over the hill. */
const FORWARD = new THREE.Vector3(0, 0, 1);
const hillTurn = new THREE.Quaternion();
const ACROSS = new THREE.Vector3(1, 0, 0);

/** Whether `o` hangs anywhere under `group`. */
function isUnder(o: THREE.Object3D, group: THREE.Object3D): boolean {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === group) return true;
  return false;
}

export function createSkisModel(
  spec: SkiSpec,
  style: SkiStyle,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
): SkisModel {
  if (isBoard(spec)) return createBoardModel(spec, style, wrap);
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const mat = (params: THREE.MeshStandardMaterialParameters, name = "skis") => {
    const m = wrap(new THREE.MeshStandardMaterial(params), name);
    mats.push(m);
    return m;
  };
  const look = SKI_LOOKS[drawnAs(spec)];
  const paint = mat({ color: style.body, roughness: 0.28, metalness: 0.05 });
  const trim = mat({ color: style.accent, roughness: 0.35 });
  const black = mat({ color: style.panel ?? 0x1c1f23, roughness: 0.7 });
  const boot = mat({ color: style.boot ?? 0x121316, roughness: 0.55 });
  const alloy = mat({ color: 0x9aa1a9, roughness: 0.3, metalness: 0.8 });
  // The base: the black sintered sheet a ski runs on, with a little sheen.
  const base = mat({ color: 0x0c0d10, roughness: 0.45, metalness: 0.2 });
  const pattern = PATTERNS[style.pattern ?? TOPSHEETS[drawnAs(spec)].pattern];

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
      if (!named.some(isBootPart)) skiParts.push(m);
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
      if (named.some(isBootPart)) bootParts.push(m);
    }
  } else {
    for (const g of gear.skis) {
      g.traverse((o) => {
        if (o instanceof THREE.Mesh && (o.material === boot || o.name === "buckle")) {
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

  // IN A WINGSUIT: no skis, boots or poles; the wings lofted (`wingsuit-figure.ts`).
  const suit = style.skier.suit;
  const wings =
    suit === undefined ? null : createWingsuitWings(suit, figure.group, wrap, style.skier.ghost);
  if (wings) for (const m of [...skiParts, ...bootParts]) m.visible = false;
  let flyer: WingsuitShape | null = null;
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
  const tuck = createTuck();
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
  // A wingsuit flyer's (`wingsuit-body.ts`), each stage of his jump its own
  // way of drawing him, handed to the next over a moment.
  let flyerWay = "";
  const lay = (p: SkierPose) => figure.sprawl(handed(p, flyerWay));
  const flight = wings && { root, group: figure.group, lay, dressed: figure.dressed, frame, wings };
  // The merged draw's bound: the pair's own, grown while he lies away from it.
  const bound = merged.mesh.geometry.boundingSphere!;
  const BOUND = bound.radius;
  // How seated he is drawn, and how far sat back onto a T-bar (`easeSeat`).
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
  let stoodPose: StoodPose | null = null;
  let sky: SkydiveShape | null = null;
  let lastPerch: number | null = null;
  const dangle = createDangle();
  // ON A LIFT'S ROPE (`skier-grind.ts`): the rail stance's share, eased.
  let grinding = 0;
  const react = createPerchReact();
  // HIS BROKEN ARMS swinging from their breaks (`skier-broken.ts`).
  const broken = createBrokenFeel();
  const toBody = new THREE.Quaternion();
  const reachAt = new THREE.Vector3();
  // Whether his legs' spring has been set back to rest since he was thrown.
  let rested = false;
  // THE HAND-OFF between the ways he is drawn — riding, thrown, on his
  // feet (`pose-handoff.ts`): the last frame's body eased into the next.
  const hand = createFigureHandOff(root, figure.group);
  let handDt = 0;
  const handed = (p: SkierPose, mode: string): SkierPose => hand.handed(p, mode, handDt);

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
    pose(engine, at, sink, trick = null, dt = 0, body, waiting = false, flip = null) {
      const skier = uprightSkier(engine); // never laid out beside his skis over a loop's top
      figure.dressed.clock(run ? run.t : null); // the kit's cloth on the run's clock
      handDt = dt;
      root.quaternion.set(at.q.x, at.q.y, at.q.z, at.q.w);
      const off = body === undefined ? skier.thrown : body;
      // In the suit the flyer's figure, but the rider's own on a craft before the jump.
      if (flight && !off && (flyer || !(perch || basket || sled))) {
        root.position.set(at.x, at.y - sink, at.z);
        const shape = flyer ?? STOOD;
        const ground = fall ? fall.ground.groundAt(at.x, at.z) : null;
        const snow = flyerSnow(shape, root.position.y, ground, at.y);
        flyerWay = `suit ${run?.chute?.mode ?? "ready"}`;
        poseFlyer(flight, shape, snow, run?.t ?? 0);
        bound.radius = BOUND + 1.2;
        merged.update();
        return;
      }
      // ON HIS FEET after a buzzed fall (`buzz.ts`'s fetch): up, walking to
      // his skis, picking them up and back into the bindings.
      // ...or IN TOWN, his skis on his shoulder (`town.ts`).
      const town = off ? null : (skier.town ?? null);
      // ...or STOOD in his boots, the pair put away (`setStood`).
      const stood = off || skier.fetch || town ? null : stoodPose;
      const walking = off ? null : (skier.fetch ?? town);
      const afoot = walking ?? stood;
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
      // A SKI JUMPER (`skier-jumper.ts`): his own body over the pose, his
      // heels free of the skis — so his boots are on him.
      const jump = !off && !afoot && run?.skier === skier ? run.jump : undefined;
      const hillK = run?.level.skiJump?.w;
      const jumper = jump && hillK !== undefined ? jumperShapeOf(jump, run!.t, hillK) : null;
      if (!wings) {
        rack(boarded || (cabin && !racked) || inBasket || bare || stood !== null);
        // A binding lets the BOOT out, buckled to his foot (`town-boots.ts`):
        // with the pair not under him, his boots are on him.
        unboot(off !== null || afoot !== null || racked !== null || jumper !== null);
      }
      const angle = hung ? 0 : drawnSkiAngle(legs, skier);
      const ground = off || afoot ? 0 : groundOf(skier, legs);
      // ON HIS PLATFORMS across a steep face, stood over the hill: the body
      // turned about his feet toward it (`hillLean`), as an inclination
      // the skis stand under.
      const hill = off ? 0 : legs.hill;
      if (hill !== 0) root.quaternion.multiply(hillTurn.setFromAxisAngle(FORWARD, -hill));
      const skydive = off || afoot ? null : sky;
      if (skydive) root.quaternion.multiply(hillTurn.setFromAxisAngle(ACROSS, pitchPast(skydive)));
      standOf(skier, ground, stand, inclineAt(skier, at.q) + hill, angle);
      if (hung) stand.tilt = 0;
      if (skydive) squareSkis(stand);
      // ...and SHAKEN at speed: each ski hopping, flapping and rocking on
      // the snow passing under it, the knees taking it (the boots stand on
      // the same stand).
      stepChatter(chatter, skier, dt);
      // ...and TUCKED for a loop the lean has thrown, opened out to land.
      tuck.step(off || afoot ? null : flip, dt, stand);
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
        figure.sprawl(handed(p, "thrown"), goreLost, goreCrush);
        bootsOn(walkBoots, p, unbooted, goreLost);
        wings?.pose(p, { pressure: 0, unzip: 0, t: run?.t ?? 0 });
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
        const p = stood
          ? stood(snow, frame)
          : town
            ? townPose(townMove(town, skier), snow, frame, mounts.pole)
            : movePose(fetchMove(skier.fetch!, skier), snow, frame);
        figure.group.position.set(frame.origin.x, frame.origin.y, frame.origin.z);
        trunk.makeBasis(
          axis.x.set(frame.x.x, frame.x.y, frame.x.z),
          axis.y.set(frame.y.x, frame.y.y, frame.y.z),
          axis.z.set(frame.z.x, frame.z.y, frame.z.z),
        );
        figure.group.quaternion.setFromRotationMatrix(trunk);
        // Each way of walking its own drawing, so a stage handed to the next
        // (picking the pair up, setting off, clicking in) is eased over.
        const way = stood ? "stood" : town ? `town ${town.phase}` : `fetch ${skier.fetch!.phase}`;
        figure.sprawl(handed(p, way), 0, 0, town !== null);
        bootsOn(walkBoots, p, unbooted, goreLost);
      } else {
        if (bound.radius !== BOUND) {
          figure.group.position.set(0, 0, 0);
          figure.group.quaternion.identity();
          bound.radius = BOUND;
        }
        grinding = easeGrind(grinding, skier.grind != null, dt);
        const pose = grindInput(
          poseInputOf(skier, legs, mounts, trick, waiting, stand, riding),
          grinding,
        );
        tuck.lay(pose); // a loop owning his body while it turns
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
        const bare =
          inBasket || jumper || (breaks[0] && breaks[1]) ? { ...held, poles: false } : held;
        // A skydive's body is laid from a square stand: no turn, fall or trick in it.
        const input = skydive ? squareStand(bare) : bare;
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
          swingStand(stand, skis);
        } else {
          resetDangle(dangle);
          resetPerchReact(react);
        }
        const broke =
          breaks[0] || breaks[1] ? broken(skier, breaks, dt, root.quaternion) : undefined;
        // SKYDIVING: the limbs laid by the stage, the skis moved with the boots.
        const flown = skydive ? (p: SkierPose) => skydivePose(p, skydive, mounts) : null;
        const swung: {
          skis: [SkiSwing, SkiSwing] | null;
          yaw?: [number, number];
          pose?: SkierPose;
        } = { skis: null };
        const arms = flown
          ? (p: SkierPose) => {
              const r = flown(broke ? broke(p) : p);
              swung.skis = r.skis;
              return r.pose;
            }
          : jumper
            ? (p: SkierPose) => {
                const r = jumperPose(
                  broke ? broke(p) : p,
                  jumper,
                  mounts,
                  spec.length * spec.mount,
                );
                swung.skis = r.skis;
                swung.yaw = r.yaw;
                swung.pose = r.pose;
                return r.pose;
              }
            : broke;
        // EACH WAY OF DRAWING HIM ON HIS SKIS its own (`pose-handoff.ts`): on a
        // snowmobile's boards, hung off a skid or a harness, in a basket, a
        // skydive's stage, a jumper's — so one handed to the next is eased
        // over rather than switched in a frame (`make jolt`'s rides).
        const way = [
          "ride",
          boarded ? "sled" : "",
          hung ? "perch" : "",
          inBasket ? "basket" : "",
          skydive ? `sky ${run?.chute?.mode ?? ""}` : "",
          jumper ? `jump ${jump?.stage ?? ""}` : "",
        ].join(" ");
        const look = grindLook(skier.grind);
        const railed =
          grinding > 0.001 ? (p: SkierPose) => grindArms(arms ? arms(p) : p, look, grinding) : arms;
        // A hand on a door (`door-reach.ts`), in his body's frame.
        const door = run && run.skier === skier ? doorReach(run) : null;
        if (door) {
          reachAt
            .set(door.x, door.y, door.z)
            .sub(root.position)
            .applyQuaternion(toBody.copy(root.quaternion).invert());
          const at = { x: reachAt.x, y: reachAt.y, z: reachAt.z };
          figure.pose(input, seat, (p) =>
            handed(reachPose(railed ? railed(p) : p, at, door.weight), way),
          );
        } else figure.pose(input, seat, (p) => handed(railed ? railed(p) : p, way));
        if (swung.skis) swingStand(stand, swung.skis, swung.yaw);
        if (swung.pose) bootsOn(walkBoots, swung.pose, unbooted, goreLost);
      }
      // The skis drawn on the skid's pivot as his body carries it — the
      // figure's boots stand on the same one.
      gear.pose(skier, sink, angle, stand);
      // The chatter's (and a dangling leg's) flap and rock on the code's
      // skis, about each ski's own across and then its length (tips up a
      // negative turn about +x) — the order the model's rig turns them in.
      // A jumper's V (`Stand.yaw`): each ski turned about its binding.
      for (let i = 0; i < 2; i++) {
        if (stand.pitch[i] === 0 && stand.rock[i] === 0 && stand.yaw[i] === 0) continue;
        gear.skis[i].quaternion.multiply(
          flap.setFromEuler(shook.set(-stand.pitch[i], stand.yaw[i], -stand.rock[i], "YZX")),
        );
      }
      // THE SKIS LET GO (`lone-skis.ts`): each laid where its own body
      // lies, no longer a pair under him.
      const loose =
        off && off.skis.length === 2
          ? off.skis
          : walking?.skis.length === 2
            ? walking.skis
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
    setSkydive(shape) {
      sky = shape;
    },
    setWingsuit(shape) {
      flyer = shape;
    },
    setStood(next) {
      stoodPose = next;
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
      wings?.dispose();
      models?.dispose();
    },
  };
}
