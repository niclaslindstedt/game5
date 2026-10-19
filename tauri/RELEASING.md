<!-- SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0 -->

# Releasing the desktop app

The desktop app ships one way today: as the **downloads attached to each
GitHub Release** — the web edition wrapped for the desktop, a `.dmg` on macOS, a
`.deb` and an `.AppImage` on Linux, an NSIS installer on Windows. It is cut from
the same tagged commit the website and the phone app are, never from `main`,
and it claims nothing only a store provides. There is no Mac App Store record
and no Steam page (see the end of [`README.md`](README.md)).

## 0. Once, before the first release

- **The identity.** `tauri.conf.json` commits the development identifier
  (`dev.local.fallline`). A release packages under `APP_BUNDLE_ID` (and,
  optionally, `APP_DISPLAY_NAME`) from the repository's secrets, and
  `release.yml` passes `--require-identity`, so it refuses to package under the
  development id. The identifier is where the webview keeps the player's
  progress: once a download has shipped, changing it strands every installed
  copy's saves, so it is fixed per deployment and a move is a migration.
- **Signing and notarization.** Without the Apple secrets a macOS build is
  signed ad hoc and Gatekeeper refuses its first launch once (the release notes
  tell the player how past it). With `MAC_CSC_LINK`, `MAC_CSC_KEY_PASSWORD`,
  `MAC_SIGN_IDENTITY`, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and
  `APPLE_TEAM_ID` set, `.github/actions/apple-signing` imports the Developer ID
  certificate and the build is signed and notarized — in `release.yml` and in
  `desktop-tauri.yml`'s dispatch alike. [`../docs/configuration.md`](../docs/configuration.md)
  has the table. Setting secrets is the owner's job.

## 1. Prove it before you tag

Dispatch `desktop-tauri.yml` for one platform. It packages exactly as a release
does — same script, same signing environment — without cutting a version, so a
certificate or a packaging change is proved before a version is tagged rather
than after. Locally, `make desktop` packages this machine's downloads into
`tauri/release/`.

## 2. Release

Dispatch `version-bump.yml`. It checks `main`, the tree and the version the
changeset fragments add up to, then calls `release.yml`, which tags the
release, creates it as a **draft**, packages every platform onto it (macOS
builds both slices, cross-compiling the Intel one), and publishes it only once
every download is attached.

## What fails quietly

- **A stale site inside the app.** `scripts/bundle-web.mjs` copies whatever
  `pwa/dist` holds; `make desktop` rebuilds it first, and a hand-run
  `tauri build` does not.
- **A source link in a packaged build.** The bundle script refuses a webroot
  that still names the source repository; a build that trips it was built
  without `VITE_SHELL_BUILD=on`.
- **The identifier moving.** See §0 — the saves stay behind under the old one.
