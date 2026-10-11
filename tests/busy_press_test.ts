// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The press that stands a run up answers first and works after:
// `afterFrames` hands frames back before the work, so the busy mark is on
// the glass before a free ride's mountain takes the main thread.
import { afterEach, describe, expect, it, vi } from "vitest";

import { afterFrames } from "../pwa/src/game/busy-press.ts";

describe("the busy press", () => {
  let queue: (() => void)[] = [];
  const frame = (): void => {
    const now = queue;
    queue = [];
    for (const f of now) f();
  };
  vi.stubGlobal("requestAnimationFrame", (f: () => void) => queue.push(f));
  vi.stubGlobal("cancelAnimationFrame", (id: number) => {
    queue[id - 1] = () => {};
  });
  afterEach(() => (queue = []));

  it("runs the work only after two frames are handed back", () => {
    let ran = 0;
    afterFrames(() => ran++);
    expect(ran).toBe(0);
    frame();
    expect(ran).toBe(0);
    frame();
    expect(ran).toBe(1);
    frame();
    expect(ran).toBe(1);
  });

  it("never runs the work once cancelled", () => {
    let ran = 0;
    const cancel = afterFrames(() => ran++);
    frame();
    cancel();
    frame();
    frame();
    expect(ran).toBe(0);
  });
});
