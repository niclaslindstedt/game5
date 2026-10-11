// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE RANGE OF BOARDS (`defs/boards.ts`): six snowboards, each a real class
// with its numbers inside the class's bands — the all-mountain twin, the
// beginner's, the park's, the powder board, the big-mountain charger and
// the alpine carver — each its own topsheet and profile (`board-look.ts`),
// ridden by the engine through the board's path; and the gear the player
// keeps (`Settings.kept`): the skis and the board he last picked, each read
// back from an old blob that never stored them.

import { describe, expect, it } from "vitest";

import {
  BOARD_CATALOG,
  LYNX,
  NEUTRAL_INPUT,
  SKI_CATALOG,
  TOP_SPEED_PITCH,
  TUNING,
  createGame,
  isBoard,
  placeRun,
  step,
  terminalSpeed,
  type SkiSpec,
} from "@engine";
import { profileOf, sheetOf } from "../pwa/src/game/board-look.ts";
import { boardOf } from "../pwa/src/game/board-input.ts";
import { kindPair, mergeSettings, pickPair } from "../pwa/src/game/settings.ts";
import { flatLevel } from "./support/synthetic.ts";

const byId = (id: string): SkiSpec => BOARD_CATALOG.find((b) => b.id === id)!;

/** Each class's measured bands: length (m), waist (m), sidecut (m) and the
 * stance's binding angles (deg, front and back). */
const BANDS: Record<
  string,
  { len: number[]; waist: number[]; r: number[]; front: number[]; back: number[] }
> = {
  lynx: { len: [1.5, 1.62], waist: [0.245, 0.26], r: [7.5, 8.5], front: [9, 21], back: [-21, 0] },
  pika: { len: [1.4, 1.55], waist: [0.24, 0.26], r: [6.5, 7.8], front: [9, 18], back: [-9, 6] },
  stoat: {
    len: [1.45, 1.56],
    waist: [0.245, 0.26],
    r: [6.8, 7.8],
    front: [12, 21],
    back: [-21, -12],
  },
  ptarmigan: { len: [1.56, 1.7], waist: [0.26, 0.28], r: [8, 10], front: [15, 24], back: [-12, 0] },
  wolf: { len: [1.58, 1.7], waist: [0.25, 0.265], r: [8.5, 11], front: [15, 24], back: [-9, 6] },
  goshawk: { len: [1.6, 1.85], waist: [0.18, 0.21], r: [11, 16], front: [45, 65], back: [40, 60] },
};

const deg = (rad: number): number => (rad * 180) / Math.PI;

describe("the range of boards", () => {
  it("is six boards, the Lynx first, every one off the ski rack", () => {
    expect(BOARD_CATALOG.map((b) => b.id)).toEqual([
      "lynx",
      "pika",
      "stoat",
      "ptarmigan",
      "wolf",
      "goshawk",
    ]);
    expect(BOARD_CATALOG[0]).toBe(LYNX);
    expect(BOARD_CATALOG.every(isBoard)).toBe(true);
    expect(SKI_CATALOG.some(isBoard)).toBe(false);
    expect(new Set(BOARD_CATALOG.map((b) => b.name)).size).toBe(BOARD_CATALOG.length);
  });

  it("states every board inside its class's bands", () => {
    for (const b of BOARD_CATALOG) {
      const band = BANDS[b.id];
      const inside = (v: number, [lo, hi]: number[]): void => {
        expect(v, b.id).toBeGreaterThanOrEqual(lo);
        expect(v, b.id).toBeLessThanOrEqual(hi);
      };
      inside(b.length, band.len);
      inside(b.waist, band.waist);
      inside(b.sidecut, band.r);
      inside(deg(b.board!.front), band.front);
      inside(deg(b.board!.back), band.back);
    }
  });

  it("states its widths and its sidecut together, as the skis' are", () => {
    for (const b of BOARD_CATALOG) {
      const c = 0.76 * b.length;
      const d = ((b.tipWidth + b.tailWidth) / 2 - b.waist) / 2;
      const r = (c * c) / (8 * d) + d / 2;
      expect(Math.abs(r - b.sidecut) / b.sidecut, b.id).toBeLessThan(0.03);
    }
  });

  it("bills a top speed its own physics reaches, the carver fastest and the beginner's slowest", () => {
    for (const b of BOARD_CATALOG) {
      expect(Math.abs(terminalSpeed(b, TOP_SPEED_PITCH) * 3.6 - b.topSpeed), b.id).toBeLessThan(
        1.5,
      );
    }
    const top = [...BOARD_CATALOG].sort((a, b) => a.topSpeed - b.topSpeed).map((b) => b.id);
    expect(top[0]).toBe("pika");
    expect(top.at(-1)).toBe("goshawk");
  });

  it("tops out in a tuck where it bills it", () => {
    const pitch = flatLevel({
      packed: 1,
      grade: Math.tan(TOP_SPEED_PITCH),
      slopeFrom: 200,
      size: 4000,
    });
    for (const b of BOARD_CATALOG) {
      const state = createGame({ level: pitch, spec: b, rivals: 0, countdown: 0, quiet: true });
      placeRun(state, { x: 2000, z: 210, heading: 0, speed: 2 });
      for (let i = 0; i < 30 * TUNING.physicsHz; i++) step(state, { ...NEUTRAL_INPUT, tuck: 1 });
      const kmh = state.skier.speed * 3.6;
      expect(state.skier.thrown, b.id).toBeNull();
      expect(kmh, b.id).toBeGreaterThan(b.topSpeed * 0.9);
      expect(kmh, b.id).toBeLessThan(b.topSpeed * 1.1);
    }
  });

  it("gives each class its answer: the carver the most edge, the powder board the most deck", () => {
    const most = (f: (b: SkiSpec) => number): string =>
      [...BOARD_CATALOG].sort((a, b) => f(b) - f(a))[0].id;
    expect(most((b) => b.edgeMax)).toBe("goshawk");
    expect(most((b) => b.length * b.waist)).toBe("ptarmigan");
    expect(most((b) => b.rocker)).toBe("pika");
    expect(most((b) => b.flex)).toBe("goshawk");
    // A directional board is mounted back of its middle; a twin on it.
    for (const id of ["lynx", "pika", "stoat"]) expect(byId(id).mount).toBe(0.5);
    for (const id of ["ptarmigan", "wolf", "goshawk"]) expect(byId(id).mount).toBeLessThan(0.5);
  });

  it("draws each board in its own topsheet and profile, the Lynx as it was", () => {
    const sheets = BOARD_CATALOG.map((b) => sheetOf(b.id));
    expect(new Set(sheets.map((s) => s.paint)).size).toBe(BOARD_CATALOG.length);
    sheets.forEach((s, i) => expect(s.name).toBe(BOARD_CATALOG[i].name));
    expect(boardOf(LYNX).setback).toBe(0);
    expect(boardOf(byId("ptarmigan")).setback).toBeCloseTo(0.04, 9);
    expect(profileOf("goshawk")).not.toEqual(profileOf("lynx"));
  });
});

describe("the gear the player keeps", () => {
  it("reads an old blob's pair into the kind it is, and keeps the other kind's default", () => {
    const skis = mergeSettings({ skis: "marmot" });
    expect(skis.kept).toEqual({ skis: "marmot", board: "lynx" });
    const board = mergeSettings({ skis: "lynx" });
    expect(board.kept).toEqual({ skis: "chamois", board: "lynx" });
    expect(mergeSettings({}).kept).toEqual({ skis: "chamois", board: "lynx" });
    expect(mergeSettings({ skis: "wolf", kept: { skis: "swift", board: "nope" } }).kept).toEqual({
      skis: "swift",
      board: "wolf",
    });
  });

  it("keeps each kind's last pick as the other kind is ridden", () => {
    let s = mergeSettings({});
    s = pickPair(s, "goshawk");
    expect(s.skis).toBe("goshawk");
    s = pickPair(s, "hare");
    expect(s.kept).toEqual({ skis: "hare", board: "goshawk" });
    expect(kindPair(s, true)).toBe("goshawk");
    expect(kindPair(s, false)).toBe("hare");
  });
});
