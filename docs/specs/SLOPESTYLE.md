# Slopestyle — spec

**Built in part.** The course (R38), the jibs, the mode, its pair and build,
section judging, the format and the dealt field, the bot, the HUD, the
plate, the tricks card's box and the links are built; the boxes below that
are still open say what remains. Delete this file when slopestyle is
finished (see `README.md`). The shared pieces are `TRICK_MODES.md`'s; the
jumps are `BIG_AIR.md`'s; the rails and boxes (JIBS) are first built here.

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*, and read
   `TRICK_MODES.md` and `BIG_AIR.md` first.
2. The research is `docs/freestyle.md` § *Slopestyle* and § *What every
   judged park format shares*: the course (150 m+ of vertical, six judged
   sections of which three jumps, 30 m wide, two lines a section), the
   speeds, the format (the best run counting) and SECTION JUDGING (trick
   judges 60 %, composition judges 40 %, nothing after a fall).
3. The closest thing built is the TERRAIN PARK (R20) — kickers down the
   piste in a ladder of sizes. A slopestyle course is a park with rails,
   two lines a section, and judges.

## Watch out

- **Jibs are new physics.** Nothing in the engine slides on anything but
  snow; a rail is a line, not a surface. Build the jib module
  (`TRICK_MODES.md`) on the synthetic slope first (`tests/support/
  synthetic.ts`, `placeRun`), before any course is set.
- **Speed across sections.** 10–30 km/h through a rail section, 55–80 km/h
  into a jump: the course must hand a skier the right speed at each
  feature with no skating between. The ski cross's lesson holds: search
  the profile offline for the speed the bot actually carries.
- **Two lines a section.** A section is several features side by side; the
  bot picks one, the judge reads the choice (composition). The setter
  must leave room for both lines and their landings.
- **Gates are wrong here.** A slopestyle has no gates; a reset stands the
  skier at the last SECTION, not a checkpoint (`resetPose` reads gates
  taken).

## What it is

A run down a course of features in a row — rail and box sections, then big
jumps — each section offering two or more lines, one trick a feature. The
judges score the whole run: what was thrown on each section, and how the
run flowed as a whole. Qualification best of two runs, a final of two or
three, the single best run counting.

## What the game already has to reuse

- The terrain park (R20) and its built kickers; the big air jump's shape.
- The strokes, grabs, switch, the landing graded.
- The race field's interval start and the board dealt about par.
- The finish arena and the audience.

## What it needs to be complete

- [x] **The course (R38)**: built straight down a built map's face as big
      air's jump is (`mapgen/slopestyle.ts` over `straight-venue.ts`), not
      on the piste: a platform, three rail sections (a deck at 7°, a rail
      and a box side by side on two lines 12 m apart — down, flat-down and
      down-flat-down shapes) and three jumps sized up the ladder, 30 m
      wide, a finish of 28 m; each section's approach found so the
      design skier meets it at its speed. ~765 m of plan over ~220 m of
      vertical, mirrored in the docs. *Still open: ONE line in each jump
      section (a single kicker, not two side by side — the brief's "one
      line a section first" applied to the jumps), no wall ride or kinked
      rail beyond the down-flat-down, and no analyzer check of its own
      (the venue is graded and its line searched as big air's is).*
- [x] **Jibs** (`game/jib.ts`): rails and boxes — mounted by meeting the
      near end along it, ridden as a bead on a wire (friction, drag), a
      50-50 or a slide, swaps on an edge tap, a press on the lean, turned
      out square at the end, popped off by the jump, a stall slid off;
      filed as `JibRecord`s and read by the judges (the degrees on and
      off, the swaps, the press, the stance). *Still open: an ollie onto
      a jib from the side, a wall ride, the balance across a rail held by
      the player, pretzels and blind, and words naming a jib trick on the
      HUD.*
- [x] **Mode and rules**: `slopestyle` in `GAME_MODES`; one rider; the
      strokes' ceilings raised (a 1800 and a triple).
- [x] **Section judging** (`slopestyle-judge.ts`): two trick judges a
      section (three panels of two at the top level), three composition
      judges on flow, variety and level, 60/40, nothing after a fall, a set
      score a section completed. *The top level's method was chosen over
      one overall impression.*
- [x] **The format**: a qualification of two runs, the best counting; the
      best 12 of 30 to a final of three runs, the best counting. *Still
      open: the reverse running order is not shown, and a tie keeps list
      order rather than a tie rule.*
- [x] **The field**: 29 rivals dealt a whole run's score each (a fall
      oftener for the weaker), shown on the board between runs. *Not
      dealt section by section.*
- [x] **The bot**: the rail line of each rail section, checked to its
      speed, a 50-50, a swap and a nose press; tucked to each jump and a
      360, a 360 the other way and a 720 landed.
- [x] **HUD**: the run, the phase and the section he is in on a chip; the
      plate with each section's mark, the two panels, the score and the
      board. *Still open: the trick named on a jib as he rides it.*
- [ ] **Cameras**: a follow-cam down the course (the broadcast's), the
      jumps side-on.
- [ ] **Audience**: the jumps' landings and the finish.
- [ ] **Sound**: a rail's ring and scrape, a box's slide. *In part: the
      `jib` event plays the pole's clack pitched down on and off a jib;
      the slide along it is silent.*
- [ ] **Its maps**, **labs** (a course lab: the sections, the speed down
      the profile; `make sim ARGS="--mode slopestyle"`), **tests**,
      **docs**; delete this spec. *In part: it rides the six trick maps;
      `make sim ARGS="--mode slopestyle --skis raven"`, `tests/
      slopestyle_test.ts`, `slopestyle_hud_test.ts`, `jib_test.ts` and the
      docs are built; no course lab of its own.*
- [x] **The pair and the build preset** (`TRICK_MODES.md` § *Research, the
      pair and the build*): the park twin-tip that both jibs and jumps — the
      Raven (big air's) or the Hare (the park's), or a pair between
      (*research what slopestyle athletes ride*), and the default build off
      slopestyle's athletes (big air's freeskiers, ~72 kg for men, the
      medium build, are the same riders — confirm) — rows in `RACE_SKIS` and
      `RACE_RIDERS`, so picking the format opens the ski card on its pair
      and the dress card on its build. *Chosen: the RAVEN — the same stiff
      competition twin-tip the top riders ride on both the rails and the
      jumps (`docs/freestyle.md` § *Slopestyle*) — at the MEDIUM build,
      the riders being big air's (~70 kg on 176 cm).*

## Research to-do

Research EXTENSIVELY before building (`TRICK_MODES.md` § *Research, the
pair and the build*): several sources for every number that shapes the
build, written into `docs/freestyle.md`.

- [x] **The rules and the conditions**, in full: the field of play and a
      championship venue's real size, the format, the judging and a fall,
      the snow it is prepared to, the speeds, the wind and light a jury
      holds for.
- [x] **The skis**: the park twin-tip that both jibs and jumps — the Raven
      (big air's) or the Hare (the park's), or a pair between (*research
      what slopestyle athletes ride*).
- [x] **The default player weight**: slopestyle's athletes (big air's
      freeskiers, ~72 kg for men, the medium build, are the same riders —
      confirm) — which of the four builds (`RIDERS`), argued from what the
      format pays weight for.

- [x] The course minimums, the sections and lines, the speeds.
- [x] The format and section judging.
- [x] A top-level course's real sizes (the course length — now an estimate
      of 500–800 m — each jump's lip and table, the rails' lengths and
      heights on a championship course).
- [ ] How the composition judges score flow and line in practice.

## Open questions for the user

- Section judging (the top level's) or one overall impression? *Chosen:
  section judging.*
- Two lines a section from the start, or one line first? *Chosen: two
  lines in every rail section, one line in every jump section.*
