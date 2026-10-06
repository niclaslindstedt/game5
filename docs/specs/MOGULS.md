# Moguls — draft spec

**Built in part** (R42 — the course, the pair, the score, the contest, the
bot, the HUD and the plate; what is unticked below is still open). Delete
this file when moguls is finished
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

## What was built, and what was decided

- **The course** (R42, `mapgen/moguls.ts`): 235 m at **25°** — the low end
  of the top series' band rather than 28°, for an engine whose straight
  skid drags only ~0.35 g. Moguls **only on their course**, not on the free
  ride's mountain. Moguls 3.5 m apart and **0.7 m** crest to trough
  *(est.)*; the air bumps 0.7 m high, the take-off **35° to the slope**
  (the rules do not say against what), a 20 m landing.
- **Moguls as terrain** (`mapgen/mogul-field.ts`): an analytic surface
  over the venue's profile as LINES — a dual course is the same profile
  with two lines on one rhythm (`mogulsField(p, frame, R, lines)`). The
  renderer lays it as a mesh (`mogul-view.ts`); the trail map's grooves
  and the snow shader are not laid on it yet.
- **Riding moguls**: the legs ABSORB the moguls (`game/mogul-ride.ts`) — full
  to 9.5 m/s, a third by 14 m/s *(est.)*; the bot turns on the moguls'
  rhythm at ~9 m/s and throws a 360 or a straight air off the top bump
  and a back flip off the bottom one.
- **The score** (`game/moguls-judge.ts`, `mogul-turns.ts`): the turns read
  as carving (a turn a mogul, the skid), absorption (the skis on the snow)
  and the upper body (the swing off the fall line, the line held); a stop
  and the speed checks deducted; the men's DD table and pace (10.30 m/s).
- **The format**: the single qualification, final 1 of 16, final 2 of 6
  (not the phased one); the jury's wind 50 km/h and a steady fall *(est.)*.

Still open: the trail map's grooves on the moguls, a turn-by-turn pose
for the legs (`make sag`, `make skier-metrics` on a mogul line), the
broadcast camera from below, the audience along the course, the sound of
the skis on the bumps, `make ride` scenarios on a mogul field, and the
women's DD and pace.

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

- [x] **The course (the next free R-rule)**: on a built map's steepest
      long stretch (28 ± 4°, 235 ± 35 m, no 20 m under 20° or over 37°),
      18–22 m wide, a mogul TRACK 10 ± 2 m wide down it, nine control
      gates, the moguls ~3.5 m apart and ~0.8–1.2 m high *(est.)* in a
      line a skier can turn, two air bumps at 15 % and 80 % of the course
      (5–6 m after the last mogul, 50–70 cm high, a 26–35° take-off, a
      15–18 m landing at 26°+), a level finish.
- [x] **Moguls as terrain**: built so the physics, the trail map and the
      renderer read the same bumps; the moguls cut by the skiers' line
      (presentation).
- [x] **Riding moguls**: the legs absorbing and extending at 2.5–3 turns a
      second; the turn on the mogul's shoulder; the line (the zipper line
      straight down the troughs).
- [x] **A mogul pair** (160–175 cm, 60–66 mm underfoot) and a MOGUL
      technique row (`defs/technique.ts`).
- [x] **The turns reader and judge**: carving, absorption and extension,
      upper body scored 0.1–20 by five judges in bands; the DEDUCTIONS (a
      stop 6.0, a fall 4.1–5.9, a touchdown 2.1–4.0, a stumble, a speed
      check or leaving the line 0.1–2.0; shooting or sliding 2.0 a gate
      section; leaving the line 1.6 a line); the high and the low of each
      dropped, the middle three summed.
- [x] **The air**: two air judges scoring each jump 0–10 (quality, air,
      fluidity) × its DD off the table (uprights, spins, corks, back and
      front flips, loops, the position and grab modifiers); the two jumps
      different; one manoeuvre at most half.
- [x] **The speed**: `48 − 32 × time ÷ pace`, at most 20, the pace off the
      course length.
- [x] **Mode and rules**: a `GameMode` row; an open start through a light
      beam; strict control gates; a ten-second stop a DID NOT FINISH.
- [x] **The format**: qualification, final 1 (sixteen), final 2 (six); the
      phased version; ties (turns, then air without DD, then time).
- [x] **The field**: rivals dealt turns, air and time about the bot's.
- [x] **The bot**: skis the zipper line at a pace it can hold, throws an
      air it can land off each bump.
- [x] **HUD**: the clock against the pace, the airs named, the three parts
      scored after the run, the board.
- [ ] **Cameras**: from below, looking up the course (the broadcast's), a
      follow from behind.
- [ ] **Audience**: along both sides and the finish.
- [ ] **Sound**: the skis on the bumps, the pole plants, the crowd.
- [ ] **Its maps**, **labs** (a mogul course in `make ride`, the legs'
      travel through it; `make sim ARGS="--mode moguls"`), **tests**,
      **docs**; delete this spec.
- [x] **The pair and the build preset** (`TRICK_MODES.md` § *Research, the
      pair and the build*): a MOGUL pair (160–175 cm, 60–66 mm underfoot, a
      soft forebody — *research the class's full numbers*), and the default
      build off mogul athletes (*research*: the legs absorb 2.5–3 turns a
      second; a light or medium build) — rows in `RACE_SKIS` and
      `RACE_RIDERS`, so picking the format opens the ski card on its pair
      and the dress card on its build.

## Research to-do

Research EXTENSIVELY before building (`TRICK_MODES.md` § *Research, the
pair and the build*): several sources for every number that shapes the
build, written into `docs/freestyle.md`.

- [x] **The rules and the conditions**, in full: the field of play and a
      championship venue's real size, the format, the judging and a fall,
      the snow it is prepared to, the speeds, the wind and light a jury
      holds for.
- [x] **The skis**: a MOGUL pair (160–175 cm, 60–66 mm underfoot, a soft
      forebody — *research the class's full numbers*).
- [x] **The default player weight**: mogul athletes (*research*: the legs
      absorb 2.5–3 turns a second; a light or medium build) — which of the
      four builds (`RIDERS`), argued from what the format pays weight for.

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
