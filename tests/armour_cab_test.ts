// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE ARMY'S MACHINES TAKEN, FROM THE INSIDE AND ON THE HUD — the
// DOM-free half of `carrier-cab.ts` and `army-heli-cockpit.ts` (their
// plans, `army-cab-plan.ts` and `army-cockpit-plan.ts`) and the HUD's
// reading (`armour-hud.ts`): the driver sees his cluster through the
// wheel, over its hub; his hands stay on the rim as it turns; the pedals
// and the cluster read the drive; the deck's controls move with the
// collective and the cyclic, and its eye is inside it; and the readout
// names the machine he drives, the tank's turret as he sees it, and the
// press at a door.

import { describe, expect, it } from "vitest";

import {
  ARMOUR,
  NEUTRAL_INPUT,
  TUNING,
  WANTED,
  armourDoor,
  callVehicles,
  createGame,
  fromEuler,
  rotate,
  setWanted,
  standSkier,
  step,
  type ArmyVehicle,
  type GameState,
  type WantedRoster,
} from "@engine";
import { armourOf } from "../pwa/src/game/armour-hud.ts";
import { ARMOUR_RIGS, armourRigPose } from "../pwa/src/game/camera-armour.ts";
import type { RigPose } from "../pwa/src/game/camera-rigs.ts";
import {
  CARRIER_CAB,
  cabGauges,
  cabPose,
  handsOnWheel,
  rimAt,
  wheelFrame,
} from "../pwa/src/game/army-cab-plan.ts";
import {
  ARMY_COCKPIT,
  COPILOT,
  PILOT,
  deckCollective,
  deckCyclic,
  deckPose,
  inDeck,
} from "../pwa/src/game/army-cockpit-plan.ts";
import { bodyOf } from "../pwa/src/game/cockpit-plan.ts";
import { flatLevel } from "./support/synthetic.ts";

const dist = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

describe("the carrier's cab", () => {
  it("shows the driver his cluster through the wheel, over its hub and under its rim", () => {
    const C = CARRIER_CAB;
    const f = wheelFrame();
    // The cluster's middle on the dash's face, from its foot toward its top.
    const D = C.dash;
    const up = C.cluster.up / Math.hypot(D.top - D.foot.y, D.back - D.foot.z);
    const cluster = {
      x: C.cluster.x,
      y: D.foot.y + (D.top - D.foot.y) * up,
      z: D.foot.z + (D.back - D.foot.z) * up,
    };
    // Where the sight line crosses the wheel's plane.
    const e = C.eye;
    const k = (f.hub.z - e.z) / (cluster.z - e.z);
    const y = e.y + (cluster.y - e.y) * k;
    expect(y).toBeGreaterThan(f.hub.y + 0.07);
    expect(y).toBeLessThan(f.hub.y + C.wheel.r * Math.cos(C.wheel.rake));
  });

  it("keeps his hands on the rim as the wheel turns, at ten to two at rest", () => {
    const f = wheelFrame();
    for (const turn of [0, 0.5, -0.5, 1, -1, 2.4]) {
      const { left, right } = handsOnWheel(turn);
      for (const h of [left, right])
        expect(Math.abs(dist(h, f.hub) - (CARRIER_CAB.wheel.r - 0.005))).toBeLessThan(1e-6);
    }
    const rest = handsOnWheel(0);
    expect(rest.left.x).toBeGreaterThan(f.hub.x);
    expect(rest.right.x).toBeLessThan(f.hub.x);
    expect(rest.left.y).toBeCloseTo(rest.right.y, 6);
    // The top of the rim carried toward +x as the wheel turns that way.
    expect(rimAt(0, 0.4).x).toBeGreaterThan(rimAt(0, 0).x);
  });

  it("reads the drive on the pedals, the wheel and the cluster", () => {
    expect(cabPose({ steer: 1, drive: 1 }, 5)).toMatchObject({ gas: 1, brake: 0 });
    expect(cabPose({ steer: 0, drive: -1 }, 5)).toMatchObject({ gas: 0, brake: 1 });
    expect(cabPose({ steer: 0, drive: -1 }, 0).reverse).toBe(true);
    expect(cabPose({ steer: -1, drive: 0 }, 0).wheel).toBeCloseTo(-CARRIER_CAB.wheel.lock, 9);
    const run = cabGauges(10, 1, 3, false, 13);
    expect(run.kmh).toBeCloseTo(36, 6);
    expect(run.rpm).toBeGreaterThan(800);
    expect(run.oil).toBeGreaterThan(2);
    const dead = cabGauges(0, 0, 3, true, 13);
    expect(dead.rpm).toBe(0);
    expect(dead.oil).toBe(0);
    expect(dead.park).toBe(true);
  });
});

describe("the army helicopter's flight deck", () => {
  it("puts the pilot's eye inside the deck and the nose's tip outside it", () => {
    expect(inDeck(bodyOf(ARMY_COCKPIT.eye))).toBe(true);
    expect(inDeck({ x: 0, y: ARMY_COCKPIT.eye.y, z: ARMY_COCKPIT.eye.z + 20 })).toBe(false);
  });

  it("raises the collective and leans the cyclic with the controls, both seats alike", () => {
    const low = deckPose({ collective: 0, pitch: 0, roll: 0, pedal: 0 });
    const high = deckPose({ collective: 1, pitch: 0, roll: 0, pedal: 0 });
    const fwd = deckPose({ collective: 0.5, pitch: 1, roll: 0, pedal: 0 });
    for (const side of [PILOT, COPILOT]) {
      expect(deckCollective(high, side).y).toBeGreaterThan(deckCollective(low, side).y);
      expect(deckCyclic(fwd, side).z).toBeGreaterThan(deckCyclic(low, side).z);
    }
    expect(Math.sign(deckCyclic(low, PILOT).x)).toBe(-Math.sign(deckCyclic(low, COPILOT).x));
  });
});

describe("the HUD's readout of a machine taken", () => {
  function hunted(): GameState {
    const s = createGame({ level: flatLevel({ size: 1600 }), mode: "free", quiet: true, crowd: 0 });
    setWanted(s, 3);
    step(s, NEUTRAL_INPUT);
    return s;
  }
  function stood(s: GameState, kind: ArmyVehicle["kind"]): ArmyVehicle {
    const c = s.skier;
    const mix = {
      snowmobiles: 0,
      foot: 0,
      tracked: kind === "carrier" ? 1 : 0,
      trucks: kind === "truck" ? 1 : 0,
      tanks: kind === "tank" ? 1 : 0,
    };
    const way = [
      { x: c.x, z: c.z + 30, w: 12 },
      { x: c.x + 400, z: c.z + 30, w: 12 },
    ];
    callVehicles(s, s.army!, s.wanted!, mix, 0, way, [0, 400], 0, []);
    const v = s.army!.vehicles.at(-1)!;
    Object.assign(v, {
      mode: kind === "tank" ? "halt" : "park",
      due: 0,
      x: c.x,
      z: c.z + 30,
      y: s.level.groundAt(c.x, c.z + 30),
      heading: Math.PI / 2,
      rear: Math.PI / 2,
      speed: 0,
      aboard: 0,
      next: Infinity,
    });
    const d = armourDoor(v);
    standSkier(s, d.x, d.z, v.heading);
    return v;
  }
  function quiet<T>(fn: () => T): T {
    const rows = WANTED.roster as WantedRoster[];
    const kept = rows.map((r) => ({ ...r }));
    const waves = WANTED.waves as (typeof WANTED.waves)[number][];
    const keptWaves = waves.slice();
    for (const r of rows) Object.assign(r, { gunners: 0, soldiers: 0, lifted: 0, snowmobiles: 0 });
    waves.fill(null);
    try {
      return fn();
    } finally {
      kept.forEach((r, i) => Object.assign(rows[i], r));
      keptWaves.forEach((r, i) => (waves[i] = r));
    }
  }

  it("offers the press at a door, then reads the vehicle he drives", () => {
    quiet(() => {
      const s = hunted();
      stood(s, "carrier");
      expect(armourOf(s)).toEqual({ kind: "waiting", vehicle: "carrier", steal: true });
      step(s, { ...NEUTRAL_INPUT, machine: true });
      for (let i = 0; i < 3 / TUNING.dt; i++) step(s, { ...NEUTRAL_INPUT, tuck: 1 });
      const hud = armourOf(s);
      expect(hud?.kind).toBe("driven");
      if (hud?.kind !== "driven") return;
      expect(hud.vehicle).toBe("carrier");
      expect(hud.kmh).toBeGreaterThan(10);
      expect(hud.turret).toBe(null);
    });
  });

  it("reads the tank's turret as the player sees it, and its gun", () => {
    quiet(() => {
      const s = hunted();
      stood(s, "tank");
      step(s, { ...NEUTRAL_INPUT, machine: true });
      expect(s.armour?.rider).toBe(true);
      s.armour!.body.turret = 0.5;
      const hud = armourOf(s);
      if (hud?.kind !== "driven") throw new Error("not driven");
      // The engine's right is the screen's left: the sign flips once.
      expect(Math.abs(hud.turret!)).toBe(Math.round((0.5 * 180) / Math.PI));
      expect(typeof hud.loaded).toBe("boolean");
      expect(ARMOUR.tank.gun).toBeGreaterThan(0);
    });
  });
});

describe("the lens in the carrier's cab", () => {
  it("sits at the driver's eye however the carrier leans", () => {
    const rig = ARMOUR_RIGS.carrier.helmet;
    if (rig.kind !== "bolted") throw new Error("the helmet rung is bolted");
    for (const [pitch, roll] of [
      [0, 0],
      [0.15, 0],
      [-0.2, 0.1],
    ]) {
      const v = { x: 100, y: 40, z: 200, heading: 0.7, pitch, roll, speed: 5 } as ArmyVehicle;
      const pose = armourRigPose({} as RigPose, v, null);
      const q = fromEuler(v.heading, pitch, roll);
      const eye = rotate(q, rig.eye);
      const want = rotate(q, CARRIER_CAB.eye);
      expect(pose.x + eye.x).toBeCloseTo(v.x + want.x, 9);
      expect(pose.y + eye.y).toBeCloseTo(v.y + want.y, 9);
      expect(pose.z + eye.z).toBeCloseTo(v.z + want.z, 9);
    }
  });
});
