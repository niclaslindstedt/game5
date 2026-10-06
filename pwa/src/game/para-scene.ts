// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR IN THE RENDERER — the wing over the skier, its lines and the
// motor on his back (`para.ts`), all built in code: the CANOPY a ram-air wing
// of 24 cells laid on an arc, each cell an airfoil 14 % thick, tapered to the
// tips, the trailing edge pulled down by the brakes (the toggle's side
// more); the LINES in cascades off the A, B and C rows to a knot over each
// riser and down to the harness; the MOTOR a frame, a tank and a round guard
// cage with the propeller turning inside it at the engine's own angle, its
// blades smeared into a disc as it spools up. Once released, the canopy
// streams down as cloth and lies crumpled on the snow, and the motor lies on
// its cage where it fell. Built on every free ride, drawn only while a run
// carries the rig.
//
// The skier sits in the harness while he flies (`perch`): his legs hang and
// swing as they do off the helicopter's skid (`skier-dangle.ts`), and he
// stands up out of the seat for the snow.

import * as THREE from "three";
import { HANG_AIR, PARA, TUNING, airAt, unrotate, type GameState, type ParaState } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createTrack, observe, sample, type Pose } from "./interp.ts";
import type { Perch } from "./skier-dangle.ts";

export type ParaScene = {
  group: THREE.Group;
  /** One frame: the wing, the lines and the motor where the run has them. */
  frame(state: GameState, alpha: number): void;
  /** The figure sat in the harness, or null on the snow (`SkisModel.setPerch`). */
  perch(state: GameState): Perch | null;
  /** The canopy's centre as drawn this frame, or null with no wing up. */
  wing(): { x: number; y: number; z: number } | null;
  dispose(): void;
};

/** THE CANOPY'S SHAPE: the cells, the arc's radius, m, its half-angle, rad,
 * the centre chord, m, how much of it the tips keep, the airfoil's
 * thickness and camber as shares of the chord, and the stations along it. */
const CELLS = 24;
const ARC = 5.2;
const HALF = 0.75;
const CHORD = 2.4;
const TIP = 0.55;
const THICK = 0.14;
const CAMBER = 0.04;
const STATIONS = 10;
/** The brakes' pull on the trailing edge, m at a toggle all the way down,
 * from this share of the chord back. */
const BRAKE_DROP = 0.55;
const BRAKE_FROM = 0.65;
/** The canopy's paint: the cells' upper colours in turn, the lower skin. */
const PAINT = [0xf26a1b, 0xf26a1b, 0xffffff, 0x1d2f6b, 0x1d2f6b, 0xffffff];
const UNDER = 0xd8d2c8;
/** The line rows along the chord (shares from the leading edge), and how far
 * from the canopy down to the harness each cascade's knot is. */
const ROWS = [0.12, 0.38, 0.62];
const KNOT = 0.62;
/** The risers in his body frame, m (x right, y up, z forward). */
const RISER = { x: 0.22, y: 0.42, z: 0.05 };
/** THE MOTOR in his body frame: the cage's centre, its radius and the tube,
 * m; the propeller's radius. */
const CAGE = { y: 0.45, z: -0.55, r: 0.66, tube: 0.018 };
const PROP = 0.6;
/** How far his seat hangs under him in the harness, m; how high over the
 * snow he is sat in it, m (lower, he is stood for the snow). */
const SEAT = HANG_AIR;
const SIT = 2.5;
/** How quickly the seat's acceleration is felt by his legs, s. */
const ACCEL_LAG = 0.06;

/** The chord at a rib's angle off the centre. */
const chordAt = (theta: number): number =>
  CHORD * (1 - (1 - TIP) * (theta / HALF) * (theta / HALF));

/** The half-thickness of a symmetric section at `s` along the chord. */
const halfThick = (s: number): number =>
  5 *
  THICK *
  (0.2969 * Math.sqrt(s) - 0.126 * s - 0.3516 * s * s + 0.2843 * s ** 3 - 0.1036 * s ** 4);

/** A rib's angle, cell edge `i` of `CELLS`. */
const ribAngle = (i: number): number => -HALF + (2 * HALF * i) / CELLS;

/** A point on the canopy in its own frame (x right, y up toward the wing
 * from the lines, z forward): rib angle `theta`, `s` along its chord, the
 * upper skin (`side` 1) or the lower (−1), the trailing edge dropped by
 * `brake`. */
function canopyPoint(
  theta: number,
  s: number,
  side: number,
  brake: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const c = chordAt(theta);
  const mean = CAMBER * c * 4 * s * (1 - s);
  const drop = s > BRAKE_FROM ? brake * BRAKE_DROP * ((s - BRAKE_FROM) / (1 - BRAKE_FROM)) ** 2 : 0;
  const h = mean + side * halfThick(s) * c - drop;
  // On the arc: the rib's own up is its radius out from the arc's centre.
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  return out.set(sin * (ARC + h), cos * (ARC + h) - ARC, c * (0.3 - s));
}

/** THE CANOPY'S MESH: each cell's two skins as its own quads, so a cell's
 * colour is crisp at the rib, and its colours written once. */
function canopyGeometry(): THREE.BufferGeometry {
  const quads = CELLS * STATIONS * 2;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(quads * 12), 3));
  const colours = new Float32Array(quads * 12);
  const index: number[] = [];
  const tint = new THREE.Color();
  let v = 0;
  for (let i = 0; i < CELLS; i++) {
    for (let side = 0; side < 2; side++) {
      tint.setHex(side === 0 ? PAINT[i % PAINT.length] : UNDER);
      for (let j = 0; j < STATIONS; j++) {
        for (let k = 0; k < 4; k++) tint.toArray(colours, (v + k) * 3);
        index.push(v, v + 1, v + 2, v, v + 2, v + 3);
        v += 4;
      }
    }
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colours, 3));
  geo.setIndex(index);
  return geo;
}

const pt = new THREE.Vector3();

/** The canopy's skins written for its brakes (each side's own). */
function shapeCanopy(geo: THREE.BufferGeometry, left: number, right: number): void {
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const a = pos.array as Float32Array;
  let v = 0;
  const put = (theta: number, s: number, side: number): void => {
    // Each half braked by its toggle, the centre by both.
    const share = (theta / HALF + 1) / 2;
    canopyPoint(theta, s, side, left * (1 - share) + right * share, pt);
    pt.toArray(a, v * 3);
    v++;
  };
  for (let i = 0; i < CELLS; i++) {
    const t0 = ribAngle(i);
    const t1 = ribAngle(i + 1);
    for (const side of [1, -1]) {
      for (let j = 0; j < STATIONS; j++) {
        // Stations bunched at the nose, where the section is rounded.
        const s0 = (j / STATIONS) ** 1.6;
        const s1 = ((j + 1) / STATIONS) ** 1.6;
        // Wound so the upper skin faces up and the lower down.
        if (side > 0) {
          put(t0, s0, side);
          put(t1, s0, side);
          put(t1, s1, side);
          put(t0, s1, side);
        } else {
          put(t0, s0, side);
          put(t0, s1, side);
          put(t1, s1, side);
          put(t1, s0, side);
        }
      }
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
}

/** The line attachments on the lower skin, in the canopy's frame, and the
 * cascade each belongs to: by side, by row, a knot for every three ribs. */
type Attach = { at: THREE.Vector3; knot: number; side: number };

function attachments(): { points: Attach[]; knots: number } {
  const points: Attach[] = [];
  let knots = 0;
  const group = 3;
  for (let r = 0; r < ROWS.length; r++) {
    for (let i = 0; i <= CELLS; i += 2) {
      const theta = ribAngle(i);
      const side = theta < 0 ? -1 : 1;
      if (theta === 0) continue;
      const half = side < 0 ? Math.floor(i / (2 * group)) : Math.floor((CELLS - i) / (2 * group));
      const knot = knots + (side < 0 ? 0 : 100) + half;
      points.push({ at: canopyPoint(theta, ROWS[r], -1, 0, new THREE.Vector3()), knot, side });
    }
    knots += 1000;
  }
  // Renumber the knots densely.
  const ids = [...new Set(points.map((p) => p.knot))];
  for (const p of points) p.knot = ids.indexOf(p.knot);
  return { points, knots: ids.length };
}

/** THE MOTOR: the frame and the tank, the guard cage round the propeller,
 * the propeller's two blades and the disc its blur is drawn as. */
function motorParts(haze: HazeUniforms): {
  group: THREE.Group;
  prop: THREE.Group;
  blades: THREE.Mesh;
  disc: THREE.Mesh;
  materials: THREE.Material[];
} {
  const group = new THREE.Group();
  const metal = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.45, metalness: 0.7 }),
    haze,
    "para-metal",
  );
  const black = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0x1a1b1e, roughness: 0.6, metalness: 0.2 }),
    haze,
    "para-black",
  );
  const tankPaint = hazeMaterial(
    new THREE.MeshStandardMaterial({
      color: 0xe9e4d8,
      roughness: 0.5,
      transparent: true,
      opacity: 0.9,
    }),
    haze,
    "para-tank",
  );
  const wood = hazeMaterial(
    new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.55 }),
    haze,
    "para-prop",
  );
  const blur = new THREE.MeshBasicMaterial({
    color: 0x2a2018,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  // The frame against his back, the engine low in it, the tank under that.
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.08), black);
  frame.position.set(0, 0.32, -0.26);
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.24, 0.24), metal);
  engine.position.set(0, 0.3, -0.42);
  const fins = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.18, 10), metal);
  fins.position.set(0, 0.47, -0.42);
  const tank = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.2), tankPaint);
  tank.position.set(0, 0.05, -0.36);
  // The cage: the hoop round the propeller and the spokes back to the frame.
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(CAGE.r, CAGE.tube * 1.6, 6, 40), metal);
  hoop.position.set(0, CAGE.y, CAGE.z);
  group.add(frame, engine, fins, tank, hoop);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    const spoke = new THREE.Mesh(
      new THREE.CylinderGeometry(CAGE.tube, CAGE.tube, CAGE.r, 4),
      metal,
    );
    spoke.position.set(
      (Math.cos(a) * CAGE.r) / 2,
      CAGE.y + (Math.sin(a) * CAGE.r) / 2,
      CAGE.z + 0.04,
    );
    spoke.rotation.z = a - Math.PI / 2;
    group.add(spoke);
  }
  // The netting's rings, as a lighter hoop inside the first.
  const net = new THREE.Mesh(new THREE.TorusGeometry(CAGE.r * 0.6, CAGE.tube, 4, 32), metal);
  net.position.set(0, CAGE.y, CAGE.z + 0.05);
  group.add(net);
  // The propeller on its hub, turned about the thrust line.
  const prop = new THREE.Group();
  prop.position.set(0, CAGE.y, CAGE.z + 0.1);
  const bladeShape = new THREE.BoxGeometry(PROP * 2, 0.07, 0.015);
  const blades = new THREE.Mesh(bladeShape, wood);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), black);
  hub.rotation.x = Math.PI / 2;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(PROP, 32), blur);
  disc.position.z = 0.01;
  prop.add(blades, hub);
  group.add(prop, disc);
  disc.position.set(0, CAGE.y, CAGE.z + 0.11);
  for (const m of group.children) m.castShadow = true;
  disc.castShadow = false;
  return { group, prop, blades, disc, materials: [metal, black, tankPaint, wood, blur] };
}

const UP = new THREE.Vector3(0, 1, 0);

export function createParaScene(haze: HazeUniforms): ParaScene {
  const group = new THREE.Group();
  group.name = "paramotor";
  group.visible = false;

  const canopyGeo = canopyGeometry();
  shapeCanopy(canopyGeo, 0, 0);
  let shapedL = 0;
  let shapedR = 0;
  const cloth = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }),
    haze,
    "para-cloth",
  );
  const canopy = new THREE.Mesh(canopyGeo, cloth);
  canopy.castShadow = true;
  canopy.frustumCulled = false;
  group.add(canopy);

  const { points, knots } = attachments();
  // Each attachment to its knot, each knot to its riser.
  const segments = points.length + knots;
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(segments * 6), 3));
  const lineMat = hazeMaterial(new THREE.LineBasicMaterial({ color: 0x3a3a40 }), haze, "para-line");
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  group.add(lines);

  const motor = motorParts(haze);
  group.add(motor.group);

  const pilotTrack = createTrack();
  const wingTrack = createTrack();
  const pilot: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const wingAt: Pose = { x: 0, y: 0, z: 0, q: { x: 0, y: 0, z: 0, w: 1 } };
  const pilotQ = new THREE.Quaternion();
  const basis = new THREE.Matrix4();
  const right = new THREE.Vector3();
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const pitch = new THREE.Quaternion();
  const pilotAt = new THREE.Vector3();
  const riser = [new THREE.Vector3(), new THREE.Vector3()];
  const ends = points.map(() => new THREE.Vector3());
  const knotAt = Array.from({ length: knots }, () => new THREE.Vector3());
  const knotN = new Array<number>(knots).fill(0);
  const knotSide = new Array<number>(knots).fill(1);
  for (const at of points) {
    knotN[at.knot]++;
    knotSide[at.knot] = at.side;
  }
  let shown = false;

  // The perch's memory: the seat's acceleration, smoothed.
  const accel = { x: 0, y: 0, z: 0 };
  const lastV = { x: 0, y: 0, z: 0 };
  let lastTick = -1;

  const wingOver = (p: ParaState): boolean => p.mode !== "dropped";

  return {
    group,
    frame(state, alpha) {
      const p = state.para;
      if (!p) {
        group.visible = false;
        shown = false;
        return;
      }
      group.visible = true;
      const c = state.skier;
      observe(pilotTrack, c, state.tick);
      sample(pilotTrack, alpha, pilot);
      pilotQ.set(pilot.q.x, pilot.q.y, pilot.q.z, pilot.q.w);

      if (wingOver(p)) {
        observe(wingTrack, { x: p.x, y: p.y, z: p.z, q: pilot.q }, state.tick);
        sample(wingTrack, alpha, wingAt);
        shown = true;
        // The canopy turned up its lines and along its heading, its nose
        // pitched by the swing.
        up.set(wingAt.x - pilot.x, wingAt.y - pilot.y, wingAt.z - pilot.z).normalize();
        fwd.set(Math.sin(p.heading), 0, Math.cos(p.heading));
        fwd.addScaledVector(up, -fwd.dot(up)).normalize();
        right.crossVectors(up, fwd);
        basis.makeBasis(right, up, fwd);
        canopy.quaternion.setFromRotationMatrix(basis);
        canopy.quaternion.multiply(pitch.setFromAxisAngle(right.set(1, 0, 0), -p.pitch * 0.6));
        canopy.position.set(wingAt.x, wingAt.y, wingAt.z);
        canopy.scale.set(1, 1, 1);
        const { brake, steer } = p.controls;
        const l = Math.min(1, brake + Math.max(0, -steer));
        const r = Math.min(1, brake + Math.max(0, steer));
        if (Math.abs(l - shapedL) > 0.02 || Math.abs(r - shapedR) > 0.02) {
          shapeCanopy(canopyGeo, l, r);
          shapedL = l;
          shapedR = r;
        }
        // The lines: every attachment to its cascade's knot, each knot to
        // its riser on his harness.
        canopy.updateMatrixWorld();
        const at0 = pilotAt.set(pilot.x, pilot.y, pilot.z);
        riser[0].set(-RISER.x, RISER.y, RISER.z).applyQuaternion(pilotQ).add(at0);
        riser[1].set(RISER.x, RISER.y, RISER.z).applyQuaternion(pilotQ).add(at0);
        for (let k = 0; k < knots; k++) knotAt[k].set(0, 0, 0);
        points.forEach((at, i) => {
          ends[i].copy(at.at).applyMatrix4(canopy.matrixWorld);
          knotAt[at.knot].add(ends[i]);
        });
        for (let k = 0; k < knots; k++) {
          knotAt[k].divideScalar(knotN[k]).lerp(riser[knotSide[k] < 0 ? 0 : 1], KNOT);
        }
        const a = (lineGeo.getAttribute("position") as THREE.BufferAttribute).array as Float32Array;
        let w = 0;
        points.forEach((at, i) => {
          ends[i].toArray(a, w);
          knotAt[at.knot].toArray(a, w + 3);
          w += 6;
        });
        for (let k = 0; k < knots; k++) {
          knotAt[k].toArray(a, w);
          riser[knotSide[k] < 0 ? 0 : 1].toArray(a, w + 3);
          w += 6;
        }
        lineGeo.getAttribute("position").needsUpdate = true;
        lines.visible = true;
        // The motor on his back, the propeller at the engine's own turn.
        motor.group.position.set(pilot.x, pilot.y, pilot.z);
        motor.group.quaternion.copy(pilotQ);
        motor.group.scale.set(1, 1, 1);
      } else {
        shown = false;
        lines.visible = false;
        // THE CANOPY RELEASED: streaming as cloth while it falls, lying
        // crumpled where it came down.
        const cp = p.canopy;
        if (cp) {
          // Its arc's tips hang ARC·(1 − cos HALF) under its centre:
          // squashed flat, the cloth lies on the snow.
          canopy.position.set(cp.x, cp.y + (cp.down ? 0.08 : 1), cp.z);
          canopy.quaternion.setFromAxisAngle(UP, cp.heading);
          if (cp.down) canopy.scale.set(0.55, 0.04, 0.8);
          else canopy.scale.set(0.35, 0.5, 0.5);
        }
        const mp = p.motor;
        if (mp) {
          motor.group.position.set(mp.x, mp.y, mp.z);
          motor.group.quaternion.setFromAxisAngle(UP, mp.heading);
          // On the snow, lying on its cage: tipped back onto it.
          if (mp.down) {
            motor.group.quaternion.multiply(
              pitch.setFromAxisAngle(right.set(1, 0, 0), -Math.PI / 2),
            );
            motor.group.position.y += 0.15;
          }
        }
      }
      // The propeller: blades seen while it turns slowly, a disc as it spins.
      const spin = Math.max(0, Math.min(1, (p.rpm - 1000) / (PARA.engine.full * 0.5)));
      motor.prop.rotation.z = p.prop;
      (motor.disc.material as THREE.MeshBasicMaterial).opacity = 0.35 * spin;
      motor.blades.visible = spin < 0.95;
    },
    perch(state) {
      const p = state.para;
      if (!p || p.mode !== "flown" || !p.flying || p.agl < SIT || state.skier.thrown) {
        lastTick = -1;
        return null;
      }
      const c = state.skier;
      if (state.tick !== lastTick) {
        const span = (state.tick - lastTick) * TUNING.dt;
        if (lastTick >= 0 && span > 0) {
          const k = 1 - Math.exp(-span / ACCEL_LAG);
          accel.x += ((c.vx - lastV.x) / span - accel.x) * k;
          accel.y += ((c.vy - lastV.y) / span - accel.y) * k;
          accel.z += ((c.vz - lastV.z) / span - accel.z) * k;
        } else accel.x = accel.y = accel.z = 0;
        lastTick = state.tick;
        lastV.x = c.vx;
        lastV.y = c.vy;
        lastV.z = c.vz;
      }
      const wind = airAt(state.level, state.t, c.x, c.z, Math.max(0.5, p.agl));
      return {
        y: -SEAT,
        gravity: unrotate(c.q, { x: -accel.x, y: -TUNING.g - accel.y, z: -accel.z }),
        air: unrotate(c.q, { x: wind.x - c.vx, y: -c.vy, z: wind.z - c.vz }),
        spool: 0,
        rotor: 0,
        // Let down onto the snow as he comes in.
        hanging: Math.max(0, Math.min(1, (p.agl - SIT) / 2)),
        t: state.t,
      };
    },
    wing() {
      return shown ? { x: wingAt.x, y: wingAt.y, z: wingAt.z } : null;
    },
    dispose() {
      canopyGeo.dispose();
      cloth.dispose();
      lineGeo.dispose();
      lineMat.dispose();
      motor.group.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
      for (const m of motor.materials) m.dispose();
    },
  };
}
