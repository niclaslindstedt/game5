// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HOT AIR BALLOON IN THE RENDERER — the envelope (`balloon-envelope.ts`)
// and the basket with its burner (`balloon-basket.ts`), built in code to the
// class's measures (`balloon-look.ts`) and hung on the engine's state
// (`GameState.balloon`): the basket where the engine has it, drawn between
// two steps as the skier is (`interp.ts`), tilted by his weight and the
// snow; the envelope hung over it from the burner frame, leant over by the
// air past it and its windward side pushed in, its parachute pulled down by
// the cord, glowing from inside with the burner's flame, scorched, burnt
// through and shrunk as it burns, and tipped over and laid flat on the snow
// as it deflates; the sixteen flying wires from the load tapes' feet to the
// frame's corners, the parachute's shroud lines and its cord down to the
// basket; the skier's pair racked in the free corner while he is aboard;
// and in the colourway its map deals it (`colourwayOf`). Built on every
// free ride, drawn only while a run carries a balloon. `make balloon` is
// its lab.
//
// THE HOOKS other drawings hang off (`BalloonScene`): the burner's outlets
// in the world, where a flame leaves the coils; the envelope's glow, burnt
// and scorch uniforms; the drawn basket and envelope frames.

import * as THREE from "three";
import { BALLOON, TUNING, type BalloonState, type GameState, type Level } from "@engine";

import { createBasket } from "./balloon-basket.ts";
import { createEnvelopeFire } from "./balloon-fire.ts";
import {
  FLAME,
  catchPoint,
  fireFront,
  flameBend,
  flameMemory,
  stepFlame,
  type FlameNow,
} from "./balloon-fire-plan.ts";
import { createBurnerFlame } from "./balloon-flame.ts";
import { createEnvelope, MOUTH_OVER_FRAME, type EnvelopeLook } from "./balloon-envelope.ts";
import {
  BURNER_LOOK,
  ENVELOPE_LOOK,
  PALETTES,
  colourwayOf,
  envelopeLayout,
  wirePlan,
  type Colourway,
  type Lay,
} from "./balloon-look.ts";
import type { Flood } from "./headlamp.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createTrack, observe, sample, type Pose } from "./interp.ts";
import { lineLightOf, litLine, type LineLight } from "./para-motor.ts";
import type { SkyLook } from "./sky.ts";
import { TOPSHEETS } from "./ski-topsheets.ts";

export type BalloonScene = {
  group: THREE.Group;
  /** One frame: the balloon where the engine has it, `alpha` of the way to
   * the next step, its burner's flame and its fire moved on `dt` s — or
   * hidden. */
  frame(state: GameState, alpha: number, dt: number): void;
  /** THE FIRE'S LIGHTS and the eye it is drawn for: the burner's flame and
   * a burning envelope each a lamp (`headlamp.ts`'s `Flood`), pushed onto
   * `out`; the fire's smoke and flames sorted back to front from `eye`. */
  lamps(eye: THREE.Vector3, out: Flood[]): void;
  /** How hard the burner roars (0 out … over 1 at its ignition) and how
   * much of the envelope is ablaze, 0..1, as drawn — what a sound or a
   * lens may follow. */
  roar(): number;
  blaze(): number;
  /** The sky's light on the lines and through the cloth. */
  light(look: SkyLook): void;
  /** THE BURNER'S OUTLETS in the world, as last drawn: where each coil's
   * flame leaves it, pointing up the envelope's axis (`up`). */
  outlets(out: THREE.Vector3[], up?: THREE.Vector3): void;
  /** The envelope's look a fire drives (`EnvelopeLook`). */
  look: EnvelopeLook;
  /** The basket's frame (its floor's centre, heading, pitch and roll) and
   * the envelope's (its mouth's centre, up its axis), as last drawn. */
  basket: THREE.Object3D;
  envelope: THREE.Object3D;
  dispose(): void;
};

const E = BALLOON.envelope;
/** The envelope drawn leant over by this much of the engine's lean, and
 * never past `LEAN_MOST`, rad. */
const LEAN_DRAWN = 1;
const LEAN_MOST = 0.75;
/** The envelope's frame over the hang's: its mouth over the burner frame. */
const MOUTH_UP = new THREE.Matrix4().makeTranslation(0, MOUTH_OVER_FRAME, 0);

/** A LAB'S COLOURWAY (`make balloon`'s every-colourway sheet): every
 * balloon drawn in it rather than in its map's own, until set back to null.
 * Nothing in the game sets it. */
let labPaint: Colourway | null = null;
export function paintEveryBalloon(c: Colourway | null): void {
  labPaint = c;
}

export function createBalloonScene(haze: HazeUniforms): BalloonScene {
  // The whole drawing, in the world; the rig under it carried to the
  // basket, the flame and the fire in the world beside it.
  const root = new THREE.Group();
  root.name = "balloon";
  const group = new THREE.Group();
  group.name = "balloon-rig";
  group.visible = false;
  root.add(group);
  const burner = createBurnerFlame();
  const fire = createEnvelopeFire();
  root.add(burner.group, fire.group);
  const body = new THREE.Group();
  body.name = "balloon-basket-frame";
  const basket = createBasket(haze);
  body.add(basket.group);
  // The envelope hangs from the burner frame, its mouth over it.
  const hang = new THREE.Group();
  hang.name = "balloon-envelope-frame";
  const envelope = createEnvelope(haze);
  const mesh = envelope.mesh;
  mesh.position.y = MOUTH_OVER_FRAME;
  hang.add(mesh);
  group.add(body, hang);

  // THE FLYING WIRES: thin steel, sixteen.
  const wires = wirePlan();
  const wireGeo = new THREE.CylinderGeometry(1, 1, 1, 4, 1, true);
  wireGeo.translate(0, 0.5, 0);
  const wireMat = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.35, metalness: 0.8 }),
    haze,
    "balloon-wire",
  );
  const wireMesh = new THREE.InstancedMesh(wireGeo, wireMat, wires.length);
  wireMesh.frustumCulled = false;
  group.add(wireMesh);

  // THE PARACHUTE'S LINES: a shroud line off every gore at its rim down the
  // inside wall, the centre lines gathered under the crown, and the cord
  // from there down to the basket.
  const layout = envelopeLayout();
  const L = ENVELOPE_LOOK;
  const nu = L.across + 1;
  const segments = E.gores * 2 + 1;
  const linePos = new Float32Array(segments * 6);
  const lineCol = new Float32Array(segments * 6);
  for (let i = 0; i < segments; i++) {
    const rgb = i === segments - 1 ? [0.75, 0.12, 0.1] : [0.85, 0.85, 0.82];
    lineCol.set(rgb, i * 6);
    lineCol.set(rgb, i * 6 + 3);
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute("color", new THREE.BufferAttribute(lineCol, 3));
  const lineLight: LineLight = { value: new THREE.Color(1, 1, 1) };
  const lineMat = litLine(
    new THREE.LineBasicMaterial({ vertexColors: true }),
    haze,
    "balloon-line",
    lineLight,
  );
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  group.add(lines);
  /** Vertices of the mesh the lines are tied to: each gore's parachute rim
   * at its seam, the wall a few panels under it, and the crown. */
  const rimAt = (g: number): number => layout.capFrom + g * nu * (L.cap + 1);
  const wallAt = (g: number): number =>
    g * L.rows * nu * (L.down + 1) + (L.rows - 5) * nu * (L.down + 1);
  const crownAt = layout.capFrom + L.cap * nu;

  const track = createTrack();
  const pose: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const drawn: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  const quat = new THREE.Quaternion();
  const yaw = new THREE.Quaternion();
  const tip = new THREE.Quaternion();
  const axis = new THREE.Vector3();
  const UP = new THREE.Vector3(0, 1, 0);
  const meshM = new THREE.Matrix4();
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const inst = new THREE.Matrix4();
  const instQ = new THREE.Quaternion();
  const instS = new THREE.Vector3();
  const frameM = new THREE.Matrix4();
  const gather = new THREE.Vector3();
  let painted: Colourway | null = null;
  let seed = NaN;
  let level: Level | null = null;
  const lay: Lay = {
    x: 0,
    z: 0,
    heading: 0,
    groundAt: (x, z) => level?.groundAt(x, z) ?? 0,
    ox: 0,
    oy: 0,
    oz: 0,
  };
  let laidDown = false;

  // THE FLAME AND THE FIRE: what the flame remembers, where the fire caught
  // (the envelope's own frame) and how far its spread reaches.
  const memory = flameMemory();
  const now: FlameNow = { length: 0, cut: 0, burst: 0, bright: 0 };
  const outs = [new THREE.Vector3(), new THREE.Vector3()];
  const flameUp = new THREE.Vector3();
  const bend = new THREE.Vector3();
  const caught = [0, 0, 0];
  let held = false;
  let night = 0;
  const burnerLamp: Flood = {
    x: 0,
    y: 0,
    z: 0,
    dx: 0,
    dy: -1,
    dz: 0,
    colour: FLAME.light.colour,
    beam: [-2, -1.5, -3, 0],
    power: 0,
  };

  function paint(c: Colourway): void {
    if (painted && painted.scheme === c.scheme && painted.palette === c.palette) return;
    painted = c;
    envelope.paint(c);
    basket.paint(PALETTES[c.palette][3]);
  }

  function place(state: GameState, b: BalloonState, alpha: number): void {
    // THE BASKET, drawn between two steps.
    euler.set(-b.pitch, b.heading, -b.roll, "YXZ");
    quat.setFromEuler(euler);
    pose.x = b.x;
    pose.y = b.y;
    pose.z = b.z;
    pose.q.x = quat.x;
    pose.q.y = quat.y;
    pose.q.z = quat.z;
    pose.q.w = quat.w;
    observe(track, pose, state.tick);
    sample(track, alpha, drawn);
    group.position.set(drawn.x, drawn.y, drawn.z);
    body.quaternion.set(drawn.q.x, drawn.q.y, drawn.q.z, drawn.q.w);
    // THE ENVELOPE hung from the burner frame (which the basket carries),
    // leant over toward `leanTo`, and on the snow tipped over to lie down.
    hang.position.set(0, BURNER_LOOK.frameY, 0).applyQuaternion(body.quaternion);
    const down = b.mode === "down" ? b.deflate : 0;
    const lean = Math.min(LEAN_MOST, b.lean * LEAN_DRAWN);
    const towards = b.wind > 0.3 || b.lean > 0.01 ? b.leanTo : b.heading;
    yaw.setFromAxisAngle(UP, b.heading);
    axis.set(Math.cos(towards), 0, -Math.sin(towards));
    const tipped = lean + (Math.PI / 2 - 0.12 - lean) * smooth(Math.min(1, down / 0.6));
    tip.setFromAxisAngle(axis, tipped);
    hang.quaternion.multiplyQuaternions(tip, yaw);
    // ...and lowered toward the snow as it goes over.
    hang.position.y -= down * (BURNER_LOOK.frameY - 0.5);
    // The air past it pushes its windward side in.
    const dentFrom = b.leanTo + Math.PI - b.heading;
    const dent = b.mode === "down" ? 0 : Math.min(3, Math.max(0, (b.shear - 2) * 0.35));
    hang.updateMatrix();
    frameM.multiplyMatrices(hang.matrix, MOUTH_UP);
    lay.ox = drawn.x;
    lay.oy = drawn.y;
    lay.oz = drawn.z;
    lay.heading = towards;
    lay.x = Math.sin(towards) * 1.6;
    lay.z = Math.cos(towards) * 1.6;
    const laid = envelope.shape({
      dent,
      dentFrom,
      vent: b.vent,
      burnt: b.burnt,
      lay: down,
      laid: down > 0 ? lay : null,
      frame: frameM,
    });
    if (laid !== laidDown) {
      laidDown = laid;
      if (laid) group.add(mesh);
      else hang.add(mesh);
      mesh.position.set(0, laid ? 0 : MOUTH_OVER_FRAME, 0);
      mesh.quaternion.identity();
    }
    // THE LOOK: the burner's light inside, the fire.
    envelope.look.glow.value = b.flame;
    envelope.look.burnt.value = b.burnt;
    envelope.look.scorch.value = b.scorch;
    // THE PAIR racked while he is aboard.
    if (b.aboard) {
      const top = TOPSHEETS[state.skier.spec.id];
      basket.rack(true, state.skier.spec.length, top.body, top.trim);
    } else basket.rack(false);
  }

  /** The mesh's frame in the group's, as drawn. */
  function meshMatrix(out: THREE.Matrix4): THREE.Matrix4 {
    if (laidDown) return out.identity();
    hang.updateMatrix();
    mesh.updateMatrix();
    return out.multiplyMatrices(hang.matrix, mesh.matrix);
  }

  function rig(b: BalloonState): void {
    meshMatrix(meshM);
    body.updateMatrix();
    for (let i = 0; i < wires.length; i++) {
      const w = wires[i];
      envelope.mouthPoint(i, tmpA).applyMatrix4(meshM);
      tmpB.set(w.corner[0], w.corner[1], w.corner[2]).applyMatrix4(body.matrix);
      dir.subVectors(tmpA, tmpB);
      const len = dir.length();
      instQ.setFromUnitVectors(UP, dir.multiplyScalar(1 / Math.max(1e-4, len)));
      instS.set(0.008, len, 0.008);
      inst.compose(tmpB, instQ, instS);
      wireMesh.setMatrixAt(i, inst);
    }
    wireMesh.instanceMatrix.needsUpdate = true;
    // The lines hang inside a standing envelope only.
    lines.visible = !laidDown && b.burnt < 0.5;
    if (!lines.visible) return;
    const pos = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
    let k = 0;
    const put = (v: THREE.Vector3): void => {
      v.toArray(linePos, k);
      k += 3;
    };
    // The gather point a few metres under the crown, on the axis.
    tmpA.fromBufferAttribute(pos, crownAt);
    gather.set(0, tmpA.y - 3.2, 0).applyMatrix4(meshM);
    for (let g = 0; g < E.gores; g++) {
      put(tmpA.fromBufferAttribute(pos, rimAt(g)).applyMatrix4(meshM));
      put(tmpB.fromBufferAttribute(pos, wallAt(g)).applyMatrix4(meshM));
      put(tmpA.fromBufferAttribute(pos, rimAt(g)).applyMatrix4(meshM));
      put(gather);
    }
    // The cord down to the pilot's corner of the rim.
    put(gather);
    put(tmpB.set(0.45, BALLOON.basket.wall + 0.1, -0.6).applyMatrix4(body.matrix));
    lineGeo.attributes.position.needsUpdate = true;
  }

  /** WHERE THE FIRE CATCHES: while it scorches, the windward side of the
   * mouth in a shear (or the crown, cooked); once alight, held there. */
  function catchOf(b: BalloonState): void {
    if (!b.burning && b.scorch <= 0) {
      held = false;
      return;
    }
    if (held) return;
    const windward = b.shear > BALLOON.fire.shear * 0.9;
    catchPoint(windward, b.leanTo + Math.PI - b.heading, caught);
    if (b.burning) held = true;
  }

  /** The burner's flame and the fire, a frame. */
  function burn(state: GameState, b: BalloonState, alpha: number, dt: number): void {
    const t = state.t + alpha * TUNING.dt;
    stepFlame(memory, b.valve, b.flame, dt, now);
    root.updateMatrixWorld();
    for (let i = 0; i < basket.outlets.length && i < outs.length; i++) {
      outs[i].copy(basket.outlets[i]).applyMatrix4(body.matrixWorld);
    }
    flameUp.set(0, 1, 0).applyQuaternion(hang.quaternion);
    // The air past the burner lays the flame over the way the envelope leans.
    const lay = flameBend(b.shear) * now.length;
    bend.set(Math.sin(b.leanTo) * lay, 0, Math.cos(b.leanTo) * lay);
    const pilot = b.pilot && b.mode !== "down" && b.burnt < 0.9;
    if (b.mode === "down") burner.hide();
    else burner.draw(outs, flameUp, now, pilot, bend, t, night);
    // The envelope a lantern: its glow follows the flame as drawn, the
    // tail's last light included, flickering as the flame does — and the
    // fire's own light inside it as it burns.
    const flick = 0.93 + 0.07 * Math.sin(t * 29) * Math.sin(t * 11.3);
    const lit = b.mode === "down" ? 0 : Math.min(1.2, Math.max(b.flame, now.bright * 0.8));
    // After dark the eye is open to it, and the lantern is the brightest
    // thing in the sky.
    envelope.look.glow.value = (lit * flick + 0.6 * fire.blaze()) * (1 + 2.2 * night);
    catchOf(b);
    envelope.look.catchAt.value.set(caught[0], caught[1], caught[2]);
    envelope.look.time.value = t;
    mesh.updateMatrixWorld();
    fire.update(b, mesh, layout.position, caught, dt, lay0);
    envelope.look.front.value = fireFront(b.burnt, fire.reach());
    // The burner's light: from a third of the way up the flame.
    const mid = now.length * FLAME.light.at;
    burnerLamp.x = (outs[0].x + outs[1].x) / 2 + flameUp.x * mid;
    burnerLamp.y = (outs[0].y + outs[1].y) / 2 + flameUp.y * mid;
    burnerLamp.z = (outs[0].z + outs[1].z) / 2 + flameUp.z * mid;
    burnerLamp.power =
      b.mode === "down"
        ? 0
        : FLAME.light.power * Math.min(1.3, now.bright) * flick + (pilot ? FLAME.light.pilot : 0);
  }
  const lay0 = (x: number, z: number): number => level?.groundAt(x, z) ?? 0;

  return {
    group: root,
    look: envelope.look,
    basket: body,
    envelope: mesh,
    frame(state, alpha, dt) {
      const b = state.balloon;
      group.visible = !!b;
      fire.group.visible = !!b;
      if (!b) {
        burner.hide();
        return;
      }
      if (state.level !== level || state.level.seed !== seed) {
        level = state.level;
        seed = state.level.seed;
      }
      paint(labPaint ?? colourwayOf(seed));
      place(state, b, alpha);
      rig(b);
      burn(state, b, alpha, dt);
    },
    lamps(eye, out) {
      if (!group.visible) return;
      if ((burnerLamp.power ?? 0) > 0.001) out.push(burnerLamp);
      fire.seen(eye, out);
    },
    roar: () => (memory.open ? now.bright : 0),
    blaze: () => fire.blaze(),
    light(look) {
      night = Math.max(look.night, look.lamps);
      lineLightOf(look, lineLight.value);
      envelope.light(look);
    },
    outlets(out, up) {
      group.updateMatrixWorld();
      for (let i = 0; i < basket.outlets.length; i++) {
        out[i] ??= new THREE.Vector3();
        out[i].copy(basket.outlets[i]).applyMatrix4(body.matrixWorld);
      }
      if (up) up.set(0, 1, 0).applyQuaternion(hang.quaternion);
    },
    dispose() {
      burner.dispose();
      fire.dispose();
      basket.dispose();
      envelope.dispose();
      wireGeo.dispose();
      wireMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
    },
  };
}

function smooth(t: number): number {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
}
