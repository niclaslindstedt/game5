// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH DOWNHILL BIKE AND RIDER ARE DRAWN — the placeholder (`bike-view.ts`
// and the dressed skier laid on it by `skier-bike.ts`), or the procedural
// rig: the detailed bike built in code (`bike-dh-build.ts`) and the
// downhill rider solved on it by inverse kinematics every frame
// (`bike-rider-ik.ts`, `bike-rider-build.ts`). OFF unless asked for: a
// page's `?bikerig=ik` (`code` the placeholder), or the build's
// `VITE_BIKE_RIG=ik`. Read once, at the first ask.

let on: boolean | null = null;

export function bikeRigIk(): boolean {
  if (on !== null) return on;
  let asked = "";
  try {
    asked = new URLSearchParams(globalThis.location?.search ?? "").get("bikerig") ?? "";
  } catch {
    asked = "";
  }
  if (!asked) {
    const env = (import.meta as { env?: Record<string, unknown> }).env;
    asked = String(env?.VITE_BIKE_RIG ?? "");
  }
  on = asked.trim().toLowerCase() === "ik";
  return on;
}
