// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// HOW HIGH HE IS (`pwa/src/game/altitude.ts`): on a dealt mountain the
// map's own height over the sea, untouched; on a REAL FACE the real
// altitude of the spot — the elevation model's height there plus what he
// stands over the snow — so its summit reads the real summit and its base
// the real valley station; and the BASE beside it, the lowest lift's foot,
// read the same way.

import { beforeAll, describe, expect, it } from "vitest";

import {
  faceHeight,
  generateLevel,
  loadRealFace,
  realFace,
  realHints,
  type GeneratedLevel,
  type RealFace,
} from "@engine";

import { altitudeAt, baseAltitude, overBase } from "../pwa/src/game/altitude.ts";
import { STRINGS } from "../pwa/src/game/strings.ts";
import { levelFor, LEVEL_SEEDS } from "./support/levels.ts";

describe("a dealt mountain's altitude", () => {
  it("is the map's own height over the sea, and its base the lowest lift's foot", () => {
    const level = levelFor(LEVEL_SEEDS[0]);
    const m = level.mountain!;
    for (const p of [m.summit, m.base, level.track.points[40]]) {
      expect(altitudeAt(level, p.x, p.y + 3, p.z)).toBeCloseTo(p.y + 3 - m.sea, 6);
    }
    const lifts = level.resort!.lifts;
    expect(lifts.length).toBeGreaterThan(0);
    const low = Math.min(...lifts.map((l) => l.bottom.y - m.sea));
    expect(baseAltitude(level)).toBeCloseTo(low, 6);
    expect(overBase(level, m.summit.x, m.summit.y, m.summit.z)).toBeCloseTo(
      m.summit.y - m.sea - low,
      6,
    );
  });
});

describe("a real face's altitude", () => {
  const id = "fell-1";
  let level: GeneratedLevel;
  let face: RealFace;
  beforeAll(async () => {
    await loadRealFace(id);
    level = generateLevel(1, { face: id });
    face = realFace(id)!;
  }, 120_000);

  it("reads the real summit and the real floor where they stand", () => {
    // The face's samples span the map's square, corner to corner.
    const n = Math.round(Math.sqrt(face.heights.length));
    const cell = level.size / (n - 1);
    let hi = 0;
    let lo = 0;
    for (let i = 1; i < face.heights.length; i++) {
      if (face.heights[i] > face.heights[hi]) hi = i;
      if (face.heights[i] < face.heights[lo]) lo = i;
    }
    for (const i of [hi, lo]) {
      const x = Math.min(level.size, (i % n) * cell);
      const z = Math.min(level.size, Math.floor(i / n) * cell);
      const y = level.groundAt(x, z);
      expect(Math.abs(altitudeAt(level, x, y, z)! - face.heights[i])).toBeLessThan(3);
    }
  });

  it("is the map's height over the snow where he is in the air", () => {
    const p = level.track.points[60];
    const on = altitudeAt(level, p.x, level.groundAt(p.x, p.z), p.z)!;
    expect(altitudeAt(level, p.x, level.groundAt(p.x, p.z) + 12, p.z)! - on).toBeCloseTo(12, 6);
    expect(on).toBeCloseTo(faceHeight(face, p.x, p.z), 6);
  });

  // The game's lifts are laid along the real ones, their stations stood a
  // little off the real ones where the ground asks it.
  it("stands the base at the real ski area's valley station", () => {
    const hints = realHints(id)!;
    const real = Math.min(...hints.lifts.map((l) => faceHeight(face, l.bottom.x, l.bottom.z)));
    const base = baseAltitude(level)!;
    expect(Math.abs(base - real)).toBeLessThan(25);
    // The lifts' tops read the real tops' altitudes too, give or take the
    // few tens of metres a station is moved to stand on the dealt ridge.
    const top = Math.max(
      ...level.resort!.lifts.map((l) => altitudeAt(level, l.top.x, l.top.y, l.top.z)!),
    );
    const realTop = Math.max(...hints.lifts.map((l) => faceHeight(face, l.top.x, l.top.z)));
    expect(Math.abs(top - realTop)).toBeLessThan(60);
    // The real drop, never the vertical the map was stretched to.
    expect(top - base).toBeLessThan(level.mountain!.vertical);
  });
});

describe("the base's word", () => {
  it("signs the height over the base either way", () => {
    expect(STRINGS.overBase(23.4)).toBe("BASE +23 M");
    expect(STRINGS.overBase(-7.6)).toBe("BASE −8 M");
    expect(STRINGS.overBase(0.2)).toBe("BASE +0 M");
  });
});
