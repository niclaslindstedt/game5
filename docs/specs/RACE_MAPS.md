# Race maps — every discipline's own pinned maps

**Built for every discipline `DISCIPLINES` names** — the slalom, the giant
slalom, the super-G, the downhill, speed skiing and the ski cross
(`pwa/src/game/race-maps.ts`, `tests/race_maps_test.ts`,
`race_maps_downhill_test.ts`, `race_maps_superg_test.ts`,
`race_maps_giantslalom_test.ts`, `race_maps_speedski_test.ts`,
`race_maps_skicross_test.ts` — a speed race's box draws its track, the
final's, and quotes the final's figures). What stays here is the SHAPE a
discipline added later fills in as part of being built, the criteria each
discipline's nine were curated by, and the tooling (*The tooling*).

The CAMPAIGN this spec took the disciplines off has since been removed
altogether: the race maps are now the only pinned maps a race is run on,
`campaign.ts` is `pinned.ts` and `CampaignLevel` is `PinnedLevel`
(`pinned-levels.ts`). What follows is kept as written at the time.

## What it is

Before this, a SLALOM and a DOWNHILL off the front door were skied on the
CAMPAIGN's maps: the level card shows the campaign's shelves, filtered by
`fitsMode` (a slalom only the rungs the campaign set a slalom on, a downhill
the downhill rungs and every black) and gated on the shelves the campaign
has opened. So a discipline's measured maps were whatever the campaign
happened to need, a slalom had a handful of maps and a fresh app fewer,
and a map's fitness for the DISCIPLINE was never what chose it.

Now, **every race discipline carries its own NINE pinned maps**,
curated for that discipline alone: nine seeds whose course makes a GOOD
slalom (or downhill, or super-G…), a ladder from the gentlest to the
hardest, all of them open from the first visit. The level card a
discipline's tile opens shows its nine. The campaign is not touched — its
shelves, rungs, locks and board stay exactly as they are, and a campaign
rung that is a slalom is still skied on its own shelf's map.

And the PAUSE CARD names the map well enough to ride it again in the FREE
RIDE: the seed, the country and the grade — everything the free ride's
start card asks for — so a skier who liked a mountain can go and ski the
rest of it.

## Decided

- **Nine per discipline.** Enough for a ladder and a choice of country,
  sky and character; few enough to curate honestly and to show on one card
  without tabs.
- **All nine open.** No locks: these are the record book's maps, not a
  second ladder (the campaign is the ladder). Ordered the gentlest first —
  by the COURSE (its drop, its steepest pitch, its length, its air), since
  the rating's index reads the whole piste and barely separates nine maps
  of one discipline; the card's cursor starts on the last one picked, or
  the first.
- **The TIME TRIAL stays on the campaign's maps** — it is not a discipline,
  it rides any piste, and its level card is unchanged (shelves, gated on
  what the campaign opened). Only the disciplines move.
- **Their own module, the trick maps' shape.** `pwa/src/game/race-maps.ts`
  (DOM-free, storage-free), modelled on `trick-maps.ts`: a `RaceMap` row
  and `RACE_MAPS`, a table keyed by `Discipline` (`defs/modes.ts`:
  `slalom` and `downhill` now; `superG`, `giantSlalom`, `skiCross` and
  `speedSki` as each is built — a `Partial<Record<Discipline, …>>`, and a
  discipline is offered its card only where it has rows), nine rows each,
  in the card's order. A row is a campaign map's shape (`CampaignLevel`:
  id `slalom-1` … `slalom-9`, name, blurb, seed, mode, laps, version,
  digest, region, grade, course, sky, the day its box bills) plus the
  course's `figures` (its drop and its length, m) — so every question
  already asked of a pinned map (what it builds, its sky, whether the map
  standing is it, the run stood up on it, its record-book row) is asked of
  a race map the same way.

  Like a campaign map, each names the generator that built it and the
  digest of what came out, and a test rebuilds every row and holds it to
  its digest — a rule moving under one is a red suite, never a silent
  re-roll (the version contract in `engine/mapgen/versions.ts`).
- **Picked on today's generator.** Every row is curated on
  `CURRENT_GENERATOR_VERSION`, so the seed, country and grade the pause card
  prints build the same mountain in a free ride today. When the generator
  later moves, the pinned row keeps its old version (the race is unchanged)
  while a free ride of the seed builds the new one; that is accepted, and
  the pause line does not promise more than "this seed in this country".
- **Nine different seeds per discipline**, none of them a campaign shelf's
  seed (4, 8, 10, 77) or a trick map's, so each map is a mountain the
  player has not met elsewhere. A seed may carry both a slalom and a
  downhill (a black ski area often has both a slalom hill and a long
  course) — that is one mountain raced two ways, and fine.
- **Spread, not clustered**: across the countries that have race terrain
  (alpine, continental, maritime — the fell has no red or black worth a
  race), across the day (morning, midday, low sun; one night map under the
  floodlights per discipline), and across the sky the discipline's jury
  allows (`JURY` in `defs/modes.ts`: a slalom is raced in any fall, a
  downhill no heavier than a steady fall — a storm row would be eased away
  by `juryDay`, so do not curate one).
- **Which map a measured run is on** stays one question, `pinnedFor` in
  `campaign.ts`: for a discipline it reads `RACE_MAPS[mode]` and the
  discipline's stored pick; for the time trial the campaign's maps as
  today; a link's `?seed=` still takes the pin off for that visit. A
  campaign rung (`pinnedPress` with a rung) is unchanged.
- **What is remembered**: `Settings.raceMap`, one id per discipline
  (`Partial<Record<Discipline, string>>`), held by `mergeSettings` to
  ids that name a row of that discipline. `Settings.level` stays the time
  trial's. A fresh app picks each discipline's first map.
- **The record book needs no migration.** `recordId` already names a map by
  `seed.course`; rows set on the campaign's maps stay in the book under
  their ids and are simply no longer offered on the card. The ghosts the
  same.
- **The pause card's line on a measured run** (a slalom, a downhill, a
  time trial — on a link's seed too) says how to find the mountain again,
  small under the card's usual line: `FREE RIDE IT · SEED 123 · ALPINE ·
  BLACK` (`STRINGS.pauseMountain`, off the snapshot's `seed`, `region` and
  `grade`). A free ride and a tricks run keep their line as it was. A
  press that opens the free ride's start card already set to that seed,
  country and grade is a welcome follow-up, not part of this work.

## The curation, per discipline

A map earns its row by its COURSE, not its grade. Sweep generator seeds on
today's version (`make sim ARGS="--mode <discipline> --count 64"`, `make
rate`, `make level`), shortlist, LOOK at each (`make level SEED=…`, the
discipline's screenshots), and pick nine that make a ladder. Write each
row's numbers (stretch, vertical, gates, the bot's time, par, the trap) into
the PR.

- **Slalom (R31).** A red or a black whose slalom stretch is a real slalom
  hill: a drop inside `slalom.vertical` (140–220 m), the top level's
  gradient in `slalom.gradient` (33–45 %), no drop across the stretch, the
  course standing clean in `make analyze`; the bot home on both runs with
  no DSQ and par near the research's 45–60 s a run. Prefer a variety of
  stretch shapes — a long even pitch, a headwall into a flat, a turny
  fall line — and the hardest maps the steepest pitches.
- **Downhill (R32).** The ski area's course with the most vertical
  (`downhillCourseOf`), a black, as near the research's 850–1030 m of
  vertical and 2.5–4.5 km of length as the seed gives; the bot home with
  no net, no harsh landing and no out; the speed trap on a real straight.
  Prefer variety — a glider's course of long straights, a technical one of
  linked bends, one with big air — and the hardest maps the longest and
  fastest.
- **Ski cross (R35).** The ski area's courses whose gentlest long stretch
  builds a ski cross of 780 m and more over 120–250 m, at least four berms
  and two jumps or step-downs; the bot home in the qualification with no
  harsh landing and no out, and home in a heat of four. Spread across the
  four countries (the fell's gentle blues are the gentlest), the sky the
  speed races' jury allows (no storm), one under the floodlights; the
  hardest a black.
- **Giant slalom (R36).** The ski area's course with the most vertical
  (`giantSlalomCourseOf`), its lowered start inside the 250–450 m band and
  as near the 400 m target as the seed gives, wide enough for its swing;
  the bot home on BOTH runs on the giant slalom pair with no DSQ, no harsh
  landing and no tower near its line. Spread across the countries with
  race terrain and the sky its jury allows, one under the floodlights.
- **Every later discipline** writes its own criteria here (or in its spec)
  from its course rule, before the sweep.

### The re-pin on generator v8

Every discipline's nine were picked again when the race maps moved onto
generator v8 (the tall mountain) and v5 and v6 were retired: seeds 1–40
swept in all four countries, every course a discipline can be set on
built and skied by the bot (`simulateRun`), the clean ones (home, no out,
no harsh landing, no wipeout) sorted by the discipline's ladder key — the
slalom's, the giant slalom's, the super-G's and the ski cross's by their
pitch, the downhill's by its vertical, speed skiing's by its clean run's
speed — and one picked from each ninth of it, spreading the countries and
the skies. No seed a trick map rides and no (mode, seed, course) a race
map stood on before was taken, so no old record meets a new map. Every
pick was then built cold on its course and grade, and the seven that took
six or more attempts to build were swapped for a neighbour in the ladder
that builds in a few. The tables below the first are the history of the
earlier picks.

| Slalom | Seed | Country | Course | Vertical | Length | Sky |
| --- | --- | --- | --- | --- | --- | --- |
| Sea Pitch | 25 | maritime | red 6 | 161 m | 640 m | high |
| Grey Morning | 12 | fell | red 2 | 190 m | 650 m | overcast |
| Fog Gates | 19 | alpine | red 8 | 191 m | 620 m | fog |
| Floodlit | 26 | continental | red 3 | 190 m | 600 m | clear (night) |
| Afternoon Hill | 2 | alpine | red 6 | 190 m | 598 m | fair |
| Bright Fell | 38 | fell | red 5 | 190 m | 568 m | clear |
| Storm Hill | 33 | alpine | red 5 | 140 m | 402 m | storm |
| Snow Gates | 35 | maritime | red 7 | 191 m | 532 m | snow |
| Black Wall | 36 | alpine | black 8 | 191 m | 422 m | flurries |

| Giant slalom | Seed | Country | Course | Vertical | Length | Sky |
| --- | --- | --- | --- | --- | --- | --- |
| Wide Blue | 25 | alpine | blue 5 | 400 m | 2186 m | high |
| Fell Afternoon | 14 | fell | red 6 | 400 m | 2097 m | fair |
| Fog Black | 7 | continental | black 11 | 399 m | 2006 m | fog |
| Grey Sound | 37 | maritime | red 6 | 400 m | 1953 m | overcast |
| Snow Turns | 30 | maritime | red 6 | 400 m | 1892 m | snow |
| Clear Fell | 34 | fell | black 10 | 400 m | 1868 m | clear |
| Flurry Red | 5 | alpine | red 7 | 400 m | 1772 m | flurries |
| Steep Black | 26 | continental | black 9 | 400 m | 1722 m | clear |
| Short and Sharp | 3 | fell | red 8 | 400 m | 1704 m | high |

| Super-G | Seed | Country | Course | Vertical | Length | Sky |
| --- | --- | --- | --- | --- | --- | --- |
| Morning Blue | 31 | fell | blue 5 | 600 m | 3137 m | clear |
| Grey Coast | 21 | maritime | red 7 | 600 m | 2913 m | overcast |
| Early Light | 19 | continental | red 4 | 600 m | 2769 m | fair |
| High Cloud | 23 | alpine | red 7 | 600 m | 2707 m | high |
| Fast Red | 34 | alpine | red 6 | 599 m | 2603 m | high |
| Snow Speed | 5 | maritime | red 5 | 600 m | 2540 m | snow |
| Low Sun | 36 | fell | red 6 | 600 m | 2458 m | clear |
| Evening Black | 38 | alpine | black 12 | 599 m | 2378 m | fair |
| Black Flurries | 39 | continental | black 7 | 599 m | 2292 m | flurries |

| Downhill | Seed | Country | Course | Vertical | Length | Sky |
| --- | --- | --- | --- | --- | --- | --- |
| Evening Run | 38 | alpine | black 12 | 816 m | 2822 m | fair |
| Snow Black | 20 | continental | black 9 | 876 m | 2902 m | snow |
| Long Glide | 25 | maritime | blue 5 | 894 m | 4408 m | high |
| Fell Classic | 14 | fell | red 6 | 933 m | 4161 m | fair |
| Into the Fog | 1 | maritime | red 5 | 950 m | 4132 m | fog |
| Grey Giant | 30 | alpine | red 6 | 979 m | 4138 m | overcast |
| Black Flurries | 39 | continental | black 7 | 1018 m | 3592 m | flurries |
| Low Sun | 36 | fell | red 6 | 1041 m | 3920 m | clear |
| Big Drop | 5 | alpine | red 7 | 1083 m | 3862 m | flurries |

| Speed skiing | Seed | Country | Course | Vertical | Length | Sky |
| --- | --- | --- | --- | --- | --- | --- |
| First Track | 39 | continental | red 6 | 222 m | 445 m | clear |
| Fog Track | 7 | alpine | black 11 | 231 m | 437 m | fog |
| Fair Fell | 29 | fell | red 13 | 245 m | 545 m | fair |
| Sea Fog | 20 | maritime | red 8 | 253 m | 542 m | fog |
| Flurry Track | 23 | maritime | red 3 | 272 m | 529 m | flurries |
| Long Launch | 25 | alpine | red 12 | 301 m | 740 m | high |
| High Track | 26 | alpine | red 2 | 282 m | 525 m | high |
| Snow Track | 36 | continental | black 6 | 289 m | 521 m | snow |
| The Fastest | 19 | maritime | red 11 | 318 m | 732 m | high |

| Ski cross | Seed | Country | Course | Vertical | Length | Sky |
| --- | --- | --- | --- | --- | --- | --- |
| Alpine Berms | 25 | alpine | red 12 | 166 m | 861 m | high |
| Fell Black | 15 | fell | black 12 | 190 m | 961 m | clear |
| Continental Cross | 26 | continental | red 3 | 189 m | 951 m | clear |
| Snow Cross | 12 | maritime | red 11 | 181 m | 904 m | snow |
| Flurry Cross | 23 | continental | red 7 | 185 m | 913 m | flurries |
| Roller Coast | 7 | maritime | red 10 | 166 m | 814 m | clear |
| Afternoon Cross | 29 | alpine | red 7 | 184 m | 895 m | flurries |
| Blue Jumps | 39 | fell | blue 6 | 181 m | 869 m | clear |
| Fog Cross | 31 | alpine | red 4 | 192 m | 882 m | fog |

### How the first eighteen were picked

Seeds 1–60 swept in the alpine, the continental and the maritime on
generator v5: each country's ski area built, every red and black course
(the slalom) or `downhillCourseOf`'s course (the downhill) set as the
discipline with `createGame`, the bot down it (`simulateRun` with `mode`,
the Swift or the Eagle), and the course's figures printed beside it — the
set's vertical and length, its steepest 30 m, its gates and combinations
or jumps, the trap, the bot's time against par, harsh landings and
wipeouts, the dealt sky and hour. About 250 slalom courses and 55 downhill
courses came back. A slalom stretch's drop comes in steps (110, 140, 160,
190 m); everything under 140 m fails R31's band and was dropped, and so
was every course the bot did not finish. The maritime has no black, so the
downhill's nine are alpine and continental. The shortlist was then built
once more as a row, both slalom runs skied by the bot (`secondRunOff`) and
the downhill's race (training off), and every one came home.

| Slalom | Seed | Country | Drop | Steepest | Bot run 1 / 2 |
| --- | --- | --- | --- | --- | --- |
| 1 Soft Rhythm | 2 | maritime | 160 m | 36 % | 61.4 / 63.8 s |
| 2 Afternoon Hill | 1 | alpine | 140 m | 38 % | 49.8 / 50.9 s |
| 3 Long Pitch | 17 | alpine | 191 m | 45 % | 61.9 / 61.5 s |
| 4 Thin Light | 33 | continental | 160 m | 49 % | 55.3 / 56.0 s |
| 5 Snow Gates | 3 | maritime | 161 m | 49 % | 57.9 / 58.1 s |
| 6 Floodlit (20:00) | 31 | continental | 190 m | 50 % | 61.3 / 61.8 s |
| 7 Clear Wall | 34 | maritime | 191 m | 50 % | 66.8 / 66.8 s |
| 8 Black Pitch | 46 | alpine (black) | 140 m | 58 % | 52.8 / 52.9 s |
| 9 Headwall | 47 | continental (black) | 191 m | 63 % | 50.8 / 49.4 s |

| Downhill | Seed | Country | Drop | Length | Jumps | Trap | Bot |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 Short Course | 55 | alpine | 552 m | 2.0 km | 4 | 78 km/h | 80.2 s |
| 2 Glider | 48 | continental | 873 m | 2.6 km | 3 | 104 km/h | 94.3 s |
| 3 Air Time | 16 | continental | 792 m | 2.5 km | 6 | 121 km/h | 92.4 s |
| 4 Grey Day | 18 | alpine | 949 m | 2.7 km | 3 | 77 km/h | 101.1 s |
| 5 January | 36 | alpine | 941 m | 2.6 km | 1 | 112 km/h | 101.3 s |
| 6 Night Run (20:00) | 38 | alpine | 1033 m | 2.9 km | 4 | 96 km/h | 113.2 s |
| 7 Five Jumps | 53 | continental | 1032 m | 2.8 km | 5 | 108 km/h | 114.0 s |
| 8 Long Morning | 41 | alpine | 1056 m | 3.0 km | 2 | 98 km/h | 116.3 s |
| 9 The Wall | 52 | continental | 1088 m | 2.8 km | 5 | 114 km/h | 106.0 s |

The sweep was a scratch script over `@engine` (the generator, `createGame`,
`simulateRun`, `raceParOf`), a minute or two a seed in three countries —
run it in four slices in parallel. The lab below is that script made
permanent.

## The tooling

- **Still to write:** `make rate` gets `RACE=<discipline>` (`--race <discipline>`): the
  committed nine audited the way `CAMPAIGN=1` audits the ladder — the
  digest that builds today against the row's, the rating, the course's
  figures, the bot's time and par.
  A sweep flag beside it (`--race <discipline> --count n`, the candidates
  of every country printed as above) would make the next discipline's
  curation one command.
- `make routes` writes every race map's line too (into
  `campaign-routes.ts`, keyed by the map's id, as the trick maps' are), so
  a box draws its piste without building the map.
- `tests/race_maps_test.ts`: nine rows per built discipline, unique ids,
  unique seeds within a discipline, none of them a campaign or trick seed,
  more than one country and sky; which map a run is on; the picks kept;
  the words. Every row rebuilt and held to its digest, course, grade, day,
  loop and figures, its course inside its rule's band, is
  `tests/support/race-maps.ts`'s `holdRaceMaps(discipline)` — called once
  a discipline, a FILE a discipline (`race_maps_test.ts` the slalom's,
  `race_maps_downhill_test.ts` the downhill's), because nine builds are
  about fifty seconds and the suite keeps a file under a minute. A new
  discipline adds `race_maps_<discipline>_test.ts` and its row in
  `SHARD_WEIGHTS`. The bot's finish is the sweep's, not the suite's.

## The app

- **The level card** for a discipline: one page of nine boxes (three
  across on a desktop, a column on a phone), no shelf tabs; each box the
  map's piste (its route), its grade mark, day line, the course's drop and
  length (`STRINGS.levelsFigures`) and the best time in the record book. The campaign's box classes are reused; the
  time trial's card is unchanged.
- **The front door's tiles** bill the picked map's name, as today
  (`frontDoorPins`), now read off `RACE_MAPS`.
- **Every word** in `strings.ts` (`strings-slalom.ts`,
  `strings-downhill.ts`).

## To do

- [x] `race-maps.ts`: the type, the table, `raceMapsOf`, `raceMapFor`,
      `findRaceMap`, `mergeRacePicks` (the build and the run are
      `campaign.ts`'s, since a row is a campaign map's shape).
- [x] Curate the SLALOM's nine.
- [x] Curate the DOWNHILL's nine.
- [x] Curate the SUPER-G's nine (with the super-G).
- [x] `pinnedFor` / `pinnedPress` / `frontDoorPins` read `RACE_MAPS` for a
      discipline (`PinnedPicks`); `fitsMode` stays the campaign's and the
      time trial's.
- [x] `Settings.raceMap` and its merge; the app's pick handler.
- [x] The level card's discipline page.
- [x] The pause card's map line.
- [x] `make routes` over the race maps.
- [x] `make rate RACE=…` (the nine audited: digest, rating, the course, the
      bot against par); a sweep flag still to write (*The tooling*).
- [x] `tests/race_maps_test.ts`, `race_maps_downhill_test.ts`; the
      campaign tests adjusted.
- [x] Docs: `docs/getting-started.md`, `docs/configuration.md`,
      `AGENTS.md`, the `campaign` skill, a changeset fragment.
- [ ] Each later discipline's nine, with its spec.

## Open questions for the user

- Should a discipline's nine ever LOCK (say, the last three behind a
  podium on the first six)? Decided open for now.
- Should the time trial get its own nine too, or keep the campaign's?
  Decided: keeps the campaign's.

### How the ski cross's nine were picked

Seeds 11–40 swept in all four countries on generator v6: each country's ski
area built, up to four of its courses with 140 m of drop and more built as
a ski cross (`setSkiCross`), the bot down the qualification and a heat of
four (`simulateRun` with `mode: "skiCross"`, `heat`), and the course's
figures beside it — about 380 courses, 168 of them clean by the criteria
above. The nine, gentlest first:

| Ski cross | Seed | Country | Course | Length | Drop | Berms | Jumps + steps | Bot (qualifying) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fell Rollers | 24 | fell | blue 8 | 830 m | 128 m | 6 | 3 + 2 | 69.1 s |
| Sea Berms | 12 | maritime | blue 4 | 796 m | 129 m | 4 | 6 + 0 | 67.7 s |
| High Fell | 34 | fell | blue 5 | 790 m | 154 m | 4 | 3 + 0 | 54.5 s |
| Afternoon Cross | 16 | alpine | red 13 | 793 m | 159 m | 4 | 4 + 1 | 57.9 s |
| Roller Coast | 17 | maritime | red 4 | 835 m | 172 m | 7 | 3 + 0 | 66.0 s |
| Long Haul | 27 | continental | red 7 | 983 m | 198 m | 8 | 4 + 2 | 76.0 s |
| Big Air Alley | 25 | alpine | red 3 | 933 m | 188 m | 5 | 4 + 1 | 71.7 s |
| Night Cross | 21 | continental | red 3 | 903 m | 183 m | 7 | 5 + 2 | 70.6 s |
| Black Cross | 30 | continental | black 8 | 880 m | 189 m | 7 | 3 + 1 | 63.2 s |

The figures are re-measured on the course's final shape (longer legs
between the berms, the rollers 14–16 m crest to crest), which came after
the sweep: every map kept its stretch and its drop and moved its features.
The bot is home in the qualification and in a heat on all nine; Night
Cross's bot is thrown off one roller crest onto the next one's face at the
end of a long straight (one harsh landing in each run), its only one on
the nine.
