// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TECHNIQUE (`defs/technique.ts`): how the skier works the ski, chosen
// by the mode. The free skier's row is the identity on the shared model —
// every ceiling a mode without a technique reads is the model's own, to the
// bit — and the slalom racer's is what lets the slalom pair carve a real
// slalom turn: a radius of 4–6 m at 65–70° of edge at slalom pace, a yaw
// over 2 rad/s, a turn every 0.9 s without being thrown — staged on the
// synthetic strip with `placeRun` — and the bot skiing a real course with
// it near a real slalom's time, its par that time.

import { describe, expect, it } from "vitest";

import {
  CHOUGH,
  EAGLE,
  FREE,
  MODE_RULES,
  RIDER_BOT,
  SKIS,
  SKI_CATALOG,
  SLALOM_TECHNIQUE,
  SWIFT,
  TECHNIQUES,
  TUNING,
  botInput,
  crossUnderOf,
  edgeReach,
  carveCurvature,
  cornerGrip,
  createGame,
  cutEdgeAt,
  cutGrip,
  edgeLockAt,
  generateLevel,
  placeRun,
  slalomPar,
  step,
  techniqueOf,
  type SkiSpec,
  type TechniqueId,
} from "@engine";
import { flatLevel } from "./support/synthetic.ts";

describe("the technique a run is skied with", () => {
  it("is the slalom racer's on a slalom and the free skier's everywhere else", () => {
    expect(techniqueOf(MODE_RULES.slalom(1))).toBe(SLALOM_TECHNIQUE);
    for (const mode of ["timeTrial", "free", "tricks"] as const) {
      expect(techniqueOf(MODE_RULES[mode](1))).toBe(FREE);
    }
    expect(createGame({ seed: 3, mode: "timeTrial", quiet: true }).rules.technique).toBe(undefined);
    const forced = createGame({ seed: 3, mode: "timeTrial", technique: "slalom", quiet: true });
    expect(techniqueOf(forced.rules)).toBe(SLALOM_TECHNIQUE);
    // The other disciplines' rows are data no mode deals yet.
    expect(Object.keys(TECHNIQUES).sort()).toEqual([
      "board",
      "downhill",
      "free",
      "giantSlalom",
      "moguls",
      "skiCross",
      "slalom",
      "speedSki",
      "superG",
    ]);
    for (const [id, row] of Object.entries(TECHNIQUES)) expect(row.id).toBe(id);
  });

  it("leaves every ceiling the model's own under the free skier's row", () => {
    for (const spec of SKI_CATALOG) {
      for (const v of [0, 6, 14, 30]) {
        expect(edgeLockAt(spec, v, FREE)).toBe(
          spec.edgeMax / (1 + v / (2 * TUNING.steer.fadeSpeed)),
        );
        for (const edge of [0, 0.6, 1.0, spec.edgeMax]) {
          expect(cornerGrip(spec, 1, v, edge, FREE)).toBe(cornerGrip(spec, 1, v));
        }
      }
    }
  });
});

describe("how a technique changes its edge", () => {
  it("crosses over on the free skier's row: the edge no further than the lean plus the angulation", () => {
    expect(FREE.cross).toEqual({ under: 0, retract: 0, steep: 0 });
    const A = TUNING.skier.angulateMost;
    for (const lean of [-0.6, 0, 0.3, 0.8]) {
      const reach = A + Math.max(0, lean);
      expect(edgeReach(lean, 1.2, 1, 0, FREE)).toBe(Math.min(1.2, reach));
    }
  });

  it("lets the slalom racer's legs stand the new edge under a body still laid the old way", () => {
    const A = TUNING.skier.angulateMost;
    const under = SLALOM_TECHNIQUE.cross.under;
    expect(under).toBeGreaterThan(A);
    // Upright, or still laid 20° into the old turn: the cross-under's edge.
    expect(edgeReach(0, 1.22, 1, 0, SLALOM_TECHNIQUE)).toBe(under);
    expect(edgeReach(-0.35, 1.22, 1, 0, SLALOM_TECHNIQUE)).toBe(under);
    expect(edgeReach(0, -1.22, 1, 0, SLALOM_TECHNIQUE)).toBe(-under);
    // Laid well into the new turn, the body's reach takes over, as ever.
    expect(edgeReach(0.7, 1.22, 1, 0, SLALOM_TECHNIQUE)).toBeCloseTo(Math.min(1.22, A + 0.7), 12);
    // On any pitch.
    expect(crossUnderOf(SLALOM_TECHNIQUE, 0.6)).toBe(1);
  });

  it("crosses under on the flat and over on the steep for the giant slalom, and over for the speed events", () => {
    const gs = TECHNIQUES.giantSlalom;
    expect(crossUnderOf(gs, 0.2)).toBe(1);
    expect(crossUnderOf(gs, gs.cross.steep + 0.2)).toBe(0);
    expect(edgeReach(0, 1.2, 1, 0.6, gs)).toBe(TUNING.skier.angulateMost);
    for (const id of ["superG", "downhill"] as const) {
      expect(TECHNIQUES[id].cross.under).toBe(0);
      expect(TECHNIQUES[id].cross.retract).toBe(0);
    }
  });
});

/** The yaw rate a pair cut hard can be asked for at `v` m/s, rad/s: the
 * carve its edge buys and the corner grip that holds it, whichever is the
 * less (the physics' yaw hand reads both). */
function yawAt(spec: SkiSpec, v: number, id: TechniqueId): number {
  const T = TECHNIQUES[id];
  const kappa = carveCurvature(spec, cutEdgeAt(spec, v, T)) * (1 + TUNING.carve.tighten);
  const reach = (cutGrip(spec, v, T) * TUNING.steer.pathShare) / v;
  return Math.min(v * kappa, reach);
}

describe("the slalom racer's technique", () => {
  it("lets the slalom pair turn 2.4 rad/s on a 5 m radius at 12 m/s, and the free skier not", () => {
    expect(yawAt(SWIFT, 12, "slalom")).toBeGreaterThanOrEqual(2.4);
    expect(yawAt(SWIFT, 12, "free")).toBeLessThan(1.5);
    expect(cutEdgeAt(SWIFT, 12, SLALOM_TECHNIQUE)).toBeGreaterThan(65 / 57.3);
  });

  it("leaves the long skis long: a giant slalom and a downhill ski still turn wider", () => {
    expect(yawAt(CHOUGH, 12, "slalom")).toBeLessThan(yawAt(SWIFT, 12, "slalom"));
    expect(yawAt(EAGLE, 12, "slalom")).toBeLessThan(yawAt(CHOUGH, 12, "slalom"));
    expect(yawAt(SKIS, 12, "slalom")).toBeLessThan(yawAt(SWIFT, 12, "slalom"));
  });

  it("carves a turn every 0.9 s down a 20° groomer without throwing him", () => {
    const level = flatLevel({
      packed: 1,
      grade: Math.tan(Math.PI / 9),
      slopeFrom: 200,
      size: 4000,
    });
    const state = createGame({ level, spec: SWIFT, technique: "slalom", quiet: true });
    placeRun(state, { x: 2000, z: 600, heading: 0, speed: 40 / 3.6 });
    let edge = 0;
    let yaw = 0;
    let thrown = false;
    const radii: number[] = [];
    for (let i = 0; i < 9 / TUNING.dt; i++) {
      const t = i * TUNING.dt;
      const side = Math.floor(t / 0.9) % 2 === 0 ? 1 : -1;
      const h = state.skier.heading;
      const steer = Math.abs(h) > 0.9 ? -Math.sign(h) : side;
      step(state, { steer, tuck: 0.3, brake: 0, lean: 0, reset: false, carve: true });
      const c = state.skier;
      if (c.thrown) thrown = true;
      if (t < 2) continue;
      edge = Math.max(edge, Math.abs(c.edge));
      yaw = Math.max(yaw, Math.abs(c.wy));
      if (Math.abs(c.wy) > 0.3) radii.push(c.speed / Math.abs(c.wy));
    }
    radii.sort((a, b) => a - b);
    expect(thrown).toBe(false);
    expect(edge).toBeGreaterThan(65 / 57.3);
    expect(yaw).toBeGreaterThan(2);
    expect(radii[Math.floor(radii.length * 0.1)]).toBeLessThan(6);
  });
});

describe("the bot's slalom", () => {
  it("skis seed 19's course clean, carved, at a slalom's pace — and par is its time", () => {
    // The first slalom race map's hill but one (seed 19's red, course 8):
    // the course this pace was measured on.
    const level = generateLevel(19, { grade: "red", course: "8" });
    const state = createGame({ level, mode: "slalom", spec: SWIFT, quiet: true });
    let top = 0;
    let edge = 0;
    for (let i = 0; i < 120 / TUNING.dt && !state.progress.finished; i++) {
      step(state, botInput(state, RIDER_BOT));
      if (!state.progress.started) continue;
      top = Math.max(top, state.skier.speed);
      edge = Math.max(edge, Math.abs(state.skier.edge));
    }
    const p = state.progress;
    expect(p.out).toBe(null);
    expect(p.finished).toBe(true);
    // A slalom's pace: a real one is 45–65 s down 140–220 m of vertical at
    // ~40 km/h on the mean, 50–60 at the most, the edge past 60°. The bot
    // skis it a little slower — some 36 km/h, about 63 s here — because
    // the speed it plans leaves room for the crossing between two turns
    // (`lineSpeed`), the skis swung under him onto the new edge
    // (`Technique.cross`); faster, it misses gates.
    expect(p.time).toBeGreaterThan(45);
    expect(p.time).toBeLessThan(80);
    const mean = (state.level.slalom!.to - state.level.slalom!.from) / p.time;
    expect(mean * 3.6).toBeGreaterThan(32);
    expect(top * 3.6).toBeGreaterThan(45);
    expect(edge).toBeGreaterThan(60 / 57.3);
    const par = slalomPar(state.level, SWIFT)!;
    expect(Math.abs(par.time / p.time - 1)).toBeLessThan(0.05);
  });
});
