<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Fall Line — the store app

The App Store / Play Store shell: a thin [Expo](https://expo.dev) / React
Native wrapper whose entire content is a full-screen WebView over a copy of the
built website packed inside the app and served from a local HTTP server on
launch — so the game runs on-device, offline, and updates through the store.

Two rules hold, and they are the whole design:

- **Nothing in `engine/` may learn this shell exists.** The one file of `pwa/`
  that does is [`pwa/src/shell-host.ts`](../pwa/src/shell-host.ts).
- **A feature the shell needs is a feature the website needs first.** The shell
  adds reach, never a rule (OSS_GAME_SPEC §33).

See [`docs/platforms.md`](../docs/platforms.md) for where this sits.

## What the shell actually does

Everything else is the website. The shell is seven things a browser tab cannot
give a phone:

| The thing                | Where it lives                                                                      | Why the website cannot do it                                                                                                                                                                                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The game, on-device      | `src/local-server.ts`                                                               | `assets/webroot.zip` unzipped once per bundle and served from a fixed loopback port, so the origin — and the stored settings on it — survives every launch                                                                                                           |
| Sound through the ringer | `App.tsx` (`setAudioModeAsync`)                                                     | iOS silences a WebView's WebAudio on the ringer switch; a game should sound like a game                                                                                                                                                                              |
| The snow in the hands    | `src/injected.ts` → `src/rumble.ts` → `src/haptics.ts`                              | a WKWebView has no Vibration API at all, and the phone under it has the best haptics the game will ever run on                                                                                                                                                       |
| The book on every device | `src/injected.ts` → `src/cloud-ask.ts` → `src/cloud-save.ts` → `modules/cloud-save` | a web page cannot reach the iCloud account the phone is already signed into; the skier's records, ghosts, campaign board and preferences follow them to their other devices                                                                                          |
| A child's phone          | `src/content-filter.ts` → `modules/content-filter` → `src/injected.ts` (`contentFlag`) | a web page cannot read the phone's content restrictions; a parental control (Communication Safety) hides the HUD's injuries and locks the switch, an adult's Sensitive Content Warning hides them until switched back on — see below |
| Off-site links           | `src/navigation.ts`                                                                 | there is no address bar and no back button, so a link out would replace the game with a page the skier cannot leave                                                                                                                                                  |
| No caret loupe           | `App.tsx` (`textInteractionEnabled={false}`)                                        | the magnifier a double tap or a press-and-hold puts over the snow is a UIKit gesture recognized before the page is consulted, so the website's `user-select: none` cannot reach it — the cost is that the seed field types but cannot have a caret placed mid-number |

### The haptics bridge, end to end

The website owns the feature; the shell only plays what it is handed.

```
engine event / a landing
  → pwa/src/game/rumble.ts     what is felt, and how big: { ms, strength }
  → pwa/src/game/haptics.ts    the one motor, the ledger, the player's switch
  → shell-host.ts              dispatches `sh-shell-rumble` (a no-op in a browser)
  → src/injected.ts            the listener, posted over the message channel
  → src/rumble.ts              parsed, then sized into a burst of taps
  → src/haptics.ts             expo-haptics plays it
```

Four of those files cannot import each other, so the event's name and the
message's shape are stated in three places and held together by
`tests/rumble_test.ts` and `tests/shell_test.ts`. **A rename in one of them is
a phone that silently stops buzzing** — change one, change all three.

`tests/shell_test.ts` runs the injected script against a stub `window` and
feeds what it dispatches to the page's own listener — asserting on the source
would pass on a script that dispatches nothing.

### The cloud save bridge, end to end

The website owns WHAT is saved and how two devices reconcile
([`pwa/src/game/cloud-save.ts`](../pwa/src/game/cloud-save.ts): the best row
per record, the faster ghost, the furthest campaign, the later-changed
settings — never the picture or the thumbs, which are facts about the machine)
and WHEN (`use-cloud-sync.ts`: at boot, when told, after a write, on the way
to the background). The shell moves one opaque string in and out of iCloud:

```
pwa/src/game/use-cloud-sync.ts  status → load → merge → save, one round trip at a time
  → shell-host.ts               dispatches `sh-shell-cloud` with a requestId
  → src/injected.ts             CLOUD_BRIDGE posts it over the message channel
  → src/cloud-ask.ts            parsed (import-free, so the root suite holds it)
  → src/cloud-save.ts           served against the native module
  → modules/cloud-save          NSUbiquitousKeyValueStore (iOS only)
  ← src/cloud-ask.ts            cloudReply: a `sh-shell-cloud-event` script, injected
```

An unavailable cloud is an answer, not an error: Android, Expo Go, a skier
signed out of iCloud, or a build with `EXPO_PUBLIC_CLOUD_SAVE=off` all play a
device-local game. `tests/shell_test.ts` holds the three spellings of the
protocol together by running the scripts; `tests/cloud_save_test.ts` holds the
merge.

**Enabling it for a store build:** on the App ID in the Apple Developer
portal, turn on the **iCloud** capability with **Key-value storage**. The
entitlement (`com.apple.developer.ubiquity-kvstore-identifier`, the team
prefix plus the bundle id) is written by `app.config.js`; a local build on a
bare Apple ID without the capability sets `EXPO_PUBLIC_CLOUD_SAVE=off` so
signing does not fail. No account, key or container id is committed — the
save follows whichever Apple ID the device is signed into.

### The content setting

iOS 17 and later say whether sensitive content is filtered through the
sensitive-content analysis policy: COMMUNICATION SAFETY, the parental control
on a child's account, or SENSITIVE CONTENT WARNING, an adult's own switch. The
shell reads it once at launch (`src/content-filter.ts`, over the Swift module
in `modules/content-filter/`) and defines `__SH_CONTENT__` beside the shell's
name before the page's first script (`contentFlag`). The page's answer is
`injuriesShown` in `pwa/src/game/settings.ts`: a parental control hides the
body plate and the g meter and locks OPTIONS ▸ INJURIES off; an adult's filter
only changes the default. On an older iOS, without the capability, and on
Android — which has no such switch an app can read — nothing is said and the
game's own switch is the whole answer.

**Enabling it for a store build:** turn on the **Sensitive Content Analysis**
capability on the App ID. `app.config.js` writes the entitlement
(`com.apple.developer.sensitivecontentanalysis.client`); a local build without
the capability sets `EXPO_PUBLIC_CONTENT_FILTER=off`.

## The tree

| File                          | What it is                                                                                     |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `App.tsx`                     | the whole shell: one WebView, the audio session, the message channel                           |
| `app.config.js`               | the Expo config, with name and colours READ off `pwa/src/identity.ts`                          |
| `src/config.ts`               | where the WebView points — the bundle, or `EXPO_PUBLIC_GAME_URL`                               |
| `src/local-server.ts`         | unzip the packed site once per bundle, serve it on a fixed port                                |
| `src/injected.ts`             | the injected scripts: the shell flag, the rumble and cloud bridges, the hardening, the shutter |
| `src/navigation.ts`           | is this URL leaving the site — pure, so the root suite holds it                                |
| `src/rumble.ts`               | a pulse parsed and sized into taps — pure, for the same reason                                 |
| `src/haptics.ts`              | the only file that touches `expo-haptics`                                                      |
| `src/cloud-ask.ts`            | a cloud ask parsed, an answer scripted — pure, for the same reason                             |
| `src/cloud-save.ts`           | an ask served against the native module                                                        |
| `modules/cloud-save/`         | the local Expo module: iCloud key-value storage (Swift, iOS only)                              |
| `src/content-filter.ts`       | the device's content setting, read once at launch                                              |
| `modules/content-filter/`     | the local Expo module: the sensitive-content policy (Swift, iOS only)                          |
| `scripts/bundle-web.mjs`      | `vite build` + a deterministic zip into `assets/webroot.zip`                                   |
| `scripts/ios-device.mjs`      | bundle → prebuild → sign → install → launch on a real iPhone over USB                          |
| `plugins/with-ios-signing.js` | pins `DEVELOPMENT_TEAM` so a prebuild does not discard it                                      |

`src/rumble.ts`, `src/navigation.ts` and `src/cloud-ask.ts` import **nothing at all**, which is
what lets the root vitest suite hold the seam without installing this tree;
`tests/imports_test.ts` holds them to that.

## Running it

This tree is **outside the npm workspace** with a dependency tree of its own,
so a root `npm ci` does not install it. From the repo root:

```sh
make native-install     # once, and after a dependency change
make native-bundle      # vite build + assets/webroot.zip — before EVERY build
make native-typecheck   # tsc over this tree (the root lint never sees it)
make native-ios         # prebuild + run in the iOS simulator
make native-android     # run on an Android device/emulator
make native-iphone      # a REAL iPhone over USB: bundle, sign, install, launch
```

`make native-iphone ARGS="--device 'my iPhone'"` picks between several;
`ARGS="--skip-bundle"` reuses the packed site.

**The app ships whatever zip is on disk**, so a stale one silently installs the
last build's game. `native-bundle` first, every time — `native-iphone` and the
EAS scripts do it for you.

To point a debug build at a deployed slot instead of the bundle, set
`EXPO_PUBLIC_GAME_URL` at build time (see `.env.example`). A store build must
never set it: streaming the website is the exact shape App Store guideline 4.2
rejects.

## Store builds

Cloud builds go through [EAS](https://expo.dev/eas); the profiles are in
`eas.json` and the workflow is `.github/workflows/native.yml` — **manual
dispatch only**, because a build spends paid minutes and store credentials.

[`RELEASING.md`](RELEASING.md) is the run-through, and says what is still
missing before a first submission.

## What is deliberately NOT here

- **No authored store listing.** The sibling rally game compiles one source of
  listing copy into App Store, Play and Steam metadata; that is a subsystem of
  its own and the skill that owns it is reserved rather than written. Until it
  lands, the listing is typed into App Store Connect and the Play Console by
  hand — `RELEASING.md` lists what they ask for.
- **No app records, no credentials.** `eas.json`'s `ascAppId` and
  `appleTeamId` are empty because the records do not exist yet, and every
  credential is read from the environment (`.env.example` documents each one,
  where to get it and what shape it is). This repository is public: nothing
  personal and nothing secret is committed here, not even as a default a
  contributor could override.

- **No cloud save on Android.** The bridge answers "unavailable" there and the
  game stays device-local; a second platform is a new native module behind
  the same messages (`src/cloud-ask.ts`), with no change to the website.
- **The phone's own shutter IS bridged.** A screenshot taken with the
  hardware buttons is heard by `src/screen-capture.ts` (expo-screen-capture:
  iOS everywhere, Android 14+ on the install-time `DETECT_SCREEN_CAPTURE`;
  the photo-library permissions its older API would declare are blocked in
  `app.config.js`) and the shell injects `SHOT_COMMAND`, pressing the game's
  own shutter — the same picture, signed and filed in the gallery.
