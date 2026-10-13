// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE TWO RUNGS (`camera.ts`'s `aboard`, `settings.ts`'s `Cameras`): the
// lens keeps one rung for the skier and one for the machines he rides, so a
// cockpit picked in the air is never his own eyes once he jumps out; and a
// stored blob from before the split hands its one rung to the machines.

import { describe, expect, it } from "vitest";
import { createLens } from "../pwa/src/game/camera.ts";
import { DEFAULT_CAMERA, mergeSettings } from "../pwa/src/game/settings.ts";

describe("the lens on and off a machine", () => {
  it("flies to the machine's rung aboard and back to his own off it", () => {
    const lens = createLens(0.1, 1000);
    lens.set("chase", true, "helmet");
    expect(lens.rung()).toBe("chase");
    lens.aboard(true);
    expect(lens.rung()).toBe("helmet");
    expect(lens.riding()).toBe(true);
    lens.aboard(false); // out of the door
    expect(lens.rung()).toBe("chase");
  });

  it("starts on the machine's rung when a run starts aboard", () => {
    const lens = createLens(0.1, 1000);
    lens.set("far", true, "tips");
    lens.aboard(true);
    expect(lens.rung()).toBe("tips");
    expect(lens.flying()).toBe(false); // nothing framed yet: a cut
  });

  it("changes only where he is when handed both rungs", () => {
    const lens = createLens(0.1, 1000);
    lens.aboard(true);
    lens.set("chase", false, "high");
    expect(lens.rung()).toBe("high");
    lens.aboard(false);
    expect(lens.rung()).toBe("chase");
  });
});

describe("the two rungs stored", () => {
  it("defaults both to the close chase", () => {
    const s = mergeSettings({});
    expect(s.camera).toBe("chase");
    expect(s.craftCamera).toBe("chase");
    expect(DEFAULT_CAMERA).toBe("chase");
  });

  it("hands an old blob's rung to the machines and the skier the chase", () => {
    const s = mergeSettings({ camera: "helmet" });
    expect(s.craftCamera).toBe("helmet");
    expect(s.camera).toBe(DEFAULT_CAMERA);
  });

  it("keeps both once both are stored", () => {
    const s = mergeSettings({ camera: "far", craftCamera: "tips" });
    expect(s.camera).toBe("far");
    expect(s.craftCamera).toBe("tips");
  });
});
