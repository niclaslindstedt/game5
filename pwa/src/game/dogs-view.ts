// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE DOGS, DRAWN — the village's dogs out on their walks (`dog-walk.ts`),
// one instanced mesh a KIND and CUT (`dog-shapes.ts`) holding whatever of
// that kind is out and within sight this frame, each stood where its walk
// has it at the run's clock (`dogAt`), turned to its heading, sized to
// itself, posed by the weights of what it does (`dogDials`) and painted in
// its own coat, collar and, on some, a dog coat. And beside them:
//
//   * THE LEADS, from the owner's right hand (`leadHand`, off his pose) to
//     each dog's collar (`collarOf`, blended by the dog's own weights as
//     its mesh is): hung in a sag as deep as the slack in it, drawn
//     straight where the dog pulls it taut;
//   * WHAT THE DOGS LEAVE (`messAt`): every pile dropped on the sidewalks
//     since the run began and not bagged, a dark-brown coil a dog's size,
//     steaming in the cold its first minute, and the yellow patches where a
//     dog lifted its leg or squatted.
//
// The owners themselves are drawn with the civilians (`civilians-view.ts`).
// Presentation, end to end: it reads the map, the plan and the engine's
// clock and writes nothing. A free ride's only (`hasCivilians`).

import * as THREE from "three";
import type { GameState, Level } from "@engine";

import { civilianHour, freshCivilianPose } from "./civilian-plan.ts";
import { leadHand, stoopOf } from "./civilian-moves.ts";
import { DOG_COATS, DOG_COLLARS, DOG_SPECS, DOG_WALK, type DogKind } from "./dog-defs.ts";
import { DOG_POSES, collarOf, dogDials, dogSkel, leadCurve, type V3 } from "./dog-pose.ts";
import { DOG_LODS, buildDogFigure, dogMaterial, packColour, type DogLod } from "./dog-shapes.ts";
import { dogPlanFor, messAt, type Mess } from "./dog-walk.ts";
import { dogAt, dogWalkerAt, freshDogPose } from "./dog-walk-pose.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { shadeDepth } from "./terrain-shade.ts";
import type { ViewCull } from "./view-cull.ts";

/** Where the dogs' cuts hand over, the furthest a dog is drawn, and the
 * furthest what it left is, m from the lens. */
export const DOG_CUTS = { near: 30, far: 170, mess: 80 };
/** A dog's bound for the cull (`view-cull.ts`), m, round and tall. */
const DOG_BOUND = 1.2;

/** The points a lead is hung through. */
const LEAD_POINTS = 12;
/** The puffs of steam over a fresh pile, and how long each takes to rise
 * and go, s. */
const STEAM = { puffs: 5, rise: 2.2, height: 0.32 };

type Slot = {
  mesh: THREE.InstancedMesh;
  coat: THREE.InstancedBufferAttribute;
  coat2: THREE.InstancedBufferAttribute;
  weights: Float32Array;
  n: number;
};

export type DogsView = {
  group: THREE.Group;
  update: (state: GameState, eye: THREE.Vector3, cull?: ViewCull) => void;
  dispose: () => void;
};

const TARGETS = DOG_POSES.length;
const HAND: V3 = [0, 0, 0];
const COLLAR: V3 = [0, 0, 0];
const CURVE: V3[] = [];

/** Each kind's collar at the stance and at every target, for the lead. */
const collars = new Map<DogKind, V3[]>();
function collarsOf(kind: DogKind): V3[] {
  let c = collars.get(kind);
  if (!c) {
    c = [collarOf(dogSkel(kind, "stand")), ...DOG_POSES.map((t) => collarOf(dogSkel(kind, t)))];
    collars.set(kind, c);
  }
  return c;
}

/** A pile: three coils of a dog's leaving, stacked and squashed, in the
 * faceted look — sized for a dog `DOG_SPECS.retriever.height` tall. */
export function pileGeometry(): THREE.BufferGeometry {
  const lumps: [number, number, number, number, number, number][] = [
    // x, y, z, length, thickness, turn
    [0, 0.018, 0, 0.075, 0.03, 0.2],
    [0.012, 0.042, 0.008, 0.055, 0.026, 1.4],
    [-0.006, 0.062, -0.004, 0.035, 0.02, 2.5],
    [0.05, 0.014, 0.03, 0.04, 0.022, 0.9],
  ];
  const pos: number[] = [];
  const m = new THREE.Matrix4();
  for (const [x, y, z, l, r, turn] of lumps) {
    const g = new THREE.DodecahedronGeometry(1, 0).toNonIndexed();
    m.compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn),
      new THREE.Vector3(r, r * 0.8, l),
    );
    g.applyMatrix4(m);
    pos.push(...(g.getAttribute("position").array as Float32Array));
    g.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/** A patch of yellow snow: a ragged disc a metre across, laid flat. */
export function patchGeometry(): THREE.BufferGeometry {
  const n = 11;
  const pos: number[] = [];
  const r = (k: number): number => 0.5 * (0.75 + 0.25 * Math.sin(k * 2.3) * Math.cos(k * 1.7));
  for (let k = 0; k < n; k++) {
    const a0 = (k / n) * Math.PI * 2;
    const a1 = ((k + 1) / n) * Math.PI * 2;
    pos.push(0, 0, 0);
    pos.push(Math.sin(a1) * r(k + 1), 0, Math.cos(a1) * r(k + 1));
    pos.push(Math.sin(a0) * r(k), 0, Math.cos(a0) * r(k));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute(
    "normal",
    new THREE.Float32BufferAttribute(
      pos.map((_, i) => (i % 3 === 1 ? 1 : 0)),
      3,
    ),
  );
  return g;
}

/** The steam's soft puffs, lit by nothing but fading into the air. */
function steamMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uScale: { value: 600 } },
    vertexShader: `attribute float aAlpha;
attribute float aSize;
uniform float uScale;
varying float vAlpha;
void main() {
  vAlpha = aAlpha;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `varying float vAlpha;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float a = smoothstep(0.5, 0.1, length(d)) * vAlpha;
  gl_FragColor = vec4(vec3(0.92, 0.94, 0.96), a);
  #include <colorspace_fragment>
}`,
  });
}

export function createDogsView(level: Level, haze: HazeUniforms): DogsView {
  const group = new THREE.Group();
  group.name = "dogs";
  const plan = dogPlanFor(level);
  const hour = civilianHour(level);
  if (!plan) {
    return { group, update() {}, dispose() {} };
  }
  /** Every dog, flat: its household, its number there and itself. */
  const dogs = plan.households.flatMap((hh) => hh.dogs.map((dog, d) => ({ h: hh.id, d, dog })));
  const material = dogMaterial(haze);
  const depth = shadeDepth(haze);
  const counts = new Map<DogKind, number>();
  for (const { dog } of dogs) counts.set(dog.kind, (counts.get(dog.kind) ?? 0) + 1);
  const slots = new Map<string, Slot>();
  for (const [kind, capacity] of counts) {
    for (const lod of DOG_LODS) {
      const geometry = buildDogFigure(kind, lod).clone();
      const attr = () => {
        const a = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
        a.setUsage(THREE.DynamicDrawUsage);
        return a;
      };
      const coat = attr();
      const coat2 = attr();
      geometry.setAttribute("aCoat", coat);
      geometry.setAttribute("aCoat2", coat2);
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.morphTargetInfluences = new Array<number>(TARGETS).fill(0);
      mesh.setMorphAt(0, mesh);
      mesh.castShadow = lod === "near";
      if (mesh.castShadow) mesh.customDepthMaterial = depth;
      mesh.receiveShadow = lod === "near";
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.visible = false;
      mesh.name = `dogs-${kind}-${lod}`;
      group.add(mesh);
      const weights = mesh.morphTexture!.image.data as unknown as Float32Array;
      slots.set(`${kind}:${lod}`, { mesh, coat, coat2, weights, n: 0 });
    }
  }
  const paint = dogs.map(({ dog }) => {
    const c = DOG_SPECS[dog.kind].coats[dog.coat];
    return [
      packColour(c.main),
      packColour(c.under),
      packColour(c.back),
      packColour(c.mask),
      packColour(DOG_COLLARS[dog.collar]),
      packColour(DOG_COATS[dog.garment]),
      dog.dressed ? 1 : 0,
    ];
  });

  // THE LEADS: a line strip each, as segments.
  const leadCount = dogs.length;
  const leadPos = new Float32Array(leadCount * (LEAD_POINTS - 1) * 2 * 3);
  const leadCol = new Float32Array(leadPos.length);
  const leadGeo = new THREE.BufferGeometry();
  const leadAttr = new THREE.BufferAttribute(leadPos, 3);
  leadAttr.setUsage(THREE.DynamicDrawUsage);
  leadGeo.setAttribute("position", leadAttr);
  leadGeo.setAttribute("color", new THREE.BufferAttribute(leadCol, 3));
  const leadColour = new THREE.Color();
  dogs.forEach(({ dog }, i) => {
    leadColour.setHex(DOG_COLLARS[dog.collar]).multiplyScalar(0.8);
    for (let k = 0; k < (LEAD_POINTS - 1) * 2; k++) {
      leadCol.set([leadColour.r, leadColour.g, leadColour.b], (i * (LEAD_POINTS - 1) * 2 + k) * 3);
    }
  });
  const leads = new THREE.LineSegments(
    leadGeo,
    new THREE.LineBasicMaterial({ vertexColors: true }),
  );
  leads.frustumCulled = false;
  leads.name = "dog-leads";
  group.add(leads);

  // WHAT THEY LEAVE: the piles, the patches, the steam.
  const kept = DOG_WALK.kept;
  const piles = new THREE.InstancedMesh(
    pileGeometry(),
    hazeMaterial(new THREE.MeshLambertMaterial({ flatShading: true }), haze, "dog-piles"),
    kept,
  );
  piles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  piles.castShadow = false;
  piles.receiveShadow = true;
  piles.frustumCulled = false;
  piles.count = 0;
  piles.name = "dog-piles";
  group.add(piles);
  const patches = new THREE.InstancedMesh(
    patchGeometry(),
    hazeMaterial(
      new THREE.MeshLambertMaterial({
        color: 0xd8b13c,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
      haze,
      "dog-patches",
    ),
    kept,
  );
  patches.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  patches.receiveShadow = true;
  patches.frustumCulled = false;
  patches.count = 0;
  patches.renderOrder = 1;
  patches.name = "dog-patches";
  group.add(patches);
  const steamCap = 24 * STEAM.puffs;
  const steamPos = new Float32Array(steamCap * 3);
  const steamAlpha = new Float32Array(steamCap);
  const steamSize = new Float32Array(steamCap);
  const steamGeo = new THREE.BufferGeometry();
  const steamAttrs = [
    new THREE.BufferAttribute(steamPos, 3),
    new THREE.BufferAttribute(steamAlpha, 1),
    new THREE.BufferAttribute(steamSize, 1),
  ];
  for (const a of steamAttrs) a.setUsage(THREE.DynamicDrawUsage);
  steamGeo.setAttribute("position", steamAttrs[0]);
  steamGeo.setAttribute("aAlpha", steamAttrs[1]);
  steamGeo.setAttribute("aSize", steamAttrs[2]);
  const steam = new THREE.Points(steamGeo, steamMaterial());
  steam.frustumCulled = false;
  steam.renderOrder = 2;
  steam.name = "dog-steam";
  group.add(steam);

  const m = new THREE.Matrix4();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const brown = new THREE.Color();
  const dials = new Float32Array(TARGETS);
  const pose = freshDogPose();
  const walker = freshCivilianPose();
  const hand: [number, number, number] = [0, 0, 0];
  const mess: Mess[] = [];
  /** Where each household's owner's lead hand is this frame (NaN: out of
   * sight or not out). */
  const hands = new Float32Array(plan.households.length * 3);

  const update: DogsView["update"] = (state, eye, cull) => {
    const t = state.t;
    for (const slot of slots.values()) slot.n = 0;
    // The owners' hands first.
    hands.fill(Number.NaN);
    for (let h = 0; h < plan.households.length; h++) {
      dogWalkerAt(plan, h, 0, t, hour, walker);
      if (!walker.shown) continue;
      if (Math.hypot(walker.x - eye.x, walker.z - eye.z) > DOG_CUTS.far) continue;
      leadHand(plan.households[h].walker, stoopOf(walker), hand);
      const c = Math.cos(walker.heading);
      const s = Math.sin(walker.heading);
      hands[h * 3] = walker.x + hand[0] * c + hand[2] * s;
      hands[h * 3 + 1] = walker.y + hand[1];
      hands[h * 3 + 2] = walker.z - hand[0] * s + hand[2] * c;
    }
    let nLeads = 0;
    for (let i = 0; i < dogs.length; i++) {
      const { h, d, dog } = dogs[i];
      if (Number.isNaN(hands[h * 3])) continue;
      dogAt(plan, h, d, t, hour, pose);
      if (!pose.shown) continue;
      const dist = Math.hypot(pose.x - eye.x, pose.y - eye.y, pose.z - eye.z);
      if (dist > DOG_CUTS.far) continue;
      const lod: DogLod = dist < DOG_CUTS.near ? "near" : "far";
      // A dog out of sight takes its lead with it; the owner keeps his hand.
      if (cull && !cull.seen(pose.x, pose.y, pose.z, DOG_BOUND, DOG_BOUND, lod === "near"))
        continue;
      const slot = slots.get(`${dog.kind}:${lod}`)!;
      const k = slot.n++;
      quat.setFromAxisAngle(yAxis, pose.heading);
      scale.setScalar(dog.scale);
      m.compose(pos.set(pose.x, pose.y, pose.z), quat, scale);
      slot.mesh.setMatrixAt(k, m);
      dogDials(pose, t, dog.id, dials);
      const w = slot.weights;
      const at = k * (TARGETS + 1);
      w[at] = 1;
      for (let j = 0; j < TARGETS; j++) w[at + 1 + j] = dials[j];
      const p = paint[i];
      slot.coat.setXYZW(k, p[0], p[1], p[2], p[3]);
      slot.coat2.setXYZW(k, p[4], p[5], p[6], 0);
      // THE LEAD to its collar, the collar where the dog's weights put it.
      const cs = collarsOf(dog.kind);
      let cx = cs[0][0];
      let cy = cs[0][1];
      let cz = cs[0][2];
      for (let j = 0; j < TARGETS; j++) {
        if (dials[j] === 0) continue;
        cx += dials[j] * (cs[j + 1][0] - cs[0][0]);
        cy += dials[j] * (cs[j + 1][1] - cs[0][1]);
        cz += dials[j] * (cs[j + 1][2] - cs[0][2]);
      }
      const c = Math.cos(pose.heading);
      const s = Math.sin(pose.heading);
      const ax = pose.x + (cx * c + cz * s) * dog.scale;
      const ay = pose.y + cy * dog.scale;
      const az = pose.z + (-cx * s + cz * c) * dog.scale;
      hangLead(
        nLeads++,
        hands[h * 3],
        hands[h * 3 + 1],
        hands[h * 3 + 2],
        ax,
        ay,
        az,
        dog.lead,
        pose.y,
      );
      // A lead's colour slot is its dog's.
      if (nLeads - 1 !== i) copyLeadColour(i, nLeads - 1);
    }
    for (const slot of slots.values()) {
      slot.mesh.count = slot.n;
      slot.mesh.visible = slot.n > 0;
      if (slot.n === 0) continue;
      slot.mesh.instanceMatrix.needsUpdate = true;
      slot.mesh.morphTexture!.needsUpdate = true;
      slot.coat.needsUpdate = true;
      slot.coat2.needsUpdate = true;
    }
    leadGeo.setDrawRange(0, nLeads * (LEAD_POINTS - 1) * 2);
    leadAttr.needsUpdate = true;
    (leadGeo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;
    leads.visible = nLeads > 0;

    // WHAT THEY LEFT, near enough to see.
    messAt(plan, t, hour, mess);
    let nPiles = 0;
    let nPatches = 0;
    let nSteam = 0;
    const reach2 = DOG_CUTS.mess * DOG_CUTS.mess;
    for (const it of mess) {
      const dx = it.x - eye.x;
      const dz = it.z - eye.z;
      if (dx * dx + dz * dz > reach2) continue;
      const size = it.size / DOG_SPECS.retriever.height;
      if (it.kind === "poop") {
        const k = 0.55 + 0.45 * size;
        quat.setFromAxisAngle(yAxis, it.heading + (it.seed % 7));
        m.compose(pos.set(it.x, it.y, it.z), quat, scale.setScalar(k));
        piles.setMatrixAt(nPiles, m);
        const shade = (it.seed % 13) / 13;
        brown.setRGB(0.16 + 0.08 * shade, 0.085 + 0.04 * shade, 0.04 + 0.015 * shade);
        piles.setColorAt(nPiles, brown);
        nPiles++;
        // Steaming its first minute.
        const age = t - it.at;
        if (age < DOG_WALK.steam && nSteam + STEAM.puffs <= steamCap) {
          const fade = 1 - age / DOG_WALK.steam;
          for (let q = 0; q < STEAM.puffs; q++) {
            const u = (age / STEAM.rise + q / STEAM.puffs) % 1;
            const sway = Math.sin((it.seed % 11) + u * 5 + q) * 0.03;
            steamPos[nSteam * 3] = it.x + sway;
            steamPos[nSteam * 3 + 1] = it.y + 0.05 + u * STEAM.height;
            steamPos[nSteam * 3 + 2] = it.z + sway * 0.6;
            steamAlpha[nSteam] = 0.32 * fade * Math.sin(Math.PI * u) * Math.min(1, k);
            steamSize[nSteam] = 0.06 + 0.16 * u;
            nSteam++;
          }
        }
      } else {
        const r = 0.18 + 0.22 * size;
        quat.setFromAxisAngle(yAxis, it.seed % 5);
        m.compose(pos.set(it.x, it.y + 0.006, it.z), quat, scale.set(r, 1, r * 0.85));
        patches.setMatrixAt(nPatches++, m);
      }
    }
    piles.count = nPiles;
    piles.visible = nPiles > 0;
    if (nPiles > 0) {
      piles.instanceMatrix.needsUpdate = true;
      if (piles.instanceColor) piles.instanceColor.needsUpdate = true;
    }
    patches.count = nPatches;
    patches.visible = nPatches > 0;
    if (nPatches > 0) patches.instanceMatrix.needsUpdate = true;
    steamGeo.setDrawRange(0, nSteam);
    for (const a of steamAttrs) a.needsUpdate = true;
    steam.visible = nSteam > 0;
  };

  /** Lead `n`'s points: from the hand (hx, hy, hz) to the collar, hung
   * as `leadCurve` has it. */
  function hangLead(
    n: number,
    hx: number,
    hy: number,
    hz: number,
    ax: number,
    ay: number,
    az: number,
    length: number,
    floor: number,
  ): void {
    HAND[0] = hx;
    HAND[1] = hy;
    HAND[2] = hz;
    COLLAR[0] = ax;
    COLLAR[1] = ay;
    COLLAR[2] = az;
    leadCurve(HAND, COLLAR, length, floor, LEAD_POINTS, CURVE);
    const base = n * (LEAD_POINTS - 1) * 6;
    for (let k = 1; k < LEAD_POINTS; k++) {
      const o = base + (k - 1) * 6;
      leadPos.set(CURVE[k - 1], o);
      leadPos.set(CURVE[k], o + 3);
    }
  }

  /** Lead slot `to` takes dog `from`'s colour. */
  function copyLeadColour(from: number, to: number): void {
    const span = (LEAD_POINTS - 1) * 2 * 3;
    leadColour.setHex(DOG_COLLARS[dogs[from].dog.collar]).multiplyScalar(0.8);
    for (let k = 0; k < span; k += 3) {
      leadCol[to * span + k] = leadColour.r;
      leadCol[to * span + k + 1] = leadColour.g;
      leadCol[to * span + k + 2] = leadColour.b;
    }
  }

  return {
    group,
    update,
    dispose() {
      for (const slot of slots.values()) {
        slot.mesh.geometry.dispose();
        slot.mesh.dispose();
      }
      slots.clear();
      material.dispose();
      leadGeo.dispose();
      (leads.material as THREE.Material).dispose();
      for (const mesh of [piles, patches]) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
        mesh.dispose();
      }
      steamGeo.dispose();
      (steam.material as THREE.Material).dispose();
    },
  };
}
