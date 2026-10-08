// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TITLE SCENE'S PLATES (`pwa/src/title/`, rendered in Blender by
// `make title-scene` and published by `scripts/title-plates.mjs`): every
// plate committed at its size and within its budget, none older than the
// sources it is made from, and the frame's JSON telling the title stage
// what it must know — the sun, the skyline, the spray, the subject, the two
// safe crops inside the plate and holding him, and the lens.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";
import { SKIS } from "@engine";

import { sourcesHash } from "../pwa/models-plugin.ts";
import {
  TITLE_DIR,
  TITLE_PLATES,
  TITLE_SOURCES,
  type TitlePlate,
} from "../pwa/src/title/plates.ts";

const root = join(import.meta.dirname, "..");
const at = (f: string): string => join(root, TITLE_DIR, f);

/** A WebP's canvas, read off its RIFF header (lossy `VP8 `, lossless
 * `VP8L` or extended `VP8X`), and whether it carries an alpha channel. */
function webpCanvas(bytes: Buffer): { w: number; h: number; alpha: boolean } {
  expect(bytes.toString("ascii", 0, 4)).toBe("RIFF");
  expect(bytes.toString("ascii", 8, 12)).toBe("WEBP");
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8X") {
    const w = 1 + bytes.readUIntLE(24, 3);
    const h = 1 + bytes.readUIntLE(27, 3);
    return { w, h, alpha: (bytes[20] & 0x10) !== 0 };
  }
  if (chunk === "VP8L") {
    const b = bytes.readUInt32LE(21);
    return { w: 1 + (b & 0x3fff), h: 1 + ((b >> 14) & 0x3fff), alpha: ((b >> 28) & 1) === 1 };
  }
  return { w: bytes.readUInt16LE(26) & 0x3fff, h: bytes.readUInt16LE(28) & 0x3fff, alpha: false };
}

const unit = (p: readonly number[]): boolean => p.every((x) => x >= 0 && x <= 1);

describe("the title scene's plates", () => {
  it("are committed, each square at its size and within its budget", () => {
    for (const [file, { size, budget }] of Object.entries(TITLE_PLATES)) {
      expect(existsSync(at(file)), file).toBe(true);
      const bytes = readFileSync(at(file));
      expect(bytes.byteLength, file).toBeLessThanOrEqual(budget);
      const canvas = webpCanvas(bytes);
      expect([canvas.w, canvas.h], file).toEqual([size, size]);
    }
    expect(webpCanvas(readFileSync(at("title-aux.webp"))).alpha).toBe(true);
  });

  it("are no older than what they are made from (else `make title-scene`)", () => {
    for (const f of TITLE_SOURCES) expect(existsSync(join(root, f)), f).toBe(true);
    // The pair he rides is the reference pair, the one the kind poses.
    expect(TITLE_SOURCES).toContain(`pwa/models/${SKIS.id}.glb`);
    const stamp = JSON.parse(readFileSync(at("sources.json"), "utf8")) as { sources: string };
    expect(stamp.sources).toBe(sourcesHash(root, TITLE_SOURCES));
  });

  it("carry the frame's facts for the title stage", () => {
    const plate = JSON.parse(readFileSync(at("title-plate.json"), "utf8")) as TitlePlate;
    expect(plate.size).toBe(TITLE_PLATES["title-colour.webp"].size);
    expect(plate.aux).toBe(TITLE_PLATES["title-aux.webp"].size);
    // The sun low, in the upper right of the plate (it may stand over it).
    expect(plate.sunElevation).toBeGreaterThan(0);
    expect(plate.sunElevation).toBeLessThan(30);
    expect(plate.sun[0]).toBeGreaterThan(0.5);
    expect(plate.sun[1]).toBeLessThan(0.5);
    // The skyline runs left to right across the plate.
    expect(plate.ridge.length).toBeGreaterThan(8);
    for (const p of plate.ridge) expect(unit(p)).toBe(true);
    const us = plate.ridge.map((p) => p[0]);
    expect(us).toEqual([...us].sort((a, b) => a - b));
    expect(unit(plate.spray.uv)).toBe(true);
    expect(plate.spray.radius).toBeGreaterThan(0);
    expect(unit(plate.subject)).toBe(true);
    expect(plate.camera.lens).toBeGreaterThan(0);
    expect(plate.camera.sensor).toBeGreaterThan(0);
    expect(plate.depth.far).toBeGreaterThan(plate.depth.near);
  });

  it("have two safe crops inside the plate, each holding the skier", () => {
    const plate = JSON.parse(readFileSync(at("title-plate.json"), "utf8")) as TitlePlate;
    const [sx, sy] = plate.subject;
    const crops = [
      [plate.crops.landscape, 16 / 9],
      [plate.crops.portrait, 9 / 19.5],
    ] as const;
    for (const [[x, y, w, h], aspect] of crops) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(1 + 1e-6);
      expect(y + h).toBeLessThanOrEqual(1 + 1e-6);
      expect(w / h).toBeCloseTo(aspect, 2);
      expect(sx).toBeGreaterThan(x);
      expect(sx).toBeLessThan(x + w);
      expect(sy).toBeGreaterThan(y);
      expect(sy).toBeLessThan(y + h);
    }
    // The wide band keeps its left third for the menu: he stands right of
    // it. The tall column keeps its lower part for the menu: he stands over
    // it.
    const [lx, , lw] = plate.crops.landscape;
    expect((sx - lx) / lw).toBeGreaterThan(0.4);
    const [, py, , ph] = plate.crops.portrait;
    expect((sy - py) / ph).toBeLessThan(0.55);
  });
});
