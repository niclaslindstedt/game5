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
  /** The wing folded in the air by rough air: pump it out. */
  newsParaFold: "COLLAPSE! PUMP THE BRAKES",
  newsParaRestart: "ON THE SUMMIT",
  /** A whole turn flown round over the wing. */
  newsParaLoop: "LOOP!",
  /** The lines gone slack and the pilot fallen into his own wing. */
  newsParaTangle: "IN THE WING! CUT IT AWAY",
  newsParaCravat: "CRAVAT! PUMP THE BRAKES HARD",
  newsParaFreed: "TIP OUT! FLYING",
  newsParaTwist: "LINE TWISTS! KICK OUT",
  newsParaUntwist: "TWISTS OUT",

  /* ── THE HUD (hud-para.tsx) ────────────────────────────────────────── */
  paraAlt: "ALT",
  paraAltValue: (m: number): string => `${Math.round(m)} M`,
  paraVario: "VARIO",
  paraVarioValue: (v: number): string => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}`,
  paraAir: "AIR",
  paraAirValue: (ms: number): string => `${Math.round(ms * 3.6)}`,
  paraThrottle: "THR",
  /** The wind at the wing, km/h. */
  paraWind: "WIND",
  paraWindValue: (ms: number): string => `${Math.round(ms * 3.6)}`,
  /** The air rough enough to fold the wing. */
  paraRough: "ROUGH AIR",
  /** The wing folded: which side, or its whole leading edge. */
  paraFold: (side: number): string =>
    side < 0 ? "LEFT SIDE FOLDED" : side > 0 ? "RIGHT SIDE FOLDED" : "FRONTAL COLLAPSE",
  /** The pull he hangs on, g. */
  paraG: "G",
  paraGValue: (g: number): string => g.toFixed(1),
  /** Fallen into his own wing: the cloth and the lines round him. */
  paraTangled: "IN THE WING",
  /** How to cut the tangled wing away. */
  paraCut: (touch: boolean, key: string): string =>
    touch ? "DOUBLE TAP TO CUT AWAY" : `${key} TO CUT AWAY`,
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
    "Under the paramotor its own keys above fly the wing — by default the skier's: the tuck key is the throttle, the skid both brakes (a flare to land), the edge the toggles and your weight, the lean the risers — forward pitches the wing over into a dive, back pulls the rears and swings you up; out of a big enough dive, held back, you loop over the wing. Pull up without the speed and the lines go slack and you fall into the wing. The machine key drops the whole rig and leaves you on your skis.",
};
