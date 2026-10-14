// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THE PEOPLE AT THE FIRES HOLD, DRAWN — a griller's long stick with a
// sausage browning at its tip, turned slowly over the embers, and a sausage
// in bread in an eater's hand (`civilian-fires.ts` says who and where).
// Two instanced meshes, one a kind, an instance a person: a matrix each,
// set every frame from his right hand (`heldHand`, the targets' hands
// blended at his weights, so the stick stays in his fist through every
// move) — the stick laid from it to its tip over the hearth (`stickTip`),
// spun about its own length; the bread crosswise in his fist. And the
// skis and poles stuck upright in the snow by the fires, built into the
// civilians' one mesh of things on the snow (`stuckSkis`).
//
// Presentation, end to end: it reads the plan, his pose and the clock.

import * as THREE from "three";

import { heldHand, stickTip, FIRESIDE } from "./civilian-fires.ts";
import type { Civilian, CivilianPlan, CivilianPose } from "./civilian-plan.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import { shadeDepth } from "./terrain-shade.ts";
import { Shape } from "./tree-mesh.ts";

type V3 = [number, number, number];

const COLOUR = {
  stick: new THREE.Color(0xb59a74),
  bark: new THREE.Color(0x6b4e33),
  sausage: new THREE.Color(0xa1462a),
  browned: new THREE.Color(0x6a2c17),
  char: new THREE.Color(0x3a1a0e),
  bun: new THREE.Color(0xd9a35f),
  crust: new THREE.Color(0xb27235),
  mustard: new THREE.Color(0xe8c22a),
};

/** A SAUSAGE along +z from `z0` to `z1` about (`x`, `y`): a round link, its
 * ends rounded, browned and charred in stripes round it — the grill's marks
 * turned to the fire one side after another. */
function sausage(s: Shape, x: number, y: number, z0: number, z1: number, r: number): void {
  const sides = 8;
  const profile = [0.35, 0.85, 1, 1, 1, 0.85, 0.35];
  const rings = profile.map((k, i) => {
    const z = z0 + ((z1 - z0) * i) / (profile.length - 1);
    return Array.from({ length: sides }, (_, j) => {
      const a = (j / sides) * Math.PI * 2;
      return [x + Math.cos(a) * r * k, y + Math.sin(a) * r * k, z] as V3;
    });
  });
  for (let i = 0; i + 1 < rings.length; i++) {
    for (let j = 0; j < sides; j++) {
      const j1 = (j + 1) % sides;
      const a = (j / sides) * Math.PI * 2;
      const tone = j % 4 === 0 ? COLOUR.char : j % 2 === 0 ? COLOUR.browned : COLOUR.sausage;
      const n: V3 = [Math.cos(a), Math.sin(a), 0];
      s.quad(rings[i][j], rings[i + 1][j], rings[i + 1][j1], rings[i][j1], tone, n);
    }
  }
}

/** THE STICK: a peeled stick from a hand's breadth behind the fist (at
 * the origin) along +z to its tip `FIRESIDE.stick` m out, the sausage on
 * its last hand's breadth. */
export function buildStick(): THREE.BufferGeometry {
  const s = new Shape(0, { stems: false });
  const L = FIRESIDE.stick;
  s.tube([0, 0, -0.12], [0, 0, L], 0.011, 0.006, 5, COLOUR.bark, COLOUR.stick);
  sausage(s, 0, 0, L - 0.19, L - 0.025, 0.017);
  return s.geometry();
}

/** A SAUSAGE IN BREAD across the fist: a split roll along x, the sausage
 * laid in it and out past both ends, a line of mustard down it. */
export function buildHotdog(): THREE.BufferGeometry {
  const s = new Shape(0, { stems: false });
  // The roll: two halves either side of the split, along x.
  const sides = 6;
  for (const side of [-1, 1]) {
    const ring = (x: number, k: number): V3[] =>
      Array.from({ length: sides + 1 }, (_, j) => {
        const a = (j / sides) * Math.PI;
        return [
          x,
          0.012 + Math.sin(a) * 0.022 * k - 0.012,
          side * (0.008 + (1 - Math.cos(a)) * 0.014 * k),
        ] as V3;
      });
    const xs = [-0.085, -0.07, 0.07, 0.085];
    const ks = [0.55, 1, 1, 0.55];
    for (let i = 0; i + 1 < xs.length; i++) {
      const a = ring(xs[i], ks[i]);
      const b = ring(xs[i + 1], ks[i + 1]);
      for (let j = 0; j < sides; j++) {
        const tone = j === 0 || j === sides - 1 ? COLOUR.bun : COLOUR.crust;
        const ang = ((j + 0.5) / sides) * Math.PI;
        const n: V3 = [0, Math.sin(ang), side * (1 - Math.cos(ang))];
        if (side > 0) s.quad(a[j], b[j], b[j + 1], a[j + 1], tone, n);
        else s.quad(a[j], a[j + 1], b[j + 1], b[j], tone, n);
      }
    }
  }
  // The sausage along x, laid in the split.
  const g = new Shape(0, { stems: false });
  sausage(g, 0, 0.012, -0.1, 0.1, 0.014);
  // Turned from +z onto +x.
  for (let i = 0; i < g.pos.length; i += 3) {
    const z = g.pos[i + 2];
    const x = g.pos[i];
    s.push([z, g.pos[i + 1], -x], new THREE.Color(g.col[i], g.col[i + 1], g.col[i + 2]), [
      g.nrm[i + 2],
      g.nrm[i + 1],
      -g.nrm[i],
    ]);
  }
  s.tube([-0.075, 0.029, 0], [0.075, 0.029, 0], 0.005, 0.005, 4, COLOUR.mustard);
  return s.geometry();
}

/** A PAIR OF SKIS AND ITS POLES stuck upright in the snow at `o`, facing
 * `heading`: the tails dug in, the two skis leant together at the tips,
 * the poles planted beside them — painted the `k`th of a few topsheets. */
export function stuckSkis(s: Shape, o: V3, heading: number, k: number): void {
  const paints = [0xd23a2a, 0x1f5fa8, 0xf0f0ea, 0x2a2d33, 0xe0a22b, 0x2f8f4e];
  const top = new THREE.Color(paints[k % paints.length]);
  const base = new THREE.Color(0x1c1e22);
  const edge = new THREE.Color(0x9aa0a8);
  const binding = new THREE.Color(0x3a3d44);
  const pole = new THREE.Color(0x8b939c);
  const grip = new THREE.Color(0x1b1d21);
  const c = Math.cos(heading);
  const sn = Math.sin(heading);
  const at = (x: number, y: number, z: number): V3 => [
    o[0] + x * c + z * sn,
    o[1] + y,
    o[2] - x * sn + z * c,
  ];
  for (const side of [-1, 1]) {
    // From the tail in the snow up to the tip, leant in to its mate.
    const foot = at(side * 0.09, -0.25, 0);
    const head = at(side * 0.015, 1.45, 0.06);
    const w = 0.045;
    const t = 0.012;
    const up: V3 = [head[0] - foot[0], head[1] - foot[1], head[2] - foot[2]];
    const ul = Math.hypot(...up);
    const u: V3 = [up[0] / ul, up[1] / ul, up[2] / ul];
    const across: V3 = [c, 0, -sn];
    const out: V3 = [sn, 0, c];
    const p = (along: number, x: number, z: number): V3 => [
      foot[0] + u[0] * along + across[0] * x + out[0] * z,
      foot[1] + u[1] * along + across[1] * x + out[1] * z,
      foot[2] + u[2] * along + across[2] * x + out[2] * z,
    ];
    const L = ul;
    // The topsheet faces out, the base in; the edges either side.
    s.quad(p(0, -w, t), p(0, w, t), p(L, w, t), p(L, -w, t), top, out);
    s.quad(p(0, w, -t), p(0, -w, -t), p(L, -w, -t), p(L, w, -t), base, [-out[0], 0, -out[2]]);
    for (const e of [-1, 1]) {
      s.quad(p(0, e * w, -t), p(0, e * w, t), p(L, e * w, t), p(L, e * w, -t), edge, [
        across[0] * e,
        0,
        across[2] * e,
      ]);
    }
    // The tip turned up and out, and the binding on the topsheet.
    const tip: V3 = [
      p(L, 0, 0)[0] + out[0] * 0.07,
      p(L, 0, 0)[1] + 0.12,
      p(L, 0, 0)[2] + out[2] * 0.07,
    ];
    s.tri(p(L, -w, t), p(L, w, t), tip, top);
    s.tri(p(L, w, -t), p(L, -w, -t), tip, base);
    s.tube(p(0.55, 0, t), p(0.95, 0, t), 0.03, 0.03, 4, binding);
    // A pole planted beside, its basket just over the snow.
    const pf = at(side * 0.32, -0.15, -0.12);
    const ph = at(side * 0.4, 1.12, -0.18);
    s.tube(pf, ph, 0.009, 0.009, 4, pole);
    s.tube(ph, [ph[0], ph[1] + 0.14, ph[2]], 0.018, 0.016, 5, grip);
    const b: V3 = [
      pf[0] + (ph[0] - pf[0]) * 0.13,
      pf[1] + (ph[1] - pf[1]) * 0.13,
      pf[2] + (ph[2] - pf[2]) * 0.13,
    ];
    s.tube(b, [b[0], b[1] + 0.012, b[2]], 0.05, 0.05, 6, grip);
  }
}

/** Whether a civilian's routine has him grilling, and eating. */
const does = (c: Civilian, act: string): boolean => c.routine.some((h) => h.act === act);

export type FireHelds = {
  group: THREE.Group;
  /** Before a frame's people. */
  begin(): void;
  /** One person at `pose`, drawn at weights `dials` — nothing unless he is
   * at a fire grilling or eating. */
  add(c: Civilian, i: number, pose: CivilianPose, dials: ArrayLike<number>, t: number): void;
  /** After them: the meshes' counts. */
  end(): void;
  dispose(): void;
};

/** THE STICKS AND THE BREAD of `plan`'s fireside people — null on a map
 * with none. */
export function createFireHelds(plan: CivilianPlan, haze: HazeUniforms): FireHelds | null {
  const grillers = plan.people.filter((c) => c.fire && does(c, "grill")).length;
  const eaters = plan.people.filter((c) => c.fire && does(c, "eat")).length;
  if (grillers + eaters === 0) return null;
  const group = new THREE.Group();
  group.name = "fire-helds";
  const material = hazeMaterial(
    new THREE.MeshLambertMaterial({ vertexColors: true }),
    haze,
    "fire-helds",
  );
  const mesh = (geometry: THREE.BufferGeometry, n: number, name: string) => {
    const m = new THREE.InstancedMesh(geometry, material, Math.max(1, n));
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.castShadow = true;
    m.customDepthMaterial = shadeDepth(haze);
    m.frustumCulled = false;
    m.count = 0;
    m.name = name;
    group.add(m);
    return m;
  };
  const sticks = mesh(buildStick(), grillers, "fire-sticks");
  const breads = mesh(buildHotdog(), eaters, "fire-bread");
  const hand: V3 = [0, 0, 0];
  const world = { x: 0, y: 0, z: 0 };
  const tip = { x: 0, y: 0, z: 0 };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const spin = new THREE.Quaternion();
  const dir = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const yAxis = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let nSticks = 0;
  let nBread = 0;
  return {
    group,
    begin() {
      nSticks = 0;
      nBread = 0;
    },
    add(c, i, pose, dials, t) {
      const f = c.fire;
      if (!f || (pose.activity !== "grill" && pose.activity !== "eat")) return;
      heldHand(c.body, dials, hand);
      const ch = Math.cos(pose.heading);
      const sh = Math.sin(pose.heading);
      world.x = pose.x + hand[0] * ch + hand[2] * sh;
      world.y = pose.y + hand[1];
      world.z = pose.z - hand[0] * sh + hand[2] * ch;
      if (pose.activity === "grill") {
        if (nSticks >= grillers) return;
        stickTip(world, f.kind, f.x, f.y, f.z, tip);
        dir.set(tip.x - world.x, tip.y - world.y, tip.z - world.z).normalize();
        q.setFromUnitVectors(zAxis, dir);
        // Turned slowly to the fire, a little back and forth, his own way.
        spin.setFromAxisAngle(zAxis, 0.35 * t + 1.1 * Math.sin(0.5 * t + i) + i);
        q.multiply(spin);
        m.compose(pos.set(world.x, world.y, world.z), q, one);
        sticks.setMatrixAt(nSticks++, m);
      } else if (pose.activity === "eat") {
        if (nBread >= eaters) return;
        q.setFromAxisAngle(yAxis, pose.heading);
        // A hand's breadth out of the fist, toward his mouth.
        m.compose(pos.set(world.x + sh * 0.03, world.y + 0.02, world.z + ch * 0.03), q, one);
        breads.setMatrixAt(nBread++, m);
      }
    },
    end() {
      sticks.count = nSticks;
      sticks.visible = nSticks > 0;
      if (nSticks > 0) sticks.instanceMatrix.needsUpdate = true;
      breads.count = nBread;
      breads.visible = nBread > 0;
      if (nBread > 0) breads.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      sticks.geometry.dispose();
      breads.geometry.dispose();
      sticks.dispose();
      breads.dispose();
      material.dispose();
    },
  };
}
