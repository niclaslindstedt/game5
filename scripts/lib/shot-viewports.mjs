// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE REFERENCE VIEWPORTS `scripts/screenshot.mjs` photographs at (§35.2),
// each as the browser context a capture is opened in.

/** The reference viewports — and the phone is a TOUCHSCREEN, not a narrow
 * desktop window: the HUD's thumb zones and the splash's TAP ask the device
 * what it is. */
export const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true },
  landscape: { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true },
  // THE PHONE THE GAME IS HELD AT, as it really is: a current notched phone
  // on its side, its insets emulated (the notch's 59 px on both long edges,
  // the home bar's 21 under) — so every `env(safe-area-inset-*)` the cards
  // pad by is paid for in the picture. Full-screen (the store app, an
  // installed PWA), and under the browser's own bar along the top.
  iphone: {
    viewport: { width: 852, height: 393 },
    deviceScaleFactor: 3,
    hasTouch: true,
    insets: { top: 0, left: 59, right: 59, bottom: 21 },
  },
  "iphone-browser": {
    viewport: { width: 852, height: 340 },
    deviceScaleFactor: 3,
    hasTouch: true,
    insets: { top: 0, left: 59, right: 59, bottom: 21 },
  },
};
