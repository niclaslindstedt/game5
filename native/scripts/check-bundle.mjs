// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The EAS build's check that the packed web app was built for ITS profile:
// `scripts/bundle-web.mjs` writes what it built into the zip (`edition.json`),
// and an App Store build (`production`) must carry no developer page and no
// build may carry the gore (pwa/src/game/edition.ts). Run by EAS after it
// installs the app's dependencies (`eas-build-post-install` in package.json),
// where EAS_BUILD_PROFILE names the profile; run by hand it checks the zip
// against `--profile <name>`.
//
//   node scripts/check-bundle.mjs --profile production

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { unzipSync } from "fflate";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ZIP = join(APP_DIR, "assets", "webroot.zip");
const at = process.argv.indexOf("--profile");
const profile = at >= 0 ? process.argv[at + 1] : process.env.EAS_BUILD_PROFILE;

const fail = (why) => {
  console.error(`✗ ${ZIP}: ${why} — run \`npm run bundle -- --profile ${profile}\` first`);
  process.exit(1);
};

if (!profile) {
  console.log("• no EAS_BUILD_PROFILE and no --profile: nothing to check the bundle against");
  process.exit(0);
}
let packed;
try {
  packed = unzipSync(readFileSync(ZIP), { filter: (f) => f.name === "edition.json" })[
    "edition.json"
  ];
} catch {
  fail("there is no packed web app");
}
if (!packed) fail("the packed web app says nothing of what it was built for (no edition.json)");
const edition = JSON.parse(new TextDecoder().decode(packed));
if (edition.gore) fail("the packed web app carries the gore, which no phone build may");
if (profile === "production" && edition.developer) {
  fail("the packed web app keeps the developer page, which the App Store build may not");
}
if (edition.profile !== profile) {
  fail(`the packed web app was built for "${edition.profile}", this build is "${profile}"`);
}
console.log(`✓ the packed web app was built for ${profile}`);
