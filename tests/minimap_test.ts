// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE MINIMAP, read without a browser: the ground baked once per map
// (`minimap-bake.ts`) and the payload the plate is drawn from
// (`minimap-view.ts`) — which way the map is turned, how far it is zoomed,
// where the piste, the gates and the field stand on it, and the chevron
// that points at the gate owed once it is off the plate.

import { describe, expect, it } from "vitest";

import {
  TUNING,
  botInput,
  createGame,
  createHeightfield,
  fillField,
  placeRun,
  step,
  type GameState,
} from "@engine";

import { GRADE_LOOK } from "../pwa/src/game/grade-look.ts";
import { bakeMinimap, mapPxFor, minimapSource } from "../pwa/src/game/minimap-bake.ts";
import {
  AIR_ZOOM,
  VIEW,
  ZOOM,
  airSpanFor,
  buildMinimap,
  project,
  rotorTurnMs,
  spanFor,
} from "../pwa/src/game/minimap-view.ts";
import { takeSnapshot } from "../pwa/src/game/snapshot.ts";
import { levelFor, LEVEL_SEEDS } from "./support/levels.ts";
import { LONE_TREE, SLOPE, syntheticLevel } from "./support/synthetic.ts";

function race(): GameState {
  return createGame({ level: syntheticLevel(), seed: 7, quiet: true });
}

/** Where a world point lands against the plate's middle, view units. */
function onPlate(state: GameState, x: number, z: number): [number, number] {
  const map = buildMinimap(state);
  const [px, py] = project(map.pose, x, z);
  return [px - VIEW / 2, py - VIEW / 2];
}

describe("the baked ground (minimap-bake.ts)", () => {
  it("paints every pixel of the map, opaque", () => {
    const px = 64;
    const rgba = bakeMinimap(minimapSource(syntheticLevel()), px);
    expect(rgba.length).toBe(px * px * 4);
    for (let k = 3; k < rgba.length; k += 4) expect(rgba[k]).toBe(255);
  });

  it("marks a tree darker than the open snow beside it", () => {
    const level = syntheticLevel();
    const px = 500;
    const rgba = bakeMinimap(minimapSource(level), px);
    const at = (x: number, z: number): number => {
      const i = Math.floor((x / level.size) * px);
      const j = Math.floor((z / level.size) * px);
      const k = (j * px + i) * 4;
      return rgba[k] + rgba[k + 1] + rgba[k + 2];
    };
    expect(at(LONE_TREE.x, LONE_TREE.z)).toBeLessThan(at(LONE_TREE.x + 30, LONE_TREE.z) - 150);
  });

  it("lays the woods' green round a tree, past its own dot", () => {
    const level = syntheticLevel();
    const px = 500;
    const rgba = bakeMinimap(minimapSource(level), px);
    // Green over red: a wood is green, the open snow is blue-white.
    const green = (x: number, z: number): number => {
      const k = (Math.floor((z / level.size) * px) * px + Math.floor((x / level.size) * px)) * 4;
      return rgba[k + 1] - rgba[k];
    };
    const tree = level.trees.find((t) => t.x === LONE_TREE.x && t.z === LONE_TREE.z)!;
    const beside = tree.crown * 2;
    expect(green(LONE_TREE.x + beside, LONE_TREE.z)).toBeGreaterThan(
      green(LONE_TREE.x + 60, LONE_TREE.z) + 10,
    );
  });

  it("shows rock on a face too steep to hold snow, and only there", () => {
    const size = 400;
    const ground = createHeightfield(0, 0, 4, 101, 101);
    // A gentle slope west of x = 200, a wall steeper than any rock band east.
    fillField(ground, (x) => (x < 200 ? x * 0.1 : 20 + (x - 200) * 2));
    const src = {
      size,
      ground,
      packed: null,
      trees: new Float32Array(0),
      rock: { tone: [90, 80, 70] as [number, number, number], from: 0.75, to: 1.2 },
      wood: [90, 140, 100] as [number, number, number],
      cabins: new Float32Array(0),
    };
    const px = 100;
    const rgba = bakeMinimap(src, px);
    const blue = (i: number): number => {
      const k = (50 * px + i) * 4;
      return rgba[k + 2] - rgba[k];
    };
    // Snow is bluer than red; the rock's tone is the other way round.
    expect(blue(20)).toBeGreaterThan(10);
    expect(blue(80)).toBeLessThan(0);
    // And a country with no rock keeps its snow on the same wall.
    expect(bakeMinimap({ ...src, rock: null }, px)[(50 * px + 80) * 4 + 2]).toBeGreaterThan(
      bakeMinimap({ ...src, rock: null }, px)[(50 * px + 80) * 4],
    );
  });

  it("paints a cabin's roof in timber brown, turned to its heading, and nothing round it", () => {
    const size = 400;
    const ground = createHeightfield(0, 0, 4, 101, 101);
    fillField(ground, () => 0);
    const src = {
      size,
      ground,
      packed: null,
      trees: new Float32Array(0),
      rock: null,
      wood: [90, 140, 100] as [number, number, number],
      // A roof 16 m by 8 m at (200, 200), turned a quarter: long along z.
      cabins: new Float32Array([200, 200, 8, 4, Math.PI / 2, 1]),
    };
    const px = 200;
    const rgba = bakeMinimap(src, px);
    const redder = (x: number, z: number): number => {
      const k = (Math.floor(z / 2) * px + Math.floor(x / 2)) * 4;
      return rgba[k] - rgba[k + 2];
    };
    // Brown (red over blue) where the roof is; the snow's blue round it.
    expect(redder(200, 200 + 7)).toBeGreaterThan(20);
    expect(redder(200 + 11, 200)).toBeLessThan(0);
    expect(redder(240, 240)).toBeLessThan(0);
  });

  it("bakes a pixel every metre and a half or so, inside a size every phone decodes", () => {
    expect(mapPxFor(1600)).toBe(1280);
    expect(mapPxFor(3000)).toBe(2048);
    expect(mapPxFor(400)).toBe(1024);
    expect(mapPxFor(20000)).toBe(2048);
    for (const size of [800, 1600, 2400, 3000]) expect(mapPxFor(size) % 256).toBe(0);
  });

  it("paints the groomed track apart from the powder beside it", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    const px = 400;
    const rgba = bakeMinimap(minimapSource(level), px);
    const tone = (x: number, z: number): [number, number] => {
      const i = Math.floor((x / level.size) * px);
      const j = Math.floor((z / level.size) * px);
      const k = (j * px + i) * 4;
      // Blue over red: the snow is blue-white, the groomer's grey is not.
      return [rgba[k + 2] - rgba[k], rgba[k] + rgba[k + 1] + rgba[k + 2]];
    };
    let on = 0;
    let off = 0;
    const pts = level.track.points;
    for (let i = 0; i < pts.length; i += 25) {
      const p = pts[i];
      on += tone(p.x, p.z)[0];
      // Out into the powder, square to the track.
      const d = p.width + 30;
      off += tone(p.x + Math.cos(p.heading) * d, p.z - Math.sin(p.heading) * d)[0];
    }
    expect(on).toBeLessThan(off);
  });
});

describe("the plate's pose (minimap-view.ts)", () => {
  it("is heading-up: what is ahead of the skier is up the plate", () => {
    const state = race();
    for (const heading of [0, 0.7, Math.PI / 2, 2.5, -1.9]) {
      placeRun(state, { x: 500, z: 500, heading });
      const [dx, dy] = onPlate(state, 500 + Math.sin(heading) * 50, 500 + Math.cos(heading) * 50);
      expect(Math.abs(dx)).toBeLessThan(1e-6);
      expect(dy).toBeLessThan(0);
    }
  });

  it("riding switch, is turned to the way he goes: down the hill stays up the plate", () => {
    const state = race();
    for (const heading of [0, 0.7, -1.9]) {
      placeRun(state, { x: 500, z: 500, heading });
      state.skier.switched = true;
      // The tails lead: what is BEHIND his skis is ahead of him.
      const [dx, dy] = onPlate(state, 500 - Math.sin(heading) * 50, 500 - Math.cos(heading) * 50);
      expect(Math.abs(dx)).toBeLessThan(1e-6);
      expect(dy).toBeLessThan(0);
    }
  });

  it("puts on the left of the plate what the chase camera sees on the left", () => {
    // Facing +z, the renderer's camera has engine +x on its LEFT — the same
    // fact `SCREEN_TO_ENGINE` states at the thumbs.
    const state = race();
    placeRun(state, { x: 500, z: 500, heading: 0 });
    expect(onPlate(state, 540, 500)[0]).toBeLessThan(0);
    placeRun(state, { x: 500, z: 500, heading: Math.PI / 2 });
    expect(onPlate(state, 500, 540)[0]).toBeGreaterThan(0);
  });

  it("keeps the turn continuous through south, so the tween never spins the long way", () => {
    const state = race();
    let last: number | null = null;
    for (let i = 0; i <= 40; i++) {
      // Two whole turns, in steps a tenth of a radian apart.
      const heading = Math.atan2(Math.sin(i * 0.3), Math.cos(i * 0.3));
      placeRun(state, { x: 500, z: 500, heading });
      state.t += TUNING.dt;
      const angle = buildMinimap(state).pose.angle;
      if (last !== null) expect(Math.abs(angle - last)).toBeLessThan(20);
      last = angle;
    }
  });

  it("opens with speed, and follows it with a lag rather than a jump", () => {
    expect(spanFor(0)).toBe(ZOOM.close);
    expect(spanFor(200)).toBe(ZOOM.far);
    expect(spanFor(50)).toBeGreaterThan(spanFor(20));

    const state = race();
    placeRun(state, { x: 500, z: 500, heading: 0 });
    state.t += 1;
    const rest = buildMinimap(state).pose.scale;
    expect(rest).toBeCloseTo(VIEW / ZOOM.close, 6);
    placeRun(state, { x: 500, z: 500, heading: 0, speed: 30 });
    state.t += 0.08;
    const next = buildMinimap(state).pose.scale;
    expect(next).toBeLessThan(rest);
    expect(next).toBeGreaterThan(VIEW / ZOOM.far);
  });
});

describe("the plate aloft (minimap-view.ts)", () => {
  it("opens with the helicopter's height, never past the map", () => {
    expect(airSpanFor(0, 3000)).toBe(0);
    expect(airSpanFor(AIR_ZOOM.from, 3000)).toBe(0);
    expect(airSpanFor(100, 3000)).toBeGreaterThan(ZOOM.far);
    expect(airSpanFor(300, 3000)).toBeGreaterThan(airSpanFor(100, 3000));
    expect(airSpanFor(5000, 3000)).toBe(3000);
  });

  /** A race stood still with a helicopter at `agl` over the snow — only the
   * two fields the plate reads. */
  function aloft(agl: number, rider: boolean): GameState {
    const state = race();
    placeRun(state, { x: 500, z: 500, heading: 0 });
    state.heli = { agl, rider, x: 520, z: 480, heading: 1, spool: 1 } as GameState["heli"];
    return state;
  }

  it("zooms out as he climbs on the skid and back in as he comes down", () => {
    const state = aloft(0, true);
    state.t += 1;
    const pad = buildMinimap(state).pose.scale;
    expect(pad).toBeCloseTo(VIEW / ZOOM.close, 6);
    state.heli!.agl = 200;
    for (let i = 0; i < 10; i++) {
      state.t += 1;
      buildMinimap(state);
    }
    const high = buildMinimap(state).pose.scale;
    expect(high).toBeCloseTo(VIEW / airSpanFor(200, state.level.size), 3);
    state.heli!.agl = 1;
    for (let i = 0; i < 10; i++) {
      state.t += 1;
      buildMinimap(state);
    }
    expect(buildMinimap(state).pose.scale).toBeCloseTo(pad, 3);
  });

  it("stays on the speedo's window while the machine flies without him", () => {
    const state = aloft(200, false);
    state.t += 1;
    expect(buildMinimap(state).pose.scale).toBeCloseTo(VIEW / ZOOM.close, 6);
  });

  it("is the helicopter's while he flies it: on its hub, turned by its nose", () => {
    const flown = aloft(50, true);
    const map = buildMinimap(flown);
    expect(map.pose.x).toBe(520);
    expect(map.pose.z).toBe(480);
    expect(map.pose.angle).toBeCloseTo(((1 + Math.PI) * 180) / Math.PI, 6);
    expect(map.flying).toEqual({ spool: 1 });
    // Without him it is a mark on the plate, and the plate is his own.
    const parked = buildMinimap(aloft(0, false));
    expect(parked.flying).toBeNull();
    expect(parked.pose.x).toBe(500);
    expect(parked.heli).toMatchObject({ x: 520, z: 480, heading: 1 });
  });

  it("turns the drawn rotor with the spool, still when all but stopped", () => {
    expect(rotorTurnMs(0)).toBeNull();
    expect(rotorTurnMs(0.04)).toBeNull();
    expect(rotorTurnMs(1)).toBe(480);
    expect(rotorTurnMs(0.3)).toBeGreaterThan(rotorTurnMs(0.8)!);
    // Quartered, so a spool-up restarts the spin only a few times.
    expect(rotorTurnMs(0.8)).toBe(rotorTurnMs(0.9));
  });
});

describe("the marks (minimap-view.ts)", () => {
  it("draws the piste once, in world metres, open from the start line to the finish", () => {
    const state = race();
    const map = buildMinimap(state);
    const pts = state.level.track.points;
    const last = pts[pts.length - 1];
    expect(map.track.startsWith(`M${pts[0].x.toFixed(1)} ${pts[0].z.toFixed(1)}`)).toBe(true);
    expect(map.track.endsWith(`L${last.x.toFixed(1)} ${last.z.toFixed(1)}`)).toBe(true);
    expect(map.track.includes("Z")).toBe(false);
    expect(map.trackWidth).toBeGreaterThanOrEqual(SLOPE.width * 0.9);
    // The same string object from one snapshot to the next — the DOM diff
    // is a comparison, not a re-parse.
    expect(buildMinimap(state).track).toBe(map.track);
  });

  it("lays the resort's runs and lifts under the course, cut once per map", () => {
    const bare = buildMinimap(race());
    expect(bare.runs).toEqual([]);
    expect(bare.lifts).toEqual([]);
    const base = syntheticLevel();
    const run = (id: string, kind: "piste" | "road", grade: "red" | "green") => ({
      id,
      kind,
      grade,
      points: base.track.points,
      length: base.track.length,
      from: "L1",
      into: null,
      drifts: [],
    });
    const level = {
      ...base,
      resort: {
        runs: [run("1", "piste", "red"), run("2", "road", "green")],
        lifts: [
          {
            id: "L1",
            kind: "chair" as const,
            bottom: { x: 100, y: 0, z: 900 },
            top: { x: 120, y: 300, z: 80 },
          },
        ],
        courses: [],
        course: "C1",
        village: { x: 0, y: 0, z: 0 },
      },
    };
    const state = createGame({ level, seed: 7, quiet: true });
    const map = buildMinimap(state);
    // The lane first, so every piste lies over it; a piste in its paint.
    expect(map.runs.map((r) => r.road)).toEqual([true, false]);
    expect(map.runs[1].paint).toBe(GRADE_LOOK.red.paint);
    expect(map.runs[1].d).toBe(map.track);
    expect(map.lifts).toEqual([{ id: "L1", a: [100, 900], b: [120, 80] }]);
    expect(buildMinimap(state).runs).toBe(map.runs);
  });

  it("names the gate owed, and the start gate", () => {
    const state = race();
    const map = buildMinimap(state);
    expect(map.checkpoints).toHaveLength(state.level.checkpoints.length);
    expect(map.checkpoints[0].state).toBe("owed");
    state.progress.nextCheckpoint = 2;
    const later = buildMinimap(state);
    expect(later.checkpoints[0].state).toBe("start");
    expect(later.checkpoints[2].state).toBe("owed");
    state.progress.missed = 2;
    expect(buildMinimap(state).checkpoints[2].state).toBe("missed");
  });

  it("puts every rival on the map in his start-line slot's colour", () => {
    const state = race();
    const map = buildMinimap(state);
    expect(map.rivals.map((r) => r.slot)).toEqual(state.rivals.map((r) => r.id + 1));
    for (const [i, r] of map.rivals.entries()) {
      expect(r.x).toBe(state.rivals[i].run.skier.x);
      expect(r.z).toBe(state.rivals[i].run.skier.z);
    }
    // A dot the same size on the plate at every zoom.
    expect(map.dot * map.pose.scale).toBeCloseTo(3.4, 6);
  });

  it("pins the owed gate to the rim once it is off the plate", () => {
    const state = race();
    const cp = state.level.checkpoints[0];
    // Right beside it: on the plate, so no chevron.
    placeRun(state, { x: cp.x, z: cp.z - 20, heading: 0 });
    expect(buildMinimap(state).chevron).toBeNull();
    // Four hundred metres out across the powder: on the rim, pointing at it.
    placeRun(state, { x: cp.x, z: cp.z - 400, heading: 0 });
    const chevron = buildMinimap(state).chevron!;
    expect(chevron).not.toBeNull();
    expect(Math.hypot(chevron.x - VIEW / 2, chevron.y - VIEW / 2)).toBeLessThan(VIEW / 2);
    // Dead ahead of a skier facing it: straight up the plate.
    expect(chevron.angle).toBeCloseTo(0, 3);
    expect(chevron.x).toBeCloseTo(VIEW / 2, 3);
    expect(chevron.y).toBeLessThan(VIEW / 2);
  });

  it("has nothing to point at once the finish is crossed", () => {
    const state = race();
    state.progress.finished = true;
    const map = buildMinimap(state);
    expect(map.chevron).toBeNull();
    expect(map.checkpoints.some((c) => c.state === "owed" || c.state === "missed")).toBe(false);
  });

  it("rides in the HUD's snapshot through a race", () => {
    const state = race();
    for (let i = 0; i < 6 * TUNING.physicsHz; i++) step(state, botInput(state));
    const snap = takeSnapshot(state);
    expect(snap.minimap.level).toBe(state.level);
    expect(snap.minimap.pose.x).toBe(state.skier.x);
    expect(snap.minimap.pose.z).toBe(state.skier.z);
  });
});
