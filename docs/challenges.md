# Free ride challenges

Every free ride map deals a set of **challenges** — goals the skier can go
after whenever he rides that mountain — each with a **bronze**, a
**silver** and a **gold**. The engine deals them and judges a run for them;
the app keeps the book of what was won on which map, shows the flags, the
running clock and the news, and lists them. They are a WINTER thing: a
summer free ride (the downhill bike's) is judged for none, so it shows no
flags, no chip, no plate and no CHALLENGES on the pause card
(`challenge-run.ts`'s rig is never armed when `GameState.summer` is set).

The engine side lives in `engine/game/challenges/`, its numbers in
`engine/game/defs/challenges.ts` (`CHALLENGES`), and its lab is
`make challenges-table`.

## The kinds

| Kind | Id | What it asks | Value | Medals |
| --- | --- | --- | --- | --- |
| **Timed line** | `line:<run>:<n>` | Ski from a START gate to a FINISH gate down one run, against the clock | the time, s (lower is better) | shares of the line's par: gold 0.96, silver 1.12, bronze 1.45 |
| **Trick goal** | `trick:<x>:<z>` | Leave one kicker's lip and land a trick | the tier met, 1–3 | bronze a clean air, silver and gold a trick the kicker's size allows |
| **Hidden spots** | `spots` | Find the places off the pistes, unmarked until found | how many found | 40 %, 80 % and all of them |
| **Every summit** | `summits` | Stand off every lift at its top | how many tops | a third, two thirds and all of them |

### Timed lines

A map deals three to five lines (one for every two runs it can deal them
on), a run of **every colour** the ski area has first — a green, a blue, a
red, a black and an orange ski route where there is one — then any other.
One line a run:

- the **start gate** stands where the slope has DIPPED: the line's
  **run-in** begins 30 m below where the last summit ramp joins the run (and
  never nearer its head than 40 m), clear of the lift's pad, and the gate
  stands down it at the first arc the par's own profile has a skier pushing
  off its head at 4 m/s up to **15 m/s** (about 55 km/h) — or, on a run
  that never takes him there, where it takes him nearest (95 % of the most
  it does) — never more than 500 m down, so nobody starts a line at a crawl
  on the flat under the top;
- the **finish gate** stands 300–1500 m further down, short of the run's
  foot, and the line drops at least 25 m and 6 % of its length — downhill
  from gate to gate;
- each gate is as **wide as the run** where it stands, its two flags at the
  run's edges, square to the run's heading (`ChallengeGate`: `x, y, z`,
  `heading`, `width`, `left`, `right`, the arc `s`).

The clock starts the moment the skier's step crosses the start gate's line
between its flags going down the run, and stops at the finish, both read to
the fraction of the step. Half way down the judge says a **split**. The
attempt is **void** on a fall, a reset, a lift, getting on any machine (the
helicopter, the snowmobile, the paramotor, the balloon, the plane, a piste
machine, the lodge), straying more than 60 m outside the run's edge, taking
three times the bronze time, or being set down somewhere else. Crossing the
start gate again starts it afresh.

**The par** (`par.ts`) is how long a competent free skier takes, reckoned
off the line itself in the slalom par's mould and on the bot's own reading
of a piste: the speed at every 2 m is what the pitch gives him most of the
way into his tuck — less the base's friction, the powder's drag where the
snow lies loose and the air's — under what the run's bends allow (a share of
the corner grip less a share of the pitch's pull out of a turn, and no
faster than the pair carves) and under a free skier's top speed, every bend
within his skid's reach come to in time. That clock times the median share
of it the bot takes is par. He crosses the start gate at the speed the
run-in's own reckoning gave him there (`LineChallenge.entry`).

**Calibration.** `make challenges-table COUNT=8` skis every line seeds 1–8
deal with the bot, set at the head of its run-in pushing off, and prints its
time against the medals, the run-in's length and the speed it crossed the
start gate at. With the gate at the run-in's head the bot crossed it at
27–68 km/h (median 30); with the gate down where the slope dips, at
40–61 km/h (median 49), and par is scaled by its median over those lines. Before
calibration (the profile alone) the bot ran 0.77–1.47 of par and won
bronze on 26 lines of 34; with the top speed, the corner share and the
fall's share fitted to that spread and par scaled by the bot's median, the
bot runs about 0.84–1.19 of par: silver mostly, gold now and then, and
never off the table. The orange ski routes — 60–110 % steep in untracked
snow — are past what the bot skis cleanly, so their par is the same
reckoning, unmeasured.

### Trick goals

Two or three kickers a map, one of each size first (big, medium, small by
the lip's height: under 1.5 m small, 2.5 m and over big). A kicker is named
by where its lip stands, to the metre — the same kicker is the course's
`K3` on one stand-up of a map and its run's `4K2` on another, and only its
lip never moves. Bronze is a clean air off it; silver and gold are one of
two ladders dealt for its size (`TrickGoal`: the spin at the least in
degrees, the flips at the least, a grab or not):

| Size | Silver | Gold |
| --- | --- | --- |
| small | a 180, or a grab | a 360, or a 360 with a grab |
| medium | a 360, or a 360 with a grab | a 720, or a flip |
| big | a 720, or a flip with a grab | a flip with a 360, or a 720 with a grab |

A flight counts when it left the snow within 6 m plus half the kicker's
width of its lip and **landed whole** (`FlightRecord.outcome` "landed"); it
is read as a trick by the big-air judge's own reader (`readTrick`).

### Hidden spots

Up to five, at least 400 m apart, each a 22 m circle: the **ridge** (the
highest ground a skier can traverse to — never higher than 15 m under the
highest lift top), a **glade** (an opening of no trunk within 14 m inside
woods below the tree line), a **cliff top** (8 m back from the edge of one
of the three highest faces off the pistes), the **far corner** (the low
ground farthest from the village) and a **shore** of the biggest water —
or, on a map with no water, a place on the **tree line**. Every one stands on
ground a skier can stop on (under 35°), clear of the trunks, 60 m off every
run and lane and 200 m inside the map. A map with fewer than two deals none.

### Every summit

Every lift of the ski area — gondola, chair and drag — counted once its
rider is stood off at the top (the `lift` event's `off`).

## Dealt off the map

`dealChallenges(level)` is a pure function of the map, kept per map. Each
kind draws off a stream of its **own** — the map's key (`challengeKey`: its
face or region, its seed and its generator version) hashed with the kind's
id — never `state.rng`. A free ride's map differs only by the course it was
stood up on, and every kind reads what the ski area publishes the same way
whichever that was: runs sorted by id, kickers by their lips, lifts by id.
So the same mountain always deals the same challenges, and the app files a
result by the map's key and the challenge's id. A map with no ski area (a
race's own piste) deals none.

## Judged off the run

`createChallengeRun(level, memory)` arms a judge; the app steps it with the
state after every engine step the player rides (never a bot's pre-roll),
and it hands back that step's `ChallengeEvent`s:

| Event | Says |
| --- | --- |
| `start` | a timed line's clock started |
| `split` | half way down it (`value` the clock) |
| `done` | a line finished (`value` the time) or a trick goal met (`value` the tier), with the `medal` it earns |
| `void` | a line's attempt thrown away, and `why` |
| `found` | one more spot or summit (`what` it is, `value` how many so far) |

`memory.found` hands it what the book already found, so a spot is said once
for good and counted with the ones found on earlier rides. `live()` is the
timed line under way — its clock, its share of the way down and its medal
times — for the HUD. The judge keeps its memory in itself and **writes
nothing into the state**, so a run judged is the run unjudged, digest for
digest.

## In the app

The app's half lives in `pwa/src/game/`:

| Piece | Where | What it does |
| --- | --- | --- |
| **The book** | `challenge-book.ts` | Per map key (`challengeKey`) and challenge id: the best medal, the best value, what a count kind has found, and when it last got better — under `fall-line.challenges.v1` in `localStorage`. A medal only replaces a worse one; a better value on the same medal is kept; a value that earned no medal is kept only while there is no medal. `readChallenges` trusts a stored blob no further than the rig could have written it; `medalTally` totals the medals across every map. |
| **The rig** | `challenge-run.ts` | Armed in `App.tsx`'s `adopt` beside the statistics' rig — a FREE RIDE the player rides is judged, nothing else — with the book's `memoryOf` the map, and stepped beside it on every step the player rides (never the bot's, a pre-roll's or a replay's). `readEvents` (pure) turns a step's events into news lines (a line's start with its medal times, the half-way split, the finish with its medal or the gap to bronze, a void and why, a kicker's goal, `HIDDEN SPOT 3/5`, `SUMMIT 4/7`, a medal won or a new best for the book), files them in the book at once and keeps the last finish's plate. The session is keyed by the run's state (`challengeSessionOf`). |
| **What is shown** | `challenge-hud.ts` | DOM-free payloads off the session: the HUD's CHIP while a line runs (its clock, the medal still in reach and its time, the share of the way down) and the PLATE for `PLATE_HOLD` s after a finish; the minimap's marks (`ChallengeMarks`); the pause card's rows. |
| **The HUD** | `hud-challenge.tsx`, `medal-mark.tsx`, `medal-look.ts`, `pwa/src/challenges.css` | The chip under the seed in the top left, in the colour of the medal still in reach; the plate in the upper third; one medal mark (a disc on a ribbon) every surface draws. |
| **The minimap** | `challenge-paint.ts` (painted by `minimap.tsx` off `HudMinimap.challenges`) | Each line's two gates as a flag pair (start white, finish red, the running line's finish gold), each trick kicker a star in the medal held there, each lift top not yet stood on a hollow triangle, and each hidden spot a dot **only once it is found**. |
| **On the snow** | `challenge-flags-plan.ts` (where, three-free), `challenge-shapes.ts` (built), `challenge-flags.ts` (drawn, built by `gates.ts`) | On a judged free ride only: at each end of every line's start and finish a tall FEATHER FLAG planted a step outside the run's edge — START in white on the gate blue under white chevrons, FINISH in white on red under a chequered head, the running line's FINISH gold and breathing — with a knee-high TIMING POST inside it (the photocell's box, its lens across the run) and the line itself dyed across the snow, blue at a start and red at a finish; beside every trick kicker a PENNANT in the medal held there (slate blue with none); at every hidden spot, **once found**, a small CAIRN with a cyan pennant. Every sail and pennant turns on its pole to fly downwind and flutters in the run's wind (the vertex shader, off `windAt`); the sails glow a little after dark. Seven draws in all, built the first time a judged run stands on the map. |
| **The pause card** | `menu-pause-challenges.tsx` | CHALLENGES beside OPTIONS on a free ride: every challenge with its three bars and the best held, and RIDE on a line's row to stand the ride up again at the top of its run (the PISTE MAP's `runPicked`). |
| **The statistics** | `stats-medals.tsx` | The gold, silver and bronze held across every mountain. |
| **The words** | `strings-challenges.ts` | Every word above. |

`make world ARGS="--free --views=challenge-start,challenge-finish,challenge-gate-side,challenge-far,challenge-kicker,challenge-spot"` (and `--hour=21`) photographs what stands on the snow (`pwa/src/tools/challenge-lab.ts`: a judged ride with a book in which the first kicker holds a gold and every spot is found); `make screenshots ARGS="--surface challenge-line,challenge-kicker,pause-challenges,stats-medals"` photographs the rest: the skier stood just above a dealt line's start gate and short of a dealt kicker's lip, and every page handed a book with medals in it (`scripts/lib/challenge-shots.mjs`).

## Adding a kind

A kind is a row of `CHALLENGE_KINDS` (`registry.ts`): a module beside the
others exporting a `ChallengeKind` — its `id`, `deal(level, rng)` returning
its challenges (each extending `ChallengeBase`: an `id` stable on the map, the
`kind`, the `medals`' bars, `better` and its `unit`, and whatever geometry the
app draws it by) and `watch(level, dealt, memory)` returning the watcher
that judges a run for them — and a type guard for the app. Because each
kind deals off its own stream, a new kind (avalanches survived, a wingsuit
line, a new ride, a ski jump's distance) moves no challenge any other kind
has dealt.
