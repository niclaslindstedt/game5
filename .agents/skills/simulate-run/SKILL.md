---
name: simulate-run
description: "Use to measure the game's ACTUAL balance by running the real engine headlessly — the bot skiing generated mountains across seeds, reporting whether it finished, the run time, gates credited, the mean and top speed, air time and jumps, harsh landings, tree hits, wipeouts, resets (and the engine's own), gates missed, the place against a field, and the determinism digest. The closing measurement loop of every skis, snow, bot or generator change: run it before and after, read the diff, and paste both tables in the PR. Also the owner of what the table's columns mean and which movements are regressions."
---

# Simulate Run

The sim skis the REAL engine — `createGame`, `step`, the bot — at full speed
with no renderer, and reports what actually happened. Nothing in it models or
approximates a rule; it IS the rules, run fast. **Balancing this game means
balancing pace and feel-as-measured** — does the bot finish, does it take
every gate, does it fly the kickers and land them, does it stay off the trees
and on its skis — not tuning an economy. The regression surface is the table.

**Before starting, read this skill's lessons** —
`npx ogf-skill-lessons simulate-run --list`. Load
**`skill-reflection`** at both ends of the session.

## The tools

- **Engine module: `engine/sim/simulate.ts`** — `simulateRun(seed, options)`
  (`level`, `rivals`, `profile`, `spec`, `maxSeconds`, `keepEvents`).
  Deterministic per options; returns a typed `RunReport`. Solo by default:
  the bot on the start line's first slot, no lights, nobody else on the snow
  — a solo run is the measurement; `rivals: 3` is the race.
- **CLI: `scripts/simulate-run.mjs`** — the sweep and the table. It is CI's
  `simulate` job, and it **exits non-zero when the bot finishes NO seed** — a
  skier that cannot get down any mountain is broken, not slow.

```sh
make sim                              # seeds 1..8, solo, one run each
make sim SEEDS=3,7,38                 # these seeds (a bug report's)
make sim ARGS="--skis all"            # every pair of the catalog down the same seeds
npm run sim -- --count 20             # a wider sweep for a tuning decision
npm run sim -- --rivals 3             # a whole race: the field and the place
npm run sim -- --region fell          # a region's mountains
npm run sim -- --json out.json        # machine-readable rows
```

## Reading the table

`docs/simulation.md` states every column and the table at the tuning in this
tree; read it before the first run. The movements that matter:

| Column | Meaning | Healthy movement |
| --- | --- | --- |
| `fin` | The finish line | **yes, every row** — a map the bot cannot finish is a map a player will not |
| `time` | The run's clock from GO to the finish | about two minutes on an alpine seed; tens of seconds longer is the bot bogged or circling at the start |
| `cps` | Gates credited / the run's gates | **all of them** |
| `mean`, `top` | km/h | mean around 60–80; a drop on every seed is a slower pair or a timid bot, on one seed that map; top near the pair's `terminalSpeed` on the steepest pitch, never over `SKIS.topSpeed` |
| `air`, `best`, `jmp` | Air summed over counted flights, the longest, how many | the piste kickers taken; fewer jumps is a kicker taken too slowly to leave the snow; `best` over 2.5 s is one overshot |
| `hrsh` | Landings past `air.harshSpeed` | a few; many is a landing model gone hard or a bot misjudging a kicker |
| `tree`, `wipe`, `rst`, `auto`, `miss` | Trunks met, wipeouts, resets (the engine's own), gates skied past | **≈ 0** — a tree hit on a generated map is the bot leaving the piste; a wipeout on the groomer is an edge caught |
| `plc` | Place against the field | 1 solo; in a race, read beside the rivals' dealt paces |
| `digest` | FNV-1a over the skier's position and speed every quarter second | changes with ANY physics, bot or generator change; must NOT change between two runs of the same tree |

The footer is the one-line before/after: finished count, mean and top pace,
air per run, jumps, harsh landings, trees, wipeouts, resets, missed.

## The workflow rule

**Run `make sim` before and after every skis, snow, bot or generator change,
and paste both tables in the PR description** — the contract in
CONTRIBUTING.md and the PR template. A change that makes the bot stop
finishing, stop taking gates or start resetting is a regression until
argued otherwise, and the argument happens in the PR over the two tables.

## The knob loop

1. **Baseline**: `make sim` on the clean tree (or `--json baseline.json` for a
   wide sweep you will diff mechanically).
2. **Edit the knob** — `defs/tuning.ts` (shared), `defs/skis.ts` (the pair),
   `mapgen/rules.ts` (the mountain) or `sim/bot.ts` (the skier). Never inline
   in the model.
3. **Re-run and read the diff.** Did the change move what you intended — and
   nothing you didn't? A sink change that also halves the jumps is telling you
   the systems are coupled (a ski that sits lower meets the lip slower);
   understand why before shipping.
4. **Compare over a sweep, never a seed.** Runs are chaotic — one different
   landing early cascades into a different run — and a generator change
   re-rolls the maps themselves, so seed 7 after is not seed 7 before. Read
   the footer over `--count 20` for a decision.
5. **A race, not only a solo.** A change to the field, the start line, contact
   or the pace band owes `--rivals 3` too.
6. **Every pair, not only the reference.** A change to the shared model owes
   `--skis all`: a retune that suits the all-mountain pair can leave the
   downhill ski unable to make a bend or the powder ski bogged.
7. Run the sim-driven tests — `tests/simulation_test.ts` (the bot finishes
   what the generator builds), `determinism_test.ts` (the fingerprint). If one
   breaks, **the change is wrong or the test's world just moved — decide
   which explicitly, never silently.**
8. Finish with `playtest` — the simulator measures numbers, never fun.

## Caveats — what a bot run does and doesn't measure

- **The bot is a probe, not a proof of fun.** It skis like a competent human
  (`bot-improvement`); it measures pace, gate-taking and whether the map is
  skiable, not whether a kicker feels good.
- **Determinism is the instrument's calibration.** Same seed, same options ⇒
  same digest. If two runs diverge, stop tuning: the engine has a
  nondeterminism bug (`debug-game`), and every measurement is noise until it
  is fixed.
- **The bot and the physics are coupled.** A physics change can look like a
  regression because the BOT no longer suits the skier (its bend speed off
  `cornerGrip`, its kicker speed flown over the old snow, the radius it
  asks off the sidecut). Decide whether the fix belongs in `tuning.ts` or
  `bot.ts`, and say which in the PR.
- **Generator changes are measured here too**: a rules edit that builds
  legal-but-unskiable country shows as resets, trees and DNFs long before a
  human skis it. Pair with `make level` on the seeds that went wrong.

## Skill self-improvement

Load **`skill-reflection`** before this session commits. Settled balance reads
("harsh landings above N always trace to X", a column movement that reliably
diagnoses a cause) belong here — recorded as fragments, promoted into the
table above once they hold every time.
