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
import { TUNING, type Level, type LiftRide } from "@engine";

import { PAST_THE_WALL, hazeMaterial, type HazeUniforms } from "./haze.ts";
import {
  DRAG_ARM,
  carrierAt,
  carrierCount,
  planLift,
  ropeAt,
  type LiftKind,
  type LiftPlan,
} from "@engine";
import { CHAIR_SEAT } from "./skier-seat.ts";
import { box, buildStations, merged } from "./station-parts.ts";
import { layStations } from "./station-plan.ts";
import { createWindTunnels } from "./wind-tunnels.ts";

/** A tower's column across its foot, m, and how far it is sunk into the
 * snow so a slope never shows its base. */
const COLUMN: Readonly<Record<LiftKind, number>> = { gondola: 1.3, chair: 0.95, drag: 0.42 };
const SINK = 1.2;

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
  /** Move what moves — the chairs, the cabins and the T-bars on the rope,
   * the wind tunnels' fans, streaks and lights — to the engine's clock;
   * with the player on a lift (`SkierState.lift`), his own chair hung
   * under him where he is drawn. */
  update(t: number, rider?: LiftRide | null, drawn?: RiderPose | null): void;
  /** The SPRAY row's share (`SPRAY_SHARE`): the tunnels' blown snow. */
  setBudget(share: number): void;
  dispose(): void;
};

/** Where the rider is drawn between two steps: his origin and his turn. */
export type RiderPose = {
  x: number;
  y: number;
  z: number;
  q: { x: number; y: number; z: number; w: number };
};

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
    box(2.2, 0.11, 0.58, 0, 0.055 - CHAIR_SEAT, -0.08, PAINT.seat),
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

  // THE STATIONS' OWN (`station-plan.ts`): the hoods, the booths, the
  // gates, the masts, the doors, the load lines and the fences.
  buildStations(layStations(level, plans), level.groundAt, painted, group, geos, meshes);

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

  // WHAT RIDES THE ROPE, MOVING: every `every` metres of the loop, up one
  // side and back down the other at the rope's speed — a pure function of
  // the engine's clock, so a replay hangs every chair where the run did.
  type Carrier = { p: LiftPlan; i: number; k: number };
  const carriers: Record<LiftKind, Carrier[]> = { gondola: [], chair: [], drag: [] };
  plans.forEach((p, i) => {
    for (let k = 0; k < carrierCount(p); k++) carriers[p.lift.kind].push({ p, i, k });
  });
  const placeOf = (c: Carrier, t: number) => carrierAt(c.p, c.k, t);
  const zero = new THREE.Vector3(0, 0, 0);
  const cabins = instancedMoving(cabinGeometry(), painted, carriers.gondola.length);
  const chairs = instancedMoving(chairGeometry(), painted, carriers.chair.length);
  // A DRAG'S T-BARS: the spring box at the rope, the cord down from it to
  // a skier's hips over the snow under it on the way up (reeled in on the
  // way down), and the bar across.
  const springGeo = new THREE.BoxGeometry(0.14, 0.55, 0.14);
  springGeo.translate(0, -0.3, 0);
  const cordGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4, 1, true);
  cordGeo.translate(0, -0.5, 0);
  const tee = merged([
    box(0.04, 0.6, 0.04, 0, 0.3, 0, PAINT.dark),
    box(1.0, 0.06, 0.06, 0, 0, 0, PAINT.steel),
  ]);
  const dragN = carriers.drag.length;
  const springs = instancedMoving(springGeo, plain, dragN, PAINT.dark);
  const cords = instancedMoving(cordGeo, plain, dragN, PAINT.dark, false);
  const tees = instancedMoving(tee, painted, dragN);
  // THE RIDER'S OWN CHAIR, hung under him from the rope while he rides one.
  const ridden = new THREE.Mesh(chairGeometry(), painted);
  geos.push(ridden.geometry);
  ridden.visible = false;
  ridden.castShadow = true;
  group.add(ridden);
  const lift = new THREE.Vector3();
  const riderQ = new THREE.Quaternion();

  /** An instanced mesh whose instances move: filled every frame. */
  function instancedMoving(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    count: number,
    colour?: number,
    shadow = true,
  ): THREE.InstancedMesh | null {
    geos.push(geo);
    if (count === 0) return null;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (colour !== undefined) for (let i = 0; i < count; i++) mesh.setColorAt(i, tint.set(colour));
    mesh.castShadow = shadow;
    mesh.receiveShadow = true;
    // Bounded by the lines they ride, whatever the hour.
    mesh.frustumCulled = false;
    meshes.push(mesh);
    group.add(mesh);
    return mesh;
  }

  const hide = m4.compose(zero, q.identity(), zero).clone();
  /** Every carrier where the clock has it; the one a rider sits in is his
   * own chair's (`ridden`). */
  function moveCarriers(t: number, rider: LiftRide | null): void {
    const seat = (h: THREE.InstancedMesh | null, list: Carrier[]) => {
      if (!h) return;
      list.forEach((c, n) => {
        const { u, side, out } = placeOf(c, t);
        const mine =
          rider !== null &&
          rider.index === c.i &&
          side === 0 &&
          Math.abs(u - rider.u) < c.p.look.every / 2;
        if (!out || mine) {
          h.setMatrixAt(n, hide);
          return;
        }
        const o = ropesOf(c.p)[side];
        const x = c.p.lift.bottom.x + c.p.dx * u + c.p.dz * o;
        const z = c.p.lift.bottom.z + c.p.dz * u - c.p.dx * o;
        h.setMatrixAt(
          n,
          m4.compose(
            at.set(x, ropeAt(c.p, u), z),
            q.setFromAxisAngle(up, side === 0 ? c.p.heading : c.p.heading + Math.PI),
            size.set(1, 1, 1),
          ),
        );
      });
      h.instanceMatrix.needsUpdate = true;
    };
    seat(cabins, carriers.gondola);
    seat(chairs, carriers.chair);
    if (!springs || !cords || !tees) return;
    carriers.drag.forEach((c, n) => {
      const { u, side, out } = placeOf(c, t);
      const mine = rider !== null && rider.index === c.i && side === 0 && Math.abs(u - rider.u) < 6;
      if (!out || mine) {
        for (const h of [springs, cords, tees]) h.setMatrixAt(n, hide);
        return;
      }
      const o = ropesOf(c.p)[0];
      const x = c.p.lift.bottom.x + c.p.dx * u + c.p.dz * o;
      const z = c.p.lift.bottom.z + c.p.dz * u - c.p.dx * o;
      const y = ropeAt(c.p, u);
      const yaw = side === 0 ? c.p.heading : c.p.heading + Math.PI;
      // Up the line the cord reaches a skier's hips; reeled in coming down.
      const cord = side === 0 ? Math.max(0.3, y - 0.58 - (level.groundAt(x, z) + TEE + 0.6)) : 0.3;
      q.setFromAxisAngle(up, yaw);
      springs.setMatrixAt(n, m4.compose(at.set(x, y, z), q, size.set(1, 1, 1)));
      cords.setMatrixAt(n, m4.compose(at.set(x, y - 0.58, z), q, size.set(1, cord, 1)));
      tees.setMatrixAt(n, m4.compose(at.set(x, y - 0.58 - cord - 0.6, z), q, size.set(1, 1, 1)));
    });
    for (const h of [springs, cords, tees]) h.instanceMatrix.needsUpdate = true;
  }
  moveCarriers(0, null);

  done.update = (t, rider, drawn) => {
    tunnels.update(t);
    moveCarriers(t, rider?.phase === "ride" || rider?.phase === "board" ? rider : null);
    // His own chair, hung from the grip over him: in the body's frame, the
    // grip `lift.seat` up from his origin.
    const seated = rider?.kind === "chair" && rider.phase === "ride" && drawn;
    ridden.visible = !!seated;
    if (seated) {
      riderQ.set(drawn.q.x, drawn.q.y, drawn.q.z, drawn.q.w);
      lift.set(0, TUNING.lift.seat, 0).applyQuaternion(riderQ);
      ridden.position.set(drawn.x + lift.x, drawn.y + lift.y, drawn.z + lift.z);
      ridden.quaternion.copy(riderQ);
    }
  };

  return done;
}
