// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";

import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

import { gameModels } from "./models-plugin.ts";
import { modelSwitch } from "./src/game/model-switch.ts";
import { appPwa } from "./pwa-plugin.ts";
import { REPO_URL } from "./src/identity.ts";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The base path is injected by the deploy workflows via VITE_BASE — `/`, `/preview/` or `/branch/`
// on GitHub Pages, `/` for local dev and preview builds.
const base = process.env.VITE_BASE ?? "/";

// Sibling release channels that live *under* this build's base and must be
// disowned by its service worker (see pwa-plugin.ts `ignorePaths`).
const ignorePaths = (process.env.VITE_PWA_IGNORE_PATHS ?? "")
  .split(",")
  .map((p) => p.trim())
  .filter(Boolean);

// Is this build going INSIDE a store shell — the phone app or the desktop app —
// rather than onto the web? Both shells' `bundle-web.mjs` pass it. A packaged
// build carries no link back to the source and no word of the website: the
// build label prints plain (`__SOURCE_URL__` is empty, so the repository URL is
// never in the bundle), and the website's own pages — its privacy and support
// pages and its CNAME — are left out (`appPwa`'s `shellBuild`). The shells send
// a player to the game's page on apps.agilator.se instead, and their bundle
// scripts refuse a bundle that names the source or the site.
const shellBuild = process.env.VITE_SHELL_BUILD === "on";

// Build identity for the HUD's build label and the update toast.
const commit =
  process.env.GITHUB_SHA?.slice(0, 7) ??
  (() => {
    try {
      return execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
    } catch {
      return "dev";
    }
  })();
const appVersion = (JSON.parse(readFileSync(here("./package.json"), "utf8")) as { version: string })
  .version;
const buildLabel =
  appVersion +
  (process.env.GITHUB_RUN_NUMBER ? `.${process.env.GITHUB_RUN_NUMBER}` : "") +
  (process.env.GITHUB_SHA ? `+${commit}` : "");

// The update toast's label doubles as the SW-uniqueness salt: a CI build's
// label is unique per deploy; a local build appends a timestamp instead.
const version = process.env.GITHUB_SHA ? buildLabel : `${buildLabel}+${new Date().toISOString()}`;

// The environment files are the repository's root `.env` (`.env.example`
// documents it), read for the client's `import.meta.env` and here alike.
const envDir = here("..");

export default defineConfig(({ mode }) => {
  // The MODEL switch (`pwa/models-plugin.ts`, `src/game/skier-models.ts`):
  // on unless the environment or the root `.env` switches it back
  // (`src/game/model-switch.ts`).
  const env = { ...loadEnv(mode, envDir, "VITE_"), ...process.env };
  const models = {
    skis: modelSwitch(env.VITE_MODEL_SKIS),
    heli: modelSwitch(env.VITE_MODEL_HELI),
    sled: modelSwitch(env.VITE_MODEL_SLED),
    groomer: modelSwitch(env.VITE_MODEL_GROOMER),
    plane: modelSwitch(env.VITE_MODEL_PLANE),
    player: modelSwitch(env.VITE_MODEL_PLAYER),
  };
  return {
    base,
    envDir,
    // No size budgets, by owner decision; this only keeps Vite's own warning
    // quiet. What keeps three.js off the first-render path is the dynamic
    // import of `renderer.ts` in `App.tsx`.
    build: { chunkSizeWarningLimit: 100_000 },
    resolve: {
      alias: {
        "@engine": here("../engine/index.ts"),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(appVersion),
      __BUILD_LABEL__: JSON.stringify(buildLabel),
      __COMMIT_SHA__: JSON.stringify(commit),
      __SOURCE_URL__: JSON.stringify(shellBuild ? "" : REPO_URL),
    },
    // `appPwa` only applies on build, so dev keeps registering no worker (the
    // app passes `enabled: !import.meta.env.DEV` to `usePwaUpdate`).
    //
    // The runtime is Preact: `@preact/preset-vite` compiles JSX against
    // `preact/jsx-runtime` and aliases `react` / `react-dom` onto
    // `preact/compat`, so the pre-built framework chunks resolve to Preact.
    //
    // `gameModels` comes before `appPwa`, so the models it emits are in the
    // bundle the worker's precache list is read off.
    plugins: [
      preact(),
      tailwindcss(),
      gameModels(models, here("..")),
      appPwa({ base, version, ignorePaths, shellBuild }),
    ],
  };
});
