// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON IN THE RENDERER — a STAND-IN, so a balloon ride is not
// invisible while its real model is built: the envelope as a lathed
// teardrop to the class's measures (`BALLOON.envelope`), the basket as a box
// to its floor and wall, four cables from the basket's corners to the mouth,
// hung on the engine's state (`GameState.balloon`) — the basket tilted as
// the engine tilts it, the envelope leant over by the air past it and laid
// down on the snow as it deflates, its glow lifted by the burner's flame
// and blackened as it burns. Built only where a run carries a balloon.

import * as THREE from "three";
import { BALLOON, type BalloonState, type GameState } from "@engine";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";

export type BalloonScene = {
  group: THREE.Group;
  /** One frame: the balloon where the engine has it, or hidden. */
  frame(state: GameState): void;
  dispose(): void;
};

const E = BALLOON.envelope;
const K = BALLOON.basket;

/** The envelope's profile, mouth (y 0) to crown (y = height): the radius at
 * each height — a natural shape, narrow at the throat, widest at the
 * equator, rounded over the crown. */
function profile(): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  const R = E.diameter / 2;
  const n = 24;
  for (let i = 0; i <= n; i++) {
    const y = (i / n) * E.height;
    let r: number;
    if (y <= E.equator) {
      // The throat up to the equator: a cone eased into the widest girth.
      const u = y / E.equator;
      r = E.mouth / 2 + (R - E.mouth / 2) * Math.sin((u * Math.PI) / 2);
    } else {
      // The equator over the crown: a quarter ellipse.
      const u = (y - E.equator) / (E.height - E.equator);
      r = R * Math.sqrt(Math.max(0, 1 - u * u));
    }
    pts.push(new THREE.Vector2(Math.max(0.01, r), y));
  }
  return pts;
}

export function createBalloonScene(haze: HazeUniforms): BalloonScene {
  const group = new THREE.Group();
  group.name = "balloon";
  group.visible = false;
  const fabric = hazeMaterial(
    new THREE.MeshStandardMaterial({
      color: 0xd8462b,
      roughness: 0.7,
      side: THREE.DoubleSide,
      emissive: 0xff8a2a,
      emissiveIntensity: 0,
    }),
    haze,
    "balloon-fabric",
  );
  const wicker = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0x8a6237, roughness: 0.9 }),
    haze,
    "balloon-wicker",
  );
  const envelope = new THREE.Mesh(new THREE.LatheGeometry(profile(), E.gores), fabric);
  // Its pivot at the mouth, which hangs over the basket.
  const hang = new THREE.Group();
  hang.position.y = E.mouthHeight;
  hang.add(envelope);
  const basket = new THREE.Mesh(new THREE.BoxGeometry(K.width, K.wall, K.length), wicker);
  basket.position.y = K.wall / 2;
  const body = new THREE.Group();
  body.add(basket);
  // The cables from the basket's corners to the mouth's rim.
  const cablePts: number[] = [];
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    cablePts.push((sx * K.width) / 2, K.wall, (sz * K.length) / 2);
    cablePts.push((sx * E.mouth) / 2.8, E.mouthHeight, (sz * E.mouth) / 2.8);
  }
  const cableGeo = new THREE.BufferGeometry();
  cableGeo.setAttribute("position", new THREE.Float32BufferAttribute(cablePts, 3));
  const cables = new THREE.LineSegments(cableGeo, new THREE.LineBasicMaterial({ color: 0x333333 }));
  body.add(cables);
  group.add(body, hang);
  const euler = new THREE.Euler(0, 0, 0, "YXZ");

  function place(b: BalloonState): void {
    group.position.set(b.x, b.y, b.z);
    // The basket: its heading, its pitch (nose up) and roll (right down).
    euler.set(-b.pitch, b.heading, -b.roll, "YXZ");
    body.rotation.copy(euler);
    // The envelope: leant over toward `leanTo` by `lean`, and on the snow
    // laid down as it deflates.
    const lay = b.mode === "down" ? b.deflate * (Math.PI / 2 - 0.1) : 0;
    const lean = Math.min(Math.PI / 2 - 0.05, b.lean * 0.5 + lay);
    const ax = Math.cos(b.leanTo);
    const az = -Math.sin(b.leanTo);
    hang.quaternion.setFromAxisAngle(new THREE.Vector3(ax, 0, az), lean);
    hang.scale.setScalar(Math.max(0.15, 1 - b.burnt * 0.8));
    fabric.emissiveIntensity = b.flame * 0.35;
    fabric.color.setHex(b.burning ? 0x3a2a24 : 0xd8462b);
  }

  return {
    group,
    frame(state) {
      const b = state.balloon;
      group.visible = !!b;
      if (b) place(b);
    },
    dispose() {
      envelope.geometry.dispose();
      basket.geometry.dispose();
      cableGeo.dispose();
      fabric.dispose();
      wicker.dispose();
      (cables.material as THREE.Material).dispose();
    },
  };
}
