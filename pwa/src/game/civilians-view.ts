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
// A GUEST ON HIS SKIS skating round the base (`Civilian.skis`) is drawn on
// the crowd's own skiing figure (`crowd-shapes.ts`), posed by the crowd's
// dials (`dialsOf`: the player's skate at his pace and stride) and dressed
// in a skier's kit (`outfitOf`) — a mesh a body and cut of its own, as big
// as the plan's skaters of that body. The SNOWBALLS in the air and the
// balls the children roll to their snowmen are one instanced ball
// (`snowballAt`, `rolledBall`: pure functions of the clock).
//
// Presentation, end to end: it reads the map, the plan and the engine's
// clock and writes nothing. A free ride's only (`hasCivilians`).

import * as THREE from "three";
import { CROWD_BODIES, type Amateur, type CrowdBody, type GameState, type Level } from "@engine";

import { civilianKit, kitParts, type CivilianKit } from "./civilian-dress.ts";
import { CIVILIAN_POSES, civilianDials, snowballAt } from "./civilian-moves.ts";
import {
  civilianAt,
  rolledBall,
  type Ball,
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
import { outfitOf, type Outfit } from "./crowd-dress.ts";
import { CROWD_POSES, dialsOf } from "./crowd-rig.ts";
import { CROWD_LODS, buildCrowdFigure, crowdMaterial, type CrowdLod } from "./crowd-shapes.ts";
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
const SKI_TARGETS = CROWD_POSES.length;
/** How far a skater goes a skating stride (a push off each leg), m — what
 * his strides are counted off the ground he has covered. */
const SKATE_STRIDE = 2.4;

/** The numbers the crowd's dials read for a skater on the base: stood up,
 * pushing while he moves, his stride count off the metres covered. */
type Skater = Pick<
  Amateur,
  | "id"
  | "body"
  | "crouch"
  | "lean"
  | "plough"
  | "across"
  | "fall"
  | "fallSide"
  | "push"
  | "pole"
  | "mode"
  | "airAt"
  | "airT"
  | "speed"
  | "turnSide"
  | "turnT"
  | "turnHeld"
>;

export function createCiviliansView(level: Level, haze: HazeUniforms): CiviliansView {
  const group = new THREE.Group();
  group.name = "civilians";
  const plan: CivilianPlan = civilianPlanFor(level);
  const hour = civilianHour(level);
  const material = civilianMaterial(haze);
  const depth = civilianDepth(createShadeDepth(haze));
  const kits: CivilianKit[] = plan.people.map((c) => civilianKit(c, level.seed));
  const ids = plan.people.map((_, i) => i);
  /** Every skater's kit, a crowd outfit off a stand-in id past the crowd's. */
  const outfits = new Map<number, Outfit>();
  plan.people.forEach((c, i) => {
    if (c.skis) {
      outfits.set(
        i,
        outfitOf({ id: 50000 + i, body: c.body, rank: 0 } as Amateur, undefined, level.seed),
      );
    }
  });

  // A mesh a body and cut, each as big as that body's share of the plan.
  const counts = Object.fromEntries(CROWD_BODIES.map((b) => [b, 0])) as Record<CrowdBody, number>;
  const skiCounts = Object.fromEntries(CROWD_BODIES.map((b) => [b, 0])) as Record<
    CrowdBody,
    number
  >;
  for (const c of plan.people) (c.skis ? skiCounts : counts)[c.body] += 1;
  /** Where each person lives, for the cheap cull: the middle of his route
   * (or his home) and how far it reaches from there. */
  const reachOf = plan.people.map((c) => {
    if (!c.leg) return { x: c.home.x, z: c.home.z, r: 0 };
    const xs = c.leg.points.map((p) => p.x);
    const zs = c.leg.points.map((p) => p.z);
    const x = (Math.min(...xs) + Math.max(...xs)) / 2;
    const z = (Math.min(...zs) + Math.max(...zs)) / 2;
    return { x, z, r: Math.max(...c.leg.points.map((p) => Math.hypot(p.x - x, p.z - z))) + 2 };
  });
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

  // The skaters: the crowd's skiing figure, a mesh a body and cut.
  const skiMaterial = crowdMaterial(haze);
  const skiDepth = shadeDepth(haze);
  type SkiSlot = Omit<Slot, "kit">;
  const skiSlots = new Map<string, SkiSlot>();
  for (const body of CROWD_BODIES) {
    const capacity = skiCounts[body];
    if (capacity === 0) continue;
    for (const lod of CROWD_LODS) {
      const geometry = buildCrowdFigure(body, lod).clone();
      const attr = () => {
        const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        a.setUsage(THREE.DynamicDrawUsage);
        return a;
      };
      const dress = attr();
      const dress2 = attr();
      geometry.setAttribute("aDress", dress);
      geometry.setAttribute("aDress2", dress2);
      const mesh = new THREE.InstancedMesh(geometry, skiMaterial, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.morphTargetInfluences = new Array<number>(SKI_TARGETS).fill(0);
      mesh.setMorphAt(0, mesh);
      mesh.castShadow = lod !== "far";
      if (mesh.castShadow) mesh.customDepthMaterial = skiDepth;
      mesh.receiveShadow = lod === "near";
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      mesh.name = `civilians-ski-${body}-${lod}`;
      group.add(mesh);
      const weights = mesh.morphTexture!.image.data as unknown as Float32Array;
      skiSlots.set(`${body}:${lod}`, { mesh, dress, dress2, weights, n: 0 });
    }
  }

  // The balls: a snowball in the air, a ball rolled to a snowman.
  const throwers = plan.people.filter((c) => c.role === "snowballer" || c.role === "roller");
  const balls = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 1),
    hazeMaterial(new THREE.MeshLambertMaterial({ color: 0xf2f5f8 }), haze, "civilian-balls"),
    Math.max(1, throwers.length),
  );
  balls.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  balls.castShadow = true;
  balls.customDepthMaterial = shadeDepth(haze);
  balls.frustumCulled = false;
  balls.count = 0;
  balls.name = "civilian-balls";
  group.add(balls);
  const ball: Ball = { x: 0, y: 0, z: 0, r: 0 };
  const flying = { x: 0, y: 0, z: 0 };
  /** A snowball's radius in the air, m. */
  const SNOWBALL_R = 0.06;

  const skater: Skater = {
    id: 0,
    body: "man",
    crouch: 0.2,
    lean: 0,
    plough: 0,
    across: 0,
    fall: 0,
    fallSide: 1,
    push: 0,
    pole: 0,
    mode: "ski",
    airAt: 0,
    airT: 0,
    speed: 0,
    turnSide: 0,
    turnT: 0,
    turnHeld: 0,
  };
  const skiDials = new Float32Array(SKI_TARGETS);
  const normal = { x: 0, y: 1, z: 0 };
  const up = new THREE.Vector3();
  const fwd = new THREE.Vector3();
  const right = new THREE.Vector3();
  const basis = new THREE.Matrix4();

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
    for (const slot of skiSlots.values()) slot.n = 0;
    let nBalls = 0;
    const t = state.t;
    for (let i = 0; i < plan.people.length; i++) {
      const c = plan.people[i];
      // Cheap first: where he lives, before he is posed.
      const home = reachOf[i];
      if (Math.hypot(home.x - eye.x, home.z - eye.z) - home.r > CIVILIAN_CUTS.far) continue;
      civilianAt(plan, i, t, hour, pose);
      if (!pose.shown) continue;
      const dx = pose.x - eye.x;
      const dz = pose.z - eye.z;
      const d2 = dx * dx + dz * dz;
      if (d2 > reach2) continue;
      const far = Math.sqrt(d2 + (pose.y - eye.y) ** 2);
      const lod: CrowdLod =
        far < CIVILIAN_CUTS.near ? "near" : far < CIVILIAN_CUTS.mid ? "mid" : "far";
      if (far < CIVILIAN_CUTS.mid) {
        // A ball in the air or rolled, close enough to see.
        const b = rolledBall(plan, i, t, ball);
        const f = b ? null : snowballAt(pose, flying);
        if (b || f) {
          const r = b ? b.r : SNOWBALL_R;
          const p = b ?? f!;
          m.makeScale(r, r, r).setPosition(p.x, p.y, p.z);
          balls.setMatrixAt(nBalls++, m);
        }
      }
      if (c.skis) {
        // ON HIS SKIS: the crowd's figure, stood on the snow's slope.
        const slot = skiSlots.get(`${c.body}:${lod}`);
        if (!slot) continue;
        const moving = pose.activity === "skate";
        skater.id = 50000 + i;
        skater.body = c.body;
        skater.speed = moving ? c.leg!.speed : 0;
        skater.push = moving ? 1 : 0;
        skater.pole = pose.walked / SKATE_STRIDE;
        dialsOf(skater, skiDials, t, 0);
        level.normalAt(pose.x, pose.z, normal);
        up.set(normal.x, normal.y, normal.z);
        fwd.set(Math.sin(pose.heading), 0, Math.cos(pose.heading));
        right.crossVectors(up, fwd).normalize();
        fwd.crossVectors(right, up).normalize();
        basis.makeBasis(right, up, fwd);
        quat.setFromRotationMatrix(basis);
        const k = slot.n++;
        m.compose(pos.set(pose.x, level.groundAt(pose.x, pose.z), pose.z), quat, one);
        slot.mesh.setMatrixAt(k, m);
        const w = slot.weights;
        const at = k * (SKI_TARGETS + 1);
        w[at] = 1;
        for (let j = 0; j < SKI_TARGETS; j++) w[at + 1 + j] = skiDials[j];
        const o = outfits.get(i)!;
        slot.dress.setXYZW(k, o[0], o[1], o[2], o[3]);
        slot.dress2.setXYZW(k, o[4], o[5], o[6], 0);
        continue;
      }
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
    for (const slot of [...slots.values(), ...skiSlots.values()]) {
      slot.mesh.count = slot.n;
      slot.mesh.visible = slot.n > 0;
      if (slot.n === 0) continue;
      slot.mesh.instanceMatrix.needsUpdate = true;
      slot.mesh.morphTexture!.needsUpdate = true;
      slot.dress.needsUpdate = true;
      slot.dress2.needsUpdate = true;
      if ("kit" in slot) (slot as Slot).kit.needsUpdate = true;
    }
    balls.count = nBalls;
    balls.visible = nBalls > 0;
    if (nBalls > 0) balls.instanceMatrix.needsUpdate = true;
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
      for (const slot of skiSlots.values()) {
        slot.mesh.geometry.dispose();
        slot.mesh.dispose();
      }
      skiSlots.clear();
      balls.geometry.dispose();
      (balls.material as THREE.Material).dispose();
      balls.dispose();
      skiMaterial.dispose();
      if (props) {
        props.geometry.dispose();
        (props.material as THREE.Material).dispose();
      }
      material.dispose();
      depth.dispose();
    },
  };
}
