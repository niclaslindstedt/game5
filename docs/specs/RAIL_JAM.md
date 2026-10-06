# Rail jam — draft spec

**Draft. Researched, not built.** Delete this file when the rail jam is
finished (see `README.md`). The shared pieces are `TRICK_MODES.md`'s; the
jibs are first built for `SLOPESTYLE.md`.

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*, and read
   `TRICK_MODES.md` first.
2. The research is `docs/freestyle.md` § *Rail jam*: a timed jam (two heats
   of four, ten minutes each, a final of four at the top street contest;
   30–60 minutes at a resort *(est.)*), one overall impression for the
   session, the feature sizes and the jib vocabulary.
3. Build it after slopestyle: the jib physics and the reader's jib words
   are there; the jam's judge is the knuckle huck's.

## Watch out

- **A jib trick is named on and off.** The degrees onto the rail (270, 450
  onto a sideways slide; 180, 360 onto a 50-50 or a press), the stance on
  it, a swap or a pretzel in the middle, the degrees off. The reader must
  see every one of those phases.
- **Blind matters.** A spin that loses sight of the rail (backside) is
  harder; the reader needs which way he turned relative to the rail.
- **A short drop-in, many hits.** A jam is volume; the reset back to the
  top must be instant, and a reset is not a penalty.
- **Urban features are city things.** A staircase, a handrail, a barrier,
  a wall: name them generically; a rail jam set in a ski area's base or a
  built street set is a look decision (open question).

## What it is

A jam session on a set of rails and boxes (or a street course: a staircase
with handrails, a wall ride, barriers): every rider rides as often as the
clock allows, and the judges score the whole session on one impression —
difficulty, execution, variety, style, invention. Three to five good
tricks beat one perfect one.

## What the game already has to reuse

- The jibs, once slopestyle builds them (`TRICK_MODES.md`).
- The knuckle huck's jam: the clock, the session judge, the dealt rivals.
- The strokes (spins on and off), switch, the landing graded.

## What it needs to be complete

- [ ] **The set (the next free R-rule)**: a short drop-in onto a gentle
      slope (a rail park's ~10–15°, *est.*), three to five features —
      a box (~40 cm wide, 6–9 m), a flat-down rail, a down-flat-down rail
      (~10 m), a kinked rail, a rainbow, a wall ride (2–4 m tall) — laid
      side by side so a rider picks one a hit, the landing and the run-out
      back to the lift or the drop-in.
- [ ] **Mode and rules**: a `GameMode` row; the jam's clock; the reset to
      the top after each hit.
- [ ] **Jib tricks in full**: on (90° offsets onto a slide, 180s onto a
      50-50), the stance, presses held, SWAPS (front and back) and
      PRETZELS, the degrees off; blind; switch on and off.
- [ ] **The jam judge** (the knuckle huck's): the session's best hits,
      variety across features and tricks, consistency, style.
- [ ] **The format**: heats of four, the best two to a final (the street
      contest's) — or one jam (open question); a DOM-free module.
- [ ] **The field**: rivals dealt sessions, shown hit by hit.
- [ ] **The bot**: picks a feature, mounts it with a trick it can hold,
      leaves it with a spin it can land.
- [ ] **HUD**: the clock, the trick named (on, stance, off), the running
      rank.
- [ ] **Cameras**: side-on to the rail; a follow from behind.
- [ ] **Sound**: the rail's ring, the box's slide, the hit of a landing.
- [ ] **Labs** (`make ride` jib scenarios), **tests**, **docs**; delete
      this spec.

## Research to-do

- [x] The formats, the judging, the feature sizes, the vocabulary.
- [ ] A rail's height off the snow, a box's height — sourced (now an
      estimate).
- [ ] How judges weigh a jib trick's parts (on, stance, swap, off) — a
      judges' manual for freeski rails.

## Open questions for the user

- A park rail set on the mountain, or a street set (stairs, handrails,
  a wall)?
- Heats and a final, or one jam?
