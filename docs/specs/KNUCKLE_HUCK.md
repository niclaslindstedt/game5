# Knuckle huck — draft spec

**Draft. Researched, not built.** Delete this file when the knuckle huck is
finished (see `README.md`). The shared pieces are `TRICK_MODES.md`'s; the
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

- [ ] **Mode and rules**: a `GameMode` row; the big air jump's map with the
      run started on the deck; the jam's clock (twenty minutes in the
      sport — a game's jam is shorter, open question); a reset back to
      the deck after every hit.
- [ ] **Butters and presses**: the weight forward or back past a threshold
      lifts the other end of the pair; a press held along the snow; a
      BUTTER pivoting about the loaded end, wound up and released into a
      rotation off the knuckle (the body wound ~270° a couple of metres
      before the roll).
- [ ] **Off the knuckle**: the pop off a convex edge at a crawl, enough
      air for a flip, a double underflip, a front flip into a half twist;
      a ZERO SPIN (switch to switch, no turn) and a HAND DRAG (a hand on
      the snow while rotating) as tricks of their own; a roll or a slide
      along the knuckle.
- [ ] **The reader** names the butter and the press (nose, tail, with the
      degrees they wind into) and the knuckle-only tricks.
- [ ] **The jam judge**: the judge's session mode — the best few hits, the
      variety, the invention (tricks the dealt field has not thrown),
      style; one impression a rider, a RANK the board shows.
- [ ] **The field**: seven rivals dealt sessions (their hits shown as they
      come, their impressions dealt about the bot's), ranked at the
      buzzer.
- [ ] **The bot**: rides the deck, picks a butter or a press into a trick
      it can land off the knuckle's pop.
- [ ] **HUD**: the jam's clock, the trick named, the running rank.
- [ ] **Cameras**: from the side of the deck, the knuckle in the frame.
- [ ] **Sound**: the butter's scrape, the crowd at a landing.
- [ ] **Labs** (`make ride` butter and knuckle scenarios), **tests**,
      **docs**; delete this spec.

## Research to-do

- [x] What it is, the format, the criteria, the trick vocabulary.
- [ ] The knuckle's geometry (its radius, the deck's length, the speed it
      is hit at) — today an estimate.
- [ ] How many hits a rider gets in a jam and how the panel ranks — no
      rule found; a judging account would settle it.

## Open questions for the user

- The jam's length in a game (the sport's twenty minutes, or a few)?
- Butters only off the knuckle, or everywhere (the free ride too)?
