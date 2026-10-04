// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE HUD'S PAYLOAD — what the readouts over a run are worked out FROM,
// read without a browser: the snapshot the HUD draws (`snapshot.ts`), the
// line each event earns in the news column (`run-news.ts`). Plus the strings
// table's own coverage: a word nobody reads is a word nobody fixes. (The
// press a second finger makes and the grip a thumb zone holds a finger by
// are the framework's `input/`, held by its own suite.)

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  BODY_PARTS,
  BONES,
  INJURIES,
  NEUTRAL_INPUT,
  TUNING,
  botInput,
  createGame,
  freshBody,
  placeRun,
  step,
  type GameEvent,
  type GameState,
} from "@engine";

import {
  BONE_ORDER,
  BONE_SHAPES,
  FIGURE,
  OUTLINE_POINTS,
  REGIONS,
  fractureOf,
} from "../pwa/src/game/body-figure.ts";
import { bodyTile, conditionOf, LINES, toneOf } from "../pwa/src/game/body-tile.ts";
import { newsFor } from "../pwa/src/game/run-news.ts";
import { AIR_SHOWN, gatesTaken, standingsOf, takeSnapshot } from "../pwa/src/game/snapshot.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { LONE_TREE, syntheticLevel } from "./support/synthetic.ts";

/** A race on the slope, three rivals on the start line and the lights on. */
function race(): GameState {
  return createGame({ level: syntheticLevel(), seed: 7, quiet: true });
}

/** Ride `seconds` of it on the bot. */
function ride(state: GameState, seconds: number): void {
  const steps = Math.round(seconds * TUNING.physicsHz);
  for (let i = 0; i < steps; i++) step(state, botInput(state));
}

describe("the snapshot (snapshot.ts)", () => {
  it("reads the lights, then GO, off the engine's own clock", () => {
    const state = race();
    const at = takeSnapshot(state);
    expect(at.countdown).toBe(3);
    expect(at.go).toBe(false);
    expect(at.skiers).toBe(4);
    expect(at.taken).toBe(0);
    expect(at.gates).toBe(state.level.checkpoints.length);
    expect(at.dropped).toBe(0);
    ride(state, state.rules.countdown + 0.2);
    const go = takeSnapshot(state);
    expect(go.countdown).toBe(0);
    expect(go.go).toBe(true);
    ride(state, 1.5);
    expect(takeSnapshot(state).go).toBe(false);
  });

  it("reads the speed, the edge, the tuck and the place straight off the engine", () => {
    const state = race();
    // Long enough to pole off the summit shelf and onto the face.
    ride(state, 20);
    const snap = takeSnapshot(state);
    expect(snap.speedKmh).toBeCloseTo(state.skier.speed * 3.6);
    // The edge as a share of the pair's full edge, in SCREEN space.
    expect(snap.edge).toBeCloseTo(-state.skier.edge / state.skier.spec.edgeMax, 9);
    expect(Math.abs(snap.edge)).toBeLessThanOrEqual(1.01);
    expect(snap.tuck).toBe(state.skier.crouch);
    expect(snap.tuck).toBeGreaterThanOrEqual(0);
    expect(snap.tuck).toBeLessThanOrEqual(1);
    // Twenty seconds in: off the shelf, some of the vertical is gone.
    expect(snap.dropped).toBeGreaterThan(0);
    expect(snap.place).toBeGreaterThanOrEqual(1);
    expect(snap.place).toBeLessThanOrEqual(4);
    expect(snap.result).toBe(null);
    expect(snap.standings).toBe(null);
  });

  it("counts the start gate as the first gate taken, and every gate through the finish", () => {
    const p = race().progress;
    expect(gatesTaken(p, 10)).toBe(0);
    expect(gatesTaken({ ...p, started: true, passed: 1 }, 10)).toBe(1);
    expect(gatesTaken({ ...p, started: true, passed: 7 }, 10)).toBe(7);
    // Never more than the piste has, and all of them through the finish.
    expect(gatesTaken({ ...p, started: true, passed: 12 }, 10)).toBe(10);
    expect(gatesTaken({ ...p, started: true, passed: 3, finished: true }, 10)).toBe(10);
  });

  it("points the arrow back at a missed gate, in screen space, until it is taken", () => {
    const state = race();
    expect(takeSnapshot(state).missed).toBe(null);
    state.progress.missed = 2;
    state.progress.nextCheckpoint = 2;
    const snap = takeSnapshot(state);
    expect(snap.missed).not.toBe(null);
    expect(snap.missed!.distance).toBeGreaterThan(0);
    expect(Math.abs(snap.missed!.angle)).toBeLessThanOrEqual(Math.PI + 1e-9);
  });

  it("times a flight only once it has lasted past AIR_SHOWN — a hop is not a jump", () => {
    const state = race();
    state.skier.airborne = true;
    state.skier.airTime = AIR_SHOWN - 0.05;
    expect(takeSnapshot(state).airTime).toBe(0);
    expect(takeSnapshot(state).airBest).toBe(false);
    state.skier.airTime = AIR_SHOWN + 0.05;
    expect(takeSnapshot(state).airTime).toBeCloseTo(AIR_SHOWN + 0.05, 9);
    // The best air reads nothing until a flight past the floor has landed.
    state.progress.bestAir = 0.3;
    expect(takeSnapshot(state).bestAir).toBe(0);
    state.progress.bestAir = 0.8;
    expect(takeSnapshot(state).bestAir).toBe(0.8);
  });

  it("bills the finish, and the whole field's table under it, live", () => {
    const state = race();
    ride(state, 6);
    state.progress.finished = true;
    state.progress.time = 181.5;
    state.progress.penalty = 6;
    state.rivals[1].run.progress.finished = true;
    state.rivals[1].run.progress.time = 170.25;
    const snap = takeSnapshot(state);
    expect(snap.result).not.toBe(null);
    const table = standingsOf(state);
    expect(table.map((s) => s.place)).toEqual([1, 2, 3, 4]);
    // Home first, by the clock; the field still out after them, billed by
    // the gates they have got to.
    expect(table[0]).toMatchObject({ slot: 3, time: 170.25, you: false });
    expect(table[1]).toMatchObject({ slot: 1, time: 181.5, you: true });
    expect(table[2].time).toBe(null);
    expect(table[2].taken).toBeGreaterThanOrEqual(0);
    expect(table[2].taken).toBeLessThan(state.level.checkpoints.length);
    expect(snap.result!.place).toBe(2);
    // The time is the clock, the slalom gates' charge already in it.
    expect(snap.result!.time).toBe(181.5);
    expect(snap.result!.penalty).toBe(6);
    expect(new Set(table.map((s) => s.slot)).size).toBe(4);
  });
});

describe("the damage instrument and the bogged hint (snapshot.ts)", () => {
  it("draws the damage only on a run with it, off the engine's figures", () => {
    expect(takeSnapshot(race()).damage).toBe(null);
    const state = createGame({ level: syntheticLevel(), damage: true, quiet: true });
    state.skier.damage.ski[1] = 0.4;
    state.skier.damage.legs = 0.25;
    expect(takeSnapshot(state).damage).toEqual({ skiLeft: 0, skiRight: 0.4, legs: 0.25 });
  });

  it("lights the reset the step the skier is thrown, and puts it out when he is stood up", () => {
    const state = createGame({ level: syntheticLevel(), rivals: 0, countdown: 0, quiet: true });
    placeRun(state, { x: LONE_TREE.x + 0.3, z: LONE_TREE.z - 30, heading: 0, speed: 50 / 3.6 });
    expect(takeSnapshot(state).down).toBe(false);
    const tuck = { ...NEUTRAL_INPUT, tuck: 1 };
    for (let i = 0; i < 6 * TUNING.physicsHz && !state.skier.thrown; i++) step(state, tuck);
    expect(state.skier.thrown).not.toBeNull();
    expect(takeSnapshot(state).down).toBe(true);
    // The press it lights answers at once.
    step(state, { ...NEUTRAL_INPUT, reset: true });
    expect(state.skier.thrown).toBeNull();
    expect(takeSnapshot(state).down).toBe(false);
  });

  it("says BOGGED while the skier is sunk in, and not while he is thrown off", () => {
    const state = race();
    expect(takeSnapshot(state).stuck).toBe(false);
    state.skier.trench = TUNING.trench.max;
    expect(takeSnapshot(state).stuck).toBe(true);
  });
});

describe("the body and the g meter (body-tile.ts)", () => {
  it("paints a part by its worst AIS rank and the body by its severity score's band", () => {
    expect([0, 1, 2, 3, 5].map(toneOf)).toEqual(["ok", "hurt", "spent", "dead", "dead"]);
    expect([0, 2, 6, 12, 20, 34].map(conditionOf)).toEqual([
      "sound",
      "bruised",
      "hurt",
      "injured",
      "serious",
      "critical",
    ]);
    const tile = takeSnapshot(race()).body;
    expect(tile.parts).toHaveLength(BODY_PARTS.length);
    expect(tile.parts.every((t) => t === "ok")).toBe(true);
    expect(tile.bones).toHaveLength(BONES.length);
    expect(tile.bones.every((t) => t === "sound")).toBe(true);
    expect(tile.condition).toBe("sound");
    expect(tile.blow).toBe(null);
  });

  it("lists the worst injuries first, the newest first within a rank, and counts the rest", () => {
    const body = freshBody();
    const take = (part: (typeof BODY_PARTS)[number], kind: keyof typeof INJURIES, t: number) => {
      const ais = INJURIES[kind].ais;
      body.injuries.push({ part, kind, ais, t });
      const i = BODY_PARTS.indexOf(part);
      body.worst[i] = Math.max(body.worst[i], ais);
    };
    take("handL", "sprainedThumb", 1);
    take("kneeR", "tornAcl", 2);
    take("head", "concussion", 3);
    take("pelvis", "brokenPelvis", 4);
    take("shinL", "bruisedShin", 5);
    const tile = bodyTile(body, 5.5);
    // The broken pelvis is the bone's to show, never a line or a paint.
    expect(tile.lines.map((l) => l.kind)).toEqual(["concussion", "tornAcl", "bruisedShin"]);
    expect(tile.lines).toHaveLength(LINES);
    expect(tile.more).toBe(1);
    expect(tile.lines[0].fresh).toBe(true);
    expect(tile.lines[1].fresh).toBe(false);
    expect(tile.parts[BODY_PARTS.indexOf("pelvis")]).toBe("ok");
    expect(tile.parts[BODY_PARTS.indexOf("kneeR")]).toBe("spent");
    expect(tile.bones[BONES.indexOf("pelvis")]).toBe("break");
    expect(tile.bones.filter((b) => b !== "sound")).toHaveLength(1);
    // Pelvis 3 (limbs), head 2, nothing else: 9 + 4.
    expect(tile.severity).toBe(13);
    expect(tile.condition).toBe("injured");
  });

  it("holds the blow on the meter for the engine's hold, and lights the part it struck", () => {
    const body = freshBody();
    body.impact = {
      g: 42,
      part: "head",
      source: "tree",
      t: 0.4,
      id: 3,
      fall: true,
      rival: -1,
      amateur: -1,
    };
    body.peak = 42;
    body.fallPeak = 42;
    const tile = bodyTile(body, 1);
    expect(tile.blow).toEqual({
      g: 42,
      part: "head",
      source: "tree",
      id: 3,
      age: 0.4 / TUNING.injury.hold,
    });
    expect(tile.struck).toBe("head");
    expect(tile.peak).toBe(42);
    body.impact.t = TUNING.injury.hold;
    expect(bodyTile(body, 3).blow).toBe(null);
  });

  it("shows no g for a blow nobody fell on", () => {
    const body = freshBody();
    body.impact = {
      g: 9,
      part: "back",
      source: "landing",
      t: 0.1,
      id: 1,
      fall: false,
      rival: -1,
      amateur: -1,
    };
    body.peak = 9;
    const tile = bodyTile(body, 1);
    expect(tile.blow).toBe(null);
    expect(tile.struck).toBe(null);
    expect(tile.peak).toBe(0);
  });

  it("bills a trunk met at speed on the meter, with an injury in plain words", () => {
    const state = createGame({ level: syntheticLevel(), rivals: 0, countdown: 0, quiet: true });
    placeRun(state, { x: LONE_TREE.x, z: LONE_TREE.z - 20, heading: 0, speed: 60 / 3.6 });
    let seen = 0;
    for (let i = 0; i < 3 * TUNING.physicsHz; i++) {
      step(state, NEUTRAL_INPUT);
      const blow = takeSnapshot(state).body.blow;
      if (blow) seen = Math.max(seen, blow.g);
    }
    expect(seen).toBeGreaterThan(TUNING.injury.shown);
    const first = state.skier.body.injuries[0];
    expect(STRINGS.injury(first.kind, first.part).length).toBeGreaterThan(0);
  });

  it("names every injury, and the side of a paired part", () => {
    for (const kind of Object.keys(INJURIES) as (keyof typeof INJURIES)[]) {
      const part = INJURIES[kind].part;
      const paired = !BODY_PARTS.includes(part as (typeof BODY_PARTS)[number]);
      const line = STRINGS.injury(
        kind,
        paired
          ? (`${part}L` as (typeof BODY_PARTS)[number])
          : (part as (typeof BODY_PARTS)[number]),
      );
      expect(line.trim().length, kind).toBeGreaterThan(0);
      if (paired) expect(line, kind).toContain("LEFT");
    }
  });
});

describe("the news column (run-news.ts)", () => {
  const state = race();
  const line = (e: GameEvent) => newsFor(e, state);

  it("opens the run at the start gate and bills every later gate with its clock", () => {
    expect(line({ kind: "checkpoint", t: 1, index: 0, lap: 0, split: 2 })?.text).toBe(
      STRINGS.newsStart,
    );
    expect(line({ kind: "checkpoint", t: 1, index: 3, lap: 0, split: 25 })).toEqual({
      text: STRINGS.newsCheckpoint(3, 25),
      tone: "good",
    });
  });

  it("leaves the finish line to the finish's own line, and says nothing of a lap", () => {
    const last = state.level.checkpoints.length - 1;
    expect(line({ kind: "checkpoint", t: 1, index: last, lap: 0, split: 90 })).toBe(null);
    expect(line({ kind: "lap", t: 1, lap: 1, time: 90 })).toBe(null);
    expect(line({ kind: "finish", t: 1, time: 180, place: 2 })?.text).toBe(
      STRINGS.newsFinish(2, 4, 180),
    );
    expect(line({ kind: "finish", t: 1, time: 180, place: 2 })?.tone).toBe("good");
  });

  it("says why the skier came off, that he is bogged, and what the blow cost", () => {
    for (const cause of ["tree", "nose", "roll", "catch"] as const) {
      expect(line({ kind: "wipeout", t: 1, cause, speed: 14, x: 0, z: 0 })).toEqual({
        text: STRINGS.newsWipeout(cause),
        tone: "bad",
      });
    }
    expect(line({ kind: "stuck", t: 1 })?.text).toBe(STRINGS.newsStuck);
    expect(line({ kind: "damage", t: 1, part: "skiRight", level: 0.3 })?.text).toBe(
      STRINGS.newsDamage("skiRight"),
    );
    expect(line({ kind: "damage", t: 1, part: "legs", level: 0.3 })?.text).toBe(
      STRINGS.newsDamage("legs"),
    );
  });

  it("says the bad news in the bad tone, and a clean landing not at all", () => {
    expect(line({ kind: "missed", t: 1, index: 4 })?.tone).toBe("bad");
    // A slalom gate skied past says what it put on the clock; a gate only
    // gone past (the arrow's) does not.
    expect(line({ kind: "missed", t: 1, index: 4, penalty: 3 })?.text).toBe(
      STRINGS.newsMissed(4, 3),
    );
    expect(STRINGS.newsMissed(4, 3)).toContain("+3 s");
    expect(line({ kind: "missed", t: 1, index: 4 })?.text).not.toContain("+");
    expect(line({ kind: "hit", t: 1, speed: 10, x: 0, z: 0 })?.tone).toBe("bad");
    const land = {
      kind: "land",
      t: 1,
      airTime: 1,
      impact: 9,
      speed: 20,
      lost: 0.1,
      g: 4,
      off: 0.2,
    } as const;
    expect(line({ ...land, harsh: true })?.tone).toBe("bad");
    expect(line({ ...land, harsh: false, lost: 0 })).toBe(null);
    expect(line({ kind: "count", t: 1, left: 3 })).toBe(null);
  });

  it("leaves every injury to the body panel — no news line, however bad", () => {
    const hurt = createGame({ level: syntheticLevel(), rivals: 0, quiet: true });
    const pelvis: GameEvent = {
      kind: "injury",
      t: 1,
      part: "pelvis",
      injury: "brokenPelvis",
      ais: 3,
    };
    hurt.events.push(pelvis);
    expect(newsFor(pelvis, hurt)).toBe(null);
  });
});

describe("the body as drawn (body-figure.ts)", () => {
  it("cuts every part but the back out of the one outline, and draws every bone once", () => {
    expect(Object.keys(REGIONS).sort()).toEqual(BODY_PARTS.filter((p) => p !== "back").sort());
    expect(Object.keys(BONE_SHAPES).sort()).toEqual([...BONES].sort());
    expect([...BONE_ORDER].sort()).toEqual([...BONES].sort());
    for (const bone of BONES) {
      const b = BONE_SHAPES[bone];
      expect(b.fill.length, bone).toBeGreaterThan(0);
      for (const d of [...b.fill, ...b.shade]) expect(d, bone).toMatch(/^(M[\d.,L-]+Z)+$/);
      const fr = fractureOf(bone);
      for (const d of [fr.fissure, fr.piece]) expect(d, bone).toMatch(/^(M[\d.,L-]+Z)+$/);
      expect(fr.move, bone).toMatch(/^translate\([-\d. ]+\) rotate\([-\d. ]+\)$/);
    }
  });

  it("puts every bone's crack ON the bone: its mark inside the bone's own shape", () => {
    // Even-odd over every ring of the bone's fill.
    const rings = (d: string): number[][][] =>
      d
        .split("Z")
        .filter(Boolean)
        .map((r) =>
          r
            .replace(/^M/, "")
            .split("L")
            .map((p) => p.split(",").map(Number)),
        );
    for (const bone of BONES) {
      const b = BONE_SHAPES[bone];
      let hit = false;
      for (const r of b.fill.flatMap(rings))
        for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
          const [xi, yi] = r[i];
          const [xj, yj] = r[j];
          if (
            yi > b.mark.y !== yj > b.mark.y &&
            b.mark.x < ((xj - xi) * (b.mark.y - yi)) / (yj - yi) + xi
          )
            hit = !hit;
        }
      expect(hit, bone).toBe(true);
    }
  });

  it("keeps every bone's mark inside the traced outline, his right on the viewer's left", () => {
    // Even-odd ray cast against the outline's corners.
    const inside = (x: number, y: number): boolean => {
      let hit = false;
      const P = OUTLINE_POINTS;
      for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
        const [xi, yi] = P[i];
        const [xj, yj] = P[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
      }
      return hit;
    };
    for (const bone of BONES) {
      const m = BONE_SHAPES[bone].mark;
      expect(inside(m.x, m.y), bone).toBe(true);
      if (bone.endsWith("R")) expect(m.x, bone).toBeLessThan(FIGURE.w / 2);
      if (bone.endsWith("L")) expect(m.x, bone).toBeGreaterThan(FIGURE.w / 2);
    }
  });
});

describe("the strings table (strings.ts, §39.1)", () => {
  /** Every source file of the app, strings.ts itself left out. */
  function appSources(dir: string): string {
    let out = "";
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) out += appSources(path);
      else if (/\.tsx?$/.test(name) && name !== "strings.ts") out += readFileSync(path, "utf8");
    }
    return out;
  }
  const sources = appSources(join(import.meta.dirname, "..", "pwa", "src"));

  it("has a word for every key, and every key is read somewhere", () => {
    for (const [key, value] of Object.entries(STRINGS)) {
      if (typeof value === "string") expect(value.trim().length, key).toBeGreaterThan(0);
      expect(sources.includes(`STRINGS.${key}`), `STRINGS.${key} is never read`).toBe(true);
    }
  });
});
