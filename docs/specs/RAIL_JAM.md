# Rail jam — spec

**Built in part.** The set (R40), the mode, its pair and build, the jam
(the knuckle huck's, now shared), a hit judged on its feature, the dealt
field, the bot, the HUD, the plate, the tricks card's box and the links
are built; the boxes below that are still open say what remains. Delete
this file when the rail jam is finished (see `README.md`). The shared pieces are `TRICK_MODES.md`'s; the
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

- [x] **The set (R40)** (`mapgen/rail-jam.ts` over `straight-venue.ts`):
      a 6 m platform, a 15° drop-in sized so a skier stood up meets the
      features at 22 km/h, a 7° deck of 34 m with FIVE FEATURES side by
      side 5 m apart 12 m down it — a 7 m down box, a 9 m flat-down rail,
      a 9 m kinked box, a 10 m down-flat-down rail and a 6 m rainbow rail
      — a 5° run-out and the finish line; cut down the face as big air's
      jump is. *Still open: the WALL RIDE (the jib module rides a line,
      not a wall), a street set (stairs, a handrail, barriers), and the
      run-out back to a lift rather than the jam standing him back on the
      platform.*
- [x] **Mode and rules**: `railJam` (`RAIL_JAM`, `railJamRules` in
      `defs/rail-jam.ts`); a three-minute jam; the reset to the platform
      after each hit (`jam.ts`'s `stepJam`, shared with the knuckle huck).
- [ ] **Jib tricks in full**: built — the degrees on (the strokes' turn
      out of the air, in quarters), the stances, presses held, swaps, the
      degrees off (`jib.ts`). *Still open: front and back swaps told
      apart, PRETZELS, BLIND read off which way he turned relative to the
      rail, switch on and off as a difficulty of its own, an ollie onto a
      feature from its side.*
- [x] **The jam judge** (the knuckle huck's, `jam.ts`): each hit marked on
      the feature ridden (`railHitImpression` over slopestyle's
      `jibImpression`), the session on its best three hits, the variety
      among them (the feature and the way it was ridden, `railKind`) and
      the falls. *Style is not read.*
- [x] **The format**: ONE JAM of eight (the open question's default; see
      below), a DOM-free module (`jam.ts`). *Heats of four and a final are
      open.*
- [x] **The field**: seven rivals dealt sessions on a stream of their own
      (`RAIL_JAM_FIELD`), their hits on the board as they come.
- [x] **The bot** (`sim/rail-jam-steer.ts`): a different feature every
      hit, left to right, checked to its speed, a press, a swap or a 180
      out on each, every hit ridden whole. *It spins onto nothing yet.*
- [x] **HUD**: the jam's clock, hits and running rank (the knuckle huck's
      chips), the last hit's trick named — on, stance, swap, press, off
      and the feature (`strings-railjam.ts`'s `jibName`) — and the plate
      with the board at the buzzer.
- [ ] **Cameras**: side-on to the rail; a follow from behind.
- [ ] **Sound**: the rail's ring, the box's slide, the hit of a landing.
- [ ] **Labs** (`make ride` jib scenarios — open), **tests**
      (`rail_jam_test.ts`, `rail_jam_hud_test.ts`), **docs**
      (`docs/freestyle.md`, `getting-started.md`); delete this spec.
- [x] **The pair and the build preset** — the Hare and the medium build (`TRICK_MODES.md` § *Research, the
      pair and the build*): the softest park twin-tip — the Hare, unless the
      research finds rail skiers on something else, and the default build
      off rail-jam athletes (*research*; the jib skiers of the park, likely
      the medium or light build) — rows in `RACE_SKIS` and `RACE_RIDERS`, so
      picking the format opens the ski card on its pair and the dress card
      on its build.

## Research to-do

Research EXTENSIVELY before building (`TRICK_MODES.md` § *Research, the
pair and the build*): several sources for every number that shapes the
build, written into `docs/freestyle.md`.

- [x] **The rules and the conditions**, in full (`docs/freestyle.md`;
      no wind or snow-preparation rule is published): the field of play and a
      championship venue's real size, the format, the judging and a fall,
      the snow it is prepared to, the speeds, the wind and light a jury
      holds for.
- [x] **The skis** (the Hare: jib skis are 164–180 cm, ~120/90–94/116 mm,
      15–20 m, soft, thick dull edges or none): the softest park twin-tip — the Hare, unless the
      research finds rail skiers on something else.
- [x] **The default player weight** (the medium build): rail-jam athletes (*research*; the jib
      skiers of the park, likely the medium or light build) — which of the
      four builds (`RIDERS`), argued from what the format pays weight for.

- [x] The formats, the judging, the feature sizes, the vocabulary.
- [x] A rail's height off the snow, a box's height — modular features
      0.5–1.0 m, a ride-on one met at the snow (the game's 0.3 m an
      estimate).
- [ ] How judges weigh a jib trick's parts (on, stance, swap, off) — a
      judges' manual for freeski rails.

## Open questions for the user

- A park rail set on the mountain, or a street set (stairs, handrails,
  a wall)? *Chosen for now: a park set on the mountain — what the jib
  module can ride today.*
- Heats and a final, or one jam? *Chosen for now: one jam of eight,
  three minutes, as the knuckle huck's.*
