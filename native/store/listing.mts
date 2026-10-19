// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE STORE LISTING'S RULES — everything about the submission that is not the
// marketing copy. Committed; the copy is not.
//
// THE SPLIT IS DELIBERATE AND IT IS ABOUT ONE FACT: the game is PAID on the
// App Store and OPEN SOURCE on GitHub. Those two are only in tension for the
// listing's WORDS. A product page's description, subtitle, promotional text
// and keyword set are what the store indexes and what a competitor reads, and
// publishing them in a public repository puts the paid listing's own copy on a
// crawlable page under somebody else's domain — competing with, and sometimes
// outranking, the listing it was written for. Nothing else here has that
// problem: an age-rating answer, a category, a field limit and a cross-check
// are all better off in the open, where a reviewer can see them.
//
// So:
//
//   listing.mts        THIS FILE. Types, limits, categories, the age-rating
//                      questionnaire, the release policy, and what the Steam
//                      page may not claim. Committed.
//   copy.mts           Every word a buyer reads. GITIGNORED.
//   copy.example.mts   The committed template that documents its shape, with
//                      obvious placeholder text.
//
// It is the same shape as `native/.env` beside `native/.env.example`, for a
// related reason — see `docs/configuration.md`. The generator compiles
// whichever of the two copy modules is present and says which one it used;
// `make store-preflight` reports running on the example as outstanding work,
// because a submission built from the template would ship placeholder prose.
//
// Compiled by `make store-metadata` (scripts/generate-store-metadata.mjs) into
// the files the upload tools read: native/store/store.config.json for
// `eas metadata:push`, the fastlane metadata tree for `fastlane deliver`,
// tauri/fastlane/metadata/ for the MAC App Store's own `deliver`, and
// tauri/store/steam-listing.md for the Steamworks store page. All of it is
// gitignored build output — never edit it.
//
// THREE STOREFRONTS, TWO SHELLS. The App Store's phone app is `native/` (Expo
// over a WebView); the Mac App Store's app and Steam's download are both
// `tauri/` (the desktop shell), because a Mac app is a desktop app and the
// Expo shell does not build one. Each store's assets sit beside the shell that
// submits them; the words are authored once, here and in `copy.mts`, because
// they describe one game.
//
// A TypeScript module rather than a YAML catalog, for the reason the rest of
// this repo's small fixed catalogs are (docs/conformance.md): the
// tests and the generator read the same typed rows with no schema layer and no
// parser dependency, and the identity it composes against
// (`pwa/src/identity.ts`) is a module, not a data file.
//
// TWO MORE KINDS OF FIELD, NEITHER OF WHICH IS HERE:
//
//   COMPOSED    the listing title, the marketing URL, the privacy URL and the
//               copyright line, which the generator takes from identity.ts, so
//               a rename reaches the store listing the same way it reaches the
//               manifest and the app's name.
//   OUT OF BAND the App Store review PHONE NUMBER. Apple rings it and this
//               repository is public, so it comes from `ASC_REVIEW_PHONE` in
//               the gitignored `native/.env` (scripts/lib/store-env.mjs). The
//               generator drops the field rather than upload a number that
//               rings nobody.

/** One App Store locale's product page. Authored in `copy.mts`. */
export type AppleInfo = {
  /** ≤ 30 chars. Sits under the app name and IS indexed for search, so it
   * carries the hook and a term or two the keywords then don't have to. */
  subtitle: string;
  /** ≤ 170 chars. The only field that can change WITHOUT shipping a build,
   * so it holds what is newsy — never anything load-bearing. */
  promoText: string;
  /** 10–4000 chars. Read on a phone: the hook lives in the first two lines,
   * because that is all the store shows before "more". */
  description: string;
  /** Joined with commas by App Store Connect, and the JOINED string is what
   * must stay under 100 chars — not each term. */
  keywords: string[];
  /** ≤ 4000 chars. The product page's "What's New". */
  releaseNotes: string;
  /** Required by Apple, and must be http(s) — a `mailto:` is rejected. It
   * deliberately does not point at the source repository. */
  supportUrl: string;
};

/** What App Store review is told, and who it asks. */
export type AppleReview = {
  firstName: string;
  lastName: string;
  email: string;
  demoRequired: boolean;
  /** 2–4000 chars, authored in `copy.mts` as `APPLE_REVIEW_NOTES`. */
  notes: string;
};

/** The half of the submission that is rules rather than words. */
export type StoreRules = {
  /** Bumped only when Expo changes the store.config schema. */
  configVersion: number;

  /** WHICH STOREFRONTS THIS GAME ACTUALLY SHIPS ON.
   *
   * The subsystem is a sibling of the one in `game2`, and it is meant to be
   * portable across the fleet — where most apps have one storefront and no
   * desktop shell at all. So the storefronts are declared rather than
   * assumed: the generator writes only the outputs named here, and the
   * preflight only asks for what an enabled storefront needs.
   *
   * A listing compiled for a store the game does not ship on is worse than no
   * listing: it is a page of claims nobody is checking against a build. */
  storefronts: {
    /** The iPhone app under `native/`. */
    appStore: boolean;
    /** The Mac App Store build of the desktop shell under `tauri/`. */
    macAppStore: boolean;
    /** The Steam download of the same desktop shell. */
    steam: boolean;
  };
  apple: {
    /** First entry is the primary category; an array is
     * [category, subcategory, subcategory]. */
    categories: (string | string[])[];
    /** The age-rating questionnaire. A wrong answer here is a rejection, so
     * every row says why it is what it is. */
    advisory: Record<string, unknown>;
    /** Who review contacts. The notes themselves are copy. */
    contact: Omit<AppleReview, "notes">;
    release: { automaticRelease: boolean; phasedRelease: boolean };
  };
  /** THE MAC APP STORE. Apple's second storefront, a different binary, and
   * the same questionnaire — `apple.advisory` and `apple.contact` are shared,
   * because the age rating and the review contact are claims about the GAME
   * rather than about a build. */
  mac?: {
    /** App Store Connect's own category ids, shared across platforms. */
    categories: (string | string[])[];
    /** The oldest macOS the build runs on. RESTATED from
     * `tauri/src-tauri/tauri.conf.json`, which cannot import this file, and
     * checked against it by the generator: a listing that promises Catalina
     * and a binary that refuses to launch on it is a refund. */
    minimumSystemVersion: string;
    /** Every entitlement the submitted build declares.
     *
     * The App Sandbox is not optional on the Mac App Store, and its presence
     * is the load-bearing half of what the review notes claim about this app:
     * a sandboxed process that never asks for the network is a very short
     * argument that nothing leaves the device. Anything ADDED here is a new
     * claim to defend, so the list stays as short as the game can stand. */
    entitlements: string[];
    /** Whether the Mac app is sold as ONE PURCHASE with the iPhone app.
     *
     * Apple's universal purchase needs both apps to carry the SAME bundle id,
     * and it can only be turned on before either has shipped — after that the
     * two are separate products for good. The generator checks the two
     * identifiers agree when this is on, and says which files disagree. */
    universalPurchase: boolean;
  };

  steam?: {
    /** The store page's genres, most representative first. */
    genres: string[];
    /** Player-facing tags, in the order Valve should weight them. */
    tags: string[];
    /** What the page must NOT claim. Steam reviews the listing and the build
     * together, so a planned feature presented as shipped is a rejection. */
    notYetShipped: string[];
  };
};

export const RULES: StoreRules = {
  configVersion: 0,

  // Fall Line ships on the App Store. The desktop shell exists (`tauri/`) but
  // no Mac App Store record does, and there is no Steam page — so neither is
  // compiled, and the preflight does not ask for screenshots nobody submits.
  // Turning one on is this flag plus the section it belongs to below.
  storefronts: {
    appStore: true,
    macAppStore: false,
    steam: false,
  },

  apple: {
    // Sports first because that is what it is: downhill skiing — every race
    // discipline and every freestyle format — before it is anything else.
    // Racing second, because most of the game is against a clock and a field,
    // and the people who want one look in that aisle too.
    categories: [["GAMES", "GAMES_SPORTS", "GAMES_RACING"], "SPORTS"],

    advisory: {
      violenceCartoonOrFantasy: "NONE",
      // INFREQUENT_OR_MILD. The App Store build is the phone app, and the
      // phone app carries none of the game's gore (pwa/src/game/edition.ts,
      // set by native/scripts/bundle-web.mjs for every profile): no wound is
      // shown, nobody dies, and the INJURIES, X-RAY CAM and DAMAGE HUD rows
      // are not in OPTIONS. What is left is a skiing game's falls: a skier
      // who meets a trunk, a rock or the snow too hard is thrown and tumbles
      // (the ragdoll), then stands up again at the reset. The same build plays
      // safe for work throughout (`RunRules.sfw`): no skier knocks another
      // down, and no machine crashes or burns.
      violenceRealistic: "INFREQUENT_OR_MILD",
      // NONE. The graphic half — a fatal crash drawn as gore, the X-ray cam
      // of the fatal fall — is the website's and the desktop app's alone;
      // the phone build never carries it (see above).
      violenceRealisticProlongedGraphicOrSadistic: "NONE",
      // NONE. The free ride's monster in the woods (the grimbear,
      // engine/game/grimbear.ts) is dealt only with INJURIES on, which the
      // phone build never is.
      horrorOrFearThemes: "NONE",
      profanityOrCrudeHumor: "NONE",
      matureOrSuggestiveThemes: "NONE",
      sexualContentOrNudity: "NONE",
      sexualContentGraphicAndNudity: "NONE",
      // INFREQUENT_OR_MILD. The phone build keeps the afterski lodge's doors
      // shut (`RunRules.sfw`), so the player's skier never drinks; but one of
      // the free ride's crowd groups is a few skiers down from the hut, who
      // sway and wander as they ski (engine/game/defs/crowd.ts). A mild
      // reference at most, answered as one.
      alcoholTobaccoOrDrugUseOrReferences: "INFREQUENT_OR_MILD",
      // NONE. The HUD's anatomy plate names injuries by body part and grades
      // them (defs/anatomy.ts) as a game readout; nothing advises on, or
      // simulates, treating anyone.
      medicalOrTreatmentInformation: "NONE",
      // Nothing is wagered. The mountain generator draws from a seed, which is
      // not a wager, and there is nothing to stake on the outcome.
      gamblingSimulated: "NONE",
      gambling: false,
      contests: "NONE",
      // The WebView serves the copy of the site bundled INSIDE the app from a
      // local HTTP server. It is not a browser and cannot be steered
      // elsewhere: the one link out (OPTIONS ▸ PRIVACY POLICY) is handed to
      // Safari.
      unrestrictedWebAccess: false,
      kidsAgeBand: null,
    },

    // A name and the publisher's published support address, not a phone
    // number. Committed because they are public contact details, which the
    // listing shows anyway.
    contact: {
      firstName: "Niclas",
      lastName: "Lindstedt",
      email: "support@agilator.se",
      demoRequired: false,
    },

    release: {
      // Held for a human to press. A first launch should not go live off a
      // review approval at three in the morning.
      automaticRelease: false,
      phasedRelease: false,
    },
  },
  // No `mac` or `steam` section: the storefront flags above say this game
  // ships on neither, so there is nothing to author for them. Adding one back
  // is the flag plus the section — the generator and the preflight read the
  // flag, not the presence of the section.
};
