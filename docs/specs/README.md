# Working specs

One file per feature being built: what it is, what is decided, what is
built, what is left and what still has to be RESEARCHED before it can be
built honestly. A session picks a feature up by reading its spec first, and
keeps it current as the work moves.

**Every spec here is temporary.** The closing commit of a feature deletes
its spec, once everything in it has landed in the code, the tests and the
standing docs (`docs/*.md`, `AGENTS.md`). A spec that outlives its feature is
a second, stale copy of the truth.

| Spec | Discipline | State |
| --- | --- | --- |
| [SLALOM.md](SLALOM.md) | Slalom | building |
| [GIANT_SLALOM.md](GIANT_SLALOM.md) | Giant slalom | draft — research first |
| [SUPER_G.md](SUPER_G.md) | Super-G | draft — research first |
| [DOWNHILL.md](DOWNHILL.md) | Downhill | draft — research first |
| [SKI_CROSS.md](SKI_CROSS.md) | Ski cross | draft — research first |
| [SPEED_SKIING.md](SPEED_SKIING.md) | Speed skiing | draft — research first |

The drafts are written from what the game already has (the slalom's
machinery: R31's course setter, strict gates, the interval start and its
board, flex poles, the start house, the television start, the per-run
technique) and from general knowledge of each sport. Anything that needs a
number, a rule or a measurement is a **research to-do**, not a guess: answer
it from sources (biomechanics studies, the sport's published competition
rules restated in our own words, coaching material), record it with its
source in `docs/disciplines.md` (the standing page that outlives every
spec), and only then build. Never copy a rulebook's text, and never name a
real race, venue, product or person — the repo is public and the rule is in
`AGENTS.md`.

## Starting a discipline in a new session

A session handed "implement <discipline>" and its spec, with none of the
history behind it, works in this order:

1. **Read**: `AGENTS.md` (the router: the rules of the repo, the labs table,
   where code goes), the discipline's spec, `docs/disciplines.md` (the
   research so far, and the SLALOM section as the worked example of what a
   finished discipline's research looks like), and
   `engine/mapgen/discipline-rules.ts` (R31, the slalom's course rule — the
   shape the next rule follows).
2. **Load the skills** the work touches: `start-work` and `write-code`
   always; `engine-system` (a new mode), `mapgen-improvement` (the course
   rule and its setter), `ski-physics` / `ski-tuning` (the technique row,
   the skis), `bot-improvement` and `simulate-run` (the bot, `make sim`),
   `collision` (gates), `hud-and-menus` / `menu-system` (the HUD, the front
   door), `crowd` (the audience), `campaign` (rungs), `lab-tooling` (a lab),
   `commit` and `changelog` at the end. Read each one's lessons first
   (`npx ogf-skill-lessons <skill>`).
3. **Research first.** Work the spec's research to-do with web sources;
   write the findings into `docs/disciplines.md`'s section for the
   discipline (numbers with sources, estimates marked *(est.)*, no names),
   tick the to-dos, and put the open questions to the user before building
   anything they decide.
4. **Engine first**, then the app (`engine-system`'s order): the course
   rule (R3x) and its mirror in `docs/level-generator.md`
   (`tests/docs_rules_test.ts`), the setter (factor what the slalom's
   `engine/mapgen/slalom.ts` shares instead of copying it), the mode's row
   in `defs/modes.ts` (`GameMode`, `MODE_RULES`, `DISCIPLINES`), the
   technique row, the gate rules (`strict.ts`), the board and par
   (`field.ts`, `par.ts`), the bot; tests in `tests/<topic>_test.ts`. Then
   the app: the gates drawn, the start, the cameras, the HUD board, the
   front door, the audience, the sounds, the campaign rungs.
5. **Measure and look**: the labs the spec names and the router's labs
   table owes — `make sim` before and after (the bot finishes every seed),
   `make ride`, `make level` / `make analyze` for the course, the technique
   lab for the riding, `make build` and `make screenshots` for the picture.
   Look at every picture.
6. **Keep the spec current** as the work moves (tick boxes, move lines from
   to-do to built), and **delete it** in the closing commit once the code,
   the tests, `docs/disciplines.md` and the standing docs carry everything
   in it.
7. **Ship** with the `commit` skill: a changeset fragment, conventional
   commits, a PR with the labs' before/after.

What the slalom built that every discipline reuses (read the code, not a
summary): the course setter (`engine/mapgen/slalom.ts`), strict gates and
DSQ/DNF (`engine/game/strict.ts`, `Progress.out`), the interval start and
the board dealt about par (`engine/game/field.ts`, `par.ts`), flex poles
(`gate-poles.ts`, `pwa/src/game/slalom-poles.ts`), the start push
(`start-push.ts`), the start house and the television start
(`pwa/src/game/start-house*.ts`, `camera-start.ts`), the start clip
(`slalom-start.ts`), the board HUD and the second run (`slalom-board.ts`,
`slalom-heat.ts`, `hud-board.tsx`), the slalom audience
(`spectator-slalom.ts`), the riding technique table (`engine/game/defs/`).
