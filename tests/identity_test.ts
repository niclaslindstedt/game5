// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// ONE IDENTITY MANIFEST (OSS_GAME_SPEC §35.6): the name, the URLs and the
// colours live in `pwa/src/identity.ts`, and every surface that cannot
// import it — the static HTML head, the SEO files under `pwa/public/`, the
// icon generator, the package manifests, the README's play link — restates
// them. This holds every restatement to the manifest, so a rename or a
// domain move is one edit and a failing test naming the copies, not an
// archaeology expedition.
//
// The other half is the siblings: this repository was bootstrapped from a
// snowmobile game (and, before it, a jet-ski game and a rally game) with the
// same shape, and the
// surest way for a sibling's name to leak in is a copied file nobody
// re-read. So their names are refused wherever a player or a store could
// read them.
//
// AND THE SITE IS NOT INDEXED. The web deploy carries no crawlable
// description of itself — no meta description, no canonical, no Open Graph
// or Twitter card, no JSON-LD, no prerendered body copy, no sitemap and no
// `llms.txt` — and says so in `robots.txt` and in every page's `noindex`.
// That is a decision, not an omission, so it is held here: a discovery tag
// or a crawler file added back fails these tests rather than shipping
// quietly.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_SHORT_NAME,
  APP_TITLE,
  BRAND_COLOR,
  PALETTE,
  PUBLISHER,
  REPO_URL,
  SITE_URL,
} from "../pwa/src/identity.ts";
import { cacheIdForBase } from "../pwa/src/app-pwa.ts";

const ROOT = process.cwd();
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

const html = read("pwa/index.html");
const readme = read("README.md");

/** The content of every `<meta … name|property="key" content="…">`. */
function metas(key: string): string[] {
  const out: string[] = [];
  for (const m of html.matchAll(/<meta\s+[^>]*>/g)) {
    const tag = m[0];
    const k = /(?:name|property)="([^"]+)"/.exec(tag)?.[1];
    const v = /content="([^"]*)"/.exec(tag)?.[1];
    if (k === key && v !== undefined) out.push(v);
  }
  return out;
}

describe("the manifest itself", () => {
  it("is well-formed", () => {
    expect(APP_NAME.trim()).toBe(APP_NAME);
    expect(APP_NAME.length).toBeGreaterThan(2);
    expect(APP_TITLE).toContain(APP_NAME);
    // A launcher cuts a home-screen name at about twelve characters.
    expect(APP_SHORT_NAME.length).toBeLessThanOrEqual(12);
    expect(APP_SHORT_NAME).not.toMatch(/\s/);
    expect(PUBLISHER.length).toBeGreaterThan(0);
    expect(APP_DESCRIPTION.length).toBeGreaterThan(40);
    expect(SITE_URL).toMatch(/^https:\/\/[^/]+$/);
    expect(REPO_URL).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+$/);
    for (const [name, hex] of Object.entries(PALETTE)) {
      expect(hex, `PALETTE.${name}`).toMatch(/^#[0-9a-f]{6}$/);
    }
    // The brand colour is one of the palette's, never a hex of its own.
    expect(Object.values(PALETTE)).toContain(BRAND_COLOR);
  });
});

describe("the static head (pwa/index.html)", () => {
  it("names the app", () => {
    expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toBe(APP_TITLE);
  });

  it("carries the brand colour the manifest states", () => {
    const colours = metas("theme-color");
    expect(colours.length).toBeGreaterThan(0);
    for (const v of colours) expect(v).toBe(BRAND_COLOR);
  });

  it("tells every crawler not to index it", () => {
    const robots = metas("robots");
    expect(robots.length).toBe(1);
    for (const directive of ["noindex", "nofollow"]) expect(robots[0]).toContain(directive);
  });

  it("gives a crawler nothing to index", () => {
    // Each of these is a discovery signal the site deliberately does not
    // emit. `noindex` alone is a request; carrying none of them is the
    // reason there is nothing to show even where the request is ignored.
    for (const key of [
      "description",
      "keywords",
      "og:title",
      "og:description",
      "og:image",
      "og:url",
      "og:site_name",
      "og:type",
      "twitter:card",
      "twitter:title",
      "twitter:description",
      "twitter:image",
    ]) {
      expect(metas(key), key).toEqual([]);
    }
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('rel="sitemap"');
    expect(html).not.toContain("application/ld+json");
  });

  it("prerenders no copy describing the game", () => {
    // The app mounts into #root; the body must not also carry a static
    // description of the game for a crawler or an unfurler to read. Only
    // the noscript line survives, and it says what the page NEEDS, not what
    // the game IS.
    const body = /<body[^>]*>([\s\S]*)<\/body>/.exec(html)?.[1] ?? "";
    const prose = body
      .replace(/<noscript>[\s\S]*?<\/noscript>/g, "")
      .replace(/<script[\s\S]*?<\/script>/g, "")
      .replace(/<[^>]+>/g, " ")
      .trim();
    expect(prose).toBe("");
    expect(body).not.toMatch(/<h[1-6][\s>]/);
  });
});

describe("the discovery files (pwa/public)", () => {
  it("CNAME is the site's host", () => {
    expect(read("pwa/public/CNAME").trim()).toBe(new URL(SITE_URL).host);
  });

  it("robots.txt disallows everything and advertises no sitemap", () => {
    const robots = read("pwa/public/robots.txt");
    expect(robots).toMatch(/^Disallow: \/\s*$/m);
    expect(robots).not.toContain("Sitemap:");
    expect(robots).not.toMatch(/^Allow: \//m);
  });

  it("ships no crawler index of the site", () => {
    for (const rel of ["pwa/public/sitemap.xml", "pwa/public/llms.txt"]) {
      expect(existsSync(join(ROOT, rel)), rel).toBe(false);
    }
  });

  it("the pages a store cites stay reachable but unindexed", () => {
    // Apple and the Play Console fetch these by URL, so they must keep
    // working; they must not be a way in from a search result either.
    for (const rel of ["pwa/public/privacy/index.html", "pwa/public/support/index.html"]) {
      const page = read(rel);
      expect(page, rel).toMatch(/<meta name="robots" content="[^"]*noindex/);
      expect(page, rel).not.toContain('rel="canonical"');
    }
  });
});

describe("the restatements that cannot import the manifest", () => {
  it("the README's title and play link are the manifest's", () => {
    expect(readme.split("\n")[0]).toBe(`# ${APP_NAME}`);
    expect(readme).toContain(`[Play it now](${SITE_URL}/)`);
    expect(readme).toContain(REPO_URL);
  });

  it("both package manifests describe this app", () => {
    for (const rel of ["package.json", "pwa/package.json"]) {
      const pkg = JSON.parse(read(rel)) as { description?: string };
      expect(pkg.description, rel).toContain(APP_NAME);
    }
  });

  it("the icon generator paints the manifest's palette", () => {
    // It draws in plain Node with no bundler and restates the hexes it
    // needs; a palette change that skips it ships icons in the old colours.
    const gen = read("scripts/generate-icons.mjs");
    for (const name of ["skyHigh", "sky", "snow", "snowShadow", "flag", "hudShadow"] as const) {
      // (`gateBlue` is the game's, not the mark's: the icon carries one red gate.)
      expect(gen, `PALETTE.${name} (${PALETTE[name]})`).toContain(PALETTE[name]);
    }
  });

  it("the service worker's cache id is this app's, per slot", () => {
    expect(cacheIdForBase("/")).toMatch(/^fall-line/);
    expect(cacheIdForBase("/preview/")).not.toBe(cacheIdForBase("/"));
    expect(cacheIdForBase("/branch/")).not.toBe(cacheIdForBase("/preview/"));
  });
});

describe("the sibling games' names stay in the sibling games", () => {
  const surfaces = [
    "pwa/index.html",
    "pwa/public/robots.txt",
    "pwa/src/identity.ts",
    "pwa/src/app-pwa.ts",
    "pwa/public/privacy/index.html",
    "pwa/public/support/index.html",
    "package.json",
    "pwa/package.json",
    "README.md",
  ];
  for (const rel of surfaces) {
    it(`${rel} never names it`, () => {
      const text = read(rel);
      expect(text).not.toMatch(/Scandinavian Flick/i);
      expect(text).not.toMatch(/scandi-flick/i);
      expect(text).not.toMatch(/\bgame2\b/);
      expect(text).not.toMatch(/Sea Haven/i);
      expect(text).not.toMatch(/sea-haven/i);
      expect(text).not.toMatch(/\bgame3\b/);
      expect(text).not.toMatch(/Powder Run/i);
      expect(text).not.toMatch(/powder-run/i);
      expect(text).not.toMatch(/\bgame4\b/);
    });
  }
});
