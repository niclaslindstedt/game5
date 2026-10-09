// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE LIFTS AS DRAWN — every lift of the resort (R26), off its plan
// (`lift-plan.ts`: where each tower stands, how high, and where the rope
// hangs):
//
//   * THE TOWERS: a round tapered steel column on the snow under each
//     support with a ladder up its downhill face, and at its head a
//     crossarm with a sheave train at each end the rope rides over, a
//     catwalk, lifting frames and a lightning rod — one arm to one side
//     for a drag's single rope (`lift-shapes.ts`, `docs/lifts.md`).
//   * THE STATIONS: at each end a house behind the bullwheel, the wheel
//     itself flat at the rope's height on a column of its own, and the
//     rope turned round it.
//   * THE ROPE: the up and the down rope, straight between two supports
//     save for their sag, drawn as LINES — a rope is a few centimetres
//     thick, a pixel wide at any distance a skier sees it from, and a
//     tube that thin would flicker in and out of the picture.
//   * WHAT RIDES IT (`lift-carriers.ts`): a gondola's cabins, a chair's
//     four-seat chairs (the up side facing up the line, the down side
//     facing down it) with their safety bars lowered over the laps out on
//     the line and raised in the terminals, each swinging on its hanger,
//     and a drag's T-bars, reeled up into their spring boxes but where a
//     skier holds one. Hung where the engine's clock has them — a lift
//     that turned would be a second clock the replay and the ghost would
//     have to agree on.
//
//   * THE BOARDING RINGS at their feet, where a free ride's queues start
//     (`boarding-rings.ts`) — on a run that rides the lifts alone.
//
//   * THE WIND TUNNELS along the valley floor, the horizontal lift, are
//     `wind-tunnels.ts`'s, held in this group and moved by `update`; THE
//     CABINS beside the runs and lanes are `cabins-view.ts`'s, held here
//     too and handed their cuts by `update`'s lens; the ski area's own
//     village and mountain buildings are `village-cuts.ts`'s, in blocks at
//     two cuts, handed theirs the same way.
//
// THE DRAWS ARE FEW: every part of a kind is one INSTANCE of one mesh for
// the whole resort, coloured per vertex where it is more than one paint —
// at two cuts for the detailed parts, the whole part near the lens and a
// few boxes past it (`lift-cuts.ts`) — and the ropes of every lift are one
// set of lines: a couple of dozen draws for a mountain's lifts, however
// many towers.

import * as THREE from "three";
import { fromEuler } from "@niclaslindstedt/oss-game-framework/core/quat";
import { smoothstep } from "@niclaslindstedt/oss-game-framework/core/math";
import { TUNING, type Level, type LiftRide } from "@engine";

import { PAST_THE_WALL, hazeMaterial, type HazeUniforms } from "./haze.ts";
import { createMapBoards } from "./map-board.ts";
import {
  COLUMN_TAPER,
  DRAG_ARM,
  TOWER_PAD,
  cabinDoors,
  carrierAt,
  carrierCount,
  carrierGripAt,
  carrierSwingAt,
  gondolaGrip,
  railAt,
  seatedShare,
  planLift,
  ropeAt,
  stationHouses,
  type LiftKind,
  type LiftPlan,
} from "@engine";
import { createBoardingRings } from "./boarding-rings.ts";
import { createCabins } from "./cabins-view.ts";
import { liftFade } from "./camera-lift.ts";
import { createOwnCabin } from "./own-cabin.ts";
import { CHAIR_SEAT, TOW } from "./skier-seat.ts";
import {
  LIFT_PAINT,
  columnGeometry,
  ladderGeometry,
  towerHeadFarGeometry,
  towerHeadGeometry,
} from "./lift-shapes.ts";
import { Cut, StillCut, type Beyond } from "./lift-cuts.ts";
import type { ViewCull } from "./view-cull.ts";
import {
  CHAIR_BAR,
  bullwheelGeometry,
  cabinFarGeometry,
  cabinGeometry,
  chairBarFarGeometry,
  chairBarGeometry,
  chairDistantGeometry,
  chairFarGeometry,
  chairGeometry,
  springBoxFarGeometry,
  springBoxGeometry,
  teeFarGeometry,
  teeGeometry,
} from "./lift-carriers.ts";
import { buildStations, merged } from "./station-parts.ts";
import { layStations } from "./station-plan.ts";
import { buildStationHouses } from "./station-build.ts";
import {
  blocksOf,
  createBlockBuildings,
  createVillageBuildings,
  type Span,
  type VillageBuildings,
} from "./village-cuts.ts";
import { createInteriors } from "./interiors-view.ts";
import { createWindTunnels } from "./wind-tunnels.ts";

/** How far a tower's column is sunk into the snow, m, so a slope never
 * shows its base. Its girth is the plan's (`LiftLook.column`, which a
 * skier meets). */
const SINK = 1.2;

/** A drag's bar rides this high over the snow up the line, m — under a
 * skier's seat, where his own bar sits (`skier-seat.ts`'s `TOW`). */
const TEE = 0.8;

/** How near the lens each part is drawn whole, m — past it at its far cut
 * (`lift-cuts.ts`): a chair or a cabin a few dozen pixels wide, a tower's
 * head, a T-bar. */
const CHAIR_REACH = 80;
const CABIN_REACH = 110;
const HEAD_REACH = 140;
const TEE_REACH = 50;
/** Past this a chair is its seat and back alone and its safety bar is not
 * drawn, m. */
const CHAIR_DISTANT = 320;

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
  skis: 0xe8e2d6,
  pad: 0xd8411f,
  band: 0xf2f0ea,
};

export type Lifts = {
  group: THREE.Group;
  /** Move what moves — the chairs, the cabins and the T-bars on the rope,
   * the wind tunnels' fans, streaks and lights — to the engine's clock
   * `t` (the time the riders are drawn at, between two steps); with the
   * player on a lift (`SkierState.lift`, drawn at `drawn`), his own cabin
   * or T-bar where he is drawn — a chair he sits in is the clock's, as
   * every chair is. `others` are the keen skiers on lifts, `crowd` the
   * ski area's amateurs (`GameState.crowd`), whose T-bars are held. */
  update(
    t: number,
    rider?: LiftRide | null,
    drawn?: RiderPose | null,
    eye?: THREE.Vector3,
    others?: readonly SeatedRider[],
    crowd?: readonly { mode: string; lift: number; carrier: number }[],
  ): void;
  /** The SPRAY row's share (`SPRAY_SHARE`): the tunnels' blown snow. */
  setBudget(share: number): void;
  dispose(): void;
};

/** ANOTHER SKIER ON A LIFT (an enthusiast, `enthusiasts.ts`): his ride
 * and where he is drawn. */
export type SeatedRider = { ride: LiftRide; drawn: RiderPose };

/** Where the rider is drawn between two steps: his origin and his turn. */
export type RiderPose = {
  x: number;
  y: number;
  z: number;
  q: { x: number; y: number; z: number; w: number };
};

/** The ropes' offsets right of the line, m: up and down, or a drag's one. */
function ropesOf(plan: LiftPlan): number[] {
  return plan.lift.kind === "drag" ? [DRAG_ARM] : [plan.look.gauge / 2, -plan.look.gauge / 2];
}

/** The resort's lifts — and its WIND TUNNELS along the valley floor
 * (`wind-tunnels.ts`), the horizontal lift — in one group the renderer
 * holds. `budget` is the SPRAY row's share; `rings` whether the run rides
 * the lifts (`RunRules.lifts`), and so whether its boarding rings show;
 * `cull` (`view-cull.ts`, aimed by the renderer each frame) leaves out the
 * moving carriers out of sight. */
export function createLifts(
  level: Level,
  haze: HazeUniforms,
  budget = 1,
  rings = false,
  cull?: ViewCull,
): Lifts {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const meshes: THREE.InstancedMesh[] = [];
  const lifts = level.resort?.lifts ?? [];
  const tunnels = createWindTunnels(level, haze, budget);
  group.add(tunnels.group);
  const houses = createCabins(level, haze);
  group.add(houses.group);
  // THE ROOMS inside the buildings near the lens (`interiors-view.ts`).
  const rooms = createInteriors(level, haze);
  group.add(rooms.group);
  // THE SKI AREA'S OWN BUILDINGS (`village-build.ts`, `mountain-build.ts`):
  // the village round the hub and the mountain's restaurant and patrol hut,
  // in blocks at a near and a far cut (`village-cuts.ts`).
  const village = createVillageBuildings(level, haze);
  /** The lift stations' houses, once the lifts are planned. */
  let halls: VillageBuildings | null = null;
  group.add(village.group);
  let disposeBoards = (): void => {};
  let disposeRings = (): void => {};
  const dispose = () => {
    tunnels.dispose();
    houses.dispose();
    village.dispose();
    halls?.dispose();
    rooms.dispose();
    disposeBoards();
    disposeRings();
    for (const g of geos) g.dispose();
    for (const m of mats) m.dispose();
    for (const m of meshes) m.dispose();
  };
  const done: Lifts = {
    group,
    update: (t, _rider, _drawn, eye) => {
      tunnels.update(t);
      if (eye) {
        houses.update(eye);
        village.update(eye);
        halls?.update(eye);
        rooms.update(eye);
      }
    },
    setBudget: tunnels.setBudget,
    dispose,
  };
  if (lifts.length === 0) return done;
  const plans = lifts.map((l) => planLift(level, l));
  const std = (p: THREE.MeshStandardMaterialParameters, name: string) => {
    const m = hazeMaterial(new THREE.MeshStandardMaterial(p), haze, name, PAST_THE_WALL);
    mats.push(m);
    return m;
  };
  const painted = std({ vertexColors: true, roughness: 0.55, metalness: 0.3 }, "lift");
  const steel = std({ color: LIFT_PAINT.galv, roughness: 0.42, metalness: 0.6 }, "lift");
  const cordMat = std({ color: LIFT_PAINT.dark, roughness: 0.8 }, "lift");

  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3();
  const size = new THREE.Vector3();
  const tint = new THREE.Color();
  const pitchQ = new THREE.Quaternion();
  const side = new THREE.Vector3(1, 0, 0);
  const one = new THREE.Vector3(1, 1, 1);
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
      q.setFromAxisAngle(up, yaw);
      mesh.setMatrixAt(i, m4.compose(at.set(x, y, z), q, s ?? size.set(1, 1, 1)));
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

  // THE COLUMNS: one round tapered steel tube for every tower and every
  // bullwheel's post, scaled to its height and its kind's girth.
  const column = columnGeometry(COLUMN_TAPER);
  const supports = plans.reduce((n, p) => n + p.supports.length, 0);
  instanced(column, steel, supports, (set) => {
    for (const p of plans) {
      const w = p.look.column;
      for (const s of p.supports) {
        // A station's post stands under its wheel, a tower's under its
        // crossarm, both sunk into the snow.
        const top = s.rope - (s.station ? 0.4 : 0.9);
        set(s.x, s.ground - SINK, s.z, p.heading, size.set(w, top + SINK, w));
      }
    }
  });

  // THE PADS: a tower standing on or beside a run (`Support.pad`) wrapped
  // from the snow to over a skier's head in vinyl-covered foam — a vivid
  // octagonal sleeve round the column, two pale reflective bands near its
  // top and a dark cap — so a skier who meets it meets the pad.
  const pads = plans.reduce((n, p) => n + p.supports.filter((s) => s.pad).length, 0);
  const sleeve = (h: number, y: number, colour: number) => {
    const geo = new THREE.CylinderGeometry(1, 1, h, 8, 1, false);
    geo.rotateY(Math.PI / 8);
    geo.translate(0, y + h / 2, 0);
    return { geo, colour };
  };
  const padGeo = merged([
    sleeve(0.7, 0, PAINT.pad),
    sleeve(0.04, 0.7, PAINT.band),
    sleeve(0.12, 0.74, PAINT.pad),
    sleeve(0.04, 0.86, PAINT.band),
    sleeve(0.1, 0.9, PAINT.pad),
    {
      geo: new THREE.CylinderGeometry(0.86, 1, 0.02, 8).rotateY(Math.PI / 8).translate(0, 1.01, 0),
      colour: PAINT.dark,
    },
  ]);
  const vinyl = std({ vertexColors: true, roughness: 0.6, metalness: 0 }, "lift");
  instanced(padGeo, vinyl, pads, (set) => {
    for (const p of plans) {
      const r = p.look.column * Math.SQRT2 + TOWER_PAD.thick;
      for (const s of p.supports) {
        if (!s.pad) continue;
        set(s.x, s.ground - SINK, s.z, p.heading, size.set(r, TOWER_PAD.height + SINK, r));
      }
    }
  });

  // THE LADDERS up every tower's downhill face, on stand-offs, leant in
  // with the column's taper to its head; the snow hides their feet. Near
  // the lens only.
  const still: StillCut[] = [];
  const stillCut = (cut: Cut, fill: (put: (m: THREE.Matrix4) => void) => void) => {
    for (const m of cut.meshes) {
      meshes.push(m);
      group.add(m);
    }
    geos.push(cut.near.geometry);
    if (cut.far) geos.push(cut.far.geometry);
    const sc = new StillCut(cut);
    fill((m) => sc.add(m));
    sc.update(null);
    still.push(sc);
  };
  const towerList = plans.flatMap((p) =>
    p.supports.filter((s) => !s.station).map((s) => ({ p, s })),
  );
  stillCut(new Cut(ladderGeometry(), null, painted, towerList.length, 70, false), (put) => {
    for (const { p, s } of towerList) {
      const w = p.look.column;
      const top = s.rope - 0.9;
      const lean = Math.atan2(w * (1 - COLUMN_TAPER), top + SINK);
      const off = w * COLUMN_TAPER + 0.16;
      q.setFromAxisAngle(up, p.heading).multiply(pitchQ.setFromAxisAngle(side, lean));
      put(m4.compose(at.set(s.x - p.dx * off, s.ground + top - 0.2, s.z - p.dz * off), q, one));
    }
  });

  // THE HEADS, one pair of cuts a kind: the crossarm and the sheave trains.
  for (const kind of ["gondola", "chair", "drag"] as const) {
    const own = towerList.filter(({ p }) => p.lift.kind === kind);
    if (own.length === 0) continue;
    const look = own[0].p.look;
    const args = [kind, look.gauge, look.column, COLUMN_TAPER, DRAG_ARM] as const;
    const cut = new Cut(
      towerHeadGeometry(...args),
      towerHeadFarGeometry(...args),
      painted,
      own.length,
      HEAD_REACH,
    );
    stillCut(cut, (put) => {
      for (const { p, s } of own) {
        q.setFromAxisAngle(up, p.heading);
        put(m4.compose(at.set(s.x, s.ground + s.rope, s.z), q, one));
      }
    });
  }

  // THE STATIONS: the bullwheel flat at the rope's height over each end of
  // the line; the houses behind them are buildings (below).
  const wheelGeo = bullwheelGeometry();
  const ends = plans.length * 2;
  type End = { p: LiftPlan; wheelX: number; wheelZ: number; wheelY: number };
  const stations: End[] = plans.flatMap((p) =>
    stationHouses(level, p).map((h) => ({
      p,
      wheelX: h.wheel.x,
      wheelZ: h.wheel.z,
      wheelY: h.wheel.ground + h.wheel.rope,
    })),
  );
  instanced(wheelGeo, painted, ends, (set) => {
    for (const e of stations) {
      const r = Math.max(0.6, e.p.look.gauge / 2 + 0.25);
      set(
        e.wheelX + (e.p.lift.kind === "drag" ? (e.p.dz * DRAG_ARM) / 2 : 0),
        e.wheelY - 0.15,
        e.wheelZ - (e.p.lift.kind === "drag" ? (e.p.dx * DRAG_ARM) / 2 : 0),
        e.p.heading,
        size.set(r, 0.35, r),
      );
    }
  });

  // THE STATIONS' OWN (`station-plan.ts`): the hoods, the booths, the
  // gates, the masts, the doors, the load lines and the fences.
  const layout = layStations(level, plans);
  buildStations(layout, level.groundAt, painted, group, geos, meshes);
  // THE BUILDINGS (`station-build.ts`): every station's house, the
  // terminals, the booths, a gondola's platform roof and door, a drag's
  // hut — in the painted materials (`facade-paint.ts`), in blocks at a near
  // and a far cut as the village's are (`village-cuts.ts`).
  halls = createBlockBuildings(
    blocksOf((minArea) => {
      const spans: Span[] = [];
      return { kit: buildStationHouses(level, plans, layout, minArea, spans), spans };
    }),
    haze,
    "stations",
  );
  group.add(halls.group);
  // THE PISTE MAP BOARDS' FACES (`map-board.ts`), each marked at its top.
  const boards = createMapBoards(
    level,
    layout.parts.filter((q) => q.kind === "board"),
    plans.map((p) => p.lift.top),
    haze,
  );
  group.add(boards.group);
  disposeBoards = boards.dispose;
  // THE BOARDING RINGS where the queues start, ridden into to board.
  const boarding = rings ? createBoardingRings(level, plans) : null;
  if (boarding) {
    group.add(boarding.group);
    disposeRings = boarding.dispose;
  }

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

  // WHAT RIDES THE ROPE, MOVING: every carrier round its loop where the
  // clock has it (`carrierAt`) — creeping through the terminals, its grip
  // on the station's rail there (`carrierGripAt`), swung on its hanger by
  // the grip's slowing and the towers' sheaves (`carrierSwingAt`) — a pure
  // function of the engine's clock, so a replay hangs every chair where
  // the run did, and a rider sat in a chair (the player, a keen skier, the
  // crowd) is drawn in the very chair the clock has there.
  type Carrier = { p: LiftPlan; i: number; k: number };
  const carriers: Record<LiftKind, Carrier[]> = { gondola: [], chair: [], drag: [] };
  plans.forEach((p, i) => {
    for (let k = 0; k < carrierCount(p); k++) carriers[p.lift.kind].push({ p, i, k });
  });
  const zero = new THREE.Vector3(0, 0, 0);
  const cabins = movingCut(
    cabinGeometry(),
    cabinFarGeometry(),
    carriers.gondola.length,
    CABIN_REACH,
  );
  const chairN = carriers.chair.length;
  const chairs = movingCut(chairGeometry(), chairFarGeometry(), chairN, CHAIR_REACH, {
    geo: chairDistantGeometry(),
    reach: CHAIR_DISTANT,
  });
  // Every chair's SAFETY BAR, swung down over the riders' laps once the
  // chair is clear of its load and up again before its unload (`BAR`).
  const bars = movingCut(chairBarGeometry(), chairBarFarGeometry(), chairN, CHAIR_REACH, {
    geo: null,
    reach: CHAIR_DISTANT,
  });
  // A DRAG'S T-BARS: the spring box at the rope, the cord down from it and
  // the bar across — the cord REELED UP into the box while nobody holds the
  // bar, paid out as one is pulled down and held, and reeled back in when
  // it is let go of (`REEL`).
  const cordGeo = new THREE.CylinderGeometry(0.012, 0.012, 1, 4, 1, true);
  cordGeo.translate(0, -0.5, 0);
  const tee = teeGeometry();
  geos.push(tee);
  const dragN = carriers.drag.length;
  const springs = movingCut(springBoxGeometry(), springBoxFarGeometry(), dragN, TEE_REACH);
  const cords = instancedMoving(cordGeo, cordMat, dragN, undefined, false);
  const tees = movingCut(tee.clone(), teeFarGeometry(), dragN, TEE_REACH);
  /** Each T-bar's cord as drawn, m, and the clock it was drawn at. */
  const cordOf = new Float32Array(dragN).fill(REEL.short);
  let reeledAt = Number.NaN;
  // THE RIDER'S OWN T-BAR while a drag pulls him: the spring box on the
  // rope at his bar's grip ahead of him, the cord from it down to the
  // stem's eye, and the bar behind his thighs — the clock's bar he holds
  // stood aside for it.
  const towBox = springBoxGeometry();
  const towCord = cordGeo.clone();
  geos.push(towBox, towCord);
  const towSpring = new THREE.Mesh(towBox, painted);
  const towLine = new THREE.Mesh(towCord, cordMat);
  const towTee = new THREE.Mesh(tee, painted);
  const tow = [towSpring, towLine, towTee];
  for (const m of tow) {
    m.visible = false;
    m.castShadow = true;
    group.add(m);
  }
  // THE RIDER'S OWN CABIN (`own-cabin.ts`): coming round the wheel to him
  // on the platform, its doors open, and hung from the grip over him once
  // he is in it — its glass clear enough to see him sat inside.
  const glassMat = std(
    {
      color: PAINT.glass,
      roughness: 0.08,
      metalness: 0.4,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    },
    "lift-glass",
  );
  const own = createOwnCabin(
    painted,
    glassMat,
    PAINT,
    -(TUNING.lift.cabin + CHAIR_SEAT - TUNING.lift.seat),
    geos,
  );
  const cabin = own.group;
  group.add(cabin);
  // THE FADE through a station (`camera-lift.ts`'s `liftFade`): a black
  // sheet over the whole frame, drawn last, in clip space.
  const fadeGeo = new THREE.PlaneGeometry(2, 2);
  geos.push(fadeGeo);
  const fadeMat = new THREE.ShaderMaterial({
    uniforms: { uFade: { value: 0 } },
    vertexShader: "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader:
      "uniform float uFade;\nvoid main() {\n  gl_FragColor = vec4(0.0, 0.0, 0.0, uFade);\n  #include <colorspace_fragment>\n}",
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  mats.push(fadeMat);
  const fade = new THREE.Mesh(fadeGeo, fadeMat);
  fade.frustumCulled = false;
  fade.renderOrder = 1e6;
  fade.visible = false;
  group.add(fade);
  const lift = new THREE.Vector3();
  const riderQ = new THREE.Quaternion();
  const bar = new THREE.Vector3();
  const eyeOf = new THREE.Vector3();
  const grip = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const pivot = new THREE.Matrix4();
  const swung = new THREE.Matrix4();

  /** A part whose instances move, at two cuts: filled every frame. */
  function movingCut(
    near: THREE.BufferGeometry,
    far: THREE.BufferGeometry,
    count: number,
    reach: number,
    beyond?: Beyond,
  ): Cut | null {
    geos.push(near, far);
    if (beyond?.geo) geos.push(beyond.geo);
    if (count === 0) return null;
    const cut = new Cut(near, far, painted, count, reach, true, beyond);
    for (const m of cut.meshes) {
      meshes.push(m);
      group.add(m);
    }
    return cut;
  }

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

  /** The carrier's turn: up its side's way, swung `swing` off plumb. */
  const hung = (p: LiftPlan, side: 0 | 1, swing: number): THREE.Quaternion => {
    const e = fromEuler(side === 0 ? p.heading : p.heading + Math.PI, swing, 0);
    return q.set(e.x, e.y, e.z, e.w);
  };
  /** Where carrier `u` m up line `p` is on rope `side`, in the world. */
  const onRope = (p: LiftPlan, u: number, side: 0 | 1, y: number): THREE.Vector3 => {
    const o = ropesOf(p)[side];
    return at.set(p.lift.bottom.x + p.dx * u + p.dz * o, y, p.lift.bottom.z + p.dz * u - p.dx * o);
  };

  const hide = m4.compose(zero, q.identity(), zero).clone();
  /** Every carrier where the clock has it, at the cut its distance from
   * `eye` asks — the cabin the player sits in (`inCabin`) is his own; the
   * T-bars' cords as `holds` has them held (by the bar's key, `barKey`). */
  function moveCarriers(
    t: number,
    inCabin: readonly { index: number; u: number }[],
    holds: ReadonlyMap<number, Hold>,
    eye?: THREE.Vector3,
    cull?: ViewCull,
  ): void {
    if (cabins) {
      cabins.begin(eye, cull);
      for (const c of carriers.gondola) {
        const { u, side, out } = carrierAt(c.p, c.k, t);
        const mine =
          side === 0 &&
          inCabin.some((r) => r.index === c.i && Math.abs(u - r.u) < c.p.look.every / 2);
        if (!out || mine) continue;
        hung(c.p, side, carrierSwingAt(c.p, u, side));
        cabins.add(m4.compose(onRope(c.p, u, side, ropeAt(c.p, u)), q, one));
      }
      cabins.end();
    }
    if (chairs && bars) {
      chairs.begin(eye, cull);
      bars.begin(eye, cull);
      for (const c of carriers.chair) {
        const { u, side, out } = carrierAt(c.p, c.k, t);
        if (!out) continue;
        hung(c.p, side, carrierSwingAt(c.p, u, side));
        m4.compose(onRope(c.p, u, side, carrierGripAt(c.p, u)), q, one);
        chairs.add(m4);
        const lowered = side === 0 ? barDown(c.p, u) : 0;
        pivot.makeTranslation(0, CHAIR_BAR.y, CHAIR_BAR.z);
        swung.makeRotationX(CHAIR_BAR.up * (1 - lowered));
        bars.add(pivot.premultiply(m4).multiply(swung));
      }
      chairs.end();
      bars.end();
    }
    if (!springs || !cords || !tees) return;
    const dt = t - reeledAt;
    const snap = !(dt >= 0 && dt < 1);
    reeledAt = t;
    springs.begin(eye, cull);
    tees.begin(eye, cull);
    carriers.drag.forEach((c, n) => {
      const { u, side, out } = carrierAt(c.p, c.k, t);
      const y = ropeAt(c.p, u);
      const held = holds.get(barKey(c.i, c.k));
      const p = onRope(c.p, u, 0, y);
      // Held, the cord reaches a skier's hips over the snow under it.
      const hips = Math.max(REEL.short, y - 0.58 - (level.groundAt(p.x, p.z) + TEE + 0.6));
      const want = held?.cord ?? REEL.short + (hips - REEL.short) * (held ? (held.pull ?? 1) : 0);
      let cord = cordOf[n];
      if (snap || held?.hide) cord = want;
      else if (want > cord) cord = Math.min(want, cord + REEL.out * dt);
      else cord = Math.max(want, cord - REEL.in * dt);
      cordOf[n] = cord;
      if (!out || held?.hide) {
        cords.setMatrixAt(n, hide);
        return;
      }
      onRope(c.p, u, side, y);
      q.setFromAxisAngle(up, side === 0 ? c.p.heading : c.p.heading + Math.PI);
      springs.add(m4.compose(at, q, one));
      cords.setMatrixAt(n, m4.compose(at.setY(y - 0.58), q, size.set(1, cord, 1)));
      tees.add(m4.compose(at.setY(y - 0.58 - cord - 0.6), q, one));
    });
    springs.end();
    tees.end();
    cords.instanceMatrix.needsUpdate = true;
  }
  moveCarriers(0, [], new Map());

  const inCabin: { index: number; u: number }[] = [];
  const holds = new Map<number, Hold>();
  done.update = (t, rider, drawn, eye, others = [], crowd = []) => {
    tunnels.update(t);
    if (eye) {
      houses.update(eye);
      village.update(eye);
      halls?.update(eye);
      rooms.update(eye);
    }
    boarding?.update(t);
    const plan = rider ? plans[rider.index] : undefined;
    const togo = rider && plan ? plan.length - plan.look.off - rider.u : Infinity;
    const black = liftFade(rider ?? null, togo);
    fade.visible = black > 0;
    fadeMat.uniforms.uFade.value = black;
    const carried = rider?.phase === "ride" ? rider : null;
    if (drawn) riderQ.set(drawn.q.x, drawn.q.y, drawn.q.z, drawn.q.w);
    // The T-bars held: the crowd's and the keen skiers' to their hips; the
    // player's drawn as his own (below) — and the one coming round to him
    // while he waits on the track pulled down as it comes.
    holds.clear();
    for (const a of crowd)
      if (a.mode === "ride" && plans[a.lift]?.lift.kind === "drag")
        holds.set(barKey(a.lift, a.carrier), {});
    for (const o of others)
      if (o.ride.kind === "drag" && o.ride.phase === "ride" && o.ride.carrier !== undefined)
        holds.set(barKey(o.ride.index, o.ride.carrier), {});
    const towed =
      carried?.kind === "drag" && carried.carrier !== undefined && drawn && plan ? plan : null;
    for (const m of tow) m.visible = !!towed;
    if (towed && drawn) {
      // His bar across the backs of his thighs under his seat, in his own
      // frame (`TOW`), its stem to his left; the box on the rope at the
      // grip ahead of him, the cord from it down to the stem's eye.
      bar
        .set(-TUNING.lift.tee, TOW.hips.y + TOW.bar.y, TOW.hips.z + TOW.bar.z)
        .applyQuaternion(riderQ)
        .add(at.set(drawn.x, drawn.y, drawn.z));
      eyeOf.set(0, 0.6, 0).applyQuaternion(riderQ).add(bar);
      const g = carrierAt(towed, carried!.carrier!, t);
      grip.copy(onRope(towed, g.u, 0, ropeAt(towed, g.u)));
      q.setFromAxisAngle(up, towed.heading);
      towSpring.position.copy(grip);
      towSpring.quaternion.copy(q);
      grip.y -= 0.58;
      lift.subVectors(eyeOf, grip);
      const cord = Math.max(REEL.short, lift.length());
      towLine.position.copy(grip);
      towLine.quaternion.setFromUnitVectors(down, lift.normalize());
      towLine.scale.set(1, cord, 1);
      towTee.position.copy(bar);
      towTee.quaternion.copy(riderQ);
      holds.set(barKey(carried!.index, carried!.carrier!), { hide: true, cord });
    } else if (rider?.kind === "drag" && rider.phase === "wait" && plan && drawn) {
      const ru =
        (drawn.x - plan.lift.bottom.x) * plan.dx + (drawn.z - plan.lift.bottom.z) * plan.dz;
      for (const c of carriers.drag) {
        if (c.i !== rider.index) continue;
        const g = carrierAt(c.p, c.k, t);
        if (g.side !== 0 || g.u < ru - REEL.reach || g.u > ru + 0.5) continue;
        holds.set(barKey(c.i, c.k), { pull: smoothstep(ru - REEL.reach, ru - 0.6, g.u) });
      }
    }
    inCabin.length = 0;
    if (carried?.kind === "gondola" && carried.stand === undefined) inCabin.push(carried);
    moveCarriers(t, inCabin, holds, eye, cull);
    for (const c of still) c.update(eye);
    // His own cabin on a gondola: coming round the bottom wheel on the
    // station's rail to him on the platform, creeping on while he steps in
    // — both where the engine has its grip — and once he is sat in it hung
    // from the grip over him: `lift.cabin` up and `cabinBack` ahead of him
    // in his frame. Let out of its door at the top, it is the clock's.
    const cab =
      rider?.kind === "gondola" && rider.phase !== "board" && rider.stand === undefined
        ? rider
        : null;
    cabin.visible = !!cab && (cab.phase === "wait" || !!drawn);
    if (cab) {
      own.set(cabinDoors(cab));
      if (cab.phase === "ride" && seatedShare(cab) >= 1 && drawn) {
        lift.set(0, TUNING.lift.cabin, TUNING.lift.cabinBack).applyQuaternion(riderQ);
        cabin.position.set(drawn.x + lift.x, drawn.y + lift.y, drawn.z + lift.z);
        cabin.quaternion.copy(riderQ);
      } else if (plan) {
        const r = railAt(plan, cab.u);
        cabin.position.set(r.x, gondolaGrip(plan, Math.max(0, cab.u)), r.z);
        cabin.quaternion.setFromAxisAngle(up, r.heading);
      }
    }
  };

  return done;
}

/** A T-bar as held: drawn as a rider's own (`hide`, its cord `cord` m
 * long), pulled `pull` of the way down to a skier's hips as it comes to
 * him, or (neither) held at his hips. */
type Hold = { hide?: boolean; cord?: number; pull?: number };

/** A T-bar's key among every lift's: its lift's index and its number. */
function barKey(index: number, k: number): number {
  return index * 4096 + k;
}

/** THE SAFETY BAR (`docs/lifts.md`): lowered once the chair is clear of
 * its load — `down` m past the load line, over the metres between — and
 * raised `up` m short of the unload, where the sign asks for it: 0 up …
 * 1 down over the riders' laps, `u` m up the line. */
const BAR = { down: [8, 16], up: [34, 26] } as const;
function barDown(p: LiftPlan, u: number): number {
  const load = p.look.entry.at;
  const off = p.length - p.look.off;
  return (
    smoothstep(load + BAR.down[0], load + BAR.down[1], u) *
    (1 - smoothstep(off - BAR.up[0], off - BAR.up[1], u))
  );
}

/** A T-BAR'S CORD in its spring box: reeled up to `short` m while nobody
 * holds the bar, paid out at up to `out` m/s as it is pulled down and
 * reeled back in at `in` m/s once let go (the box's spring, damped); and
 * how far back from a skier waiting on the track a coming bar begins to
 * be pulled down to him, m. */
const REEL = { short: 0.3, out: 4, in: 2.5, reach: 4 } as const;
