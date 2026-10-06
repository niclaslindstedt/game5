// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE PISTE MACHINES (`groomer.ts`) — a block of the one
// strings table (`strings.ts`, §39.1), stated next door and spread into
// `STRINGS` under the same names, as the snowmobile's are: the news a night
// ride earns, and the HUD — the machine driven, the way out, the way to it.

export const GROOMER_STRINGS = {
  /* ── THE NEWS (run-news.ts) ────────────────────────────────────────── */
  newsGroomerBoard: "IN THE CAB! GROOM IT",
  newsGroomerHop: "BACK ON YOUR SKIS",

  /* ── THE HUD (hud-groomer.tsx) ─────────────────────────────────────── */
  /** Its name, on the call and on the readout while he drives it. */
  groomerCall: "PISTE MACHINE",
  groomerAway: (m: number): string => `${Math.round(m)} M`,
  groomerTake: (touch: boolean, key: string): string =>
    touch ? "TAP TO DRIVE" : `${key} OR CLICK TO DRIVE`,
  groomerSpeed: (kmh: number): string => `${Math.round(Math.abs(kmh))} KM/H`,
  /** The tiller down and combing, or lifted (in reverse, stopped). */
  groomerTiller: "GROOMING",
  groomerReverse: "REVERSE",
  groomerIdle: "TILLER UP",
  groomerOff: (touch: boolean, key: string): string =>
    touch ? "DOUBLE TAP TO GET OUT" : `${key} TO GET OUT`,
};
