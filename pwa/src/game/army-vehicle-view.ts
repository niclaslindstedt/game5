// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE GROUND WAVES' VEHICLES AS DRAWN IN THE RUN — every carrier, truck and
// tank the engine drives up the mountain (`army-vehicle.ts`,
// `ArmyState.vehicles`) drawn off the parts `army-vehicle-shapes.ts` builds,
// where the engine has it this frame (carried on its way by the share of a
// step the picture is past the state) and leaned to the ground's attitude
// the engine read under it: the carrier's rear unit behind its hitch on its
// own heading (`rearOf`), the tank's turret turned and its gun laid where
// the engine lays them, the gun run back in its cradle the moment it fires
// and run out again, a commander up in his hatch. Their tracks and tyres
// press their prints into the snow (the trail map's stamps), the tracks
// throw a little snow off their backs, and the main gun's blast kicks the
// snow up round the tank.
//
// Built with the army's air (`army-air-view.ts`); presentation only — it
// reads the state and writes nothing.

import * as THREE from "three";
import {
  ARMY_VEHICLE,
  armyQuat,
  armyVehicles,
  rearOf,
  type ArmyVehicle,
  type GameState,
} from "@engine";

import type { SnowCloud } from "./snow-cloud.ts";
import type { Stamp } from "./trail-stamp.ts";
import { TANK_GUN, vehicleGeometry } from "./army-vehicle-shapes.ts";

/** THE PRINTS each kind presses: how far out from its middle each track or
 * wheel line runs, m, how wide it is, and how deep it cuts. */
const PRINTS = {
  carrier: { off: ARMY_VEHICLE.kinds.carrier.halfWidth - 0.31, half: 0.31, depth: 0.08 },
  truck: { off: ARMY_VEHICLE.kinds.truck.halfWidth - 0.25, half: 0.21, depth: 0.1 },
  tank: { off: ARMY_VEHICLE.kinds.tank.halfWidth - 0.4, half: 0.32, depth: 0.12 },
} as const;

/** How far the gun runs back when it fires, m, and how fast it runs out
 * again, 1/s. */
const RECOIL = { back: 0.55, out: 5 };
/** How many puffs a second a track throws at cruise, and their size, m. */
const KICK = { rate: 14, size: 1.1 };
/** The main gun's blast on the snow round it: the puffs and their size. */
const BLAST = { puffs: 18, size: 2.6 };

type Drawn = {
  root: THREE.Group;
  rear: THREE.Group | null;
  turret: THREE.Group | null;
  gun: THREE.Group | null;
  barrel: THREE.Mesh | null;
  kind: ArmyVehicle["kind"];
  /** The last print each side (x, z), NaN before the first. */
  pen: number[];
  /** The rear unit's prints for a carrier. */
  penRear: number[];
  kick: number;
  /** Which track threw the last puff, ±1. */
  side: number;
  fired: number;
  seen: number;
};

export type ArmyVehicleView = {
  group: THREE.Group;
  /** Draw `state`'s wave vehicles, `alpha` the share of a step (`simDt` s)
   * the picture is past it, `dt` s of the picture on; their prints into
   * `stamps` (when the trails are drawn), their snow into `cloud`. */
  frame(
    state: GameState,
    alpha: number,
    dt: number,
    simDt: number,
    stamps: Stamp[] | null,
    cloud: SnowCloud | null,
  ): void;
  dispose(): void;
};

export function createArmyVehicleView(material: THREE.Material): ArmyVehicleView {
  const group = new THREE.Group();
  group.name = "army-vehicles";
  const geo = vehicleGeometry();
  const drawn = new Map<number, Drawn>();
  const spare: Record<ArmyVehicle["kind"], Drawn[]> = { carrier: [], truck: [], tank: [] };
  let owner: GameState | null = null;
  let frameNo = 0;

  const mesh = (g: THREE.BufferGeometry, parent: THREE.Object3D): THREE.Mesh => {
    const m = new THREE.Mesh(g, material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };

  const build = (kind: ArmyVehicle["kind"]): Drawn => {
    const root = new THREE.Group();
    root.name = `army-${kind}`;
    group.add(root);
    let rear: THREE.Group | null = null;
    let turret: THREE.Group | null = null;
    let gun: THREE.Group | null = null;
    let barrel: THREE.Mesh | null = null;
    if (kind === "carrier") {
      mesh(geo.carrierFront, root);
      mesh(geo.commander, root).position.set(0, 2.33, -0.6);
      rear = new THREE.Group();
      rear.name = "army-carrier-rear";
      mesh(geo.carrierRear, rear);
      group.add(rear);
    } else if (kind === "truck") {
      mesh(geo.truck, root);
    } else {
      mesh(geo.tankHull, root);
      turret = new THREE.Group();
      root.add(turret);
      mesh(geo.tankTurret, turret);
      mesh(geo.commander, turret).position.set(0.75, 2.83, -0.6);
      gun = new THREE.Group();
      gun.position.set(0, TANK_GUN.y, TANK_GUN.z);
      turret.add(gun);
      barrel = mesh(geo.tankGun, gun);
    }
    return {
      root,
      rear,
      turret,
      gun,
      barrel,
      kind,
      pen: [NaN, 0, NaN, 0],
      penRear: [NaN, 0, NaN, 0],
      kick: 0,
      side: 1,
      fired: -Infinity,
      seen: frameNo,
    };
  };

  const take = (v: ArmyVehicle): Drawn => {
    let d = drawn.get(v.id);
    if (d && d.kind === v.kind) return d;
    if (d) drop(v.id);
    d = spare[v.kind].pop() ?? build(v.kind);
    d.root.visible = true;
    if (d.rear) d.rear.visible = true;
    d.pen.fill(NaN);
    d.penRear.fill(NaN);
    d.fired = v.fired;
    drawn.set(v.id, d);
    return d;
  };

  const drop = (id: number): void => {
    const d = drawn.get(id);
    if (!d) return;
    d.root.visible = false;
    if (d.rear) d.rear.visible = false;
    drawn.delete(id);
    spare[d.kind].push(d);
  };

  /** Press a pair of prints from `pen`'s last to (x, z) facing `h`. */
  const press = (
    stamps: Stamp[],
    pen: number[],
    x: number,
    z: number,
    h: number,
    p: (typeof PRINTS)[keyof typeof PRINTS],
  ): void => {
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    for (let b = 0; b < 2; b++) {
      const s = b === 0 ? -1 : 1;
      const px = x + fz * p.off * s;
      const pz = z - fx * p.off * s;
      const lx = pen[b * 2];
      const lz = pen[b * 2 + 1];
      const far = Math.hypot(px - lx, pz - lz);
      if (Number.isNaN(lx) || far > 8) {
        pen[b * 2] = px;
        pen[b * 2 + 1] = pz;
      } else if (far > 0.6) {
        stamps.push({
          ax: lx,
          az: lz,
          bx: px,
          bz: pz,
          half: p.half,
          depth: p.depth,
          berm: p.depth * 0.4,
          wall: 1,
        });
        pen[b * 2] = px;
        pen[b * 2 + 1] = pz;
      }
    }
  };

  return {
    group,
    frame(state, alpha, dt, simDt, stamps, cloud) {
      frameNo++;
      if (owner !== state) {
        owner = state;
        for (const id of [...drawn.keys()]) drop(id);
      }
      const ahead = alpha * simDt;
      const level = state.level;
      for (const v of armyVehicles(state)) {
        const d = take(v);
        d.seen = frameNo;
        const fx = Math.sin(v.heading);
        const fz = Math.cos(v.heading);
        const x = v.x + fx * v.speed * ahead;
        const z = v.z + fz * v.speed * ahead;
        const q = armyQuat(v);
        d.root.position.set(x, level.groundAt(x, z), z);
        d.root.quaternion.set(q.x, q.y, q.z, q.w);
        if (d.rear) {
          const r = rearOf({ x, z, heading: v.heading, rear: v.rear });
          const rq = armyQuat({ heading: v.rear, pitch: v.pitch, roll: v.roll });
          d.rear.position.set(r.x, level.groundAt(r.x, r.z), r.z);
          d.rear.quaternion.set(rq.x, rq.y, rq.z, rq.w);
          if (stamps) press(stamps, d.penRear, r.x, r.z, v.rear, PRINTS.carrier);
        }
        if (d.turret && d.gun && d.barrel) {
          d.turret.rotation.y = v.turret;
          // Knocked out, the gun drooped on its trunnions.
          d.gun.rotation.x = v.mode === "wreck" ? 0.12 : -v.gun;
          // THE RECOIL: run back as it fires, run out again.
          const since = state.t - v.fired;
          d.barrel.position.z = since >= 0 ? -RECOIL.back * Math.exp(-since * RECOIL.out) : 0;
          // THE BLAST ON THE SNOW: kicked up round the tank as it fires.
          if (cloud && v.fired !== d.fired && since >= 0 && since < 0.5) {
            const yaw = v.heading + v.turret;
            const mx = Math.sin(yaw);
            const mz = Math.cos(yaw);
            for (let i = 0; i < BLAST.puffs; i++) {
              const a = (i / BLAST.puffs) * Math.PI * 2;
              const px = x + mx * 5 + Math.cos(a) * 3;
              const pz = z + mz * 5 + Math.sin(a) * 3;
              cloud.blow(
                px,
                level.groundAt(px, pz) + 0.4,
                pz,
                Math.cos(a) * 6 + mx * 4,
                1.5 + (i % 3),
                Math.sin(a) * 6 + mz * 4,
                BLAST.size,
              );
            }
          }
        }
        d.fired = v.fired;
        if (stamps) press(stamps, d.pen, x, z, v.heading, PRINTS[v.kind]);
        // THE TRACKS' SNOW: thrown off their backs as they go.
        const pace = Math.abs(v.speed);
        if (cloud && d.kind !== "truck" && pace > 1 && dt > 0) {
          d.kick += KICK.rate * dt * Math.min(1, pace / 10);
          const L = ARMY_VEHICLE.kinds[d.kind].halfLength;
          const P = PRINTS[d.kind];
          while (d.kick >= 1) {
            d.kick -= 1;
            d.side = -d.side;
            const s = d.side;
            const bx = x - fx * L + fz * P.off * s;
            const bz = z - fz * L - fx * P.off * s;
            cloud.blow(bx, level.groundAt(bx, bz) + 0.3, bz, -fx * 1.2, 0.6, -fz * 1.2, KICK.size);
          }
        }
      }
      for (const [id, d] of drawn) if (d.seen !== frameNo) drop(id);
    },
    dispose() {
      for (const id of [...drawn.keys()]) drop(id);
      // The geometry is shared and built once; it lives as long as the page.
      group.clear();
    },
  };
}
