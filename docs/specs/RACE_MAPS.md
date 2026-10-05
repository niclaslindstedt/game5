# Race maps — every discipline's own pinned maps

**Built for the super-G; the slalom and the downhill still ride the
campaign's maps.** `pwa/src/game/race-maps.ts` (`RACE_MAPS`, `raceMapsFor`,
`findRaceMap`), the pick per discipline (`Settings.raceMap`, `chosenFor`),
the level card's page of nine, `make rate RACE=…`, `make routes` over them
and `tests/race_maps_test.ts` are in; the super-G's nine are pinned. A
discipline with no rows keeps the campaign's maps, so the slalom's and the
downhill's nine can land one discipline at a time. Delete this file once
every built discipline carries its nine, the pause card's line is in, and
the standing docs say so (see `README.md`). A discipline
built after that (the super-G, the giant slalom, the ski cross, speed
skiing) carries its own nine as part of being built — its spec says so, and
the shape below is what it fills in.

## What it is

Today a SLALOM and a DOWNHILL off the front door are skied on the
CAMPAIGN's maps: the level card shows the campaign's shelves, filtered by
`fitsMode` (a slalom only the rungs the campaign set a slalom on, a downhill
the downhill rungs and every black) and gated on the shelves the campaign
has opened. So a discipline's measured maps are whatever the campaign
happened to need, a slalom has a handful of maps and a fresh app has fewer,
and a map's fitness for the DISCIPLINE was never what chose it.

From here, **every race discipline carries its own NINE pinned maps**,
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
  second ladder (the campaign is the ladder). Ordered by the rating's index
  (`make rate`), the gentlest first; the card's cursor starts on the last
  one picked, or the first.
- **The TIME TRIAL stays on the campaign's maps** — it is not a discipline,
  it rides any piste, and its level card is unchanged (shelves, gated on
  what the campaign opened). Only the disciplines move.
- **Their own module, the trick maps' shape.** `pwa/src/game/race-maps.ts`
  (DOM-free, storage-free), modelled on `trick-maps.ts`: a `RaceMap` row
  and `RACE_MAPS`, a table keyed by `Discipline` (`defs/modes.ts`:
  `slalom` and `downhill` now; `superG`, `giantSlalom`, `skiCross` and
  `speedSki` as each is built — a `Partial<Record<Discipline, …>>`, and a
  discipline is offered its card only where it has rows), nine rows each,
  in the card's order. A row:

  ```ts
  type RaceMap = {
    id: string;          // "slalom-1" … "slalom-9"
    name: string;        // named for what it is like, never where it is
    blurb: string;       // one line on its box
    seed: number;
    version: GeneratorVersion; // written out on every row, never shared
    digest: string;      // levelDigest of the built map
    region?: RegionId;   // the alpine when left out
    grade: PisteGrade;
    course: string;      // the resort's course (R28) the race is set on
    sky?: SkyOverride;   // a sky or hour laid over the dealt day, rarely
  };
  ```

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
- **The pause card's line on a pinned run** names the map and how to find
  it again: `HIGH WALL · SEED 123 · ALPINE · BLACK` over the card's usual
  progress line (`STRINGS.pauseSub…`). On a free ride and a link's seed it
  stays as today (`SEED n · FREE RIDE`) plus the country and grade when
  they are not the defaults. A press that opens the free ride's start card
  already set to that seed, country and grade is a welcome follow-up, not
  part of this work.

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
- **Every later discipline** writes its own criteria here (or in its spec)
  from its course rule, before the sweep.

## The tooling

- `make rate` gets `RACE=<discipline>` (`--race <discipline>`): the
  committed nine audited the way `CAMPAIGN=1` audits the ladder — the
  digest that builds today against the row's, the rating, the course's
  figures, the bot's time and par.
- `make routes` writes every race map's line too (into
  `campaign-routes.ts`, keyed by the map's id, as the trick maps' are), so
  a box draws its piste without building the map.
- `tests/race_maps_test.ts`: nine rows per built discipline, unique ids,
  unique seeds within a discipline, none of them a campaign or trick seed;
  every row rebuilt matches its digest, version, region and grade; the
  discipline's course is set on it (`Level.slalom` / `Level.downhill`) and
  inside its rule's bands. The bot's finish is the sweep's (`make sim`),
  not the suite's — keep the file under a minute and add its row to
  `SHARD_WEIGHTS`.

## The app

- **The level card** for a discipline: one page of nine boxes (three
  across on a desktop, a column on a phone), no shelf tabs; each box the
  map's piste (its route), its grade mark, country, day line, the
  discipline's figures (a slalom: the stretch's vertical, gates and
  steepest pitch; a downhill: length, vertical, the trap) and the best
  time in the record book. The campaign's box classes are reused; the
  time trial's card is unchanged.
- **The front door's tiles** bill the picked map's name, as today
  (`frontDoorPins`), now read off `RACE_MAPS`.
- **Every word** in `strings.ts` (`strings-slalom.ts`,
  `strings-downhill.ts`).

## To do

- [x] `race-maps.ts`: the table and its finders — rows in the campaign's
      own shape (`CampaignLevel`), so `buildCampaignLevel` and the pinned
      run's helpers serve them unchanged.
- [x] Curate the SUPER-G's nine.
- [ ] Curate the SLALOM's nine (sweep, shortlist, look, rate, write rows).
- [ ] Curate the DOWNHILL's nine.
- [x] `pinnedFor` / `pinnedPress` / `frontDoorPins` read `RACE_MAPS` for a
      discipline (`raceMapsFor`, `chosenFor`).
- [x] `Settings.raceMap` and its merge; the app's pick handler.
- [x] The level card's discipline page.
- [ ] The pause card's map line.
- [x] `make rate RACE=…`, `make routes` over the race maps.
- [x] `tests/race_maps_test.ts`.
- [ ] Docs: `docs/getting-started.md` (the level card, the pause card),
      `docs/configuration.md` (`Settings.raceMap`), `AGENTS.md` (the
      router's rows: where it lives, what is stated once — *which map a
      measured run is on*), the `campaign` skill (the race maps are not the
      campaign's), a changeset fragment; delete this spec.

## Open questions for the user

- Should a discipline's nine ever LOCK (say, the last three behind a
  podium on the first six)? Decided open for now.
- Should the time trial get its own nine too, or keep the campaign's?
  Decided: keeps the campaign's.
