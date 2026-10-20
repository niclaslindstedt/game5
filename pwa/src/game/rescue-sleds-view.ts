// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE SKI PATROL'S SNOWMOBILE RESCUE, DRAWN — every rescue by snowmobile a
// run carries (`RescueCall.kind === "sled"`, booked by `rescue-book.ts`
// where no air ambulance can set down): at every frame the moment of the
// call (`sledCrewAt`, a pure function of its clock) is read and drawn —
//
//   - the TWO PATROL MACHINES (`sled-livery.ts`' fleet: the snowmobile's
//     own model in the patrol's red, the white crosses, the amber beacon
//     turning on its mast and the orange flag on its whip), driven up in
//     convoy, parked, and driven down, each stood on the snow under it;
//   - the RESCUE TOBOGGAN (`rescue-toboggan.ts`) on its rigid tow bar
//     behind the machine towing it, the bar's eye on the hitch while it is
//     hitched and laid on the snow ahead of the nose while it is not, and
//     the lashings done up across him one by one;
//   - the FOUR PATROLLERS in the patrol's red with the white cross, on the
//     civilians' bodies (`buildPosedFigure`) at the air crew's targets and
//     two of their own (`rescue-sleds-ride.ts`): sat astride as driver or
//     passenger while they ride, stepping off and on, walking, scooping
//     and carrying — and, on foot, KNOCKED OVER by a skier as anyone on
//     foot is (`civilian-hits.ts`), up again and back to the work;
//   - the STRETCHER and HIM on it, in his own colours (`rescue-view.ts`'
//     pieces), lying where he fell, scooped, carried and lowered into the
//     toboggan.
//
// After dark each machine's headlight lights the snow ahead of it and the
// nearest one's beacon sweeps round (`lamps`). A machine STOLEN is gone
// from here the moment it was (`rescueSledsAt`): the player's own drawing
// has it (`sled-view.ts`).
//
// Presentation only: it reads the state it is handed and the map, and
// writes nothing; the machines and the toboggan are solids to the ENGINE
// (`rescue-sled.ts`), never to this view.

import * as THREE from "three";
import {
  RESCUE_SLEDS,
  type GameState,
  type Level,
  type RescueCall,
  type RescueCasualty,
} from "@engine";

import { CIVILIAN_SLOT as SLOT, PART } from "./civilian-dress.ts";
import {
  createKnocks,
  homeFrom,
  updateKnocks,
  walkBackPose,
  type Person,
} from "./civilian-hits.ts";
import { onRagdoll } from "./civilian-knock.ts";
import { knockedPose } from "./civilian-knock-pose.ts";
import { freshCivilianPose, type CivilianPose } from "./civilian-plan.ts";
import { buildPosedFigure, poseCivilianFigure } from "./civilian-shapes.ts";
import type { Flood } from "./headlamp.ts";
import { hazeMaterial, type HazeUniforms } from "./haze.ts";
import type { Outfit } from "./outfit.ts";
import { CREW_POSES, RESCUE_STRIDE, crewDials } from "./rescue-crew.ts";
import { BEARERS } from "./rescue-defs.ts";
import { freshSledCrewFrame, sledCrewAt, type SledCrewFrame } from "./rescue-sleds-crew.ts";
import { RIDES, SEAT_RISE, patrolTargets } from "./rescue-sleds-ride.ts";
import {
  BAR_FEET,
  LASHINGS,
  lashGeometry,
  tobogganGeometry,
  towBarGeometry,
} from "./rescue-toboggan.ts";
import {
  DRESS,
  HAIR,
  SKIN,
  STRAPS,
  casualtyFigure,
  dressed,
  strapGeometry,
  stretcherGeometry,
} from "./rescue-view.ts";
import { createSledFleet, standOnSnow, type FleetSled } from "./sled-livery.ts";
import { SLED_LOOK } from "./sled-look.ts";

const K = RESCUE_SLEDS;

/** THE HITCH on a machine's tail, its middle's frame (x right, y up from
 * the snow, z ahead), m: under the tunnel's end, where the bar's eye
 * drops on. */
const HITCH = { y: 0.4, z: -K.sled.length / 2 - 0.04 };

/** THE LAMPS after dark: a headlight's power and how far down it aims,
 * rad; the beacon's amber and its narrow sweep (`lampReach`'s beam), and
 * its power. */
const HEADLIGHT = { power: 1.6, down: 0.12 };
const LED = [0.95, 0.95, 0.9] as const;
const AMBER = [1.0, 0.5, 0.06] as const;
const BEACON_BEAM = [0.8, 0.96, 0.3, 0.12] as const;
const BEACON_POWER = 0.7;

export type RescueSledsScene = {
  group: THREE.Group;
  /** One frame: a new run's calls read, the knocks stepped, every call's
   * machines, toboggan, patrol and casualty posed at the run's clock. */
  frame(state: GameState): void;
  /** The player's outfit, every casualty's. */
  dress(outfit: Outfit): void;
  /** The beacons turned and lit, and the headlights and the nearest
   * beacon's sweep after dark (`lit` the dark's share). */
  lamps(lit: number, eye: THREE.Vector3, out: Flood[]): void;
  /** Whether any rescue by snowmobile is under way on this run. */
  active(): boolean;
  /** Resolved once the machines' model is in. */
  ready: Promise<void>;
  dispose(): void;
};

/** One patroller: his figure (its weights), and his ragdoll's. */
type Patroller = { mesh: THREE.Mesh; weights: number[]; down: THREE.Mesh };

/** ONE CALL's things. */
type Unit = {
  sleds: [FleetSled, FleetSled];
  toboggan: THREE.Group;
  lashes: THREE.Mesh[];
  bar: THREE.Mesh;
  crew: Patroller[];
  litter: THREE.Group;
  straps: THREE.Mesh[];
  casualty: THREE.Mesh | null;
  dressed: string;
  lying: THREE.Matrix4;
  now: SledCrewFrame;
  asked: SledCrewFrame;
  askedAt: number;
};

const N = CREW_POSES.length;
const scratch = new Float32Array(N);

/** A patroller's body, built once with the rides and shared. */
const bodies = new Map<string, THREE.BufferGeometry>();
function bodyOf(body: (typeof BEARERS)[number]["body"]): THREE.BufferGeometry {
  let g = bodies.get(body);
  if (!g) {
    g = buildPosedFigure(body, "near", patrolTargets(body), `patrol-sled:${body}`);
    bodies.set(body, g);
  }
  return g;
}

/** The patrol's colours on patroller `j`. */
function patrolDress(j: number) {
  const d = DRESS.patrol;
  return {
    colours: { ...d, skin: SKIN[j % 4], hair: HAIR[j % 4], skis: 0x30343a },
    parts: [PART.helmet, PART.cross, PART.bands],
  } satisfies { colours: Partial<Record<keyof typeof SLOT, number>>; parts: number[] };
}

/** THE TOBOGGAN's pose on the snow under its runners, its middle at `p`. */
function bedPose(level: Level, p: { x: number; z: number; heading: number }, g: THREE.Object3D) {
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const L = K.toboggan.length / 2 - 0.15;
  const W = K.toboggan.width / 2 - 0.05;
  const at = (a: number, l: number) => level.groundAt(p.x + fx * a + fz * l, p.z + fz * a - fx * l);
  const lf = at(L, -W);
  const rf = at(L, W);
  const lb = at(-L, -W);
  const rb = at(-L, W);
  g.position.set(p.x, (lf + rf + lb + rb) / 4, p.z);
  g.rotation.set(
    -Math.atan2((lf + rf - lb - rb) / 2, 2 * L),
    p.heading,
    -Math.atan2((lf + lb - rf - rb) / 2, 2 * W),
    "YXZ",
  );
}

export function createRescueSledsScene(level: Level, haze: HazeUniforms): RescueSledsScene {
  const group = new THREE.Group();
  group.name = "rescue-sleds";
  group.visible = false;
  const fleet = createSledFleet(haze);
  group.add(fleet.group);
  const material = hazeMaterial(
    new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
    haze,
    "rescue",
  );
  const kit = hazeMaterial(
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 }),
    haze,
    "rescue-kit",
  );
  const hull = tobogganGeometry();
  const barGeometry = towBarGeometry();
  const lashGeometries = LASHINGS.map((z) => lashGeometry(z));
  const stretcher = stretcherGeometry();
  const strapGeometries = STRAPS.map(({ z, top }) => strapGeometry(z, top));
  let outfit: Outfit | null = null;

  const units: Unit[] = [];
  const unitFor = (i: number): Unit => {
    if (units[i]) return units[i];
    const sleds: [FleetSled, FleetSled] = [fleet.make("patrol"), fleet.make("patrol")];
    const toboggan = new THREE.Group();
    const pan = new THREE.Mesh(hull, kit);
    pan.castShadow = true;
    pan.receiveShadow = true;
    toboggan.add(pan);
    const lashes = lashGeometries.map((g) => {
      const m = new THREE.Mesh(g, kit);
      m.castShadow = true;
      toboggan.add(m);
      return m;
    });
    group.add(toboggan);
    const bar = new THREE.Mesh(barGeometry, kit);
    bar.castShadow = true;
    group.add(bar);
    const crew: Patroller[] = BEARERS.map((b, j) => {
      const { colours, parts } = patrolDress(j);
      const mesh = new THREE.Mesh(dressed(bodyOf(b.body), colours, parts), material);
      mesh.morphTargetInfluences = new Array<number>(N + RIDES.length).fill(0);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.name = `patrol-sled-${i}-${j}`;
      group.add(mesh);
      const own = bodyOf(b.body).clone();
      own.morphAttributes = {};
      const down = new THREE.Mesh(dressed(own, colours, parts), material);
      down.castShadow = true;
      down.frustumCulled = false;
      down.visible = false;
      group.add(down);
      return { mesh, weights: mesh.morphTargetInfluences, down };
    });
    const litter = new THREE.Group();
    const frame = new THREE.Mesh(stretcher, kit);
    frame.castShadow = true;
    litter.add(frame);
    const straps = strapGeometries.map((g) => {
      const m = new THREE.Mesh(g, kit);
      m.castShadow = true;
      litter.add(m);
      return m;
    });
    group.add(litter);
    const u: Unit = {
      sleds,
      toboggan,
      lashes,
      bar,
      crew,
      litter,
      straps,
      casualty: null,
      dressed: "",
      lying: new THREE.Matrix4(),
      now: freshSledCrewFrame(),
      asked: freshSledCrewFrame(),
      askedAt: NaN,
    };
    units[i] = u;
    return u;
  };

  /** HIM on call `u`, in the player's colours (rebuilt when they change) —
   * or, an amateur the call came for, his own body and kit (`look`). */
  const dressCasualty = (u: Unit, look?: RescueCasualty["look"]): void => {
    const key = look ? JSON.stringify(look) : outfit ? JSON.stringify(outfit) : "none";
    if (u.casualty && u.dressed === key) return;
    if (u.casualty) {
      group.remove(u.casualty);
      u.casualty.geometry.dispose();
    }
    const fig = casualtyFigure(outfit, look);
    const mesh = new THREE.Mesh(fig.geometry, material);
    mesh.morphTargetInfluences = [1];
    mesh.matrixAutoUpdate = false;
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);
    u.casualty = mesh;
    u.lying = fig.lying;
    u.dressed = key;
  };

  const hide = (u: Unit): void => {
    for (const s of u.sleds) s.root.visible = false;
    u.toboggan.visible = false;
    u.bar.visible = false;
    u.litter.visible = false;
    if (u.casualty) u.casualty.visible = false;
    for (const c of u.crew) {
      c.mesh.visible = false;
      c.down.visible = false;
    }
  };

  // The first call's things built with the scene, so its model is in
  // before a run carries one.
  hide(unitFor(0));

  // THE CALLS this run carries, and the four of each as people on foot a
  // skier knocks over (person `4i + j` is call `i`'s patroller `j`).
  let last: GameState | null = null;
  let calls: RescueCall[] = [];
  let people: Person[] = [];
  const knocks = createKnocks();
  const clockOf = (c: RescueCall, t: number): number => t - c.start;
  const crewAt = (i: number, j: number, t: number, o: CivilianPose): CivilianPose => {
    const u = units[i];
    const c = calls[i];
    if (u.askedAt !== t) {
      sledCrewAt(level, c.sleds!, c.casualties[0], c.sledsTaken, clockOf(c, t), u.asked);
      u.askedAt = t;
    }
    const p = u.asked.crew[j];
    o.x = p.x;
    o.y = p.y;
    o.z = p.z;
    o.heading = p.heading;
    // Sat on a machine he is out of a skier's way: only those on foot.
    o.shown = p.shown && !u.asked.seats[j];
    o.activity = p.move.walking > 0.5 ? "walk" : "stand";
    o.clock = 0;
    o.span = 1;
    o.walked = 0;
    o.carry = "none";
    o.seat = null;
    o.bag = false;
    o.since = Infinity;
    return o;
  };
  const begin = (state: GameState): void => {
    calls = (state.rescue ?? []).filter((c) => c.kind === "sled" && c.sleds);
    people = [];
    calls.forEach((c, i) => {
      const u = unitFor(i);
      u.askedAt = NaN;
      const cas = c.casualties[0];
      dressCasualty(u, cas.look);
      BEARERS.forEach((b, j) =>
        people.push({
          key: 4 * i + j,
          id: 7400 + 4 * i + j,
          body: b.body,
          skis: false,
          rx: cas.x,
          rz: cas.z,
          rr: 60,
          at: (t, o) => crewAt(i, j, t, o),
        }),
      );
    });
    for (let i = calls.length; i < units.length; i++) hide(units[i]);
  };

  const feet = new THREE.Vector3();
  const eye = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, "YXZ");
  const pos = new THREE.Vector3();
  const placed = new THREE.Matrix4();
  const ONE = new THREE.Vector3(1, 1, 1);
  const pose = freshCivilianPose();
  const from = freshCivilianPose();

  /** Call `i` at the run's clock, posed. */
  const draw = (i: number, state: GameState): void => {
    const u = units[i];
    const c = calls[i];
    const now = sledCrewAt(
      level,
      c.sleds!,
      c.casualties[0],
      c.sledsTaken,
      clockOf(c, state.t),
      u.now,
    );
    const fr = now.sleds;
    // THE MACHINES.
    for (let k = 0; k < 2; k++) {
      const p = fr.sleds[k];
      const s = u.sleds[k];
      s.root.visible = p.shown;
      if (p.shown) {
        standOnSnow(level, s, p, K.sled.length);
        s.root.updateMatrixWorld(true);
      }
    }
    // THE TOBOGGAN and its bar.
    const b = fr.toboggan;
    u.toboggan.visible = b.shown;
    u.bar.visible = b.shown;
    if (b.shown) {
      bedPose(level, b, u.toboggan);
      u.toboggan.updateMatrixWorld(true);
      for (let s = 0; s < u.lashes.length; s++) u.lashes[s].visible = s < now.lashed;
      u.toboggan.localToWorld(feet.set(0, BAR_FEET.y, BAR_FEET.z));
      const tow = fr.tow === 1 ? 1 : fr.tow === 0 ? 0 : null;
      if (b.hitched > 0 && tow !== null && fr.sleds[tow].shown)
        u.sleds[tow].root.localToWorld(eye.set(0, HITCH.y, HITCH.z));
      else {
        // Unhitched: laid on the snow ahead of the nose.
        const ex = feet.x + Math.sin(b.heading) * K.toboggan.tongue;
        const ez = feet.z + Math.cos(b.heading) * K.toboggan.tongue;
        eye.set(ex, level.groundAt(ex, ez) + 0.04, ez);
      }
      u.bar.position.copy(feet);
      u.bar.lookAt(eye);
      u.bar.scale.set(1, 1, feet.distanceTo(eye));
    }
    // THE FOUR.
    for (let j = 0; j < u.crew.length; j++) {
      const cp = now.crew[j];
      const m = u.crew[j];
      const key = 4 * i + j;
      const knock = knocks.map.get(key);
      if (knock && onRagdoll(knock)) {
        m.mesh.visible = false;
        const r = knock.rag;
        const posed = knockedPose(r.points, knock.body, [r.x, r.y, r.z]);
        poseCivilianFigure(knock.body, "near", posed, m.down.geometry);
        m.down.position.set(r.x, r.y, r.z);
        m.down.visible = true;
        continue;
      }
      m.down.visible = false;
      const seat = now.seats[j];
      const on = seat ? seat.on : 0;
      let move = cp.move;
      let x = cp.x;
      let y = cp.y;
      let z = cp.z;
      let heading = cp.heading;
      let shown = cp.shown;
      if (knock) {
        walkBackPose(knock, level.groundAt(knock.bx, knock.bz), from);
        x = from.x;
        z = from.z;
        y = from.y;
        heading = from.heading;
        shown = true;
        move = { rise: 1, stride: knock.walked / RESCUE_STRIDE, walking: 1, hand: null, raise: 0 };
      } else if (knocks.home.has(key)) {
        pose.x = cp.x;
        pose.y = cp.y;
        pose.z = cp.z;
        pose.heading = cp.heading;
        const share = homeFrom(knocks, key, state.t, pose, from);
        x = pose.x;
        z = pose.z;
        heading = pose.heading;
        y = level.groundAt(x, z) + (cp.y - level.groundAt(cp.x, cp.z));
        if (share < 1) move = { ...cp.move, walking: Math.max(cp.move.walking, 1 - share) };
      }
      m.mesh.visible = shown;
      const rise = seat ? SEAT_RISE[seat.place] * on : 0;
      m.mesh.position.set(x, y - rise, z);
      m.mesh.rotation.set(0, heading, 0);
      crewDials(move, scratch);
      for (let k = 0; k < N; k++) m.weights[k] = scratch[k] * (1 - on);
      for (let r = 0; r < RIDES.length; r++) m.weights[N + r] = seat?.place === RIDES[r] ? on : 0;
    }
    // THE STRETCHER, and him.
    dressCasualty(u, c.casualties[0].look);
    const st = now.stretcher;
    u.litter.visible = st.shown;
    u.litter.position.set(st.x, st.y, st.z);
    euler.set(-st.pitch, st.heading, -st.roll, "YXZ");
    u.litter.quaternion.setFromEuler(euler);
    for (let s = 0; s < u.straps.length; s++) u.straps[s].visible = s < st.straps;
    const cs = now.casualty;
    const mesh = u.casualty!;
    mesh.visible = cs.shown;
    euler.set(-cs.pitch, cs.heading, -cs.roll, "YXZ");
    quat.setFromEuler(euler);
    placed.compose(pos.set(cs.x, cs.y, cs.z), quat, ONE);
    mesh.matrix.multiplyMatrices(placed, u.lying);
    mesh.matrixWorldNeedsUpdate = true;
    mesh.morphTargetInfluences![0] = cs.sprawl;
  };

  let clock = 0;
  const way = new THREE.Vector3();
  const lamp = new THREE.Vector3();
  return {
    group,
    ready: fleet.ready,
    frame(state) {
      if (state !== last) {
        last = state;
        begin(state);
      }
      clock = state.t;
      group.visible = calls.length > 0;
      if (!calls.length) return;
      updateKnocks(knocks, state, people);
      for (let i = 0; i < calls.length; i++) draw(i, state);
    },
    dress(o) {
      outfit = o;
    },
    lamps(lit, eyeAt, out) {
      if (!calls.length) return;
      fleet.light(clock, lit, eyeAt);
      let beacon: FleetSled | null = null;
      let nearest = Infinity;
      for (const u of units.slice(0, calls.length)) {
        for (const s of u.sleds) {
          for (const l of s.lamps) l.visible = s.root.visible && lit > 0;
          if (!s.root.visible || lit <= 0) continue;
          // THE HEADLIGHT, ahead and a little down.
          const L = SLED_LOOK.lamps;
          s.frame.localToWorld(lamp.set(0, L.y, L.z + 0.1));
          way
            .set(0, -Math.sin(HEADLIGHT.down), Math.cos(HEADLIGHT.down))
            .transformDirection(s.root.matrixWorld);
          out.push({
            x: lamp.x,
            y: lamp.y,
            z: lamp.z,
            dx: way.x,
            dy: way.y,
            dz: way.z,
            colour: LED,
            power: HEADLIGHT.power * lit,
          });
          const d = lamp.distanceTo(eyeAt);
          if (d < nearest) {
            nearest = d;
            beacon = s;
          }
        }
      }
      // THE NEAREST BEACON's sweep.
      if (beacon?.kit) {
        beacon.kit.top.getWorldPosition(lamp);
        const h = beacon.kit.beam();
        way
          .set(Math.sin(h) * 0.99, -0.12, Math.cos(h) * 0.99)
          .transformDirection(beacon.root.matrixWorld);
        out.push({
          x: lamp.x,
          y: lamp.y,
          z: lamp.z,
          dx: way.x,
          dy: way.y,
          dz: way.z,
          colour: AMBER,
          beam: BEACON_BEAM,
          power: BEACON_POWER * lit,
        });
      }
    },
    active: () => calls.length > 0,
    dispose() {
      fleet.dispose();
      for (const u of units) {
        for (const c of u.crew) {
          c.mesh.geometry.dispose();
          c.down.geometry.dispose();
        }
        u.casualty?.geometry.dispose();
      }
      hull.dispose();
      barGeometry.dispose();
      for (const g of lashGeometries) g.dispose();
      stretcher.dispose();
      for (const g of strapGeometries) g.dispose();
      material.dispose();
      kit.dispose();
    },
  };
}
