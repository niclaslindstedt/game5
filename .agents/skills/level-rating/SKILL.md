---
name: level-rating
description: "Use when judging whether a generated map is any GOOD and how HARD it is rather than merely correct — choosing or replacing a CAMPAIGN rung, reading a generator change as what it did to the whole seed population, or calibrating one of the rating's scales. Owns `engine/rating/` (the eight axes, the difficulty index, the ladder scorer), `make rate` (the table, `--sim`, `--stats`, `CAMPAIGN=1`) and `make difficulty` (the schematic). Three loops: calibrating a scale from a measured population, shortlisting a ladder, and reading a rules change as a distribution. Not whether a map is BROKEN (`make analyze`, `mapgen-improvement`), and not the campaign's own table and locks (`campaign`)."
---

# Rating a map, and reading a ladder

`make analyze` asks whether a map is BROKEN, and the generator will not hand
one out that is. This asks the question that starts where that one stops: of
two maps that both pass every rule, which asks more of the skier, and what
does it ask FOR — the steepness, the bends, the air, the woods, the
traverses, the powder, the weather, the length. `engine/rating/index.ts`'s header is the model;
this is how it is used.

**Read this skill's lessons first** — `npx ogf-skill-lessons
level-rating --list`. Load **`skill-reflection`** at both ends,
**`write-code`** beside this one for any code change, **`campaign`** when a
map is about to be pinned, **`mapgen-improvement`** when the answer turns
out to be a change to the generator, and **`simulate-run`** whenever a map
is about to move — the bot is the only thing that knows whether the ladder
climbs in the game rather than on paper.

## What the tools say

```sh
make rate SEEDS=7,38                       one row a seed: the raw readings, the eight axes, the index, what it LEADS on, its digest
make rate SEEDS=7,38 ARGS=--sim            ...with the bot's run as the time axis (a run estimated off the length is marked ~)
make rate COUNT=96                         a sweep to shortlist from (ARGS="--from 97" for the next hundred)
make rate SEEDS=38 ARGS="--hour 20 --weather fog"   under a pinned sky
make rate COUNT=96 ARGS=--stats            the POPULATION per axis: min, quartiles, max, the share pinned at 1 and at 0
make rate CAMPAIGN=1                       the committed ladder audited as a set, with the bot's time on every rung
make difficulty SEED=38                    the schematic: the piste by its bends, the pitches, the drifts, the walled woods, the panel
make difficulty CAMPAIGN=1                 one sheet per committed map
```

**Eight axes, each 0..1, none better than another.** Seven are the MAP's
(steepness, bends, air, forest, traverses, powder, length — the length read
as the bot's time when there is one) and one the DAY's (weather: the dark
and the sky).
The index folds them on `RATING.weight`, about four fifths map and one fifth
day. Every band in `RATING.scale` is a normaliser read off a sweep — the
values that read as nothing and as all of an axis — and not a rule.

**The time axis is the bot's run when there is one.** It costs half a
second of simulation a run, so `rateLevel` only takes it handed in
(`lapSeconds`); without it the run is the piste's length at the sweep's median
pace, and the bot's pace varies by a fifth either side of that. Compare maps
on the same kind of reading, and pin a ladder on the measured one.

**The character is the axes, not the index.** `leads` in the table is the
one word a map's character is read as, and a ladder is built out of the axes
as much as the index: six maps that all lead on the steepness are the same
map six times however steep they are.

## Loop A — calibrating a scale

```
   1. make rate COUNT=96 ARGS=--stats     (ARGS="--stats --sim" for the time axis)
   2. read `at 1` and `at 0`              the share of the sweep pinned to either end
   3. move the band, or the measurement   the decision below
   4. re-sweep and read it again
   5. LOOK at the extremes                make difficulty SEED=<best>, SEED=<worst>
```

| What `--stats` shows | What it means |
| --- | --- |
| An axis mostly at 1 | It measures nothing: widen its band, or change the reading |
| An axis mostly at 0 | A wish, not a measurement — the reach is wrong or the generator cannot build it |
| Two axes moving together | One is a restatement of the other; drop or re-aim it |
| An absurd max | A measurement bug, always: a bend read over too short a chord (`CORNER_SPAN`), a grade read across a kicker's lip |

The weather axis is bimodal on purpose — a quarter of maps are dealt an
evening (R19) and a third a clear sky — so its `at 0` and `at 1` shares are
the weather's odds, not a scale to move.

## Loop B — shortlisting a ladder

The failure this exists to prevent: sort the sweep by the index, keep the
top six. Every one is a good map and the campaign is terrible, because they
score for the same reasons and are the same map six times.

Hold a shortlist to a BRIEF instead, and read the index as a pass mark:

- every rung asks MORE than the one under it, by enough to feel
  (`LADDER.step`) and not so much it is a wall (`LADDER.wall`)
- no two rungs the same map twice (`LADDER.apart`, on the closest PAIR)
- every kind of ask led on somewhere: a bends rung, a steep rung, a woods
  rung, an air rung, a traverse rung, a powder rung, a dark one
- the shelf's colour held: every map is built to its shelf's grade (R23),
  and `make rate CAMPAIGN=1` says so with `!!` where one measures another
- the formats interleaved: a race, a time trial
- no `make analyze` errors — the sweep prints them

Then confirm in the game — the bot's time on the candidate — because a rung
the index loves and the bot skis quicker than the one below it is not a
harder rung. `make rate CAMPAIGN=1` reads the committed set and names the
flat rung and the duplicate pair; `campaign` owns the rest of pinning it.

## Loop C — reading a change to the generator

A rules change lands on every seed at once, so one seed cannot say what it
did. The population can.

```
   1. make rate COUNT=96 ARGS=--stats > before.txt    on a clean tree
   2. make the change
   3. make rate COUNT=96 ARGS=--stats > after.txt
   4. diff the two, per axis
   5. LOOK at a seed whose index moved most, before and after
```

Read the DISTRIBUTION, not the mean: a median that moved is the change doing
its job, a tail that grew is the interesting part, an axis that stopped
varying is a rule that has become deterministic. And if the change moved a
campaign map, `campaign`'s version contract is the next thing to read.

## Where everything lives

| Thing | File |
| --- | --- |
| The axes, the bands, the weights, the ladder scorer | `engine/rating/index.ts` |
| The table and the sweep | `scripts/rate-level.mjs` |
| The schematic | `scripts/difficulty-preview.mjs` over `scripts/lib/level-draw.mjs` |
| Tests | `tests/rating_test.ts` |

**Adding an axis.** It belongs here only if it is a different KIND of ask
from the eight — not a second reading of one of them — and it comes with its
band read off a sweep and a `--stats` run in the PR. The weights sum to one
(`rating_test` holds it), so a ninth axis takes weight from the others by an
argument, not by a default.

**Never restate a number another module owns.** R6's least radius is
`LEVEL_RULES.track.minRadius`, R14's corridor `LEVEL_RULES.forest.corridor`,
the trees near a point `treesNear` — read, never copied.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Worth a fragment
here: a band that pinned after a generator change, an axis that turned out
to restate another, a picture that disagreed with a number.
