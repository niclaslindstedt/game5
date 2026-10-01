// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFTS AS DRAWN — every lift of the resort (R26), off its plan
// (`lift-plan.ts`: where each tower stands, how high, and where the rope
// hangs):
//
//   * THE TOWERS: a tapered steel column on the snow under each support,
//     and at its head a crossarm with a sheave train at each end the rope
//     rides over — one arm to one side for a drag's single rope.
//   * THE STATIONS: at each end a house behind the bullwheel, the wheel
//     itself flat at the rope's height on a column of its own, and the
//     rope turned round it.
//   * THE ROPE: the up and the down rope, straight between two supports
//     save for their sag, drawn as LINES — a rope is a few centimetres
//     thick, a pixel wide at any distance a skier sees it from, and a
//     tube that thin would flicker in and out of the picture.
//   * WHAT RIDES IT: a gondola's cabins, a chair's four-seat chairs (the
//     up side facing up the line, the down side facing down it), a drag's
//     T-bars on cords reaching down to a skier's hips over the snow under
//     each. Hung where they stand — a lift that turned would be a second
//     clock the replay and the ghost would have to agree on.
//
//   * THE WIND TUNNELS along the valley floor, the horizontal lift, are
//     `wind-tunnels.ts`'s, held in this group and moved by `update`.
//
// THE DRAWS ARE FEW: every part of a kind is one INSTANCE of one mesh for
// the whole resort, coloured per vertex where it is more than one paint,
// and the ropes of every lift are one set of lines — a dozen draws for a
// mountain's lifts, however many towers.

import * as THREE from "three";
import type { Level } from "@engine";

import { PAST_THE_WALL, hazeMaterial, type HazeUniforms } from "./haze.ts";
import { planLift, ropeAt, type LiftKind, type LiftPlan } from "./lift-plan.ts";
import { createWindTunnels } from "./wind-tunnels.ts";

/** A tower's column across its foot, m, and how far it is sunk into the
 * snow so a slope never shows its base. */
const COLUMN: Readonly<Record<LiftKind, number>> = { gondola: 1.3, chair: 0.95, drag: 0.42 };
const SINK = 1.2;

/** The drag's one rope stands this far right of its towers, m — the arm's
 * reach. */
const DRAG_ARM = 1.2;

/** How far from a station's wheel the first carrier hangs, m. */
const CLEAR_OF_WHEEL = 7;

/** A drag's bar rides this high over the snow, m — a skier's hips. */
const TEE = 1.0;

/** The paints, sRGB: the towers' galvanised steel, the dark steel of the
 * grips and the sheaves, a gondola cabin's body and its glass, a chair's
 * seat, a station's walls and roof. */
const PAINT = {
  steel: 0x9aa2a9,
  dark: 0x2a2e33,
  cabin: 0xb5262c,
  glass: 0x2b3a4a,
  seat: 0x1f4f8f,
  walls: 0x8a7a68,
  timber: 0x6b4a2e,
  roof: 0x2f3338,
  rope: 0x15181b,
};

export type Lifts = {
  group: THREE.Group;
  /** Move what moves — the wind tunnels' fans, streaks and lights — to
   * the engine's clock. */
  update(t: number): void;
  /** The SPRAY row's share (`SPRAY_SHARE`): the tunnels' blown snow. */
  setBudget(share: number): void;
  dispose(): void;
};

type Part = { geo: THREE.BufferGeometry; colour: number };

/** A box `w × h × d` centred at (x, y, z), in one paint. */
function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  colour: number,
): Part {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(x, y, z);
  return { geo, colour };
}

/** Several parts as ONE geometry, each in its own paint as a vertex colour
 * — one draw for a cabin, not one per pane. */
function merged(parts: Part[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (const { geo, colour } of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    c.set(colour);
    const p = g.getAttribute("position");
    const n = g.getAttribute("normal");
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
      col.push(c.r, c.g, c.b);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return out;
}

/** A GONDOLA CABIN from its grip on the rope down: the grip, the hanger
 * arm, the roof, the glazed band and the body under it. +z is the way it
 * travels. */
function cabinGeometry(): THREE.BufferGeometry {
  return merged([
    box(0.32, 0.3, 0.9, 0, -0.1, 0, PAINT.dark),
    box(0.12, 1.9, 0.12, 0, -1.15, 0, PAINT.dark),
    box(1.95, 0.22, 2.15, 0, -2.2, 0, PAINT.cabin),
    box(1.9, 0.85, 2.1, 0, -2.75, 0, PAINT.glass),
    box(1.92, 1.05, 2.12, 0, -3.7, 0, PAINT.cabin),
  ]);
}

/** A FOUR-SEAT CHAIR from its grip down: the hanger coming down behind the
 * back, the back and the seat, the bar under it, and the restraint with
 * its footrest in front. +z is the way the rider faces. */
function chairGeometry(): THREE.BufferGeometry {
  return merged([
    box(0.26, 0.28, 0.6, 0, -0.1, 0, PAINT.dark),
    box(0.1, 0.1, 0.5, 0, -0.25, -0.22, PAINT.dark),
    box(0.1, 1.85, 0.1, 0, -1.15, -0.46, PAINT.dark),
    box(2.3, 0.08, 0.08, 0, -2.05, -0.46, PAINT.dark),
    box(2.2, 0.7, 0.09, 0, -2.08, -0.38, PAINT.seat),
    box(2.2, 0.11, 0.58, 0, -2.45, -0.08, PAINT.seat),
    box(2.3, 0.07, 0.07, 0, -2.53, -0.08, PAINT.dark),
    box(2.2, 0.05, 0.05, 0, -1.85, 0.42, PAINT.dark),
    box(0.05, 1.0, 0.05, -1.0, -2.35, 0.42, PAINT.dark),
    box(0.05, 1.0, 0.05, 1.0, -2.35, 0.42, PAINT.dark),
    box(2.0, 0.05, 0.28, 0, -2.85, 0.42, PAINT.dark),
  ]);
}

/** A tower's head, the rope's height at its origin: the crossarm under the
 * rope and a sheave train at each rope's place — for a drag, one arm out
 * to its one rope. */
function headGeometry(kind: LiftKind, gauge: number): THREE.BufferGeometry {
  if (kind === "drag") {
    return merged([
      box(DRAG_ARM + 0.3, 0.18, 0.18, DRAG_ARM / 2, -0.42, 0, PAINT.steel),
      box(0.2, 0.24, 1.4, DRAG_ARM, -0.16, 0, PAINT.dark),
    ]);
  }
  const train = kind === "gondola" ? 3.2 : 2.4;
  return merged([
    box(gauge + 1.4, 0.42, 0.42, 0, -0.62, 0, PAINT.steel),
    box(0.3, 0.3, train, -gauge / 2, -0.2, 0, PAINT.dark),
    box(0.3, 0.3, train, gauge / 2, -0.2, 0, PAINT.dark),
    box(0.9, 0.5, 0.9, 0, -0.9, 0, PAINT.steel),
  ]);
}

/** The ropes' offsets right of the line, m: up and down, or a drag's one. */
function ropesOf(plan: LiftPlan): number[] {
  return plan.lift.kind === "drag" ? [DRAG_ARM] : [plan.look.gauge / 2, -plan.look.gauge / 2];
}

/** The resort's lifts — and its WIND TUNNELS along the valley floor
 * (`wind-tunnels.ts`), the horizontal lift — in one group the renderer
 * holds. `budget` is the SPRAY row's share. */
export function createLifts(level: Level, haze: HazeUniforms, budget = 1): Lifts {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  const lifts = level.resort?.lifts ?? [];
  const tunnels = createWindTunnels(level, haze, budget);
  group.add(tunnels.group);
  const dispose = () => {
    tunnels.dispose();
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
    for (const m of meshes) m.dispose();
  };
  const done: Lifts = { group, update: tunnels.update, setBudget: tunnels.setBudget, dispose };
  if (lifts.length === 0) return done;
  const plans = lifts.map((l) => planLift(level, l));
  const std = (p: THREE.MeshStandardMaterialParameters, name: string) => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), haze, name, PAST_THE_WALL);
    mats.push(m);
    return m;
  };
  const painted = std({ vertexColors: true, roughness: 0.55, metalness: 0.3 }, "lift");
  const steel = std({ color: PAINT.steel, roughness: 0.45, metalness: 0.55 }, "lift");
  const plain = std({ color: 0xffffff, roughness: 0.8 }, "lift");

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3();
  const size = new THREE.Vector3();
  const tint = new THREE.Color();
  /** An instanced mesh of `count`, filled by `fill(set)` — `set` places the
   * next instance — and added to the group if anything was set. */
  const instanced = (
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    count: number,
    fill: (
      set: (
        x: number,
        y: number,
        z: number,
        yaw: number,
        s?: THREE.Vector3,
        colour?: number,
      ) => void,
    ) => void,
    shadow = true,
  ) => {
    geos.push(geo);
    if (count === 0) return;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    let i = 0;
    fill((x, y, z, yaw, s, colour) => {
      mesh.setMatrixAt(
        i,
        m4.compose(at.set(x, y, z), q.setFromAxisAngle(up, yaw), s ?? size.set(1, 1, 1)),
      );
      if (colour !== undefined) mesh.setColorAt(i, tint.set(colour));
      i++;
    });
    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    mesh.computeBoundingSphere();
    meshes.push(mesh);
    group.add(mesh);
  };

  // THE COLUMNS: one tapered square tube for every tower and every
  // bullwheel's post, scaled to its height and its kind's girth.
  const column = new THREE.CylinderGeometry(0.5, 0.8, 1, 4, 1);
  column.rotateY(Math.PI / 4);
  column.translate(0, 0.5, 0);
  const supports = plans.reduce((n, p) => n + p.supports.length, 0);
  instanced(column, steel, supports, (set) => {
    for (const p of plans) {
      const w = COLUMN[p.lift.kind];
      for (const s of p.supports) {
        // A station's post stands under its wheel, a tower's under its
        // crossarm, both sunk into the snow.
        const top = s.rope - (s.station ? 0.4 : 0.9);
        set(s.x, s.ground - SINK, s.z, p.heading, size.set(w, top + SINK, w));
      }
    }
  });

  // THE HEADS, one mesh a kind: the crossarm and the sheave trains.
  for (const kind of ["gondola", "chair", "drag"] as const) {
    const own = plans.filter((p) => p.lift.kind === kind);
    const towers = own.reduce((n, p) => n + p.supports.length - 2, 0);
    if (towers === 0) continue;
    const head = headGeometry(kind, own[0].look.gauge);
    instanced(head, painted, towers, (set) => {
      for (const p of own) {
        for (const s of p.supports) if (!s.station) set(s.x, s.ground + s.rope, s.z, p.heading);
      }
    });
  }

  // THE STATIONS: a house behind each end of the line, its roof, and the
  // bullwheel flat at the rope's height over the end itself.
  const houseGeo = new THREE.BoxGeometry(1, 1, 1);
  houseGeo.translate(0, 0.5, 0);
  const roofGeo = new THREE.BoxGeometry(1, 1, 1);
  roofGeo.translate(0, 0.5, 0);
  const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 20);
  const ends = plans.length * 2;
  type End = {
    x: number;
    z: number;
    base: number;
    top: number;
    p: LiftPlan;
    wheelX: number;
    wheelZ: number;
    wheelY: number;
  };
  const stations: End[] = [];
  for (const p of plans) {
    const h = p.look.house;
    for (const s of [p.supports[0], p.supports[p.supports.length - 1]]) {
      // Behind the wheel: down the line from the bottom one, up it from
      // the top one.
      const away = s.u === 0 ? -1 : 1;
      const cx = s.x + p.dx * away * (h.length / 2 + 1.5);
      const cz = s.z + p.dz * away * (h.length / 2 + 1.5);
      // On a slope the house is footed on its lowest corner and stands to
      // its height over the snow at its middle.
      let lo = Infinity;
      for (const a of [-1, 1]) {
        for (const b of [-1, 1]) {
          const x = cx + p.dx * a * (h.length / 2) + p.dz * b * (h.width / 2 + p.look.gauge / 2);
          const z = cz + p.dz * a * (h.length / 2) - p.dx * b * (h.width / 2 + p.look.gauge / 2);
          lo = Math.min(lo, level.groundAt(x, z));
        }
      }
      const mid = level.groundAt(cx, cz);
      stations.push({
        x: cx,
        z: cz,
        base: lo - 0.5,
        top: mid + h.height,
        p,
        wheelX: s.x,
        wheelZ: s.z,
        wheelY: s.ground + s.rope,
      });
    }
  }
  instanced(houseGeo, plain, ends, (set) => {
    for (const e of stations) {
      const h = e.p.look.house;
      const walls = e.p.lift.kind === "gondola" ? PAINT.walls : PAINT.timber;
      set(
        e.x,
        e.base,
        e.z,
        e.p.heading,
        size.set(h.width + e.p.look.gauge, e.top - e.base, h.length),
        walls,
      );
    }
  });
  instanced(roofGeo, plain, ends, (set) => {
    for (const e of stations) {
      const h = e.p.look.house;
      set(
        e.x,
        e.top,
        e.z,
        e.p.heading,
        size.set(h.width + e.p.look.gauge + 1.2, 0.45, h.length + 1.2),
        PAINT.roof,
      );
    }
  });
  instanced(wheelGeo, plain, ends, (set) => {
    for (const e of stations) {
      const r = Math.max(0.6, e.p.look.gauge / 2 + 0.25);
      set(
        e.wheelX + (e.p.lift.kind === "drag" ? (e.p.dz * DRAG_ARM) / 2 : 0),
        e.wheelY - 0.15,
        e.wheelZ - (e.p.lift.kind === "drag" ? (e.p.dx * DRAG_ARM) / 2 : 0),
        e.p.heading,
        size.set(r, 0.35, r),
        PAINT.dark,
      );
    }
  });

  // THE ROPES, every lift's as one set of line segments: a vertex every few
  // metres down each span (the sag is a curve), and the turn round each
  // wheel straight across it.
  const rope: number[] = [];
  for (const p of plans) {
    const rx = p.dz;
    const rz = -p.dx;
    const offs = ropesOf(p);
    for (const o of offs) {
      let last: [number, number, number] | null = null;
      for (let i = 0; i + 1 < p.supports.length; i++) {
        const a = p.supports[i];
        const b = p.supports[i + 1];
        const steps = Math.max(1, Math.ceil((b.u - a.u) / 6));
        for (let k = i === 0 ? 0 : 1; k <= steps; k++) {
          const u = a.u + ((b.u - a.u) * k) / steps;
          const x = p.lift.bottom.x + p.dx * u + rx * o;
          const z = p.lift.bottom.z + p.dz * u + rz * o;
          const y = ropeAt(p, u);
          if (last) rope.push(...last, x, y, z);
          last = [x, y, z];
        }
      }
    }
    if (offs.length === 2) {
      for (const s of [p.supports[0], p.supports[p.supports.length - 1]]) {
        const y = s.ground + s.rope;
        rope.push(
          s.x + rx * offs[0],
          y,
          s.z + rz * offs[0],
          s.x + rx * offs[1],
          y,
          s.z + rz * offs[1],
        );
      }
    }
  }
  const ropeGeo = new THREE.BufferGeometry();
  ropeGeo.setAttribute("position", new THREE.Float32BufferAttribute(rope, 3));
  geos.push(ropeGeo);
  const ropeMat = hazeMaterial(
    new THREE.LineBasicMaterial({ color: PAINT.rope }),
    haze,
    "lift",
    PAST_THE_WALL,
  );
  mats.push(ropeMat);
  const ropes = new THREE.LineSegments(ropeGeo, ropeMat);
  ropes.frustumCulled = false;
  group.add(ropes);

  // WHAT RIDES THE ROPE: every `every` metres of it, clear of the wheels,
  // the down side's half a step on from the up side's.
  type Hung = { x: number; y: number; z: number; yaw: number; ground: number };
  const hung: Record<LiftKind, Hung[]> = { gondola: [], chair: [], drag: [] };
  for (const p of plans) {
    const offs = ropesOf(p);
    offs.forEach((o, side) => {
      const every = p.look.every;
      for (
        let u = CLEAR_OF_WHEEL + (side * every) / 2;
        u <= p.length - CLEAR_OF_WHEEL;
        u += every
      ) {
        const x = p.lift.bottom.x + p.dx * u + p.dz * o;
        const z = p.lift.bottom.z + p.dz * u - p.dx * o;
        hung[p.lift.kind].push({
          x,
          y: ropeAt(p, u),
          z,
          yaw: side === 0 ? p.heading : p.heading + Math.PI,
          ground: level.groundAt(x, z),
        });
      }
    });
  }
  instanced(cabinGeometry(), painted, hung.gondola.length, (set) => {
    for (const h of hung.gondola) set(h.x, h.y, h.z, h.yaw);
  });
  instanced(chairGeometry(), painted, hung.chair.length, (set) => {
    for (const h of hung.chair) set(h.x, h.y, h.z, h.yaw);
  });
  // A DRAG'S T-BARS: the spring box at the rope, the cord down from it to
  // a skier's hips over the snow under it, and the bar across.
  const springGeo = new THREE.BoxGeometry(0.14, 0.55, 0.14);
  springGeo.translate(0, -0.3, 0);
  const cordGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4, 1, true);
  cordGeo.translate(0, -0.5, 0);
  const tee = merged([
    box(0.04, 0.6, 0.04, 0, 0.3, 0, PAINT.dark),
    box(1.0, 0.06, 0.06, 0, 0, 0, PAINT.steel),
  ]);
  const drags = hung.drag;
  const cordOf = (h: Hung) => Math.max(0.3, h.y - 0.58 - (h.ground + TEE + 0.6));
  instanced(springGeo, plain, drags.length, (set) => {
    for (const h of drags) set(h.x, h.y, h.z, h.yaw, undefined, PAINT.dark);
  });
  instanced(
    cordGeo,
    plain,
    drags.length,
    (set) => {
      for (const h of drags)
        set(h.x, h.y - 0.58, h.z, h.yaw, size.set(1, cordOf(h), 1), PAINT.dark);
    },
    false,
  );
  instanced(tee, painted, drags.length, (set) => {
    for (const h of drags) set(h.x, h.y - 0.58 - cordOf(h) - 0.6, h.z, h.yaw);
  });

  return done;
}
