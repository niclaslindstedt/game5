// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOWBOARDER AS DRAWN — the board in place of the pair of skis, the
// same model's face to the renderer (`SkisModel`): `createSkisModel` hands a
// board's spec here (`isBoard`), so every caller — the renderer, the ghost,
// the ski card, the labs — draws a rider with no word of its own.
//
//   * THE BOARD (`board-body.ts`): the deck, its two strap bindings at the
//     stance's angles and his soft boots, posed every frame off the engine
//     through `board-pose.ts`: the deck stood on the engine's edge against
//     the snow he inclines to, turned by the skid, pitched by his two feet,
//     bowed by the carve and levelled in the air; the boots on the
//     bindings — the rear one out of its binding pushing beside the heel
//     edge in the one-foot skate, its straps left open.
//   * THE RIDER (`skier-figure.ts`, dressed in his outfit): hung on the
//     joints `boardPose` works out — across the board, his head turned
//     along his travel — with no poles; thrown, on the engine's ragdoll, the
//     board kept on between his feet (`boardUnderFeet`).
//   * The body is pivoted about his feet on the snow as the skier's is
//     (`ski-stand.ts`'s `pivot`), so the drawn deck stays on the track the
//     engine cuts while he leans inside the turn.
//   * ONE DRAW for the bindings, the boots and the figure's rigid parts
//     (`posed-merge.ts`); the deck is a draw of its own (its texture, and its
//     heights laid again when it bows); the lamp on his helmet another.
//
// OFF THE SNOW (`board-lift.ts`): sat on a chair with the board hung off
// his front foot and his rear foot on its deck, towed side-on by a T-bar,
// sat in a gondola's cabin with the board in its rack, on foot with the
// board under his arm (through a gondola's station and in town), stood on
// a snowmobile's boards (the board racked), in a balloon's basket (lashed
// outside it), sat on a helicopter's skid as on a chair, and out of the jump
// plane's door and under a canopy with the board on (`board-skydive.ts`).

import * as THREE from "three";
import { TUNING, flightGravity, type GameState, type LoneSki, type SkiSpec } from "@engine";

import { buildBinding, buildDeck, buildSoftBoot, type Paint } from "./board-body.ts";
import { sheetOf } from "./board-look.ts";
import {
  boardPose,
  easeFree,
  boardUnderFeet,
  frontIndex,
  type BoardFrame,
  type BoardPose,
} from "./board-pose.ts";
import { easeGrab, isBoardGrab, type GrabEase } from "./board-grab.ts";
import { createTuck, uprightSkier } from "./skier-somersault.ts";
import {
  BOARD_SEAT_Y,
  boardLiftPose,
  chairBoardPose,
  mixDeck,
  mixPose,
  underArmFrame,
  underArmHand,
} from "./board-lift.ts";
import { createSeatEase, easeSeat, seatedPose } from "./skier-seat.ts";
import {
  boardSkydiveMounts,
  boardSkydivePose,
  boardSkydiveStand,
  boardSkydiveYaw,
} from "./board-skydive.ts";
import { pitchPast, type SkydiveShape } from "./skier-skydive.ts";
import type { Perch } from "./skier-dangle.ts";
import type { SkierPoseInput } from "./skier-pose.ts";
import { boardTownPose, rideLift, streetOver, townLift, townMove } from "./town-pose.ts";
import { buildHeadlamp } from "./headlamp.ts";
import { mergePosed } from "./posed-merge.ts";
import { gearLift } from "./ski-gear.ts";
import { boardInputOf, boardOf } from "./board-input.ts";
import { outfitKey } from "./dress.ts";
import { createSkier } from "./skier-figure.ts";
import { createSkierSpring, restSkierSpring, stepSkierSpring } from "./skier-pose.ts";
import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import { flightRead } from "./skier-flight.ts";
import type { SkisModel, SkiStyle, SledStand, SnowGround } from "./skis-body.ts";
import type { V3 } from "./skier-vec.ts";

/** How long the figure takes to step from the riding pose into the town's,
 * or back, s — about a beat of the town's own steps. */
const AFOOT_EASE = 0.4;

/** How fast the riding board is eased up onto a drawn street or down off
 * it, m/s. */
const ROAD_RATE = 0.6;
const smooth = (k: number): number => k * k * (3 - 2 * k);
const ACROSS = new THREE.Vector3(1, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

/** A rider stood at rest, his hands empty, his feet `out` m wider each
 * side — what the snowmobile's boards and the basket stand him from. */
function restInput(out: readonly [number, number]): SkierPoseInput {
  return {
    hipRight: 0,
    hipAft: 0,
    lean: 0,
    steer: 0,
    crouch: 0,
    airborne: false,
    landing: 0,
    poles: false,
    spread: out,
  };
}

export function createBoardModel(
  spec: SkiSpec,
  style: SkiStyle,
  wrap: <M extends THREE.Material>(m: M, name: string) => M,
): SkisModel {
  const board = boardOf(spec);
  const sheet = sheetOf(spec.id);
  const face = board.lead === "regular" ? 1 : -1;
  const fi = frontIndex(board.lead);
  const root = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const keep = <G extends THREE.BufferGeometry>(g: G): G => {
    geos.push(g);
    return g;
  };
  const mat = (params: THREE.MeshStandardMaterialParameters, name = "board") => {
    const m = wrap(new THREE.MeshStandardMaterial(params), name);
    mats.push(m);
    return m;
  };
  const paints = new Map<number, THREE.Material>();
  const paint: Paint = (colour) => {
    let m = paints.get(colour);
    if (!m) {
      m = mat({ color: colour, roughness: 0.6 });
      paints.set(colour, m);
    }
    return m;
  };

  // THE RIDER, and everything he stands in hung in his group: riding it is
  // the body frame; thrown, his trunk's — so the board goes where he does.
  const figure = createSkier(style.skier, wrap);
  root.add(figure.group);
  const deckGroup = new THREE.Group();
  figure.group.add(deckGroup);
  const deck = buildDeck(board, sheet, wrap);
  deckGroup.add(deck.mesh);
  const bindings = [0, 1].map(() => buildBinding(sheet, paint, keep));
  const stations = [0, 1].map((i) => ((i === fi ? 1 : -1) * board.stance) / 2);
  const angles = [0, 1].map((i) => (i === fi ? board.front : board.back));
  for (const b of bindings) deckGroup.add(b.group);
  for (let i = 0; i < 2; i++) {
    const a = angles[i];
    bindings[i].group.rotation.set(0, Math.atan2(face * Math.cos(a), Math.sin(a)), 0);
  }
  const boots = [0, 1].map(() => {
    const g = buildSoftBoot(sheet, paint, keep);
    figure.group.add(g);
    return g;
  });

  // His own clock off his kit, so four on a line breathe out of step.
  const kit = outfitKey(style.skier.outfit, style.skier.tone);
  let seed = 0;
  for (let i = 0; i < kit.length; i++) seed = (seed * 31 + kit.charCodeAt(i)) % 997;
  const legs = createSkierSpring(seed / 31);
  let fall: { ground: SnowGround; gravity: number } | null = null;

  // ONE DRAW for the rigid parts (`posed-merge.ts`); the deck apart.
  const parts: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof THREE.Mesh && !(o instanceof THREE.SkinnedMesh) && o !== deck.mesh) {
      parts.push(o);
    }
  });
  const merged = mergePosed(
    root,
    parts,
    mat({ vertexColors: true, roughness: 0.55, metalness: 0.05 }, "skis-merged"),
  );
  const lamp = buildHeadlamp(figure.head, mat, keep);

  let goreLost = 0;
  let goreCrush = 0;
  const toRoot = new THREE.Quaternion();
  const thrownQ = new THREE.Quaternion();
  const pitchQ = new THREE.Quaternion();
  const trunk = new THREE.Matrix4();
  const basis = new THREE.Matrix4();
  const axis = { x: new THREE.Vector3(), y: new THREE.Vector3(), z: new THREE.Vector3() };
  const v = new THREE.Vector3();
  const pivot = new THREE.Vector3();
  const frame: BodyFrame = {
    origin: { x: 0, y: 0, z: 0 },
    x: { x: 1, y: 0, z: 0 },
    y: { x: 0, y: 1, z: 0 },
    z: { x: 0, y: 0, z: 1 },
  };
  merged.update();
  const bound = merged.mesh.geometry.boundingSphere!;
  const BOUND = Math.max(bound.radius, spec.length / 2 + 0.3);
  bound.radius = BOUND;
  let rested = false;
  // How far the rear foot is drawn out of its binding (`easeFree`).
  let freeShare = 0;
  let grabEase: GrabEase = { grab: null, share: 0 };
  const tuck = createTuck();
  // How sat he is drawn on a lift (`easeSeat`); the snowmobile's boards, the
  // basket and the helicopter's skid he is on, if any; the run he rides.
  const seatEase = createSeatEase();
  let sled: SledStand | null = null;
  let basket = false;
  let perch: Perch | null = null;
  let run: GameState | null = null;
  // How far the riding board is stood up onto a drawn street (`rideLift`),
  // eased at `ROAD_RATE` m/s so a kerb or the street's edge is no step.
  let roadLift = 0;
  // ON FOOT AND BACK: how far he is drawn into the town's pose (0 riding ..
  // 1 on foot), eased over `AFOOT_EASE` s each way, and the last pose of the
  // side he left — the riding one held while he steps into the town's, the
  // town's (with the frame it stood in) while he rides off — so neither the
  // stop nor the click-in snaps the figure round.
  let onFoot = 0;
  let lastRide: { pose: BoardPose["pose"]; deck: BoardFrame } | null = null;
  let lastTown: {
    pose: BoardPose["pose"];
    deck: BoardFrame;
    at: THREE.Vector3;
    q: THREE.Quaternion;
  } | null = null;
  const townAt = new THREE.Vector3();
  const townQ = new THREE.Quaternion();
  const still0 = new THREE.Quaternion();
  // The skydive's stage (`skier-skydive.ts`), and the mounts a square stand
  // for it is laid on.
  let sky: SkydiveShape | null = null;
  const skyMounts = boardSkydiveMounts(spec);
  // The racked board, from the engine's pair in the cabin's rack, in the
  // root's frame.
  const rackFrame: BoardFrame = {
    centre: { x: 0, y: 0, z: 0 },
    along: { x: 0, y: 0, z: 1 },
    normal: { x: 0, y: 1, z: 0 },
    right: { x: 1, y: 0, z: 0 },
    bend: 0,
  };
  const toLocal = new THREE.Matrix4();
  const w = new THREE.Vector3();
  /** THE BOARD IN THE CABIN'S RACK: on its tail where the engine stands
   * the pair (`lift-skis.ts`), between its two skis. */
  function rackedDeck(skis: readonly LoneSki[]): BoardFrame {
    root.updateWorldMatrix(true, false);
    toLocal.copy(root.matrixWorld).invert();
    const [a, c] = skis;
    const mid = (k: number) => (a.ends[k] + c.ends[k]) / 2;
    // The tail's end and the tip's, then the middle between.
    w.set((mid(0) + mid(3)) / 2, (mid(1) + mid(4)) / 2, (mid(2) + mid(5)) / 2).applyMatrix4(
      toLocal,
    );
    rackFrame.centre = { x: w.x, y: w.y, z: w.z };
    const dir = new THREE.Vector3(mid(0) - mid(3), mid(1) - mid(4), mid(2) - mid(5))
      .transformDirection(toLocal)
      .normalize();
    const up = new THREE.Vector3(
      (a.up[0] + c.up[0]) / 2,
      (a.up[1] + c.up[1]) / 2,
      (a.up[2] + c.up[2]) / 2,
    ).transformDirection(toLocal);
    up.addScaledVector(dir, -up.dot(dir)).normalize();
    rackFrame.along = { x: dir.x, y: dir.y, z: dir.z };
    rackFrame.normal = { x: up.x, y: up.y, z: up.z };
    const right = up.clone().cross(dir);
    rackFrame.right = { x: right.x, y: right.y, z: right.z };
    return rackFrame;
  }

  /** The deck, its bindings and the boots laid for a deck frame and the
   * pose's feet; the rear foot's straps open while it is out. */
  function layBoard(
    f: BoardFrame,
    feet: readonly V3[],
    bootsOf: readonly { f: V3; n: V3 }[],
    free: number | null,
    afoot = false,
  ) {
    axis.x.set(f.right.x, f.right.y, f.right.z);
    axis.y.set(f.normal.x, f.normal.y, f.normal.z);
    axis.z.set(f.along.x, f.along.y, f.along.z);
    deckGroup.quaternion.setFromRotationMatrix(basis.makeBasis(axis.x, axis.y, axis.z));
    deckGroup.position.set(f.centre.x, f.centre.y, f.centre.z);
    deck.setBend(f.bend);
    for (let i = 0; i < 2; i++) {
      bindings[i].group.position.set(0, deck.topAt(stations[i]), stations[i]);
      for (const m of bindings[i].straps) m.visible = free !== i && !afoot;
      const b = bootsOf[i];
      const n = axis.y.set(b.n.x, b.n.y, b.n.z);
      const fw = axis.z.set(b.f.x, b.f.y, b.f.z);
      axis.x.crossVectors(n, fw);
      boots[i].quaternion.setFromRotationMatrix(basis.makeBasis(axis.x, n, fw));
      // The sole under the cuff the leg ends at (`cuffOver`'s inverse).
      boots[i].position.set(
        feet[i].x - b.n.x * 0.275 + b.f.x * 0.025,
        feet[i].y - b.n.y * 0.275 + b.f.y * 0.025,
        feet[i].z - b.n.z * 0.275 + b.f.z * 0.025,
      );
    }
  }

  const model: SkisModel = {
    root,
    lamp,
    casters: [merged.mesh, deck.mesh, ...figure.skin],
    bound(out) {
      out.center.copy(bound.center);
      root.localToWorld(out.center);
      out.radius = bound.radius;
      return out;
    },
    pose(engine, at, sink, trick = null, dt = 0, body, waiting = false, flip = null) {
      const skier = uprightSkier(engine); // never laid out beside his board over a loop's top
      root.quaternion.set(at.q.x, at.q.y, at.q.z, at.q.w);
      const off = body === undefined ? skier.thrown : body;
      // ON FOOT with the board — through a gondola's station, or in town.
      const town = off ? null : (skier.town ?? null);
      // Off the snow: on a snowmobile's boards, in a balloon's basket, on a
      // helicopter's skid.
      const boarded = sled !== null && !off && !town;
      const inBasket = basket && !off && !town;
      const hung = perch !== null && !off && !town;
      // SKYDIVING: his body laid by the stage, pitched past his frame.
      const skydive = off || town ? null : sky;
      if (skydive) root.quaternion.multiply(pitchQ.setFromAxisAngle(ACROSS, pitchPast(skydive)));
      if (off || town || boarded || inBasket || hung || skydive) {
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
                  ? flightRead(fall.ground, skier, spec.cogHeight, fall.gravity)
                  : null,
                gravity: fall.gravity,
              }
            : undefined,
          (gearLift(skier)[0] + gearLift(skier)[1]) / 2,
        );
      }
      // How sat he is drawn on a chair or a cabin's bench, or towed.
      easeSeat(seatEase, skier.lift, false, dt);
      const cabin = skier.lift?.kind === "gondola" && skier.lift.phase === "ride" && !town;
      const still = off || town || boarded || inBasket || hung || skydive || seatEase.seated > 0;
      const { input, incline: lean, lift } = boardInputOf(skier, legs, at.q);
      // The rear foot drawn out of its binding or back in over a moment.
      freeShare = easeFree(freeShare, input.free, dt);
      input.freeShare = freeShare;
      // The grab held in the air drawn in, and let go, over a moment.
      grabEase = easeGrab(grabEase, isBoardGrab(trick) ? trick : null, dt);
      // ...and a LOOP the lean has thrown turned tucked, a hand on the board
      // (`skier-somersault.ts`): an indy backward, a mute forward.
      tuck.step(off || town ? null : flip, dt);
      const fs = grabEase.share > 0 ? undefined : tuck.shape();
      input.grab = fs ? (fs.dir < 0 ? "mute" : "indy") : grabEase.grab;
      input.grabShare = fs ? fs.tuck : grabEase.share;
      // ...the knees pulled up into it with the hand, let down to open.
      if (fs) input.crouch = Math.max(input.crouch, fs.tuck);
      const r = still ? 0 : lean;
      const reach = spec.cogHeight - (lift[0] + lift[1]) / 2 - spec.crouchDrop * skier.crouch;
      pivot.set(reach * Math.sin(r), reach * (1 - Math.cos(r)), 0).applyQuaternion(root.quaternion);
      const hang = boarded ? sled!.board.hang : null;
      if (hang) v.set(-hang.x, 0, -hang.z).applyQuaternion(root.quaternion);
      else v.set(0, 0, 0);
      // (in town too: the riding pose held as he steps off is laid on it,
      // and the town's own is placed in the world whatever the root's lift).
      const road =
        run && !off && !boarded && !inBasket && !hung ? rideLift(run.level, at.x, at.z) : 0;
      const easeBy = ROAD_RATE * Math.max(0, dt);
      roadLift = dt > 0 ? roadLift + Math.max(-easeBy, Math.min(easeBy, road - roadLift)) : road;
      root.position.set(
        at.x + pivot.x + v.x,
        at.y - sink + pivot.y + roadLift,
        at.z + pivot.z + v.z,
      );
      // The board out of sight: racked on the snowmobile's tunnel, lashed to
      // the basket, or in a cabin with no rack placed.
      const racked = cabin ? (skier.lift?.skis ?? null) : null;
      deckGroup.visible = !(boarded || inBasket || (cabin && !racked));

      if (off) {
        // THROWN, the board kept on between his feet.
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
        thrownQ.setFromRotationMatrix(trunk);
        figure.group.quaternion.copy(toRoot).multiply(thrownQ);
        const deckAt = boardUnderFeet(p, board);
        figure.sprawl(p, goreLost, goreCrush);
        layBoard(deckAt, p.feet, p.boots, null);
        bound.radius = BOUND + figure.group.position.length();
      } else if (town) {
        // ON FOOT, the board on the snow, in his hands or UNDER HIS ARM —
        // laid in the root's own frame (stood upright, facing his way).
        const lifted = run ? townLift(town, run.level, at.x, at.z) : 0;
        const over = run ? streetOver(run.level, at.x, at.z) : 0;
        const snow =
          (fall ? fall.ground.groundAt(at.x, at.z) - root.position.y : -spec.cogHeight) + lifted;
        const { pose: p, deck: d } = boardTownPose(
          townMove(town, skier),
          snow,
          frame,
          underArmFrame(board.lead),
          underArmHand(board.lead),
          (over > 0 ? over + 0.04 : 0) - lifted,
        );
        townAt.set(frame.origin.x, frame.origin.y, frame.origin.z);
        trunk.makeBasis(
          axis.x.set(frame.x.x, frame.x.y, frame.x.z),
          axis.y.set(frame.y.x, frame.y.y, frame.y.z),
          axis.z.set(frame.z.x, frame.z.y, frame.z.z),
        );
        townQ.setFromRotationMatrix(trunk);
        // Stepped into from the riding pose over a moment: the frame and
        // the pose each carried from where he rode to where he stands.
        onFoot = dt > 0 && lastRide ? Math.min(1, onFoot + dt / AFOOT_EASE) : 1;
        const k = smooth(onFoot);
        const pose = k < 1 && lastRide ? mixPose(lastRide.pose, p, k) : p;
        const deckNow = k < 1 && lastRide ? mixDeck(lastRide.deck, d, k) : d;
        figure.group.position.copy(townAt).multiplyScalar(k);
        figure.group.quaternion.slerpQuaternions(still0, townQ, k);
        figure.sprawl(pose, 0, 0);
        layBoard(deckNow, pose.feet, pose.boots, null, true);
        lastTown = { pose: p, deck: d, at: townAt.clone(), q: townQ.clone() };
        bound.radius = BOUND + 1;
      } else if (skydive) {
        // OUT OF THE DOOR AND UNDER THE CANOPY (`board-skydive.ts`): laid
        // square to his front off a square stand, the board across his
        // feet, and turned about his up as the stage stands him.
        const stand = boardSkydiveStand(skyMounts, skier.crouch);
        const { pose: p, deck: d } = boardSkydivePose(stand, skydive, board, skyMounts);
        figure.group.position.set(0, 0, 0);
        figure.group.quaternion.setFromAxisAngle(UP, boardSkydiveYaw(skydive, board.lead));
        figure.sprawl(p, 0, 0);
        layBoard(d, p.feet, p.boots, null);
        bound.radius = BOUND + 1;
      } else {
        figure.group.quaternion.identity();
        bound.radius = BOUND;
        let bp: BoardPose;
        if (boarded) {
          // ON A SNOWMOBILE'S BOARDS in his soft boots, the board racked.
          bp = { ...boardPose(input), free: null, rise: 0 };
          bp.pose = seatedPose(restInput(sled!.out), { share: 1, y: 0, board: sled!.board });
        } else if (inBasket) {
          // IN THE BASKET, stood in his soft boots, the board lashed outside.
          bp = { ...boardPose(input), pose: seatedPose(restInput([0, 0]), null), free: null };
          bp.rise = 0;
        } else if (hung) {
          // ON THE SKID, sat as on a chair, the board hung off his front foot.
          bp = chairBoardPose(board, perch!.y);
        } else {
          const seat = {
            seated: seatEase.seated,
            towing: seatEase.towing,
            y: BOARD_SEAT_Y,
            cabin,
          };
          bp = boardLiftPose(input, seat);
        }
        // A hop lifts all of him, the board with him, off the snow.
        v.set(-Math.sin(r), Math.cos(r), 0).multiplyScalar(bp.rise);
        figure.group.position.copy(v);
        lastRide = { pose: bp.pose, deck: bp.board };
        // Ridden off from the town's pose over a moment.
        onFoot = dt > 0 && lastTown ? Math.max(0, onFoot - dt / AFOOT_EASE) : 0;
        const k = smooth(onFoot);
        if (k > 0 && lastTown) {
          bp = { ...bp, pose: mixPose(bp.pose, lastTown.pose, k) };
          if (!racked) bp.board = mixDeck(bp.board, lastTown.deck, k);
          figure.group.position.lerp(lastTown.at, k);
          figure.group.quaternion.slerpQuaternions(still0, lastTown.q, k);
        }
        figure.sprawl(bp.pose, 0, 0);
        const deckAt = racked ? rackedDeck(racked) : bp.board;
        layBoard(deckAt, bp.pose.feet, bp.pose.boots, bp.free, boarded || inBasket || cabin);
      }
      merged.update();
    },
    poseSkier(input) {
      figure.pose(input);
      merged.update();
    },
    setGround(ground, gravity) {
      fall = ground ? { ground, gravity } : null;
    },
    setRun(next: GameState | null) {
      run = next;
      fall = next ? { ground: next.level, gravity: flightGravity(next.rules) } : null;
    },
    setSled(next) {
      sled = next;
    },
    setBasket(on) {
      basket = on;
    },
    setPerch(next) {
      perch = next;
    },
    setSkydive(shape) {
      sky = shape;
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
    setSkierVisible(on) {
      if (figure.group.visible === on) return;
      figure.group.visible = on;
      merged.update();
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      deck.dispose();
      merged.dispose();
      figure.dispose();
    },
  };
  return model;
}
