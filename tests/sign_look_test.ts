// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PISTE-HEAD SIGNS' WOOD AND HANDS, country by country (`sign-look.ts`):
// one row per region the engine knows, and every row's face a file the
// bundler can emit, carried with the licence it is redistributed under.
// A face shipped without its licence is a breach; a face nobody can load is
// a sign printed in the fallback forever.

import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { REGION_IDS } from "@engine";
import { describe, expect, it } from "vitest";

import { SIGN_LOOKS, signLookOf } from "../pwa/src/game/sign-look.ts";

describe("sign looks", () => {
  it("has a row for every region, and no other", () => {
    expect(Object.keys(SIGN_LOOKS).sort()).toEqual([...REGION_IDS].sort());
  });

  it("letters every country in a hand of its own", () => {
    const families = REGION_IDS.map((r) => SIGN_LOOKS[r].family);
    const files = REGION_IDS.map((r) => SIGN_LOOKS[r].url);
    expect(new Set(families).size).toBe(REGION_IDS.length);
    expect(new Set(files).size).toBe(REGION_IDS.length);
  });

  for (const region of REGION_IDS) {
    it(`${region}: the face is a small woff2 beside its licence`, () => {
      const path = fileURLToPath(SIGN_LOOKS[region].url);
      expect(path.endsWith(".woff2")).toBe(true);
      const bytes = readFileSync(path);
      expect(bytes.subarray(0, 4).toString("latin1")).toBe("wOF2");
      expect(statSync(path).size).toBeLessThan(80_000);
      const licence = path.replace(/\.woff2$/, ".LICENSE.txt");
      expect(existsSync(licence)).toBe(true);
      const text = readFileSync(licence, "utf8");
      expect(text).toMatch(/Copyright/);
      expect(text).toMatch(/SIL OPEN FONT LICENSE|Apache License/i);
    });
  }

  it("signs a map nobody asked a region of as the alpine", () => {
    expect(signLookOf(undefined)).toBe(SIGN_LOOKS.alpine);
  });
});
