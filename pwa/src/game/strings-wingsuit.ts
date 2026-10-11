// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE WINGSUIT (`wingsuit.ts`) — a block of the one strings
// table (`strings.ts`, §39.1), stated next door and spread into `STRINGS`
// under the same names: the START row's stop and the SUIT row the airborne
// rides ask, the news a flight earns, and its HUD strip (`hud-plane.tsx`'s
// `ChuteReadout` in the suit) — the glide, the air speed, the sink, the
// height closing on the pull, and the press, JUMP then PULL.

export const WINGSUIT_STRINGS = {
  /* ── THE START CARD (menu-start.tsx, menu-pause-slopes.tsx) ────────── */
  /** The START row's stop: the wingsuit off its own exit. */
  startRunWingsuit: "WINGSUIT",
  /** The SUIT row, shown on a ride up a craft he can jump from. */
  startSuit: "SUIT",
  startSuitHint:
    "What you jump in from the paramotor, the balloon, the helicopter or the plane. PARACHUTE: the skydiver's rig over your ski clothes, skis on — a main and a reserve, landed on your skis. WINGSUIT: no skis, one BASE canopy and no reserve; leave the craft at any height and fly the suit down, pull, and land on your feet.",
  suitWord: { rig: "PARACHUTE", wingsuit: "WINGSUIT" } as const,

  /* ── THE NEWS (run-news.ts) ────────────────────────────────────────── */
  newsSuitExit: "OUT! FLY THE SUIT",
  newsSuitThrow: "PULL! PILOT CHUTE OUT",
  newsSuitLand: "ON YOUR FEET!",
  newsSuitRestart: "BACK ON THE EXIT",

  /* ── THE HUD (hud-plane.tsx) ───────────────────────────────────────── */
  /** What the flight is doing. */
  suitMode: (mode: "ready" | "exit" | "freefall"): string =>
    mode === "ready" ? "ON THE EXIT" : mode === "exit" ? "EXIT" : "FLYING",
  /** What the big number is: his height over the snow under him (what a
   * flyer flies by — never over the sea). */
  suitAgl: "ABOVE SNOW",
  /** The glide flown, across over down; level or climbing, a flare. */
  suitGlide: (g: number): string => (g > 9.5 || g < 0 ? "GLIDE ▲" : `GLIDE ${g.toFixed(1)}`),
  /** The air through the suit, km/h. */
  suitAir: (ms: number): string => `${Math.round(ms * 3.6)} KM/H`,
  /** The sink, m/s (down positive). */
  suitSink: (ms: number): string => `${ms >= 0 ? "▼" : "▲"} ${Math.abs(ms).toFixed(1)} M/S`,
  /** The press: jump off the exit, and pull — the machine key (`key`, as
   * bound), a double tap on touch. */
  suitJumpPress: (touch: boolean, key: string): string =>
    touch ? "DOUBLE TAP TO JUMP" : `${key} TO JUMP`,
  suitPullPress: (touch: boolean, key: string): string =>
    touch ? "DOUBLE TAP TO PULL" : `${key} TO PULL`,
};
