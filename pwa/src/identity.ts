// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The app's identity — name, copy, colors, URLs — in one module. Imported by
// the browser app AND by the build plumbing (pwa-plugin.ts, the icon
// generator's palette is held to it by tests/identity_test.ts), so a rename
// or a palette change happens here once.
// Keep this file free of browser- and Node-only imports.

export const APP_NAME = "Fall Line";
/** The house, on the studio card the app will open on. Drawn upper-cased, so
 * write it however it is written everywhere else. */
export const PUBLISHER = "Agilator Games";
/** What the browser tab and the installed app are called. Just the name: a
 * tab shows about thirty characters before it cuts, so a tagline bolted on
 * after a dash is a tagline nobody finishes reading. */
export const APP_TITLE = APP_NAME;
/** The home-screen name: a launcher gives it about twelve characters before
 * it starts cutting, and this is eight. Both words survive, run together so
 * the launcher never breaks them onto two lines. */
export const APP_SHORT_NAME = "FallLine";
export const APP_DESCRIPTION =
  "A downhill skiing game that runs in your browser. Ski a graded piste from " +
  "the summit to the valley over a generated mountain — through the trees, " +
  "over the rollers and off the kickers — or drop into the powder beside it; " +
  "on your phone or desktop, offline once loaded. No account, no download.";
export const SITE_URL = "https://game5.niclaslindstedt.se";
/** Where the source lives — the HUD's build label will link a build's commit
 * here, so the running app can always say exactly what it is. */
export const REPO_URL = "https://github.com/niclaslindstedt/game5";

/** A clear day on the mountain: fresh snow in the sun and blue in the shade,
 * a pale sky deepening overhead, dark spruce on the lower slopes, the grey
 * of the groomed piste, and the slalom's own pair of colours — the red of a
 * gate panel to aim at, and the blue of the next one. And the first light
 * the title is set in: the night before it, the dusk of the mountain's
 * shadow side, the alpenglow on the ridge and the ice of shadowed snow lit
 * by the sky. */
export const PALETTE = {
  /** Brand + boot background: the night the app opens on. */
  night: "#0a1726",
  /** The mountain's shadow side; the menu's glass. */
  dusk: "#16304f",
  /** The low sun on the ridge; the warm edge of a lit control. */
  alpenglow: "#ffb27a",
  /** Shadowed snow under the sky; the secondary line, the cool edge. */
  ice: "#9fd2f5",
  skyHigh: "#6fa8dc",
  sky: "#cfe6f7",
  snow: "#f4f8fb",
  snowShadow: "#b9cde0",
  pine: "#1f4a36",
  pineDark: "#143326",
  track: "#dfe7ee",
  flag: "#e0332b",
  gateBlue: "#2f6fd6",
  hudInk: "#ffffff",
  hudShadow: "#0d2233",
  hudBad: "#ff5a4e",
} as const;

/** The one colour the boot screen, the manifest and the browser chrome are
 * painted — named once so none of them has to know which palette entry it
 * is. The night: a release opens dark, and the title comes up out of it. */
export const BRAND_COLOR = PALETTE.night;
