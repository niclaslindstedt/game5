// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE SNOWMOBILE (`sled.ts`) — a block of the one strings
// table (`strings.ts`, §39.1), stated next door and spread into `STRINGS`
// under the same names, as the downhill's are: the start card's RUN stop,
// the news a ride earns, and its HUD — the speed, the engine, the way off
// and the way to it.

export const SLED_STRINGS = {
  /** The RUN row's stop: the ride begun on the snowmobile (`sled.ts`). */
  startRunSled: "SNOWMOBILE",

  /* ── THE NEWS (run-news.ts) ────────────────────────────────────────── */
  newsSledBoard: "SKIS RACKED! RIDE HER UP",
  newsSledHop: "SKIS ON! OFF YOU GO",
  newsSledRight: "BACK ON THE SLED",
  newsSledRestart: "ON THE SLED",

  /* ── THE HUD (hud-sled.tsx) ────────────────────────────────────────── */
  sledRpm: "RPM",
  sledRpmValue: (rpm: number): string => `${(rpm / 1000).toFixed(1)}K`,
  /** The belt spinning in the snow. */
  sledSpin: "TRACK SPINNING",
  /** How to get off: a double press of the jump, a double tap on touch. */
  sledOff: (touch: boolean): string => (touch ? "DOUBLE TAP TO SKI OFF" : "SPACE TWICE TO SKI OFF"),
  /** The way to it, from a skier near it on a free ride. */
  sledCall: "SNOWMOBILE — RIDE IN TO TAKE IT",
  sledAway: (m: number): string => `${Math.round(m)} M`,
  /** OPTIONS ▸ KEYS: the snowmobile's section, and how the skier's keys
   * work on the boards. */
  keysSledTitle: "SNOWMOBILE",
  sledKeysNote:
    "On the snowmobile the same keys ride it: the tuck is the throttle, the skid the brake, the edge the bars and the lean your weight. Press the jump twice to ski off.",
};
