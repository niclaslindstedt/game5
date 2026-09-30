# Simulation

The headless harness (`engine/sim/simulate.ts`) runs the REAL engine — `createGame`, `step`, the bot skier (`engine/sim/bot.ts`) — with no renderer attached and reports what happened. It is how a ski, snow, bot or generator change is MEASURED rather than argued: run it before and after, read the diff, paste both tables in the PR. `tests/simulation_test.ts` holds the bot to finishing what the generator builds, and `tests/determinism_test.ts` holds the digest.

## The harness

`simulateRun(seed, options?)` builds the seed's map (or skis `options.level`, a synthetic one in the tests), stands the bot on the start line's first slot with **no lights** (`countdown: 0`) and, by default, **nobody else on the line** (`rivals: 0` — a solo run is the measurement; `--rivals 3` is the race), and steps it at the engine's own 120 Hz until the finish line or `maxSeconds`. It returns a `RunReport`:

| Field                            | Meaning                                                                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `finished`, `time`               | The finish line, and the run clock at it (or at the timeout), s                                                    |
| `laps`, `lapTimes`               | Always one run on a generated map (R16); the table's `splits` column is the run's own time                         |
| `checkpoints`, `crossings`       | Gates credited, of the run's total — the start gate, every gate down the piste, the finish line                    |
| `trackLength`                    | The piste, m                                                                                                       |
| `powder`                         | How much of the piste's centreline lies under a drift (R17), 0..1 — what the catalog's rows are read against       |
| `topSpeed`, `meanSpeed`          | m/s; the mean is plan distance over the run clock                                                                  |
| `airTime`, `bestAir`, `jumps`    | Seconds of air summed over flights longer than 0.3 s, the longest flight, how many                                 |
| `harshLandings`                  | Landings the legs could not take whole (`land.harsh`)                                                              |
| `treeHits`, `bumps`              | Trunks met and (in a race) rivals shouldered                                                                       |
| `wipeouts`                       | Times the skier was thrown (`crash.ts`) — the table's `wipe`                                                       |
| `resets`, `autoResets`, `missed` | Resets, the engine's own among them, and gates skied past                                                          |
| `place`                          | Where the bot finished against the field (1 solo)                                                                  |
| `score`                          | The score the run banked (`tricks.ts`): the bot turns nothing, so it is its air and the ground its flights covered |
| `digest`                         | FNV-1a over the skier's position and speed every quarter second — the determinism fingerprint                      |

## The CLI

```sh
npm run sim                        # seeds 1..8, solo, top to bottom
npm run sim -- --count 20          # seeds 1..20
npm run sim -- --seeds 3,7,38      # these seeds
npm run sim -- --rivals 3          # a whole race
npm run sim -- --skis eagle        # one pair of the catalog (the all-mountain pair when left out)
npm run sim -- --skis all          # the catalog: every pair's table, then who was quickest on each seed
npm run sim -- --tricks            # each seed's map with its terrain park laid (R20)
npm run sim -- --region fell       # each seed's map built in another kind of snow country (R21)
npm run sim -- --json out.json
```

It exits non-zero when the bot finishes NO seed at all — a skier that cannot get down any map is broken, not slow. At the tuning in this tree (`make sim`; the table is re-run and pasted here with every change that moves it):

```
sim — engine 0.1.0 at 120 Hz · skis chamois · seeds 1,2,3,4,5,6,7,8 · laps map · rivals 0 · max 600 s
 seed  fin    time            splits     cps    len  pow  mean   top   air  best  jmp hrsh tree wipe  rst auto miss  plc  score    digest
    1  yes   273.8               271   28/28   3244  14%    45    89   0.8   0.4    2    0    0    0    0    0    0    1     40  76df483e
    2  yes   329.8               327   28/28   3258  42%    37    87   0.8   0.4    2    0    0    0    0    0    0    1     25  cc11fc38
    3  yes   275.8               273   27/27   3144   2%    46    93   2.1   0.6    5    0    0    0    1    0    1    1    218  a41649ba
    4  yes   257.8               255   27/27   3102   6%    45    90   0.0   0.2    0    0    0    0    0    0    0    1      3  a7611395
    5  yes   301.4               299   27/27   3090  40%    39    91   1.2   0.8    2    0    0    0    0    0    0    1    121  5bde067c
    6  yes   328.4               326   28/28   3216  33%    37    69   0.4   0.4    1    0    0    0    0    0    0    1     18  61dc218b
    7  yes   278.0               275   26/26   3060   3%    41   103   0.9   0.5    2    0    0    0    0    0    0    1    165  5f60dd23
    8  yes   282.8               280   27/27   3126  28%    41    84   1.0   0.7    2    0    0    0    0    0    0    1    109  d87b7951

8/8 finished · mean 41 km/h · top 103 km/h · air 0.9 s/run · jumps 16 · harsh 0 · trees 0 · wipeouts 0 · resets 1 (auto 0) · missed 1 · score 87/run
```

And the race, `make sim ARGS="--rivals 3"`:

```
sim — engine 0.1.0 at 120 Hz · skis chamois · seeds 1,2,3,4,5,6,7,8 · laps map · rivals 3 · max 600 s
 seed  fin    time            splits     cps    len  pow  mean   top   air  best  jmp hrsh tree wipe  rst auto miss  plc  score    digest
    1  yes   274.8               272   28/28   3244  14%    44    90   0.9   0.5    2    0    0    0    0    0    0    2    195  21c98efb
    2  yes   338.4               336   28/28   3258  42%    36    87   0.8   0.4    2    0    0    0    0    0    0    1     27  fb3e44d9
    3  yes   238.8               236   27/27   3144   2%    49    93   2.3   0.6    5    0    0    0    0    0    0    2    228  d64c13f0
    4  yes   257.5               255   27/27   3102   6%    45    90   0.0   0.2    0    0    0    0    0    0    0    2      4  671e7bc5
    5  yes   303.0               300   27/27   3090  40%    39    91   1.2   0.8    2    0    0    0    0    0    0    1    120  4449973e
    6  yes   331.1               329   28/28   3216  33%    36    69   0.4   0.4    1    0    0    0    0    0    0    2     19  6564a352
    7  yes   278.3               276   26/26   3060   3%    41   102   0.9   0.5    2    0    0    0    0    0    0    2    165  2ababb87
    8  yes   286.5               284   27/27   3126  28%    41    84   1.0   0.7    2    0    0    0    0    0    0    1    110  8b0a12f4

8/8 finished · mean 41 km/h · top 102 km/h · air 0.9 s/run · jumps 16 · harsh 0 · trees 0 · wipeouts 0 · resets 0 (auto 0) · missed 0 · score 109/run
```

## Reading the table

- **`pow`** is how much of the piste lies under a drift (R17) — the column the catalog is read against. `--skis all` ends with one row a seed, every pair's run time and a `*` on the quickest: no pair should win them all, and the powder pair should take the powder runs.
- **`fin` NO** on any seed is a regression until it is explained: the bot is a competent skier, and a map it cannot finish is a map a player will not finish either — or a skier that cannot get down what the generator builds.
- **`time`** is the run from the start line to the finish, top to bottom; on a three-kilometre piste at the bot's pace it is four to five minutes. A jump across every seed is a skier that got slower or a bot that got timid; a jump on one seed is that map.
- **`mean`** sits around 40–50 km/h for the bot today (a recreational skier's pace on a groomed piste; a downhill racer's tuck would be twice that), **`top`** near a hundred.
- **`air`/`jmp`** are the on-piste kickers (two to six a map). Fewer jumps than kickers is a kicker the bot takes too slowly to leave the snow; `best` over 2.5 s is a lip overshot.
- **`hrsh`** counts landings past `air.harshSpeed`: a few is a kicker whose landing the bot's plan misjudges; many is a landing model gone hard.
- **`tree`, `rst`, `auto`** should be zero or nearly. A tree hit on a generated map is the bot leaving the piste (R14 keeps the corridor clear); an automatic reset is a skier down or bogged.
- **`wipe`** must be zero on a solo run: every wipeout threshold (`TUNING.crash`) sits well past anything a clean run meets, so a wipeout there is a threshold come down into clean skiing or a bot that got worse. In a race a shoulder can put one down.
- **`miss`** is a gate skied past; the bot reads the gates in order, so a miss is a gate it could not turn back for — a bend too tight after a schuss, or a gate on the far side of a kicker's landing.
- **`score`** is what the run banked (`tricks.ts`). The bot turns nothing, so on a race map it is the air and the ground the kickers threw it across, combo by combo — a fall across every seed is a kicker that stopped throwing.
- **`digest`** changes with ANY change to the physics, the bot or the generator, and must not change between two runs of the same tree — `tests/determinism_test.ts` holds that.

## The bot (`engine/sim/bot.ts`)

A deterministic skier that reads the same `GameState` the HUD reads and produces the same `SkierInput` a thumb produces; it never reaches into the physics — what it knows about the skier it reads off `limits.ts` (the terminal speed on a grade, the edge at a speed, the carve's curvature, the corner grip, the braking). Its decisions, in the order they are made every step:

- **Where it is**: the nearest point of the piste, restricted to the stretch between the last gate it took and the one it owes — so a traverse's return leg is never mistaken for its own, and a gate gone past is a gate missed rather than a gate found again.
- **What it steers at**: a point `lookBase` + `lookPerSpeed`·v metres further down the centreline — or down its LANE, the line a rival's slot started on (`Rival.lane`, m right of the centreline), held in from the piste's edge by a margin that grows with speed, so the field holds its slots out of the gate and closes on the racing line as it gathers pace; the player's stand-in skis the centreline — against the heading its yaw rate is carrying it to; in powder it reads further ahead and asks for less edge.
- **Off the start line**: it poles out of the standing start and aims through the start gate onto the line.
- **How fast**: for every bend within braking reach, the speed its curvature allows at `cornerShare` of the corner grip, less what skidding at `brakeShare` of the grip can take off before it; for every on-piste KICKER, the speed its lip is taken at; a tuck where nothing needs the edge.
- **In the air**: levels the pitch to the slope it is going to land on, with the lean.
- **Trees**: moves its aim off a trunk standing in its line.
- **Giving up**: asks to be reset after `giveUpAfter` seconds without a gate.

A RIVAL is the same bot on a run of its own, its tuck capped at the pace it was dealt at the start line (`RACE.paceBand`).
