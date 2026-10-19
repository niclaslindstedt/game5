<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Releasing the store app

The run-through for putting Fall Line on the phone stores. Nothing here is
automated end-to-end yet, and this document is deliberately honest about which
half is missing: the BUILD half is wired (`make native-*`, `eas.json`,
`.github/workflows/native.yml`); the LISTING half is typed into the consoles by
hand until the reserved store-listing work lands.

## 0. What is a gate, and what is not

The most useful thing to know before starting: **most of a submission cannot be
started until a store record exists, and the record cannot be created until an
account is enrolled.** Enrolling an organization means Apple verifying a legal
entity, which takes weeks. So the work splits in two.

**Doable today, and every one of them is something the submission stalls on
afterwards:**

- The icon set and the share card (`make icons`).
- The bundled site the app ships (`make native-bundle`).
- A privacy policy and a support page on the live origin — Apple fetches the
  privacy URL before review even opens the app.
- The screenshot set for both storefronts. `make screenshots` photographs the
  game at the reference viewports; a store sweep at each device size the
  consoles ask for is not tooled here yet.
- The listing copy and the review notes, written somewhere they can be pasted.

**Gated on the record:** the numeric Apple app id, the team id, the App Store
Connect API key, the Play service account, and every console questionnaire.

## 1. Create the app records

**Apple.** [App Store Connect](https://appstoreconnect.apple.com) → Apps → **+**.

- **Bundle ID** must be the one `app.config.js` already declares:
  `APP_BUNDLE_ID` (unset: `dev.local.fallline`). It is on the publisher's domain rather than the
  author's because Agilator AB holds the store agreements, and it is
  **unchangeable** once a record ships under it.
- **Capabilities on the App ID**, before the record is created — exactly the
  one the build's entitlements name, or code signing fails: **iCloud** with
  **Key-value storage** (the cloud save). The phone build carries none of the
  game's gore, so it asks for no Sensitive Content Analysis (see
  [`README.md`](README.md)).
- **SKU** is yours and never shown; the slug is fine.
- Creating the record assigns the numeric **Apple ID**. Put it, and the team id
  from the developer portal's Membership page, into `eas.json`'s
  `submit.production.ios` as `ascAppId` and `appleTeamId` — both are public
  identifiers, so both are committed literals; EAS interpolates neither. Until
  then the two keys are **absent**, not empty: EAS rejects an `eas.json` with
  an empty value or a `$comment` key, and every `eas` command fails on it —
  `eas init` included. (The three `ascApiKey*` fields are `$VAR` references
  on purpose: EAS interpolates the process environment into exactly those.)

**Google.** [Play Console](https://play.google.com/console) → Create app, with
the same package name.

**Expo.** `eas init` from `native/` creates the EAS project and prints its id.
Pin it in `app.config.js` (`EAS_PROJECT_ID`) once it exists; until then CI
reads it from an `EAS_PROJECT_ID` repo secret.

## 2. Credentials

Every one of them is read from the ENVIRONMENT — this repository is public.
[`.env.example`](.env.example) documents each value, where to get it, and what
shape it is. In short:

| What                                            | For                           | Where CI reads it            |
| ----------------------------------------------- | ----------------------------- | ---------------------------- |
| `EXPO_TOKEN` (a robot token)                    | driving EAS non-interactively | `EXPO_TOKEN` repo secret     |
| `EAS_PROJECT_ID`                                | linking the build             | `EAS_PROJECT_ID` repo secret |
| `APPLE_TEAM_ID`                                 | a LOCAL iPhone build only     | never — it is personal       |
| `ASC_KEY_ID` / `ASC_ISSUER_ID` / `ASC_KEY_PATH` | `eas submit` to Apple         | exported before the submit   |
| `PLAY_SERVICE_ACCOUNT_PATH`                     | `eas submit` to Play          | exported before the submit   |

iOS signing credentials for CLOUD builds live on the Expo project, not here.
`APPLE_TEAM_ID` is only ever read by a local device build.

## 3. Build

```sh
cd native && npm run build:production    # THE APP STORE BUILD: bundles, then builds
cd native && npm run build:testflight    # a test build, the developer page kept
```

Each script bundles the site for its own profile first (`npm run bundle --
--profile <name>`), because what the zip carries depends on it: no phone build
carries the gore, and the App Store build — the `production` profile — has no
developer page, so its races stay shut and the game is the free ride. The EAS
build checks the zip against its profile (`scripts/check-bundle.mjs`) and stops
on a mismatch, so a zip bundled for testing never ships to the store. Submit
the `production` build for review; a `testflight` build is for testers only.

Or from GitHub: **Actions → native → Run workflow**, choosing the platform, the
`eas.json` profile, and whether to auto-submit. It is dispatch-only on purpose —
a build spends paid EAS minutes and store credentials, so it runs when a human
asks and never on a push.

Before the first cloud build, sanity-check the tree locally:

```sh
make native-typecheck
make native-iphone      # the real thing, on a real phone, over USB
```

The simulator (`make native-ios`) is enough for the shell's own code, but it
has **no haptic engine** — the snow through the bars can only be judged on a
device.

EAS installs with the Node that `eas.json` pins — `"node"` in every build
profile, the same major as `.nvmrc`. Without it EAS falls back to its image's
default Node, whose npm 10 reads the lockfile npm 11 wrote as out of sync and
stops the build at `npm ci` ("Missing: typescript@5.9.3 from lock file"). Move
the pin when `.nvmrc` moves.

## 4. Submit

```sh
cd native && npm run submit    # eas submit --profile production
```

then finish the listing in the two consoles: name, subtitle, description,
keywords, category, age rating, screenshots, the privacy policy URL, the
support URL, and the review contact. Apple's review contact must be a line
somebody actually answers, which is why no phone number is committed anywhere
in this tree.

## 5. Version numbers

The app's marketing version tracks the game's: `app.config.js` reads it out of
the root `package.json`, which the release workflow bumps. Store BUILD numbers
are auto-incremented by EAS (`appVersionSource: "remote"`), so nothing in the
tree has to be touched between two builds of the same version.
