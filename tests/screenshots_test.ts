// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// SCREENSHOTS — the part of taking a picture that is this game's: the
// caption a picture is filed under and the file name it leaves the game as.
//
// The arithmetic under the shutter — the roll capped and newest first, the
// stamp a signature at every size, a picture never blown UP, the HUD layer
// as one SVG — is the framework's (`@niclaslindstedt/oss-game-framework/
// shots`), and its own suite holds it. What needs a canvas or a document is
// judged by LOOKING, with `make screenshots`.

import { describe, expect, it } from "vitest";

import { shotFileName } from "@niclaslindstedt/oss-game-framework/shots/shot-plan";

import { STRINGS } from "../pwa/src/game/strings.ts";

describe("the caption (run-news.ts's shotLabel, strings-gallery.ts)", () => {
  it("names the mountain, the gate, the speed and the skis", () => {
    const label = STRINGS.shotLabel({ seed: 38, gate: 2, gates: 24, kmh: 94.4, skis: "Swift" });
    expect(label).toBe("SEED 38 · GATE 2/24 · 94 KM/H · SWIFT");
  });

  it("says FREE RIDE where there is no gate to count", () => {
    const label = STRINGS.shotLabel({ seed: 7, gate: null, gates: 24, kmh: 12, skis: "Marmot" });
    expect(label).toBe("SEED 7 · FREE RIDE · 12 KM/H · MARMOT");
  });

  it("slugs into a file name that still reads", () => {
    const label = STRINGS.shotLabel({ seed: 38, gate: 1, gates: 24, kmh: 60, skis: "Eagle" });
    expect(shotFileName("FallLine", label, Date.UTC(2026, 0, 1))).toBe(
      "fallline-seed-38-gate-1-24-60-km-h-eagle-2026-01-01-00-00-00.png",
    );
  });
});
