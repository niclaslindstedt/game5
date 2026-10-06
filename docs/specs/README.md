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
| — | Slalom | built — spec retired; its research is `docs/disciplines.md` § Slalom |
| — | Giant slalom | built — spec retired; its research is `docs/disciplines.md` § Giant slalom |
| — | Super-G | built — spec retired; its research is `docs/disciplines.md` § Super-G |
| — | Downhill | built — spec retired; its research is `docs/disciplines.md` § Downhill |
| — | Ski cross | built — spec retired; its research is `docs/disciplines.md` § Ski cross |
| — | Speed skiing | built — spec retired; its research is `docs/disciplines.md` § Speed skiing |

Beside the disciplines, one spec cuts across all of them:

| Spec | Feature | State |
| --- | --- | --- |
| [RACE_MAPS.md](RACE_MAPS.md) | Every discipline's own NINE pinned maps, off the campaign; the pause card naming the map for a free ride | built for every discipline — the slalom, the giant slalom, the super-G, the downhill, speed skiing and the ski cross |

The TRICK FORMATS — the judged freestyle events that are to replace the one
arcade TRICKS run — are researched and drafted, none built. Their research
is `docs/freestyle.md` (this page's `docs/disciplines.md` for tricks), and
one spec cuts across them all:

| Spec | Format | State |
| --- | --- | --- |
| [TRICK_MODES.md](TRICK_MODES.md) | What every format shares: the trick card, the trick reader, the judge, the field, more rotation, jibs, the build order | draft |
| [BIG_AIR.md](BIG_AIR.md) | Big air | draft — researched |
| [KNUCKLE_HUCK.md](KNUCKLE_HUCK.md) | Knuckle huck | draft — researched |
| [SLOPESTYLE.md](SLOPESTYLE.md) | Slopestyle | draft — researched |
| [RAIL_JAM.md](RAIL_JAM.md) | Rail jam | draft — researched |
| [HALFPIPE.md](HALFPIPE.md) | Halfpipe | draft — researched |
| [MOGULS.md](MOGULS.md) | Moguls | draft — researched |
| [DUAL_MOGULS.md](DUAL_MOGULS.md) | Dual moguls | draft — researched |
| [AERIALS.md](AERIALS.md) | Aerials | draft — researched |

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
   shape the next rule follows; R32, the downhill's, beside it), and —
   before writing a line — *Lessons from the slalom*, *Lessons from the
   downhill* and *The labs* below: what the first two disciplines got wrong
   and the tools that caught it.
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
   front door, the audience, the sounds — and the discipline's NINE PINNED
   MAPS (`RACE_MAPS.md`: a sweep of seeds for the ones whose course makes a
   good race of this discipline, rows in `race-maps.ts`, held by
   `tests/race_maps_test.ts`), which is what its level card offers.
   Campaign rungs are optional and come after.
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

What the downhill added on top, for every discipline after it: the course
preparation shared by every setter (`engine/mapgen/course-prep.ts`'s
`prepareCourse` over a `CoursePrep` row — the start drop, the comb, the
grooming, the trees cleared, the crests shaved), the one question "which
race is set on this map" (`race-course.ts`'s `raceCourseOf`), a racing line
relaxed to the least curvature with gates centred on it
(`mapgen/speed-course.ts`'s `racingLine`, `speedLineAt`), PANEL gates under
the strict rules (`Checkpoint.panels`, `strict.ts`), the A-nets
(`engine/game/nets.ts`, `NETS` in `spectator-plan.ts`, drawn by `gates.ts`),
the speed trap (`speed-trap.ts`), a field dealt per discipline with a
training run (`field.ts`'s `DOWNHILL_FIELD`, `Field.training`), a par
reckoned forward down a line (`par.ts`'s `downhillPar`, `raceParOf`), a
line-follower for the bot at speed (`sim/downhill-steer.ts`), `make sim
ARGS="--mode <discipline>"` (the bot down a discipline's course, its trap and
out columns), and on the app's side the race HUD every discipline reads
(`snapshot.ts`'s `RaceHud` — `snap.race` — with `discipline` on it), a run
before the race (`downhill-run.ts`, `slalom-heat.ts`'s `{ kind: "race" }`),
and the front door's race row.

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
  `make sim` on its own runs the open race rules; `--mode slalom|downhill`
  skis a discipline's course (since the downhill), and the campaign's rungs
  still need their own sweep: a scratch test over `SHELVES` built with
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
  discipline's technique row says how its transition works
  (`Technique.cross`: the edge the legs alone stand the skis on, the
  retraction, the pitch past which a cross-under gives way to a
  cross-over), or its turn rhythm can't be reached: crossing over, the 0.9 s
  rhythm missed every other turn; crossing under, it makes every one.
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
  the limit. Fix the technique first, then the line: with the cross-under
  in, `slalom.bend` went to 8 m with every run still finishing — and the
  bot's tightest tenth of turns moved only from ~8.1 to ~7.9 m, because it
  rounds the line out on a steep pitch and plans its speed off the grip.
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

## Lessons from the downhill

The downhill was the second discipline, built in one long session straight
after the slalom's lessons were written — and built BEFORE the super-G and
the giant slalom, though its spec said after. Most of what those two specs
call new (jumps kept in a race course, the nets, one run, speed, panel
gates) is built now; read it before writing it again.

### How to work

- **Save the sim's table before the first edit** (`make sim >
  before.txt`), and diff the digests at the end. The downhill touched
  `bot.ts`, `course.ts`, `field.ts`, `par.ts`, `state.ts` and the slalom's
  setter, and the default table did not move a digest — the only proof
  that the other modes were left alone.
- **`make sim ARGS="--mode downhill --skis eagle --count 16"` IS the sweep
  now.** The slalom's lesson says `make sim` skis no discipline; it does
  since this branch (`--mode slalom|downhill`, with `trap` and `out`
  columns). Add the next discipline to the flag's list on the first day,
  and sweep the campaign's rungs of it with a scratch test as before.
- **Scratch experiments are files in the tree** (`scripts/_exp*.ts`) and
  temporary `export`s on private functions to reach them; both leaked to
  the gate here. Delete them and revert the exports before `make lint` —
  an unused variable left by an experiment failed it.
- **R-rule ids run contiguous** (`tests/docs_rules_test.ts`): the downhill's
  spec said R34 and it is R32, the next free id. Whatever the spec says, the
  next rule takes the next number.
- **Rebasing mid-work is routine**; keep the work in a WIP commit and a
  backup branch so a conflict (here `defs/technique.ts`, where `main` had
  added the transition row) is a three-way merge and never lost work.
- **Write the lessons in the same session that learned them.**

### The course

- **On a resort map the "whole piste" is a course the ski area built.** A
  downhill takes the resort's course with the most VERTICAL
  (`downhillCourseOf`) and the map is built again on it
  (`createGame`, `GenerateOptions.course`; the resort cache makes the
  second build cheap). On some seeds the biggest course is a blue or a red;
  the level card offers a downhill only the blacks (`fitsMode`), and a seed
  link takes what it gets.
- **Factor the setter's preparation BEFORE writing the second setter.**
  `course-prep.ts` came out of `slalom.ts` with every slalom number moved
  into a `CoursePrep` row and the slalom's tests and digests unchanged; the
  downhill's setter is then a third the size. Do the super-G's on the same
  row.
- **Crests launch a racer at 100+ km/h.** A headwall's lip that a slalom
  skier rolls over throws a downhiller twenty metres onto the flat — harsh
  landings until the setter SHAVED the course's convexity to a radius
  (`CoursePrep.crest`, 80 m, `shaveCrests`) so every jump lands on the
  downslope. A super-G keeps its jumps too: start from the same shave and
  tune the radius to its speed.
- **Set the gates on the racing line, not the piste's middle.** Gates on
  the centreline made the bot weave at 35 m/s. The line is the middle
  relaxed to the least curvature inside the corridor (coarse-to-fine
  strides, the room eased toward the edges), the gates centred on it every
  ~80 m and never within 25 m of a jump's lip — a gate in the air judges a
  foot nowhere near the snow.

### The physics and the technique

- **The research's first guess of a technique row can be unskiable.**
  The downhill row as researched (the shared fade, 55° at most) let the
  edge lock collapse at 30 m/s, so no pair could hold a ~50 m bend at race
  speed and the bot ran off the line. `fade` = 2.5 and 60° hold it; the
  numbers it was tuned to (a 52 m turn at 26 m/s asks ~45° of a 50 m ski)
  are in the row's comment. Check a speed row's lock at ITS speed
  (`edgeLockAt`, `carveSpeedOf`) before the bot is blamed.
- **The engine holds at 45 m/s.** 120 Hz is 0.37 m a step at the
  downhill's peak; the gates, the nets and the landings were judged
  correctly there with no change to the step.
- **Only the race pair holds a race line.** On the all-mountain pair the
  bot cannot hold a downhill's fast bends; the mode bills the Eagle, and the
  labs and screenshots pass `--skis eagle`.

### The bot

- **A look-ahead steer lags at speed.** The slalom's planner and a pure
  pursuit both ran wide at 35 m/s. What holds the line is a FEED-FORWARD
  of the line's own bend a moment ahead (the edge that bend asks at this
  speed) plus a small correction onto the line (`downhill-steer.ts`).
- **Never look past the owed gate.** Reading the line beyond it cut the
  corner and missed it; hold the owed gate's line and its width as the
  room until it is taken.
- **Read a bend with its sign.** The line's swing and the piste's bend
  summed as magnitudes doubled the curvature where the gates cut a bend's
  inside, and the bot crawled; `lineBendAt` reads them signed.
- **Do not skid at 120 km/h.** A check that scrubs speed slides the skis
  off the line; a downhiller checks lightly (at most a tenth of the brake)
  and plans its speed earlier instead.
- **In the air, steer for the landing** (`landingAhead`), not the line.

### Par and the field

- **Reckon a speed event's par FORWARD**, capped by the grip the pair cuts
  hard (`cutGrip`) and the sidecut's speed (`carveSpeedOf`), and stood up
  where the bot stands up (the drag tucked against stood). A backward
  braking pass made par far slower than the bot, which barely brakes.
  Bot and par agree within about a tenth on every seed and rung.
- **A new discipline draws on its own streams.** The field's training run
  is dealt off the seed xor a salt, and the slalom's draws kept their
  order, so no slalom board moved.

### The app

- **Generalize the slalom's HUD once, not per discipline.** `SlalomHud`
  became `RaceHud` (`snap.race`, with `discipline`), the plate's press a
  union (`secondRunOf`: a slalom's `second`, a downhill's `race`), and the
  map's race one question (`raceCourseOf`). The next discipline adds a row,
  not a copy.
- **Every event kind needs an audio sample** in `tests/audio_test.ts`, and
  every result path the out case and now the training case.
- **The front door is full.** A third race tile does not fit: the races are
  a row of half tiles with the disciplines to come on a strip under them,
  and on a phone held upright the half tiles lose their glyph (under
  30rem) so DOWNHILL fits. A super-G or a giant slalom tile needs a
  decision — three across will not fit a phone; a race card of its own off
  one RACE tile is the likely shape. Ask before building it.
- **`App.tsx` is at 994 lines.** The next discipline's app work must move
  something out of it first (the race-run plumbing is the obvious block).
- **Converting a campaign rung changes what its stored board means.** Two
  time trials became downhills; a medal kept from the trial still reads as
  the rung cleared and its time is dropped (`mergeProgress`), so nobody's
  ladder relocks. Do the same, or bump the board's key on purpose.

## Lessons from the super-G

The super-G was the third discipline and the first built off the race
maps' shape. Its course is mostly the downhill's machinery, and the work was
in the turns.

### The course

- **Share the speed course, don't copy it.** The downhill's line, its
  reader, the trap's place and the gate spacing moved into
  `mapgen/speed-course.ts` (`speedCourseOf`, `racingLine`, `speedLineAt`,
  `trapArc`, `gateArcs`) with the arithmetic untouched: `make sim` and the
  downhill's and the slalom's sweeps kept every digest. A rule row the
  shared code reads takes its numbers as parameters (`LineRule`,
  `TrapRule`, `SpacingRule`), and a constant two rows must agree on is
  stated once and held by a test (`LINE_STEP`).
- **A wide resort piste lets a least-bending line wander twenty metres to
  a side** — fine for a downhill's gates centred on it, fatal for gates
  swung either side of it. Cap the base line's room (`line.most`) before
  adding the swing.
- **Gates must sit where the racer is on the snow.** The downhill keeps
  gates off its DROPS; a super-G at 100 km/h also flies off the shaved
  crests, so the jumps a setter avoids are the drops AND the crests still
  tighter than v²/g (`crestsOf`, read over a lip's length, not a 2 m
  station — that one found a crest every forty metres), with a landing
  clearance after the lip longer than the one before it.
- **The downhill ski carves no super-G turn at a crawl.** The edge is held
  to the lean plus angulation, so at 40 km/h a 50 m ski will not swing
  eight metres in fifty. The first gates out of the house and the gates on
  a gentle stretch swing less (`superG.opening`, `superG.flat`).
- **Check generation time when pinning a map.** One candidate took 27 s to
  build cold (seven rejected attempts) — a loading card nobody would wait
  through. Time every pinned map cold (`generateLevel` in a fresh process).

### The physics and the bot

- **The researched technique row was unskiable again.** With the
  downhill's fade the Eagle carved a 40 m turn only under 46 km/h; fade 5
  and 63° hold 40 m to 150 km/h. Print `carveSpeedOf` for the course's
  radii at the row's speed before touching the bot.
- **The downhill's line-follower cuts a swung line.** Fed forward 0.3 s it
  turned for the next swing before this one's apex — 1.3 m inside on the
  median gate, 3 m at the worst. Half the lead (`SUPER_G_STEER`) halved it.
  Measure the bot's crossing of every gate against the line (signed,
  outward positive) across sixteen seeds, not the misses alone.
- **A firmer check made it worse** (13/16 from 15/16): the downhill's
  lesson holds at a super-G's speed too.
- **Pass the turning pole with the margin the bot can hold.** The line
  passes 3.5 m outside it on an 8 m gate; the bot's p99 outward error is
  +1 m, its p1 inward −2.4 m.

### The app

- **One RACE tile and a card behind it** replaced the half tiles: the race
  card (`menu-races.tsx`) takes every discipline, built or coming, and the
  front door is four wide tiles in both orientations.
- **App.tsx was at its cap.** The front door's pages moved out whole into
  `menu-pages.tsx` (−47 lines) before anything was added.
- **The race maps landed on `main` while the super-G was being built** —
  the same idea from both sides. The merge kept `main`'s shape (`RaceMap`
  with its quoted figures, `PinnedPicks`, `holdRaceMaps`) and added the
  super-G's row and file; a discipline built later adds a row to
  `RACE_MAPS` and a `race_maps_<discipline>_test.ts`, nothing more. Fetch
  `main` before building a shared piece the spec says is still to do.
- **Run the suite and a browser lab apart.** Both at once restarted the
  worker in a cloud session.

## Lessons from speed skiing

Speed skiing was the fourth discipline and the first whose course is not on
the piste at all. Most of the race machinery carried over; the new work was
the track, the clock and getting a whole field's worth of speeds honest to
a tenth of a km/h.

### The course

- **A course can be a track of its own.** A speed track is straight; no
  piste is. `setSpeedSki` searches a straight line down the face, grades
  the ground to its profile and hands back a `Level` whose `track` IS the
  speed track — everything that asks the piste (the physics' queries, the
  minimap, the trees cleared, the snow groomed) then asks the track with
  no change. The map's kickers and drops keep their place but are marked
  off any track (`onTrack: false`, no arc), since their arcs were the old
  piste's.
- **Round the knees as well as the crests.** A crest cut to v²/g keeps the
  racer on the snow; the knee where the steep meets the gentle, left
  sharp, is a compression the legs' damping eats 1–3 % of the speed in.
  Both are hulls of the profile and a parabola (`hullOf`), exact and O(n)
  — the iterative relaxation the downhill's crest shave uses was the
  setter's whole cost here, run over five hundred lines.
- **Interpolate a graded profile smoothly.** A profile read linearly
  between 4 m samples leaves a slope kink every 4 m, and a racer at 55
  m/s rides every one (a Catmull-Rom between them does not).
- **Deal what the race is built for.** Aiming every track at one speed
  made nine maps within 2 km/h of each other; the speed a track is built
  for is dealt off its seed in the band, so the nine make a ladder.
- **Start on the slope.** A level start platform held the racer still: the
  start hold's skid had his skis across and the push died before the lip.
  A speed skier starts on the pitch, and the game's does.

### The physics and the clock

- **The engine holds at 250 km/h.** On the reference pitch it matches a
  point mass to the decimal at 300 km/h, every station on the snow; 120 Hz
  is 0.6 m a step and nothing needed changing (`make ride SCENARIO=speed-250`).
- **A step is too coarse a clock for a speed.** 1/120 s is half a km/h
  through 100 m at 200. Each zone line's crossing is read to the fraction
  of the step it fell in (`crossingShare`), and only on a speed track, so
  no other mode's clock or digest moved.
- **Read every time as a speed, keep every time as a time.** The board,
  the record book, the ghost and the field all rank lower-is-better; a
  speed race keeps the time through the zone and turns it round only where
  it is drawn (`speed-ski-run.ts`).
- **A finished racer is the engine's.** After the finish the input is a
  coast, and the old coast (a 0.6 skid) at 200 km/h ran a racer off the
  end of the track into the trees. A speed track's coast untucks, rides
  the wind and skids only past its braking line (`runOut`).
- **Skid physics on a slope is weak** (0.13–0.28 g beyond the air's at
  20–40 m/s); size a run-out on what the engine does, measured, not on
  the research's ~0.3 g mean.

### Par and the field

- **When the race is decided by tenths, ski the par.** A profile walked by
  a point mass missed the compressions, the wind and the new snow by up to
  3 % map to map, which is a whole field. Par is now the engine's own clean
  run down the track (`speedSkiPar`), and the bot lands within 0.2 % of it
  on every map. The cost is a few thousand steps, once per map and pair.
- **A perfect run should just win.** The field's best is dealt a hair
  slower than par (`SPEED_SKI_FIELD.best`): a racer who holds his tuck
  from the house wins, and anything less is places behind.
- **A final ranked alone**: the slalom's combined time is a `combined`
  question in `field.ts` and `slalom-board.ts`, not a second code path.

### The app

- **The renderer's "finish" is the last checkpoint; a speed track's is
  not.** Its last checkpoint is the zone's bottom line, which a racer
  crosses at 200 km/h; the arch, the arena and the crowd stand at the
  run-out's foot (`speedSkiLines`), and the audience nowhere else — the
  margin is closed.
- **A rebuild names its mode.** The second-run plumbing rebuilt every
  two-run race as a slalom; `twoRunMode` names it.

### Left to do

- **The kit**: the airtight suit and the aero helmet are in the drag
  (`PEREGRINE.cdATuck`) but not in the wardrobe — a `skier-gear` piece.
- **A fall at 200 km/h** slides the body ~185 m on the pitch, which is
  right, but the ragdoll tumbles on the way and the injury tally is a
  bad crash's; a suit's slide is a `crash` question.
- **The programme** is two runs; the sport runs four to six with a cut
  after each.

## Lessons from the ski cross

The ski cross was the fifth discipline and the first whose field is SKIED
beside the player and whose course is BUILT rather than found. The race
machinery carried over almost whole; the new work was the course's shape,
the format around the runs and four racers on one course.

### The course

- **A course built in the snow is a line of its own.** The ski cross weaves
  down the piste's corridor as its own `track` (the speed track's trick),
  so the physics, the bot, the gates and the minimap ask the course with no
  change. Lay the corners as waypoints and round them with arcs of a
  dealt radius; a turn is then exactly the radius it was dealt.
- **A feature is an offset over a profile — but a TABLE must be level in
  absolute terms.** A kicker profile written relative to the base line
  leaves its table falling with the slope, and the lip throws a racer flat:
  0.2 s of air at 50 km/h. The jump is its own profile: the ramp relative
  to the line, the table level, the landing dug back to the line.
- **Shape a jump for the race's own air.** Under the races' 1.5 g flight
  gravity a racer at 45–60 km/h flies 9–15 m, not a real course's 15–35;
  a landing sized for real air is overshot onto the flat. Search the shape
  offline (a point mass over the profile, its impact against `harshSpeed`)
  for the speed band the bot actually carries, then build it.
- **The bot's kicker speed stops at the first unsafe landing.** On a table
  that is the knuckle, and the bot slows to land on the table; a long
  landing that is safe from 10 to 20 m/s lets it carry its speed.
- **A seed of its own wants a course chosen**, as the downhill's does:
  the piste the map was built on may be a green half a kilometre long.
  `skiCrossCourseOf` picks the ski area's course to build on.

### The race

- **Give every draw of a heat a stream of its own.** A heat's rivals are
  the start list's, their paces their skills, their reactions and the
  doors' release off the heat's own stream — so a restart, a replay and a
  test stand up the same heat, and nothing else's digest moved
  (`make sim`, `--mode slalom` and `--mode downhill` unchanged to the bit).
- **Carry the competition on the run.** The bracket rides each run as
  `GameState.bracket`, so the plate, a restart and a replay read one thing
  and nothing in the app keeps a second copy.
- **Contact needs a "behind".** Read it off the course's arc where the two
  met, never off the gates credited — a racer teleported in a test, or one
  who crossed a gate a step earlier, is not "ahead" for it. And in a
  rear-end both take the same blow: the racer behind is braced for it, or
  both go down and the card never comes.
- **Lanes, not a centreline.** Four bots on one centreline pile up: each
  holds his door's lane closing onto the line, and pulls out to pass a
  slower racer close ahead. A fence is not powder — the lane margin on a
  ski cross is a fence's, not a piste's.

### The app

- **A heat's start has no count.** "Skiers ready", "attention", then the
  doors drop with no word: the lights and their beeps are off on a heat,
  and the starter's word sits where a slalom's does.
- **A DNF in a heat is not an out plate.** A racer who fell can still be in
  the first two; the ski cross's plate is its own (`hud-cross.tsx`).

## Lessons from the giant slalom

The giant slalom was the sixth discipline and the last one `DISCIPLINES`
names. It is the super-G's course with a technical race's numbers and the
slalom's two runs, so most of the work was lifting what the super-G had
written for itself into a shape two disciplines share — and finding what a
gate every twenty metres asks that a gate every fifty never did.

### The course

- **Lift the setter before copying it.** The super-G's course setter became
  the TURNING COURSE (`engine/mapgen/turn-course.ts`: the most-vertical
  course, the lowered start, the line swung round panelled gates, the
  nets), each discipline a rule row and a salt — the salt its only other
  difference — and `super-g.ts` a few lines over it. Run the super-G's sims
  before and after the lift and compare the digests: they came out
  identical, which is the proof the lift moved nothing.
- **A lift tower can stand in the middle of a race piste.** The tower
  slide only moves a column off packed snow on the map the lift was
  planned on; a course set over that map later can run straight at one.
  On seed 13 the bot came off a jump into a tower. The line is now held
  4 m off any column standing on the piste, eased over 30 m either side
  (`TurnRule.towers`) — on the giant slalom's row alone, so no super-G
  course and no super-G digest moved. A rule a second discipline needs is
  opt-in on the shared row, not a change under the first.

### The race

- **A sweep that stands up a second run hands it the first run's pair.**
  The second run "failed" on half the seeds — because the sweep stood it up
  on the default pair rather than the giant slalom ski the first run was
  skied on. Before reading a second run's numbers, check what it is skied
  on.
- **A turn every 20–30 m leaves no straight to win a line back.** The
  super-G's hold read too far ahead: the bot turned for the next gate
  before this one's apex. It needed a closer read (the bend and the yaw led
  by 0.06 s, the look 5 m and 0.22 s per m/s ahead) and to take each turn
  at 0.85 of the grip the cut would hold — a line run wide at one gate is
  still wide at the next.
- **Par is the downhill's reckoning scaled by the bot's median.** The
  forward pass down the swung line under the giant slalom technique reads
  the profile's bends, but a turn every twenty metres scrubs more than they
  read: scale it by the bot's own median share over a sweep (1.11 over
  seeds 1–16) rather than adding a second model of the turn.

## The labs, and when to reach for each

Every lab writes to `previews/` (gitignored). `make <lab> ARGS=--help` lists
its flags. Browser labs need `CHROMIUM_PATH=/opt/pw-browsers/chromium` in a
cloud session; `screenshots` needs `make build` first.

| Lab | What it shows | For a discipline |
| --- | --- | --- |
| `make technique` | Each riding technique skied by the bot on one course: PATH (strobed from above, gates drawn, a scale bar), BEHIND (TV frames at transition, edge-set, apex, exit), SIDE (the apex), TURNS (every technique's natural linked carve on one open slope at one scale, the line coloured by radius, each apex labelled radius/time/edge, the researched radius drawn), and a TABLE against the research targets (`--json` to save, `--compare` to diff) | THE loop for a technique row and its pose: run before and after every physics or pose change. `--techniques=slalom` and `--sheets=none` give the table in seconds; `--course=slalom|piste` |
| `make ride` | Scripted scenarios on synthetic slopes, each a table and a picture; `slalom-cut` and `slalom-rhythm` measure a technique's carve and rhythm without the bot | A new technique gets its own scenarios (`scripts/lib/ride-slalom.mjs` is the pattern); `ARGS=--card` is every pair's card |
| `make sim` | The bot down 8 seeds on the open race rules: times, misses, resets, digests | The determinism guard for every OTHER mode — save its table before the first edit |
| `make sim ARGS="--mode downhill --skis eagle --count 16"` | The bot down each seed's course of a discipline (`slalom`, `downhill`, `superG`, `speedSki`, `skiCross` — `--heat` a ski-cross heat): out runs, the speed trap | THE sweep for a discipline; the campaign's rungs still by a scratch test |
| `make sim ARGS="--skis all"` | Every pair down every seed | A pair's retune (the downhill pair's misses showed here) |
| `make level` / `make analyze` | One map's piste, gates, kickers and grades; the rule book's verdict | The course rule and its setter; `make resort` for the ski area |
| `make rate CAMPAIGN=1` | Every campaign rung rated, with the bot's time and a trial's medals | Curating a discipline's rungs and setting medals (gold 0.98×, silver 1.03×, bronze 1.125× the bot) |
| `make screenshots` | The built game at a moment: `--t s`, `--seed`, `--run2` (the second run's plate), `--downhill --skis eagle` (a downhill's training; `--run2` its race), `--hold kmh --move m --hold-for s` (forces a run — a DSQ plate), `--surface menu,…` for cards | The start (t≈1, 3, 5), mid-run, the plates, the front door at `--viewport desktop,phone,landscape` |
| `make audience` | The crowd's moves, looks and cuts, and a race skied past them (`--mode=slalom`, views incl. `course`, `combo`, `arena`, `stand`) | A discipline's spectator placement |
| `make skier-metrics` | The pose measured against a skier's bands, frames at fault (`--json` / `--compare`) | Any pose change — the pose row per technique |
| `make skier`, `make turns` | Every move posed from five sides; turns from low and side | The figure's look in a turn |
| `make skis`, `make models` | The pairs' sheets; the Blender models regenerated | A pair added or changed |
| `make world` | One seed skied by the bot through the game's renderer at named views | How it reads at speed |
