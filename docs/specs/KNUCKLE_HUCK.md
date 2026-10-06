# Knuckle huck — draft spec

**Built in part.** The knuckle (R38), the mode, its pair and build, butters
and presses, the reader's press, the jam and its dealt field, the bot, the
HUD and the plate are in; what is still open is unticked below. Delete
this file when the knuckle huck is finished (see `README.md`). The shared pieces are `TRICK_MODES.md`'s; the
jump is `BIG_AIR.md`'s.

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*, and read
   `TRICK_MODES.md` first.
2. The research is `docs/freestyle.md` § *Knuckle huck*: a 20-minute jam,
   about eight riders, one overall impression for the session; butters,
   presses and flips off the KNUCKLE — the rounded edge where the big air
   jump's deck meets its landing — instead of the kicker.
3. Build it after big air: the jump, the reader and the judge are there.
   What is new is the JAM, BUTTERS and PRESSES, and a pop off a convex
   edge at low speed.

## Watch out

- **The knuckle is a crest, and the setters shave crests.** The downhill's
  `shaveCrests` exists so a racer does NOT leave the snow off one; here
  the knuckle is the feature. Keep the big air jump's knuckle sharp
  enough to pop off at 20–40 km/h *(est.)*.
- **A butter is on the snow.** A nose or tail butter pivots the skier on
  the tips or tails with the other end lifted: a ROTATION ON THE GROUND,
  which nothing in the engine does today (the strokes need a flight).
  It is new physics on the stations (`suspension.ts`) — the load on one
  end of the pair, the other end off the snow, the yaw free.
- **A jam is scored as a whole.** One impression for twenty minutes, not a
  score a hit: the judge reads the SESSION's best, its variety and its
  invention, and a fall costs little. The arcade combo's "lose it on a
  wipeout" is the wrong instinct here.

## What it is

The riders skip the kicker of a big air jump, ride across its deck and pop
off the knuckle into the landing — less height, so it is won on style:
butters into flips, presses into spins, zero spins, hand drags, rolls and
slides on the knuckle itself. A jam session of about twenty minutes, as
many hits as the clock allows, one result for the whole session.

## What the game already has to reuse

- The big air jump (`BIG_AIR.md`), its knuckle, its landing.
- The strokes and grabs, switch, the landing graded (`TRICK_MODES.md`).
- The jump key's pop (`TUNING.jump`) — the ollie off the knuckle.
- The arcade TRICKS run's buzzer (`TRICKS_RUN.limit`) — a jam's clock.

## What it needs to be complete

- [x] **Mode and rules**: `knuckleHuck` (`KNUCKLE_HUCK`,
      `knuckleHuckRules`); the knuckle built as R38 over the map (no
      kicker: a short drop-in onto a level deck); a three-minute jam
      (`KNUCKLE_HUCK.jam`); the skier stood back on the platform after
      every hit (`jam.ts`'s `stepJam`, `RunRules.jam`).
- [x] **Butters and presses** (`butter.ts`, `RunRules.butters`): the weight forward or back past a threshold
      lifts the other end of the pair; a press held along the snow; a
      BUTTER pivoting about the loaded end, wound up and released into a
      rotation off the knuckle (the body wound ~270° a couple of metres
      before the roll).
- [ ] **Off the knuckle**: the pop off a convex edge at a crawl, enough
      air for a flip (built: R38's knuckle pops a skier at 32 km/h into
      1.4 s of air, a butter squared into the air, a press held over the
      knuckle a flip; still open: a double underflip, a front flip into a half twist;
      a ZERO SPIN (switch to switch, no turn) and a HAND DRAG (a hand on
      the snow while rotating) as tricks of their own; a roll or a slide
      along the knuckle).
- [ ] **The reader** names the butter and the press (nose, tail, with the
      degrees they wind into) — built (`readTrick`'s `butter`,
      `trickName`) — and the knuckle-only tricks (open).
- [x] **The jam judge** (`jam.ts`): the session's impression off the best
      three hits, the variety among them and the falls, marked by the
      panel; the board ranks it. (Invention — tricks the field has not
      thrown — is not read yet.)
- [x] **The field** (`rivalHits`, `jamBoard`): seven rivals dealt sessions (their hits shown as they
      come, their impressions dealt about the bot's), ranked at the
      buzzer.
- [x] **The bot** (`speed-ski-steer.ts`'s `KNUCKLE_HIT`): rides the deck
      and hits a nose butter off the knuckle's pop, landed every time —
      one trick only so far.
- [x] **HUD** (`hud-knuckle.tsx`): the jam's clock, the trick named, the
      running rank, the session's mark; the plate and its board.
- [ ] **Cameras**: from the side of the deck, the knuckle in the frame.
- [ ] **Sound**: the butter's scrape, the crowd at a landing.
- [ ] **Labs** (`make ride` butter and knuckle scenarios — open),
      **tests** (`knuckle_huck_test.ts`, `knuckle_huck_hud_test.ts`),
      **docs** (`docs/freestyle.md`, `getting-started.md`); delete this spec.
- [x] **The pair and the build preset** — the Hare and the medium build (`TRICK_MODES.md` § *Research, the
      pair and the build*): the park twin-tip for butters and presses off a
      big jump's knuckle — the Hare (soft, presses easily) or the Raven (big
      air's, the jump's own) — *research which*, and the default build off
      knuckle-huck athletes (the big air field, ~72 kg for men — the medium
      build — unless the research says otherwise) — rows in `RACE_SKIS` and
      `RACE_RIDERS`, so picking the format opens the ski card on its pair
      and the dress card on its build.

## Research to-do

Research EXTENSIVELY before building (`TRICK_MODES.md` § *Research, the
pair and the build*): several sources for every number that shapes the
build, written into `docs/freestyle.md`.

- [x] **The rules and the conditions**, in full (`docs/freestyle.md`;
      no panel size, wind rule or snow preparation is published): the field of play and a
      championship venue's real size, the format, the judging and a fall,
      the snow it is prepared to, the speeds, the wind and light a jury
      holds for.
- [x] **The skis** (the soft park twin-tip, the Hare): the park twin-tip for butters and presses off a big
      jump's knuckle — the Hare (soft, presses easily) or the Raven (big
      air's, the jump's own) — *research which*.
- [x] **The default player weight** (the medium build): knuckle-huck athletes (the big air
      field, ~72 kg for men — the medium build — unless the research says
      otherwise) — which of the four builds (`RIDERS`), argued from what the
      format pays weight for.

- [x] What it is, the format, the criteria, the trick vocabulary.
- [ ] The knuckle's geometry (its radius, the deck's length, the speed it
      is hit at) — today an estimate.
- [ ] How many hits a rider gets in a jam and how the panel ranks — no
      rule found; a judging account would settle it.

## Open questions for the user

- The jam's length in a game: three minutes today (the sport's twenty is
  some sixty hits).
- Butters only on the knuckle huck today, or everywhere (the free ride
  too)?
