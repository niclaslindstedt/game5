// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STORE COPY'S SHAPE — a committed skeleton, not a listing.
//
// The real words live in `copy.mts` beside this, which is GITIGNORED: the game
// is paid on the App Store and open source on GitHub, and the listing's copy is
// the one thing those two facts pull apart. `listing.mts` explains the split.
//
// THIS FILE IS DELIBERATELY NOT WRITING. Every string below is a placeholder
// naming what belongs there, short enough that nobody could mistake it for
// marketing and long enough to satisfy the field limits so a fresh clone
// typechecks and `make store-metadata` runs end to end. Do not improve the
// prose here — improving it would recreate exactly what the split exists to
// avoid, one adjective at a time.
//
// THREE STOREFRONTS ARE DESCRIBED FROM THIS ONE FILE — the App Store's phone
// listing, the MAC App Store's, and Steam's. One authored source because they
// describe one game; three sets of words because a phone, a Mac and a Steam
// page are three different readers.
//
// THE REAL THING is written and kept outside this repository and copied in
// on the machine that submits; `native/store/README.md` says what each field
// is for, every limit, and the claims the review notes have to make true.
//
//   cp native/store/copy.example.mts native/store/copy.mts
//   # …then write it, and keep a backup outside this checkout.

import type { AppleInfo } from "./listing.mts";

const EN_US: AppleInfo = {
  // ≤ 30. Indexed for search as well as read, so it earns its keywords.
  subtitle: "SUBTITLE — the hook, 30",

  // ≤ 170. The one field that changes without shipping a build.
  promoText:
    "PROMO TEXT — what is newsy this month, and nothing load-bearing. Up to 170 characters.",

  // 10–4000. The first two lines are all the store shows before "more".
  description: `DESCRIPTION — the hook in the first two lines, then what the
player actually does, then what makes this one unusual. Up to 4000 characters,
read on a phone.`,

  // The JOINED string is what must fit 100 characters, not each term.
  keywords: ["keyword", "budget", "spent", "joined"],

  // ≤ 4000. The product page's "What's New".
  releaseNotes: "RELEASE NOTES — what changed, for the version this ships beside.",

  // Required, must be http(s), and deliberately not the source repository or
  // the web edition: the app's support page on the publisher's app site.
  supportUrl: "https://apps.agilator.se/fall-line/support/",
};

/** The App Store product page, one entry per locale. */
export const APPLE_INFO: Record<string, AppleInfo> = { "en-US": EN_US };

/**
 * What App Store review is told before it opens the app.
 *
 * The single highest-leverage field in the submission, and the one this
 * skeleton is least able to stand in for: a WebView-shaped app is judged under
 * guideline 4.2 (minimum functionality), and these notes are the argument that
 * this one is not a browser pointed at a website. The generator checks the
 * real notes against the build — see `native/store/README.md`.
 */
export const APPLE_REVIEW_NOTES = `REVIEW NOTES — nothing to sign in to; how to
play; that the whole game ships inside the binary and runs in airplane mode;
what the native layer adds; that nothing is sold and no data is collected; and
where a reviewer should look first.`;

// NO MAC OR STEAM COPY HERE. `listing.mts` says this game ships on the App
// Store alone, so there is no second page to write. When a desktop storefront
// is turned on, its fields join this file beside the phone's — the shape is in
// the sibling repo that already ships on all three.
