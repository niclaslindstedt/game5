---
name: add-region
description: "Use when a NEW KIND OF SNOW COUNTRY is asked for — a fifth region beside the alpine, the fell, the continental and the maritime, 'add a region for …', or a change to what one of them IS. The whole of what a region is in this repo, as one checklist in order: the engine's row (the relief and the vertical, the woods and the tree line, the kickers, the sun's bands, the crust, the tarn), the surface the physics reads, the app's two tables (the look and the grade) and the card's word, the suite that holds them to one list, every lab's REGION= help, the wildlife rows, the docs, the changelog — and the promise the whole scheme stands on: the alpine row stays all ones, so no seed and no pinned campaign map moves. Owns the order and the measurement each step owes; what each half is made of is `mapgen-improvement`'s, `nature`'s, `snow-look`'s and `atmosphere`'s. The sibling snowmobile game's `add-region`, retyped for a mountain."
---

# Adding a region: a kind of snow country, never a place

A REGION (R21) is a KIND of country — the alpine (a steep face under a summit
ridge, woods to a tree line at half the vertical), the fell (low rounded
country in the far north, birch at a low tree line, a wind crust carved into
sastrugi), the continental (a taller, colder, drier face, lodgepole and white
pine to a high tree line), the maritime (deep heavy snow, fir and birch, rime
at the tree line) — never a range, a resort, a country or a valley that
exists, and it is named in five tables that cannot import each other's reason
to exist. This skill is the one list of them, in the order they have to be
filled, with the measurement each step owes before the next. It routes to the
skills that own the halves: **`mapgen-improvement`** (the row, the rules, the
surface), **`nature`** (the woods, the tree line and the wildlife as they
read), **`snow-look`** (the crust, the ice, the rock as drawn),
**`atmosphere`** (the grade, the sun's bands), **`ski-physics`** (anything a
station reads). Load **`write-code`** beside all of them and
**`skill-reflection`** at both ends.

**Read this skill's lessons first** —
`npx ogf-skill-lessons add-region --list`.

## The one promise

**THE ALPINE ROW IS ALL ONES AND LAYS NOTHING.** Every multiplier in
`engine/mapgen/regions.ts` is a multiple of the rule book's own number, a band
is scaled through `scaleBand` / `scaleCount` (which hand back the SAME object
at one), and a region's own steps — the crust, a frozen tarn — draw off
streams of their own and are skipped where the row lays none. That is what
keeps every seed's mountain byte-identical and every pinned campaign map on
its digest (`tests/generator_version_test.ts`, `tests/region_test.ts`'s "the
alpine is the map every seed always built"). A change that needs a new draw
on the attempt's own stream, or a number that is not a multiple of one in the
alpine, moves every map: that is a generator VERSION row (`versions.ts`), not
a region — stop and read `campaign`.

## The quality bar

A region is DONE when all of the following hold:

- **It is a different country at skiing pace.** `make world REGION=<id>`'s
  `track`, `forest` and `vista`, and `make screenshots ARGS="--region <id>"`,
  read as this country and no other — the lie of the land, the vertical, the
  trees and where they stop, the snow's surface, the cast over the picture. A
  region told apart only by the card's word is a palette, not a region.
- **It builds.** Sixteen of sixteen through `make analyze COUNT=16
  REGION=<id>`; the retry count stays low (a region that needs half its
  attempts is a row fighting R8's grade or R5's descent — retune the row,
  never widen a rule).
- **It skis.** `make sim REGION=<id>`: every seed finishes. The table goes in
  the PR beside the alpine's, which must be UNCHANGED.
- **It names no place.** `tests/region_test.ts` sweeps the tree.

## The loop

### 1. The engine's row

- `engine/mapgen/regions.ts` — the id on `RegionId` and `REGION_IDS`, and the
  row: `relief` (R2, R3 — the vertical's multiple, the spurs, the headwalls),
  `forest` (R14 — `density`, `glade`, `height` as a share of the band so a
  tree never leaves it, `treeLine` as a share of the vertical, `krummholz`,
  the `roster` of `TreeKind`s), `kickers` (R4's count), `sun` (R15's latitude
  and day bands — check `sunWindow` has hours in them, or R15 rejects every
  attempt), `crust` and `tarn` (or null). Say in a comment what each number
  is a fact about.
- A NEW TREE KIND is a `TreeKind` and a shape in `pwa/src/game/forest.ts`
  (built only where one grows, so a map without it pays no draw call).
- **Observe:** `make level SEED=38 REGION=<id>` and two more seeds — the
  crust as a blue wash, the ice a stronger blue, the tree line where the
  crowns stop, birch crowns tan, spruce green. Then `make analyze COUNT=16
  REGION=<id>`.

### 2. The surface the physics reads

The crust and the tarn are `engine/mapgen/surface.ts`'s: laid off streams of
their own, folded into the packed field only past `CLEAR` of the piste's
centreline (R10 holds), published as `Level.crust` / `Level.ice` / `iceAt`.
The physics reads the crust through `packedAt` like any packed snow and the
ice through `onIce` (`TUNING.grip.ice`) as well — an edge on ice holds a
fraction of what it holds on the groomer. A NEW kind of surface a station
must feel is `ski-physics`'s first: read in `skier.ts` behind an optional
`Level` field, so a map without it runs the exact arithmetic it always ran
(`x * 1`, not a branch that re-orders a sum).

### 3. The app's tables

| Table | File | Judged by |
| --- | --- | --- |
| The look: the far woods' tint, the crust, the ice, the rock, the sastrugi, the rime, the needles, the bough load, the bark | `pwa/src/game/region-look.ts` | `make world REGION=<id> ARGS=--views=track,forest,vista` |
| The grade over the whole frame | `pwa/src/game/colour-grade.ts` (the model); `grade-pass.ts` restates it in GLSL | the same views, and `tests/region_test.ts`'s claims on greys; the alpine's stays NEUTRAL (no pass is drawn for it) |
| The card's word | `STRINGS.regionNames`, and the `startRegionHint` sentence, in `pwa/src/game/strings.ts` | `make screenshots ARGS="--surface start"` at all three viewports |

A grade is judged on the picture, never on its numbers: a split of a quarter
toward a deep blue turned a whole frame lavender. Start timid.

### 4. The suite, the labs, the docs

- `tests/region_test.ts` — the new id is on every list by construction; add a
  "builds in its own character" case saying what this country IS (its
  vertical, its tree line, its crust), measured against the alpine on the
  same seeds.
- Every lab's `--region` help text (`scripts/level-map.mjs`,
  `analyze-level.mjs`, `simulate-run.mjs`, `world-preview.mjs`,
  `screenshot.mjs`, `profile-render.mjs`).
- `docs/level-generator.md`'s regions table (and R21's prose if a new kind of
  surface or a new rule lands — mirrored VERBATIM, `docs_rules_test`),
  `docs/getting-started.md`'s COUNTRY bullet, `docs/configuration.md`'s
  `region` row.
- **Run:** `npx vitest run tests/region_test.ts tests/generator_version_test.ts
  tests/determinism_test.ts tests/simulation_test.ts tests/mapgen_test.ts
  tests/analysis_test.ts tests/docs_rules_test.ts` — the digests must NOT move.

### 5. Look, then measure

`make build`, then with `CHROMIUM_PATH=/opt/pw-browsers/chromium`: `make
world SEED=38 REGION=<id>`, `make screenshots ARGS="--region <id>
--viewport desktop"`, and `make profile ARGS="--scene race --region <id>
--window 20"` beside the alpine's (the grade is one more full-screen pass and
a half-float target; the alpine pays neither).

## The traps

- **A band scaled by a literal one is not the same band.** `{min: a*1, max:
  b*1}` is equal but a new object; the scheme only promises the same draws, and
  it holds — but a test that says `toBe(R.sun.latitude)` wants the object.
  Scale through `scaleBand` / `scaleCount`.
- **A new draw on the attempt's stream.** Even in a branch only the new region
  takes, if it sits BEFORE a draw the alpine also makes it is harmless to the
  alpine — but if the alpine's path gains a draw anywhere, every map moves.
  Salt a stream of your own (`surface.ts`'s pattern).
- **The analyzer's bands.** R15 is read off `regionOf(level).sun`; a new
  region-scaled count R4 or R14 warns on must read the region's number too,
  and so must R14's tree line — a region whose tree line is a different share
  of the vertical is a different band of bare mountain.
- **A tarn under a kicker.** Anything the generator stamps after a tarn is cut
  must ask the ice before it stands (`kickers.ts`'s `onIce`, the forest's
  refusal).
- **A place name.** Name the country for what it IS — a fell, not a named
  range; the continental, not a named state.
- **The campaign.** Each shelf is dealt a region on purpose (the nursery on
  the fells, the ridge in the alpine, the glacier on the continental faces —
  `campaign`); a new region's shelf is a deliberate curation, never a side
  effect.

## Checklist

- [ ] `RegionId`, `REGION_IDS`, the row (alpine untouched)
- [ ] 16/16 through `make analyze REGION=<id>`; `make level` looked at
- [ ] a new surface felt through an optional `Level` field, alpine arithmetic unchanged
- [ ] `region-look.ts`, `colour-grade.ts`, `STRINGS.regionNames` rows
- [ ] the wildlife rows name the new region (`regions` on every row of `bird-defs.ts` and `beast-defs.ts` that lives there — species, never places; no tree bird above the tree line); `tests/birds_test.ts` deals a few species in it; `make birds`
- [ ] `tests/region_test.ts` green; generator-version, determinism and sim digests unmoved
- [ ] `make world` / `make screenshots` looked at; `make profile` beside the alpine
- [ ] `make sim REGION=<id>` — every seed finishes; alpine table unchanged
- [ ] docs, the labs' help, the changelog fragment
- [ ] `skill-reflection` for every skill loaded

## Skill self-improvement

Record lessons under `.agents/skills/add-region/.lessons/` in the
`skill-reflection` format; that skill decides at session end what gets
promoted into this file. Never append lessons here directly.
