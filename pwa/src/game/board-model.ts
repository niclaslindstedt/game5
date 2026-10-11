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
// Not yet on a board (drawn as riding): a chair's seat, a helicopter's
// skid, a snowmobile's boards, a balloon's basket, walking in town.

import * as THREE from "three";
import { TUNING, flightGravity, type GameState, type SkiSpec } from "@engine";

import { buildBinding, buildDeck, buildSoftBoot, type Paint } from "./board-body.ts";
import { sheetOf } from "./board-look.ts";
import { boardPose, boardUnderFeet, frontIndex, type BoardFrame } from "./board-pose.ts";
import { buildHeadlamp } from "./headlamp.ts";
import { mergePosed } from "./posed-merge.ts";
import { gearLift } from "./ski-gear.ts";
import { boardInputOf, boardOf } from "./board-input.ts";
import { outfitKey } from "./dress.ts";
import { createSkier } from "./skier-figure.ts";
import { createSkierSpring, restSkierSpring, stepSkierSpring } from "./skier-pose.ts";
import { ragdollPose, type BodyFrame } from "./skier-ragdoll.ts";
import { flightRead } from "./skier-flight.ts";
import type { SkisModel, SkiStyle, SnowGround } from "./skis-body.ts";
import type { V3 } from "./skier-vec.ts";

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

  /** The deck, its bindings and the boots laid for a deck frame and the
   * pose's feet; the rear foot's straps open while it is out. */
  function layBoard(
    f: BoardFrame,
    feet: readonly V3[],
    bootsOf: readonly { f: V3; n: V3 }[],
    free: number | null,
  ) {
    axis.x.set(f.right.x, f.right.y, f.right.z);
    axis.y.set(f.normal.x, f.normal.y, f.normal.z);
    axis.z.set(f.along.x, f.along.y, f.along.z);
    deckGroup.quaternion.setFromRotationMatrix(basis.makeBasis(axis.x, axis.y, axis.z));
    deckGroup.position.set(f.centre.x, f.centre.y, f.centre.z);
    deck.setBend(f.bend);
    for (let i = 0; i < 2; i++) {
      bindings[i].group.position.set(0, deck.topAt(stations[i]), stations[i]);
      for (const m of bindings[i].straps) m.visible = free !== i;
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
    pose(skier, at, sink, _trick = null, dt = 0, body, waiting = false) {
      root.quaternion.set(at.q.x, at.q.y, at.q.z, at.q.w);
      const off = body === undefined ? skier.thrown : body;
      if (off) {
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
      const { input, incline: r, lift } = boardInputOf(skier, legs, at.q);
      const reach = spec.cogHeight - (lift[0] + lift[1]) / 2 - spec.crouchDrop * skier.crouch;
      pivot.set(reach * Math.sin(r), reach * (1 - Math.cos(r)), 0).applyQuaternion(root.quaternion);
      root.position.set(at.x + pivot.x, at.y - sink + pivot.y, at.z + pivot.z);

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
      } else {
        const bp = boardPose(input);
        figure.group.quaternion.identity();
        // A hop lifts all of him, the board with him, off the snow.
        v.set(-Math.sin(r), Math.cos(r), 0).multiplyScalar(bp.rise);
        figure.group.position.copy(v);
        bound.radius = BOUND;
        figure.sprawl(bp.pose, 0, 0);
        layBoard(bp.board, bp.pose.feet, bp.pose.boots, bp.free);
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
      fall = next ? { ground: next.level, gravity: flightGravity(next.rules) } : null;
    },
    setSled() {},
    setBasket() {},
    setPerch() {},
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
