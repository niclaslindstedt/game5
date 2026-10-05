# Ski cross — draft spec

**Draft. Research first, then build.** Delete this file when the ski cross
is finished (see `README.md`).

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*.
2. This one is NOT built on the slalom's board: the field is SKIED, side by
   side. Start from the field the game had before the slalom — the start
   line four abreast and the rivals as whole runs (`engine/game/rivals.ts`,
   `fieldRules` in `defs/modes.ts`), skier against skier
   (`engine/game/collision.ts`) — and the terrain park's kickers
   (`engine/mapgen/trick-field.ts`) for the built features.
3. Research the to-do below into `docs/disciplines.md` before writing the next free R-rule — R33 after the downhill's R32; the ids run contiguous (`tests/docs_rules_test.ts`);
   the format (qualifying and the bracket) is a DOM-free module of its own.

## Watch out (from the slalom)

Read `README.md`'s *Lessons from the slalom* first; for a ski cross in
particular:

- **The field is skied, side by side** — the opposite of the slalom's board.
  Every rival is a bot run on the same course at once, so the bot's
  fragility (one run in thirty lost to a ±20 % knob) becomes a heat lost;
  sweep heats, not runs.
- **Determinism gets harder with contact.** The crowd's tests turned
  marginal because one shared random stream re-deals everything when the
  player's run changes; skier-against-skier contact will do the same to the
  field. Give the heats' draws streams of their own.
- **Built features are terrain.** The slalom's setter edits a COPY of the
  ground (levelling kickers, cutting the start drop, smoothing lips); berms,
  rollers and step-downs are the same tool used the other way — reuse it.
- **Landings and contacts in the air:** judge an airborne skier where his
  body is, not by a stale contact (`strict.ts`'s fix).

## What it is

The one discipline where racers are on the course TOGETHER: four (sometimes
six) skiers start side by side out of a gate and race head to head down a
built course of banked turns, rollers, jumps and step-downs; the first two
over the line go through. A qualifying round (timed runs, alone) seeds a
BRACKET of heats — quarter-finals, semi-finals, a small final and a final.
Contact happens and is judged.

This is the opposite of the slalom's one-racer-at-a-time board: the field
is SKIED, side by side, so the bot and skier-against-skier contact matter.

## What the game already has to reuse

- The old race's start line FOUR ABREAST and the field skied as whole runs
  (`rivals.ts`, `RACE` → `fieldRules` in `defs/modes.ts`), skier against
  skier contact (`collision.ts`), the standings (`raceProgress`,
  `racePlace`) — the ski cross is closest to the race the game had.
- The terrain park's kickers (R20, `trick-field.ts`) — rollers and jumps
  stamped on the piste, a starting point for built features.
- The bot (`sim/bot.ts`) racing a line, passing, the rivals' paces.
- The wipeout, the body's blows, the knock-down.

## What it needs to be complete

- [ ] **Course rule (the next free R-rule)**: a BUILT course on a piste: its width, length and
      vertical, its features in a rhythm (banked turns/berms, rollers in
      series, jumps, step-downs, a wu-tang/spine? — research the feature
      vocabulary), its start ramp and finish; mirrored in the docs.
- [ ] **Building the features**: berms (banked turns cut into the snow — the
      ground copy the slalom levels kickers in can raise and bank it), rollers
      and jumps (R20's kicker profile), shaped to be skied at race speed.
- [ ] **The start gate**: a four- or six-wide gate whose bars drop together
      on the start signal (not a wand per racer); the start sequence; a
      false start rule (research).
- [ ] **Format**: the qualifying (timed runs, the board), the bracket (heats
      of four, the first two through), the small final and the final, the
      final ranking — a format module DOM-free and tested.
- [ ] **Head-to-head physics**: drafting behind a rival (research whether it
      is significant), contact in berms and on landings, what is legal
      contact and what is a DSQ (research).
- [ ] **Mode and rules**: `GameMode` row; start "line" (side by side);
      gates (course gates/flags marking the course — research), contact on.
- [ ] **Technique row**: pumping rollers, absorbing jumps low, carving the
      berms, the start's pull on the gate and its skating.
- [ ] **Bot**: races the course with rivals, chooses lines in the berms,
      passes; distinct paces; finishes every seed; heats fair.
- [ ] **HUD**: the heat's positions, the bracket between heats, who goes
      through, the qualifying board.
- [ ] **Cameras**: a ski cross broadcast follows the pack — research.
- [ ] **Audience**: along a built course, at the jumps and the finish.
- [ ] **Sound**: the start gate's bars, contact, landings.
- [ ] **Campaign**, **front door**, **labs** (a course lab for the built
      features), **tests**, **docs** (`docs/disciplines.md` first); delete this spec.

## Research to-do

Write every finding into this discipline's section of
`docs/disciplines.md` (numbers with sources, estimates marked, no names),
then tick it here.

- [ ] The format restated generically: qualifying, heat sizes, how many go
      through, the bracket, the small final, tie-breaks, a fall in a heat.
- [ ] The course: length, vertical, width, the feature vocabulary and their
      dimensions (berm radius and bank, roller height and spacing, jump and
      step-down sizes), the start ramp.
- [ ] The start gate and the start procedure; false starts.
- [ ] The contact rules (what is legal, what is a DSQ).
- [ ] Speeds, run times, technique (pumping, absorption, berm carving), the
      skis used (research the class).
- [ ] Broadcast camera positions; where spectators stand.

## Open questions for the user

- A full bracket (qualifying + heats + finals) in one sitting, or a single
  heat as the playable unit?
- Contact: how physical — knock-downs and DSQs, or only bumps?
