# Aerials — draft spec

**Draft. Researched, not built.** Delete this file when aerials is finished
(see `README.md`). The shared pieces are `TRICK_MODES.md`'s; aerials is the
last to build, because it needs the most new flight.

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*, and read
   `TRICK_MODES.md` first.
2. The research is `docs/freestyle.md` § *Aerials*: the site (70–80 m of
   in-run at 20–25°, a level 20–25 m table, a 36–38° landing), the three
   kickers (single 2 m / 52–55°, double 3.5 m / 64–66°, triple 4.1 m /
   71°), the score (five judges, air 0–2, form 0–5, landing 0–3, the high
   and low of each dropped, × DD), the flight plan's code, the DD table
   read off official sheets, the format (one jump a phase, nothing carried
   over) and the physics (~62 km/h at the in-run's foot, ~14 m over the
   landing hill, ~2.6–3 s of air).
3. It is the one format that is NOT impression-judged: the score is a
   formula. Build the FORMAL scorer (`TRICK_MODES.md`'s judge) first and
   hold it to the published examples (5.7 + 12.3 + 8.0 = 26.0, × 5.100 =
   132.60).

## Watch out

- **A declared jump.** The skier announces his flight plan before the
  start; the wrong number of flips or twists is a DID NOT FINISH, the
  wrong position caps that flip's form. The input is a PLAN chosen on a
  card, then FLOWN — the strokes' tap-a-flip scheme must either fly the
  plan or be judged against it (open question).
- **Twists inside flips.** A bFdFF is a full twist in the first flip, a
  double in the second, a full in the third: the twist is turned DURING a
  flip, about the body's long axis, while the flip turns about its side.
  The strokes throw the two axes apart today; aerials needs them together,
  in a body position (layout, tuck, pike) the reader can see.
- **The flight is nearly vertical.** Off a 71° kicker at ~15 m/s the skier
  goes ~10 m up and lands at 65–70 km/h almost straight down onto a 37°
  slope — the landing load is enormous unless he lands on the slope's
  steepest part, 2–4 m past the knoll. `landingLoad` and the wipeout
  thresholds must be checked here; the landing hill's snow is soft (the
  sport chops it — *research*).
- **The in-run picks the speed.** A start height off markers 2 m apart:
  too slow and he lands on the knoll, too fast and he overshoots onto the
  flat. Head and tail wind move it (the jury's anemometers).

## What it is

Single jumps off steep kickers, the skier flipped (up to three times) and
twisted (up to five or six twists) on a declared plan, scored like
gymnastics: five judges score the AIR (the take-off, the height and
distance), the FORM (the body through every flip) and the LANDING; the
high and the low of each are dropped, the rest summed and multiplied by
the jump's DEGREE OF DIFFICULTY. One jump a phase on the top series — a
qualification, a final of twelve, a final of six — the last jump deciding.

## What the game already has to reuse

- The strokes (a flip a tap) and the landing graded (`landingGrade`).
- The terrain park's built kicker and landing slope (R20) — the kicker
  idea; the aerials site is its own (the table, the knoll, the hill).
- The real g in flight; the wind as a pure field (`windAt`, `airAt`) and
  the jury (`jury.ts`) — a jump's anemometer.
- The ragdoll and the body's blows (`crash.ts`, `body.ts`) for the bad
  landings, which are common.

## What it needs to be complete

- [ ] **The site (the next free R-rule)**: on a built map's slope (or a
      scaffold of the ski area's — open question): an in-run of 70–80 m at
      20–25° with start markers every 2 m, the KICKERS (single, double,
      triple — their lengths, lip heights and take-off angles) set on the
      in-run's foot, a level TABLE of 20–25 m, the KNOLL, a LANDING HILL of
      25–30 m at 36–38°, a level out-run; 22 m wide.
- [ ] **The flight plan**: a card to pick the jump (its code, its DD, its
      kicker); the plan carried on the run (a `CreateGameOptions` field).
- [ ] **Twisting flips**: a flip with twists turned inside it, in a
      position (layout, tuck, pike), the flips and twists counted the way
      the code counts them — the strokes extended or a flight of its own
      flown off the plan, the skier's input then the TIMING and the
      body's form (open question).
- [ ] **The formal scorer**: five judges' air (take-off 0–1, height and
      distance 0–1), form (per flip, the break bands shrinking with the
      flips, the positions' rules) and landing (the bands: a hand caps
      2.0, the body 1.5), the high and the low of each dropped, × DD, cut
      to two decimals; ties (without the DD, then form, landing, the lower
      DD). Tested against the published examples.
- [ ] **The DD table**: every jump the game offers with its DD (men's and
      women's), off the research's table; a jump outside it is a research
      to-do, not a guess.
- [ ] **Mode and rules**: a `GameMode` row; one jumper; the plan; a start
      clock (twenty seconds, a balk costing 0.5 a judge).
- [ ] **The format**: qualification, final 1 (twelve), final 2 (six), one
      jump each, nothing carried over; the championship's two
      qualifications and best-of-two final 1; the jumps that must differ;
      a DOM-free module.
- [ ] **The field**: rivals dealt jumps (a plan and a score about its DD)
      shown between the player's.
- [ ] **An aerials pair** (a new catalog row, *research the class*).
- [ ] **The bot**: picks a start height for the speed, flies the plan,
      lands it.
- [ ] **HUD**: the plan announced, the speed at the in-run's foot, the
      jump named as flown, the three parts' scores and the DD, the board.
- [ ] **Cameras**: side-on to the flight, a wide from the out-run, the
      broadcast's slow motion of the twists (`replay-shots.ts`).
- [ ] **Audience**: round the out-run (a stadium).
- [ ] **Sound**: the kicker's thump, the landing, the crowd.
- [ ] **Its venues**, **labs** (a flight lab: every jump of the table
      flown, its height, its air and its landing load against the legs),
      **tests**, **docs**; delete this spec.
- [ ] **The pair and the build preset** (`TRICK_MODES.md` § *Research, the
      pair and the build*): the aerials pair (a new catalog row: *research
      the class* — its length, its stiffness, the twin or flat tail an
      inverted landing wants), and the default build off aerials athletes —
      small, light gymnasts by reputation (*research*: likely the LIGHT
      build; the flips' inertia and the landing load decide) — rows in
      `RACE_SKIS` and `RACE_RIDERS`, so picking the format opens the ski
      card on its pair and the dress card on its build.

## Research to-do

Research EXTENSIVELY before building (`TRICK_MODES.md` § *Research, the
pair and the build*): several sources for every number that shapes the
build, written into `docs/freestyle.md`.

- [ ] **The rules and the conditions**, in full: the field of play and a
      championship venue's real size, the format, the judging and a fall,
      the snow it is prepared to, the speeds, the wind and light a jury
      holds for.
- [ ] **The skis**: the aerials pair (a new catalog row: *research the
      class* — its length, its stiffness, the twin or flat tail an inverted
      landing wants).
- [ ] **The default player weight**: aerials athletes — small, light
      gymnasts by reputation (*research*: likely the LIGHT build; the flips'
      inertia and the landing load decide) — which of the four builds
      (`RIDERS`), argued from what the format pays weight for.

- [x] The site, the kickers, the score and its method, the form and
      landing bands, the flight plan's code, the format, ties, the mixed
      team.
- [x] DD values read off official sheets (fifteen jumps).
- [ ] The DD chart itself (not public) or the formula behind it — the
      inference in `docs/freestyle.md` is ours.
- [ ] The singles and the uprights (a single's DD; the upright jumps).
- [ ] The aerials ski (its length and build) — the class's numbers.
- [ ] The landing hill's snow (chopped and loosened — unverified) and the
      landing load a skier takes.
- [ ] In-run speeds by kicker, sourced (the 58–66 km/h figure is a
      coach's, unverified).

## Open questions for the user

- A plan picked on a card and FLOWN with timing input, or the strokes'
  taps judged against a plan?
- How many jumps to offer (the doubles first, the triples later)?
- The mixed team event too, or the individual only?
