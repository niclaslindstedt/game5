// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RESCUE LAB's SNOWMOBILE SHEETS (`rescue-harness.ts` hands them its
// renderer and its lenses): the ski patrol sent on two snowmobiles where no
// air ambulance can set down (`rescue-sleds-view.ts` draws it). A spot is
// found near the share of the piste the lab was asked for where the
// machine has nowhere to land (`fitToLand`) and the patrol can drive
// (`planSledRescue`); a run is ended injured there and the next started,
// the call booked as the game books it (`bookRun`), and the call's clock
// posed where each frame wants it.
//
//   sleds-arrive   the convoy driven up, from beside the scene and from a
//                  lens following the first machine; parked, stepping off
//   sleds-scene    the work from above: the board taken out, walked round,
//                  the scoop, the carry, him lowered in and lashed, back on
//   sleds-load     close on the toboggan: the lowering, the lashings, all
//                  four sat on their machines
//   sleds-tow      the convoy down: the tow bar on the hitch, the toboggan
//                  behind, from beside, behind and close
//   sleds-night    the arrival, the work and the tow at hour 21
//   sleds-stolen   a machine taken while it stands, ridden off on the chase
//                  lens, the other driven round to tow him, and the
//                  player's own machine left standing where he left it

import {
  NEUTRAL_INPUT,
  freshSledsFrame,
  planSledRescue,
  rescueSledsAt,
  standSkier,
  step,
  TUNING,
  type GameState,
  type Level,
  type RescueCall,
  type RescueSledPlan,
  type SkyOverride,
} from "@engine";

import type { LensPose } from "../game/camera-rigs.ts";
import type { createWorldRenderer } from "../game/renderer.ts";
import { bookRun, createRescueBook } from "../game/rescue-book.ts";
import { fitToLand } from "../game/rescue-plan.ts";
import { crewPlanOf, SLED_CREW } from "../game/rescue-sleds-crew.ts";

/** What the lab's page lends the sheets. */
export type SledLab = {
  renderer: ReturnType<typeof createWorldRenderer>;
  level: Level;
  share: number;
  sky: SkyOverride | null;
  fresh(): GameState;
  shoot(s: GameState, label: string, lens: LensPose | "chase"): void;
  poseAt(s: GameState, t: number, lead?: number): void;
  planted(
    p: { x: number; y: number; z: number },
    heading: number,
    right: number,
    back: number,
    up: number,
    fov?: number,
    look?: number,
  ): LensPose;
  setView(v: string): void;
  setT0(t: number): void;
};

export const SLED_GROUPS: Record<string, readonly string[]> = {
  "sleds-arrive": ["sleds-arrive"],
  "sleds-scene": ["sleds-scene"],
  "sleds-load": ["sleds-load"],
  "sleds-tow": ["sleds-tow"],
  "sleds-night": ["sleds-night"],
  "sleds-stolen": ["sleds-stolen"],
};

/** A spot near the piste's `share` where only the patrol can come, or null. */
export function sledSpot(level: Level, share: number): { x: number; z: number } | null {
  const pts = level.track.points;
  const n = pts.length;
  const at = Math.floor(n * share);
  for (let k = 0; k < n; k += 12) {
    for (const i of [at + k, at - k]) {
      const p = pts[i];
      if (!p) continue;
      for (const off of [0, 14, -14, 28, -28]) {
        const x = p.x + Math.cos(p.heading) * off;
        const z = p.z - Math.sin(p.heading) * off;
        const q = { x, z };
        if (!fitToLand(level, q) && planSledRescue(level, q)) return q;
      }
    }
  }
  return null;
}

type Scene = { s: GameState; call: RescueCall; plan: RescueSledPlan };

/** A run ended injured at `spot`, and the next: the patrol's call booked,
 * the skier stood `back` m from where he lay, up the way the machines go. */
function nextRun(lab: SledLab, spot: { x: number; z: number }, back = 40): Scene | null {
  const { renderer } = lab;
  const hurt = lab.fresh();
  standSkier(hurt, spot.x, spot.z, 0);
  hurt.gore!.injured = 0;
  renderer.draw(hurt, 1, 1 / 60, false);
  const s = lab.fresh();
  bookRun(createRescueBook(), hurt, s);
  const call = s.rescue?.find((c) => c.kind === "sled");
  if (!call?.sleds) return null;
  const plan = call.sleds;
  const p = plan.park[0];
  const bx = spot.x - Math.sin(p.heading) * back;
  const bz = spot.z - Math.cos(p.heading) * back;
  standSkier(s, bx, bz, p.heading);
  lab.setT0(call.start);
  renderer.draw(s, 1, 1 / 60, false);
  return { s, call, plan };
}

const frame = freshSledsFrame();

export function sledViews(lab: SledLab): Record<string, () => Promise<void>> {
  const { level } = lab;
  const spot = sledSpot(level, lab.share);
  const g = (p: { x: number; z: number }) => ({ x: p.x, y: level.groundAt(p.x, p.z), z: p.z });

  /** The scene's lenses: beside the toboggan, above it, and close. */
  const lenses = (sc: Scene) => {
    const tob = sc.plan.toboggan;
    const mid = {
      x: (tob.x + sc.plan.park[0].x + spot!.x) / 3,
      z: (tob.z + sc.plan.park[0].z + spot!.z) / 3,
    };
    return {
      wide: lab.planted(g(mid), tob.heading + 0.7, 5, 11, 5.5, 55, 0.4),
      above: lab.planted(g(mid), tob.heading + 0.4, 2, 6, 9, 55, 0),
      close: lab.planted(g(tob), tob.heading + Math.PI / 2, 0.6, 5.2, 2.3, 50, 0.4),
      seats: lab.planted(g(sc.plan.park[0]), sc.plan.park[0].heading - 1.1, 1, 8, 3, 50, 0.7),
    };
  };

  const machineAt = (sc: Scene, k: 0 | 1, t: number) => {
    rescueSledsAt(sc.plan, sc.call.sledsTaken, t, frame);
    const p = frame.sleds[k];
    return { ...g(p), heading: p.heading };
  };

  const start = (back = 40): Scene => {
    if (!spot) throw new Error("no spot near the piste where only the patrol can come");
    const sc = nextRun(lab, spot, back);
    if (!sc) throw new Error("the call booked was not the patrol's");
    return sc;
  };

  const arrive = (sc: Scene, prefix = ""): void => {
    const { plan } = sc;
    const L = lenses(sc);
    const P = plan.parked[0];
    for (const [label, t] of [
      ["pulling in", P - 3],
      ["parked", P + 0.3],
      ["stepping off", P + SLED_CREW.time.off * 0.6],
      ["the second in", plan.parked[1] + 0.2],
    ] as const) {
      lab.poseAt(sc.s, Math.max(0, t), 1);
      lab.shoot(sc.s, `${prefix}${label}`, L.wide);
    }
    const m = machineAt(sc, 0, P + 4);
    lab.shoot(
      sc.s,
      `${prefix}parked, close`,
      lab.planted(m, m.heading - 1.9, 0, 7.5, 1.8, 45, 0.6),
    );
    lab.shoot(
      sc.s,
      `${prefix}parked, from behind`,
      lab.planted(m, m.heading + 0.5, 0, 5.5, 2.2, 50, 0.6),
    );
    for (const t of [P - 40, P - 24, P - 12, P - 4]) {
      lab.poseAt(sc.s, Math.max(0, t), 1);
      const m = machineAt(sc, 0, Math.max(0, t));
      lab.shoot(
        sc.s,
        `${prefix}following ${t.toFixed(0)} s`,
        lab.planted(m, m.heading + 0.5, 1.5, 9, 3.2, 50, 0.6),
      );
    }
  };

  const work = (sc: Scene, prefix = "", only?: readonly string[]): void => {
    const A = crewPlanOf(level, sc.plan, sc.call.casualties[0]).at;
    const L = lenses(sc);
    for (const [label, t] of [
      ["board taken out", A.take + SLED_CREW.time.take * 0.7],
      ["walked round", (A.lead + A.scoop) / 2],
      ["scooping", A.scoop + 8],
      ["strapped", A.scoop + (A.raise - A.scoop) * 0.55],
      ["carried to it", A.raise - 1.5],
      ["lowered in", A.lowered],
      ["lashed", A.lashed],
      ["back to the machines", (A.up + A.done) / 2],
      ["all sat", sc.plan.go - 0.5],
    ] as const) {
      if (only && !only.includes(label)) continue;
      lab.poseAt(sc.s, t, 1);
      lab.shoot(sc.s, `${prefix}${label}`, L.above);
    }
  };

  const tow = (sc: Scene, prefix = ""): void => {
    const { plan } = sc;
    for (const dt of [0.5, 6, 16, 32]) {
      const t = plan.go + dt;
      lab.poseAt(sc.s, t, 1);
      const m = machineAt(sc, frame.tow === 1 ? 1 : 0, t);
      lab.shoot(
        sc.s,
        `${prefix}+${dt} s beside`,
        lab.planted(m, m.heading - 1.4, 0, 9, 2.6, 50, 0.4),
      );
      lab.shoot(
        sc.s,
        `${prefix}+${dt} s behind`,
        lab.planted(m, m.heading + 0.25, 0, 11, 3.4, 50, 0.4),
      );
    }
  };

  return {
    async "sleds-arrive"() {
      arrive(start());
    },
    async "sleds-scene"() {
      work(start());
    },
    async "sleds-load"() {
      const sc = start();
      const A = crewPlanOf(level, sc.plan, sc.call.casualties[0]).at;
      const L = lenses(sc);
      for (const [label, t] of [
        ["over the toboggan", A.raise + 0.2],
        ["lowering", (A.raise + A.lowered) / 2],
        ["lowered", A.lowered + 0.3],
        ["lashing", (A.lowered + A.lashed) / 2],
        ["lashed", A.lashed + 0.3],
        ["stood up", A.up + 0.3],
      ] as const) {
        lab.poseAt(sc.s, t, 0.6);
        lab.shoot(sc.s, label, L.close);
      }
      for (const [label, t] of [
        ["getting on", (A.up + A.done) / 2],
        ["sat, ready", sc.plan.go - 0.3],
      ] as const) {
        lab.poseAt(sc.s, t, 0.6);
        lab.shoot(sc.s, label, L.seats);
      }
    },
    async "sleds-tow"() {
      tow(start());
    },
    async "sleds-night"() {
      lab.renderer.setSky({ ...(lab.sky ?? {}), hour: 21 });
      await lab.renderer.shadeSettled();
      const sc = start();
      arrive(sc, "night: ");
      work(sc, "night: ", ["scooping", "lashed", "all sat"]);
      tow(sc, "night: ");
      lab.renderer.setSky(lab.sky);
      await lab.renderer.shadeSettled();
    },
    async "sleds-stolen"() {
      const sc = start(10);
      const { s, plan } = sc;
      const t0 = plan.parked[0] + 12;
      lab.poseAt(s, t0, 1);
      // Stood beside the first machine, and its press.
      const p = plan.park[0];
      const off = -2.2;
      standSkier(s, p.x + Math.cos(p.heading) * off, p.z - Math.sin(p.heading) * off, p.heading);
      const L = lenses(sc);
      lab.shoot(s, "beside it", L.wide);
      step(s, { ...NEUTRAL_INPUT, machine: true });
      lab.shoot(s, s.sled?.livery === "patrol" ? "taken" : "not taken", "chase");
      const FRAME = 1 / 60;
      const steps = Math.round(FRAME / TUNING.dt);
      const ride = (seconds: number, every: number, lens: () => LensPose | "chase", tuck = 0.5) => {
        const n = Math.round(seconds / FRAME);
        for (let f = 0; f < n; f++) {
          for (let i = 0; i < steps; i++) step(s, { ...NEUTRAL_INPUT, tuck });
          lab.renderer.draw(s, 1, FRAME, false);
          if ((f + 1) % Math.round(every / FRAME) === 0)
            lab.shoot(s, `ridden ${(s.t - t0).toFixed(1)} s`, lens());
        }
      };
      ride(4, 2, () => "chase");
      const sled = s.sled!;
      lab.shoot(
        s,
        "the patrol's, ridden",
        lab.planted(g(sled), Math.atan2(sled.vx, sled.vz) - 1.2, 0, 7, 2.2, 50, 0.6),
      );
      lab.shoot(s, "left at the scene", L.wide);
      // The other machine driven round to the toboggan and towing him down.
      const hitch = plan.go + plan.hitch.time * 0.6;
      lab.poseAt(s, hitch, 1);
      lab.shoot(s, "the second driven round", L.wide);
      lab.poseAt(s, plan.go + plan.hitch.time + 8, 1);
      const m = machineAt(sc, 1, s.t - sc.call.start);
      lab.shoot(s, "the second towing", lab.planted(m, m.heading - 1.2, 0, 9, 3, 50, 0.4));
      // His own, left standing where it was.
      const own = s.sledsLeft?.[0];
      if (own) {
        lab.shoot(s, "his own, left standing", lab.planted(g(own), 0.8, 0, 7, 2.4, 50, 0.6));
      }
    },
  };
}
