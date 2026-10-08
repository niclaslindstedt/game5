# Platforms

The repository is structured after its sibling games, which ship one product through many shells: web/PWA, desktop, and native mobile (App Store / Play Store). Fall Line adopts the same shape deliberately — the engine is headless and shell-agnostic, and every shell wraps the identical built site — and ships all three from one build: the web, a desktop app, and a store app.

## Web / PWA (`pwa/`)

The deployed site IS the product. It is installable (home-screen app on iOS/Android, fullscreen launch), offline-capable (hand-rolled precaching service worker, `pwa/pwa-plugin.ts`), self-updating (in-app prompt from `pwa/src/lib/pwa-update.ts`), and phone-first with full desktop keyboard support. Three deploy slots on [game5.niclaslindstedt.se](https://game5.niclaslindstedt.se/):

| Slot        | Serves                                        |
| ----------- | --------------------------------------------- |
| `/`         | The latest release (highest `v*` tag)         |
| `/preview/` | Current `main`, on every push                 |
| `/branch/`  | A feature branch parked via workflow dispatch |

Each slot is a whole build at its own base path with its own install identity, so the three can be installed side by side without fighting over one service-worker scope.

## Desktop (`tauri/`)

A thin Tauri wrapper around the built website for Windows, macOS and Linux: one window in the platform's own webview, the site bundled inside it and served from a private `game://` scheme, so it plays offline and is an app rather than a viewer for a web page. Two Rust crates, and the split is the design: `shell/` holds every decision (the scheme and host, the window's names, what the window may navigate to, the containment check on a request path, where the window opens and what it remembers, the launch log, the macOS menu bar as data) and needs no GUI to test; `src-tauri/` holds every effect. On macOS the menu bar's rows only press buttons the game already has — **Race** (restart, reset to the last gate, pause), **View** (next camera, take screenshot, full screen) and **Help** (the website, privacy, support, opened in the browser).

`make tauri-test` runs the decision layer on a bare Rust toolchain, `make tauri-lint` is clippy over both crates (it needs the webview development libraries), `make tauri` builds and launches it and `make desktop` packages this machine's downloads. None of it is on `make test`'s path: `.github/workflows/desktop-tauri.yml` checks the tree on every push that touches it, and `release.yml`'s `desktop` matrix packages a download per platform onto every release, which stays a draft until all three are attached. `tests/tauri_test.ts` reads the Rust as text to hold its restatement of the identity (the name, the description, `BRAND_COLOR`, the site) and of the page's events and menu words to `pwa/src/identity.ts` and `pwa/src/shell-host.ts`. → [`tauri/README.md`](../tauri/README.md)

## Native mobile (`native/`)

A thin Expo / React Native wrapper around the same built website: one full-screen WebView over a copy of the site packed inside the app (`assets/webroot.zip`) and served from a local server on a fixed port, so it plays offline, keeps its settings' origin between launches and updates through the store. On top of the web game it adds only what a browser cannot give a phone: an audio session that plays through the ringer switch, the phone's haptics under the game's own vibration table, the phone's own screenshot relayed to the game's shutter, the skier's record book, ghosts and preferences carried between their devices through iCloud key-value storage (CLOUD SAVE — iOS only; everywhere else the game stays device-local), the phone's content restrictions told to the page before it loads (iOS only: a parental control hides the HUD's injuries and locks the switch, an adult's own filter hides them until switched on), and off-site links handed to the system browser.

Its dependency tree is its own, outside the npm workspace: `make native-install`, `make native-bundle` (before every build — the app ships whatever zip is on disk), `make native-typecheck`, `make native-ios` / `native-android` / `native-iphone`. Store builds go through EAS from `.github/workflows/native.yml`, dispatch-only because a build spends paid minutes and store credentials. The store identifier, the Expo project and the signing team are all read from the environment (`native/.env.example`); nothing personal is committed. The root suite holds its four import-free seam modules (`native/src/injected.ts`, `navigation.ts`, `rumble.ts`, `cloud-ask.ts` — `tests/imports_test.ts`'s `SHELL_SEAM`) through `tests/shell_test.ts` and `tests/rumble_test.ts`. → [`native/README.md`](../native/README.md), [`native/RELEASING.md`](../native/RELEASING.md)

## What the page knows about a shell

One file: `pwa/src/shell-host.ts`. Each shell's initialization script defines one frozen global, `__SH_SHELL__`, before the game's own scripts run, and that module is the only place that reads it. What a shell may say to the page and what the page may ask of a shell travels on a handful of DOM events prefixed `sh-` — a fullscreen ask and its answer, a haptic pulse, a menu row pressed, and beside the shell's name a second frozen global, `__SH_CONTENT__`, the device's content word (`shellContent`); a cloud ask and its answer (`sh-shell-cloud` / `sh-shell-cloud-event`: what is saved and how two devices reconcile is the website's `pwa/src/game/cloud-save.ts`, and when is `use-cloud-sync.ts`; the shell moves one opaque string) — and every one of them is a thing the website already does. **Nothing in `engine/` learns a shell exists**, and a feature a shell needs is a feature the website needs first.

## Deliberate differences from the sibling repos

- **No store listing.** Store metadata, a preflight and a screenshot sweep are out of the slice; the store app is built, but its listing is typed into the consoles by hand (`native/RELEASING.md`).
- **More in the cloud save.** The sibling jet-ski game's store app carries its book and its board through iCloud and keeps its ghosts and settings on the device; this one carries the ghosts too (the smallest first, within a budget under the store's megabyte) and the skier's half of the settings (the later change wins; the picture and the thumbs stay with the machine). The SCREENSHOT bridge is carried: both shells press the game's own shutter by the `shot` word on `sh-shell-command` — the desktop app from View ▸ Take Screenshot (⇧⌘S), the store app when the phone takes a screenshot of its own (`native/src/screen-capture.ts`, `SHOT_COMMAND`), so the hardware's picture is filed in the game's gallery too.
- **No modding seam.** Content is typed data in `engine/game/defs/` (the skis, the tuning). If content authoring outgrows TypeScript rows, the defs modules are already the seam.
- **No multiplayer/server.** Maps are deterministic by seed, so the natural first social feature is asynchronous: a shared seed, then ghost times — no server shell until then.
