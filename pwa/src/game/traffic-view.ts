// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE VILLAGE'S TRAFFIC, DRAWN — the cars, the ski bus and the bicycles on
// the village's streets where the engine has them at the run's clock
// (`traffic.ts`'s `vehicleAt`), and the cars parked in its bays: one
// instanced mesh a kind and cut (`traffic-shapes.ts`: NEAR within
// `TRAFFIC_CUTS.near` of the lens, with its arches, mirrors, plates and
// wheels; FAR beyond it, DISTANT past `.distant` to `.far`), the snow, the roof boxes and the racks
// instances of their own over the cars dealt them (`traffic-look.ts`), the
// wheels one mesh turned by the ground they have rolled and steered by the
// engine's turn, and the cyclists the crowd's own bodies in their winter
// kit posed by the cranks' turn (`traffic-rider.ts`). Every vehicle's paint
// is its instance's colour and its lamps its instance's levels, lit in the
// one material's shader (`trafficMaterial`): the headlamps and the
// daytime lamps, the tail lamps and the brake lamps over them, the
// indicators flashing, the bus's windows lit after dark — and after dark a
// GLOW on every lamp lit (`glow-sprite.ts`), and the nearest cars' dipped
// beams dealt lamp slots of their own (`lamps`, `headlamp.ts`' `Flood`),
// lighting the snow and the streets ahead of them. The lens is kept out of
// every vehicle near it (`solids`, `camera-clear.ts`).
//
// Presentation, end to end: it reads the map, the plan and the engine's
// clock and writes nothing, so no digest moves. Drawn on every run whose
// map has a village; met by the skier on a free ride alone
// (`traffic-contact.ts`).

import * as THREE from "three";
import {
  VEHICLES,
  freshVehiclePose,
  trafficOf,
  vehicleAt,
  type Amateur,
  type GameState,
  type Level,
  type TrafficPlan,
  type VehicleKind,
  type VehiclePose,
} from "@engine";

import type { SolidBox } from "./camera-clear.ts";
import { PART } from "./civilian-dress.ts";
import { buildPosedFigure, civilianMaterial } from "./civilian-shapes.ts";
import { outfitOf } from "./crowd-dress.ts";
import { glow } from "./glow-sprite.ts";
import type { Flood } from "./headlamp.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { lampLayout, lampLevels, vehicleLook, type VehicleLook } from "./traffic-look.ts";
import { PEDAL_POSES, pedalDials, pedalTargets } from "./traffic-rider.ts";
import { buildBikeWheel, buildVehicle, buildWheel, type TrafficCut } from "./traffic-shapes.ts";

/** Where the cuts hand over, m from the lens: the near cut and its wheels
 * and riders, the far cut to `distant`, the distant cut to the last; a
 * bicycle past `bike` is not drawn. */
export const TRAFFIC_CUTS = { near: 90, distant: 240, far: 900, bike: 260, rider: 40 };

/** How many cars' dipped beams are dealt lamp slots, and within how far of
 * the lens, m. */
const BEAMS = { cars: 2, reach: 140 };
/** A dipped beam (`lampReach`): a spot some 25° across with the light
 * flooding out to some 50° — the low beam's wide, flat pool — its light a
 * neutral white, its power over a flood's; aimed down 3° (the dip). */
const BEAM = [0.88, 0.975, 0.62, 0.2] as const;
const BEAM_COLOUR = [1.0, 0.93, 0.8] as const;
const BEAM_POWER = 1.5;
const DIP = 0.05;
/** Past this from the lens a vehicle is no solid to it, m. */
const SOLID_REACH = 60;

export type TrafficScene = {
  group: THREE.Group;
  /** Every vehicle where it is at the run's clock, seen from `eye` with
   * its lamps lit at `lit` (`SkyLook.lamps`), and THE NEAREST CARS'
   * DIPPED BEAMS pushed into `out`. */
  update(state: GameState, lit: number, eye: THREE.Vector3, out: Flood[]): void;
  /** Every vehicle near the lens as the box it keeps out of. */
  solids(): readonly SolidBox[];
  dispose(): void;
};

/** THE ONE MATERIAL every vehicle is drawn in: the body's clear coat, the
 * glass, the rubber and the plastic by the vertex's roughness, the paint the
 * instance's where the vertex is painted, the lenses lit by the instance's
 * levels and the bus's windows by the night. */
export function trafficMaterial(haze: HazeUniforms, interior: { value: number }): THREE.Material {
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.4,
    metalness: 0.12,
  });
  return hazeMaterial(material, haze, "traffic", (shader) => {
    shader.uniforms.uInterior = interior;
    shader.vertexShader = `attribute float aPaint;
attribute vec4 aLamp;
attribute float aRough;
attribute float aFold;
attribute float aGlass;
attribute vec4 aLevel;
uniform float uInterior;
varying vec3 vGlow;
varying float vRough;
${shader.vertexShader}`
      .replace(
        "#include <color_vertex>",
        `vColor = vec4(1.0);
vColor.rgb *= color;
#ifdef USE_INSTANCING_COLOR
vColor.rgb *= mix(vec3(1.0), instanceColor.rgb, aPaint);
#endif
vRough = aRough;
vec3 lampHue = aLamp.x * vec3(1.0, 0.93, 0.82) + aLamp.y * vec3(1.0, 0.03, 0.015)
  + (aLamp.z + aLamp.w) * vec3(1.0, 0.4, 0.02);
vGlow = lampHue * dot(aLamp, aLevel) * 5.0 + aGlass * uInterior * vec3(1.0, 0.82, 0.58);`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
if (aFold > 0.5 && aLevel.x < 0.5) transformed = vec3(0.0);`,
      );
    shader.fragmentShader = `varying vec3 vGlow;
varying float vRough;
${shader.fragmentShader}`
      .replace(
        "#include <roughnessmap_fragment>",
        "#include <roughnessmap_fragment>\nroughnessFactor = vRough;",
      )
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance += vGlow;",
      );
  });
}

/** One instanced mesh and its per-instance levels. */
type Slot = {
  mesh: THREE.InstancedMesh;
  level: THREE.InstancedBufferAttribute;
  n: number;
};

/** A cyclist's figure mesh at a cut and the buffers it is dressed with. */
type RiderSlot = {
  mesh: THREE.InstancedMesh;
  dress: THREE.InstancedBufferAttribute;
  dress2: THREE.InstancedBufferAttribute;
  kit: THREE.InstancedBufferAttribute;
  weights: Float32Array;
  n: number;
};

const CAR_KINDS: readonly VehicleKind[] = ["hatch", "estate", "suv", "van", "bus"];

/** One thing to draw: a moving vehicle at a moment, or a parked car. */
type Drawn = {
  kind: VehicleKind;
  look: VehicleLook;
  pose: VehiclePose | null;
  x: number;
  y: number;
  z: number;
  heading: number;
  /** How far from the lens, m. */
  far: number;
};

export function createTrafficScene(level: Level, haze: HazeUniforms): TrafficScene | null {
  const plan: TrafficPlan | null = trafficOf(level);
  if (!plan) return null;
  const group = new THREE.Group();
  group.name = "traffic";
  const interior = { value: 0 };
  const material = trafficMaterial(haze, interior);
  const geometries: THREE.BufferGeometry[] = [];
  const seed = level.seed;
  const moving = plan.vehicles.map((v, i) => vehicleLook(seed, i, v.kind, false));
  const parked = plan.parked.map((p, i) =>
    vehicleLook(seed, plan.vehicles.length + i, p.kind, true),
  );
  const count = (kind: VehicleKind) =>
    plan.vehicles.filter((v) => v.kind === kind).length +
    plan.parked.filter((p) => p.kind === kind).length;

  const slot = (
    geo: THREE.BufferGeometry,
    capacity: number,
    name: string,
    shadow: boolean,
  ): Slot => {
    const g = geo.clone();
    geometries.push(g);
    geo.dispose();
    const level = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    level.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute("aLevel", level);
    const mesh = new THREE.InstancedMesh(g, material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.setColorAt(0, new THREE.Color(1, 1, 1));
    mesh.frustumCulled = false;
    mesh.castShadow = shadow;
    mesh.receiveShadow = shadow;
    mesh.count = 0;
    mesh.name = name;
    group.add(mesh);
    return { mesh, level, n: 0 };
  };

  // A body a kind and cut; the snow, boxes and racks over the near cut.
  const bodies = new Map<string, Slot>();
  const snow = new Map<VehicleKind, Slot>();
  const boxes = new Map<VehicleKind, Slot>();
  const racks = new Map<VehicleKind, Slot>();
  for (const kind of [...CAR_KINDS, "bike" as const]) {
    const n = count(kind);
    if (n === 0) continue;
    for (const cut of ["near", "far", "distant"] as TrafficCut[]) {
      if (kind === "bike" && cut !== "near") continue;
      const g = buildVehicle(kind, cut);
      bodies.set(`${kind}:${cut}`, slot(g.body, n, `traffic-${kind}-${cut}`, cut === "near"));
      if (cut === "near") {
        if (g.snow) snow.set(kind, slot(g.snow, n, `traffic-${kind}-snow`, false));
        if (g.box) boxes.set(kind, slot(g.box, n, `traffic-${kind}-box`, true));
        if (g.rack) racks.set(kind, slot(g.rack, n, `traffic-${kind}-rack`, true));
      } else {
        for (const x of [g.snow, g.box, g.rack]) x?.dispose();
      }
    }
  }
  const carCount = CAR_KINDS.reduce((a, k) => a + count(k), 0);
  const wheels = slot(buildWheel(), Math.max(1, carCount * 4), "traffic-wheels", true);
  const bikeCount = count("bike");
  const bikeWheels = slot(
    buildBikeWheel(),
    Math.max(1, bikeCount * 2),
    "traffic-bike-wheels",
    true,
  );

  // THE CYCLISTS: a figure a body (near and mid), dressed per instance.
  const riderMaterial = civilianMaterial(haze);
  const riders = new Map<string, RiderSlot>();
  const outfits = moving.map((look, i) =>
    outfitOf({ id: 70000 + i, body: look.rider, rank: 0 } as Amateur, undefined, seed),
  );
  const TARGETS = PEDAL_POSES.length;
  for (const body of new Set(
    plan.vehicles.flatMap((v, i) => (v.kind === "bike" ? [moving[i].rider] : [])),
  )) {
    const capacity = plan.vehicles.filter(
      (v, i) => v.kind === "bike" && moving[i].rider === body,
    ).length;
    for (const lod of ["near", "mid"] as const) {
      const g = buildPosedFigure(body, lod, pedalTargets(body), `cyclist:${body}:${lod}`);
      geometries.push(g);
      const attr = () => {
        const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        a.setUsage(THREE.DynamicDrawUsage);
        return a;
      };
      const dress = attr();
      const dress2 = attr();
      const kit = attr();
      g.setAttribute("aDress", dress);
      g.setAttribute("aDress2", dress2);
      g.setAttribute("aKit", kit);
      const mesh = new THREE.InstancedMesh(g, riderMaterial, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.morphTargetInfluences = new Array<number>(TARGETS).fill(0);
      mesh.setMorphAt(0, mesh);
      mesh.castShadow = lod === "near";
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.name = `traffic-cyclist-${body}-${lod}`;
      group.add(mesh);
      const weights = mesh.morphTexture!.image.data as unknown as Float32Array;
      riders.set(`${body}:${lod}`, { mesh, dress, dress2, kit, weights, n: 0 });
    }
  }

  // THE GLOWS on the lamps after dark.
  const MAX_GLOWS = Math.max(4, plan.vehicles.length * 4);
  const glowPos = new Float32Array(MAX_GLOWS * 3);
  const glowCol = new Float32Array(MAX_GLOWS * 3);
  const glowGeo = new THREE.BufferGeometry();
  glowGeo.setAttribute("position", new THREE.BufferAttribute(glowPos, 3));
  glowGeo.setAttribute("color", new THREE.BufferAttribute(glowCol, 3));
  geometries.push(glowGeo);
  const glowMat = new THREE.PointsMaterial({
    size: 1.4,
    map: glow(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
    fog: false,
  });
  const glows = new THREE.Points(glowGeo, glowMat);
  glows.frustumCulled = false;
  glows.renderOrder = 7;
  glows.name = "traffic-glows";
  group.add(glows);

  const poses = plan.vehicles.map(() => freshVehiclePose());
  const paint = new THREE.Color();
  const m = new THREE.Matrix4();
  const w = new THREE.Matrix4();
  const part = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler(0, 0, 0, "YXZ");
  const at = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const levels: [number, number, number, number] = [0, 0, 0, 0];
  const dials = new Float32Array(TARGETS);
  let dark = 0;
  const pool: THREE.Matrix4[] = [];
  let used = 0;
  const boxesOut: SolidBox[] = [];
  /** What was drawn this frame, for the lamps and the solids. */
  const drawn: Drawn[] = [];

  /** A vehicle's matrix: its middle on the road, turned to its heading,
   * pitched to the road under its axles and, a bicycle, leant into its turn. */
  const place = (d: Drawn, out: THREE.Matrix4): THREE.Matrix4 => {
    const V = VEHICLES[d.kind];
    const fx = Math.sin(d.heading);
    const fz = Math.cos(d.heading);
    const half = V.wheelbase / 2;
    const yf = level.groundAt(d.x + fx * half, d.z + fz * half);
    const yr = level.groundAt(d.x - fx * half, d.z - fz * half);
    const pitch = Math.atan2(yf - yr, V.wheelbase);
    let lean = 0;
    if (d.kind === "bike" && d.pose) {
      const k = Math.tan(d.pose.steer) / V.wheelbase;
      lean = Math.atan((d.pose.speed * d.pose.speed * k) / 9.81);
    }
    e.set(-pitch, d.heading, -lean);
    q.setFromEuler(e);
    return out.compose(at.set(d.x, (yf + yr) / 2, d.z), q, one);
  };

  const put = (
    s: Slot | undefined,
    mat: THREE.Matrix4,
    colour: number | null,
    l: readonly number[],
  ) => {
    if (!s) return;
    const k = s.n++;
    s.mesh.setMatrixAt(k, mat);
    if (colour !== null) s.mesh.setColorAt(k, paint.set(colour));
    s.level.setXYZW(k, l[0], l[1], l[2], l[3]);
  };

  /** The wheels of a vehicle drawn near. */
  const wheelsOf = (d: Drawn, body: THREE.Matrix4) => {
    const V = VEHICLES[d.kind];
    const roll = d.pose?.roll ?? 0;
    const steer = d.pose?.steer ?? 0;
    const zf = V.length / 2 - V.front;
    const zr = zf - V.wheelbase;
    const spin = roll / V.wheel;
    if (d.kind === "bike") {
      for (const z of [zf, zr]) {
        part.makeTranslation(0, V.wheel, z);
        if (z === zf) part.multiply(w.makeRotationY(steer));
        part.multiply(w.makeRotationX(spin)).multiply(w.makeScale(0.075, V.wheel, V.wheel));
        put(bikeWheels, m.multiplyMatrices(body, part), null, [0, 0, 0, 0]);
      }
      return;
    }
    const width = d.kind === "bus" ? 0.32 : d.kind === "van" ? 0.22 : 0.2;
    for (const z of [zf, zr]) {
      for (const side of [1, -1]) {
        const dual = d.kind === "bus" && z === zr;
        part.makeTranslation(side * (V.track / 2 - (dual ? 0.05 : 0)), V.wheel, z);
        part.multiply(w.makeRotationY((z === zf ? steer : 0) + (side < 0 ? Math.PI : 0)));
        part.multiply(w.makeRotationX(side < 0 ? -spin : spin));
        part.multiply(w.makeScale(dual ? width * 1.8 : width, V.wheel, V.wheel));
        put(wheels, m.multiplyMatrices(body, part), null, [0, 0, 0, 0]);
      }
    }
  };

  /** A cyclist sat on his bicycle. */
  const riderOf = (i: number, body: THREE.Matrix4, d: Drawn, far: boolean) => {
    const look = d.look;
    const s = riders.get(`${look.rider}:${far ? "mid" : "near"}`);
    if (!s) return;
    const k = s.n++;
    s.mesh.setMatrixAt(k, body);
    pedalDials(d.pose?.roll ?? 0, dials);
    const base = k * (TARGETS + 1);
    s.weights[base] = 1;
    for (let j = 0; j < TARGETS; j++) s.weights[base + 1 + j] = dials[j];
    const o = outfits[i];
    s.dress.setXYZW(k, o[0], o[1], o[2], o[3]);
    s.dress2.setXYZW(k, o[4], o[5], o[6], o[0]);
    s.kit.setXYZW(k, look.helmet ? PART.helmet : PART.beanie, 0, 0, 0);
  };

  /** The glows of a lit vehicle's lamps. */
  let nGlow = 0;
  const lampAt = new THREE.Vector3();
  const glowOf = (d: Drawn, body: THREE.Matrix4, l: readonly number[]) => {
    const lay = lampLayout(d.kind);
    const xs = d.kind === "bike" ? [0] : [-1, 1];
    const head = l[0] * dark;
    const tail = l[1] * (0.25 + 0.75 * dark);
    for (const sx of xs) {
      if (head > 0.05 && nGlow < MAX_GLOWS) {
        lampAt.set(sx * lay.head.x, lay.head.y, lay.head.z + 0.05).applyMatrix4(body);
        glowPos.set([lampAt.x, lampAt.y, lampAt.z], nGlow * 3);
        glowCol.set([head * 0.9, head * 0.85, head * 0.75], nGlow * 3);
        nGlow++;
      }
      if (tail > 0.05 && nGlow < MAX_GLOWS) {
        lampAt.set(sx * lay.tail.x, lay.tail.y, lay.tail.z - 0.05).applyMatrix4(body);
        glowPos.set([lampAt.x, lampAt.y, lampAt.z], nGlow * 3);
        glowCol.set([tail * 0.7, tail * 0.04, tail * 0.02], nGlow * 3);
        nGlow++;
      }
    }
  };

  const off: readonly number[] = [0, 0, 0, 0];
  return {
    group,
    update(state, lit, eye, out) {
      const t = state.t;
      dark = lit;
      used = 0;
      for (const s of [
        ...bodies.values(),
        ...snow.values(),
        ...boxes.values(),
        ...racks.values(),
        wheels,
        bikeWheels,
      ])
        s.n = 0;
      for (const s of riders.values()) s.n = 0;
      nGlow = 0;
      drawn.length = 0;
      interior.value = 0.55 * dark;
      const visit = (d: Drawn, i: number | null) => {
        const dist = Math.hypot(d.x - eye.x, d.z - eye.z);
        const bike = d.kind === "bike";
        if (dist > (bike ? TRAFFIC_CUTS.bike : TRAFFIC_CUTS.far)) return;
        const near = bike || dist < TRAFFIC_CUTS.near;
        drawn.push(d);
        if (used === pool.length) pool.push(new THREE.Matrix4());
        const body = place(d, pool[used++]);
        d.far = dist;
        if (d.pose) lampLevels(d.pose, dark, t + (i ?? 0) * 0.13, levels);
        const l = d.pose ? levels : off;
        const cut = near ? "near" : dist < TRAFFIC_CUTS.distant ? "far" : "distant";
        put(bodies.get(`${d.kind}:${cut}`), body, d.look.paint, l);
        if (d.pose && dark > 0.02) glowOf(d, body, l);
        if (!near) return;
        if (d.look.snow !== "none")
          put(snow.get(d.kind), body, null, [d.look.snow === "all" ? 1 : 0, 0, 0, 0]);
        if (d.look.roof === "box") put(boxes.get(d.kind), body, d.look.box, off);
        if (d.look.roof === "rack") put(racks.get(d.kind), body, null, off);
        if (dist < TRAFFIC_CUTS.near * (bike ? 1.4 : 1)) wheelsOf(d, body);
        if (bike && i !== null) riderOf(i, body, d, dist > TRAFFIC_CUTS.rider);
      };
      for (let i = 0; i < plan.vehicles.length; i++) {
        const p = vehicleAt(plan, i, t, poses[i]);
        if (!p.shown) continue;
        visit(
          {
            kind: p.kind,
            look: moving[i],
            pose: p,
            x: p.x,
            y: p.y,
            z: p.z,
            heading: p.heading,
            far: 0,
          },
          i,
        );
      }
      plan.parked.forEach((c, i) =>
        visit(
          {
            kind: c.kind,
            look: parked[i],
            pose: null,
            x: c.x,
            y: c.y,
            z: c.z,
            heading: c.heading,
            far: 0,
          },
          null,
        ),
      );
      for (const s of [
        ...bodies.values(),
        ...snow.values(),
        ...boxes.values(),
        ...racks.values(),
        wheels,
        bikeWheels,
      ]) {
        s.mesh.count = s.n;
        s.mesh.visible = s.n > 0;
        if (s.n === 0) continue;
        s.mesh.instanceMatrix.needsUpdate = true;
        if (s.mesh.instanceColor) s.mesh.instanceColor.needsUpdate = true;
        s.level.needsUpdate = true;
      }
      for (const s of riders.values()) {
        s.mesh.count = s.n;
        s.mesh.visible = s.n > 0;
        if (s.n === 0) continue;
        s.mesh.instanceMatrix.needsUpdate = true;
        s.mesh.morphTexture!.needsUpdate = true;
        s.dress.needsUpdate = true;
        s.dress2.needsUpdate = true;
        s.kit.needsUpdate = true;
      }
      glowGeo.setDrawRange(0, nGlow);
      glowGeo.attributes.position.needsUpdate = true;
      glowGeo.attributes.color.needsUpdate = true;
      glows.visible = nGlow > 0;
      if (lit < 0.02) return;
      const near = drawn
        .filter((d) => d.pose && d.kind !== "bike" && d.far < BEAMS.reach)
        .sort((a, b) => a.far - b.far)
        .slice(0, BEAMS.cars);
      for (const d of near) {
        const V = VEHICLES[d.kind];
        const lay = lampLayout(d.kind);
        const fx = Math.sin(d.heading);
        const fz = Math.cos(d.heading);
        const ahead = V.length / 2 + 0.1;
        const y = level.groundAt(d.x + fx * ahead, d.z + fz * ahead) + lay.head.y;
        out.push({
          x: d.x + fx * ahead,
          y,
          z: d.z + fz * ahead,
          dx: fx * Math.cos(DIP),
          dy: -Math.sin(DIP),
          dz: fz * Math.cos(DIP),
          colour: BEAM_COLOUR,
          beam: BEAM,
          power: BEAM_POWER * lit,
        });
      }
    },
    solids() {
      boxesOut.length = 0;
      for (const d of drawn) {
        if (d.kind === "bike" || d.far > SOLID_REACH) continue;
        const V = VEHICLES[d.kind];
        boxesOut.push({
          x: d.x,
          z: d.z,
          dx: Math.sin(d.heading),
          dz: Math.cos(d.heading),
          halfLength: V.length / 2,
          halfWidth: V.width / 2,
          base: d.y - 0.5,
          top: d.y + V.height + 0.4,
        });
      }
      return boxesOut;
    },
    dispose() {
      for (const g of geometries) g.dispose();
      material.dispose();
      riderMaterial.dispose();
      glowMat.dispose();
    },
  };
}

/** Vehicles counted by kind, for the labs. */
export function trafficCounts(plan: TrafficPlan): Record<VehicleKind, number> {
  const out = { hatch: 0, estate: 0, suv: 0, van: 0, bus: 0, bike: 0 } as Record<
    VehicleKind,
    number
  >;
  for (const v of plan.vehicles) out[v.kind]++;
  for (const p of plan.parked) out[p.kind]++;
  return out;
}
