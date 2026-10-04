---
name: ski-tuning
description: "Use when changing A PAIR'S OWN NUMBERS — the spec in `engine/game/defs/skis.ts` (the skier's mass and the gear's, the length, the waist, the tip and the tail, the sidecut radius, the flex, the rocker, the most edge, the stance and the mount, the legs' spring, the drag area upright and in a tuck, the CoG and the crouch, the poles' reach and push), the documented expectation a test holds the physics to (`topSpeed`), what separates one rival from another in the field (`Rival.pace`), or adding a pair to the catalog of six. Owns what every per-pair knob buys, the real-class bands each number must stay inside, and the `make ride` + `make sim` sweep that is the only honest test of a retune. Not the LOOK of the skis (`ski-design`) and not the shared model every pair inherits (`ski-physics`)."
---

# Tuning the skis

This skill owns **two questions**: is each pair a believable ski of its kind
— does it run, carve, skid, float and land the way its numbers say it will?
And is each of the six an ANSWER to a kind of snow rather than a point on one
scale with a winner?

The answer is measured, never asserted. **Any change to `defs/skis.ts` owes
`make ride` and `make sim`, before and after.**

**Read this skill's lessons first** —
`npx ogf-skill-lessons ski-tuning --list`.

| Load beside this one | For |
| --- | --- |
| `ski-physics` | the SHARED model every pair inherits — the forces read the spec, the spec never branches the model |
| `simulate-run` | reading the `make sim` table |
| `bot-improvement` | when the bot cannot use what you just gave the skis |
| `ski-design` | how the skis LOOK — their drawing reads the same spec |

## The catalog

SIX pairs, `SKI_CATALOG` in `defs/skis.ts`, in the order the ski card turns
through them — best all-round first, the one that asks most of a skier last:
`SKIS` (the CHAMOIS, an all-mountain ski — the reference every shared number
in `TUNING` was tuned on, and the default), `SWIFT` (slalom), `CHOUGH`
(giant slalom), `EAGLE` (downhill), `MARMOT` (powder) and `HARE` (park).
Each is a real CLASS, named for an animal of the high country that moves the
way it skis, and the Chamois's row spread with what differs. Every host reads
them through `@engine` (`SKI_CATALOG`, `skisById`, `isSkiId`); ids are the
animal names.

| Pair | Its answer | What buys it |
| --- | --- | --- |
| Chamois (all-mountain) | the middle of every band, best at nothing | 178 cm, an 88 mm waist, an 18 m sidecut, medium flex, a little rocker — every `footprint.ts` multiplier exactly 1 |
| Swift (slalom) | quickest edge to edge, bites a tight groomed bend, nervous at speed, sinks in powder | 165 cm on a 66 mm waist, a 13 m sidecut, no rocker, the most edge |
| Chough (giant slalom) | holds an edge on ice, carries speed through a long bend, skids a tight one | 193 cm on a 65 mm waist, stiff, a 30 m sidecut (the men's competition minimums), no rocker, a stiffer leg |
| Eagle (downhill) | fastest flat out, lands a downhill's jumps on its length, hates a bend | 218 cm on a 65 mm waist, the stiffest ski, a 50 m sidecut (the men's competition minimums), the smallest tuck (0.35 m²), the heaviest gear |
| Marmot (powder) | floats where the others sink, turns on its base, vague and slow on the groomer | a 116 mm waist, a 22 m sidecut, soft, a rockered tip |
| Hare (park) | spins and lands anything softly, slow in a tuck and loose on an edge | a soft twin-tip on a centre mount, the softest leg with the most travel, the biggest tuck |

Real-class BANDS (a band, never a make and a model — the router's rule):
slalom skis 155–165 cm on 63–70 mm waists with 11–13 m sidecuts; giant slalom
193–195 cm and 30–35 m on at most 65 mm, downhill 218–223 cm and 50–55 m on
at most 65 mm — the race pairs are built to the competition rules'
men's minimums (`docs/disciplines.md`, "The skis": giant slalom ≥ 193 cm,
≥ 30 m, a shoulder ≤ 103 mm; downhill ≥ 218 cm, ≥ 50 m, ≤ 95 mm); all-mountain 170–185
cm on 85–105 mm; powder 100–125 mm; park twin-tips 85–100 mm on a centre
mount; a pair of adult skis with bindings, boots and poles 7–10 kg; a
racer's tuck 0.25–0.35 m² of drag area, upright 0.6–0.9; a carve stood at
30–50° by a recreational skier and 65–75° by a racer. `tests/catalog_test.ts`
holds every row inside them.

The per-pair half of the snow model is `engine/game/footprint.ts`: each
pair's ground pressure (the whole weight over the two skis' length by their
waist), its flex and its rocker turned into multipliers on the shared numbers
— the rest sink and the powder drag (`(p / p₀)^floatExp`), the planing
speed (√ of the pressure ratio), the edge's hold on packed snow (more on a
stiff ski, less on a rockered one), the base's hold in powder (the waist to
`baseFloat`, more with rocker), how fast the edge is reached (a long stiff
ski is slower onto it), and how soft a landing is (a soft ski takes some of
what the legs would) — all exactly 1 on the Chamois. A knob that should
change how a pair meets snow goes through there, never through a branch on
its id.

## Where the numbers live

| Layer | File | What it decides |
| --- | --- | --- |
| The spec | `engine/game/defs/skis.ts` (`SkiSpec`, `LegSpec`, `SKIS`) | how much of each thing THIS pair has; `totalMass`, `envelopeOf`, `inertiaOf` derive from it |
| The magnitudes | `TUNING.snow`, `.grip`, `.steer`, `.skier`, `.poles`, `.air` | how strong each effect is, for every pair |
| The ceilings | `engine/game/limits.ts` | what any pair may reach — read by the model AND the bot |
| The field | `Rival.pace` (dealt in `rivals.ts`), `RACE` in `defs/modes.ts` | how hard each rival's bot may ski (the tuck it is allowed) |

**Nothing in the model branches on a pair** — a new behaviour is a new field
on the spec that the model reads, never an `if (spec.id === …)`.

## What each knob buys

| Knob | Moves |
| --- | --- |
| `skierMass`, `gearMass` | EVERYTHING: the terminal speed (a heavier skier runs faster against the same drag), the sink's load, the landing, the roll. The skier is nine tenths of the moving mass — which is why moving him is how skis are skied. Every row carries the MEDIUM rider (80 kg); the player's build is `withRider` (`defs/riders.ts`: the mass, the drag area, the legs, `strength`, `hold`), never a row's own number — `make ride`/`make sim` take `--rider` |
| `length` | The stations' spread, the tree footprint, the pitch and yaw inertia, the ski's area on the snow (the float), how long it takes onto an edge |
| `waist`, `tipWidth`, `tailWidth` | The station widths: the waist is what floats and turns on its base in powder, the tip what ploughs |
| `sidecut` | THE CARVE: the radius a full edge runs (`carveCurvature`) — the one number that decides what a bend costs |
| `flex` | The edge's hold on the groomer (a stiff ski holds its whole length), how fast it goes onto an edge, how soft it lands |
| `rocker` | Float and steer in powder, at the cost of edge on the groomer |
| `edgeMax` | The most edge at a standstill; `edgeLockAt` fades it with speed |
| `stance`, `mount` | Where the stations stand: the boot centres across, and the boot along the ski (a race mount a little aft of centre, a park mount centred) — the tip and tail shares and the lever the tips turn with |
| `cogHeight`, `crouchDrop` | How high he stands and how readily he rolls; the legs' attachments are placed off it; how far the tuck drops him |
| `skierHeight`, `hipReach` | Where his mass acts, and how far his hips can hang inside a carve |
| `legs` (`rate`, `bump`, `rebound`, `travel`) | The ride: the sag, the heave frequency, how a landing is taken, when the stop bites |
| `cdAUpright`, `cdATuck` | The terminal speed standing and tucked — the tuck's whole reward |
| `poleReach`, `polePush` | The push off the start and across a flat |
| `topSpeed` | NOT an input — a documented expectation |

## The expectation is a test

`topSpeed` (km/h, flat out in a tuck on `TOP_SPEED_PITCH`, a 20° groomed
schuss) is what the physics is meant to reproduce from the rest of the row,
and `tests/skier_test.ts` holds the physics to it. A change that moves it is
either a physics bug or a spec whose expectation needs re-deriving; say which
in the PR, and re-derive from `make ride SCENARIO=schuss` (or
`terminalSpeed` off the spec), never by editing the number until the test
passes. `limits.ts`'s `topSpeedOf` hands the bot the same figure — the bot's
idea of flat out is this row.

## The field

The player skis the pair picked on the ski card (`settings.skis`,
`createGame({ spec })`); each rival is DEALT one of `SKI_CATALOG` off the
run's own stream at the start line (`rivals.ts`), and `Rival.pace` — the tuck
its bot is allowed — beside it, so the same seed deals the same field. A
field that is too fast or too slow is a `RACE` / pace change measured with
`make sim ARGS="--rivals 3"`, not a spec change.

## The workflow

1. **State the target** as a figure and a band: "120 km/h settled on the 20°
   strip in a tuck, and the pair planes by 30 km/h in powder".
2. **Baseline**: `make ride ARGS=--card` — THE ROSTER CARD, one row a pair,
   the figures that tell the classes apart — then `make ride ARGS="--skis
   all"` on `rest`, `rest-powder`, `schuss`, `powder`, `brake`,
   `turn-in`, `carve-powder`, `kicker`; `make sim ARGS="--skis all"` — the
   roster table, one column a pair, `*` on the quickest per seed, and the
   `pow` column saying how much of each piste is drifted.
3. **Move the one knob** that owns the figure (table above). Stay in the
   real bands.
4. **Re-run both labs**, `npx vitest run tests/skier_test.ts
   tests/flight_test.ts tests/catalog_test.ts tests/simulation_test.ts
   tests/determinism_test.ts`.
5. **Update `docs/riding.md`** — its skis paragraph quotes every spec
   number, and its measured table is the new baseline.
6. **Check the drawing still fits**: `skis-body.ts` builds the pair off the
   same spec, so a length or a waist moved moves the picture
   (`make world SEED=38 ARGS=--views=tips,orbit`).

## The roster is judged as a roster

`make sim ARGS="--skis all" COUNT=12` is the verdict: NO pair best
everywhere — the Marmot wins the powder-heavy seeds (a high `pow`), the
Chough and the Swift the groomed ones by their bends, the Eagle a long
straight one, and every pair wins somewhere or has a reason in its blurb not
to (the Chamois is best at nothing by design, the Eagle hates a bend, the
Hare is slow in a tuck). A retune that makes one pair sweep the table has
collapsed the catalog back to one ski, whatever `tests/catalog_test.ts` says
about each row alone.

## What the card says about a pair

The ski card (`menu-skis.tsx`) bills each pair off `ski-stats.ts`, and EVERY
number there is derived: the figures are the row's own `topSpeed`, `length`,
`waist` and `sidecut`; the bars are the engine's own answers —
`cornerGrip(spec, 1)`, the footprint's float over its sink, `harshSpeedOf`,
`terminalSpeed` on the reference pitch — each scaled across the catalog's
spread. So a retune is billed correctly the moment it lands, and
`tests/ski_card_test.ts` holds the sheet to the catalog's claim: every
specialist best at something, the all-mountain ski in the middle of every
band, the powder ski best in powder and the slalom ski worst. A retune that
breaks one of those has changed what a pair IS, and its `blurb` moves with
it.

## Adding a seventh pair

A row spread from `SKIS` with what differs, added to `SKI_CATALOG` (the card
turns through it in that order — by goodness) and to `SkiId`, with a traced
look (`ski-looks.ts`, the `lab-tooling` trace-and-overlay loop), four
topsheets (`ski-topsheets.ts`); its own ANSWER to a kind of snow, never a
point between two others. It owes a `tests/catalog_test.ts` row, a column in
the roster table, and a LOOK at the card and in the race: the builder draws
it off the spec (`ski-design`), so a length or a waist out of the drawn
profile's reach shows there first.

## Skill self-improvement

Record lessons under `.agents/skills/ski-tuning/.lessons/` via the
**`skill-reflection`** skill: a knob that moved a figure nobody expected, a
real-class band that turned out wrong, an expectation that drifted and why.
