// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY LAB'S `waves` SHEET (`make army ARGS="--sheet=waves"`): the
// ground waves IN THE GAME (`army-wave.ts`, drawn by `army-ground-view.ts`
// and its batches) — a hunted free ride on the real engine at five stars,
// him stood still, the waves alone (the roster's door gunners, squads and
// lifts held back for the scene, so the hunt lasts long enough for the
// columns to come):
//
//   * `wave-climb`: a column climbing a run toward him, from beside it,
//     from its head and wide from high over the run;
//   * `wave-mass`: three waves out, the mountain below him soldiers —
//     wide from over him, from behind them and from high above;
//   * `wave-arrest`: SAFE FOR WORK, him taken by a man of a wave, the
//     rest come up round him.
//
// The army harness hands over its own lenses and its run (`WaveLab`).

import * as THREE from "three";
import {
  ARMY_WAVE,
  WANTED,
  armyTroops,
  arrestedOf,
  type GameState,
  type Soldier,
  type WantedRoster,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";

/** What the army harness lends the sheet. */
export type WaveLab = {
  groundRun(
    stars: number,
    sfw: boolean,
    until: (run: GameState) => boolean,
    most?: number,
    at?: { x: number; z: number; heading: number },
  ): Promise<GameState | null>;
  /** A lens round a point clear of the boughs (the harness's). */
  clearRound(
    c: THREE.Vector3,
    facing: number,
    bearing: number,
    d: number,
    up: number,
    fov?: number,
  ): LensPose;
  /** Where he is stood: open piste down the mountain. */
  at: { x: number; z: number; heading: number };
  shoot(label: string, pose: LensPose, note: string, of: GameState): void;
  look(eye: THREE.Vector3, at: THREE.Vector3, fov?: number): LensPose;
  settle(run: GameState): void;
  note(run: GameState): string;
};

/** The waves alone for the length of `fn`: the roster's men held back,
 * its fire as `fire`, the waves' snowmobiles as `sleds`; put back after. */
async function alone<T>(
  fire: WantedRoster["fire"],
  sleds: number,
  fn: () => Promise<T>,
): Promise<T> {
  const rows = WANTED.roster as WantedRoster[];
  const kept = rows.map((r) => ({ ...r }));
  const W = ARMY_WAVE as { sleds: number };
  const keptSleds = W.sleds;
  for (const r of rows) {
    r.gunners = 0;
    r.soldiers = 0;
    r.lifted = 0;
    r.snowmobiles = 0;
    if (r.fire !== "hold") r.fire = fire;
  }
  W.sleds = sleds;
  try {
    return await fn();
  } finally {
    kept.forEach((r, i) => Object.assign(rows[i], r));
    W.sleds = keptSleds;
  }
}

const waveMen = (r: GameState): Soldier[] => armyTroops(r).filter((m) => m.from === "wave");

const middle = (men: readonly Soldier[]): THREE.Vector3 => {
  const c = new THREE.Vector3();
  for (const m of men) c.add(new THREE.Vector3(m.x, m.y, m.z));
  return c.multiplyScalar(1 / Math.max(1, men.length));
};

/** The middle of the thickest knot of `men`: the man with the most others
 * within `r` m, and the middle of those (a column's, not the whole wave's,
 * which is empty snow between its files). */
function densest(men: readonly Soldier[], r: number): THREE.Vector3 {
  let best: Soldier[] = [];
  for (const m of men) {
    const near = men.filter((k) => Math.hypot(k.x - m.x, k.z - m.z) < r);
    if (near.length > best.length) best = near;
  }
  return middle(best);
}

/** A lens `d` m from `c` on the bearing `h` (rad), `up` m over it. */
const off = (c: THREE.Vector3, h: number, d: number, up: number): THREE.Vector3 =>
  new THREE.Vector3(c.x + Math.sin(h) * d, c.y + up, c.z + Math.cos(h) * d);

/** `v` kept at least `clear` m over the snow under it. */
function over(r: GameState, v: THREE.Vector3, clear = 2): THREE.Vector3 {
  v.y = Math.max(v.y, r.level.groundAt(v.x, v.z) + clear);
  return v;
}

function noteOf(lab: WaveLab, r: GameState): string {
  const men = waveMen(r);
  const climbing = men.filter((m) => m.mode === "climb").length;
  return `${lab.note(r)} · waves ${r.army?.waves ?? 0}, ${men.length} men of them (${climbing} climbing)`;
}

export function waveViews(lab: WaveLab): Record<string, () => Promise<void>> {
  const climb = () =>
    alone("hold", 2, async () => {
      const r = await lab.groundRun(
        5,
        false,
        (g) => {
          const m = waveMen(g).filter((k) => k.mode === "climb" && k.speed > 0.5);
          return m.length >= 20 && m.every((k) => k.t > 12);
        },
        240,
        lab.at,
      );
      if (!r) return;
      lab.settle(r);
      const men = waveMen(r).filter((m) => m.mode === "climb");
      const c = densest(men, 25);
      const him = new THREE.Vector3(r.skier.x, r.skier.y + 1.5, r.skier.z);
      const up = Math.atan2(him.x - c.x, him.z - c.z);
      const n = noteOf(lab, r);
      const at = c.clone().add(new THREE.Vector3(0, 1, 0));
      lab.shoot(
        "beside the column",
        lab.look(over(r, off(c, up + Math.PI / 2, 24, 7)), at, 50),
        n,
        r,
      );
      lab.shoot("at its head", lab.look(over(r, off(c, up, 22, 5)), at, 50), n, r);
      lab.shoot(
        "wide, high over the run",
        lab.look(over(r, off(c, up + 2.3, 55, 30)), at, 50),
        n,
        r,
      );
    });
  const mass = () =>
    alone("hold", 3, async () => {
      const r = await lab.groundRun(
        5,
        false,
        (g) => (g.army?.waves ?? 0) >= 3 && waveMen(g).length >= 70,
        300,
        lab.at,
      );
      if (!r) return;
      for (let i = 0; i < 6; i++) lab.settle(r);
      const men = waveMen(r);
      const c = densest(men, 40);
      const him = new THREE.Vector3(r.skier.x, r.skier.y + 1.5, r.skier.z);
      const away = Math.atan2(him.x - c.x, him.z - c.z);
      const n = noteOf(lab, r);
      lab.shoot(
        "wide, the mountain below him",
        lab.look(over(r, off(him, away, 20, 40)), c, 55),
        n,
        r,
      );
      lab.shoot(
        "up the slope behind them",
        lab.look(over(r, off(c, away + Math.PI, 45, 12)), c, 50),
        n,
        r,
      );
      lab.shoot("from above the mass", lab.look(over(r, off(c, away + 1.2, 40, 30)), c, 55), n, r);
    });
  const arrest = () =>
    alone("aim", 0, async () => {
      const r = await lab.groundRun(
        5,
        true,
        (g) => (arrestedOf(g) ?? 0) > 12 && waveMen(g).length > 10,
        360,
        lab.at,
      );
      if (!r) return;
      lab.settle(r);
      const a = r.army!.arrest!;
      const c = new THREE.Vector3(a.x, r.level.groundAt(a.x, a.z) + 0.6, a.z);
      const n = `${noteOf(lab, r)} · arrested ${(arrestedOf(r) ?? 0).toFixed(0)} s`;
      lab.shoot("close", lab.clearRound(c, a.heading, 1.9, 9, 3, 50), n, r);
      lab.shoot("the ring", lab.clearRound(c, a.heading, -0.6, 32, 14, 55), n, r);
      lab.shoot("from above", lab.look(over(r, off(c, a.heading + 0.3, 45, 50)), c, 55), n, r);
    });
  return { "wave-climb": climb, "wave-mass": mass, "wave-arrest": arrest };
}

/** The sheet's views, as the harness lists them. */
export const WAVE_VIEWS = ["wave-climb", "wave-mass", "wave-arrest"] as const;
