# Big air — draft spec

**Built in part.** The jump (R37), the mode, its pair and build, the
reader, the panel, the contest and its board are in; what is still open is
ticked off below. Delete this file when big air is finished (see
`README.md`). The shared pieces (the trick card, the reader, the judge,
the field, more rotation) are `TRICK_MODES.md`'s; big air is the first
format to build them.

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*, and read
   `TRICK_MODES.md` first.
2. The research is `docs/freestyle.md` § *Big air* and § *What every
   judged park format shares* — the jump's minimums and a championship
   jump's real size, the format (best two of three, DIFFERENT), the panel
   and the criteria. Nothing below restates a number it does not need.
3. The closest thing built is the TERRAIN PARK's high kicker (R20,
   `engine/mapgen/trick-field.ts`): a ramp, a level deck, a landing slope
   dug under the piste. A big air jump is that kicker grown to a
   championship's size and set alone, with a drop-in of its own.

## Watch out

- **A table must be level in absolute terms** (the ski cross's lesson): a
  jump shaped in the line's frame on a falling slope loses its height off
  the lip and lands its skier on the deck. R20 already builds against the
  horizontal — keep it.
- **Shape the landing for the air the game flies.** The ski cross's jumps
  were overshot until their shape was searched offline (a point mass over
  the profile, the impact against `harshSpeed`) for the speed the bot
  carries. Do it here: ~55–60 km/h off a 5 m kicker, ~2 s in the air, a
  30 m jump onto a 28°+ landing — at the real g (`airGravity: 1`).
- **The strokes cap the trick.** `spinMost` is a 720 and `flipMost` a
  double; the format's tricks are 1440–2160 and triple and quad corks.
  Raise the ceilings on this mode's rules only (a `RunRules` row), so no
  free ride and no digest moves.
- **"Different" is a rule, not a vibe.** The best two must differ by the
  direction rule chosen for the contest; the reader must give every trick
  a direction (clockwise or not; right, left, switch right, switch left)
  and a kind (spin, front flip, back flip, straight air) to judge it.

## What it is

One huge jump. Each skier drops in, takes the kicker, throws one trick and
lands it; the judges score it 0–100. A qualification of two jumps (the best
counting), a final of three, the best TWO counting — and those two must be
DIFFERENT tricks. Won on rotation, amplitude and a clean landing.

## What the game already has to reuse

- The terrain park's kicker and its built landing (`trick-field.ts`,
  `KickerShape`), the analyzer's hold on it (`engine/analysis/trick-field.ts`).
- The strokes, the grabs, the landing graded, switch (`TRICK_MODES.md`).
- The start house and the television start (`start-house*.ts`,
  `camera-start.ts`) — a drop-in platform with a start of its own.
- The replay's broadcast camera and a flight filed back-dated to its
  take-off (`replay-shots.ts`, `camera-replay.ts`).
- The audience, the finish arena (`finish-arena.ts`) — a big air's crowd is
  one arena round the landing.

## What it needs to be complete

- [x] **The jump (R37, `engine/mapgen/big-air.ts`, `trick-rules.ts`)**: a drop-in (a start platform, an
      in-run of 35–40° on a championship jump, 20°+ at the least), a flat
      before the kicker, the KICKER (5 m high on a championship jump, 2 m
      at the least, a take-off angle of ~25° up), a TABLE of 15–20 m with
      its KNUCKLE, a LANDING of 28° or more matched to the take-off, 20 m+
      wide, a level finish 25–30 m long. Set on a built map's steepest
      long fall line (or a scaffold of its own off the slope — open
      question), held by the analyzer; mirrored in
      `docs/level-generator.md`.
- [x] **The in-run speed** (the drop-in sized to the lip's speed, the
      engine's loss through the compressions measured in): a start height that brings the skier to the lip
      at the jump's design speed (the aerials' in-run markers are the
      idea: a start chosen off the speed), so the bot and the player
      land in the sweet spot on a straight run.
- [x] **Mode and rules** (`BIG_AIR`, `bigAirRules`): a `GameMode` row and its `RunRules` (one rider,
      no course gates, the real g, the strokes' ceilings raised, no clock
      but a start window).
- [x] **The reader and the judge** (`engine/game/judge.ts`; progression
      and variety across the counting jumps still open) (`TRICK_MODES.md`): the trick named,
      its direction and kind; scored 0–100 by a panel of six (the high and
      the low dropped), on difficulty, execution, amplitude, progression
      and variety across the two counting jumps.
- [x] **The format** (`engine/game/big-air-contest.ts`; the final's
      third jump in reverse order still open): qualification (two jumps, the best), final (three
      jumps, the best two DIFFERENT — the direction rule a `RunRules`
      choice; a repeat counts once; only two landed counts the better),
      the third jump in reverse order of the standings; a DOM-free format
      module with tests (`cross-bracket.ts` is the shape).
- [x] **The field** (dealt off the contest's seed — every rival, revealed
      as far as the player has jumped): eleven rivals dealt a board of three jumps each about
      the bot's par score, revealed jump by jump between the player's.
- [ ] **The bot**: drops in and takes the kicker straight (done); picks a trick it
      can turn in the air it has, in the direction the contest still
      needs, lands it.
- [ ] **HUD**: the jump and its phase on the HUD, the trick named and
      the panel's score on the plate, the board (done, `big-air-run.ts`,
      `hud-bigair.tsx`); the six marks shown one by one still open.
- [ ] **Cameras**: side-on to the table for the flight, from below the
      landing; the drop-in from behind.
- [ ] **Audience**: the arena round the landing and the finish.
- [ ] **Sound**: the crowd's roar at the landing, the announcer's silence.
- [ ] **Its maps** (today it stands on the six trick maps, picked on the
      trick map card off the TRICKS card) (`RACE_MAPS.md`'s pattern): nine seeds (or venues) with
      a good jump on them, digests held by a test.
- [ ] **Labs**: a jump lab (the profile, a point mass's flight over it at
      the speed band, the impact against `harshSpeed`), `make ride` a
      big-air scenario; `make sim ARGS="--mode bigAir"` (done);
      **tests** (`tests/big_air_test.ts`, `tests/big_air_hud_test.ts`);
      **docs**; delete this spec.

## Research to-do

Recorded in `docs/freestyle.md` (numbers with sources, estimates marked).

- [x] The jump's minimums and a championship jump's size and speeds.
- [x] The format and the "different" rule.
- [x] The panel, the method, the criteria, the deductions' scale.
- [ ] What tricks win today, by sex, with their rotations — sourced (now
      an estimate: 1980–2160 men, 1440–1800 women).
- [x] The pair (a competition twin-tip's band) and the default build
      (the field's measured mean) — `docs/freestyle.md` § *Big air*.
- [ ] The kicker's real take-off angle on a big jump (the rules' minimum
      is 25°; a championship kicker is likely steeper) and the knuckle's
      shape.
- [ ] Where the cameras stand at a big air broadcast.

## Open questions for the user

- The jump on the mountain (a seed's slope), or a built scaffold as at a
  city big air? *(Built on the mountain, cut into the face.)*
- How many jumps a final shows: every rival's in full, or the board only?
