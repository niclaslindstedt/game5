// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SNOW GUNS AS DRAWN — the guns `snow-guns.ts` stands along a ski
// area's runs in a thin season, what they throw and what they leave:
//
//   * THE FAN GUN: a short drum painted (mostly) the bright yellow they
//     are sold in, a black band round its tail, the fan's grille behind
//     and the dark throat in front, the ring of nozzles round its mouth;
//     carried in a yoke on a turntable that SWEEPS it side to side about
//     its aim while it runs; on a two-wheeled carriage with its drawbar on
//     the snow, or up on a galvanised column wrapped at its foot in a red
//     safety pad. A hydrant pit beside it, its lid on the snow, its marker
//     pole, and the hose from it.
//   * THE LANCE: a grey tube leaned over the run, its nozzle head at the
//     top under a red band, hinged at a block on the snow and padded at
//     its foot.
//   * WHAT THEY THROW: `snow-gun-plume.ts`'s cones, while they run.
//   * WHAT THEY LEAVE: the WHALE under each running gun — the engine's own
//     mound (`whaleOf`, `whaleShare`), laid on the ground where the cone
//     lands, so the snow a skier ploughs into is the snow he sees.
//
// Every part is one instanced draw for the whole ski area, built in code
// in the woods' chunky low-poly look — and drawn only NEAR ENOUGH TO SEE
// (`instance-reach.ts`): the small parts (the nozzle ring, the grille, the
// wheels, the pit, the hose) within `DETAIL` m of the lens, the gun's
// body (the drum and its yoke, the carriage, the column, the lance) within
// `WHOLE` m, past which a gun is a speck. A gun stands where the engine
// stood it and a skier meets it there (`posts.ts`).

import * as THREE from "three";
import {
  SNOW_GUN,
  standingGuns,
  whaleOf,
  whaleShare,
  type GameState,
  type Level,
  type SnowGun,
  type Wind,
} from "@engine";

import { InstanceReach } from "./instance-reach.ts";
import { hazeMaterial, PAST_THE_WALL, type HazeUniforms } from "./haze.ts";
import type { SkyLook } from "./sky.ts";
import { createPlumes, type Plumes } from "./snow-gun-plume.ts";
import { LOOSE } from "./trail-stamp.ts";

const F = SNOW_GUN.fan;
/** How far off a gun's small parts are drawn, and its body, m. */
export const GUN_REACH = { DETAIL: 220, WHOLE: 900 } as const;
const L = SNOW_GUN.lance;

/** The fan gun's parts in the drum's frame, m: the turntable this far
 * under the drum's middle, the yoke's arms, the carriage (its wheels, the
 * axle's height, the frame and the drawbar), the column's girth and its
 * pad, the hydrant pit and its marker. */
const PART = {
  turntable: { below: 0.8, radius: 0.36, tall: 0.14 },
  arm: { section: 0.09, depth: 0.16 },
  wheel: { radius: 0.38, width: 0.2, track: 0.82 },
  frame: { long: 1.7, wide: 0.5, tall: 0.12 },
  bar: { long: 1.6, section: 0.08 },
  column: { foot: 0.16, head: 0.13, sunk: 0.4 },
  pad: { radius: 0.34, tall: 1.9 },
  pit: { wide: 0.9, tall: 0.14, back: 1.6 },
  marker: { radius: 0.025, tall: 2.2, top: 0.45 },
} as const;

/** The paint a gun's drum is sold in, and the share of guns in each. */
const PAINT: readonly [number, number][] = [
  [0xf2b705, 0.7],
  [0xe8641b, 0.15],
  [0xe9edf0, 0.15],
];

export type SnowGuns = {
  group: THREE.Group;
  /** The guns, for the labs. */
  guns: readonly SnowGun[];
  /** One frame: whether they run (the run's own machine snow), the drums'
   * sweep, the plumes and the whales. */
  update(state: GameState, look: SkyLook, wind: Wind, eye: THREE.Vector3, pixels: number): void;
  dispose(): void;
};

/** A smooth 0..1 hash of a gun's place. */
function hashAt(x: number, z: number, salt: number): number {
  const s = Math.sin(x * 12.9898 + z * 78.233 + salt * 37.719) * 43758.5453;
  return s - Math.floor(s);
}

function paintOf(g: SnowGun): number {
  let u = hashAt(g.x, g.z, 3);
  for (const [c, share] of PAINT) {
    if (u < share) return c;
    u -= share;
  }
  return PAINT[0][0];
}

/** Where a gun's drum points at `t`: its aim swept about it. */
export function drumYaw(g: SnowGun, index: number, t: number, running: boolean): number {
  if (g.mount === "lance" || !running) return g.aim;
  const phase = (index * 2.399963) % (Math.PI * 2);
  return g.aim + F.sweep * Math.sin((2 * Math.PI * t) / F.period + phase);
}

/** THE WHALES' mesh: a mound under each gun, laid on the ground, its rim
 * sunk a little into it. */
function whaleGeometry(level: Level, guns: readonly SnowGun[]): THREE.BufferGeometry {
  const NA = 16;
  const NB = 10;
  const pos: number[] = [];
  const idx: number[] = [];
  for (const g of guns) {
    const w = whaleOf(g);
    const base = pos.length / 3;
    for (let i = 0; i <= NA; i++) {
      for (let j = 0; j <= NB; j++) {
        const u = (i / NA) * 2 - 1;
        const v = (j / NB) * 2 - 1;
        const x = w.x + w.ux * u * w.a + w.uz * v * w.b;
        const z = w.z + w.uz * u * w.a - w.ux * v * w.b;
        const share = whaleShare(w, x, z);
        // Lumpy as machine snow lies, never above its crest.
        const lump =
          0.8 +
          0.12 * Math.sin(x * 0.9 + z * 0.4) * Math.sin(z * 1.1 - x * 0.3) +
          0.08 * Math.sin(x * 2.3 + z * 1.7);
        // On the drawn snow: the loose cover stands over the engine's ground.
        const floor = level.groundAt(x, z) + LOOSE * (1 - level.packedAt(x, z));
        pos.push(x, floor - 0.06 + (w.h + 0.08) * share * lump, z);
      }
    }
    for (let i = 0; i < NA; i++) {
      for (let j = 0; j < NB; j++) {
        const a = base + i * (NB + 1) + j;
        const b = a + NB + 1;
        idx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function createSnowGuns(level: Level, haze: HazeUniforms): SnowGuns | null {
  const guns = standingGuns(level);
  if (guns.length === 0) return null;
  const group = new THREE.Group();
  group.name = "snow-guns";
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  const std = (
    p: THREE.MeshStandardMaterialParameters,
    name: string,
  ): THREE.MeshStandardMaterial => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), haze, name, PAST_THE_WALL);
    mats.push(m);
    return m;
  };
  const paint = std({ color: 0xffffff, roughness: 0.42, metalness: 0.15 }, "gun-paint");
  const steel = std({ color: 0x9aa2a9, roughness: 0.45, metalness: 0.6 }, "gun-steel");
  const dark = std({ color: 0x24282c, roughness: 0.6, metalness: 0.3 }, "gun-dark");
  const rubber = std({ color: 0x141516, roughness: 0.9 }, "gun-rubber");
  const alloy = std({ color: 0xc3c9ce, roughness: 0.35, metalness: 0.7 }, "gun-alloy");
  const pad = std({ color: 0xc8322a, roughness: 0.75 }, "gun-pad");
  const marker = std({ color: 0xff6a13, roughness: 0.6 }, "gun-marker");
  const snow = std({ color: 0xf4f7fa, emissive: 0x2a3038, roughness: 0.92 }, "gun-whale");

  const fans = guns.filter((g) => g.mount !== "lance");
  const lances = guns.filter((g) => g.mount === "lance");
  const carriages = fans.filter((g) => g.mount === "carriage");
  const towers = fans.filter((g) => g.mount === "tower");
  const index = new Map(guns.map((g, i) => [g, i]));

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, n: number): THREE.InstancedMesh => {
    geos.push(geo);
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, n));
    mesh.count = n;
    mesh.castShadow = true;
    meshes.push(mesh);
    group.add(mesh);
    return mesh;
  };
  // THE DRUM, along +z in its own frame (the outlet forward).
  const along = (g: THREE.BufferGeometry): THREE.BufferGeometry => g.rotateX(Math.PI / 2);
  const R = F.radius;
  const drum = add(
    along(new THREE.CylinderGeometry(R * 1.06, R, F.length, 18, 1, true)),
    paint,
    fans.length,
  );
  (drum.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  const band = add(
    along(new THREE.CylinderGeometry(R * 1.015, R * 1.015, 0.2, 18, 1, true)).translate(
      0,
      0,
      -F.length / 2 + 0.28,
    ),
    rubber,
    fans.length,
  );
  const ring = add(
    new THREE.TorusGeometry(R * 1.1, 0.05, 6, 24).translate(0, 0, F.length / 2),
    steel,
    fans.length,
  );
  const throat = add(
    new THREE.CircleGeometry(R * 0.98, 18).translate(0, 0, F.length / 2 - 0.35),
    dark,
    fans.length,
  );
  const grille = add(
    new THREE.CircleGeometry(R, 18).rotateY(Math.PI).translate(0, 0, -F.length / 2),
    dark,
    fans.length,
  );
  const motor = add(
    along(new THREE.CylinderGeometry(0.26, 0.3, 0.38, 10)).translate(0, 0, -F.length / 2 - 0.17),
    dark,
    fans.length,
  );
  // THE YOKE and THE TURNTABLE, turned with the drum but never tipped.
  const T = PART.turntable;
  const yokeGeo = new THREE.BoxGeometry(PART.arm.section, T.below, PART.arm.depth).translate(
    0,
    -T.below / 2,
    0,
  );
  const armL = add(yokeGeo.clone().translate(R + 0.1, 0, 0), steel, fans.length);
  const armR = add(yokeGeo.translate(-R - 0.1, 0, 0), steel, fans.length);
  const table = add(
    new THREE.CylinderGeometry(T.radius, T.radius * 1.1, T.tall, 14).translate(0, -T.below, 0),
    dark,
    fans.length,
  );
  const crossbar = add(
    new THREE.BoxGeometry(2 * R + 0.29, PART.arm.section, PART.arm.depth).translate(
      0,
      -T.below + 0.08,
      0,
    ),
    steel,
    fans.length,
  );
  // THE CARRIAGE: a frame on two wheels, a pedestal up to the turntable,
  // the drawbar down to the snow.
  const W = PART.wheel;
  const FR = PART.frame;
  const lift = F.nozzle.carriage - T.below;
  const frameGeo = new THREE.BoxGeometry(FR.wide, FR.tall, FR.long).translate(
    0,
    W.radius + 0.05,
    0,
  );
  const frame = add(frameGeo, steel, carriages.length);
  const pedestal = add(
    new THREE.BoxGeometry(0.34, lift - W.radius, 0.42).translate(0, (lift + W.radius) / 2, 0),
    paint,
    carriages.length,
  );
  const wheelGeo = new THREE.CylinderGeometry(W.radius, W.radius, W.width, 14).rotateZ(Math.PI / 2);
  const wheelL = add(wheelGeo.clone().translate(W.track, W.radius, 0), rubber, carriages.length);
  const wheelR = add(wheelGeo.translate(-W.track, W.radius, 0), rubber, carriages.length);
  const axle = add(
    new THREE.CylinderGeometry(0.05, 0.05, 2 * W.track, 6)
      .rotateZ(Math.PI / 2)
      .translate(0, W.radius, 0),
    dark,
    carriages.length,
  );
  const barTilt = Math.atan2(W.radius, PART.bar.long);
  const bar = add(
    new THREE.BoxGeometry(PART.bar.section, PART.bar.section, PART.bar.long)
      .translate(0, 0, PART.bar.long / 2)
      .rotateX(barTilt)
      .translate(0, W.radius + 0.05, FR.long / 2 - 0.1),
    steel,
    carriages.length,
  );
  // THE COLUMN, its pad.
  const C = PART.column;
  const columnTall = F.nozzle.tower - T.below + C.sunk;
  const column = add(
    new THREE.CylinderGeometry(C.head, C.foot, columnTall, 10).translate(
      0,
      columnTall / 2 - C.sunk,
      0,
    ),
    steel,
    towers.length,
  );
  const towerPad = add(
    new THREE.CylinderGeometry(PART.pad.radius, PART.pad.radius, PART.pad.tall, 12).translate(
      0,
      PART.pad.tall / 2 - 0.1,
      0,
    ),
    pad,
    towers.length,
  );
  // THE LANCE, along +y in its own frame, leaned toward its aim.
  const tube = add(
    new THREE.CylinderGeometry(L.radius * 0.8, L.radius, L.length, 8).translate(0, L.length / 2, 0),
    alloy,
    lances.length,
  );
  const head = add(
    new THREE.CylinderGeometry(0.1, 0.085, 0.42, 10).translate(0, L.length + 0.12, 0),
    dark,
    lances.length,
  );
  const lanceBand = add(
    new THREE.CylinderGeometry(L.radius * 1.35, L.radius * 1.35, 0.5, 8).translate(
      0,
      L.length - 1.1,
      0,
    ),
    pad,
    lances.length,
  );
  const lancePad = add(
    new THREE.CylinderGeometry(0.2, 0.2, 1.5, 10).translate(0, 0.85, 0),
    pad,
    lances.length,
  );
  const hinge = add(
    new THREE.BoxGeometry(0.34, 0.3, 0.34).translate(0, 0.05, 0),
    dark,
    lances.length,
  );
  // THE HYDRANT PIT and its marker, behind every gun.
  const P = PART.pit;
  const pit = add(new THREE.BoxGeometry(P.wide, P.tall, P.wide), dark, guns.length);
  const M = PART.marker;
  const pole = add(
    new THREE.CylinderGeometry(M.radius, M.radius, M.tall, 5).translate(0, M.tall / 2, 0),
    rubber,
    guns.length,
  );
  const poleTop = add(
    new THREE.CylinderGeometry(M.radius * 1.4, M.radius * 1.4, M.top, 5).translate(
      0,
      M.tall - M.top / 2,
      0,
    ),
    marker,
    guns.length,
  );
  const hose = add(
    new THREE.CylinderGeometry(0.045, 0.045, 1, 6).rotateX(Math.PI / 2).translate(0, 0, 0.5),
    rubber,
    fans.length,
  );

  // Instances that never move: the carriages, columns, lances, pits.
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const at = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const scale = new THREE.Vector3();
  const colour = new THREE.Color();
  const set = (mesh: THREE.InstancedMesh, i: number, s = one): void => {
    mesh.setMatrixAt(i, m4.compose(at, q, s));
  };
  carriages.forEach((g, i) => {
    q.setFromEuler(e.set(0, g.aim + Math.PI, 0, "YXZ"));
    at.set(g.x, g.y, g.z);
    for (const mesh of [frame, pedestal, wheelL, wheelR, axle, bar]) set(mesh, i);
    pedestal.setColorAt(i, colour.set(paintOf(g)));
  });
  towers.forEach((g, i) => {
    q.identity();
    at.set(g.x, g.y, g.z);
    set(column, i);
    set(towerPad, i);
  });
  lances.forEach((g, i) => {
    q.setFromEuler(e.set(L.lean, g.aim, 0, "YXZ"));
    at.set(g.x, g.y, g.z);
    for (const mesh of [tube, head, lanceBand, lancePad]) set(mesh, i);
    q.setFromEuler(e.set(0, g.aim, 0, "YXZ"));
    set(hinge, i);
  });
  guns.forEach((g, i) => {
    // Behind the gun, away from the run.
    const bx = -Math.sin(g.aim) * P.back;
    const bz = -Math.cos(g.aim) * P.back;
    q.setFromEuler(e.set(0, g.aim, 0, "YXZ"));
    at.set(g.x + bx, level.groundAt(g.x + bx, g.z + bz) - P.tall / 3, g.z + bz);
    set(pit, i);
    const mx = g.x + bx * 1.35 + Math.cos(g.aim) * 0.6;
    const mz = g.z + bz * 1.35 - Math.sin(g.aim) * 0.6;
    at.set(mx, level.groundAt(mx, mz) - 0.2, mz);
    q.identity();
    set(pole, i);
    set(poleTop, i);
  });
  fans.forEach((g, i) => {
    // The hose from the pit to the foot of the gun, lying on the snow.
    const bx = -Math.sin(g.aim) * P.back;
    const bz = -Math.cos(g.aim) * P.back;
    at.set(g.x + bx, Math.max(g.y, level.groundAt(g.x + bx, g.z + bz)) + 0.05, g.z + bz);
    q.setFromEuler(e.set(0, g.aim, 0, "YXZ"));
    set(hose, i, scale.set(1, 1, P.back));
    drum.setColorAt(i, colour.set(paintOf(g)));
  });

  // The drum, its yoke and turntable — turned to the sweep each frame;
  // once the reaches keep them, placed through those.
  const reaches: InstanceReach[] = [];
  const drawn = new Float32Array(fans.length).fill(Number.NaN);
  const pivot = new THREE.Vector3();
  const place = (mesh: THREE.InstancedMesh, i: number): void => {
    if (reaches.length === 0) set(mesh, i);
    else {
      m4.compose(at, q, one);
      for (const r of reaches) r.place(mesh, i, m4);
    }
  };
  const placeDrums = (t: number, running: boolean): void => {
    let moved = false;
    fans.forEach((g, i) => {
      const yaw = drumYaw(g, index.get(g) ?? 0, t, running);
      if (yaw === drawn[i]) return;
      drawn[i] = yaw;
      moved = true;
      pivot.set(g.x, g.y + F.nozzle[g.mount === "tower" ? "tower" : "carriage"], g.z);
      at.copy(pivot);
      q.setFromEuler(e.set(-F.tilt, yaw, 0, "YXZ"));
      for (const mesh of [drum, band, ring, throat, grille, motor]) place(mesh, i);
      q.setFromEuler(e.set(0, yaw, 0, "YXZ"));
      for (const mesh of [armL, armR, table, crossbar]) place(mesh, i);
    });
    if (moved && reaches.length === 0) {
      for (const mesh of [drum, band, ring, throat, grille, motor, armL, armR, table, crossbar]) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  };
  placeDrums(0, false);
  for (const mesh of meshes) {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }
  // THE REACHES: each set of parts kept, and drawn out to its distance.
  const placesOf = (list: readonly SnowGun[]): Float32Array =>
    Float32Array.from(list.flatMap((g) => [g.x, g.y, g.z]));
  const { DETAIL, WHOLE } = GUN_REACH;
  const fanAt = placesOf(fans);
  const carriageAt = placesOf(carriages);
  const towerAt = placesOf(towers);
  const lanceAt = placesOf(lances);
  reaches.push(
    new InstanceReach([band, ring, throat, grille, motor, table, crossbar, hose], fanAt, DETAIL),
    new InstanceReach([drum, armL, armR], fanAt, WHOLE),
    new InstanceReach([wheelL, wheelR, axle, bar], carriageAt, DETAIL),
    new InstanceReach([frame, pedestal], carriageAt, WHOLE),
    new InstanceReach([towerPad], towerAt, DETAIL),
    new InstanceReach([column], towerAt, WHOLE),
    new InstanceReach([head, lanceBand, lancePad, hinge], lanceAt, DETAIL),
    new InstanceReach([tube], lanceAt, WHOLE),
    new InstanceReach([pit, pole, poleTop], placesOf(guns), DETAIL),
  );

  // THE WHALES and THE PLUMES, while the guns run.
  const whaleGeo = whaleGeometry(level, guns);
  geos.push(whaleGeo);
  const whales = new THREE.Mesh(whaleGeo, snow);
  whales.receiveShadow = true;
  whales.visible = false;
  group.add(whales);
  const plumes: Plumes = createPlumes(level, guns, haze);
  plumes.mesh.visible = false;
  group.add(plumes.mesh);

  return {
    group,
    guns,
    update(state, look, wind, eye, pixels) {
      const running = state.machineSnow !== undefined;
      whales.visible = running;
      plumes.mesh.visible = running;
      placeDrums(state.t, running);
      for (const r of reaches) r.update(eye);
      if (running) plumes.update(state.t, look, wind, eye, pixels);
    },
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const mesh of meshes) mesh.dispose();
      plumes.dispose();
    },
  };
}
