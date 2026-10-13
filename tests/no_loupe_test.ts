// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { describe, expect, it } from "vitest";

import {
  ECHO_MS,
  isEcho,
  isSecondTap,
  isTap,
  loupeAction,
  SECOND_TAP_MS,
  TAP_SLOP_PX,
} from "../pwa/src/game/no-loupe-tap.ts";

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

  it("cancels a second tap only when it can give the click back, so a stepper never skips or sticks", () => {
    const end = { second: true, cancelable: true, editable: false, tap: true };
    expect(loupeAction(end)).toBe("take");
    // An end the browser will not cancel still clicks: a click of ours too
    // would step the row twice.
    expect(loupeAction({ ...end, cancelable: false })).toBe("leave");
    // A finger that rolled past the slop: cancelling would lose the press.
    expect(loupeAction({ ...end, tap: false })).toBe("leave");
    expect(loupeAction({ ...end, second: false })).toBe("leave");
    expect(loupeAction({ ...end, editable: true })).toBe("leave");
  });
});

describe("the loupe guard's echo", () => {
  const given = { at: 1000 };
  const click = { at: 1010, trusted: true, same: true };

  it("swallows the browser's own click after a click given back, so a quick tap steps once", () => {
    expect(isEcho(given, click)).toBe(true);
  });

  it("lets every other click through", () => {
    // Nothing given back: the browser's click is the only one.
    expect(isEcho(null, click)).toBe(false);
    // The guard's own click, and the menu cursor's.
    expect(isEcho(given, { ...click, trusted: false })).toBe(false);
    // A press somewhere else.
    expect(isEcho(given, { ...click, same: false })).toBe(false);
    // Long after: no browser takes that long, so it is a press of its own.
    expect(isEcho(given, { ...click, at: given.at + ECHO_MS })).toBe(false);
  });
});
