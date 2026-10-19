# The store listing

One authored source compiles into the files the upload tools read.

- `listing.mts` — **committed.** The rules: which storefronts this game ships
  on, the categories, the age-rating questionnaire with a reason on every row,
  the field limits and the release policy.
- `copy.mts` — **gitignored.** Every word a buyer reads. Nothing backs it up;
  keep a copy outside the checkout.
- `copy.example.mts` — the committed skeleton that documents the shape.

```sh
make store-preflight     # is this checkout wired up to ship?
make store-metadata      # compile the listing (ARGS="--check" to validate)
```

Fall Line ships on the **App Store** alone. The desktop shell under `tauri/`
has no Mac App Store record and there is no Steam page, so `listing.mts` says
so and neither the generator nor the preflight asks for them. Turning one on is
the flag plus the section it belongs to.

There is no screenshot harness in this tree yet: its recipes stage the actual
game, and Fall Line's have to be written against its own HUD and mountains
rather than inherited.

---

Everything App Store Connect and the Play Console need, generated
from sources committed in this repository. Three commands produce the whole
submission package, and one says what is still missing:

```sh
make store-preflight         # is this checkout wired up to ship? what is left?
make store-metadata          # copy.mts + listing.mts → store.config.json, fastlane
# make store-shots           # not written yet — see above; no such target today
```

| Path                                 | What it is                                                   | Committed? |
| ------------------------------------ | ------------------------------------------------------------ | ---------- |
| `copy.mts`                           | **Every word both stores show** — the file you write         | **no**     |
| `copy.example.mts`                   | A skeleton naming what goes where, with placeholder strings  | yes        |
| `listing.mts`                        | The RULES: storefronts, limits, categories, age rating      | yes        |
| `store.config.json`                  | The compiled listing, for `eas metadata:push`                | no (built) |
| `../fastlane/metadata/**`            | The same listing in the layout `fastlane deliver` reads      | no (built) |
| `screenshots/<device>/`              | Upload-ready captioned PNGs at Apple's exact rasters         | no (built) |
| `../../tauri/store/screenshots/`     | The same set at Valve's raster, full-bleed                   | no (built) |

The generated ones are gitignored for the reason `pwa/dist` is: they are
reproducible outputs, and reviewing a 2868×1320 PNG diff in a pull request helps
nobody. Regenerate them whenever you submit.

## The listing

**`copy.mts` is the file to edit, and it is not in this repository.**

The game is **paid on the App Store** and **open source on GitHub**, and those
two facts are only in tension for the listing's WORDS: a description, subtitle,
promotional text and keyword set are what the store indexes and what a
competitor reads, and publishing them here would put the paid listing's own
prose on a crawlable page under somebody else's domain. So the copy is
gitignored, `copy.example.mts` is a committed skeleton documenting the shape,
and the real words are written and kept outside this repository.

Everything that is a RULE rather than a word stayed in the open, in
`listing.mts`: the types, the categories, the age-rating questionnaire, the
contact, and the release policy. An age-rating answer is a claim
about the build that a public repository should be able to check.

One authored source for both storefronts, because they describe one game — a
second hand-kept page is a second place the game's own name, version and claims
go stale. **Keep a backup of `copy.mts` outside this checkout**: nothing here
backs it up, by design.

Brand-shaped fields are **not** in it. The listing title, the marketing URL, the
privacy-policy URL and the copyright line are composed by the generator from
[`pwa/src/identity.ts`](../../pwa/src/identity.ts), so a rename reaches the store
listing the same way it reaches the manifest and the app's name.

A TypeScript module rather than a YAML catalog, for the reason the rest of this
repo's small fixed catalogs are (see [`docs/conformance.md`](../../docs/conformance.md)):
the generator and `tests/store_listing_test.ts` read the same typed rows with no
schema layer and no parser dependency, and the identity it composes against is
itself a module.

### What the generator enforces

`scripts/generate-store-metadata.mjs` **fails rather than truncates**, because
App Store Connect truncates silently and finding that out from a live listing is
the expensive path. It also says which copy module it compiled, and warns
loudly when that is the skeleton — a submission built from placeholders passes
every check and ships a subtitle reading `SUBTITLE — the hook, 30`.

| Field                    | Limit                                       |
| ------------------------ | ------------------------------------------- |
| `title`                  | 2–30 chars (composed from `identity.ts`)    |
| `subtitle`               | ≤ 30                                        |
| `keywords`               | ≤ 100 chars **for the comma-joined string** |
| `promoText`              | ≤ 170                                       |
| `description`            | 10–4000                                     |
| `releaseNotes`           | ≤ 4000                                      |
| `review.notes`           | 2–4000                                      |

It also **cross-checks the listing against the app it describes**, because the
review notes are not decoration — they are the argument that this app is not a
browser pointed at a website, and every claim in them is checkable from here:

- The notes say the whole game ships inside the binary. `src/config.ts` treats
  any `extra.gameUrl` in `app.config.js` as "stream the remote site instead", so
  one appearing there would make the notes false for every build at once. The
  generator refuses.
- The notes name the privacy policy on the game's page on apps.agilator.se
  (`APPS_PAGE_URL` in `identity.ts`), the same page the OPTIONS card links to.
  Apple fetches it before review opens the app.
- The support URL has to be `https` (Apple rejects a `mailto:`) and must not be
  the source repository.

### The review phone number

The one listing field that behaves like a credential. Apple **rings it**, and
this repository is public, so it comes from `ASC_REVIEW_PHONE` in the gitignored
`native/.env` ([`.env.example`](../.env.example) documents it) and never from
any authored file. The generator leaves the field out of the upload rather than hand
review a number that rings nobody, and `make store-preflight` fails until one is
set.

### Uploading

Two paths, both fed from the same authored copy, so they cannot disagree:

| Path                | Uploads                | Notes                              |
| ------------------- | ---------------------- | ---------------------------------- |
| `fastlane deliver`  | text **+ screenshots** | Preferred. Free (MIT). Needs Ruby. |
| `eas metadata:push` | text only              | Cannot upload screenshots.         |

fastlane authenticates with an **App Store Connect API key** rather than an
Apple ID, because a `.p8` carries no 2FA session to expire in the middle of a
forty-minute upload. `ASC_KEY_ID`, `ASC_ISSUER_ID` and either `ASC_KEY_PATH` or
`ASC_KEY_CONTENT` — see `.env.example`; `native/*.p8` and `native/.env` are
gitignored.

`native/fastlane/Appfile` reads the bundle id from `APP_BUNDLE_ID` and the
`metadata` lane in `native/fastlane/Fastfile` uploads the compiled listing (and
the frames under `screenshots/`, once there are any): `cd native && fastlane
metadata`, with fastlane installed (`brew install fastlane`). It submits nothing
unless run with `submit:true`.

## The screenshots

**Not written yet.** There is no `make store-shots` in this tree: the frames
have to be staged against this game's own HUD and mountains at Apple's exact
rasters (iPhone 6.9″, 2868×1320 landscape, and iPad 13″, 2752×2064), each
frame standing a run at a moment and handing it to the engine's own driver so a
re-shoot reproduces the same frame. Until then, `native/store/screenshots/` is
filled by hand from the real build at those rasters — never a mock-up.

## What still has to be done by hand

None of these can be automated — they live in the store consoles, and
`make store-preflight` walks all of them plus the credentials and the app record:

- **App Privacy** (Apple) and **Data safety** (Play). The answer is
  NO DATA COLLECTED, and it is true: settings, records, ghosts, statistics and
  photographs are all in the WebView's own local storage, and the record book,
  the ghosts and the skier's half of the settings travel only through the
  player's own iCloud. The privacy policy on the game's page says the same.
- The age-rating questionnaire, once per storefront, from the `advisory` answers
  authored in `listing.mts`.
- The 1024×500 feature graphic Play requires and Apple does not.

[`../RELEASING.md`](../RELEASING.md) is the full submission run-through.
