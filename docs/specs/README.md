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
   shape the next rule follows), and — before writing a line — *Lessons from
   the slalom* and *The labs* below: what the first discipline got wrong and
   the tools that caught it.
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

## Lessons from the slalom

The slalom was the first discipline built, and it was built twice over: a
first cut that looked right in screenshots and skied wrong, then a round of
measuring, researching and correcting. What follows is what that cost, so the
next discipline pays less. Every point names where it bit.

### How to work

- **Research before tuning, and write it down first.** The first slalom
  physics was tuned to "feels plausible" and ran 80–127 s where a real one
  runs 45–60 s. Only once the numbers were in `docs/disciplines.md` (turn
  time, edge angle, radius, lean, load, speed) was there anything to tune
  *to*. Put the discipline's target table in that page before touching a
  number.
- **Build the measuring tool before the thing it measures.** `make technique`
  (below) was written late; the day it ran it showed the racer standing
  upright (19° of lean where the research says 45–55°), tucking through a
  slalom, and every technique turning two to three times tighter than its
  skis allow. None of that was visible in a screenshot of one frame.
- **Look at every picture, and from more than one side.** The behind sheet
  showed the lean; only the turn-shape sheet (every technique at one scale
  from above) showed the radii were wrong.
- **Sweep, never spot-check.** The bot's slalom passed on seed 38 and failed
  on the steepest campaign rungs. A setting is only good when every campaign
  rung of the discipline AND generator seeds 1–16 finish — nudging a bot knob
  ±20 % routinely drops one run in thirty, so sweep after every change.
  `make sim` does NOT ski a slalom (it runs the open race rules), so a
  discipline needs its own sweep: a scratch test over `SHELVES` built with
  `buildCampaignLevel` plus seeds 1–16, stepped with `botInput`, printing
  time, mean/peak speed, result and par (see `tests/technique_test.ts` for
  the shape; delete the scratch file after).
- **Keep the default row the identity.** The technique table works because
  its default row (`FREE`) reproduces the old model to the bit, so every
  other mode's digests, medals and tests stand still while one discipline
  moves. Do the same for anything a discipline adds to the engine.
- **One agent per subject, in its own worktree, merged often.** Physics,
  the bot, the HUD, the audience and the docs ran in parallel without
  touching each other's files. What did collide: two agents both needing
  `skier.ts`, and `main` moving under the branch (eight PRs in a day) — merge
  `origin/main` early and often, and tell running agents when their base
  moves.

### The physics

- **Grip modelled as plain friction caps a carve at about 1.6 g;** a slalom
  turn needs ~3 g. The fix was *platform* grip: past ~54° of edge the hold
  grows as tan(edge), the share passing through the hips so it turns the
  skier without rolling him (`grip.platform`, `snow.ts`'s `platformOf`).
- **The lean is the balance of the turn, not a styling knob:**
  tan θ = lateral acceleration / g, with angulation (hips, knees) supplying
  the rest of the edge, and the edge never further over than the lean plus
  that angulation (`engine/game/incline.ts`). The drawn figure reads the
  engine's lean — fix the engine, and the picture follows.
- **A carved ski turns at R ≈ sidecut · cos(edge), no tighter.** Anything
  tighter is a skid and costs speed. Before this the path could turn 2–3×
  tighter than the ski could bend.
- **A pair's widths must agree with its sidecut.** The catalog carried the
  widths and the sidecut as independent numbers; the old downhill pair was
  drawn as a 33 m ski while labelled 45 m. `tests/topsheet_test.ts` now holds
  every pair's widths to its sidecut, and `tests/catalog_test.ts` holds the
  race pairs to their competition rules.
- **How the edge changes is technique.** With the lean model, a skier whose
  whole body must swing through between turns loses ~0.3 s a transition; a
  slalom racer's legs tip the skis UNDER a level body (the cross-under). A
  discipline's technique row has to say how its transition works, or its
  turn rhythm can't be reached.
- **The edge lock faded with speed** (to ~55° at 12 m/s) and the roll hold
  capped the turning load at ~1.8 g — both had to become technique-dependent
  (`edgeLockAt`, the technique's `fade`).
- **A skid with the skis straight drags only ~0.35 g** — less than gravity's
  pull past about a 37 % grade. On a steep pitch speed is scrubbed by
  turning, not by braking straight; plan for it.
- **Contacts go stale in the air.** A foot in the air kept the position
  where it last touched the snow, so a racer flying over a closed gate was
  disqualified with his body through the middle. Judge an airborne foot
  where the body is (`strict.ts`). Any discipline with jumps over gates
  needs this.

### The course

- **Pick the stretch by steepness first, then drop.** "The most vertical
  that fits" set slaloms on 21 % stretches. R31 now picks the steepest (to
  the top level's gradient) among drops of 140 m and up (`slalom.pick`).
- **Groom the course hard and smooth it.** Courses that crossed powder
  drifts (~5 % grip) could not be skied at race pace; courses on a field of
  lips every 5–7 m put the bot in the air a third of the way. The setter now
  grooms the course and smooths the ground under it (`slalom.comb`).
- **The line's tightest bend caps the edge a racer needs.** A 10 m bend
  needs only ~44° of edge, so the slalom never reached its 65–70°. But
  tightening the bend alone only cost finishes, because the transition was
  the limit. Fix the technique first, then the line.
- **Black maps carry drops across the piste,** which a gated race can't
  cross; a slalom off a bare seed is built red. A speed event that keeps
  jumps must say how it treats a drop.
- **Curate campaign rungs by the stretch, not the grade.** Several reds had
  gentle stretches; check each rung's stretch (vertical, gradient, length)
  before giving it a discipline.

### The bot

- **The bot's forward model must be the physics' own limits.** Twice the
  physics changed and the bot kept planning turns it could no longer make
  (DSQ at gate 8). `engine/sim/turn-model.ts` now reads `limits.ts` and
  `incline.ts`; re-fit its two fitted numbers whenever the physics moves.
- **No tuck in a technical event.** The bot tucked 28 % of a slalom — racers
  tuck 0 %. Make tuck policy part of the technique.
- **Par comes from the same line the bot skis** (`race-line.ts`'s
  `lineSpeed`, `par.ts`), so the board dealt about par stays fair; re-fit par
  after every bot change (bot/par within ~5 %).

### Determinism and tests

- **Floating-point order is part of the digest.** Re-ordering arithmetic in
  shared code moves `make sim`'s digests for modes you never meant to touch.
  Keep the old operation order on paths other modes take.
- **The crowd shares the run's random stream.** Any change in how the
  player skis re-deals every amateur, so crowd tests that count events in a
  short window turn marginal (one went from 7 rounds to 2). Watch long
  enough for the event to happen whatever is dealt, rather than lowering the
  bar.
- **Node and the browser drift a few steps apart** on the same bot run (the
  technique lab prints the offset). Don't compare a Node sweep's frame to a
  browser sheet's frame exactly.
- **The 1000-line cap bites on merges,** when both sides add lines to the
  same file. Move a block to its own file (as `defs/race.ts` and
  `ride-slalom.mjs` were) rather than squeezing.

### The app

- **An out run is not a finish.** The HUD first treated a DSQ as finished;
  every result path needs the out case.
- **Normalize a readout by what the technique allows,** not by the ski's own
  numbers (the edge bar read past full under the slalom technique).
- **The broadcast start needs the screen kept clear;** the big centre
  countdown covered the television shot, so a slalom shows a small READY/GO.
- **Check the front door's height** after adding to it: the screenshot tool
  warns when the card scrolls (`!! menu-card-root scrolls whole`). A
  pinned-seed screenshot hides some lines; a non-pinned view needs a
  temporary local change to photograph.
- **Blending a pose angle linearly passes through the middle:** half-excited
  fans held their arms straight out (a T) because rest-to-raised blended
  through level. Snap such moves across a threshold.

### Infrastructure

- **The skis are Blender models whose sources include `defs/skis.ts`;**
  changing a pair fails `tests/models_test.ts` until `make models`
  regenerates them. In a cloud session `pip install bpy==4.2.0` (Python
  3.11) gives the builders Blender without a binary.
- **Exclude agent worktrees from commits** (`.claude/worktrees/` in
  `.git/info/exclude`); one `git add -A` picked them up as embedded repos.
- **A squash-merged PR's branch is spent.** Follow-up work starts on a fresh
  branch from `main`; carry over only the new commits.

## The labs, and when to reach for each

Every lab writes to `previews/` (gitignored). `make <lab> ARGS=--help` lists
its flags. Browser labs need `CHROMIUM_PATH=/opt/pw-browsers/chromium` in a
cloud session; `screenshots` needs `make build` first.

| Lab | What it shows | For a discipline |
| --- | --- | --- |
| `make technique` | Each riding technique skied by the bot on one course: PATH (strobed from above, gates drawn, a scale bar), BEHIND (TV frames at transition, edge-set, apex, exit), SIDE (the apex), TURNS (every technique's natural linked carve on one open slope at one scale, the line coloured by radius, each apex labelled radius/time/edge, the researched radius drawn), and a TABLE against the research targets (`--json` to save, `--compare` to diff) | THE loop for a technique row and its pose: run before and after every physics or pose change. `--techniques=slalom` and `--sheets=none` give the table in seconds; `--course=slalom|piste` |
| `make ride` | Scripted scenarios on synthetic slopes, each a table and a picture; `slalom-cut` and `slalom-rhythm` measure a technique's carve and rhythm without the bot | A new technique gets its own scenarios (`scripts/lib/ride-slalom.mjs` is the pattern); `ARGS=--card` is every pair's card |
| `make sim` | The bot down 8 seeds on the open race rules: times, misses, resets, digests | The determinism guard for every OTHER mode; it does not ski a discipline — sweep that yourself (above) |
| `make sim ARGS="--skis all"` | Every pair down every seed | A pair's retune (the downhill pair's misses showed here) |
| `make level` / `make analyze` | One map's piste, gates, kickers and grades; the rule book's verdict | The course rule and its setter; `make resort` for the ski area |
| `make rate CAMPAIGN=1` | Every campaign rung rated, with the bot's time and a trial's medals | Curating a discipline's rungs and setting medals (gold 0.98×, silver 1.03×, bronze 1.125× the bot) |
| `make screenshots` | The built game at a moment: `--t s`, `--seed`, `--run2` (the second run's plate), `--hold kmh --move m --hold-for s` (forces a run — a DSQ plate), `--surface menu,…` for cards | The start (t≈1, 3, 5), mid-run, the plates, the front door at `--viewport desktop,phone,landscape` |
| `make audience` | The crowd's moves, looks and cuts, and a race skied past them (`--mode=slalom`, views incl. `course`, `combo`, `arena`, `stand`) | A discipline's spectator placement |
| `make skier-metrics` | The pose measured against a skier's bands, frames at fault (`--json` / `--compare`) | Any pose change — the pose row per technique |
| `make skier`, `make turns` | Every move posed from five sides; turns from low and side | The figure's look in a turn |
| `make skis`, `make models` | The pairs' sheets; the Blender models regenerated | A pair added or changed |
| `make world` | One seed skied by the bot through the game's renderer at named views | How it reads at speed |
