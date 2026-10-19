// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT A BUILD CARRIES (`pwa/src/game/edition.ts`): every build carries the
// gore and the developer page unless a switch says otherwise, and the store
// app's bundle says otherwise — no phone build shows the wounds, and the App
// Store build lets no developer page out, so the races behind it stay shut.
import { afterEach, describe, expect, it, vi } from "vitest";

/** settings.ts as a build with these switches would read it. */
async function settingsUnder(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import("../pwa/src/game/settings.ts");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("a build's edition", () => {
  it("carries the gore and the developer page unless switched off", async () => {
    const s = await settingsUnder({});
    const fresh = s.freshSettings();
    expect(s.injuriesShown(fresh, null)).toBe(true);
    expect(s.racesOpen({ developer: true })).toBe(true);
    expect(s.mergeSettings({ developer: true }).developer).toBe(true);
  });

  it("shows no injuries without the gore, whatever was picked or stored", async () => {
    const s = await settingsUnder({ VITE_GORE: "off" });
    const picked = { ...s.freshSettings(), injuries: true, xray: true, bodyHud: true };
    expect(s.injuriesShown(picked, null)).toBe(false);
    expect(s.injuriesShown(s.mergeSettings({ injuries: true }), null)).toBe(false);
  });

  it("lets no developer page out without it, so the races stay shut", async () => {
    const s = await settingsUnder({ VITE_DEVELOPER: "off" });
    expect(s.mergeSettings({ developer: true }).developer).toBe(false);
    expect(s.racesOpen({ developer: true })).toBe(false);
  });
});
