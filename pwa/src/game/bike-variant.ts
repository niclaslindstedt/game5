// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHICH DOWNHILL BIKE IS DRAWN, and how its rider rides it — the summer
// bike's look as a SWITCH, so a candidate look stands beside the one the
// game ships and either can be shown:
//
//   trail     the code-built placeholder (`bike-view.ts`), the rider in his
//             own ski kit in the plain attack stance (`skier-bike.ts`);
//   freeride  the big-mountain freeride bike (`bike-freeride.ts`), the rider
//             in a freerider's kit (`Outfit.bike`) riding it with style —
//             whips and tables off the jumps, a foot out through a slide
//             (`bike-ride-style.ts`).
//
// Chosen by a link's `?bikelook=freeride` (`url-params.ts`) or the build's
// `VITE_BIKE_LOOK=freeride`; the trail look otherwise. Presentation only.

export type BikeLook = "trail" | "freeride";

export const BIKE_LOOKS: readonly BikeLook[] = ["trail", "freeride"];

/** A look read off anything — a link's word, an environment variable. */
export function bikeLookOf(value: unknown): BikeLook | null {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  return (BIKE_LOOKS as readonly string[]).includes(v) ? (v as BikeLook) : null;
}

let look: BikeLook =
  bikeLookOf((import.meta as { env?: Record<string, unknown> }).env?.VITE_BIKE_LOOK) ?? "trail";

/** The look the bike is drawn in. */
export const bikeLook = (): BikeLook => look;

/** Draw the bike in `next` from the next ride on. */
export function setBikeLook(next: BikeLook): void {
  look = next;
}
