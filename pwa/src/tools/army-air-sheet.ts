// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY LAB'S `air` SHEET (`make army ARGS="--sheet=air"`): the army's
// PARAMOTORS AND BALLOONS in the game (`army-air.ts`, drawn by
// `army-craft-view.ts` off the free ride's own paramotor and balloon) — a
// hunted free ride on the real engine at five stars, him stood still, the
// air alone (the rest of the roster and the ground waves held back):
//
//   * `air-para`: the riflemen circling him — beside one in the air, from
//     under its wing, from him up at them, wide;
//   * `air-balloon`: a balloon come in on the wind — its basket and its
//     rocketeers close, beside it, from him up at it;
//   * `air-rocket`: a rocket fired off a basket — in flight with its smoke
//     trail hanging behind it, its burst in the snow, and wide;
//   * `air-wreck`: a carrier knocked out by a rocket's burst, burning.
//
// The army harness hands over its own lenses and its run (`VehicleLab`).

import * as THREE from "three";
import {
  ARMY_WAVE,
  NEUTRAL_INPUT,
  WANTED,
  armyBalloons,
  armyParas,
  burstOnArmy,
  callVehicles,
  step,
  type GameState,
  type GunfireEvent,
  type WantedRoster,
} from "@engine";

import type { VehicleLab } from "./army-vehicles-sheet.ts";

/** The air alone for the length of `fn`: the roster's men and the waves
 * held back, its fire as `fire`; put back after. */
async function alone<T>(fire: WantedRoster["fire"], fn: () => Promise<T>): Promise<T> {
  const rows = WANTED.roster as WantedRoster[];
  const kept = rows.map((r) => ({ ...r }));
  const waves = WANTED.waves as (typeof WANTED.waves)[number][];
  const keptWaves = waves.slice();
  const W = ARMY_WAVE as { sleds: number };
  const keptSleds = W.sleds;
  for (const r of rows) {
    r.gunners = 0;
    r.soldiers = 0;
    r.lifted = 0;
    r.snowmobiles = 0;
    if (r.fire !== "hold") r.fire = fire;
  }
  waves.fill(null);
  W.sleds = 0;
  try {
    return await fn();
  } finally {
    kept.forEach((r, i) => Object.assign(rows[i], r));
    keptWaves.forEach((r, i) => (waves[i] = r));
    W.sleds = keptSleds;
  }
}

/** A lens `d` m from `c` on the bearing `h` (rad), `up` m over it, kept
 * `clear` m over the snow. */
function off(r: GameState, c: THREE.Vector3, h: number, d: number, up: number, clear = 2) {
  const v = new THREE.Vector3(c.x + Math.sin(h) * d, c.y + up, c.z + Math.cos(h) * d);
  v.y = Math.max(v.y, r.level.groundAt(v.x, v.z) + clear);
  return v;
}

function noteOf(lab: VehicleLab, r: GameState): string {
  const air = r.army?.air;
  const ps = armyParas(r).filter((p) => p.mode === "fly").length;
  const bs = armyBalloons(r).filter((m) => m.mode === "fly").length;
  return `${lab.note(r)} · ${ps} paramotors, ${bs} balloons up · ${air?.rockets ?? 0} rockets`;
}

/** Step for `seconds` (or until `until`), drawing a frame every `every`
 * steps (0: none) so the smoke the drawing lays as it goes is laid — a
 * software renderer's frame is slow, so as few as the trail needs. */
function fly(
  lab: VehicleLab,
  r: GameState,
  seconds: number,
  every: number,
  until?: (r: GameState) => boolean,
): void {
  for (let i = 0; i < seconds * 120; i++) {
    step(r, NEUTRAL_INPUT);
    if (every > 0 && i % every === 0) lab.frame(r, every / 120);
    if (until?.(r)) return;
  }
}

export function airViews(lab: VehicleLab): Record<string, () => Promise<void>> {
  const him = (r: GameState) => new THREE.Vector3(r.skier.x, r.skier.y + 1.5, r.skier.z);

  /** The riflemen circling him. */
  const para = () =>
    alone("warn", async () => {
      const r = await lab.groundRun(
        5,
        true,
        (g) =>
          armyParas(g).filter(
            (p) => p.mode === "fly" && Math.hypot(p.x - g.skier.x, p.z - g.skier.z) < 260,
          ).length >= 2,
        200,
        lab.at,
      );
      if (!r) return;
      fly(lab, r, 1, 30);
      const n = noteOf(lab, r);
      const q = him(r);
      const ps = armyParas(r)
        .filter((p) => p.mode === "fly")
        .sort((a, b) => Math.hypot(a.x - q.x, a.z - q.z) - Math.hypot(b.x - q.x, b.z - q.z));
      const p = ps[0];
      const at = new THREE.Vector3(p.wing.x, (p.wing.y + p.y) / 2, p.wing.z);
      const h = p.wing.heading;
      lab.shoot("beside", lab.look(off(r, at, h + Math.PI / 2 + 0.4, 16, 1), at, 50), n, r);
      lab.shoot("ahead", lab.look(off(r, at, h + 0.35, 18, -1), at, 50), n, r);
      lab.shoot(
        "under the wing",
        lab.look(new THREE.Vector3(p.x, p.y - 9, p.z).add(new THREE.Vector3(5, 0, 3)), at, 60),
        n,
        r,
      );
      lab.shoot("from him", lab.look(q, at, 55), n, r);
      const mid = q.clone().lerp(at, 0.5);
      lab.shoot("wide", lab.look(off(r, mid, h + 2.2, 260, 60), mid, 50), n, r);
    });

  /** A balloon come in on the wind. */
  const balloon = () =>
    alone("warn", async () => {
      const r = await lab.groundRun(
        5,
        true,
        (g) =>
          armyBalloons(g).some(
            (m) => m.mode === "fly" && Math.hypot(m.body.x - g.skier.x, m.body.z - g.skier.z) < 320,
          ),
        300,
        lab.at,
      );
      if (!r) return;
      fly(lab, r, 1, 30);
      const n = noteOf(lab, r);
      const m = armyBalloons(r).find((x) => x.mode === "fly")!;
      const b = m.body;
      const basket = new THREE.Vector3(b.x, b.y + 1.2, b.z);
      const mid = new THREE.Vector3(b.x, b.y + 14, b.z);
      const toHim = Math.atan2(r.skier.x - b.x, r.skier.z - b.z);
      lab.shoot("the basket", lab.look(off(r, basket, toHim + 0.5, 7, 1.5), basket, 50), n, r);
      lab.shoot("beside", lab.look(off(r, mid, toHim + 1.4, 55, 2), mid, 50), n, r);
      lab.shoot("from him", lab.look(him(r), mid, 45), n, r);
    });

  /** A rocket fired off a basket, its trail and its burst. */
  const rocket = () =>
    alone("aim", async () => {
      const r = await lab.groundRun(
        5,
        true,
        (g) =>
          armyBalloons(g).some(
            (m) => m.mode === "fly" && Math.hypot(m.body.x - g.skier.x, m.body.z - g.skier.z) < 360,
          ),
        300,
        lab.at,
      );
      if (!r) return;
      // Up to the launch, drawn as it goes.
      let launched = false;
      fly(
        lab,
        r,
        30,
        0,
        (g) => (launched = g.events.some((e) => e.kind === "army-air" && e.change === "rocket")),
      );
      if (!launched) return;
      const m = armyBalloons(r).find((x) => x.mode === "fly")!;
      const from = new THREE.Vector3(m.body.x, m.body.y + 1.5, m.body.z);
      // Drawn every other step, so the trail is laid as the game lays it.
      fly(lab, r, 0.9, 2);
      const round = r.gunfire?.rounds.find((x) => x.weapon === "rocket");
      const n = noteOf(lab, r);
      if (round) {
        const at = new THREE.Vector3(round.x, round.y, round.z);
        const toward = Math.atan2(round.vx, round.vz);
        // Side on, far enough back to hold the basket and the rocket both.
        const span = from.distanceTo(at);
        const mid = from.clone().lerp(at, 0.55);
        const side = off(r, mid, toward + Math.PI / 2, Math.max(40, span * 1.15), 4);
        lab.shoot("in flight", lab.look(side, mid, 50), n, r);
        lab.shoot(
          "behind it",
          lab.look(
            off(r, at, toward + Math.PI + 0.25, 14, 3),
            at
              .clone()
              .addScaledVector(new THREE.Vector3(round.vx, round.vy, round.vz).normalize(), 30),
            50,
          ),
          n,
          r,
        );
      }
      let burst: GunfireEvent | null = null;
      fly(lab, r, 6, 2, (g) => {
        for (const e of g.events)
          if (e.kind === "gunfire" && e.phase === "blast" && e.weapon === "rocket") burst = e;
        return !!burst;
      });
      if (!burst) return;
      const b = burst as GunfireEvent;
      fly(lab, r, 0.12, 6);
      const blast = new THREE.Vector3(b.x, b.y + 1.5, b.z);
      const toward = Math.atan2(blast.x - from.x, blast.z - from.z);
      const n2 = `${noteOf(lab, r)} · the burst ${Math.hypot(b.x - r.skier.x, b.z - r.skier.z).toFixed(0)} m from him`;
      lab.shoot("the burst", lab.look(off(r, blast, toward + 1.6, 26, 5), blast, 50), n2, r);
      const mid = from.clone().lerp(blast, 0.5);
      lab.shoot(
        "the trail and the burst",
        lab.look(off(r, mid, toward + 1.5, 140, 30), mid, 55),
        n2,
        r,
      );
    });

  /** A carrier knocked out by a burst, burning. */
  const wreck = () =>
    alone("hold", async () => {
      const r = await lab.groundRun(5, true, (g) => g.t > 1, 10, lab.at);
      if (!r) return;
      const c = r.skier;
      const h = lab.at.heading;
      const fx = Math.sin(h);
      const fz = Math.cos(h);
      const way = [];
      const path = [];
      for (let d = 0; d <= 300; d += 8) {
        way.push({ x: c.x - fx * d, z: c.z - fz * d, w: 12 });
        path.push(d);
      }
      callVehicles(
        r,
        r.army!,
        r.wanted!,
        { snowmobiles: 0, foot: 0, tracked: 1, trucks: 0, tanks: 0 },
        0,
        way,
        path,
        0,
        [],
      );
      const v = r.army!.vehicles[0];
      v.x = c.x - fx * 30;
      v.z = c.z - fz * 30;
      v.y = r.level.groundAt(v.x, v.z);
      v.mode = "park";
      v.heading = h + 0.4;
      v.rear = v.heading - 0.2;
      v.aboard = 0;
      lab.frame(r, 1 / 60);
      burstOnArmy(r, v.x, v.y + 1.2, v.z, []);
      fly(lab, r, 2.5, 20);
      const at = new THREE.Vector3(v.x, v.y + 1.6, v.z);
      const n = `${noteOf(lab, r)} · knocked out (${v.mode})`;
      lab.shoot("burning", lab.look(off(r, at, v.heading + 1.2, 14, 3), at, 50), n, r);
      lab.shoot("wide", lab.look(off(r, at, v.heading - 2.0, 40, 10), at, 50), n, r);
    });

  return { "air-para": para, "air-balloon": balloon, "air-rocket": rocket, "air-wreck": wreck };
}

/** The sheet's views, as the harness lists them. */
export const AIR_VIEWS = ["air-para", "air-balloon", "air-rocket", "air-wreck"] as const;
