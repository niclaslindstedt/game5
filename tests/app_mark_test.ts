// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app mark is stated three times — as `d` strings and facet points in
// pwa/src/game/app-mark.ts, as the same paths and polygons in the icon SVG,
// and as arc centres and polygons in scripts/generate-icons.mjs — and none
// can import the others. This holds the first two to each other (the
// tracks, their width and colour, every facet and its fill), so the runtime
// mark and the shipped icon cannot drift apart unnoticed.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { MARK_FACE_COLOURS, MARK_PEAK, MARK_TRAILS, MARK_WIDTH } from "../pwa/src/game/app-mark.ts";
import { PALETTE } from "../pwa/src/identity.ts";

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

  it("strokes them in the flag's red", () => {
    const stroke = /<g[^>]*\sstroke="(#[0-9a-f]{6})"[^>]*stroke-width=/.exec(svg);
    expect(stroke?.[1]).toBe(PALETTE.flag);
  });

  it("paints the same facets, in the same order and colours, as the icon SVG", () => {
    const polygons = [...svg.matchAll(/<polygon\s+fill="([^"]+)"\s+points="([^"]+)"/g)].map(
      (m) => ({ fill: m[1], points: m[2] }),
    );
    expect(polygons).toEqual(
      MARK_PEAK.map((f) => ({ fill: MARK_FACE_COLOURS[f.face], points: f.points })),
    );
  });

  it("draws the faces in the palette's own snow, shadow and alpenglow", () => {
    expect(MARK_FACE_COLOURS.lit).toBe(PALETTE.snow);
    expect(MARK_FACE_COLOURS.shadow).toBe(PALETTE.snowShadow);
    expect(MARK_FACE_COLOURS.glow).toBe(PALETTE.alpenglow);
  });
});
