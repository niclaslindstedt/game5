// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The game's page on the publisher's app site, beside the identity module
// rather than in it: identity.ts is a source the title scene's committed
// plates are stamped against, so a line added there asks for a new render.
// Keep this file free of browser- and Node-only imports.

/** The game's page on the publisher's app site, which carries its privacy
 * policy (`privacy/`) and support page (`support/`). It is where the store
 * listing and the packaged apps send a player: a phone or desktop build names
 * neither the website nor the source, and its bundle scripts refuse one that
 * does (`scripts/lib/no-source.mjs`). The website keeps both. */
export const APPS_PAGE_URL = "https://apps.agilator.se/fall-line/";
