// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// A LOAD IS NEVER HELD FOR GOOD BY A COMPILE (`scene-compile.ts`): three's
// wait on a program's completion never ends once the context is lost, so a
// phone that took the GPU back mid-load left the loading card up for good.
import { describe, expect, it } from "vitest";
import type * as THREE from "three";
import { compiled } from "../pwa/src/game/scene-compile.ts";

const fakeGl = (lost: { now: boolean }): THREE.WebGLRenderer =>
  ({ getContext: () => ({ isContextLost: () => lost.now }) }) as unknown as THREE.WebGLRenderer;

const never = new Promise<void>(() => {});

describe("a compile waited on", () => {
  it("is let go once the context is lost", async () => {
    const lost = { now: false };
    const wait = compiled(fakeGl(lost), never, 60_000);
    setTimeout(() => (lost.now = true), 50);
    await expect(wait).resolves.toBeUndefined();
  });

  it("is let go after its limit", async () => {
    const at = performance.now();
    await compiled(fakeGl({ now: false }), never, 250);
    expect(performance.now() - at).toBeGreaterThanOrEqual(240);
  });

  it("ends with the compile when that comes first", async () => {
    const at = performance.now();
    await compiled(fakeGl({ now: false }), Promise.resolve(), 60_000);
    expect(performance.now() - at).toBeLessThan(1000);
  });
});
