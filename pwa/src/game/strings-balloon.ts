// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE HOT AIR BALLOON (`balloon.ts`) — a block of the one
// strings table (`strings.ts`, §39.1), stated next door and spread into
// `STRINGS` under the same names, as the paramotor's are: the start card's
// RUN stop, the HUD's instruments and calls, and the news a flight earns.

export const BALLOON_STRINGS = {
  /** The RUN row's stop: the ride begun in the basket on the valley floor. */
  startRunBalloon: "BALLOON",

  /* ── THE HUD (hud-balloon.tsx) ─────────────────────────────────────── */
  balloonAlt: "ALT",
  balloonAltValue: (m: number): string => `${Math.round(m)} M`,
  balloonSea: "MSL",
  balloonVario: "VARIO",
  balloonVarioValue: (v: number): string => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`,
  balloonTemp: "ENV",
  balloonTempValue: (c: number): string => `${Math.round(c)}°`,
  balloonFuel: "FUEL",
  balloonFuelValue: (kg: number): string => `${Math.round(kg)} KG`,
  balloonWind: "WIND",
  balloonWindValue: (kmh: number): string => `${Math.round(kmh)}`,
  /** THE CALLS (`balloon-hud.ts`'s `balloonCall`). */
  balloonCallFire: "FIRE — JUMP!",
  balloonCallHot: "ENVELOPE HOT",
  balloonCallSink: "SINKING — BURN!",
  balloonCallEmpty: "OUT OF PROPANE",
  balloonCallTether: "ON THE TETHER",
  balloonCallLanded: "LANDED — STEP OUT",
  balloonCallBurn: "BURN",
  /** The hint under the strip: how to fly it, and the way out. */
  balloonHint: (touch: boolean, key: string): string =>
    touch
      ? "HOLD BURN TO CLIMB · VENT TO SINK · LEFT PAD WALKS"
      : `HOLD ↑ TO BURN · ↓ VENTS · ← → AND THE LEAN WALK · ${key} JUMPS`,
  balloonTetherHint: (touch: boolean): string =>
    touch ? "HOLD BURN UNTIL IT LIFTS" : "HOLD ↑ UNTIL IT LIFTS",
  balloonStepHint: (touch: boolean, key: string): string =>
    touch ? "TAP STEP OUT" : `${key} TO STEP OUT`,
  /** The touch buttons on the right thumb's side. */
  balloonBurn: "BURN",
  balloonVent: "VENT",
  balloonJump: "JUMP",
  balloonStep: "STEP OUT",

  /* ── THE NEWS (run-news.ts) ────────────────────────────────────────── */
  newsBalloonLaunch: "TETHER OFF! WE'RE FLYING",
  newsBalloonLiftoff: "OFF THE SNOW",
  newsBalloonTouch: "TOUCHDOWN",
  /** The envelope past its fabric's working limit. */
  newsBalloonHot: "ENVELOPE HOT! EASE OFF THE BURNER",
  /** The fabric alight: the way out is over the side. */
  newsBalloonFire: "ENVELOPE ON FIRE! JUMP!",
  newsBalloonJump: "OVER THE SIDE!",
  newsBalloonStep: "OUT ON THE SNOW",
  newsBalloonRestart: "IN THE BASKET",
  /** The wipeout's word for a basket into the snow or a crown. */
  newsBalloonCrash: "BASKET OVER!",

  /** OPTIONS ▸ KEYS: the balloon's section, and how the skier's keys fly it. */
  keysBalloonTitle: "HOT AIR BALLOON",
  balloonKeysNote:
    "In the balloon the same keys fly it: hold the tuck to burn (the climb comes tens of seconds later), the skid pulls the parachute valve to dump heat, the edge and the lean walk you about the basket. The machine key jumps over the side — or, stood on the snow, steps you out. Burning in a strong wind can set the envelope alight. On touch the left thumb is a pad that walks you about the basket, and the right side holds BURN, VENT and JUMP.",
};
