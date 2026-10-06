# Moguls — draft spec

**Draft. Researched, not built.** Delete this file when moguls is finished
(see `README.md`). The shared pieces are `TRICK_MODES.md`'s; dual moguls
(`DUAL_MOGULS.md`) is built on this.

## Start here

1. Follow `README.md`'s *Starting a discipline in a new session*, and read
   `TRICK_MODES.md` first.
2. The research is `docs/freestyle.md` § *Moguls*: the course (235 m at
   28° on the top series, 18–22 m wide, a 10 m track between nine control
   gates, moguls ~3.5 m apart), the two AIR BUMPS (50–70 cm, a 26–35°
   take-off, at 15 % from the start and 20 % from the finish), the score
   out of 100 — TURNS 60, AIR 20 (judge × DD), SPEED 20 (`48 − 32 × time ÷
   pace`, the pace 10.30 m/s men and 9.00 m/s women) — the DD table, the
   format (finals in reverse order, nothing carried over).
3. Half of it is a RACE: a clock, control gates (the strict gates —
   `strict.ts` — both tips and both feet through), an open start with a
   light beam. The other half is new: a TERRAIN of moguls and the turns
   scored.

## Watch out

- **Moguls are terrain at a skier's scale.** A mogul ~1 m high every
  ~3.5 m is far finer than the heightfield's grid; like the pipe it may
  need a surface of its own. And a field of bumps is exactly what the
  setters have so far SMOOTHED AWAY (`slalom.comb`: a course on lips every
  5–7 m put the bot in the air a third of the way).
- **The legs are the event.** 2.5–3 turns a second, absorbing each mogul
  and extending into the trough, upper body still: the legs' spring
  (`suspension.ts`, `skier-spring.ts`) and the pose take more than any
  race asked of them. Measure with `make sag` and `make skier-metrics`.
- **A 28° pitch is steep for this engine.** The slalom's lesson: a skid
  with the skis straight drags only ~0.35 g, under gravity past ~37 %;
  speed on a moguls course is checked by the turns against the bumps.
- **Turns are judged, not timed.** The judge needs to see carving
  (50 %), absorption and extension (25 %) and the upper body (25 %): a
  reader of the turns — the edge, the skid, the legs' travel, the trunk's
  rotation — that no race has needed.

## What it is

One run down a steep course of moguls with two small jumps. The skier
turns down the mogul line as fast as he can, his legs absorbing every
bump, his upper body quiet, and throws a trick off each jump. Five judges
score the TURNS (60), two the AIR (20, times each trick's degree of
difficulty), and the clock the SPEED (20). A qualification, then finals in
reverse order with nothing carried over.

## What the game already has to reuse

- The strict gates and the DID NOT FINISH (`strict.ts`), the open start
  and its window, the clock, the interval start and the board dealt about
  par (`field.ts`).
- The legs' spring, the edge, the skid (`ski-physics`).
- The strokes (a flip, a spin) and the grabs for the two airs.
- The finish arena, the audience.

## What it needs to be complete

- [ ] **The course (the next free R-rule)**: on a built map's steepest
      long stretch (28 ± 4°, 235 ± 35 m, no 20 m under 20° or over 37°),
      18–22 m wide, a mogul TRACK 10 ± 2 m wide down it, nine control
      gates, the moguls ~3.5 m apart and ~0.8–1.2 m high *(est.)* in a
      line a skier can turn, two air bumps at 15 % and 80 % of the course
      (5–6 m after the last mogul, 50–70 cm high, a 26–35° take-off, a
      15–18 m landing at 26°+), a level finish.
- [ ] **Moguls as terrain**: built so the physics, the trail map and the
      renderer read the same bumps; the moguls cut by the skiers' line
      (presentation).
- [ ] **Riding moguls**: the legs absorbing and extending at 2.5–3 turns a
      second; the turn on the mogul's shoulder; the line (the zipper line
      straight down the troughs).
- [ ] **A mogul pair** (160–175 cm, 60–66 mm underfoot) and a MOGUL
      technique row (`defs/technique.ts`).
- [ ] **The turns reader and judge**: carving, absorption and extension,
      upper body scored 0.1–20 by five judges in bands; the DEDUCTIONS (a
      stop 6.0, a fall 4.1–5.9, a touchdown 2.1–4.0, a stumble, a speed
      check or leaving the line 0.1–2.0; shooting or sliding 2.0 a gate
      section; leaving the line 1.6 a line); the high and the low of each
      dropped, the middle three summed.
- [ ] **The air**: two air judges scoring each jump 0–10 (quality, air,
      fluidity) × its DD off the table (uprights, spins, corks, back and
      front flips, loops, the position and grab modifiers); the two jumps
      different; one manoeuvre at most half.
- [ ] **The speed**: `48 − 32 × time ÷ pace`, at most 20, the pace off the
      course length.
- [ ] **Mode and rules**: a `GameMode` row; an open start through a light
      beam; strict control gates; a ten-second stop a DID NOT FINISH.
- [ ] **The format**: qualification, final 1 (sixteen), final 2 (six); the
      phased version; ties (turns, then air without DD, then time).
- [ ] **The field**: rivals dealt turns, air and time about the bot's.
- [ ] **The bot**: skis the zipper line at a pace it can hold, throws an
      air it can land off each bump.
- [ ] **HUD**: the clock against the pace, the airs named, the three parts
      scored after the run, the board.
- [ ] **Cameras**: from below, looking up the course (the broadcast's), a
      follow from behind.
- [ ] **Audience**: along both sides and the finish.
- [ ] **Sound**: the skis on the bumps, the pole plants, the crowd.
- [ ] **Its maps**, **labs** (a mogul course in `make ride`, the legs'
      travel through it; `make sim ARGS="--mode moguls"`), **tests**,
      **docs**; delete this spec.

## Research to-do

- [x] The course, the air bumps, the start, the score and every part of
      it, the DD table, the format, the typical numbers.
- [ ] Mogul height and spacing from a source (now an estimate and a
      reference-literature figure).
- [ ] The top air bump's place (15 % in the rules, 10 % on the course
      sheet).
- [ ] Biomechanics: the turn rate, the legs' range and timing, the loads —
      peer-reviewed numbers (the one review found speaks only of ranges).

## Open questions for the user

- The real 28° and 2.5–3 turns a second, or a gentler arcade course?
- Moguls only on their course, or also on the free ride's mountain (an
  ungroomed black's bumps)?
