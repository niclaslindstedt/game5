// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE CIVILIANS, DRAWN — the people on foot about a free ride's ski area
// (`civilian-plan.ts`), one instanced mesh a BODY and CUT
// (`civilian-shapes.ts`) holding whatever of that body is out and within
// sight this frame: NEAR within `CIVILIAN_CUTS.near` of the lens, MID to
// `.mid`, FAR to where a person is under a pixel. Each is stood where the
// plan has him at the run's clock (`civilianAt`: his feet on the drawn snow
// or a deck's boards), upright, turned to his heading, posed by the weights
// of his moves (`civilianDials`) and dressed in his kit (`civilianKit`: his
// colours, his head, what he holds) — a matrix, a morph weight a pose and
// three vec4s an instance, written into buffers allocated once. The deck
// chairs and the snowmen are one mesh beside them.
//
// Presentation, end to end: it reads the map, the plan and the engine's
// clock and writes nothing. A free ride's only (`hasCivilians`).

import * as THREE from "three";
import { CROWD_BODIES, type CrowdBody, type GameState, type Level } from "@engine";

import { civilianKit, kitParts, type CivilianKit } from "./civilian-dress.ts";
import { CIVILIAN_POSES, civilianDials } from "./civilian-moves.ts";
import {
  civilianAt,
  civilianHour,
  civilianPlanFor,
  freshCivilianPose,
  type CivilianPlan,
} from "./civilian-plan.ts";
import {
  buildCivilianFigure,
  buildCivilianProps,
  civilianDepth,
  civilianMaterial,
} from "./civilian-shapes.ts";
import { CROWD_LODS, type CrowdLod } from "./crowd-shapes.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createShadeDepth, shadeDepth } from "./terrain-shade.ts";

/** Where the cuts hand over, m from the lens, and the furthest a person
 * is drawn: past it he is under a pixel. */
export const CIVILIAN_CUTS = { near: 35, mid: 120, far: 600 };

type Slot = {
  mesh: THREE.InstancedMesh;
  dress: THREE.InstancedBufferAttribute;
  dress2: THREE.InstancedBufferAttribute;
  kit: THREE.InstancedBufferAttribute;
  weights: Float32Array;
  n: number;
};

export type CiviliansView = {
  group: THREE.Group;
  update: (state: GameState, eye: THREE.Vector3) => void;
  dispose: () => void;
};

const TARGETS = CIVILIAN_POSES.length;

export function createCiviliansView(level: Level, haze: HazeUniforms): CiviliansView {
  const group = new THREE.Group();
  group.name = "civilians";
  const plan: CivilianPlan = civilianPlanFor(level);
  const hour = civilianHour(level);
  const material = civilianMaterial(haze);
  const depth = civilianDepth(createShadeDepth(haze));
  const kits: CivilianKit[] = plan.people.map((c) => civilianKit(c, level.seed));
  const ids = plan.people.map((_, i) => i);

  // A mesh a body and cut, each as big as that body's share of the plan.
  const counts = Object.fromEntries(CROWD_BODIES.map((b) => [b, 0])) as Record<CrowdBody, number>;
  for (const c of plan.people) counts[c.body] += 1;
  const slots = new Map<string, Slot>();
  for (const body of CROWD_BODIES) {
    const capacity = counts[body];
    if (capacity === 0) continue;
    for (const lod of CROWD_LODS) {
      const geometry = buildCivilianFigure(body, lod).clone();
      const attr = () => {
        const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        a.setUsage(THREE.DynamicDrawUsage);
        return a;
      };
      const dress = attr();
      const dress2 = attr();
      const kit = attr();
      geometry.setAttribute("aDress", dress);
      geometry.setAttribute("aDress2", dress2);
      geometry.setAttribute("aKit", kit);
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.morphTargetInfluences = new Array<number>(TARGETS).fill(0);
      mesh.setMorphAt(0, mesh);
      mesh.castShadow = lod !== "far";
      if (mesh.castShadow) mesh.customDepthMaterial = depth;
      mesh.receiveShadow = lod === "near";
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      mesh.name = `civilians-${body}-${lod}`;
      group.add(mesh);
      const weights = mesh.morphTexture!.image.data as unknown as Float32Array;
      slots.set(`${body}:${lod}`, { mesh, dress, dress2, kit, weights, n: 0 });
    }
  }

  // The deck chairs and the snowmen, one mesh about the first of them.
  let props: THREE.Mesh | null = null;
  if (plan.props.length > 0) {
    const o = plan.props[0];
    const geometry = buildCivilianProps(plan, [o.x, o.y, o.z]);
    const propMaterial = hazeMaterial(
      new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
      haze,
      "civilian-props",
    );
    props = new THREE.Mesh(geometry, propMaterial);
    props.position.set(o.x, o.y, o.z);
    props.castShadow = true;
    props.customDepthMaterial = shadeDepth(haze);
    props.receiveShadow = true;
    props.name = "civilian-props";
    group.add(props);
  }

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const pose = freshCivilianPose();
  const dials = new Float32Array(TARGETS);
  const parts = [0, 0, 0, 0];
  const reach2 = CIVILIAN_CUTS.far * CIVILIAN_CUTS.far;

  const update: CiviliansView["update"] = (state, eye) => {
    for (const slot of slots.values()) slot.n = 0;
    const t = state.t;
    for (let i = 0; i < plan.people.length; i++) {
      const c = plan.people[i];
      // Cheap first: where he lives, before he is posed.
      const hx = (c.leg ? (c.leg.ax + c.leg.bx) / 2 : c.home.x) - eye.x;
      const hz = (c.leg ? (c.leg.az + c.leg.bz) / 2 : c.home.z) - eye.z;
      const spread = c.leg ? c.leg.length / 2 : 0;
      if (Math.hypot(hx, hz) - spread > CIVILIAN_CUTS.far) continue;
      civilianAt(plan, i, t, hour, pose);
      if (!pose.shown) continue;
      const dx = pose.x - eye.x;
      const dz = pose.z - eye.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > reach2) continue;
      const far = Math.sqrt(d2 + (pose.y - eye.y) ** 2);
      const lod: CrowdLod =
        far < CIVILIAN_CUTS.near ? "near" : far < CIVILIAN_CUTS.mid ? "mid" : "far";
      const slot = slots.get(`${c.body}:${lod}`);
      if (!slot) continue;
      const k = slot.n++;
      quat.setFromAxisAngle(yAxis, pose.heading);
      m.compose(pos.set(pose.x, pose.y, pose.z), quat, one);
      slot.mesh.setMatrixAt(k, m);
      civilianDials(pose, t, ids[i], dials);
      const w = slot.weights;
      const at = k * (TARGETS + 1);
      w[at] = 1;
      for (let j = 0; j < TARGETS; j++) w[at + 1 + j] = dials[j];
      const o = kits[i].colours;
      slot.dress.setXYZW(k, o[0], o[1], o[2], o[3]);
      slot.dress2.setXYZW(k, o[4], o[5], o[6], o[7]);
      kitParts(kits[i], pose, parts);
      slot.kit.setXYZW(k, parts[0], parts[1], parts[2], parts[3]);
    }
    for (const slot of slots.values()) {
      slot.mesh.count = slot.n;
      slot.mesh.visible = slot.n > 0;
      if (slot.n === 0) continue;
      slot.mesh.instanceMatrix.needsUpdate = true;
      slot.mesh.morphTexture!.needsUpdate = true;
      slot.dress.needsUpdate = true;
      slot.dress2.needsUpdate = true;
      slot.kit.needsUpdate = true;
    }
  };

  return {
    group,
    update,
    dispose() {
      for (const slot of slots.values()) {
        slot.mesh.geometry.dispose();
        slot.mesh.dispose();
      }
      slots.clear();
      if (props) {
        props.geometry.dispose();
        (props.material as THREE.Material).dispose();
      }
      material.dispose();
      depth.dispose();
    },
  };
}
