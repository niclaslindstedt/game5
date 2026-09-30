// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app mark's ski tracks are stated three times — as `d` strings in
// pwa/src/game/app-mark.ts, as the same two paths in the icon SVG, and as
// arc centres in scripts/generate-icons.mjs — and none can import the
// others. This holds the first two to each other (and the stroke width),
// so the runtime mark and the shipped icon cannot drift apart unnoticed.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MARK_TRAILS, MARK_WIDTH } from "../pwa/src/game/app-mark.ts";

const svg = readFileSync(
  fileURLToPath(new URL("../pwa/public/icons/icon.svg", import.meta.url)),
  "utf8",
);

describe("the app mark", () => {
  it("draws the same two track paths the icon SVG draws", () => {
    const paths = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1]);
    expect(paths).toEqual([...MARK_TRAILS]);
  });

  it("strokes them as wide as the icon does", () => {
    const width = /stroke-width="(\d+)"/.exec(svg);
    expect(width).not.toBeNull();
    expect(Number(width![1])).toBe(MARK_WIDTH);
  });
});
