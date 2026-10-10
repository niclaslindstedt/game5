// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKYDIVE IN THE RENDERER (`chute.ts`) — the stand-in the run draws
// until a modelled rig is made: the CONTAINER on the jumper's back from the
// plane's door to the snow; the opening as the engine stages it — the pilot
// chute out on its bridle, the bag lifted off his back, the lines paying
// out, the canopy snivelling with the slider held at its top and spreading
// as the slider comes down; the open CANOPY (the paramotor's own cloth,
// `para-canopy.ts`, sized to the main's span and chord) on its lines to his
// shoulders, its trailing edge pulled down by the toggles; the canopy CUT
// AWAY streaming down and lying on the snow; and caught in a crown or on a
// lift, hung where the engine holds it. Drawn between two steps on the
// jumper's own line (`interp.ts`).

import * as THREE from "three";
import { CHUTE, type ChuteState, type GameState } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createTrack, observe, sample, type Pose } from "./interp.ts";
import { CANOPY, PAINT_GLSL, canopyLayout, canopyPoint, shapeCanopy } from "./para-canopy.ts";
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
  dispose(): void;
};

/** The paramotor's cloth sized to the main: span and chord, shares. */
const SPAN = CHUTE.canopy.span / CANOPY.span;
const CHORD = CHUTE.canopy.chord / CANOPY.chord;
/** The container's middle on his back, in his body frame, m (and up his
 * chest bone and out behind it, m, on a posed figure). */
const BACK = { x: 0, y: 0.18, z: -0.2 };
const ON_CHEST = { up: 0.2, back: 0.17 };
/** His shoulders, where the risers meet the harness, body frame, m. */
const SHOULDER = { x: 0.2, y: 0.42, z: -0.12 };
/** The canopy's underside the lines are drawn from: across its span and
 * along its chord (`canopyPoint`'s `u`, `s`). */
const LEAVES = [-0.85, -0.45, 0.45, 0.85].flatMap((u) => [0.12, 0.62].map((s) => ({ u, s })));

const UP = new THREE.Vector3(0, 1, 0);

export function createChuteScene(haze: HazeUniforms): ChuteScene {
  const group = new THREE.Group();
  group.name = "skydive";
  group.visible = false;

  const std = (color: number, roughness: number): THREE.MeshStandardMaterial =>
    hazeMaterial(
      new THREE.MeshStandardMaterial({ color, roughness, flatShading: true }),
      haze,
      "chute",
    );
  const rigDark = std(0x1d2128, 0.7);
  const rigTrim = std(0xe0b030, 0.6);

  // THE CONTAINER on his back, its reserve flap a shade of its own.
  const K = CHUTE.container;
  const container = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(K.width, K.height, K.depth), rigDark);
  const flap = new THREE.Mesh(new THREE.BoxGeometry(K.width * 0.9, K.height * 0.35, 0.02), rigTrim);
  flap.position.set(0, K.height * 0.28, -K.depth / 2 - 0.005);
  container.add(box, flap);
  group.add(container);

  // THE PILOT CHUTE, THE BAG and THE SLIDER of the opening.
  const pilot = new THREE.Mesh(
    new THREE.SphereGeometry(CHUTE.pilot.diameter / 2, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2),
    std(0xd8432c, 0.6),
  );
  pilot.material.side = THREE.DoubleSide;
  const B = CHUTE.bag;
  const bag = new THREE.Mesh(new THREE.BoxGeometry(B.width, B.height, B.depth), rigDark);
  const S = CHUTE.canopy.slider;
  const slider = new THREE.Mesh(new THREE.BoxGeometry(S.width, 0.01, S.length), rigTrim);
  group.add(pilot, bag, slider);

  // THE CANOPY: the paramotor's cloth, its paint, sized to the main.
  const layout = canopyLayout();
  const geo = new THREE.BufferGeometry();
  const skin = new Float32Array(layout.vertices * 3);
  shapeCanopy(skin, 0, 0);
  geo.setAttribute("position", new THREE.BufferAttribute(skin, 3));
  geo.setAttribute("aPaint", new THREE.BufferAttribute(layout.paint, 3));
  geo.setIndex(new THREE.BufferAttribute(layout.index, 1));
  geo.computeVertexNormals();
  const cloth = hazeMaterial(
    new THREE.MeshStandardMaterial({ roughness: 0.62, metalness: 0, side: THREE.DoubleSide }),
    haze,
    "para-cloth",
    (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute vec3 aPaint;\nvarying vec3 vPaint;",
        )
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPaint = aPaint;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\nvarying vec3 vPaint;\n${PAINT_GLSL}`)
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\ndiffuseColor.rgb *= canopyPaint(vPaint);",
        );
    },
  );
  const canopy = new THREE.Mesh(geo, cloth);
  canopy.frustumCulled = false;
  group.add(canopy);
  let shapedL = 0;
  let shapedR = 0;

  // THE LINES: from the canopy's underside to his shoulders, and the
  // bridle from his back to the pilot chute.
  const segments = LEAVES.length + 1;
  const linePos = new Float32Array(segments * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({ color: 0xc8c8c0 });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  group.add(lines);
  const leafLocal = LEAVES.map(({ u, s }) => {
    const out = new Float32Array(3);
    canopyPoint(u, s, -1, 0, 0, out, 0);
    return new THREE.Vector3(out[0] * SPAN, out[1], out[2] * CHORD);
  });

  const jumperTrack = createTrack();
  const canopyTrack = createTrack();
  const jumper: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const canopyAt: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const jq = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const turn = new THREE.Quaternion();
  let over: { x: number; y: number; z: number } | null = null;

  /** A point of his body frame in the world, as drawn. */
  const onHim = (b: { x: number; y: number; z: number }, out: THREE.Vector3): THREE.Vector3 =>
    out
      .set(b.x, b.y, b.z)
      .applyQuaternion(jq)
      .add(tmp2.set(jumper.x, jumper.y, jumper.z));
  let wearing: Wearer | null = null;
  const chestQ = new THREE.Quaternion();
  const chestM = new THREE.Matrix4();
  const ax = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  /** His back, where the container sits: on the posed figure's chest. */
  function backOf(out: THREE.Vector3): THREE.Vector3 {
    if (!wearing) return onHim(BACK, out);
    const c = wearing.frames.chest;
    out
      .set(c.head.x, c.head.y, c.head.z)
      .addScaledVector(ax[0].set(c.y.x, c.y.y, c.y.z), ON_CHEST.up)
      .addScaledVector(ax[1].set(c.z.x, c.z.y, c.z.z), -ON_CHEST.back);
    return out.applyMatrix4(wearing.group.matrixWorld);
  }
  /** A shoulder, left (−1) or right: the posed figure's own. */
  function shoulderOf(side: number, out: THREE.Vector3): THREE.Vector3 {
    if (!wearing) return onHim({ ...SHOULDER, x: SHOULDER.x * side }, out);
    const h = wearing.frames[side < 0 ? "shoulder_l" : "shoulder_r"].head;
    return out.set(h.x, h.y, h.z).applyMatrix4(wearing.group.matrixWorld);
  }

  /** The canopy turned up its lines from his shoulders and along its
   * heading, its nose pitched by the swing, opened `spread` of the way. */
  function hangCanopy(ch: ChuteState, spread: number): void {
    up.set(canopyAt.x - jumper.x, canopyAt.y - jumper.y, canopyAt.z - jumper.z);
    if (up.lengthSq() < 1e-6) up.copy(UP);
    up.normalize();
    fwd.set(Math.sin(ch.canopyHeading), 0, Math.cos(ch.canopyHeading));
    fwd.addScaledVector(up, -fwd.dot(up));
    if (fwd.lengthSq() < 1e-6) fwd.set(0, 0, 1);
    fwd.normalize();
    right.crossVectors(up, fwd);
    basis.makeBasis(right, up, fwd);
    canopy.quaternion.setFromRotationMatrix(basis);
    canopy.quaternion.multiply(turn.setFromAxisAngle(tmp.set(1, 0, 0), -ch.pitch * 0.6));
    canopy.position.set(canopyAt.x, canopyAt.y, canopyAt.z);
    // Snivelling, the cloth is bunched along its span and its chord.
    const k = 0.2 + 0.8 * spread;
    canopy.scale.set(SPAN * k, 0.6 + 0.4 * spread, CHORD * (0.45 + 0.55 * spread));
    const { brake, steer } = ch.controls;
    const l = Math.min(1, brake + Math.max(0, -steer));
    const r = Math.min(1, brake + Math.max(0, steer));
    if (Math.abs(l - shapedL) > 0.02 || Math.abs(r - shapedR) > 0.02) {
      shapeCanopy(skin, l, r);
      geo.getAttribute("position").needsUpdate = true;
      geo.computeVertexNormals();
      shapedL = l;
      shapedR = r;
    }
  }

  /** The lines from the canopy as it hangs to his shoulders; the bridle
   * from his back to `to` (or folded away). */
  function drawLines(to: THREE.Vector3 | null, showLines: boolean): void {
    canopy.updateMatrixWorld();
    const sh = [shoulderOf(-1, new THREE.Vector3()), shoulderOf(1, new THREE.Vector3())];
    for (let i = 0; i < LEAVES.length; i++) {
      if (showLines) {
        tmp.set(leafLocal[i].x / SPAN, leafLocal[i].y, leafLocal[i].z / CHORD);
        tmp.applyMatrix4(canopy.matrixWorld);
      } else tmp.copy(sh[0]);
      tmp.toArray(linePos, i * 6);
      (showLines ? sh[LEAVES[i].u < 0 ? 0 : 1] : sh[0]).toArray(linePos, i * 6 + 3);
    }
    const back = backOf(new THREE.Vector3());
    back.toArray(linePos, LEAVES.length * 6);
    (to ?? back).toArray(linePos, LEAVES.length * 6 + 3);
    lineGeo.getAttribute("position").needsUpdate = true;
  }

  return {
    group,
    frame(state, alpha, wearer = null) {
      const ch = state.chute;
      const p = state.plane;
      const worn = !!ch || !!p?.rider;
      group.visible = worn;
      over = null;
      if (!worn) return;
      const c = state.skier;
      observe(jumperTrack, c, state.tick);
      sample(jumperTrack, alpha, jumper);
      jq.set(jumper.q.x, jumper.q.y, jumper.q.z, jumper.q.w);
      // The container on his back from the door to the snow, turned with
      // his chest as posed.
      wearing = wearer && !c.thrown ? wearer : null;
      wearing?.group.updateWorldMatrix(true, false);
      backOf(container.position);
      if (wearing) {
        const f = wearing.frames.chest;
        chestM.makeBasis(
          ax[0].set(f.x.x, f.x.y, f.x.z),
          ax[1].set(f.y.x, f.y.y, f.y.z),
          ax[2].set(f.z.x, f.z.y, f.z.z),
        );
        chestQ.setFromRotationMatrix(chestM);
        wearing.group.getWorldQuaternion(container.quaternion).multiply(chestQ);
      } else container.quaternion.copy(jq);
      container.visible = !c.thrown || !!ch;
      pilot.visible = bag.visible = slider.visible = canopy.visible = lines.visible = false;
      if (!ch) return;

      const d = ch.deploy;
      const deploying = ch.mode === "deploying";
      const flying = ch.mode === "open" || ch.mode === "snagged";
      observe(canopyTrack, { x: ch.x, y: ch.y, z: ch.z, q: jumper.q }, state.tick);
      sample(canopyTrack, alpha, canopyAt);
      let bridleTo: THREE.Vector3 | null = null;
      if (deploying && d) {
        // THE PILOT CHUTE out on its bridle, mouth to the air.
        pilot.visible = true;
        pilot.position.set(d.pilot.x, d.pilot.y, d.pilot.z);
        pilot.quaternion.identity();
        bridleTo = pilot.position.clone();
        // THE BAG lifted off his back until the lines are out; then the
        // canopy out of it, snivelling, the slider coming down the lines.
        const out = d.stage === "snivel" || d.stage === "inflate";
        bag.visible = !out;
        if (!out) {
          bag.position.set(d.bag.x, d.bag.y, d.bag.z);
          bag.quaternion.copy(jq);
        }
        if (d.lines > 0.6 || out) {
          canopy.visible = lines.visible = true;
          hangCanopy(ch, out ? d.spread : 0);
          slider.visible = true;
          const sh = backOf(new THREE.Vector3());
          slider.position.lerpVectors(sh, canopy.position, 0.2 + 0.75 * d.slider);
          slider.quaternion.copy(canopy.quaternion);
          over = { x: canopyAt.x, y: canopyAt.y, z: canopyAt.z };
        }
        drawLines(bridleTo, canopy.visible);
        lines.visible = true;
        return;
      }
      if (flying) {
        canopy.visible = lines.visible = true;
        hangCanopy(ch, 1);
        drawLines(null, true);
        over = { x: canopyAt.x, y: canopyAt.y, z: canopyAt.z };
        return;
      }
      // THE CANOPY LET GO: streaming down bunched as cloth, then lying on
      // the snow flat along the way it fell.
      const piece = ch.piece;
      if (piece) {
        canopy.visible = true;
        canopy.position.set(piece.x, piece.y + (piece.down ? 0.15 : 1.2), piece.z);
        canopy.quaternion.setFromAxisAngle(UP, piece.heading);
        if (piece.down) canopy.scale.set(SPAN, 0.2, CHORD);
        else canopy.scale.set(SPAN * 0.35, 0.7, CHORD * 0.4);
      }
    },
    canopy: () => over,
    dispose() {
      group.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) o.geometry.dispose();
      });
      rigDark.dispose();
      rigTrim.dispose();
      pilot.material.dispose();
      cloth.dispose();
      lineMat.dispose();
    },
  };
}
