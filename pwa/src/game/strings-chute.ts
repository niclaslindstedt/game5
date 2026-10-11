// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE WORDS OF THE SKYDIVE (`chute.ts`) — a block of the one strings table
// (`strings.ts`, §39.1), stated next door and spread into `STRINGS` under
// the same names: the news a jump earns, its HUD (`hud-plane.tsx`'s
// `ChuteReadout`) — the altimeter, the fall, the pull cue and the next
// press, OPEN or CUT AWAY — and the note in OPTIONS ▸ KEYS on how the
// skier's own keys fly it.

export const CHUTE_STRINGS = {
  /* ── THE NEWS (run-news.ts) ────────────────────────────────────────── */
  newsChuteExit: "OUT! ARCH",
  newsChuteThrow: "PILOT CHUTE OUT",
  newsChuteLines: "LINE STRETCH",
  /** The canopy open and flying, at the opening's peak load, g. */
  newsChuteOpen: (g: number): string => `CANOPY OPEN · ${g.toFixed(1)} G`,
  newsChuteRelease: "CUT AWAY!",
  newsChuteLand: "TOUCHDOWN! CANOPY OFF",
  /** Caught: in a crown, or on a lift. */
  newsChuteSnag: (tree: boolean): string => (tree ? "CAUGHT IN A TREE!" : "CAUGHT ON THE LIFT!"),
  newsChuteRestart: "BACK IN THE DOOR",

  /* ── THE HUD (hud-plane.tsx) ───────────────────────────────────────── */
  /** The altimeter: his height over the snow, m. */
  chuteAlt: "ALT",
  chuteMetres: (m: number): string => `${Math.round(m)} M`,
  /** His fall, km/h, as a skydiver's audible and wrist read it. */
  chuteFall: (ms: number): string =>
    `${ms >= 0 ? "▼" : "▲"} ${Math.round(Math.abs(ms) * 3.6)} KM/H`,
  /** The air through the canopy, km/h. */
  chuteAir: (ms: number): string => `AIR ${Math.round(ms * 3.6)} KM/H`,
  /** What the skydive is doing. */
  chuteMode: (mode: "exit" | "freefall" | "deploying" | "open" | "released" | "snagged"): string =>
    mode === "exit"
      ? "EXIT"
      : mode === "freefall"
        ? "FREEFALL"
        : mode === "deploying"
          ? "OPENING"
          : mode === "open"
            ? "CANOPY"
            : mode === "released"
              ? "CUT AWAY"
              : "CAUGHT",
  /** The pull altitude reached: open now. */
  chutePull: "PULL!",
  /** The canopy stalled under the toggles. */
  chuteStall: "STALL",
  /** The next press: open the canopy, and cut it away — the machine key
   * (`key`, as bound), a double tap on touch. */
  chuteOpenPress: (touch: boolean, key: string): string =>
    touch ? "DOUBLE TAP TO OPEN" : `${key} TO OPEN`,
  chuteReleasePress: (touch: boolean, key: string): string =>
    touch ? "DOUBLE TAP TO CUT AWAY" : `${key} TO CUT AWAY`,
  /** Hanging from a crown or a lift: only a reset brings him down. */
  chuteSnagged: "HANGING · RESET TO START AGAIN",

  /* ── OPTIONS ▸ KEYS (menu-keys.tsx) ────────────────────────────────── */
  keysChuteTitle: "SKYDIVE",
  chuteKeysNote:
    "Out of the plane the skier's own keys fly you. In freefall the edge turns you, the lean forward tracks across the sky and back slides you back, the tuck dives head down. Under the canopy the edge is the toggles, the skid both brakes (a flare to land) and the lean the risers. The machine key jumps from the door, opens the canopy, then cuts it away; land on your skis and it lets go by itself.",
};
