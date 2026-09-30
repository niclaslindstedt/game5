---
name: update-website
description: "Use when the deployed app's identity-derived content under pwa/ may be stale. Discovers commits since the last website update and refreshes identity, metadata and icons so the built site matches pwa/src/identity.ts — and confirms the site is still carrying none of the discovery signals it deliberately withholds."
---

# Updating the Website

**Governing spec sections:** §11.2 (the deployed site IS the product — this is
a webapp-kind project with no separate `website/` tree), §11.3 (SEO surfaces —
**deliberately not met here**, see below), §21.5 (this skill is mandated when
the project publishes a website).

> **THE SITE IS NOT INDEXED, AND THAT IS THE DESIGN.** The web deploy carries
> no crawlable description of itself: no meta description, canonical, Open
> Graph, Twitter card or JSON-LD in the head, no prerendered body copy, a
> `robots.txt` of `Disallow: /`, `noindex` on every page, and no
> `sitemap.xml`, `llms.txt` or `og.png` shipped at all. **Do not "fix" any of
> that.** A sweep that re-adds a discovery signal because the spec asks for
> one is a regression, and `tests/identity_test.ts` will fail it.
> `docs/configuration.md` § *Discoverability* is the description;
> `docs/spec-conformance.md` carries it as a ⊘ against §11.3.

The site is the game, deployed to GitHub Pages at the `SITE_URL` in three slots
(`/` latest release, `/preview/` main, `/branch/` parked feature branch) via
`pages.yml`, with the base path from `VITE_BASE`. What this skill keeps in sync
is the shell around the game — the identity-derived head, the manifest, the
icons, and the hand-authored static pages:

| Surface | Derived from | By |
| --- | --- | --- |
| `index.html` head + `manifest.webmanifest` | `pwa/src/identity.ts` (name, title, description, palette) | `pwa/pwa-plugin.ts` at build time |
| Icons, favicon | `pwa/public/icons/icon.svg` + the palette | `make icons` (`scripts/generate-icons.mjs`) — never hand-edit the PNGs. No `og.png`: there is no share card |
| `robots.txt`, `CNAME` | hand-authored in `pwa/public/` | you — `CNAME` tracks `SITE_URL`; `robots.txt` stays `Disallow: /` |
| `privacy/`, `support/` pages | hand-authored in `pwa/public/` | you — the store listing will cite them later |
| The head of `pwa/index.html` | `identity.ts` (title, palette) | you — the title and the theme colour only; nothing else in that head describes the game |
| Identity strings in app code | `pwa/src/identity.ts` | never re-hardcode a brand string |

Two parity rules from `AGENTS.md` ride along: `pwa/public/icons/icon.svg`,
`scripts/generate-icons.mjs` and `pwa/src/game/app-mark.ts` encode the **same
mark geometry** — change one, change all three, then `make icons`; and a stale
deployed site after identity/feature changes is a bug, not a nice-to-have.

## Tracking mechanism

`.agents/skills/update-website/.last-updated` contains the git commit hash from
the last successful run. Empty means "never run" — fall back to the initial
commit.

## Discovery process

1. Read the baseline:

   ```sh
   BASELINE=$(cat .agents/skills/update-website/.last-updated)
   ```

2. Diff the sources of truth against the baseline:

   ```sh
   git diff --name-only "$BASELINE"..HEAD -- pwa/src/identity.ts README.md docs/ \
     pwa/index.html pwa/public/ scripts/generate-icons.mjs pwa/src/game/app-mark.ts \
     engine/version.ts package.json
   ```

3. If anything changed, walk the mapping table, refresh the affected surfaces,
   and run the checks.

## Mapping table

| Changed file | Effect on website |
| --- | --- |
| `identity.ts` name/title/description | The manifest picks it up at build; the `<title>` in `pwa/index.html` is hand-written and must be re-synced. There is no other copy to sync — that is deliberate |
| `identity.ts` `SITE_URL` | `CNAME`, and the deploy-slot config in `pwa/pwa-plugin.ts` / `pages.yml` must still agree. No sitemap and no canonical URLs to move |
| `identity.ts` PALETTE (the winter set: snow, snow shadow, sky, high sky, pine, track, the flag's red) or `BRAND_COLOR` | `make icons` — the icons render from it; and the desktop shell's restatement (`tauri/shell/src/config.rs`, `tauri.conf.json`), held by `tests/tauri_test.ts` |
| `pwa/public/icons/icon.svg` or `app-mark.ts` | `make icons`, and check `scripts/generate-icons.mjs` still encodes the same mark geometry |
| README / docs feature claims | Nothing on the site restates them any more, so there is no drift to chase — check only that nothing has re-added a description of the game to `pwa/index.html` |
| `engine/version.ts` / `package.json` version | Move only via the release workflow (`scripts/update-versions.sh`); never hand-edit either |

## Update checklist

- [ ] Read baseline and diff sources of truth
- [ ] Re-sync the `<title>` in `pwa/index.html` against `identity.ts`, and
      confirm nothing has re-added a description, canonical, Open Graph,
      Twitter card, JSON-LD or prerendered body copy to that file
- [ ] If the mark or palette changed: `make icons` and commit the regenerated
      art
- [ ] `make build`, then smoke-read the built shell (`pwa/dist/index.html`:
      the title, the `noindex`, the manifest link — and nothing else) and
      confirm `dist/` carries no `sitemap.xml`, `llms.txt` or `og.png`
- [ ] Run `make test`
- [ ] Write the new baseline:

      git rev-parse HEAD > .agents/skills/update-website/.last-updated

## Verification

1. `npx vitest run tests/identity_test.ts` passes — it holds both the
   identity restatements and the not-indexed posture.
2. `pwa/dist/index.html` and the manifest carry the current `identity.ts`
   strings; `CNAME` agrees with `SITE_URL`.
3. `.last-updated` has been rewritten.

## Skill self-improvement

1. **Expand the mapping table** if a new source file started feeding the
   website (operating data — edit it in place).
2. **Record quirks** as lesson fragments — load the **`skill-reflection`**
   skill (`npx ogf-skill-lessons update-website --list`).
3. **Commit the skill edit** alongside the website update.
