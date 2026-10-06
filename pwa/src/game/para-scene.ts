// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PARAMOTOR IN THE RENDERER — the wing over the skier, its lines and the
// motor on his back (`para.ts`), all built in code to the class's measure:
// the CANOPY (`para-canopy.ts`: the planform, the arc, the cells pillowed
// and their mouths, the stabilizers, the brakes pulling the trailing edge
// down), the LINES in their cascades down to the RISERS on his hang points,
// and the MOTOR UNIT (`para-motor.ts`: the cage and its net, the frame and
// its arms, the engine, the tank, the propeller turning at the engine's own
// angle). Once released, the canopy streams down as cloth and lies on its
// back on the snow in its arc, its lines run to the motor where it lies on
// its cage. Built on every free ride, drawn only while a run carries the
// rig. `make para` is its lab.
//
// The skier sits in the harness while he flies (`perch`): his legs hang and
// swing as they do off the helicopter's skid (`skier-dangle.ts`), and he
// stands up out of the seat for the snow.

import * as THREE from "three";
import { HANG_AIR, PARA, TUNING, airAt, unrotate, type GameState, type ParaState } from "@engine";

import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createTrack, observe, sample, type Pose } from "./interp.ts";
import {
  LINE_PAINT,
  PAINT_GLSL,
  canopyLayout,
  canopyPoint,
  linePlan,
  shapeCanopy,
  type LineNode,
} from "./para-canopy.ts";
import { MOTOR, createMotor } from "./para-motor.ts";
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

/** THE RISERS: their length up the lines from his hang points, m, and how
 * far apart fore and aft the A and the C risers' links sit, m. */
const RISER = 0.45;
const RISER_GAP = 0.035;
/** How far his seat hangs under him in the harness, m; how high over the
 * snow he is sat in it, m (lower, he is stood for the snow). */
const SEAT = HANG_AIR;
const SIT = 2.5;
/** How quickly the seat's acceleration is felt by his legs, s. */
const ACCEL_LAG = 0.06;
/** How far the seated figure sits under the standing one's place, m — the
 * motor on his back goes down with him (`perch`'s seat). */
const SAT = 0.48;
/** How quickly a stalled canopy bunches its span in, and opens it again, s;
 * the share of its span it keeps bunched. */
const BUNCH = 0.35;
const BUNCHED = 0.8;
/** The risers' slots: A, B, C, the brake's pulley. */
const SLOTS = { A: 0, B: 1, C: 2, brake: 3 } as const;

const UP = new THREE.Vector3(0, 1, 0);

export function createParaScene(haze: HazeUniforms): ParaScene {
  const group = new THREE.Group();
  group.name = "paramotor";
  group.visible = false;

  // THE CANOPY.
  const layout = canopyLayout();
  const canopyGeo = new THREE.BufferGeometry();
  const skin = new Float32Array(layout.vertices * 3);
  shapeCanopy(skin, 0, 0);
  /** The canopy flown untouched: what a laid-down wing is draped from. */
  const rest = skin.slice();
  canopyGeo.setAttribute("position", new THREE.BufferAttribute(skin, 3));
  canopyGeo.setAttribute("aPaint", new THREE.BufferAttribute(layout.paint, 3));
  canopyGeo.setIndex(new THREE.BufferAttribute(layout.index, 1));
  canopyGeo.computeVertexNormals();
  let shapedL = 0;
  let shapedR = 0;
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
  const canopy = new THREE.Mesh(canopyGeo, cloth);
  canopy.castShadow = true;
  canopy.frustumCulled = false;
  group.add(canopy);

  // THE LINES: every node to its knot, every main to its riser's link, and
  // the risers themselves down to the hang points.
  const plan = linePlan();
  const parent = new Int32Array(plan.length).fill(-1);
  plan.forEach((n, i) => {
    for (const k of n.children) parent[k] = i;
  });
  const leafAt = plan.map((n) => {
    const out = new Float32Array(3);
    if (n.leaf) canopyPoint(n.leaf.u, n.leaf.s, -1, 0, 0, out, 0);
    return out;
  });
  const risers = 2 * 4;
  const segments = plan.length + risers;
  const lineGeo = new THREE.BufferGeometry();
  const linePos = new Float32Array(segments * 6);
  const lineCol = new Float32Array(segments * 6);
  plan.forEach((n, i) => {
    lineCol.set(LINE_PAINT[n.paint], i * 6);
    lineCol.set(LINE_PAINT[n.paint], i * 6 + 3);
  });
  for (let r = 0; r < risers; r++) {
    // The webbing: the A risers in the A's red, the rest dark.
    const rgb = r % 4 === 0 ? LINE_PAINT.A : [0.1, 0.1, 0.12];
    lineCol.set(rgb, (plan.length + r) * 6);
    lineCol.set(rgb, (plan.length + r) * 6 + 3);
  }
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute("color", new THREE.BufferAttribute(lineCol, 3));
  const lineMat = hazeMaterial(
    new THREE.LineBasicMaterial({ vertexColors: true }),
    haze,
    "para-line",
  );
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  group.add(lines);

  // THE MOTOR UNIT on his back.
  const motor = createMotor(haze);
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
  const turn = new THREE.Quaternion();
  const toWing = new THREE.Vector3();
  /** Each side's hang point and its four links, world frame. */
  const hang = [new THREE.Vector3(), new THREE.Vector3()];
  const links = Array.from({ length: 8 }, () => new THREE.Vector3());
  const nodeAt = plan.map(() => new THREE.Vector3());
  const tmp = new THREE.Vector3();
  const g = { x: 0, y: 1, z: 0 };
  let shown = false;
  let tied = false;
  /** How far he is sat in the seat, 0..1, and the canopy bunched. */
  let seated = 0;
  let bunch = 0;
  let lastT = -1;
  /** Whether the skin is the laid-down wing's, in the world. */
  let draped = false;
  const drapeAt = { x: 0, z: 0, heading: 0 };
  let groundAt: (x: number, z: number) => number = () => 0;

  /** A point of the flown canopy (its frame) LAID ON THE SNOW: on its back
   * in its arc, its chord crushed and rumpled, the tips toward where the
   * pilot was. */
  function drape(x: number, y: number, z: number, out: THREE.Vector3): THREE.Vector3 {
    const h = drapeAt.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const back = -y * 0.9 - z * 0.35;
    const wx = drapeAt.x + fz * x - fx * back;
    const wz = drapeAt.z - fx * x - fz * back;
    const rumple = 0.05 + 0.07 * Math.abs(Math.sin(x * 2.3 + z * 3.1) * Math.cos(y * 1.9 - z));
    return out.set(wx, groundAt(wx, wz) + 0.03 + rumple + z * 0.02, wz);
  }

  function layDown(): void {
    for (let v = 0; v < layout.vertices; v++) {
      drape(rest[v * 3], rest[v * 3 + 1], rest[v * 3 + 2], tmp).toArray(skin, v * 3);
    }
    canopyGeo.getAttribute("position").needsUpdate = true;
    canopyGeo.computeVertexNormals();
    canopyGeo.computeBoundingSphere();
    canopy.position.set(0, 0, 0);
    canopy.quaternion.identity();
    canopy.scale.set(1, 1, 1);
    draped = true;
  }

  // The perch's memory: the seat's acceleration, smoothed.
  const accel = { x: 0, y: 0, z: 0 };
  const lastV = { x: 0, y: 0, z: 0 };
  let lastTick = -1;

  const wingOver = (p: ParaState): boolean => p.mode !== "dropped";

  /** The lines drawn from the canopy as it stands to the motor's hang
   * points as they stand (both in the world). */
  function drawLines(): void {
    motor.group.updateMatrixWorld();
    canopy.updateMatrixWorld();
    if (draped) drape(0, 0, 0, up);
    else up.copy(tmp.set(0, 0, 0).applyMatrix4(canopy.matrixWorld));
    for (let side = 0; side < 2; side++) {
      const sx = side === 0 ? -1 : 1;
      hang[side]
        .set(sx * MOTOR.hang.x, MOTOR.hang.y, MOTOR.hang.z)
        .applyMatrix4(motor.group.matrixWorld);
      toWing.copy(up).sub(hang[side]).normalize();
      fwd.set(0, 0, 1).transformDirection(motor.group.matrixWorld);
      for (const [slot, k] of Object.entries(SLOTS)) {
        const along = slot === "A" ? RISER_GAP : slot === "B" ? 0 : -RISER_GAP;
        links[side * 4 + k]
          .copy(hang[side])
          .addScaledVector(toWing, slot === "brake" ? RISER * 0.85 : RISER)
          .addScaledVector(fwd, slot === "brake" ? -RISER_GAP * 1.6 : along);
      }
    }
    const linkOf = (n: LineNode): THREE.Vector3 => links[(n.side < 0 ? 0 : 4) + SLOTS[n.riser]];
    for (let i = 0; i < plan.length; i++) {
      const n = plan[i];
      const at = nodeAt[i];
      if (n.leaf) {
        at.fromArray(leafAt[i]);
        if (n.leaf.stabilo) canopyStabilo(at, n.side);
        if (draped) drape(at.x, at.y, at.z, at);
        else at.applyMatrix4(canopy.matrixWorld);
      } else {
        at.set(0, 0, 0);
        for (const k of n.children) at.add(nodeAt[k]);
        at.divideScalar(n.children.length).lerp(linkOf(n), n.down);
      }
    }
    for (let i = 0; i < plan.length; i++) {
      nodeAt[i].toArray(linePos, i * 6);
      (parent[i] >= 0 ? nodeAt[parent[i]] : linkOf(plan[i])).toArray(linePos, i * 6 + 3);
    }
    for (let r = 0; r < 8; r++) {
      links[r].toArray(linePos, (plan.length + r) * 6);
      hang[r < 4 ? 0 : 1].toArray(linePos, (plan.length + r) * 6 + 3);
    }
    lineGeo.getAttribute("position").needsUpdate = true;
  }

  /** The stabilizer's point, read off the canopy's own vertices. */
  function canopyStabilo(out: THREE.Vector3, side: number): void {
    const base = layout.vertices - (side < 0 ? 6 : 3);
    out.fromArray(rest, (base + 2) * 3);
  }

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
      motor.seat.visible = false;
      const level = state.level;
      groundAt = (x, z) => level.groundAt(x, z);

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
        canopy.quaternion.multiply(turn.setFromAxisAngle(tmp.set(1, 0, 0), -p.pitch * 0.6));
        canopy.position.set(wingAt.x, wingAt.y, wingAt.z);
        // STALLED, the canopy bunches its span in and its tips fold back.
        const step = lastT < 0 ? 0 : Math.max(0, state.t - lastT);
        bunch += ((p.stalled ? 1 : 0) - bunch) * (1 - Math.exp(-step / BUNCH));
        canopy.scale.set(1 - (1 - BUNCHED) * bunch, 1 + 0.15 * bunch, 1 - 0.1 * bunch);
        if (draped) {
          // A ride begun again: the wing flown again from the untouched shape.
          draped = false;
          shapedL = shapedR = -1;
        }
        const { brake, steer } = p.controls;
        const l = Math.min(1, brake + Math.max(0, -steer));
        const r = Math.min(1, brake + Math.max(0, steer));
        if (Math.abs(l - shapedL) > 0.02 || Math.abs(r - shapedR) > 0.02) {
          shapeCanopy(skin, l, r);
          canopyGeo.getAttribute("position").needsUpdate = true;
          canopyGeo.computeVertexNormals();
          shapedL = l;
          shapedR = r;
        }
        // The motor on his back, down with him as he sits in the seat (the
        // perch's own share), the propeller at the engine's own turn.
        const sit = p.flying ? Math.max(0, Math.min(1, (p.agl - SIT) / 2)) : 0;
        seated +=
          (sit - seated) * (1 - Math.exp(-(lastT < 0 ? 1 : Math.max(0, state.t - lastT)) / 0.3));
        motor.group.position.set(0, -SAT * seated, 0).applyQuaternion(pilotQ);
        motor.group.position.add(tmp.set(pilot.x, pilot.y, pilot.z));
        motor.group.quaternion.copy(pilotQ);
        motor.seat.visible = seated > 0.5;
        // The seat plate under his seat, wherever the motor is.
        motor.seat.position.y = -SEAT + SAT * seated - 0.02;
        drawLines();
        lines.visible = true;
      } else {
        shown = false;
        // THE CANOPY RELEASED: streaming as cloth while it falls; down, it
        // lies on its back in its arc, the chord crushed flat.
        const cp = p.canopy;
        if (cp && cp.down) {
          if (!draped || drapeAt.x !== cp.x || drapeAt.z !== cp.z) {
            drapeAt.x = cp.x;
            drapeAt.z = cp.z;
            drapeAt.heading = cp.heading;
            layDown();
          }
        } else if (cp) {
          if (draped) {
            draped = false;
            skin.set(rest);
            canopyGeo.getAttribute("position").needsUpdate = true;
            canopyGeo.computeVertexNormals();
          }
          canopy.position.set(cp.x, cp.y + 1.5, cp.z);
          canopy.quaternion.setFromAxisAngle(UP, cp.heading);
          canopy.scale.set(0.45, 0.6, 0.4);
        }
        const mp = p.motor;
        if (mp) {
          motor.group.position.set(mp.x, mp.y, mp.z);
          motor.group.quaternion.setFromAxisAngle(UP, mp.heading);
          // On the snow, lying on its cage: tipped back onto it, and laid
          // to the slope under it so the hoop is not half buried.
          if (mp.down) {
            state.level.normalAt(mp.x, mp.z, g);
            turn.setFromUnitVectors(UP, tmp.set(g.x, g.y, g.z).normalize());
            motor.group.quaternion.premultiply(turn);
            motor.group.quaternion.multiply(turn.setFromAxisAngle(tmp.set(1, 0, 0), -Math.PI / 2));
            motor.group.position.addScaledVector(
              tmp.set(g.x, g.y, g.z).normalize(),
              -MOTOR.cage.z + MOTOR.cage.tube + 0.03,
            );
          }
        }
        // The lines run on from the canopy to the motor's hang points while
        // the two lie near enough for them to reach.
        tied =
          !!cp && !!mp && Math.hypot(cp.x - mp.x, cp.y - mp.y, cp.z - mp.z) < PARA.wing.lines * 1.4;
        if (tied) drawLines();
        lines.visible = tied;
      }
      lastT = state.t;
      // The propeller: blades seen while it turns slowly, a disc as it spins.
      const spin = Math.max(0, Math.min(1, (p.rpm - 1000) / (PARA.engine.full * 0.5)));
      motor.prop.rotation.z = p.prop;
      (motor.disc.material as THREE.MeshBasicMaterial).opacity = 0.4 * spin;
      motor.blades.visible = spin < 0.9;
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
      motor.dispose();
    },
  };
}
