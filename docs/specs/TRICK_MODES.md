# The trick modes — draft spec (what every format shares)

**Draft. Research done, nothing built.** The one TRICKS mode today (two
minutes of arcade score on a terrain park) is to be replaced by the real
freestyle formats, each a mode of its own with a spec beside this one:

| Spec | Format | Kind |
| --- | --- | --- |
| [HALFPIPE.md](HALFPIPE.md) | Halfpipe | judged runs in a pipe, the best run counting |
| [SLOPESTYLE.md](SLOPESTYLE.md) | Slopestyle | judged runs down rails and jumps, the best run counting |
| [BIG_AIR.md](BIG_AIR.md) | Big air | judged jumps off one kicker, the best two different counting |
| [AERIALS.md](AERIALS.md) | Aerials | declared jumps, air + form + landing × degree of difficulty |
| [MOGULS.md](MOGULS.md) | Moguls | one run: turns + air + speed |
| [DUAL_MOGULS.md](DUAL_MOGULS.md) | Dual moguls | moguls head to head in a bracket |
| [RAIL_JAM.md](RAIL_JAM.md) | Rail jam | a timed jam on rails and boxes, one impression |
| [KNUCKLE_HUCK.md](KNUCKLE_HUCK.md) | Knuckle huck | a timed jam off a big jump's knuckle, one impression |

This file is what they all stand on: the pieces no one format owns, built
once. The research every number here comes from is `docs/freestyle.md`
(the judged park formats' shared section first). Delete this file when the
last format is built, as the race specs were (`README.md`).

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session* — the
   order is the same for a trick format: research (done here), engine
   first, then the app, measure and look, keep the spec current.
2. Read `README.md`'s *Lessons from …* for every race discipline before
   writing a line: most of them carry over word for word (build the
   measuring tool first, sweep never spot-check, keep the default row the
   identity, give every draw a stream of its own, a course built in the
   snow is a profile LEVEL IN ABSOLUTE TERMS — the ski cross's table).
3. Build the SHARED pieces below in the order they are listed, each with
   the first format that needs it (the build order at the foot), not all
   of them up front.
4. The course rules take the next free R-rules after R36, contiguous
   (`tests/docs_rules_test.ts`) — whatever a spec here guesses a number to
   be.

## What the game already has to reuse

Read the code, not this summary.

- **The strokes** (`engine/game/strokes.ts`): a tap on the lean a whole
  flip (back or front), a tap on the edge half a spin, thrown at a rate
  the body gathers and stopped square; paced to finish before the snow;
  refused without the air for it. Limits today: `spinMost` a 720,
  `flipMost` a double, `rateMost` 18 rad/s (`defs/tricks.ts`); the two
  axes are thrown APART — there is no off-axis rotation (no cork, rodeo,
  misty) and no twist inside a flip.
- **The grabs** (`strokes.ts`): the trick key held — a DAFFY (the edge), a
  SPREAD (the lean back), a GRAB (the lean forward or nothing); flying on
  as he was while he grabs.
- **The landing judged** (`tricks.ts`'s `landingGrade`): the impact
  against what the legs take — CLEAN and PERFECT bands; a wipeout, a reset
  or a landing still in a grab loses the combo.
- **The arcade score** (`tricks.ts`, `TUNING.tricks`): air by the second
  and the metre, revolutions on a ladder, the combo. Not a judge's score —
  a judged format replaces it with the judge below; whether a mode keeps
  it is an open question.
- **Riding switch** (`switch.ts`): backward down the hill, the steer read
  the way he goes, the tails held to his line, the twin-tip's tail turned
  up (`TAIL_RISE`).
- **The terrain park** (R20, `engine/mapgen/trick-field.ts`): kickers in
  three sizes BUILT past the lip (a deck, a landing slope dug under the
  piste, a run-out), stamped along the line against the horizontal — the
  first kicker a big air, a slopestyle or an aerials site is shaped from.
- **The real g in flight** (`TRICKS_RUN.airGravity: 1`), where the races
  fly at 1.5 — every format here keeps the real g, because every
  rotation and height in the research is quoted at it.
- **The HARE** (`defs/skis.ts`): the park twin-tip, centre-mounted — the
  pair for the pipe, slopestyle, big air, the rail jam and the knuckle.
- **The six trick maps** (`pwa/src/game/trick-maps.ts`, `menu-tricks.tsx`):
  seeds on their days, digests held by `tests/trick_maps_test.ts` — the
  shape every format's own maps take (`RACE_MAPS.md`'s pattern).
- **From the races**: the board dealt about par and the interval start
  (`field.ts`, `par.ts`), a qualification and a bracket (`cross-bracket.ts`,
  pure), a heat skied side by side with its own stream (`cross-heat.ts`),
  two runs and the reverse order (`slalom-heat.ts`), the race card
  (`menu-races.tsx`), the start house and the television start, the
  audience (`spectator-plan.ts` — `hasSpectators` already includes a
  tricks run), the replay and its broadcast camera (`replay-shots.ts`
  already files a flight back-dated to its take-off).

## Research, the pair and the build — what every format owes first

Every format starts with RESEARCH, and the research is EXTENSIVE: a spec's
numbers are a draft's guesses until they are sourced. Before a line of a
format is built, work its research to-do with web sources (several for
every number that shapes the build, never one), and write what they say
into `docs/freestyle.md`'s section for it, in our own words, numbers with
their sources, estimates marked *(est.)*, no names (`docs/disciplines.md`'s
rule). The research covers three things, and each spec lists them as boxes:

1. **The rules and the conditions.** The field of play and its minimums
   and a championship venue's real size; the format (phases, runs or jumps,
   what counts, the start order, ties); the judging (the panel, the method,
   the criteria, the deductions, a fall); and the CONDITIONS a contest is
   held in — the snow a venue is prepared to (groomed, salted, soft on a
   landing), the speeds on it, the wind and the light a jury holds or
   cancels for (a format with a jury's weather gets a `JURY`-style row, as
   the races have), the time of day it is run at. A rule the research
   cannot source is a question for the user, not a guess.
2. **The skis.** Which class of ski the format is skied on, from the
   class's MEASURED bands — the length, the waist, the tip and the tail,
   the sidecut, the flex, the mount, the rocker, what the athletes say
   they want of it — never a make or a model. Where a pair in the catalog
   (`defs/skis.ts`) is that class, the format is skied on it; where none
   is, the format ADDS ONE (`ski-tuning` for its numbers and `topSpeed`,
   `ski-design` for its traced look and topsheet, `blender-assets` for
   its model — `make models`), as the races added the Falcon, the
   Wolverine and the Peregrine and big air added the RAVEN.
3. **The default build.** What the format's athletes WEIGH — the
   anthropometry of its top level, by sex, from studies of national teams
   and of the athletes in it — and which of the four builds
   (`defs/riders.ts`'s `RIDERS`: light 60, medium 80, solid 95, heavy 115
   kg in kit) that is, argued from what the format pays weight for (a
   tuck's speed, a landing's load, a spin's inertia, the legs on a mogul
   line).

**The mode presets them.** Picking a format opens the ski card on ITS PAIR
and the dress card on ITS BUILD, as picking a race does: a row in
`defs/modes.ts`'s `RACE_SKIS` and `RACE_RIDERS` (read by `raceSkisOf` /
`raceRiderOf`, applied by `campaign-app.ts`), held by
`tests/race_skis_test.ts` and `tests/race_riders_test.ts` — every built
format has both rows, and the argument for each stands beside it in the
code with its source in `docs/freestyle.md`. Big air's: the Raven, the
medium build.

## The shared pieces it needs

- [ ] **THE TRICK CARD.** The front door's TRICKS tile opens a card of the
      formats, as the RACE tile opens the race card — one box a format,
      the built ones lit (`menu-races.tsx` is the pattern, a `FREESTYLE`
      list beside `DISCIPLINES` in `defs/modes.ts`), each opening its own
      level card of pinned maps (or venues), then the ski card. Each
      format a `GameMode` row and a `RunRules` bundle in `MODE_RULES`.
- [ ] **THE TRICK READER** (an engine module, pure, no words in it): every
      flight and every jib read back as the sport NAMES it — the spin in
      degrees about the up axis (180 steps), the flips, the axis (straight,
      CORK, RODEO, MISTY, FLATSPIN), the direction (left, right, switch
      left, switch right; a skier's natural way), the take-off and the
      landing switch or forward, an ALLEY-OOP in a pipe, the grab (which,
      and how long held), the height over the lip and the distance, the
      landing's grade; a jib as its stance (50-50, slide, press, lipslide),
      its degrees on and off, swaps, pretzels, blind. One record a trick,
      kept on the run (`GameState`), read by every judge, the HUD's line
      and the replay. The WORDS are `strings.ts`'s (`TRICK_WORDS` grows).
- [ ] **ROTATIONS THE FORMATS NEED.** The strokes must reach the research:
      spins to 1620 (pipe), 2160 (big air); flips to a triple with up to
      five or six twists in it (aerials); OFF-AXIS rotation (a cork —
      both axes thrown together about a tilted axis); a TWIST inside a
      flip (aerials' full, double full). Raise `spinMost` / `flipMost`
      per format (a `RunRules` row, so the free ride's arcade stays as it
      is) and check `rateMost` against the air: a 1620 in ~2 s is ~14
      rad/s, a 2160 in ~3 s ~13 rad/s, a five-twist triple in ~3 s some
      10 rad/s of twist. How the input asks for a cork is a design
      decision (open question).
- [ ] **MORE GRABS.** The vocabulary's MUTE, SAFETY, JAPAN, TAIL,
      CRITICAL, OCTO and BLUNT where today there are three poses — mapped
      onto the keys the grab already reads, drawn by the pose
      (`skier-pose.ts`), held for a time the reader measures.
- [ ] **THE JUDGE** (an engine module, pure, its draws off a stream of
      its own): a PANEL of N judges scoring 0–100 by OVERALL IMPRESSION
      off the reader's records — difficulty (a table over the trick
      vocabulary), amplitude (height and distance in control), execution
      (the landing's grade, the grab held, the rotation finished, a hand
      or the seat down), variety (directions, axes, grabs, no repeat),
      progression (a trick's rarity in the dealt field) — each judge his
      own dealt lean; the high and the low dropped at six or more, the
      rest averaged and CUT to two decimals. Beside it, two FORMAL scorers
      no impression enters: AERIALS (air 0–2, form 0–5, landing 0–3 a
      judge, × DD) and MOGULS (turns, air × DD, speed off the pace). A
      score is a RANK made a number — the judge scores a run against the
      dealt field's, so it holds its scale for the day.
- [ ] **THE FIELD.** One rider on the feature at a time in every format but
      the duals and the jams' shared feature: the rivals' scores DEALT as
      a board about a par (`field.ts`'s shape) — the par here a SCORE the
      bot earns, not a time; a phase's start order (random, then reverse
      standings), a qualification, finals with nothing carried over, ties.
      Dual moguls SKI the rival side by side (`cross-heat.ts`'s shape). A
      jam's rivals are dealt session impressions, their hits shown on the
      board as they come.
- [ ] **THE BOT FREESTYLES.** Every format needs the bot to ski it (the
      sim, the labs, par): to pick a trick it can land off the speed it
      carries (the strokes already refuse what the air cannot turn), to
      take a pipe's walls, a rail, a mogul line. `make sim ARGS="--mode
      <format>"` from the first day of each.
- [ ] **JIBS** (an engine module): RAILS and BOXES as features the skier
      slides on — a line segment (or a kinked polyline) with a height, a
      width and a surface (a round rail, a polyethylene box), mounted
      onto by a pop or an ollie, ridden 50-50, sideways or pressed, the
      balance across it a thing he holds, left by the end or a spin off;
      the stations' contacts on it (not the snow) so the trail map draws
      nothing there. Shared by slopestyle and the rail jam. Built
      procedurally in `mark-shapes.ts`'s look. *Built for slopestyle
      (`jib.ts`, `jibs-view.ts`): a rail or a box as a polyline ridden as
      a bead on a wire, mounted by meeting its end along it (no ollie
      onto it from the side yet), a 50-50 or a slide, swaps, presses,
      the turn-out, the pop; the balance across it is not yet held.*
- [ ] **THE COURSES.** Each format's terrain is a rule (the next free R)
      and a setter over a built map, as a race course is: the PIPE cut
      into the slope, the SLOPESTYLE course's sections, the BIG AIR jump
      (the knuckle huck rides the same), the AERIALS site, the MOGUL
      course, the RAIL set. Built in a copy of the ground as the race
      setters build (`course-prep.ts`), held by the analyzer, mirrored in
      `docs/level-generator.md`.
- [ ] **THE PAIRS.** The Hare for the park formats; a MOGUL pair (160–175
      cm, 60–66 mm underfoot) and an AERIALS pair are new catalog rows
      (`ski-tuning`), with the class's traced look and topsheet
      (`ski-design`) and the Blender model (`make models`).
- [ ] **THE HUD AND THE PLATE.** The trick named as it lands (the
      reader's words), the judges' scores coming up one by one after a
      run (the high and low struck out), the board, the phase, the run
      that counts; per format below.
- [ ] **THE AUDIENCE AND THE CAMERAS.** Every venue's crowd placed
      (`spectator-plan.ts`: along a pipe's decks, at a jump's landing and
      the finish, a moguls course's sides), and a broadcast camera per
      venue (side-on to a jump, down a pipe, from below a mogul course).
- [ ] **WHAT HAPPENS TO TODAY'S TRICKS MODE**: its arcade score, its
      two-minute buzzer and its six maps — retired, or kept as one box on
      the card (open question). The free ride's strokes and arcade score
      stay as they are either way (`RunRules.stunts`).

## Build order (the default)

From the least new machinery to the most, each format paying for the
shared piece it first needs:

1. **Big air** — one jump (the terrain park's kicker grown), the reader,
   the judge, the field dealt about a par, the trick card, more rotation
   and the cork.
2. **Knuckle huck** — the same jump; the jam format, butters and presses.
   *Built in part (R38).*
3. **Slopestyle** — the jumps in a row, JIBS, section judging.
   *Built in part (R39).*
4. **Rail jam** — jibs alone, the jam again.
   *Built in part (R40).*
5. **Halfpipe** — a new terrain (walls and vert), riding a wall, the
   alley-oop, pipe use.
   *Built in part (R41).*
6. **Moguls** — a new terrain (moguls), the turns scored, the formal
   scorer, the clock, a mogul pair.
   *Built in part (R42).*
7. **Dual moguls** — moguls side by side, the bracket.
8. **Aerials** — the declared flight plan, twisting flips, the formal
   scorer with DD, an aerials pair.

## Open questions for the user

- **Today's TRICKS run**: retire it and its six maps, or keep the arcade
  score attack as one box on the trick card ("park run")?
- **How real the numbers are**: rotations to a 2160 and five-twist
  triples as the sport throws them, or an arcade ceiling below that?
- **How a cork is asked for**: the lean and the edge thrown together (one
  stroke on both axes), or a modifier key?
- **The field**: dealt boards (one rider on the feature, as the slalom
  does), or rivals ridden by the bot and watched between your runs?
- **The build order above**, or another first format?
