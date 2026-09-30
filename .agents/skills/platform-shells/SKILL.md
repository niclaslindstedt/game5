---
name: platform-shells
description: "Use when working on the DESKTOP app (`tauri/`) or the STORE app (`native/`) — the window and what it remembers, the macOS MENU BAR, the private `game://` scheme, the bundled webroot, the ACL, packaging a download, the Expo WebView and its local server, the audio session, the haptics bridge, a new native bridge, or anything the page needs to know about the shell it is running in. Owns the decision/effect split in the two Rust crates, the frozen `__SH_SHELL__` global and the `sh-` events, the names that restate `identity.ts` and cannot import it, the three files a pulse is named in, and the rule that a feature a shell needs is a feature the WEBSITE needs first. Both trees live outside the npm workspace, so `make lint` and `make test` do not reach them."
---

# The platform shells: the desktop app and the store app

The product is the deployed website. The two shells wrap it — they add a
window, an offline copy, a store listing and the phone's haptics, and
**nothing else**. Every rule in this skill exists to keep that true, because
the moment a feature lives only inside a shell, the website is no longer the
product.

**The load-bearing constraint:** nothing in `engine/` may learn either shell
exists, and the ONE file of `pwa/` that does is `pwa/src/shell-host.ts` —
the page reads a frozen global to keep its PWA update lifecycle off in there,
and everything else a shell may say or be asked travels on a handful of DOM
events prefixed `sh-`, each of them a thing the website already does. A
feature the desktop or store app needs is a feature the website needs first;
a shell-only behaviour is a decision in the shell's own tree with a test
beside it.

**Read this skill's lessons first** — `npx ogf-skill-lessons
platform-shells --list`. Load **`skill-reflection`** at both ends and
**`write-code`** beside this one. What is FELT (the vibration table) is
`visual-effects`'; the switch that silences it is `haptics.ts`'s.
`docs/platforms.md` is where the two shells sit beside the web.

## `tauri/` — the desktop app (Windows, macOS, Linux)

A thin wrapper around the built site in the platform's own webview, served
from a private `game://` scheme. **Two Rust crates, and the split is the
design:**

- **`shell/` is every DECISION** — the scheme and host, the window's names,
  what the window may navigate to, which file a request path is (the
  containment check), where the window opens against the attached monitors
  and what it remembers between launches, where a diagnostic line goes, what
  a panic should say when there is no display to say it on, and every row
  of the menu bar as DATA. No Tauri, no GUI: `make tauri-test` runs its
  whole suite (`shell/tests/`) with a Rust toolchain and nothing else. **A
  `use tauri::` in this crate is the review comment.**
- **`src-tauri/` is every EFFECT** — the process and its builder
  (`main.rs`), the window and its geometry (`window.rs`), answering
  `game://` off the bundled `webroot/` (`protocol.rs`), the initialization
  script that is the page's whole view of the shell (`page.rs`), and the
  menu bar built out of `shell/src/menu.rs` (`menu.rs`). What the page may
  reach is the ACL in `src-tauri/capabilities/`, which denies by default.

Bundling, icons and packaging are `tauri/scripts/{bundle-web,icons,package}.mjs`
(Node, no deps); the static half of the bundle's shape is
`src-tauri/tauri.conf.json`, and `tests/tauri_test.ts` keeps it to what a
static config may say. `.github/workflows/desktop-tauri.yml` runs the checks
on every push that touches the tree; `release.yml`'s `desktop` matrix
packages a download per platform onto every release. → `tauri/README.md`.

```sh
make tauri         # bundle the site into tauri/webroot/, compile, launch (needs Rust)
make tauri-test    # the decision layer's suite — Rust toolchain only, NOT on `make test`'s path
make tauri-lint    # clippy at zero warnings over both crates (needs the webview dev libraries)
make tauri-fmt     # rustfmt in place
make desktop       # package this machine's downloads into tauri/release/
```

**The origin is the one thing to be careful with.** The player's settings
live in origin-keyed storage, so `APP_SCHEME` and `APP_HOST` are constants
that must never be tidied; a launch-time `SH_GAME_URL` points the window at a
deploy slot instead and skips the webroot entirely.

### The macOS menu bar

`shell/src/menu.rs` is every row as DATA — the title, the label, the
accelerator, and who serves it; `src-tauri/src/menu.rs` turns that into a
real menu and spends the events. Four rules, each of which the Rust suite
enforces:

- **Every row presses a button the game already has.** A menu bar is a
  second way to reach the website's own buttons, never a place a feature
  lives. The words travel on `SHELL_COMMAND` and are spelled again in
  `pwa/src/shell-host.ts`; `tests/tauri_test.ts` holds the two lists
  together, so a word added on one side alone fails rather than silently
  doing nothing. `shot` (View ▸ Take Screenshot) is also the one word the
  STORE app sends: `SHOT_COMMAND` in `native/src/injected.ts`, injected
  when `native/src/screen-capture.ts` hears the phone's own screenshot, held
  by `tests/shell_test.ts` by running it.
- **RACE, not File.** There are no files — a race is not a document. Naming
  the second menu File and leaving it empty is the tell of a port.
- **Every accelerator carries ⌘.** A menu accelerator is served BEFORE the
  page sees the key, so a row bound to a bare key takes that key away from
  the skier for the life of the window — silently, and only on macOS.
- **macOS only, and the check is a runtime `if` inside `install` rather
  than a `#[cfg]` around the module** — `make tauri-lint` runs on Linux, so a
  `cfg` would mean the file was only ever typechecked on a machine CI does
  not have.

## `native/` — the App Store / Play Store app

A thin Expo / React Native shell whose entire content is a full-screen
WebView over a copy of the built site packed inside the app
(`assets/webroot.zip`), served off a local HTTP server on a **fixed port so
`localStorage` keeps its origin**. On top of the web game it adds only what a
browser cannot give a phone: an audio session that plays through the iOS
ringer switch, the phone's haptics under the game's own vibration table, and
off-site links handed to the system browser.

It has **its own dependency tree, outside the npm workspace** — `make lint`
and `make test` do not reach it, and eslint ignores `native/**` because a root
`npm ci` never installs its plugins. `make native-typecheck` does reach it,
and the root suite holds its four import-free SEAM modules (`src/injected.ts`,
`navigation.ts`, `rumble.ts`, `cloud-ask.ts` — `tests/imports_test.ts`'s `SHELL_SEAM`; a seam
module that grows an import fails that test). Built on demand only, by the
`native` workflow (dispatch-only — a build spends paid minutes and store
credentials) or `make native-*`; never on push. → `native/README.md`,
`native/RELEASING.md`.

```sh
make native-install   # its own dependency tree
make native-bundle    # pack the built site into native/assets/webroot.zip — before EVERY native build
make native-typecheck # tsc over the shell — its own tree, so `make lint` does not reach it
make native-ios       # on an iOS simulator (native-android for Android)
make native-iphone    # on a REAL iPhone over USB: bundle, sign, install, launch
```

**The app ships whatever zip is on disk**, so a stale one silently installs
the last build's game: `native-bundle` first, every time. `native-iphone`
drives `xcodebuild` with the provisioning flags `expo run:ios --device` lacks,
and the team id comes from `APPLE_TEAM_ID` in the gitignored `native/.env`
(`.env.example` documents every value and where it comes from) through the
`with-ios-signing` config plugin, because `expo prebuild` rewrites `ios/` on
every build. **Nothing personal is committed** — not a team id, not an app id,
not as a default.

**Anything the store app does that a browser can't** is a bridge module under
`native/src/<service>.ts`, driven off the WebView message channel, with the
page's half behind a probe the browser answers too — never a line in `engine/`
or `pwa/` beyond `shell-host.ts`. The haptics bridge is the shape every later
one takes, and it is worth following end to end:

```
engine event / SkierState.skiCompression
  → pwa/src/game/rumble.ts      what is felt, and how big: { ms, strength }
  → pwa/src/game/haptics.ts     the one motor, the ledger, the player's switch
  → pwa/src/shell-host.ts       dispatches `sh-shell-rumble` (a no-op in a browser)
  → native/src/injected.ts      the listener, posted over the message channel
  → native/src/rumble.ts        parsed, then sized into a BURST of taps (iOS has no duration)
  → native/src/haptics.ts       the only file that touches expo-haptics
```

Decisions in the pure module, effects in the one that imports the platform —
the same split as the Rust crates, held by the same kind of test.

## The things stated twice, and the tests that hold them

- **The shell's word.** `SHELL_GLOBAL` (`__SH_SHELL__`) in `shell-host.ts`;
  the desktop app writes `"tauri"` from `src-tauri/src/page.rs` off
  `shell/src/config.rs`, the store app writes `"native"` from
  `native/src/injected.ts`'s `NATIVE_FLAG`. `tests/tauri_test.ts` and
  `tests/shell_test.ts` hold each half.
- **The events.** Both fullscreen events and the menu's whole word list are
  spelled again in `config.rs` / `menu.rs`; `tests/tauri_test.ts` reads the
  Rust as TEXT so the root suite needs no toolchain.
- **A pulse is named three times.** `SHELL_RUMBLE`, `RUMBLE_BRIDGE` and
  `parseRumble` cannot import each other; `tests/rumble_test.ts` holds all
  three. A rename in one is a phone that silently stops buzzing.
- **The names.** `productName` and `longDescription` in `tauri.conf.json`,
  `WINDOW_TITLE` and `SITE_URL` in `config.rs`, and `BRAND_COLOR` (the
  palette's `skyHigh`) as the brand background are `identity.ts` spelled again; `tests/tauri_test.ts`
  holds all of them. `native/app.config.js` is the exception: it READS its
  name and palette off `identity.ts` (by regex — the shape
  `tests/identity_test.ts` holds) and restates nothing.
- **`tauri/` is outside eslint and inside prettier**, so every generated file
  under it is named in `.prettierignore` by hand — a nested `.gitignore`
  does not save it.

A change to any pair lands both halves in the same commit, then
`npx vitest run tests/tauri_test.ts tests/shell_test.ts tests/rumble_test.ts
tests/imports_test.ts`.

## Documentation sync

A change to the desktop app's tree or its environment updates
`tauri/README.md`, `docs/configuration.md` (the launch environment) and
`docs/platforms.md`. A native bridge or build knob updates `native/README.md`,
`native/.env.example` and `docs/configuration.md` (the `EXPO_*` rows); the
submission run-through is `native/RELEASING.md`. A new `make native-*` or
`tauri*` target lands in the README's Usage table.

**No store half.** The sibling repo's shells carry a Steam page and a Mac App
Store submission compiled from an authored listing; `store-listing` and
`store-shots` are reserved here and nothing of that is ported until the
listing exists. Do not build half a submission into this tree.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment
here: a name that was stated a fourth time, a bridge whose page half the
browser did not answer, a build that shipped a stale zip.
