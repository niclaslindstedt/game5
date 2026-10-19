// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// WHAT THIS BUILD CARRIES — decided when it is built, never by the page at
// run time. Every build carries everything unless a switch says otherwise;
// only the store app's bundle (`native/scripts/bundle-web.mjs`) sets them:
//
//   VITE_GORE=off       the phone app, every profile: no wounds, no death,
//                       none of the INJURIES rows — as with the switch locked
//                       off, and the rows not drawn at all. The website and
//                       the desktop app keep it.
//   VITE_DEVELOPER=off  the App Store build (the `production` profile): the
//                       title's hold lets no developer page out, so the races
//                       and the tricks behind it stay shut and the game is
//                       the free ride. A TestFlight build of the `testflight`
//                       profile keeps the page.
//
// Read as `import.meta.env`, which a build replaces with the literal, so a
// branch on either is decided at build time. Keep this file free of browser-
// and Node-only imports: the suite reads it.

const on = (value: unknown): boolean =>
  !["0", "off", "false", "no"].includes(
    String(value ?? "")
      .trim()
      .toLowerCase(),
  );

/** Whether the build carries the wounds, the death and their rows. */
export const GORE_BUILD: boolean = on(import.meta.env.VITE_GORE);

/** Whether the build can let the developer page out. */
export const DEVELOPER_BUILD: boolean = on(import.meta.env.VITE_DEVELOPER);
