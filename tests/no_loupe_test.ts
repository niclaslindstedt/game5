// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import { isSecondTap, isTap, SECOND_TAP_MS, TAP_SLOP_PX } from "../pwa/src/game/no-loupe-tap.ts";

describe("the loupe guard", () => {
  it("takes a touch soon after another for the second tap iOS would zoom or magnify on", () => {
    expect(isSecondTap(-Infinity, 0)).toBe(false);
    expect(isSecondTap(1000, 1000 + SECOND_TAP_MS / 2)).toBe(true);
    expect(isSecondTap(1000, 1000 + SECOND_TAP_MS)).toBe(false);
  });

  it("owes a click only to a touch that stayed put", () => {
    expect(isTap(10, 10, 10 + TAP_SLOP_PX / 2, 10)).toBe(true);
    expect(isTap(10, 10, 10 + TAP_SLOP_PX * 2, 10)).toBe(false);
  });
});
