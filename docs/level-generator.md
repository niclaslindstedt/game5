# The world generator

Every map in Fall Line is GENERATED from a seed: one MOUNTAIN — a summit ridge along the top of the
world, a valley floor along the bottom, and a concave face between them ridged by spurs and gullies
down the fall line, rolled into rollers, cut by headwalls and cliff bands, with woods below a tree
line that is an altitude and open bowls above it — and ONE PISTE graded down it: an open descent
from a start gate near the summit to a finish straight on the valley floor, its heading wandering
about the fall line with a few long traverses and a schuss or two, never climbing, with crests on it
that are jumps, drifts of fresh snow across it and the groomer's windrows along both edges, the start
line four abreast behind the start gate and gates every hundred-odd metres down to the finish line.
Nothing is authored and nothing is stored — the same seed builds the same map on every machine, and a
map is the seed's to share.

This page is the generator's contract in words. The code lives in `engine/mapgen/`; its rule book is
`engine/mapgen/rules.ts`, whose header states every rule once and whose table carries every number,
each with its unit — and says, for every number that is not the game's own choice, which published
figure it is (a class of course, a kind of country; never a place or a race by name). The rules
below are that header **verbatim** — `tests/docs_rules_test.ts` holds the two copies together, word
for word.

## The numbers behind the rules

The generator's bands are a downhill course's and a ski mountain's: the world is 3 km on a side (one
face of a mid-size area), the vertical 850–1030 m, the piste 3–4.5 km long and 20–40 m wide, its
grade held under 78 % (38°, the steepest groomed piste) and coloured BLUE to 25 %, RED to 40 % and
BLACK past that on its steepest hundred metres, its jumps' lips sized to the pitch so a black's throw
the 40–80 m of air a downhill course's do, its gates 90–150 m apart, the run out of the start hut a
blue's, its bends 20 m at the least on a blue's pitch and 50 m (a downhill ski's sidecut and more) on
the steepest black's; the tree line an ALTITUDE by kind of country — the alpine's 1800–2200 m, the fell's
600–1000 m, the continental's 3000–3500 m, the maritime's about 1500 m — over a valley floor each
region deals at an altitude of its own, with 150 m of krummholz under it.

## What comes out: the `Level`

`generateLevel(seed, opts?)` returns a `Level` (`engine/mapgen/types.ts`):

| Field                        | What it is                                                                                                                                                                                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `size`, `cell`               | The map is `[0, size] × [0, size]` metres (3000), heights on a grid of `cell` (2 m) cells                                                                                                                      |
| `ground`                     | The baked heightfield, the piste's grading, every kicker and every cliff included                                                                                                                              |
| `groundAt`, `normalAt`       | Bilinear height and unit normal off `ground`                                                                                                                                                                   |
| `packedAt`                   | 0 = virgin powder … 1 = groomed piste, off the baked `packed` field                                                                                                                                            |
| `track`                      | THE PISTE, open (`closed: false`): stations every 2 m with `x, z, y, s, heading, width`, from the start line (`s = 0`) to the finish (`s = length`)                                                            |
| `checkpoints`                | THE GATES, in order: index 0 the START GATE (`grid.back` and a station down from the start line), the last the FINISH LINE at `s = length`; each with its `colour`, red and blue alternating                   |
| `spawn`, `grid`              | The start line's centreline point, facing down the piste, and four slots abreast on it (the player's first, the leftmost)                                                                                      |
| `trees`                      | Every trunk: position, ground height, height, trunk radius, crown radius, its kind (drawn only), its clump                                                                                                     |
| `kickers`                    | Every crest shaped to throw a skier: `K1…` on the piste (with their arc length), `X1…` off it, and on a map built for a tricks run the terrain park's `T1…` (`trick: true`, with a `size` and a built `shape`) |
| `cliffs`                     | Every cliff cut into the face (R22), `C1…`: the middle of its edge, the heading it is dropped off in, the drop, the face, the shelf behind it, its width — none within reach of the piste                      |
| `mountain`                   | The summit at the head of the fall line, the base at the finish, the vertical between them, the valley floor's altitude and the tree line's, m above the sea (R2, R21)                                         |
| `sun`                        | Solar hour, day of the year and latitude of a winter day (the region's bands)                                                                                                                                  |
| `weather`                    | The sky R19 dealt: its kind, the fall, the fog, the wind, and whether the run is an evening one                                                                                                                |
| `drifts`                     | Every stretch of the piste under a drift (R17), as arc lengths                                                                                                                                                 |
| `laps`                       | 1 — a run is skied once, top to bottom (R16)                                                                                                                                                                   |
| `region`, `crust`            | The kind of snow country (R21), and the wind crust's own field where the region lays one                                                                                                                       |
| `version`, `attempt`, `seed` | Which generator built it; which sub-seed attempt was accepted; the seed                                                                                                                                        |

Two queries answer what every reader of a piste asks (`engine/mapgen/query.ts`) — and neither wraps,
because the piste is open:

- `nearestTrackPoint(level, x, z, out?)` → `{ index, s, distance, lateral, x, z }` — the nearest
  point of the centreline, its arc length, the plan distance to it and the signed lateral offset
  (positive to the RIGHT of the direction of travel). Off a spatial hash, so it is cheap at 120 Hz.
  `nearestWithin(level, x, z, within, out?)` is the same question bounded to a radius.
- `trackPointAt(level, s, out?)` → the centreline interpolated at arc length `s`, clamped to the
  line: the start line before it, the finish past it. `arcAhead(a, b)` is `b − a` and may be
  negative (a point up the piste is behind); `arcBetween` is its magnitude.

Coordinates follow the engine's conventions: y up, heading 0 along +z — DOWN the fall line, the way
the mountain falls — growing clockwise seen from above, so `(sin h, cos h)` is forward and
`(cos h, −sin h)` is right. The summit ridge is at small z, the valley floor at large z.

## How a map is built

`engine/mapgen/generate.ts` is the search. A map is a pure function of its seed: each ATTEMPT draws
everything from a sub-seed of the seed and the attempt number, compiles a level, and asks the
analysis (`engine/analysis/`) — the same rule book re-checked on the FINISHED map — whether it is
clean. A rejected attempt is followed by the next sub-seed; the order is fixed, so the result is the
same everywhere. Inside an attempt the order is the dependency order:

1. **The mountain** (`terrain.ts`, R2–R3) — the profile down the fall line (a shoulder under the
   ridge, the steepest pitch below it, easing to the run-out), the side ridges, the spurs and gullies
   (a ridged noise stretched down the fall line), the bowls, the headwalls (steps taken out of the
   vertical and put back as short bands) and the rollers over all of it — baked ONCE onto the grid.
   The region's row scales every band and deals the valley floor's altitude and the tree line's.
2. **The start** (`spawn.ts`, R12) — a seeded x under the ridge and the first heading out of it the
   untouched ground makes a fair start along: the fall line first, then further and further across
   it; a few places are tried before an attempt gives up on its mountain.
3. **The piste** (`track.ts`, R5–R7) — a WALK down the fall line two metres at a time: the heading
   bends either side of the fall line on a slow wave whose amplitude a controller sets from how much
   fall is left against how much length is wanted, with the SWEEPS (traverses held across the face)
   and the SCHUSSES (straights held down it) laid over the wave, and the ground steering the heading
   off any it would not fall along or would fall along too steeply. The heading never comes within a
   right angle of straight across, so z grows with every step: the line cannot cross itself and every
   station is lower down the map than the last. The walk's headings are then smoothed over ten metres
   either side and the line laid again along them — a walk turns a little more one step than the
   next, and the corridor's height surface is only consistent when the curvature is smooth. Drawn
   again until one fits: no bend too tight, no two stretches too close, nothing up a side ridge.
4. **The grading** (`track.ts`, R8) — the line NEVER CLIMBS: the highest profile under the mountain
   that falls at least `minGrade` every step and the lowest over it that does the same, and their
   mean; then the same two envelopes for `maxGrade`, and their mean, which keeps both bounds by
   construction; a light blur; the finish straight laid flat and eased into.
5. **The piste's kickers** (`kickers.ts`, R9) — added to the graded profile where the line comes down
   to a lip no steeper than a red's pitch and falls away past it at least as steeply (a roll before a
   pitch), on a stretch straight enough for the lip's own ramp and landing; the lip's height read off
   the landing's pitch, so a black's throws far and a blue's little.
6. **The corridor** (`track.ts`, R8, R10, R18) — the finished line pressed into the ground: level
   across the width but for a slow camber on a traverse (every cell's height read at its arc length
   round the nearest station's LOCAL CIRCLE, so the surface is smooth round a bend on a steep pitch),
   a flat shoulder and the bench past it, the groomer's windrow along each edge on that bench, a bank
   back into the mountain, and the packed field beside it.
7. **The kickers off the piste** (`kickers.ts`, R4) — the same profile stamped on rolls of the face,
   facing down the fall line, clear of the corridor. Then **the cliffs** (`cliffs.ts`, R22), off a
   stream of their own, facing down the fall line — a shelf, a face, a landing apron — clear of the
   piste, the kickers and the side ridges.
8. **The terrain park** (`trick-field.ts`, R20) — CHOSEN here, only on a map asked for one, and
   stamped last; it draws nothing.
9. **The drifts** (`drift.ts`, R17) — stretches of the finished piste dealt to lie under fresh snow,
   off a stream of their own. Then **the wind crust** (`surface.ts`, R21), where the region lays
   one, folded into the packed field clear of the piste.
10. **The forest** (`forest.ts`, R14) — clumps and lanes, then a jittered candidate per cell kept by a
    forest noise and refused near the piste, on steep ground, ABOVE THE TREE LINE (the region's
    altitude over the valley floor's), on a kicker or a cliff, on a lane, or within `forest.gap` of a
    tree already standing; stunted in the krummholz band under the line.
11. **The day** (`sun.ts`, R15) from the region's bands, and **the weather** (`weather.ts`, R19) off
    a stream of its own, last, so it moves nothing above; an evening moves only the start hour.
12. **The gates and the start line** (`spawn.ts`, R11, R13), read off the piste as it finally lies,
    and the compile (`compile.ts`) that binds it all into a `Level`.

A map builds in about two seconds on Node, most seeds on the first attempt.

## Regions (R21)

A map is built in one REGION — a kind of snow country, never a place (`engine/mapgen/regions.ts`,
asked for with `GenerateOptions.region`, published as `Level.region`, read through `regionOf`).
Every number in a row is a multiple of the rule book's own, so the ALPINE row is all ones and a map
nobody asked a region of is exactly the alpine's — no seed and no pinned map moved for the table
existing. Each row also deals the VALLEY FLOOR's altitude and the TREE LINE's from bands of its own
(the research's tree lines), names what grows, and deals the day from its own latitudes:

| Region        | The country                                                                                       | The woods                                                                               | The snow                                 |
| ------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------------------- |
| `alpine`      | R2, R3 as written: 850–1030 m of vertical, the floor at 1300–1600 m                               | spruce and fir, larch and stone pine to a tree line at 1800–2200 m, mountain pine above | powder; no crust                         |
| `fell`        | low and rounded: the vertical ×0.55, the flanks and spurs softer, the floor at 350–500 m; 60–69°N | mountain birch, stunted, to a tree line at 600–1000 m — the top stands bare             | a wind crust over half the country       |
| `continental` | tallest: the vertical ×1.2, deep bowls, more headwalls, the floor at 2300–2700 m; 39–52°N         | lodgepole and aspen low, spruce and fir to a tree line at 3000–3500 m, white pine above | cold and dry; a thin crust on the crests |
| `maritime`    | the vertical ×0.9, the face rounded under the load, the floor at 300–600 m; 36–44°N               | fir and birch, rimed, to a tree line at 1400–1600 m — wooded nearly to the summit       | deep and heavy; no crust                 |

No frozen water lies on a mountain: every row's `river` is null and `Level.ice` is never set.

## Versions, and the digest

The rules ARE the map, so a change that moves what a seed builds re-rolls every map at once. That
is the point of a generator everywhere but the CAMPAIGN, whose eighteen maps were curated — rated,
timed, named — and must stay the maps they were. So the generator is VERSIONED
(`engine/mapgen/versions.ts`): `GenerateOptions.version` asks for a version, `Level.version` says
which one built a map, and everything that is not a campaign map takes `CURRENT_GENERATOR_VERSION`.
A campaign map names its version and carries the DIGEST of the map that came out (`levelDigest`,
`engine/mapgen/digest.ts`: FNV-1a over the piste every 20 m, the gates, the start line, the kickers,
the cliffs, the drifts, every trunk, the day, the sky and the region, and the ground under every gate
and lip), and `tests/generator_version_test.ts` rebuilds each one and compares.

The contract: a change that moves what a seed builds owes a NEW row in `GENERATOR_VERSIONS`, with
the old behaviour kept on the old row as an optional trait read at the one place it differs
(`generatorTraits(opts.version)`); a campaign map moves onto the new version only deliberately,
re-rated and re-timed; and a version no campaign map names any more is deleted, row and trait
branches together. A red digest is never fixed by writing the new one down unless the map was
meant to move.

Today there is one: **v1** is the generator as Fall Line launched with it — the rules as written,
R1–R22 — and is what every campaign map, free ride, race off a link and lab builds.

## Labs

- `npm run level -- --seed 38` — the map drawn from above (`previews/level-38.png`): hillshaded snow
  with contours every 5 and 25 m, the groomed piste and its orange centreline, every gate numbered
  from the START to the FIN, red and blue, every tree, every kicker (`K1…` on the piste, `X1…` off it),
  every cliff, the start line — and a table of the same (`previews/level-38.txt`): the mountain's
  vertical and altitudes, the piste's colour, and every gate with the grade of the piste from the
  last one.
- `npm run rate` — how HARD a map is and what kind of hard (`engine/rating/`: the steepness, the
  bends, the air, the woods walling the piste, the traverses, the drifts, the weather, the length)
  over a sweep; `--stats` is the population per axis, `--campaign` audits the committed ladder,
  `--region` sweeps another kind of country. `npm run difficulty -- --seed 38` draws what makes a
  map hard over its plan.
- `npm run analyze` — the scoreboard over a sweep of seeds (`--seed n` for one, `--from`/`--count`
  for a range): one row a map, every finding by rule, its colour, and the spread of the numbers at
  the foot.

## The rules

- **R1** THE WORLD IS A SQUARE. A map is `world.size` (3000 m) on a side, x and z from 0 to that size, with its heights baked once on a grid of `world.cell` (2 m) cells. Nothing is published outside it, and the piste, the start line and every gate stand on the mountain's face (R2).

- **R2** A MOUNTAIN. The country is one mountain flank, falling toward +z: the SUMMIT RIDGE runs along the top edge at `mountain.summit` of the way down the map — the highest ground, with ridged crests `mountain.crests` metres tall on it and its back falling away behind it — and the VALLEY FLOOR lies along the bottom, from `mountain.base` of the way down: nearly flat, the finish arena. Between them the ground falls `mountain.vertical` (850–1030 m, a downhill course's) on a smooth concave PROFILE: a shoulder under the ridge, the steepest pitch below it, easing all the way to the run-out. SIDE RIDGES rise left and right of the face — past `mountain.flank.inner` metres from the map's middle, measured across x and warped by `mountain.flank.warp` of noise, the ground climbs `mountain.flank.height` (120–220 m) by `mountain.flank.outer`, opening out again toward the valley — so the skiable face is a wide bowl-valley open at the bottom. `Level.mountain` publishes the summit at the head of the fall line, the base at the finish and the vertical between them.

- **R3** THE FACE. Over the profile lie hills of `face.hills.amplitude` metres over wavelengths of `face.hills.scale`; SPURS AND GULLIES of `face.ridges.amplitude` metres running down the fall line (a ridged noise stretched `face.ridges.stretch` times along z); `face.bowls.count` BOWLS above the tree line — round hollows `face.bowls.radius` metres across and `face.bowls.depth` deep; `face.headwalls.count` HEADWALLS — bands across the face where the profile drops `face.headwalls.drop` metres more over a run of `face.headwalls.run`; and over all of it ROLLERS: sharp-crested swells `face.rollers.amplitude` metres high every `face.rollers.scale` metres or so, crests a skier at speed leaves the snow over — on the face and, graded down but not out by R8, under the piste.

- **R4** NATURAL KICKERS OFF THE PISTE. The face carries `kickers.off.count` wind lips shaped to throw a skier: each stands on a roll — where the ground steepens past it by at least `kickers.off.roll` — facing down the fall line, rises `kickers.off.height` metres over a ramp of `kickers.off.ramp` metres that is steepest at its lip, and falls away over a landing of `kickers.off.landing` metres. None stands within `kickers.off.clearance` metres of the piste's edge, so a natural kicker is something a skier leaves the piste to find.

- **R5** THE PISTE IS ONE OPEN DESCENT. The run is skied down a single line walked from the START (R12) near the summit ridge to the valley floor, its heading wandering up to `track.swing` radians either side of the fall line on a slow bend whose wavelength wanders in `track.wander.scale` metres, with `track.sweeps.count` deliberate SWEEPS — long traverses `track.sweeps.length` metres long held `track.sweeps.angle` radians off the fall line — and `track.schuss.count` SCHUSSES — straights `track.schuss.length` metres long held down the fall line, where a downhill course's jumps stand (R9) — and steered off any heading the untouched ground does not fall along by at least `track.minFall` over every `track.gradeWindow` metres, and off any it falls along steeper than `track.steepest`. It ends where it reaches the valley floor (`track.finishZ` of the way down the map) with a FINISH STRAIGHT of `track.finish` metres, its length landing in `track.length` (3–4.5 km, a downhill course's), sampled every `track.step` (2 m). Its first `track.hold` metres run straight. It never crosses itself, and any two parts of it more than `track.separation.along` metres apart along it stand at least `track.separation.plan` metres apart on the map, so no two stretches share a corridor or a bank.

- **R6** NO BEND TIGHTER THAN A SKIER CAN CARRY SPEED THROUGH. The radius of every bend, measured over `track.turnWindow` metres of the line, is at least `bendFloor` of the grade the line falls at there: at least `track.minRadius` (20 m) on a blue's pitch, and wider the steeper the pitch — rising to `track.steepRadius` (50 m, a downhill ski's sidecut and more) where the line falls at `track.maxGrade`, so no hairpin is laid on a headwall; and at least the piste's half-width there with the flat shoulder and the windrow's bench beyond it (R8, R18) — a wide piste bends wide, so its inside edge never folds over itself.

- **R7** A WIDE PISTE. The piste is `track.width` (20–40 m, a downhill course's thirty and a resort run's band) wide, the width wandering smoothly along it over wavelengths of `track.widthScale` metres, narrowing toward the band's least where the untouched face falls across it steeper than `track.narrow`, and opening to the band's widest over the finish straight — the finish arena. No cat track is cut: the band's narrow end is the schuss through the trees.

- **R8** THE PISTE IS GRADED INTO THE MOUNTAIN. Across its width, and `track.shoulder.flat` metres beyond each edge, the ground is levelled with the centreline — keeping at most `track.camber` of cross-fall where the line traverses a slope — and past that it blends back into the untouched country over a bank at most `track.bank.slope` steep, between `track.bank.min` and `track.bank.max` metres wide. Along the line the profile is graded so that it NEVER CLIMBS: over every `track.gradeWindow` metres it falls at least `track.minGrade` (0.06) and at most `track.maxGrade` (0.78, the 38° of the steepest groomed piste), and no point of it is cut or filled more than `track.maxCut` metres. The steepest `track.colourWindow` (100 m) of it is the piste's COLOUR (`pisteColour`): BLUE to `track.grades.blue` (25 %), RED to `track.grades.red` (40 %), BLACK past that. The kickers of R9 are the only stretches allowed to climb or fall steeper, and the finish straight — the last `track.finish` metres, eased into over `track.runout` before it — is the one flat.

- **R9** KICKERS ON THE PISTE. The line carries `kickers.on.count` (2–6) crests that make jumps: a ramp `kickers.on.ramp` times the lip's height long rising to a lip, steepest at the lip, and a landing `kickers.on.landing` times the lip's height long falling away past it. The lip stands `kickers.on.height` metres over the line — the band's foot where the landing falls at `kickers.on.pitch.min` or less, its top at `kickers.on.pitch.max` or more — so a jump off a black pitch throws the `kickers.on.air` (40–80 m) a downhill course's do and a blue's throws much less. Each stands on a stretch that turns no more than `kickers.on.straight` radians from the foot of its ramp to the end of its landing, where the line comes down to the lip no steeper than `kickers.on.approachGrade` and falls away past it within `kickers.on.roll` of as steeply as it came — a roll before a pitch, the natural jump of a downhill course; two stand at least `kickers.on.spacing` metres apart along the piste.

- **R10** PACKED SNOW ON THE PISTE ONLY. `packedAt` is 1 across the piste's width and fades to 0 over `track.shoulder.packed` metres beyond each edge — except where R17 drifts it over; everywhere else the snow is the mountain's own: virgin powder, or the crust R21 lays.

- **R11** GATES EVERY 90–150 m. Gate 0 — the START GATE — stands `grid.back` metres and one station down the piste from the start line (R13); the last gate is the FINISH LINE, at the piste's end. Between them the gates follow in the direction of travel, evenly spaced as near `checkpoint.spacing.target` (120 m) as divides the run, and never outside `checkpoint.spacing` (90–150 m — a super-G's stand at least 25 m apart, a downhill's are course-set, and one every hundred-odd metres is seen from the last at speed); the red and the blue alternate (`Checkpoint.colour`, the start gate red). A gate spans the piste's width plus `checkpoint.margin` metres either side.

- **R12** THE START. The piste starts near the summit ridge — at a seeded x in `track.start.x` of the map's width, `track.start.z` of the way down it — at a heading chosen so that the first `spawn.run` metres after the start gate run straight, turning no more than `spawn.straight` radians, and fall no steeper than `spawn.maxSlope` (0.25, a blue's pitch out of the start hut); no kicker's lip stands within `spawn.kickerGap` metres of the start gate.

- **R13** THE START LINE. The skiers stand on the piste's first station (arc length 0), the start line, facing down the piste: `grid.slots` (4) of them abreast in one row, `grid.spacing` (3 m) apart across the centreline, the player's slot first in the list — the leftmost. The spawn is the row's point on the centreline; the start gate (R11) stands `grid.back` (6 m) and one station ahead of it.

- **R14** FORESTS AND GLADES. Trees stand where a slow noise says forest — at most one per `forest.spacing` metre cell, jittered — thinning to `forest.meadow` of that density in the open glades between, with `forest.clearings.count` round clearings cut out of the woods. A tree is `forest.height` (6–19 m) tall with a trunk of `forest.trunk` and a crown `forest.crown` of its height across, never wider than `forest.crownMax`. THE TREE LINE IS AN ALTITUDE: the region's (R21, `Mountain.treeLine`, metres above the sea — 1800–2200 m in the alpine, 600–1000 m on the fell, 3000–3500 m in the continental, about 1500 m in the maritime) over the base altitude the region deals the valley floor (`Mountain.altitude`): no tree stands above it, and over the `forest.krummholz` (150 m) under that line the woods are KRUMMHOLZ — stunted to `forest.krummholzHeight` of their height; the tall woods stand low down. The woods GROUP: now and then a CLUMP of `forest.clumps.trees` (4–8) trunks stands within `forest.clumps.radius` metres of its centre, as close as `forest.clumps.gap` to each other — at most one to a `forest.clumps.spacing` metre cell — and apart from a clump's own, no two trunks stand closer than `forest.gap` (9 m), so a skier can pass between any two trees or clumps. LANES wind through every wood — `forest.lanes.families` sets of lines `forest.lanes.spacing` metres apart, `forest.lanes.width` wide, with no trunk on them — and between them the woods keep `forest.open` of their density, so a skier sees into a wood as well as down its lanes. No tree stands within `forest.corridor` metres of the piste's edge, on ground steeper than `forest.maxSlope`, on a kicker or on a cliff.

- **R15** A WINTER DAY. The map lies at a seeded latitude in the region's band of `sun.latitude` (44–48°N for the alpine; 36–69°N across the regions, R21) on a seeded day of the year in `sun.dayOfYear` (January to March), and the run starts at a seeded solar hour in `sun.hour` (9–16 h) at which the sun stands at least `sun.minElevation` degrees over the horizon — except on the maps R19 deals an EVENING, which start instead `sun.evening` (−0.5 to +3.5 h) from that day's sunset: from the last of the sun into full night.

- **R16** ONE RUN. A race is `race.laps` (1) run of the piste, from the start gate to the finish line.

- **R17** DRIFTS ACROSS THE PISTE. The wind lays fresh snow over stretches of the groomed line — on a traverse, as the wind does. A map is dealt a share of its piste in `drift.share` (0–50 %) to lie drifted, laid as stretches `drift.length` (60–180 m) long, at least `drift.gap` metres apart; across a stretch the packed field — the piste's width and its shoulders — falls to `drift.packed` of its groomed value, easing in and out over `drift.fade` metres at either end. No drift lies within `drift.clear` metres of the start line or of the finish, nor within `drift.fade` metres of a kicker's ramp or landing (R9). The drifts are dealt off a stream of their own, so a map's drifts move nothing else it draws; `Level.drifts` publishes every stretch.

- **R18** THE WINDROWS. The groomer's tiller leaves the snow it pushed off the line in a low windrow along each edge, and that is what marks the piste out of the mountain round it. The ground stays level for `berm.width` metres past the flat shoulder (R8) — the bank back into the country starts behind the windrow, never under it — and on that bench a ridge stands `berm.height` (0.3–0.5 m) over the line, its crest halfway across, its faces a half-sine no steeper than `berm.maxSlope`. Its height wanders along the piste, never below `berm.height.min`, as a windrow does. No tree stands on a windrow (R14's corridor reaches past it). The windrows draw nothing from any stream.

- **R19** THE WEATHER. Every map is dealt one sky off a stream of its own — the attempt's sub-seed, salted — so its weather moves nothing else the map draws: `clear`, `fair` (fair-weather cumulus), `flurries` (a few flakes out of a sunny, barely clouded sky), `high` (a sheet of high cloud), `overcast` (a lid of stratus and its flat light), `snow` (a steady fall under a grey lid), `storm` (a blizzard under black cloud, the next gate gone) or `fog` (a valley fog lying over the lower mountain), at the odds in `weather.odds` — the bright skies most of the days. Each of the three snowing skies is dealt an intensity in its own band of `weather.snowfall` and a fog a density in `weather.fog`; the wind is dealt a mean speed in that sky's band of `weather.wind` — a heavier fall a harder wind — and a bearing it blows from. The same stream sends `weather.evening` of the maps out in the EVENING of R15. `Level.weather` publishes all of it.

- **R20** THE TERRAIN PARK. A map built for a TRICKS run — and only one: a map built for any other ride carries no park — has groomed kickers laid on its piste in the direction of travel, from `trick.lead` metres past the start gate to `trick.lead` metres short of the finish: as many as fit, up to `trick.count.max` and never fewer than `trick.count.min`. They come in three SIZES, laid in `trick.order` — low, medium, high and round again — each built to its row of `trick.sizes` and BUILT AGAINST THE HORIZONTAL, as a park is: a ramp rising from the altitude of its foot to a lip `height` above it, steepest at the lip; a level deck at the lip's altitude; a LANDING SLOPE falling from the deck to a floor `dig` metres under the piste, over `fall` metres, rounded over at its knuckle and out at its foot; and a run-out climbing back up to the line — so a lip on a falling line keeps its take-off and a deck stays a deck. Each is stamped along the line by arc length at full height across the piste, its flat shoulders and its windrows (R8, R18), so the windrows ride up, over and down with it, and fades into the mountain over `trick.edge` metres beyond. Each stands on a stretch that turns no more than `trick.straight` radians from its ramp's foot to its landing slope's foot and whose line falls no steeper than `trick.maxGrade` from the one to the other — a park is built on a moderate pitch — with `trick.gap` metres of piste between one kicker's run-out and the next one's ramp, as much between any of them and one of R9's, and OFF THE GATES (R11): `trick.gateClear.before` metres of piste from a gate to the next ramp's foot, falling at least `trick.runIn` times the lip's height between them so a skier stood at that gate reaches the lip, and `trick.gateClear.after` metres from a run-out's end to the next gate — no gate stands on a ramp, a deck, a landing slope, a dug floor or a run-out. The park draws nothing from any stream: the mountain, the piste, the start and the gates are the seed's own.

- **R21** THE REGION. Every map is built in one REGION — a kind of snow country, never a place — asked for by `GenerateOptions.region` and published as `Level.region`: the `alpine` (the rules as written), the `fell` (low, rounded, far north), the `continental` (high, cold and dry) or the `maritime` (deep, heavy snow off the sea). A region's row (`mapgen/regions.ts`) scales R2's vertical, flanks and crests and R3's hills, spurs, bowls, headwalls and rollers; R4's count of natural kickers; and R14's density, glade share and tallest trees. It deals the valley floor's ALTITUDE and the TREE LINE's from bands of its own (`altitude.base`, `altitude.treeLine`, metres above the sea — the research's tree lines, R14), so a fell's top stands bare and a maritime range is wooded nearly to the summit. It names what grows (twenty kinds of tree, conifer and bare broadleaf), off a hash of where each trunk stands, and deals R15's latitude and day from bands of its own. It may lay WIND CRUST — a packed share of `crust.packed` pressed into the powder over about `crust.cover` of the country and over every crest standing proud of the ground round it — which comes no nearer the piste's centreline than `CLEAR` metres, so R10 holds. No frozen water lies on a mountain: every row's `river` is null. The crust is dealt off a stream of its own, and the alpine's row is all ones and lays none, so a map built without a region is exactly the map its seed builds in the alpine.

- **R22** CLIFFS. The face carries `cliff.count` cliffs — scaled by the region's count of kickers (R21) — to be dropped off into the lower ground below: each stands on a slope at least `cliff.fall` steep and faces down the fall line. A shelf climbs out of the country over `cliff.shelf` metres behind the edge, level at the top; a face falls `cliff.drop` metres from the edge over `cliff.face` of a metre per metre of drop; and below it a landing apron, standing `cliff.apron` of the drop over the country at the face's foot, falls away over `cliff.landing` times its own height, steepest at the top. The edge runs `cliff.width` metres across at full height and sinks back into the country over `cliff.edge` metres at either end. Nothing stands on a cliff or within `cliff.runout` metres past its landing — no tree, no kicker — and no part of it comes within `cliff.clearance` metres of the piste's edge or onto the side ridges. The cliffs are dealt off a stream of their own; `Level.cliffs` publishes every one.
