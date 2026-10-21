// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY LAB'S `steal` SHEET (`make army ARGS="--sheet=steal"`): the
// army's machines TAKEN and driven IN THE GAME (`armour.ts`,
// `army-steal.ts`) — a hunted free ride on the real engine, the hunt's own
// men held back, one machine stood for him and taken with the machine press
// exactly as a player takes it, then driven a few seconds by a script:
//
//   * `steal-carrier`: the carrier's CAB (`carrier-cab.ts`) through the
//     game's own ladder — the driver's eye (HELMET) straight and in a turn,
//     the cluster, the switches and the radio close, the driver from the
//     mate's seat — then TIPS, CHASE and a lens beside it on the move;
//   * `steal-heli`: the army helicopter's FLIGHT DECK
//     (`army-heli-cockpit.ts`) — the pilot's eye on the snow and in the
//     air, the panel, the console and the overhead close, the pilot from
//     the left seat — then CHASE and a lens beside it in flight;
//   * `steal-truck`: the truck's CAB (`truck-cab.ts`) — the driver's eye
//     straight and in a turn, the cluster, the tyres' panel and the radio,
//     the selector and the pedals, the mirror, the driver from the mate's
//     seat, back over the seats — then CHASE and beside its cab;
//   * `steal-tank`: the tank's DRIVER hatch down (`tank-driver.ts`) — his
//     eye, the vision blocks, his display, the T-bar, him from beside —
//     then the GUNNER's station (`tank-gunner.ts`) on TIPS with the turret
//     off the nose, his sight and handles, the fire control, the breech;
//     THROUGH THE SIGHT laying the gun, raised and as it fires; CHASE and
//     beside it.
//
// A shot with no lens of its own is the game's (`renderer.setCamera`); the
// close-ups are eyes planted in the machine's own frame.

import * as THREE from "three";
import {
  NEUTRAL_INPUT,
  WANTED,
  armourDoor,
  armyHeliDoor,
  callVehicles,
  fromEuler,
  heliQuat,
  nearestTrackPoint,
  rotate,
  standSkier,
  step,
  trackPointAt,
  type ArmyVehicle,
  type GameState,
  type HeliState,
  type SkierInput,
  type WantedRoster,
} from "@engine";

import { ARMY_COCKPIT } from "../game/army-cockpit-plan.ts";
import { CARRIER_CAB } from "../game/army-cab-plan.ts";
import { TANK_DRIVER, TANK_GUNNER } from "../game/tank-station-plan.ts";
import { TRUCK_CAB } from "../game/truck-cab-plan.ts";
import { bodyOf } from "../game/cockpit-plan.ts";
import type { CameraRung } from "../game/renderer-api.ts";
import type { VehicleLab } from "./army-vehicles-sheet.ts";

/** What the army harness lends the sheet: the vehicles' lab and the game's
 * own camera ladder, cut to a rung. */
export type StealLab = VehicleLab & { rung(k: CameraRung): void };

type V3 = { x: number; y: number; z: number };

const ask = (o: Partial<SkierInput> = {}): SkierInput => ({ ...NEUTRAL_INPUT, ...o });

/** The hunt held back for `fn`: no men, machines or waves of its own. */
async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const rows = WANTED.roster as WantedRoster[];
  const kept = rows.map((r) => ({ ...r }));
  const waves = WANTED.waves as (typeof WANTED.waves)[number][];
  const keptWaves = waves.slice();
  for (const r of rows) {
    r.gunners = 0;
    r.soldiers = 0;
    r.lifted = 0;
    r.snowmobiles = 0;
    r.paramotors = 0;
    r.balloons = 0;
  }
  waves.fill(null);
  try {
    return await fn();
  } finally {
    kept.forEach((r, i) => Object.assign(rows[i], r));
    keptWaves.forEach((r, i) => (waves[i] = r));
  }
}

/** One vehicle of `kind` stood 30 m down the piste from him, empty and
 * still, and him at its door. */
function standing(r: GameState, kind: ArmyVehicle["kind"]): ArmyVehicle {
  const c = r.skier;
  const p = trackPointAt(r.level, r.level.track.length * 0.25 + 30);
  const mix = {
    snowmobiles: 0,
    foot: 0,
    tracked: kind === "carrier" ? 1 : 0,
    trucks: kind === "truck" ? 1 : 0,
    tanks: kind === "tank" ? 1 : 0,
  };
  const far = { x: p.x + 400 * Math.sin(p.heading), z: p.z + 400 * Math.cos(p.heading), w: 12 };
  callVehicles(r, r.army!, r.wanted!, mix, 0, [{ x: p.x, z: p.z, w: 12 }, far], [0, 400], 0, []);
  const v = r.army!.vehicles.at(-1)!;
  Object.assign(v, {
    mode: kind === "tank" ? "halt" : "park",
    due: 0,
    t: 0,
    x: p.x,
    z: p.z,
    y: r.level.groundAt(p.x, p.z),
    heading: p.heading,
    rear: p.heading,
    speed: 0,
    aboard: 0,
    next: Infinity,
  });
  const d = armourDoor(v);
  standSkier(r, d.x, d.z, c.heading);
  return v;
}

function run(r: GameState, seconds: number, input: (r: GameState) => SkierInput): void {
  for (let i = 0; i < seconds * 120; i++) step(r, input(r));
}

/** The vehicle's frame: a point of its body (x the engine's right, y up off
 * the snow, z forward) in the world. */
function onVehicle(v: ArmyVehicle, p: V3): THREE.Vector3 {
  const o = rotate(fromEuler(v.heading, v.pitch, v.roll), p);
  return new THREE.Vector3(v.x + o.x, v.y + o.y, v.z + o.z);
}

/** The helicopter's frame, a point of the deck's plan (picture x). */
function onHeli(h: HeliState, p: V3): THREE.Vector3 {
  const o = rotate(heliQuat(h), bodyOf(p));
  return new THREE.Vector3(h.x + o.x, h.y + o.y, h.z + o.z);
}

/** The drive down the piste: the tuck, the edge laid at the piste ahead. */
function down(steer = 0) {
  return (r: GameState): SkierInput => {
    const b = r.armour!.body;
    const p = trackPointAt(
      r.level,
      Math.min(r.level.track.length, nearestTrackPoint(r.level, b.x, b.z).s + 40),
    );
    const want = Math.atan2(p.x - b.x, p.z - b.z);
    let turn = want - b.heading;
    turn = Math.atan2(Math.sin(turn), Math.cos(turn));
    return ask({ tuck: 1, steer: steer || Math.max(-1, Math.min(1, turn * 2)) });
  };
}

export function stealViews(lab: StealLab): Record<string, () => Promise<void>> {
  /** The game's lens on a rung, settled a few frames first. */
  const game = (
    r: GameState,
    k: CameraRung,
    label: string,
    note: string,
    input: (r: GameState) => SkierInput = () => NEUTRAL_INPUT,
  ) => {
    lab.rung(k);
    // A change of ladder flies the lens across on the run's own clock
    // (`camera.ts`' hand-over): the run is stepped on as it settles.
    for (let i = 0; i < 16; i++) {
      run(r, 0.1, input);
      lab.frame(r, 0.1);
    }
    lab.shoot(label, null, note, r);
  };
  const noteOf = (r: GameState) => {
    const b = r.armour?.body;
    const h = r.heli;
    const what = b
      ? `${b.kind} ${(b.speed * 3.6).toFixed(0)} km/h`
      : `${h?.livery ?? "?"} helicopter ${(Math.hypot(h?.vx ?? 0, h?.vz ?? 0) * 3.6).toFixed(0)} km/h`;
    return `${lab.note(r)} · ${what} · heat ${r.wanted?.heat.toFixed(1)}`;
  };
  const start = () => lab.groundRun(3, false, (g) => g.t > 0.5, 10, lab.at);

  const carrier = () =>
    quiet(async () => {
      const r = await start();
      if (!r) return;
      standing(r, "carrier");
      step(r, ask({ machine: true }));
      if (!r.armour?.rider) throw new Error("the carrier was not taken");
      run(r, 4, down());
      const v = r.armour.body;
      const n = noteOf(r);
      game(r, "helmet", "the driver's eye (HELMET)", n, down());
      run(r, 1.2, down(1));
      game(r, "helmet", "in a turn to the right", noteOf(r), down(1));
      const E = CARRIER_CAB.eye;
      const eye = onVehicle(v, E);
      lab.shoot("the cluster", lab.look(eye, onVehicle(v, { x: E.x, y: 1.33, z: 0.27 }), 34), n, r);
      lab.shoot(
        "the switches and the radio",
        lab.look(eye, onVehicle(v, { x: -0.2, y: 1.45, z: 0.3 }), 50),
        n,
        r,
      );
      lab.shoot(
        "the driver from the mate's seat",
        lab.look(
          onVehicle(v, { x: -0.45, y: 1.98, z: -0.75 }),
          onVehicle(v, { x: E.x, y: 1.55, z: -0.05 }),
          62,
        ),
        n,
        r,
      );
      game(r, "tips", "TIPS", n, down());
      game(r, "chase", "CHASE", n, down());
      const at = onVehicle(v, { x: 0, y: 1.4, z: 0 });
      lab.shoot("beside it", lab.look(onVehicle(v, { x: 9, y: 2.5, z: 4 }), at, 50), n, r);
    });

  const heli = () =>
    quiet(async () => {
      const r = await start();
      if (!r) return;
      const m = r.army?.helis[0];
      if (!m || !r.heli) return;
      // Set down on the flattest snow near him, stood on its lean.
      const c = r.skier;
      const nrm = { x: 0, y: 1, z: 0 };
      let site = { x: c.x + 30, z: c.z, lean: Infinity };
      for (let dx = -150; dx <= 150; dx += 6)
        for (let dz = -150; dz <= 150; dz += 6) {
          r.level.normalAt(c.x + dx, c.z + dz, nrm);
          const lean = Math.acos(Math.min(1, nrm.y)) + Math.hypot(dx, dz) * 2e-5;
          if (lean < site.lean) site = { x: c.x + dx, z: c.z + dz, lean };
        }
      Object.assign(m, { phase: "set", x: site.x, z: site.z, vx: 0, vy: 0, vz: 0 });
      Object.assign(m, { y: r.level.groundAt(site.x, site.z), pitch: 0, roll: 0, spool: 1 });
      const d = armyHeliDoor(m);
      standSkier(r, d.x, d.z, m.heading);
      step(r, ask({ machine: true }));
      const h = r.heli;
      if (!h?.rider || h.livery !== "army") throw new Error("the helicopter was not taken");
      for (let i = 0; i < 40; i++) lab.frame(r, 1 / 60);
      const n0 = noteOf(r);
      game(r, "helmet", "the pilot's eye on the snow (HELMET)", n0);
      const E = ARMY_COCKPIT.eye;
      const eye = onHeli(h, E);
      const P = ARMY_COCKPIT.panel;
      lab.shoot(
        "his panel",
        lab.look(eye, onHeli(h, { x: E.x, y: (P.bottom + P.top) / 2, z: P.z }), 45),
        n0,
        r,
      );
      lab.shoot(
        "the console between the seats",
        lab.look(eye, onHeli(h, { x: 0, y: ARMY_COCKPIT.console.top, z: 3.1 }), 55),
        n0,
        r,
      );
      lab.shoot(
        "the overhead",
        lab.look(eye, onHeli(h, { x: 0, y: ARMY_COCKPIT.overhead.y, z: 2.7 }), 60),
        n0,
        r,
      );
      lab.shoot(
        "the pilot from the left seat",
        lab.look(
          onHeli(h, { x: -E.x, y: E.y, z: E.z - 0.25 }),
          onHeli(h, { x: E.x, y: E.y - 0.35, z: E.z + 0.35 }),
          60,
        ),
        n0,
        r,
      );
      // Up off the snow and forward.
      const fly = (g: GameState): SkierInput => {
        const q = g.heli!;
        const agl = q.y - g.level.groundAt(q.x, q.z);
        const collective = Math.max(0, Math.min(1, 0.6 + (40 - agl) * 0.02 - q.vy * 0.1));
        const nose = agl > 25 ? -0.12 : 0;
        const pitch = Math.max(-1, Math.min(1, (q.pitch - nose) * 3));
        return ask({ heli: { collective, pitch, roll: -q.roll * 3, pedal: 0 } });
      };
      run(r, 12, fly);
      const n = noteOf(r);
      game(r, "helmet", "the pilot's eye in flight", n, fly);
      game(r, "chase", "CHASE", n, fly);
      const at = onHeli(h, { x: 0, y: 1.5, z: 0 });
      lab.shoot("beside it", lab.look(onHeli(h, { x: -16, y: 3, z: 6 }), at, 50), n, r);
    });

  const truck = () =>
    quiet(async () => {
      const r = await start();
      if (!r) return;
      standing(r, "truck");
      step(r, ask({ machine: true }));
      if (!r.armour?.rider) throw new Error("the truck was not taken");
      run(r, 4, down());
      const v = r.armour.body;
      const n = noteOf(r);
      game(r, "helmet", "the driver's eye (HELMET)", n, down());
      run(r, 1.2, down(1));
      game(r, "helmet", "in a turn to the right", noteOf(r), down(1));
      const E = TRUCK_CAB.eye;
      const eye = onVehicle(v, E);
      lab.shoot("the cluster", lab.look(eye, onVehicle(v, { x: E.x, y: 2.06, z: 3.73 }), 30), n, r);
      lab.shoot(
        "the tyres' panel and the radio",
        lab.look(eye, onVehicle(v, { x: -0.3, y: 2.03, z: 3.72 }), 46),
        n,
        r,
      );
      lab.shoot(
        "the selector, the transfer box and the pedals",
        lab.look(
          onVehicle(v, { x: -0.35, y: 2.55, z: 2.75 }),
          onVehicle(v, { x: 0.3, y: 1.6, z: 3.35 }),
          60,
        ),
        n,
        r,
      );
      const M = TRUCK_CAB.mirror;
      lab.shoot(
        "the mirror on his side",
        lab.look(eye, onVehicle(v, { x: M.x, y: M.y, z: M.z }), 40),
        n,
        r,
      );
      lab.shoot(
        "the driver from the mate's seat",
        lab.look(
          onVehicle(v, { x: -0.6, y: 2.7, z: 2.9 }),
          onVehicle(v, { x: E.x, y: 2.2, z: 3.2 }),
          64,
        ),
        n,
        r,
      );
      lab.shoot(
        "back over the seats",
        lab.look(
          onVehicle(v, { x: 0, y: 2.6, z: 3.6 }),
          onVehicle(v, { x: 0, y: 2.3, z: 2.2 }),
          70,
        ),
        n,
        r,
      );
      game(r, "chase", "CHASE", n, down());
      const at = onVehicle(v, { x: 0, y: 2.2, z: 2.5 });
      lab.shoot("beside its cab", lab.look(onVehicle(v, { x: 8, y: 3.2, z: 6.5 }), at, 50), n, r);
    });

  const tank = () =>
    quiet(async () => {
      const r = await start();
      if (!r) return;
      standing(r, "tank");
      step(r, ask({ machine: true }));
      if (!r.armour?.rider) throw new Error("the tank was not taken");
      run(r, 4, down());
      const v = r.armour.body;
      const n = noteOf(r);
      game(r, "helmet", "the driver hatch down (HELMET)", n, down());
      const D = TANK_DRIVER.eye;
      const eye = onVehicle(v, D);
      lab.shoot(
        "the vision blocks",
        lab.look(eye, onVehicle(v, { x: D.x, y: 1.4, z: D.z + 1 }), 50),
        n,
        r,
      );
      lab.shoot(
        "his display and panel",
        lab.look(eye, onVehicle(v, { x: -0.07, y: 1.05, z: D.z + 0.05 }), 55),
        n,
        r,
      );
      lab.shoot(
        "the T-bar and the pedal",
        lab.look(eye, onVehicle(v, { x: D.x, y: 0.85, z: D.z + 0.35 }), 70),
        n,
        r,
      );
      lab.shoot(
        "the driver from beside",
        lab.look(
          onVehicle(v, { x: 0.05, y: 1.35, z: TANK_DRIVER.room.back + 0.1 }),
          onVehicle(v, { x: D.x, y: 0.95, z: D.z + 0.1 }),
          72,
        ),
        n,
        r,
      );
      // The turret swung off the nose a little, then the gunner's station.
      run(r, 1.2, (g) => ({ ...down()(g), lean: -0.6 }));
      run(r, 1.6, down());
      const nt = `${noteOf(r)} · turret ${((v.turret * 180) / Math.PI).toFixed(0)}°`;
      game(r, "tips", "the gunner's station (TIPS)", nt, down());
      const q = fromEuler(v.heading + v.turret, v.pitch, v.roll);
      const onTurret = (p: V3) => {
        const o = rotate(q, p);
        return new THREE.Vector3(v.x + o.x, v.y + o.y, v.z + o.z);
      };
      const G = TANK_GUNNER.eye;
      lab.shoot(
        "the sight and the handles",
        lab.look(onTurret(G), onTurret({ x: 0.9, y: 1.95, z: 0.4 }), 46),
        nt,
        r,
      );
      lab.shoot("the fire control", lab.look(onTurret(G), onTurret(TANK_GUNNER.panel), 40), nt, r);
      lab.shoot(
        "the breech and its guard",
        lab.look(onTurret({ x: 1.2, y: 2.2, z: -0.7 }), onTurret({ x: 0.1, y: 2.1, z: 0.4 }), 70),
        nt,
        r,
      );
      // Laying the gun: the trick key held, the lean raising it.
      const lay =
        (lean: number, jump = false) =>
        () =>
          ask({ trick: true, lean, jump });
      game(r, "tips", "through the sight, laying", nt, lay(0));
      game(r, "tips", "the gun raised", noteOf(r), lay(-0.6));
      step(r, lay(0, true)());
      game(r, "tips", "fired", noteOf(r), lay(0));
      game(r, "chase", "CHASE", noteOf(r), down());
      const at = onVehicle(v, { x: 0, y: 2.0, z: 0.5 });
      lab.shoot(
        "beside it, the turret off the nose",
        lab.look(onVehicle(v, { x: -12, y: 3.5, z: 7 }), at, 50),
        noteOf(r),
        r,
      );
    });

  return { "steal-carrier": carrier, "steal-heli": heli, "steal-truck": truck, "steal-tank": tank };
}

/** The sheet's views, as the harness lists them. */
export const STEAL_VIEWS = ["steal-carrier", "steal-heli", "steal-truck", "steal-tank"] as const;
