# Agent skills

Every skill is a `SKILL.md` playbook under `.agents/skills/<name>/`, with
the §21.3 front matter and structure, an empty `.lessons/` directory the
`skill-reflection` skill fills, and — for the maintenance skills — a
`.last-updated` baseline (§21.4). `.claude/skills` and `.gemini/skills` are
symlinks here. `AGENTS.md` is the router that says which one to load;
`OSS_GAME_SPEC.md` §21 is the contract they are written to, and
`tests/skills_test.ts` holds this directory, the router's Skills section and
the `maintenance` registry to each other.

Most of these were ported from the sibling snowmobile game (`game4`), which
had them from the jet-ski game (`game3`) with land-vehicle ideas from the
rally game (`game2`) folded in: the procedure halves came across nearly
unchanged, the subject halves were rewritten for a skier on a mountain — a
sled is a pair of skis and the skier on them, a closed loop is an open
piste, a checkpoint is a gate, the throttle is the tuck and the brake the
skid.

## Session workflow

| Skill | One line |
| --- | --- |
| `start-work` | The preflight: clean tree, sync with `origin/main`, the deliver-by-default contract |
| `write-code` | How code is written here: comments and the pruning pass, the edit loop, the 1000-line cap, tests, the generic pools |
| `commit` | Gates by cost, the commit, the push and the PR as one step, the sim-table obligation |
| `changelog` | The fragment-or-`no-changelog` call every PR owes |
| `conflict` | Moving a branch onto another: the backup branch, always fetch, resolve honestly |
| `skill-reflection` | Read each loaded skill's lessons first; record, prune, merge, promote at the end; the size bars; `ogf-skill-lessons` (the framework's bin) |

## Maintenance (§21.5, §21.6)

| Skill | One line |
| --- | --- |
| `maintenance` | The umbrella: the registry of every `update-*` skill and the order they run in |
| `update-docs` | `docs/*.md` back in step with the skier, the snow, the generator, the sim, the app and the tooling |
| `update-readme` | `README.md`'s sections back in step with the commands, the skis and the controls |
| `update-website` | The identity-derived shell under `pwa/` back in step with `identity.ts` — and the site still carrying none of the discovery signals it withholds on purpose |
| `sync-game-spec` | Walk `OSS_GAME_SPEC.md` chapter by chapter against the tree; re-date `docs/spec-conformance.md` |

There is no `update-prompts`: this repo ships no `prompts/` tree. Port the
sibling's the day one lands, and add its registry row.

## Craft (§21.9)

| Skill | One line |
| --- | --- |
| `game-feel` | How the game FEELS: a skier on two grounds (the groomer and the powder), the reference (the arcade winter racers), the camera ladder, the cross-system levers |
| `ski-physics` | The skier's answer to the snow: the six stations and the legs, the sink and the float, the edge and the carve, the skid, the tuck, the poles, the hips, the body, the fall, flight; `make ride` |
| `ski-tuning` | A pair's own numbers (`defs/skis.ts`), the expectations a test holds the physics to, the field's pace, the day a roster lands |
| `ski-design` | How the skis LOOK: the builder in the body frame, the topsheets, the start line's four colours; `make skis`, `make world` |
| `blender-assets` | A game asset modelled in Blender off the game's own data: `make blender`, the budget and its LODs, the asset sheet beside the game's own, headless Blender; the models in the game |
| `skier` | The figure on the skis: the stance from the engine's readings, the limbs solved to the bindings and the pole grips; judged from behind |
| `skier-improvement` | Making the skier more realistic: the loop and its harnesses — `make skier-metrics` (the pose against a skier's bands), the skier lab's closeup, detail, game-pixel and skin-stretch sheets, the model rebuilt and published — and what the first pass learned |
| `collision` | The skier meeting what is not snow — trunks, rivals, the edge of the map — and the course counting: gates, misses, the finish, the reset |
| `crash` | The skier past saving and off his skis: the wipeout (a trunk, over the tips, a fall, an edge caught) and his tumble, bogged in the powder and poling out, damage when it is on (the rally game's `crash`, by way of the snowmobile game's) |
| `engine-system` | Adding or changing a gameplay system, engine-first |
| `mapgen-improvement` | The world generator: the mountain, the piste's descent, the gates, the kickers, the start, the forest and the tree line, the day; the R-rules; piste-and-terrain craft; the analyze → fix → `make level` loop |
| `add-region` | A new kind of snow country (R21) end to end: the row, the surface, the look and the grade, the word, the suite and the labs — the alpine kept all ones |
| `nature` | The snow-loaded woods (where they stand, the tree line, how they are drawn), the mountain as a landscape, the ground's clipmap, the wildlife by region |
| `atmosphere` | The clear winter sky: the sun by the run's own hour, the colour model, the blue in the shadows, the haze; the weather and the night |
| `snow-look` | The snow as DRAWN: the shader, the glitter, the groomed piste, the trail map and the grooves it lowers |
| `visual-effects` | What the skis throw and leave and what the skier feels: the spray, the tracks' stamping, the vibration table |
| `platform-shells` | The desktop app (`tauri/`) and the store app (`native/`): the two-crate split, the WebView and its server, the `__SH_SHELL__` seam, the haptics bridge, the names stated twice |
| `picture-pricing` | Every PICTURE stop's measured cost and argued benefit, the price list lab (`make bench --costs`), and what PRESET ▸ AUTO keeps because of them |
| `lab-tooling` | How a lab or a script is built: the framework's `tooling/*` shelf and `scripts/lib/`, pure-Node versus browser-driven, the harness page, the URL contract, registering a tool |
| `hud-and-menus` | The HUD's readouts, the three presses, the edge thumb and the tuck lever, the keys — what is drawn over a RUN |
| `menu-system` | The shell around a run: the attract card, the front door, the loading card, the pause card, the settings |
| `ui-review` | The fit-and-finish sweep at the reference viewports |
| `playtest` | Looking at the real game: `make world`'s views and `make screenshots`' moments |
| `test-scenario` | Exact situations: the synthetic slope, `placeRun`, scripted inputs, the ride lab's scenarios |
| `debug-game` | Deterministic repros, classifying by layer, the failing test first |
| `debug-tools` | The developer page behind the title's seven-second hold: the overlay's instruments, the free camera, the REPRO line, UNLOCKS, and the BENCHMARK with its report and history; `make bench` |
| `simulate-run` | `make sim`: the `RunReport` table, its columns, which movements are regressions |
| `level-rating` | Whether a generated mountain is any GOOD and how HARD: `engine/rating/`'s eight axes and the index, the ladder scorer, `make rate` and `make difficulty` |
| `campaign` | The pinned maps and the ladder they make — three shelves of six (the nursery, the ridge, the glacier), the points, the locks, the level card a measured run picks its map on, the generator-version contract and the digest a pinned map stands on |
| `bot-improvement` | The piste-reading bot in `engine/sim/bot.ts` — the player's stand-in and every rival — measured with `make sim` |
| `sound-effects` | Every sound synthesized from parameters — the wind, the edges and the snow, the poles as steered layers, every one-shot as a def — under `pwa/src/game/audio/`; the audition page and its meter |

## Reserved

Subjects that will be skills of their own when their subject grows past the
skill that carries it today; until then a lesson about one waits, scoped, in
the nearest existing skill. The sibling repos' skill of the same subject is
the starting point.

| Future skill | Will own |
| --- | --- |
| `tricks` | The aerial vocabulary and its scoring (`engine/game/tricks.ts`, `strokes.ts` — carried by `engine-system` today) |
| `replay` | A run recorded as its controls and watched again (`pwa/src/game/replay.ts`, `replay-shots.ts`, `camera-tv.ts` — carried by `menu-system` and `game-feel` today) |
| `store-listing`, `store-shots` | The storefront's words and its screenshot set |
