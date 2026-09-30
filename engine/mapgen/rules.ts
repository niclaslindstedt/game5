// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
// The world generator's RULE BOOK. Every constraint that keeps a generated
// map inside "a ski mountain in winter" — and every constraint that keeps
// the piste skiable from the summit to the base — lives here as data,
// separate from the search (generate.ts), the shaping (terrain.ts,
// track.ts, kickers.ts, forest.ts, spawn.ts), the compile (compile.ts) and
// the scoreboard (analysis/). The generator BUILDS to these numbers, the
// analysis HOLDS the finished map to the same numbers, and the tests assert
// directly against them; a number changed here changes all three at once,
// which is the point of stating it once.
//
// THE RESEARCH BEHIND THE NUMBERS. Every figure below that is not the
// game's own choice is a published one, from the brief the generator was
// written against — classes of course and kinds of country, never a place
// or a race by name. The path names the number in `LEVEL_RULES`:
//
//   world.size 3000 m            one face of a mid-size ski area, which
//                                spans 5–10 km across the fall line
//   mountain.vertical 850–1030 m a downhill course's vertical drop
//   track.length 3000–4500 m     a downhill course's length, 3–4.5 km
//   track.width 20–40 m          a downhill course is typically 30 m wide,
//                                a groomed resort run 20–60 m; the finish
//                                line at least 15 m
//   grade.bands 0.16/0.27/0.47   the piste colours as the northern signs
//                                state them: GREEN to 16 % (9°), BLUE to
//                                27 % (15°), RED to 47 % (25°), BLACK past
//                                that (the European: a blue's 25 %, a red's
//                                40 %; the North American: a blue's 40 %)
//   track.maxGrade 0.78          the steepest groomed piste, 78 % (38°) —
//                                past ~35° a winch cat, so nothing steeper
//                                is a piste
//   spawn.maxSlope 0.25          a blue's pitch out of the start hut
//   track.steepRadius 50 m       a downhill ski's sidecut is at least 45 m
//                                (a giant slalom's 30–35): the turn a ski
//                                carves at 100 km/h and more, which is the
//                                speed a black pitch hands a skier
//   kickers.on.air 40–80 m       a downhill course's jumps throw 40–80 m of
//                                air at 100–140 km/h; the lip's height is
//                                sized to its landing's pitch, so a black's
//                                throw that far and a blue's much less
//   checkpoint.spacing 90–150 m  a super-G's gates stand at least 25 m
//                                apart and a downhill's are course-set;
//                                one every ~120 m is a gate seen from the
//                                last at 120–150 km/h
//   grid 4 abreast, 3 m          a four-wide start behind the wand
//   forest.krummholz 150 m       the birch zone stands 150–200 m over the
//                                conifer line; the stunted band under a
//                                tree line is that deep
//   R21's tree lines             the alpine's 1800–2200 m (spruce to
//                                ~2100, larch and stone pine to ~2400), the
//                                fell's 600–1000 m (~650 at 68°N), the
//                                continental's 3000–3500 m, the maritime's
//                                ~1500 m — each over a base altitude of the
//                                region's own, so the line is an ALTITUDE
//   R21's verticals              a resort's 500–1500 m, the biggest ~2000+:
//                                the fell at about half the course's
//                                band, the continental a fifth over it
//
// The rules, in prose (each is realized by the generator, re-checked by
// `analyzeLevel`, and asserted across seeds in tests/mapgen_test.ts;
// docs/level-generator.md carries them verbatim):
//
//   R1  THE WORLD IS A SQUARE. A map is `world.size` (3000 m) on a side,
//       x and z from 0 to that size, with its heights baked once on a grid
//       of `world.cell` (2 m) cells. Nothing is published outside it, and
//       the piste, the start line and every gate stand on the mountain's
//       face (R2).
//   R2  A MOUNTAIN. The country is one mountain flank, falling toward +z:
//       the SUMMIT RIDGE runs along the top edge at `mountain.summit` of the
//       way down the map — the highest ground, with ridged crests
//       `mountain.crests` metres tall on it and its back falling away
//       behind it — and the VALLEY FLOOR lies along the bottom, from
//       `mountain.base` of the way down: nearly flat, the finish arena.
//       Between them the ground falls `mountain.vertical` (850–1030 m, a
//       downhill course's) — or on a graded map its grade's own (R23) — on
//       a smooth concave PROFILE: a shoulder under the ridge, the steepest
//       pitch below it, easing all the way to the run-out. SIDE RIDGES rise
//       left and right of the face — past `mountain.flank.inner` metres from
//       the map's middle, measured across x and warped by `mountain.flank.warp`
//       of noise, the ground climbs `mountain.flank.height` (120–220 m) by
//       `mountain.flank.outer`, opening out again toward the valley — so the
//       skiable face is a wide bowl-valley open at the bottom. `Level.mountain`
//       publishes the summit at the head of the fall line, the base at the
//       finish and the vertical between them.
//   R3  THE FACE. Over the profile lie hills of `face.hills.amplitude`
//       metres over wavelengths of `face.hills.scale`; SPURS AND GULLIES of
//       `face.ridges.amplitude` metres running down the fall line (a ridged
//       noise stretched `face.ridges.stretch` times along z); `face.bowls.count`
//       BOWLS above the tree line — round hollows `face.bowls.radius` metres
//       across and `face.bowls.depth` deep; `face.headwalls.count` HEADWALLS
//       — bands across the face where the profile drops `face.headwalls.drop`
//       metres more over a run of `face.headwalls.run`; and over all of it
//       ROLLERS: sharp-crested swells `face.rollers.amplitude` metres high
//       every `face.rollers.scale` metres or so, crests a skier at speed
//       leaves the snow over — on the face and, graded down but not out by
//       R8, under the piste.
//   R4  NATURAL KICKERS OFF THE PISTE. The face carries `kickers.off.count`
//       wind lips shaped to throw a skier: each stands on a roll — where the
//       ground steepens past it by at least `kickers.off.roll` — facing down
//       the fall line, rises `kickers.off.height` metres over a ramp of
//       `kickers.off.ramp` metres that is steepest at its lip, and falls away
//       over a landing of `kickers.off.landing` metres. None stands within
//       `kickers.off.clearance` metres of the piste's edge, so a natural
//       kicker is something a skier leaves the piste to find.
//   R5  THE PISTE IS ONE OPEN DESCENT. The run is skied down a single line
//       walked from the START (R12) near the summit ridge to the valley
//       floor, its heading wandering up to `track.swing` radians either side
//       of the fall line on a slow bend whose wavelength wanders in
//       `track.wander.scale` metres, with `track.sweeps.count` deliberate
//       SWEEPS — long traverses `track.sweeps.length` metres long held
//       `track.sweeps.angle` radians off the fall line — and
//       `track.schuss.count` SCHUSSES — straights `track.schuss.length`
//       metres long held down the fall line, where a downhill course's
//       jumps stand (R9) — and steered off any
//       heading the untouched ground does not fall along by at least
//       `track.minFall` over every `track.gradeWindow` metres, and off any it
//       falls along steeper than `track.steepest`. It ends where it reaches
//       the valley floor (`track.finishZ` of the way down the map) with a
//       FINISH STRAIGHT of `track.finish` metres, its length landing in
//       `track.length` (3–4.5 km, a downhill course's) — on a graded map its
//       grade's own band, a green's and a black's let run a little short of
//       it (R23) — sampled every
//       `track.step` (2 m). Its
//       first `track.hold` metres run straight. It never crosses itself, and
//       any two parts of it more than `track.separation.along` metres apart
//       along it stand at least `track.separation.plan` metres apart on the
//       map, so no two stretches share a corridor or a bank.
//   R6  NO BEND TIGHTER THAN A SKIER CAN CARRY SPEED THROUGH. The radius of
//       every bend, measured over `track.turnWindow` metres of the line, is
//       at least `bendFloor` of the grade the line falls at there: at
//       least `track.minRadius` (20 m) up to `track.bendKnee` (25 %, a
//       blue's pitch), and wider the steeper the pitch — rising to `track.steepRadius` (50 m, a downhill
//       ski's sidecut and more) where the line falls at `track.maxGrade`, so
//       no hairpin is laid on a headwall; and at least the piste's
//       half-width there with the flat shoulder and the windrow's bench
//       beyond it (R8, R18) — a wide piste bends wide, so its inside edge
//       never folds over itself.
//   R7  A WIDE PISTE. The piste is `track.width` (20–40 m, a downhill
//       course's thirty and a resort run's band) wide — on a graded map
//       inside its grade's own part of that band (R23) — the width
//       wandering smoothly along it over wavelengths of `track.widthScale`
//       metres, narrowing toward the band's least where the untouched face
//       falls across it steeper than `track.narrow`, and opening to the
//       band's widest over the finish straight — the finish arena. No cat
//       track is cut: the band's narrow end is the schuss through the trees.
//   R8  THE PISTE IS GRADED INTO THE MOUNTAIN. Across its width, and
//       `track.shoulder.flat` metres beyond each edge, the ground is levelled
//       with the centreline — keeping at most `track.camber` of cross-fall
//       where the line traverses a slope — and past that it blends back into
//       the untouched country over a bank at most `track.bank.slope` steep,
//       between `track.bank.min` and `track.bank.max` metres wide. Along the
//       line the profile is graded so that it NEVER CLIMBS: over every
//       `track.gradeWindow` metres it falls at least `track.minGrade` (0.06)
//       and at most its grade's own ceiling (R23) — never more than
//       `track.maxGrade` (0.78, the 38° of the steepest groomed piste) — and
//       no point of it is cut or filled more than `track.maxCut` metres.
//       The steepest `track.colourWindow` (100 m) of it — a terrain park's
//       kickers (R20) aside — is the piste's
//       COLOUR (`pisteGradeOf`): GREEN to `grade.bands.green` (16 %), BLUE
//       to `grade.bands.blue` (27 %), RED to `grade.bands.red` (47 %),
//       BLACK past that. The kickers of R9 and the drops of R24 are the only
//       stretches allowed to climb or fall steeper, and the
//       finish straight — the last `track.finish` metres, eased into over
//       `track.runout` before it — is the one flat.
//   R9  KICKERS ON THE PISTE. The line carries `kickers.on.count` (2–6)
//       crests that make jumps — on a graded map its grade's own count, from
//       none to two on a green to five to nine on a black, the lips a
//       multiple of their height (R23): a ramp `kickers.on.ramp` times the lip's
//       height long rising to a lip, steepest at the lip, and a landing
//       `kickers.on.landing` times the lip's height long falling away past
//       it. The lip stands `kickers.on.height` metres over the line — the
//       band's foot where the landing falls at `kickers.on.pitch.min` or
//       less, its top at `kickers.on.pitch.max` or more — so a jump off a
//       black pitch throws the `kickers.on.air` (40–80 m) a downhill
//       course's do and a blue's throws much less. Each stands on a
//       stretch that turns no
//       more than `kickers.on.straight` radians from the foot of its ramp to
//       the end of its landing, where the line comes down to the lip no
//       steeper than `kickers.on.approachGrade` (its grade's own, R23) and
//       falls away past it
//       within `kickers.on.roll` of as steeply as it came — a roll before a
//       pitch, the natural jump of a downhill course; two stand at least
//       `kickers.on.spacing` metres apart along the piste.
//   R10 PACKED SNOW ON THE PISTE ONLY. `packedAt` is 1 across the piste's
//       width and fades to 0 over `track.shoulder.packed` metres beyond each
//       edge — except where R17 drifts it over; everywhere else the snow is
//       the mountain's own: virgin powder, or the crust R21 lays.
//   R11 GATES EVERY 90–150 m. Gate 0 — the START GATE — stands `grid.back`
//       metres and one station down the piste from the start line (R13); the
//       last gate is the FINISH LINE, at the piste's end. Between them the
//       gates follow in the direction of travel, evenly spaced as near
//       `checkpoint.spacing.target` (120 m) as divides the run, and never
//       outside `checkpoint.spacing` (90–150 m — a super-G's stand at
//       least 25 m apart, a downhill's are course-set, and one every
//       hundred-odd metres is seen from the last at speed); the red and the
//       blue alternate (`Checkpoint.colour`, the start gate red). A gate
//       spans the piste's width plus `checkpoint.margin` metres either side.
//   R12 THE START. The piste starts near the summit ridge — at a seeded x in
//       `track.start.x` of the map's width, `track.start.z` of the way down
//       it — at a heading chosen so that the first `spawn.run` metres after
//       the start gate run straight, turning no more than `spawn.straight`
//       radians, and fall no steeper than `spawn.maxSlope` (0.25, a blue's
//       pitch out of the start hut) — on a graded map its grade's own, and
//       on a black at least its grade's floor on the whole, so the run
//       drops off the hut onto a pitch (R23); no kicker's lip and no drop
//       (R24) stands within `spawn.kickerGap` metres of the start gate.
//   R13 THE START LINE. The skiers stand on the piste's first station (arc
//       length 0), the start line, facing down the piste: `grid.slots` (4)
//       of them abreast in one row, `grid.spacing` (3 m) apart across the
//       centreline, the player's slot first in the list — the leftmost. The
//       spawn is the row's point on the centreline; the start gate (R11)
//       stands `grid.back` (6 m) and one station ahead of it.
//   R14 FORESTS AND GLADES. Trees stand where a slow noise says forest — at
//       most one per `forest.spacing` metre cell, jittered — thinning to
//       `forest.meadow` of that density in the open glades between, with
//       `forest.clearings.count` round clearings cut out of the woods. A
//       tree is `forest.height` (6–19 m) tall with a trunk of `forest.trunk`
//       and a crown `forest.crown` of its height across, never wider than
//       `forest.crownMax`. THE TREE LINE IS AN ALTITUDE: the region's
//       (R21, `Mountain.treeLine`, metres above the sea — 1800–2200 m in
//       the alpine, 600–1000 m on the fell, 3000–3500 m in the continental,
//       about 1500 m in the maritime) over the base altitude the region
//       deals the valley floor (`Mountain.altitude`): no tree stands above
//       it, and over the `forest.krummholz` (150 m) under that line the
//       woods are KRUMMHOLZ — stunted to `forest.krummholzHeight` of their
//       height; the tall woods stand low down. The woods GROUP: now and then
//       a CLUMP of `forest.clumps.trees` (4–8) trunks stands within
//       `forest.clumps.radius` metres of its centre, as close as
//       `forest.clumps.gap` to each other — at most one to a
//       `forest.clumps.spacing` metre cell — and apart from a clump's own,
//       no two trunks stand closer than `forest.gap` (9 m), so a skier can
//       pass between any two trees or clumps. LANES wind through every wood
//       — `forest.lanes.families` sets of lines `forest.lanes.spacing`
//       metres apart, `forest.lanes.width` wide, with no trunk on them —
//       and between them the woods keep `forest.open` of their density, so
//       a skier sees into a wood as well as down its lanes. No tree stands
//       within `forest.corridor` metres of the piste's edge, on ground
//       steeper than `forest.maxSlope`, on a kicker or on a cliff.
//   R15 A WINTER DAY. The map lies at a seeded latitude in the region's
//       band of `sun.latitude` (44–48°N for the alpine; 36–69°N across the
//       regions, R21) on a seeded day of the year in `sun.dayOfYear`
//       (January to March), and the run starts at a seeded solar hour in
//       `sun.hour` (9–16 h) at which the sun stands at least
//       `sun.minElevation` degrees over the horizon — except on the maps R19
//       deals an EVENING, which start instead `sun.evening` (−0.5 to +3.5 h)
//       from that day's sunset: from the last of the sun into full night.
//       THE FACE IS TURNED TO THE SUN: the mountain shades itself, and a
//       face turned from a low winter sun is skied in its own shadow, so a
//       graded map (R23) is dealt the compass bearing its fall line faces
//       (`Level.sun.facing`) within `sun.facing` of the sun's own bearing at
//       the hour the run starts — the evening's included — off a stream of
//       its own: the skier skis down toward the sun and across it, and the
//       piste he skis is lit. A map from before (`versions.ts`) faces due
//       north.
//   R16 ONE RUN. A race is `race.laps` (1) run of the piste, from the start
//       gate to the finish line.
//   R17 DRIFTS ACROSS THE PISTE. The wind lays fresh snow over stretches of
//       the groomed line — on a traverse, as the wind does. A map is dealt
//       a share of its piste in `drift.share` (0–50 %) — on a graded map its
//       grade's own, the groomer over nearly all of a green and half a
//       black left to the wind (R23) — to lie drifted, laid
//       as stretches `drift.length` (60–180 m) long, at least `drift.gap`
//       metres apart; across a stretch the packed field — the piste's width
//       and its shoulders — falls to `drift.packed` of its groomed value,
//       easing in and out over `drift.fade` metres at either end. No drift
//       lies within `drift.clear` metres of the start line or of the finish,
//       nor within `drift.fade` metres of a kicker's ramp or landing (R9) or
//       of a drop's shelf or landing (R24).
//       The drifts are dealt off a stream of their own, so a map's drifts
//       move nothing else it draws; `Level.drifts` publishes every stretch.
//   R18 THE WINDROWS. The groomer's tiller leaves the snow it pushed off the
//       line in a low windrow along each edge, and that is what marks the
//       piste out of the mountain round it. The ground stays level for
//       `berm.width` metres past the flat shoulder (R8) — the bank back into
//       the country starts behind the windrow, never under it — and on that
//       bench a ridge stands `berm.height` (0.3–0.5 m) over the line, its
//       crest halfway across, its faces a half-sine no steeper than
//       `berm.maxSlope`. Its height wanders along the piste, never below
//       `berm.height.min`, as a windrow does. No tree stands on a windrow
//       (R14's corridor reaches past it). The windrows draw nothing from any
//       stream.
//   R19 THE WEATHER. Every map is dealt one sky off a stream of its own —
//       the attempt's sub-seed, salted — so its weather moves nothing else
//       the map draws: `clear`, `fair` (fair-weather cumulus), `flurries`
//       (a few flakes out of a sunny, barely clouded sky), `high` (a sheet
//       of high cloud), `overcast` (a lid of stratus and its flat light),
//       `snow` (a steady fall under a grey lid), `storm` (a blizzard under
//       black cloud, the next gate gone) or `fog` (a valley fog lying over
//       the lower mountain), at the odds in `weather.odds` — the bright
//       skies most of the days. Each of the three snowing skies is dealt an
//       intensity in its own band of `weather.snowfall` and a fog a density
//       in `weather.fog`; the wind is dealt a mean speed in that sky's band
//       of `weather.wind` — a heavier fall a harder wind — and a bearing it
//       blows from. The same stream sends `weather.evening` of the maps out
//       in the EVENING of R15. `Level.weather` publishes all of it.
//   R20 THE TERRAIN PARK. A map built for a TRICKS run — and only one: a
//       map built for any other ride carries no park — has groomed kickers
//       laid on its piste in the direction of travel, from `trick.lead`
//       metres past the start gate to `trick.lead` metres short of the
//       finish: as many as fit, up to `trick.count.max` and never fewer than
//       `trick.count.min`. They come in three SIZES, laid in `trick.order`
//       — low, medium, high and round again — each built to its row of
//       `trick.sizes` and BUILT AGAINST THE HORIZONTAL, as a park is: a
//       ramp rising from the altitude of its foot to a lip `height` above
//       it, steepest at the lip; a level deck at the lip's altitude; a
//       LANDING SLOPE falling from the deck to a floor `dig` metres under
//       the piste, over `fall` metres, rounded over at its knuckle and out
//       at its foot; and a run-out climbing back up to the line — so a lip
//       on a falling line keeps its take-off and a deck stays a deck. Each
//       is stamped along the
//       line by arc length at full height across the piste, its flat
//       shoulders and its windrows (R8, R18), so the windrows ride up, over
//       and down with it, and fades into the mountain over `trick.edge`
//       metres beyond. Each stands on a stretch that turns no more than
//       `trick.straight` radians from its ramp's foot to its landing slope's
//       foot and whose line falls no steeper than `trick.maxGrade` from the
//       one to the other — a park is built on a moderate pitch — with
//       `trick.gap` metres of piste between one kicker's run-out and the
//       next one's ramp, as much between any of them and one of R9's, and
//       OFF THE GATES (R11): `trick.gateClear.before` metres of piste from
//       a gate to the next ramp's foot, falling at least `trick.runIn`
//       times the lip's height between them so a skier stood at that gate
//       reaches the lip, and `trick.gateClear.after` metres from a run-out's
//       end to the next gate — no gate stands on a ramp, a deck, a landing
//       slope, a dug floor or a run-out.
//       The park draws nothing from any stream: the mountain, the piste,
//       the start and the gates are the seed's own.
//   R21 THE REGION. Every map is built in one REGION — a kind of snow
//       country, never a place — asked for by `GenerateOptions.region` and
//       published as `Level.region`: the `alpine` (the rules as written),
//       the `fell` (low, rounded, far north), the `continental` (high, cold
//       and dry) or the `maritime` (deep, heavy snow off the sea). A
//       region's row (`mapgen/regions.ts`) scales R2's vertical, flanks and
//       crests and R3's hills, spurs, bowls, headwalls and rollers; R4's
//       count of natural kickers; and R14's density, glade share and
//       tallest trees. It deals the valley floor's ALTITUDE and the TREE
//       LINE's from bands of its own (`altitude.base`, `altitude.treeLine`,
//       metres above the sea — the research's tree lines, R14), so a fell's
//       top stands bare and a maritime range is wooded nearly to the
//       summit. It names what grows (twenty kinds of tree,
//       conifer and bare broadleaf), off a hash of where each trunk stands,
//       and deals R15's latitude and day from bands of its own. It may lay
//       WIND CRUST — a packed share of `crust.packed` pressed into the
//       powder over about `crust.cover` of the country and over every crest
//       standing proud of the ground round it — which comes no nearer the
//       piste's centreline than `CLEAR` metres, so R10 holds. No frozen
//       water lies on a mountain: every row's `river` is null. The crust is
//       dealt off a stream of its own, and the alpine's row is all ones and
//       lays none, so a map built without a region is exactly the map its
//       seed builds in the alpine.
//   R22 CLIFFS. The face carries `cliff.count` cliffs — scaled by the
//       region's count of kickers (R21) and its grade's multiple (R23) —
//       to be dropped off into the lower
//       ground below: each stands on a slope at least `cliff.fall` steep
//       and faces down the fall line. A shelf climbs out of the country
//       over `cliff.shelf` metres behind the edge, level at the top; a face
//       falls `cliff.drop` metres from the edge over `cliff.face` of a
//       metre per metre of drop; and below it a landing apron, standing
//       `cliff.apron` of the drop over the country at the face's foot,
//       falls away over `cliff.landing` times its own height, steepest at
//       the top. The edge runs `cliff.width` metres across at full height
//       and sinks back into the country over `cliff.edge` metres at either
//       end. Nothing stands on a cliff or within `cliff.runout` metres past
//       its landing — no tree, no kicker — and no part of it comes within
//       `cliff.clearance` metres of the piste's edge (its grade's own
//       clearance, R23) or onto the side ridges. A grade may stand some of
//       them BESIDE the piste — its row's `cliffs.beside` — each searched
//       for just past that clearance off a station of the line, facing the
//       fall line, so a skier sees its edge from the piste and leaves the
//       line to take it. The cliffs are dealt off a stream of their own;
//       `Level.cliffs` publishes every one, the drops of R24 among them.
//   R23 THE GRADE. Every map built by a graded generator (`versions.ts`)
//       is built to one PISTE GRADE — `green`, `blue`, `red` or `black`, the
//       colour on its signs — asked for by `GenerateOptions.grade` or, where
//       nobody asked, dealt off the seed on a stream of its own at the odds
//       in `grade.odds`, and published as `Level.grade`. A grade's row
//       (`mapgen/grades.ts`) sets the mountain's vertical (its own band,
//       with `grade.regionShare` of the region's multiple of R2's) and the
//       shape of its fall line; multiplies the face's hills, spurs, rollers
//       and headwalls (R3); sets the steepest ground the walk runs down
//       (R5), the steepest window the grading leaves (R8), the width band
//       (R7) and the length band (R5), the sweeps, how much steeper than the
//       untouched ground the walk reads a pitch for its bends (R6), the
//       pitch out of the start hut (R12), how many
//       kickers stand on the line and how tall and off how steep a pitch
//       (R9), how many stand off it (R4), how many drops cross it (R24),
//       how many cliffs stand on the face and how near the piste (R22), and
//       how much of it lies drifted (R17). The piste's steepest
//       `track.colourWindow` must then MEASURE its grade: over
//       `grade.bands` of the next gentler colour and no more than its own
//       (a green's at most 16 %, a black's past 47 %), so the colour a map
//       is signed with is the colour a skier finds. A map built by a
//       version from before the grades carries none, and its colour is only
//       measured (`gradeOf`).
//   R24 DROPS ACROSS THE PISTE. A black piste (R23) is crossed by
//       `drops` of its row — cliff bands the line is built over: a shelf
//       `drop.shelf` metres long rising `drop.drop` metres out of the line,
//       level with it at its top; an edge the whole width of the corridor;
//       and a face falling the whole of it back onto the line over
//       `cliff.face` of a metre per metre of drop. The LANDING is the line's
//       own pitch below — `drop.landing` metres of it kept clear — so a
//       skier who leaves the edge along the line falls the drop's height
//       onto a slope going his way at any speed, and no more: the band is
//       one a skier's legs take whole (`air.harshSpeed`). Each stands where
//       the line falls at least `drop.minFall` and turns no more than
//       `drop.straight` radians over its shelf, face and landing, keeps the
//       line falling over its shelf (R8), stands
//       `drop.spacing` metres of piste from another, `drop.kickerClear`
//       from a kicker's ramp or landing (R9), `spawn.kickerGap` from the
//       start gate and clear of the finish's run-out, and OFF THE GATES
//       (R11) — `drop.gateClear` metres of piste from any gate to the foot
//       of its shelf or the end of its landing, so no reset stands a skier
//       on a face. They are dealt off a stream of their own and published
//       among `Level.cliffs` (`onTrack`, `D1…` in the order they are
//       skied).

import type { SnowingKind, TrickSize, WeatherKind } from "./types.ts";

/** A closed band of numbers, inclusive. */
export type Band = { readonly min: number; readonly max: number };

export const LEVEL_RULES = {
  /** R1 — the square. */
  world: {
    /** Side of the map, m. */
    size: 3000,
    /** Heightfield cell, m. */
    cell: 2,
  },
  /** R2 — the mountain. */
  mountain: {
    /** Where the summit ridge's crest runs, as a share of the map's side
     * down from the top edge (z = 0). */
    summit: 0.08,
    /** Where the valley floor begins, as a share of the map's side. */
    base: 0.9,
    /** The height between the summit ridge and the valley floor, m. */
    vertical: { min: 850, max: 1030 } as Band,
    /** Ridged crests on the summit ridge, m at full height. */
    crests: 40,
    /** How far the ridge's crest line is spread down the face, m: the
     * crests fade out this far below the summit. */
    crestSpread: 140,
    /** The grade the ground falls at behind the ridge toward the map's top
     * edge, m per m — so the ridge is a crest and not a wall. */
    back: 0.35,
    /** THE PROFILE: the fall-line grade's shape from the summit (u = 0) to
     * the base (u = 1), normalised so its area is the dealt vertical.
     * `shoulder` is the share of the peak grade the ground falls at under
     * the ridge — a start on a shoulder, not on a headwall — steepening to
     * the peak over the first `shoulderRun` of the descent; the grade then
     * eases as (1 − u) to the `ease` power, never under `runout` of the
     * peak, so a skier still runs down to the valley floor. */
    profile: {
      shoulder: 0.22,
      shoulderRun: 0.25,
      ease: 1.2,
      runout: 0.14,
    },
    /** The side ridges. */
    flank: {
      /** Where the ground starts climbing, m across from the map's middle. */
      inner: 560,
      /** Where the flank reaches its full height, m across. */
      outer: 800,
      /** Height of a flank over the face beside it, m. */
      height: { min: 120, max: 220 } as Band,
      /** How far noise moves the foot of a flank in and out, m. */
      warp: 40,
      /** Share of the descent (u) past which the flanks open out into the
       * valley: full height above `open.min`, gone by `open.max`. */
      open: { min: 0.7, max: 1 } as Band,
    },
  },
  /** R3 — the face. */
  face: {
    hills: {
      /** Peak-to-trough of the broad rolls, m. */
      amplitude: { min: 12, max: 24 } as Band,
      /** Wavelength of the biggest rolls, m. */
      scale: 260,
      /** The share of the hills kept on the valley floor: the arena is
       * nearly flat. */
      floor: 0.35,
    },
    /** The spurs and gullies down the fall line. */
    ridges: {
      amplitude: { min: 8, max: 18 } as Band,
      /** Wavelength across the fall line, m. */
      scale: 200,
      /** How many times longer along z than across: a spur runs down. */
      stretch: 3.5,
    },
    /** The bowls, above the tree line. */
    bowls: {
      count: { min: 2, max: 4 } as Band,
      /** Radius, m. */
      radius: { min: 70, max: 140 } as Band,
      /** Depth at the middle, m. */
      depth: { min: 6, max: 14 } as Band,
      /** Where down the descent (u) a bowl may lie: the high face. */
      at: { min: 0.06, max: 0.42 } as Band,
    },
    /** The headwalls: bands where the profile drops more over a short run. */
    headwalls: {
      count: { min: 1, max: 3 } as Band,
      /** Extra drop over the band, m. */
      drop: { min: 20, max: 45 } as Band,
      /** The band's run down the face, m. */
      run: { min: 60, max: 110 } as Band,
      /** Where down the descent (u) a headwall may lie. */
      at: { min: 0.12, max: 0.6 } as Band,
      /** How far the band wanders up and down the face across x, m. */
      wander: 30,
    },
    /** The rollers: the swells a skier takes air over. A ridged noise, so
     * the crests are sharp — the kink the legs cannot follow — and the
     * troughs round. */
    rollers: {
      /** Crest over trough, m. */
      amplitude: 4,
      /** Wavelength, m. */
      scale: 70,
    },
  },
  /** R4, R9 — the kickers. */
  kickers: {
    off: {
      count: { min: 6, max: 12 } as Band,
      /** Lip over the surrounding ground, m. */
      height: { min: 1.8, max: 3.5 } as Band,
      /** Ramp length, foot to lip, m. */
      ramp: { min: 14, max: 22 } as Band,
      /** Landing length, lip to foot, m. */
      landing: { min: 26, max: 40 } as Band,
      /** Full-height width across the kicker, m. */
      width: { min: 14, max: 26 } as Band,
      /** Clear ground between the kicker's footprint and the piste's edge, m. */
      clearance: 30,
      /** The least the ground steepens past a lip for it to be a roll: the
       * fall over the landing less the fall over the ramp, m per m. */
      roll: 0.08,
      /** The steepest ground a wind lip is shaped on, m per m. */
      maxSlope: 0.7,
    },
    on: {
      count: { min: 2, max: 6 } as Band,
      /** Lip over the graded line, m: the band's foot on a gentle
       * landing, its top on a steep one (`pitch`). */
      height: { min: 1, max: 2.6 } as Band,
      /** The landing's fall, m per m, at which the lip is the band's foot
       * (a blue's pitch) and at which it is the band's top (a black's). */
      pitch: { min: 0.2, max: 0.5 } as Band,
      /** What a downhill course's jumps throw, m of air, off a black pitch
       * at 100–140 km/h: the band the lip's top is sized for — a
       * statement of intent the ride lab measures, not a check. */
      air: { min: 40, max: 80 } as Band,
      /** Ramp length as a multiple of the lip's height: 2/ratio is the
       * ramp's slope at the lip. */
      ramp: { min: 8, max: 11 } as Band,
      /** Landing length as a multiple of the lip's height: 2/ratio is how
       * steeply it falls away from the lip. */
      landing: { min: 14, max: 20 } as Band,
      /** Most the line may turn from ramp foot to landing foot, rad. */
      straight: 0.45,
      /** Least arc length between two lips, m: a landing's run-out and
       * the next one's run-up, with a bend between. */
      spacing: 220,
      /** The line may come down to the lip no steeper than this, m per m:
       * a jump off a red's pitch at most, never off a headwall — on a
       * graded map its grade's own (R23). */
      approachGrade: 0.4,
      /** How much gentler than the approach the landing may fall and the
       * stretch still count as a roll, m per m: the line past the lip
       * falls at least this close to as steeply as it came. */
      roll: 0.04,
    },
    /** Width over which a kicker's sides blend into the ground, m. */
    edge: 8,
  },
  /** R5–R8, R10 — the piste. */
  track: {
    /** The piste's length, m. */
    length: { min: 3000, max: 4500 } as Band,
    /** The band the walk AIMS at — inside the rule's, so a walk that lands
     * a little long or short of its aim still passes. */
    aim: { min: 3200, max: 4200 } as Band,
    /** Station spacing, m. */
    step: 2,
    /** Where the walk starts (R12): x as a share of the map's width, z as
     * a share of the way down it — below the ridge's shoulder. */
    start: { x: { min: 0.36, max: 0.64 } as Band, z: 0.14 },
    /** The first stretch of the walk, held straight, m (past R12's run). */
    hold: 60,
    /** The most the heading swings either side of the fall line, rad
     * (75°). */
    swing: 1.3,
    /** The slow bend: its wavelength along the piste, m — and how far
     * a noise wanders that wavelength, as a share. */
    wander: { scale: { min: 180, max: 340 } as Band, vary: 0.35 },
    /** The sweeps: long traverses held off the fall line. */
    sweeps: {
      count: { min: 1, max: 3 } as Band,
      /** How long a sweep is held, m. */
      length: { min: 150, max: 320 } as Band,
      /** How far off the fall line it is held, rad. */
      angle: { min: 0.8, max: 1.15 } as Band,
    },
    /** The schusses: straights held down the fall line — a downhill
     * course's, where its jumps stand. */
    schuss: {
      count: { min: 1, max: 2 } as Band,
      /** How long a schuss is held, m. */
      length: { min: 140, max: 240 } as Band,
    },
    /** The least the untouched ground must fall along the walk over every
     * `gradeWindow`, m per m — the walk steers toward the fall line below
     * it … */
    minFall: 0.04,
    /** … and away from the fall line above this, so the grading (R8) never
     * has to cut a headwall down. */
    steepest: 0.6,
    /** Where the walk ends: the valley floor, as a share of the way down. */
    finishZ: 0.9,
    /** The finish straight, m, laid flat. */
    finish: 80,
    /** The run-out into it, m: the grade eases to the flat over this. */
    runout: 60,
    /** How far before the valley floor the walk turns for the finish, m. */
    finishTurn: 120,
    separation: {
      /** Least map distance between two parts of the piste, m … */
      plan: 60,
      /** … that are more than this far apart ALONG it, m. */
      along: 200,
    },
    /** Least bend radius on a blue's pitch, m. */
    minRadius: 20,
    /** Least bend radius where the line falls at `maxGrade`, m: the floor
     * rises from `minRadius` at `bendKnee` to this (`bendFloor`). */
    steepRadius: 50,
    /** Baseline the radius is measured over, m. */
    turnWindow: 10,
    /** Piste width, m. */
    width: { min: 20, max: 40 } as Band,
    /** Wavelength of the width's wander, m. */
    widthScale: 300,
    /** The untouched face's cross-slope, m per m, over which the width
     * narrows toward the band's least: from `min` (the full wander) to
     * `max` (the least) — a wide traverse across a steep face is a
     * canyon cut, and a piste there is a schuss. */
    narrow: { min: 0.3, max: 0.7 } as Band,
    shoulder: {
      /** Level ground beyond each edge, m. */
      flat: 2,
      /** Packed-to-powder fade beyond each edge, m. */
      packed: 5,
    },
    bank: {
      /** Steepest the blend back into the country may be, m per m. */
      slope: 0.6,
      /** Narrowest and widest bank, m. */
      min: 8,
      max: 30,
    },
    /** The least the line falls over a `gradeWindow`, m per m, outside a
     * kicker and the finish. */
    minGrade: 0.06,
    /** The steepest the line may fall outside a kicker: the steepest
     * groomed piste, 78 % — 38°. */
    maxGrade: 0.78,
    /** R6 — the pitch up to which a bend may be as tight as `minRadius`,
     * m per m: 25 % (14°), the older European ceiling on a blue's pitch.
     * The COLOURS themselves are `grade.bands` (R23). */
    bendKnee: 0.25,
    /** The most cross-fall the corridor keeps on a traverse, m per m. */
    camber: 0.06,
    /** Baseline the grade is measured over, m. */
    gradeWindow: 10,
    /** The stretch a piste's COLOUR is read over, m — the steepest hundred
     * metres, as a piste is graded, not the steepest step. */
    colourWindow: 100,
    /** Most the line may sit above or below the untouched country, m. */
    maxCut: 14,
  },
  /** R11 — the gates. */
  checkpoint: {
    /** A super-G's stand at least 25 m apart; a downhill's are course-set. */
    spacing: { min: 90, max: 150, target: 120 },
    /** Extra width beyond each piste edge, m. */
    margin: 3,
  },
  /** R12 — the start. */
  spawn: {
    /** Least arc length between the start gate and a kicker's lip, m. */
    kickerGap: 100,
    /** The stretch after the start gate the run opens on, m, the most it
     * may turn over it, rad, and the steepest it may fall. */
    run: 40,
    straight: 0.2,
    maxSlope: 0.25,
  },
  /** R13 — the start line. */
  grid: { slots: 4, abreast: 4, spacing: 3, back: 6 },
  /** R14 — the forest. */
  forest: {
    /** Candidate cell, m: at most one tree per cell. */
    spacing: 6,
    /** Wavelength of the forest/glade noise, m. */
    scale: 240,
    /** Density inside the woods (share of cells with a tree). */
    density: 0.72,
    /** Share of that density out in the glades. */
    meadow: 0.03,
    clearings: {
      count: { min: 4, max: 9 } as Band,
      /** Radius, m. */
      radius: { min: 25, max: 70 } as Band,
    },
    /** Tree height, m. */
    height: { min: 6, max: 19 } as Band,
    /** Trunk collision radius as a share of height (plus a floor, m). */
    trunk: { share: 0.018, floor: 0.14 },
    /** Crown radius as a share of height, and the most it may spread, m. */
    crown: 0.24,
    crownMax: 3.2,
    /** The least distance between two trunks, m: with two crowns at their
     * widest that leaves a lane of 2.6 m under the boughs, room for a
     * skier. Two trunks of ONE clump are the exception. */
    gap: 9,
    /** The share of the woods' density kept between the lanes — thinner
     * than a wood left to itself, so the eye goes in among the trunks. */
    open: 0.95,
    /** CLUMPS: a few trunks grown close together — a thicket of spruce, a
     * stand of birch off one root. One chance a `spacing` metre cell (the
     * centre jittered inside it), taken with `woods` odds in the thick of
     * a wood and `meadow` odds out in the open (a tree island in a glade);
     * `trees` trunks within `radius` m of the centre, no two closer than
     * `gap` m. */
    clumps: {
      spacing: 36,
      woods: 0.7,
      meadow: 0.16,
      trees: { min: 4, max: 8 } as Band,
      radius: 6.5,
      gap: 2.6,
    },
    /** LANES: `families` sets of parallel lines at a seeded heading each,
     * `spacing` m apart, bent `swing` m either side of straight by a noise
     * of wavelength `scale` m, with no trunk within half their `width`
     * (m) — the old cuts through a wood a skier can follow and see down. */
    lanes: {
      families: 2,
      spacing: 150,
      width: 16,
      swing: 28,
      scale: 280,
    },
    /** Clear ground between the piste's edge and any trunk, m: past the
     * flat shoulder and the windrow (R18), with a metre to spare. */
    corridor: 9,
    /** Steepest ground a tree stands on. */
    maxSlope: 0.75,
    /** The band under the tree line (an altitude, R21's), m, where the
     * woods are stunted — the birch zone's depth over the conifer line … */
    krummholz: 150,
    /** … to this share of their height. */
    krummholzHeight: 0.35,
  },
  /** R15 — the sun. */
  sun: {
    latitude: { min: 44, max: 48 } as Band,
    /** Day of year (1 = Jan 1). */
    dayOfYear: { min: 1, max: 90 } as Band,
    /** Solar hour. */
    hour: { min: 9, max: 16 } as Band,
    /** Degrees over the horizon at the start. */
    minElevation: 5,
    /** An evening start (R19), hours from sunset: half an hour of low sun
     * before it, three and a half after — past nautical twilight into the
     * dark on every day and latitude of the band. */
    evening: { min: -0.5, max: 3.5 } as Band,
    /** The most the face's bearing is dealt off the sun's at the run's
     * hour, radians (55°): the skier skis toward the sun and across it,
     * never away from it. */
    facing: (55 * Math.PI) / 180,
  },
  /** R16 — the race. */
  race: { laps: 1 },
  /** R17 — the drifts. */
  drift: {
    /** Share of the piste dealt to lie drifted. */
    share: { min: 0, max: 0.5 } as Band,
    /** One stretch's length, its easing in and out not counted, m. */
    length: { min: 60, max: 180 } as Band,
    /** The least groomer between two stretches, m. */
    gap: 40,
    /** The packed share left under a drift, as a share of the groomed. */
    packed: 0.05,
    /** The ease in and out at either end of a stretch, m. */
    fade: 12,
    /** No drift this near the start line or the finish, m. */
    clear: 100,
  },
  /** R18 — the groomer's windrows along the edges. */
  berm: {
    /** Toe to toe across the ridge, m: the level bench past the flat
     * shoulder it stands on. */
    width: 6,
    /** Crest over the graded line, m — the band its wander stays in. */
    height: { min: 0.3, max: 0.5 } as Band,
    /** Wavelengths of the crest's wander along the piste, m. */
    wander: [23, 61] as const,
    /** Steepest a face may be: a half-sine `height.max` tall across the
     * width climbs at most π·0.5/6 = 0.26. */
    maxSlope: 0.3,
  },
  /** R19 — the weather. */
  weather: {
    /** How often each sky is dealt; the shares sum to 1. A sun in the sky —
     * clear, fair, flurries, high cloud — is nearly three days in four; a
     * lid, a fall or a fog the rest, a storm one in fourteen. */
    odds: {
      clear: 0.26,
      fair: 0.24,
      flurries: 0.1,
      high: 0.12,
      overcast: 0.06,
      snow: 0.08,
      storm: 0.07,
      fog: 0.07,
    } as Record<WeatherKind, number>,
    /** Each snowing sky's intensity: 0.05 is a few flakes glinting past the
     * lens, 1 a blizzard that takes all but the next few tens of metres
     * away. */
    snowfall: {
      flurries: { min: 0.05, max: 0.3 },
      snow: { min: 0.3, max: 0.75 },
      storm: { min: 0.75, max: 1 },
    } as Record<SnowingKind, Band>,
    /** A fog's density, 0..1 of the thickest the renderer draws. */
    fog: { min: 0.35, max: 1 } as Band,
    /** Each sky's mean wind at 10 m, m/s. A fog lies in a calm; a blizzard
     * is a gale. */
    wind: {
      clear: { min: 0.5, max: 5 },
      fair: { min: 2, max: 7 },
      flurries: { min: 1, max: 5 },
      high: { min: 3, max: 9 },
      overcast: { min: 2, max: 8 },
      snow: { min: 2, max: 16 },
      storm: { min: 11, max: 22 },
      fog: { min: 0, max: 2 },
    } as Record<WeatherKind, Band>,
    /** The share of maps skied in the evening (R15). */
    evening: 0.25,
  },
  /** R22 — the cliffs. */
  cliff: {
    count: { min: 3, max: 6 } as Band,
    /** The face's height, m: from a hop to a drop a skier thinks about. */
    drop: { min: 5, max: 10 } as Band,
    /** The face's run per metre of drop: 0.4 is a 68° wall. */
    face: 0.4,
    /** The landing below the face: an apron standing this share of the
     * drop over the country at the foot of the face, falling away over
     * `landing` times its own height — steepest at the top, R9's landing
     * — so a skier comes down onto a slope going his way, not onto the
     * flat. */
    apron: 0.5,
    landing: 6,
    /** The shelf behind the edge, climbing from the country to the lip, m. */
    shelf: { min: 70, max: 110 } as Band,
    /** The edge's full-height length across, m. */
    width: { min: 36, max: 70 } as Band,
    /** The blend back into the country at either end of the edge, m. */
    edge: 14,
    /** Clear ground past the foot of the landing — no tree, no kicker — m. */
    runout: 25,
    /** Least clear ground between any part of a cliff and the piste's
     * edge, m. */
    clearance: 25,
    /** The least grade of the country a cliff faces down. */
    fall: 0.05,
  },
  /** R23 — the piste grades; each grade's own row is `mapgen/grades.ts`. */
  grade: {
    /** THE COLOURS: the steepest `track.colourWindow` a GREEN piste falls
     * at (16 %, 9°), a BLUE (27 %, 15°) and a RED (47 %, 25°); a BLACK is
     * anything steeper, up to `track.maxGrade`. */
    bands: { green: 0.16, blue: 0.27, red: 0.47 },
    /** How often a seed nobody asked a grade of is dealt each (they sum to
     * one): a ski area's runs are mostly blue and red. */
    odds: { green: 0.2, blue: 0.3, red: 0.3, black: 0.2 },
    /** How much of the region's multiple of the vertical (R21) a graded
     * map keeps: a fell's green a little lower, each still its colour. */
    regionShare: 0.35,
  },
  /** R24 — the drops across a black piste. */
  drop: {
    /** The face's height, m: off an edge taken along the line, a skier
     * falls onto the pitch below at about √(2·g·drop) whatever his speed —
     * 6 m/s off the least, 7.5 off the most, under the 8 m/s the legs take
     * whole (`air.harshSpeed`). */
    drop: { min: 1.8, max: 3.2 } as Band,
    /** The shelf behind the edge, m: at least this, and long enough that
     * the line keeps falling over it (R8). */
    shelf: { min: 20, max: 50 } as Band,
    /** The landing: the line's own pitch past the face, kept clear, m. */
    landing: 18,
    /** The least the graded line falls under a drop, m per m: the pitch
     * that makes a band of rock into a drop rather than a step. */
    minFall: 0.22,
    /** Most the line turns from the shelf's foot to the landing's end, rad. */
    straight: 0.5,
    /** Least piste between two drops, m. */
    spacing: 150,
    /** Least piste between a drop and a kicker's ramp or landing, m. */
    kickerClear: 40,
    /** Least piste between a gate and a drop's either end, m (R11). */
    gateClear: 6,
    /** Clear piste after the landing's end before the finish's run-out, m. */
    finishClear: 120,
  },
  /** R20 — the terrain park. */
  trick: {
    count: { min: 6, max: 40 } as Band,
    /** The sizes, laid in this order and round again. */
    order: ["low", "medium", "high"] as readonly TrickSize[],
    /** Each size as it is built, m, against the horizontal: the lip's
     * `height` over the ramp's foot; the ramp as a multiple of it (2/ratio
     * is its slope at the lip — a take-off of 15°, 25° and 35° over the
     * horizontal, a park's small, medium and large); the level `deck` past
     * the lip; the landing slope's length `fall`, falling from the deck to
     * a floor `dig` under the piste; and the `runout` climbing back up from
     * it. The low one is a lip for a grab, the medium a flip's, the high
     * the flip with a spin in it — a second and a half or more in the air
     * taken at speed. */
    sizes: {
      low: { height: 1, ramp: 7.5, deck: 0, fall: 22, dig: 1, runout: 20 },
      medium: { height: 2, ramp: 4.3, deck: 8, fall: 22, dig: 3, runout: 24 },
      high: { height: 3.2, ramp: 2.9, deck: 4, fall: 24, dig: 6.5, runout: 30 },
    },
    /** How much further on than a smaller size the size whose turn it is
     * may first fit and still be laid, m. */
    wait: 80,
    /** Piste between one kicker's run-out and the next one's ramp, m: the
     * run-up he takes the next lip at. */
    gap: 20,
    /** Least piste between a gate (R11) and the next ramp's foot
     * (`before`) and between a run-out's end and the next gate (`after`),
     * m: a gate stands on none of a kicker, a reset at the last gate taken
     * stands a skier on the line and never in a landing's floor, and from
     * that gate he has a run-in to the lip. */
    gateClear: { before: 24, after: 8 },
    /** How far the line falls from the gate before a ramp to the ramp's
     * foot, as a multiple of the lip's height: what a skier stood at that
     * gate needs to carry over the lip, the climb and the snow's toll. */
    runIn: 1,
    /** Clear piste after the start gate before the first ramp, and before
     * the finish after the last run-out, m. */
    lead: 120,
    /** Most the line may turn from a ramp's foot to the foot of its landing
     * slope, rad — the stretch a skier goes straight up and flies straight
     * over. */
    straight: 0.2,
    /** The steepest the line may fall from a ramp's foot to its landing
     * slope's foot, m per m: a park is built on a moderate pitch, so a
     * lip stays a lip. */
    maxGrade: 0.22,
    /** Over how far past the windrow's far toe the park fades into the
     * mountain, m. */
    edge: 12,
  },
} as const;

/** R6 — the least bend radius where the line falls at `grade` (m per m),
 * m: `track.minRadius` up to `track.bendKnee`, rising smoothly to
 * `track.steepRadius` at `track.maxGrade` — the wider turn the speed of a
 * steep pitch needs. */
export function bendFloor(grade: number): number {
  const T = LEVEL_RULES.track;
  const t = Math.min(1, Math.max(0, (grade - T.bendKnee) / (T.maxGrade - T.bendKnee)));
  const ease = t * t * (3 - 2 * t);
  return T.minRadius + (T.steepRadius - T.minRadius) * ease;
}

/** Uniform draw inside a band. */
export function inBand(rng: { range(min: number, max: number): number }, band: Band): number {
  return rng.range(band.min, band.max);
}

/** Whether a value lies inside a band (inclusive, with a hair of slack for
 * floating-point arithmetic). */
export function withinBand(value: number, band: Band, slack = 1e-6): boolean {
  return value >= band.min - slack && value <= band.max + slack;
}
