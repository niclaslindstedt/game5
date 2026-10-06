// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE PARAMOTOR (`para.ts`) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names, as the snowmobile's are: the start card's RUN stop, the
// news a flight earns, and its HUD — the height, the climb, the air, the
// throttle and the way out of the harness.

export const PARA_STRINGS = {
  /** The RUN row's stop: the ride begun on the summit under the wing. */
  startRunPara: "PARAMOTOR",

  /* ── THE NEWS (run-news.ts) ────────────────────────────────────────── */
  newsParaLaunch: "WING UP! KEEP SKIING",
  newsParaTakeoff: "AIRBORNE!",
  newsParaTouch: "SPEED RIDING",
  newsParaDrop: "RIG DROPPED! SKI IT OUT",
  newsParaCollapse: "WING DOWN! RIG CUT AWAY",
  newsParaRestart: "ON THE SUMMIT",

  /* ── THE HUD (hud-para.tsx) ────────────────────────────────────────── */
  paraAlt: "ALT",
  paraAltValue: (m: number): string => `${Math.round(m)} M`,
  paraVario: "VARIO",
  paraVarioValue: (v: number): string => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`,
  paraAir: "AIR",
  paraAirValue: (ms: number): string => `${Math.round(ms * 3.6)}`,
  paraThrottle: "THR",
  /** The wing past its stall. */
  paraStall: "STALL",
  /** On the summit, the wing held up: how to go. */
  paraReady: (touch: boolean): string =>
    touch ? "PUSH THE LEVER AND SKI OFF" : "THROTTLE UP AND SKI OFF",
  /** Skiing under the flying wing. */
  paraRiding: "SPEED RIDING",
  /** How to drop the whole rig: the machine key (`key`, as bound), a
   * double tap on touch. */
  paraDrop: (touch: boolean, key: string): string =>
    touch ? "DOUBLE TAP TO DROP THE RIG" : `${key} TO DROP THE RIG`,
  /** OPTIONS ▸ KEYS: the paramotor's section, and how the skier's keys
   * fly the wing. */
  keysParaTitle: "PARAMOTOR",
  paraKeysNote:
    "Under the paramotor the same keys fly the wing: the tuck is the throttle, the skid both brakes (a flare to land), the edge the toggles and your weight, the lean the risers — forward to speed up, back to slow. The machine key drops the whole rig and leaves you on your skis.",
};
