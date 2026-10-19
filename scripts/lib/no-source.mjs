// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// THE PACKAGED APPS LINK NOTHING BACK TO THE SOURCE. The phone build
// (native/scripts/bundle-web.mjs) and the desktop build
// (tauri/scripts/bundle-web.mjs) carry no repository, issues, releases or
// sponsor link, no "Source code" or "Report an issue" row, and no word of the
// owner's own domain or account — the web edition's host included. The website
// keeps all of it; `VITE_SHELL_BUILD=on` is what takes it out of a packaged
// build (pwa/vite.config.ts).
//
// This is the check that a packaged build did: every file of the webroot is
// read as BYTES — source maps, fonts and images included, since a string can
// hide in any of them — and one that still names any of these fails the bundle
// script before anything is zipped or copied.

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/** What a packaged build must not contain, matched without regard to case. */
export const FORBIDDEN = ["niclaslindstedt", "Source code", "Report an issue"];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else out.push(abs);
  }
  return out;
}

/** Every `{ file, needle }` in `dir` that names one of `FORBIDDEN`. */
export function findSourceLinks(dir) {
  const needles = FORBIDDEN.map((n) => Buffer.from(n.toLowerCase(), "latin1"));
  const hits = [];
  for (const abs of walk(dir)) {
    // Lower-casing ASCII bytes in place is enough: every needle is ASCII.
    const bytes = Buffer.from(readFileSync(abs));
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if (b >= 0x41 && b <= 0x5a) bytes[i] = b + 0x20;
    }
    needles.forEach((needle, i) => {
      if (bytes.includes(needle)) {
        hits.push({ file: relative(dir, abs).split(sep).join("/"), needle: FORBIDDEN[i] });
      }
    });
  }
  return hits;
}

/** Exit the bundle script if `dir` names the source or carries a service
 * worker; say which file and what. A packaged build ships no worker — the
 * bundle on disk is the build — so a `sw.js` at its root means it was built
 * for the web. */
export function refuseSourceLinks(dir) {
  if (existsSync(join(dir, "sw.js"))) {
    console.error(
      `\n✗ refusing this bundle: ${dir}/sw.js is a service worker, and a phone or ` +
        "desktop build ships none. Was it built with VITE_SHELL_BUILD=on?\n",
    );
    process.exit(1);
  }
  const hits = findSourceLinks(dir);
  if (hits.length === 0) return;
  console.error(
    `\n✗ refusing this bundle: a phone or desktop build links nothing back to the source, ` +
      `and ${dir} still does:`,
  );
  for (const { file, needle } of hits) console.error(`    ${file}: "${needle}"`);
  console.error(
    "  Was it built with VITE_SHELL_BUILD=on? A --skip-build reuses whatever the last " +
      "build left, and a plain website build carries the links.\n",
  );
  process.exit(1);
}
