// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE IN THE RENDERER (`chute.ts`) — drawn all in code:
//
//   * THE HARNESS-CONTAINER on the jumper's back from the plane's door to
//     the snow (`chute-gear.ts`), worn on his posed bones;
//   * THE OPENING frame by frame as the engine stages it: the pilot chute a
//     fistful of cloth in his hand at the throw, then opening into its dome
//     out to his side and trailing up; the BRIDLE snaking taut; the BAG
//     lifted off his back and tumbling as the lines strip out of it; at line
//     stretch the canopy out of the bag, a bunched sheet held narrow by the
//     SLIDER at its top, the CENTRE CELLS filling first and outward to the
//     ends, the empty cells flogging, the slider driven down the lines and
//     spreading as it comes (`chute-canopy.ts`, `chute-rig-plan.ts`);
//   * THE OPEN CANOPY (the sport main's nine bi-cells) on its four rows of
//     lines through the slider's grommets to the four risers, the steering
//     lines to the toggles in his hands, its trailing edge pulled down by
//     them; the pilot chute collapsed and the bag on the bridle over it;
//   * THE CANOPY CUT AWAY crumpling into a streamer as it falls, and lying
//     on the snow in a long heap along the way it fell;
//   * CAUGHT, laid over the crown it caught in or folded over the rope, he
//     hanging on his lines under it.
//
// Drawn between two steps on the jumper's own line (`interp.ts`).

import * as THREE from "three";
import {
  CHUTE,
  liftPlans,
  type ChuteWing,
  type ChutePiece,
  type ChuteState,
  type GameState,
  type Level,
} from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createTrack, observe, sample, type Pose } from "./interp.ts";
import {
  BASE_PAINT,
  BASE_WING,
  RESERVE_PAINT,
  RESERVE_WING,
  SKY_PAINT,
  SKY_WING,
  shapeSkyCanopy,
  skyInflation,
  skyLayout,
  skyLines,
  skyPaintGlsl,
  skyPoint,
  sliderOf,
  type SkyLine,
  type SkyPaint,
} from "./chute-canopy.ts";
import { meshSliderMaterial, paintBase, SLIDER_UV } from "./base-rig.ts";
import { createGear, GEAR, layOnBone } from "./chute-gear.ts";
import type { CanopyLayout, WingShape } from "./para-canopy.ts";
import {
  bagTurn,
  bridlePath,
  crownDrape,
  cutawayPoint,
  flownOver,
  laidPoint,
  overCanopy,
  pilotOpen,
  ropeDrape,
  type P3,
} from "./chute-rig-plan.ts";
import { skydiveShapeOf } from "./skier-skydive.ts";
import { wingsuitShapeOf } from "./skier-wingsuit.ts";
import { colourwayOf, type SuitColourway } from "./wingsuit-look.ts";
import type { BoneFrame, SkierBone } from "./skier-rig.ts";

/** His dressed figure as last posed (`SkisModel.skin`): its bones' frames
 * in its group's frame, and that group — what the rig is worn on. */
export type Wearer = { frames: Record<SkierBone, BoneFrame>; group: THREE.Object3D };

export type ChuteScene = {
  group: THREE.Group;
  /** One frame: the rig where the run has it, `alpha` of the way from the
   * step before, worn on `wearer` as he was posed this frame (or, without
   * one, on the engine's body). */
  frame(state: GameState, alpha: number, wearer?: Wearer | null): void;
  /** The canopy's centre as drawn this frame, or null with no canopy over
   * him (what the lens under it frames). */
  canopy(): { x: number; y: number; z: number } | null;
  /** The furthest piece of the opening from him this frame (the pilot
   * chute, the bag, the canopy) — what the opening's lens keeps in frame —
   * or null outside the opening. */
  opening(): { x: number; y: number; z: number } | null;
  /** The jumper as drawn this frame (his middle), or null with no skydive. */
  jumper(): { x: number; y: number; z: number } | null;
  /** His eyes as posed this frame — where they are, the way his face looks
   * and the top of his head, the world's frame — or null with no figure
   * worn (what his own lenses look out of). */
  eyes(): Eyes | null;
  /** Through his own eyes the rig on his back is hidden with his figure. */
  setOwnEyes(on: boolean): void;
  dispose(): void;
};

/** His eyes: the point, his face's way and his head's up, the world's frame. */
export type Eyes = { at: THREE.Vector3; face: THREE.Vector3; up: THREE.Vector3 };

/** WHETHER HE WEARS THE RIG: in the skydive, and on every ride in the air
 * he could jump from with it (`craftFreefall`) — in the plane's door, on
 * the helicopter's skid, a balloon ride and a paramotor ride whole. */
export function rigWorn(state: GameState): boolean {
  return (
    !!state.chute || !!state.plane?.rider || !!state.heli?.rider || !!state.balloon || !!state.para
  );
}

/** His eyes off the head bone's root, m: up the skull and out of the face. */
const EYES = { up: 0.11, out: 0.12 };

/** A CANOPY AS DRAWN — the main's or the reserve's: its shape and size,
 * the cloth's mesh (`skin` shaped, `rest` the flat full canopy), the
 * slider, the lines (`LINES` its feet, steering lines and quadrants), and
 * what it keeps between frames — the toggles it was last shaped for, the
 * snag it was draped for and how, and its cut-away's clock. */
type Kit = {
  wing: WingShape;
  size: ChuteWing["canopy"];
  layout: CanopyLayout;
  geo: THREE.BufferGeometry;
  skin: Float32Array;
  rest: Float32Array;
  canopy: THREE.Mesh;
  sliderPos: Float32Array;
  sliderGeo: THREE.BufferGeometry;
  slider: THREE.Mesh;
  LINES: SkyLine[];
  linePos: Float32Array;
  lineGeo: THREE.BufferGeometry;
  lines: THREE.LineSegments;
  leafAt: THREE.Vector3[];
  shaped: string;
  draped: ChuteState["snag"];
  feetOn: boolean;
  cutAt: number;
};
/** How far the four risers stand up off the three rings, m, and apart fore
 * and aft (the front riser to the nose). */
const RISER = { length: 0.55, apart: 0.05 };
/** The pull (`skier-skydive.ts`'s): the pilot chute in his fist until the
 * throw lets it go, s after the press, and how long it takes to reach the
 * place the engine has it. */
const THROW = { from: 0.14, out: 0.42, catch: 0.2 };
/** The reserve's spring pilot chute out of its tray, s; the free bag's
 * climb off over the canopy after line stretch, m/s, and when it is gone
 * from the picture, s after line stretch. */
const SPRING = 0.12;
const FREE_BAG = 5;
const FREE_GONE = 2.5;
/** The fist down the hand bone from the wrist, m. */
const FIST = 0.08;
/** A canopy caught in a crown lies over its top this far down, m, held
 * this far out past the foliage by the boughs' tips, m. */
const CAUGHT_DEPTH = 3.2;
const CAUGHT_BOUGHS = 0.6;

const UP = new THREE.Vector3(0, 1, 0);
const v3 = (): THREE.Vector3 => new THREE.Vector3();

export function createChuteScene(
  haze: HazeUniforms,
  level: Level,
  base = false,
  suit: SuitColourway | null = null,
): ChuteScene {
  const group = new THREE.Group();
  group.name = "skydive";
  group.visible = false;

  const mats: THREE.Material[] = [];
  const std = (color: number, roughness: number): THREE.MeshStandardMaterial => {
    const m = hazeMaterial(
      new THREE.MeshStandardMaterial({ color, roughness, flatShading: true }),
      haze,
      "chute",
    );
    mats.push(m);
    return m;
  };
  // A wingsuit's run wears the BASE rig (`createGear`'s `base`), soft and
  // in the suit's colours (`base-rig.ts`).
  const soft = (color: number, roughness: number): THREE.MeshStandardMaterial => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial({ color, roughness }), haze, "chute");
    mats.push(m);
    return m;
  };
  const baseColours = base
    ? {
        cloth: soft(0x1d2128, 0.8),
        flap: soft(0x7a7f86, 0.7),
        binding: soft(0xe8e8e2, 0.7),
        bridle: soft(0xd8432c, 0.7),
      }
    : null;
  if (baseColours) paintBase(baseColours, suit ?? colourwayOf(0));
  const gear = createGear(
    std(0x1d2128, 0.75),
    std(base ? 0x7a7f86 : 0x3a6fb4, 0.65),
    std(0x2a2d33, 0.8),
    std,
    base,
    baseColours,
  );
  group.add(gear.body, ...gear.legs);

  // THE PILOT CHUTE: a dome of cloth over a mesh skirt drawn to the bridle.
  const pilot = new THREE.Group();
  const P = CHUTE.pilot.diameter / 2;
  const dome = new THREE.SphereGeometry(P, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2);
  const skirt = new THREE.ConeGeometry(P, P * 1.1, 12, 1, true);
  skirt.rotateX(Math.PI);
  skirt.translate(0, -P * 0.55, 0);
  const domeMat = std(0xd8432c, 0.6);
  domeMat.side = THREE.DoubleSide;
  const meshMat = std(0x9a9a92, 0.9);
  meshMat.side = THREE.DoubleSide;
  meshMat.transparent = true;
  meshMat.opacity = 0.45;
  pilot.add(new THREE.Mesh(dome, domeMat), new THREE.Mesh(skirt, meshMat));
  // THE BAG the canopy is packed in.
  const B = CHUTE.bag;
  const bagGeo = new THREE.BoxGeometry(B.width, B.height, B.depth);
  const bag = new THREE.Mesh(bagGeo, std(0x2e3238, 0.8));
  group.add(pilot, bag);

  // THE CANOPIES: the sport main and the reserve, each its own cloth, slider
  // and lines (`Kit`), the one over him (or let go of) drawn in its turn.
  const lineMat = new THREE.LineBasicMaterial({ color: 0xd2d2c8 });
  const makeKit = (
    wing: WingShape,
    size: ChuteWing["canopy"],
    paint: SkyPaint,
    sliderColor: number,
    mesh = false,
  ): Kit => {
    const layout = skyLayout(wing);
    const geo = new THREE.BufferGeometry();
    const skin = new Float32Array(layout.vertices * 3);
    const rest = new Float32Array(layout.vertices * 3);
    shapeSkyCanopy(rest, { left: 0, right: 0, spread: 1, t: 0, wing });
    skin.set(rest);
    geo.setAttribute("position", new THREE.BufferAttribute(skin, 3));
    geo.setAttribute("aPaint", new THREE.BufferAttribute(layout.paint, 3));
    geo.setIndex(new THREE.BufferAttribute(layout.index, 1));
    geo.computeVertexNormals();
    const glsl = skyPaintGlsl(wing, paint);
    const cloth = hazeMaterial(
      new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0, side: THREE.DoubleSide }),
      haze,
      wing === SKY_WING ? "sky-cloth" : wing === BASE_WING ? "sky-cloth-base" : "sky-cloth-reserve",
      (shader) => {
        shader.vertexShader = shader.vertexShader
          .replace(
            "#include <common>",
            "#include <common>\nattribute vec3 aPaint;\nvarying vec3 vPaint;",
          )
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPaint = aPaint;");
        shader.fragmentShader = shader.fragmentShader
          .replace("#include <common>", `#include <common>\nvarying vec3 vPaint;\n${glsl}`)
          .replace(
            "#include <color_fragment>",
            "#include <color_fragment>\ndiffuseColor.rgb *= canopyPaint(vPaint);",
          );
      },
    );
    mats.push(cloth);
    const canopy = new THREE.Mesh(geo, cloth);
    canopy.frustumCulled = false;
    // THE SLIDER: a square of cloth on its four grommets.
    const sliderPos = new Float32Array(12);
    const sliderGeo = new THREE.BufferGeometry();
    sliderGeo.setAttribute("position", new THREE.BufferAttribute(sliderPos, 3));
    sliderGeo.setIndex([0, 1, 2, 0, 2, 3]);
    // A BASE rig's slider is open mesh (`base-rig.ts`), a sport rig's cloth.
    sliderGeo.setAttribute("uv", new THREE.BufferAttribute(SLIDER_UV, 2));
    const sliderMat = mesh
      ? hazeMaterial(meshSliderMaterial(), haze, "chute-mesh")
      : std(sliderColor, 0.7);
    if (mesh) mats.push(sliderMat);
    sliderMat.side = THREE.DoubleSide;
    const slider = new THREE.Mesh(sliderGeo, sliderMat);
    slider.frustumCulled = false;
    // THE LINES: every line in two runs (its foot to its grommet, the
    // grommet to its riser or toggle), and the four risers.
    const LINES = skyLines(wing);
    const linePos = new Float32Array((LINES.length * 2 + 4) * 6);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    const lines = new THREE.LineSegments(lineGeo, lineMat);
    lines.frustumCulled = false;
    group.add(canopy, slider, lines);
    return {
      wing,
      size,
      layout,
      geo,
      skin,
      rest,
      canopy,
      sliderPos,
      sliderGeo,
      slider,
      LINES,
      linePos,
      lineGeo,
      lines,
      leafAt: LINES.map(() => v3()),
      shaped: "",
      draped: null,
      feetOn: false,
      cutAt: -1,
    };
  };
  const mainKit = makeKit(SKY_WING, CHUTE.canopy, SKY_PAINT, 0xe0b030);
  const reserveKit = makeKit(RESERVE_WING, CHUTE.reserve.canopy, RESERVE_PAINT, 0x8a8f96);
  // ...and a wingsuit's one canopy, the BASE rig's (`CHUTE.base`).
  const baseKit = base
    ? makeKit(BASE_WING, CHUTE.base.canopy, BASE_PAINT, 0x2a2d33, true)
    : mainKit;
  const kits = base ? [mainKit, reserveKit, baseKit] : [mainKit, reserveKit];
  /** The kit every canopy function below draws with. */
  let cur = mainKit;

  // THE BRIDLE.
  const BRIDLE = 16;
  const bridlePos = new Float32Array((BRIDLE + 1) * 3 * 2);
  const bridleGeo = new THREE.BufferGeometry();
  bridleGeo.setAttribute("position", new THREE.BufferAttribute(bridlePos, 3));
  const bridleMat = new THREE.LineBasicMaterial({ color: 0xe8d8a0 });
  const bridle = new THREE.Line(bridleGeo, bridleMat);
  bridle.frustumCulled = false;
  group.add(bridle);
  const webMat = gear.legs[0].material as THREE.Material;
  const riserGeo = new THREE.BoxGeometry(0.035, 1, 0.006);
  riserGeo.translate(0, 0.5, 0);
  const risers = [0, 1, 2, 3].map(() => {
    const r = new THREE.Mesh(riserGeo, webMat);
    group.add(r);
    return r;
  });

  const jumperTrack = createTrack();
  const canopyTrack = createTrack();
  const jumper: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const canopyAt: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const jq = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const right = v3();
  const up = v3();
  const fwd = v3();
  const tmp = v3();
  const tmp2 = v3();
  const turn = new THREE.Quaternion();
  const bodyFrame: BoneFrame = {
    head: { x: 0, y: 0, z: 0 },
    x: { x: 1, y: 0, z: 0 },
    y: { x: 0, y: 1, z: 0 },
    z: { x: 0, y: 0, z: 1 },
    length: 0.5,
  };
  const shoulders = [v3(), v3()];
  const riserTop = [v3(), v3(), v3(), v3()];
  const grommet = [v3(), v3(), v3(), v3()];
  const hands = [v3(), v3()];
  const pt = new Float32Array(3);
  let over: P3 | null = null;
  let farthest: P3 | null = null;
  let wearing: Wearer | null = null;
  let ownEyes = false;
  const eyes: Eyes = { at: v3(), face: v3(), up: v3() };

  /** A point of his chest's frame (the harness's) in the world. */
  const onChest = (x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 =>
    gear.body.localToWorld(out.set(x, y, z));

  /** Every bone the rig is laid on: the posed figure's, or his body's. */
  function wear(): void {
    if (wearing) {
      const w = wearing.group.matrixWorld;
      layOnBone(gear.body, wearing.frames.chest, w);
      layOnBone(gear.legs[0], wearing.frames.thigh_l, w, GEAR.leg.down);
      layOnBone(gear.legs[1], wearing.frames.thigh_r, w, GEAR.leg.down);
      for (const [i, b] of (["hand_l", "hand_r"] as const).entries()) {
        const f = wearing.frames[b];
        hands[i]
          .set(f.head.x + f.y.x * FIST, f.head.y + f.y.y * FIST, f.head.z + f.y.z * FIST)
          .applyMatrix4(w);
      }
    } else {
      // His body's frame, the chest's origin a little under his middle.
      basis.makeRotationFromQuaternion(jq);
      basis.setPosition(jumper.x, jumper.y, jumper.z);
      layOnBone(gear.body, bodyFrame, basis, -0.02);
      onChest(0.25, 0.55, 0.2, hands[1]);
      onChest(-0.25, 0.55, 0.2, hands[0]);
    }
    gear.legs[0].visible = gear.legs[1].visible = !!wearing && !ownEyes;
    gear.body.updateMatrixWorld();
    for (const s of [0, 1])
      onChest((s ? 1 : -1) * GEAR.webs, 0.43, GEAR.front + 0.01, shoulders[s]);
  }

  /** The canopy's frame: up its lines from his shoulders, along its
   * heading, its nose pitched by the swing. */
  function hangCanopy(ch: ChuteState): void {
    up.set(canopyAt.x - jumper.x, canopyAt.y - jumper.y, canopyAt.z - jumper.z);
    if (up.lengthSq() < 1e-6) up.copy(UP);
    up.normalize();
    fwd.set(Math.sin(ch.canopyHeading), 0, Math.cos(ch.canopyHeading));
    fwd.addScaledVector(up, -fwd.dot(up));
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
    fwd.normalize();
    right.crossVectors(up, fwd);
    basis.makeBasis(right, up, fwd);
    cur.canopy.quaternion.setFromRotationMatrix(basis);
    cur.canopy.quaternion.multiply(turn.setFromAxisAngle(tmp.set(1, 0, 0), -ch.pitch * 0.6));
    cur.canopy.position.set(canopyAt.x, canopyAt.y, canopyAt.z);
    cur.canopy.scale.setScalar(1);
    cur.canopy.updateMatrixWorld();
  }

  /** Shape the cloth for the toggles and the opening, only when they move. */
  function shapeCloth(ch: ChuteState, spread: number, t: number, full: number | undefined): void {
    const { brake, steer } = ch.controls;
    const l = Math.min(1, brake + Math.max(0, -steer));
    const r = Math.min(1, brake + Math.max(0, steer));
    // Opening and breathing the cloth moves every frame; flown still, only
    // when the toggles do.
    const key = spread < 1 || (full ?? 99) < 9 ? `${t}` : `${l.toFixed(2)},${r.toFixed(2)}`;
    if (key === cur.shaped) return;
    cur.shaped = key;
    shapeSkyCanopy(cur.skin, { left: l, right: r, spread, t, full, wing: cur.wing });
    cur.geo.getAttribute("position").needsUpdate = true;
    cur.geo.computeVertexNormals();
  }

  /** THE LINES of a flying (or opening) canopy: every foot as the cloth is
   * shaped, the slider's grommets `share` up the lines, the four risers off
   * the rings and the steering lines to his hands (or the rear risers). */
  function rigLines(
    ch: ChuteState,
    spread: number,
    share: number,
    t: number,
    toggles: boolean,
  ): void {
    const inf = skyInflation(spread);
    const { brake, steer } = ch.controls;
    for (let i = 0; i < cur.LINES.length; i++) {
      const L = cur.LINES[i];
      const drop = L.brake || L.s > 0.5 ? 0.85 * (0.35 + 0.65 * Math.abs(L.u)) : 0;
      const pull = Math.min(1, brake + Math.max(0, L.side < 0 ? -steer : steer));
      skyPoint(L.u, L.s, -1, 0, drop * pull, inf, t, pt, 0, 0, cur.wing);
      cur.leafAt[i].set(pt[0], pt[1], pt[2]).applyMatrix4(cur.canopy.matrixWorld);
    }
    // The risers stand up toward the canopy off the rings.
    tmp.set(canopyAt.x, canopyAt.y, canopyAt.z);
    for (let k = 0; k < 4; k++) {
      const side = k < 2 ? 0 : 1;
      const front = k % 2 === 0;
      riserTop[k]
        .copy(tmp)
        .sub(shoulders[side])
        .normalize()
        .multiplyScalar(RISER.length)
        .add(shoulders[side])
        .addScaledVector(fwd, front ? RISER.apart : -RISER.apart);
      const r = risers[k];
      r.position.copy(shoulders[side]);
      tmp2.copy(riserTop[k]).sub(shoulders[side]);
      r.scale.set(1, tmp2.length(), 1);
      r.quaternion.setFromUnitVectors(UP, tmp2.normalize());
      r.visible = true;
    }
    // The slider's grommets: up the lines to just under the canopy.
    const sl = sliderOf(share);
    const S = cur.size.slider;
    const mid = tmp2.copy(riserTop[0]).add(riserTop[3]).multiplyScalar(0.5);
    const under = v3()
      .set(0, -0.35, -cur.size.chord * 0.45)
      .applyMatrix4(cur.canopy.matrixWorld);
    const c = v3().lerpVectors(mid, under, sl.share * 0.94);
    for (let k = 0; k < 4; k++) {
      const sx = k < 2 ? -1 : 1;
      const sz = k % 2 === 0 ? 1 : -1;
      grommet[k]
        .copy(c)
        .addScaledVector(right, (sx * S.width * sl.open) / 2)
        .addScaledVector(fwd, (sz * S.length * sl.open) / 2);
      grommet[k].toArray(cur.sliderPos, [0, 3, 1, 2][k] * 3);
    }
    cur.sliderGeo.getAttribute("position").needsUpdate = true;
    cur.sliderGeo.computeVertexNormals();
    cur.slider.visible = true;
    let o = 0;
    for (let i = 0; i < cur.LINES.length; i++) {
      const L = cur.LINES[i];
      const k = (L.side < 0 ? 0 : 2) + (L.front ? 0 : 1);
      cur.leafAt[i].toArray(cur.linePos, o);
      grommet[k].toArray(cur.linePos, o + 3);
      grommet[k].toArray(cur.linePos, o + 6);
      const end = L.brake && toggles ? hands[L.side < 0 ? 0 : 1] : riserTop[k];
      end.toArray(cur.linePos, o + 9);
      o += 12;
    }
    for (let k = 0; k < 4; k++) {
      shoulders[k < 2 ? 0 : 1].toArray(cur.linePos, o);
      riserTop[k].toArray(cur.linePos, o + 3);
      o += 6;
    }
    cur.lineGeo.getAttribute("position").needsUpdate = true;
    cur.lineGeo.setDrawRange(0, o / 3);
    cur.lines.visible = true;
  }

  /** The bridle's run from `from` to the pilot chute at `to`, `length` m,
   * and on (`then`) to the canopy's top. */
  const sideOf = v3();
  function drawBridle(
    from: THREE.Vector3,
    to: THREE.Vector3,
    length: number,
    t: number,
    then?: THREE.Vector3,
  ): void {
    sideOf.copy(to).sub(from).cross(UP);
    if (sideOf.lengthSq() < 1e-6) sideOf.set(1, 0, 0);
    sideOf.normalize();
    bridlePath(from, to, length, sideOf, t, BRIDLE, bridlePos);
    let n = BRIDLE + 1;
    if (then) {
      bridlePath(to, then, to.distanceTo(then) + 0.2, sideOf, t, BRIDLE, bridlePos.subarray(n * 3));
      n *= 2;
    }
    bridleGeo.getAttribute("position").needsUpdate = true;
    bridleGeo.setDrawRange(0, n);
    bridle.visible = true;
  }

  /** The bridle's attachment, the bag and the pilot chute over the canopy
   * as `overCanopy` has them at `fly`, the world's frame. */
  function rigOver(
    fly: number,
    top: THREE.Vector3,
    atBag: THREE.Vector3,
    atPilot: THREE.Vector3,
  ): void {
    const o = overCanopy(fly);
    const m = cur.canopy.matrixWorld;
    top.set(o.top.x, o.top.y, o.top.z).applyMatrix4(m);
    atBag.set(o.bag.x, o.bag.y, o.bag.z).applyMatrix4(m);
    atPilot.set(o.pilot.x, o.pilot.y, o.pilot.z).applyMatrix4(m);
  }

  /** The pilot chute at `at`, its dome to the air past `from`. */
  function placePilot(at: THREE.Vector3, from: THREE.Vector3, open: number): void {
    pilot.visible = true;
    pilot.position.copy(at);
    tmp.copy(at).sub(from);
    if (tmp.lengthSq() < 1e-6) tmp.copy(UP);
    pilot.quaternion.setFromUnitVectors(UP, tmp.normalize());
    // The reserve's spring pilot chute is the smaller.
    const size =
      (cur === reserveKit
        ? CHUTE.reserve.pilot.diameter
        : base
          ? CHUTE.base.pilot.diameter
          : CHUTE.pilot.diameter) / CHUTE.pilot.diameter;
    pilot.scale.set(open * size, (0.35 + 0.65 * open) * size, open * size);
  }

  /** THE CUT-AWAY: the cloth crumpling as it falls, then laid on the snow. */
  function cutaway(piece: ChutePiece, t: number): void {
    cur.canopy.visible = true;
    const n = cur.layout.vertices;
    const p = { x: 0, y: 0, z: 0 };
    if (piece.down) {
      cur.canopy.position.set(0, 0, 0);
      cur.canopy.quaternion.identity();
      for (let i = 0; i < n; i++) {
        p.x = cur.rest[i * 3];
        p.y = cur.rest[i * 3 + 1];
        p.z = cur.rest[i * 3 + 2];
        laidPoint(p, piece, level.groundAt, cur.skin, i * 3);
      }
    } else {
      cur.canopy.position.set(piece.x, piece.y, piece.z);
      cur.canopy.quaternion.setFromAxisAngle(UP, piece.heading);
      for (let i = 0; i < n; i++) {
        p.x = cur.rest[i * 3];
        p.y = cur.rest[i * 3 + 1];
        p.z = cur.rest[i * 3 + 2];
        cutawayPoint(p, t, cur.skin, i * 3);
      }
    }
    cur.shaped = "";
    cur.geo.getAttribute("position").needsUpdate = true;
    cur.geo.computeVertexNormals();
  }

  /** CAUGHT: the open cloth as it hung, laid over the crown or the rope —
   * worked out once, when it catches. */
  function drape(ch: ChuteState): void {
    const s = ch.snag;
    if (!s) return;
    if (cur.draped !== s) {
      cur.draped = s;
      hangCanopy(ch);
      shapeSkyCanopy(cur.skin, { left: 0, right: 0, spread: 1, t: 0, wing: cur.wing });
      const tree = s.on === "tree" ? level.trees[s.index] : null;
      const plan = tree ? null : liftPlans(level)[s.index];
      // Laid over the drawn foliage, whose pads and sprays reach out past
      // the crown's own radius, so the cloth is never buried in it — and
      // caught over its top few metres only, held out by the stiff boughs
      // there (a wing does not slide down a spire to wrap it like a sock).
      const reach = tree ? tree.height * 0.6 : 1;
      const depth = Math.min(reach, CAUGHT_DEPTH);
      const crown = tree && {
        x: tree.x,
        z: tree.z,
        top: tree.y + tree.height,
        depth,
        radius: (tree.crown * 1.25 + 0.35) * Math.max(0.7, depth / reach) + CAUGHT_BOUGHS,
      };
      const dir = { x: plan?.dx ?? 1, y: 0, z: plan?.dz ?? 0 };
      const n = cur.layout.vertices;
      const p = { x: 0, y: 0, z: 0 };
      for (let i = 0; i < n; i++) {
        if (crown) {
          p.x = cur.skin[i * 3];
          p.y = cur.skin[i * 3 + 1];
          p.z = cur.skin[i * 3 + 2];
          crownDrape(p, crown, ch.canopyHeading, cur.skin, i * 3);
          continue;
        }
        tmp.fromArray(cur.skin, i * 3).applyMatrix4(cur.canopy.matrixWorld);
        p.x = tmp.x;
        p.y = tmp.y;
        p.z = tmp.z;
        ropeDrape(p, s, dir, cur.skin, i * 3);
      }
      // Over a crown his lines run up to their feet on the cloth thrown
      // over it; over a rope, to the point it is held at.
      cur.feetOn = !!crown;
      if (crown) {
        const inf = skyInflation(1);
        for (let i = 0; i < cur.LINES.length; i++) {
          skyPoint(cur.LINES[i].u, cur.LINES[i].s, -1, 0, 0, inf, 0, pt, 0, 0, cur.wing);
          p.x = pt[0];
          p.y = pt[1];
          p.z = pt[2];
          crownDrape(p, crown, ch.canopyHeading, pt, 0);
          cur.leafAt[i].set(pt[0], pt[1], pt[2]);
        }
      }
      cur.geo.getAttribute("position").needsUpdate = true;
      cur.geo.computeVertexNormals();
      cur.shaped = "";
    }
    cur.canopy.position.set(0, 0, 0);
    cur.canopy.quaternion.identity();
    cur.canopy.scale.setScalar(1);
    cur.canopy.visible = true;
    // His risers up toward the point it is held at, and the lines on.
    let o = 0;
    tmp.set(s.x, s.y, s.z);
    for (let k = 0; k < 4; k++) {
      const side = k < 2 ? 0 : 1;
      riserTop[k]
        .copy(tmp)
        .sub(shoulders[side])
        .normalize()
        .multiplyScalar(RISER.length)
        .add(shoulders[side]);
      shoulders[side].toArray(cur.linePos, o);
      riserTop[k].toArray(cur.linePos, o + 3);
      o += 6;
      if (cur.feetOn) continue;
      riserTop[k].toArray(cur.linePos, o);
      tmp.toArray(cur.linePos, o + 3);
      o += 6;
    }
    if (cur.feetOn) {
      for (let i = 0; i < cur.LINES.length; i++) {
        const L = cur.LINES[i];
        const k = (L.side < 0 ? 0 : 2) + (L.front ? 0 : 1);
        riserTop[k].toArray(cur.linePos, o);
        cur.leafAt[i].toArray(cur.linePos, o + 3);
        o += 6;
      }
    }
    cur.lineGeo.getAttribute("position").needsUpdate = true;
    cur.lineGeo.setDrawRange(0, o / 3);
    cur.lines.visible = true;
  }

  /** THE RESERVE OPENING: no throw — the spring pilot chute launched off
   * the reserve tray at the top of his back the moment the handle is
   * pulled, the FREE BAG lifted off after it and the lines stripped out of
   * it to line stretch; then the bag and its pilot chute, fixed to nothing
   * on the canopy, fall away up the wind as the cloth snivels and fills
   * under the slider. */
  function reserveOpening(
    ch: ChuteState,
    d: NonNullable<ChuteState["deploy"]>,
    box: THREE.Vector3,
    toggles: boolean,
  ): void {
    const t = d.t;
    const R = CHUTE.reserve;
    const tray = onChest(0, GEAR.back.up + CHUTE.container.height * 0.4, GEAR.back.out, v3());
    const atBag = v3().set(d.bag.x, d.bag.y, d.bag.z);
    const atPilot = v3().set(d.pilot.x, d.pilot.y, d.pilot.z);
    // Sprung out of the tray over the first tenth of a second.
    const k = Math.min(1, t / SPRING);
    atPilot.lerpVectors(tray, atPilot, k * (2 - k));
    const stretch = R.deploy.stages[2].end;
    const out = t > stretch;
    const lifted = d.stage !== "pilot";
    if (out) {
      // The free bag and its pilot chute let go of at line stretch, slowed
      // by the air faster than he is and so rising off over the canopy.
      const away = t - stretch;
      tmp.copy(atBag).sub(box).normalize();
      atBag.addScaledVector(tmp, 1.2 + away * FREE_BAG);
      atPilot.copy(atBag).addScaledVector(tmp, R.pilot.bridle);
    } else if (!lifted) {
      atBag.copy(tray);
    }
    placePilot(atPilot, lifted || out ? atBag : tray, pilotOpen(t + 0.3, out));
    bag.visible = true;
    bag.position.copy(atBag);
    bag.quaternion.copy(jq).multiply(turn.setFromAxisAngle(tmp2.set(1, 0, 0), bagTurn(t, d.lines)));
    drawBridle(atBag, atPilot, R.pilot.bridle, t);
    farthest = { x: atPilot.x, y: atPilot.y, z: atPilot.z };
    if (!out) {
      // The lines paying out of the bag, bundled from the risers' rings.
      if (lifted) {
        let o = 0;
        for (const s of shoulders) {
          s.toArray(cur.linePos, o);
          atBag.toArray(cur.linePos, o + 3);
          o += 6;
        }
        cur.lineGeo.getAttribute("position").needsUpdate = true;
        cur.lineGeo.setDrawRange(0, o / 3);
        cur.lines.visible = true;
      }
      return;
    }
    // OUT OF THE BAG: the cloth snivelling, the slider coming down.
    hangCanopy(ch);
    cur.canopy.visible = true;
    shapeCloth(ch, d.spread, t, undefined);
    rigLines(ch, d.spread, d.slider, t, toggles);
    over = { x: canopyAt.x, y: canopyAt.y, z: canopyAt.z };
    if (t - stretch > FREE_GONE) pilot.visible = bag.visible = bridle.visible = false;
  }

  const hideAll = (): void => {
    pilot.visible = bag.visible = bridle.visible = false;
    for (const kit of kits) kit.canopy.visible = kit.lines.visible = kit.slider.visible = false;
    for (const r of risers) r.visible = false;
  };

  return {
    group,
    frame(state, alpha, wearer = null) {
      const ch = state.chute;
      const p = state.plane;
      const worn = rigWorn(state);
      group.visible = worn;
      over = farthest = null;
      if (!worn) return;
      const c = state.skier;
      observe(jumperTrack, c, state.tick);
      sample(jumperTrack, alpha, jumper);
      jq.set(jumper.q.x, jumper.q.y, jumper.q.z, jumper.q.w);
      wearing = wearer && !c.thrown ? wearer : null;
      wearing?.group.updateWorldMatrix(true, false);
      wear();
      gear.body.visible = !ownEyes && (!c.thrown || !!ch);
      hideAll();
      const shape = base ? null : skydiveShapeOf(ch ?? null, !!p?.rider);
      // The red pad punched out is carried off in his right hand.
      gear.pad.position.set(GEAR.webs + 0.012, GEAR.pads, GEAR.front + 0.014);
      gear.pad.visible = !base;
      if (shape && shape.punch > 0.5)
        gear.pad.position.copy(gear.body.worldToLocal(tmp.copy(hands[1])));
      if (ch?.mode === "released" && ch.t > 1.3) gear.pad.visible = false;
      gear.handle.visible =
        !ch || ch.mode === "ready" || ch.mode === "exit" || ch.mode === "freefall";
      // The reserve's handle in his left fist as he pulls it, then let go;
      // its tray's flap thrown open by the spring and left hanging open.
      const pulled = !!ch?.reserve;
      gear.reserveHandle.position.set(-GEAR.webs - 0.012, GEAR.pads, GEAR.front + 0.012);
      gear.reserveHandle.visible = !base && (!pulled || (!!shape && shape.reserve > 0.3));
      if (pulled && gear.reserveHandle.visible)
        gear.reserveHandle.position.copy(gear.body.worldToLocal(tmp.copy(hands[0])));
      gear.reserveFlap.rotation.x = pulled ? -1.9 : 0;
      if (!ch) return;
      const d = ch.deploy;
      // Each canopy let go of — the main cut away, the reserve landed under
      // — falling as cloth or lying on the snow, on its own clock.
      for (const [kit, piece] of [
        [base ? baseKit : mainKit, ch.piece],
        [reserveKit, ch.sparePiece],
      ] as const) {
        cur = kit;
        if (piece) {
          if (kit.cutAt < 0) kit.cutAt = state.t;
          cutaway(piece, state.t - kit.cutAt);
        } else kit.cutAt = -1;
      }
      cur = base ? baseKit : ch.reserve ? reserveKit : mainKit;
      if (ch.mode === "snagged") {
        drape(ch);
        return;
      }
      cur.draped = null;
      if (ch.mode !== "deploying" && ch.mode !== "open") return;
      observe(canopyTrack, { x: ch.x, y: ch.y, z: ch.z, q: jumper.q }, state.tick);
      sample(canopyTrack, alpha, canopyAt);
      const box = onChest(0, GEAR.back.up + 0.05, GEAR.back.out, v3());
      const toggles = base
        ? (wingsuitShapeOf(ch, false)?.hang ?? 0) > 0.5
        : !!shape && shape.hang > 0.5;
      if (ch.mode === "deploying" && d && ch.reserve) {
        reserveOpening(ch, d, box, toggles);
        return;
      }
      if (ch.mode === "deploying" && d) {
        const t = d.t;
        const atBag = v3().set(d.bag.x, d.bag.y, d.bag.z);
        const atPilot = v3().set(d.pilot.x, d.pilot.y, d.pilot.z);
        // THE PILOT CHUTE: crumpled in his fist until he lets it go, then
        // caught by the air and carried out to where the engine has it.
        if (t < THROW.out) {
          placePilot(hands[1], box, 0.18);
          farthest = { x: hands[1].x, y: hands[1].y, z: hands[1].z };
          return;
        }
        const k = Math.min(1, (t - THROW.out) / THROW.catch);
        atPilot.lerpVectors(hands[1], atPilot, k * k * (3 - 2 * k));
        const out = d.stage === "snivel" || d.stage === "inflate";
        // THE BAG on his back until the bridle lifts it, then up the wind,
        // tumbling as the lines strip out of it; over the canopy once out.
        const lifted = d.stage !== "pilot";
        const top = v3();
        if (out) {
          hangCanopy(ch);
          rigOver(0, top, atBag, atPilot);
        }
        placePilot(atPilot, out ? atBag : lifted ? atBag : box, pilotOpen(t - THROW.out, out));
        bag.visible = lifted;
        if (lifted) {
          bag.position.copy(atBag);
          bag.quaternion
            .copy(jq)
            .multiply(turn.setFromAxisAngle(tmp.set(1, 0, 0), bagTurn(t, d.lines)));
        }
        farthest = { x: atPilot.x, y: atPilot.y, z: atPilot.z };
        if (!out) {
          drawBridle(lifted ? atBag : box, atPilot, (base ? CHUTE.base : CHUTE).pilot.bridle, t);
          // The lines paying out of the bag, bundled from the risers' rings.
          if (lifted) {
            let o = 0;
            for (const s of shoulders) {
              s.toArray(cur.linePos, o);
              atBag.toArray(cur.linePos, o + 3);
              o += 6;
            }
            cur.lineGeo.getAttribute("position").needsUpdate = true;
            cur.lineGeo.setDrawRange(0, o / 3);
            cur.lines.visible = true;
          }
          return;
        }
        // OUT OF THE BAG: the cloth opening, the slider coming down.
        cur.canopy.visible = true;
        shapeCloth(ch, d.spread, t, undefined);
        rigLines(ch, d.spread, d.slider, t, toggles);
        drawBridle(top, atBag, top.distanceTo(atBag) + 0.05, t, atPilot);
        over = { x: canopyAt.x, y: canopyAt.y, z: canopyAt.z };
        return;
      }
      // FLYING: the canopy full and breathing, the pilot chute collapsed
      // and trailing on the bridle over the bag — the reserve's free bag and
      // its pilot chute gone off on the wind.
      hangCanopy(ch);
      cur.canopy.visible = true;
      shapeCloth(ch, 1, state.t, ch.t);
      rigLines(ch, 1, 0, state.t, toggles);
      over = { x: canopyAt.x, y: canopyAt.y, z: canopyAt.z };
      if (ch.reserve) return;
      // The air turning from rising past it to coming from ahead lays the
      // bag down on the top skin and the pilot chute back behind the tail.
      const fly = flownOver(ch.t);
      const top = v3();
      const atBag = v3();
      const atPilot = v3();
      rigOver(fly, top, atBag, atPilot);
      bag.visible = true;
      bag.position.copy(atBag);
      bag.quaternion.copy(cur.canopy.quaternion);
      placePilot(atPilot, atBag, pilotOpen(0, true));
      drawBridle(top, atBag, top.distanceTo(atBag) + 0.05, state.t, atPilot);
      over = { x: canopyAt.x, y: canopyAt.y, z: canopyAt.z };
    },
    canopy: () => over,
    opening: () => farthest,
    jumper: () => (group.visible ? { x: jumper.x, y: jumper.y, z: jumper.z } : null),
    eyes() {
      if (!group.visible || !wearing) return null;
      const f = wearing.frames.head;
      const w = wearing.group.matrixWorld;
      eyes.at
        .set(
          f.head.x + f.y.x * EYES.up + f.z.x * EYES.out,
          f.head.y + f.y.y * EYES.up + f.z.y * EYES.out,
          f.head.z + f.y.z * EYES.up + f.z.z * EYES.out,
        )
        .applyMatrix4(w);
      eyes.face.set(f.z.x, f.z.y, f.z.z).transformDirection(w);
      eyes.up.set(f.y.x, f.y.y, f.y.z).transformDirection(w);
      return eyes;
    },
    setOwnEyes(on) {
      ownEyes = on;
      if (on) gear.body.visible = gear.legs[0].visible = gear.legs[1].visible = false;
    },
    dispose() {
      gear.dispose();
      for (const g of [dome, skirt, bagGeo, bridleGeo, riserGeo]) g.dispose();
      for (const kit of kits) for (const g of [kit.geo, kit.sliderGeo, kit.lineGeo]) g.dispose();
      for (const m of mats) m.dispose();
      lineMat.dispose();
      bridleMat.dispose();
    },
  };
}
