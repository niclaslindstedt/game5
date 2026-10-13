// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH DOWNHILL BIKE IS DRAWN — the code's placeholder (`bike-view.ts`)
// or one of the bikes built beside it to replace it, each hung on the same
// nodes and posed off the same `BikePose`, so any of them can be swapped in
// without the physics, the lens or the rider knowing. Picked for a visit by
// a link's `?bikelook=<id>` (`url-params.ts`) or for a build by
// `VITE_BIKE_LOOK`; the placeholder otherwise. Its rider dresses to match
// (`racesInKit`).
//
// DOM-free and three-free: the view asks it which to build.

/** The bikes there are to draw. */
export const BIKE_LOOKS = ["placeholder", "worldcup"] as const;
export type BikeLookId = (typeof BIKE_LOOKS)[number];

export const isBikeLook = (s: unknown): s is BikeLookId =>
  typeof s === "string" && (BIKE_LOOKS as readonly string[]).includes(s);

/** A link's `?bikelook=` (`url-params.ts` documents it), else the build's. */
const fromBuild = (): BikeLookId => {
  const search = (globalThis as { location?: { search?: string } }).location?.search;
  const asked = search ? new URLSearchParams(search).get("bikelook") : null;
  if (isBikeLook(asked)) return asked;
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const id = env?.VITE_BIKE_LOOK;
  return isBikeLook(id) ? id : "placeholder";
};

let chosen: BikeLookId | null = null;

/** This visit's bike, a link's pick over the build's. */
export function setBikeLook(id: BikeLookId | null): void {
  chosen = id;
}

/** The bike drawn now. */
export function bikeLook(): BikeLookId {
  return chosen ?? fromBuild();
}

/** Whether the rider wears the race kit (`dress-racer.ts`) on this bike. */
export function racesInKit(): boolean {
  return bikeLook() === "worldcup";
}
